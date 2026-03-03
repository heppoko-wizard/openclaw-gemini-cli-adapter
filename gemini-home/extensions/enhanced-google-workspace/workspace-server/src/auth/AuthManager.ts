/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { google, Auth } from 'googleapis';
import crypto from 'node:crypto';
import * as http from 'node:http';
import * as net from 'node:net';
import * as url from 'node:url';
import { logToFile } from '../utils/logger';
import open from '../utils/open-wrapper';
import { shouldLaunchBrowser } from '../utils/secure-browser-launcher';
import { OAuthCredentialStorage } from './token-storage/oauth-credential-storage';
import { loadConfig } from '../utils/config';

const config = loadConfig();
const CLIENT_ID = config.clientId;
const CLIENT_SECRET = config.clientSecret;
const CLOUD_FUNCTION_URL = config.cloudFunctionUrl;
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

/**
 * An Authentication URL for updating the credentials of a Oauth2Client
 * as well as a promise that will resolve when the credentials have
 * been refreshed (or which throws error when refreshing credentials failed).
 */
interface OauthWebLogin {
  authUrl: string;
  loginCompletePromise: Promise<void>;
}

export class AuthManager {
  private client: Auth.OAuth2Client | null = null;
  private scopes: string[];
  private onStatusUpdate: ((message: string) => void) | null = null;

  constructor(scopes: string[]) {
    this.scopes = scopes;
  }

  public setOnStatusUpdate(callback: (message: string) => void) {
    this.onStatusUpdate = callback;
  }

  /**
   * クライアントシークレットを安全に取得します。
   * 直接埋め込みと将来的な Cloud Function 経由の取得の両方をサポートする抽象化レイヤーです。
   */
  private async getClientSecret(): Promise<string | null> {
    if (CLIENT_SECRET) {
      // 現在のモード: 直接埋め込みのシークレットを使用
      return CLIENT_SECRET;
    }

    // 将来的なモード: Cloud Function から動的に取得するためのプレースホルダー
    /*
    try {
      logToFile('Fetching secret from Cloud Function...');
      const response = await fetch(`${CLOUD_FUNCTION_URL}/getSecret`);
      const data = await response.json();
      return data.clientSecret;
    } catch (e) {
      logToFile('Failed to fetch secret from Cloud Function');
    }
    */

    return null;
  }

  private isTokenExpiringSoon(credentials: Auth.Credentials): boolean {
    return !!(
      credentials.expiry_date &&
      credentials.expiry_date < Date.now() + TOKEN_EXPIRY_BUFFER_MS
    );
  }

  private async loadCachedCredentials(
    client: Auth.OAuth2Client,
  ): Promise<boolean> {
    const credentials = await OAuthCredentialStorage.loadCredentials();

    if (credentials) {
      // Check if saved token has required scopes
      const savedScopes = new Set(credentials.scope?.split(' ') ?? []);
      logToFile(`Cached token has scopes: ${[...savedScopes].join(', ')}`);
      logToFile(`Required scopes: ${this.scopes.join(', ')}`);

      const missingScopes = this.scopes.filter(
        (scope) => !savedScopes.has(scope),
      );

      if (missingScopes.length > 0) {
        logToFile(
          `Token cache missing required scopes: ${missingScopes.join(', ')}`,
        );
        logToFile('Removing cached token to force re-authentication...');
        await OAuthCredentialStorage.clearCredentials();
        return false;
      } else {
        client.setCredentials(credentials);
        return true;
      }
    }

    return false;
  }

  public async getAuthenticatedClient(): Promise<Auth.OAuth2Client> {
    logToFile('getAuthenticatedClient called');

    // Check if we have a cached client with valid credentials
    if (
      this.client &&
      this.client.credentials &&
      this.client.credentials.refresh_token
    ) {
      logToFile('Returning existing cached client with valid credentials');
      
      const isExpired = this.isTokenExpiringSoon(this.client.credentials);
      if (isExpired) {
        logToFile('Token is expired, refreshing proactively...');
        try {
          await this.refreshToken();
        } catch (error) {
          logToFile(`Failed to refresh token: ${error}`);
          this.client = null;
          await OAuthCredentialStorage.clearCredentials();
        }
      }

      if (this.client) {
        return this.client;
      }
    }

    // クライアントの初期化（シークレット取得を抽象化）
    const secret = await this.getClientSecret();
    const options: Auth.OAuth2ClientOptions = {
      clientId: CLIENT_ID,
      clientSecret: secret || undefined,
    };
    const oAuth2Client = new google.auth.OAuth2(options);

    oAuth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        try {
          const current = (await OAuthCredentialStorage.loadCredentials()) || {};
          const merged = {
            ...tokens,
            refresh_token: tokens.refresh_token || current.refresh_token,
          };
          await OAuthCredentialStorage.saveCredentials(merged);
        } catch (e) {
          logToFile(`Error saving refreshed credentials: ${e}`);
        }
      }
    });

    logToFile('No valid cached client, checking for saved credentials...');
    if (await this.loadCachedCredentials(oAuth2Client)) {
      logToFile('Loaded saved credentials, caching and returning client');
      this.client = oAuth2Client;

      if (this.isTokenExpiringSoon(this.client.credentials)) {
        logToFile('Loaded token is expired, refreshing proactively...');
        try {
          await this.refreshToken();
        } catch (error) {
          logToFile(`Failed to refresh loaded token: ${error}`);
          this.client = null;
          await OAuthCredentialStorage.clearCredentials();
        }
      }

      if (this.client) {
        return this.client;
      }
    }

    const webLogin = await this.authWithWeb(oAuth2Client);
    await open(webLogin.authUrl);
    
    // 認証URLを確実にコンソールに表示
    console.error('\n========================================');
    console.error('ACTION REQUIRED: Google Authentication');
    console.error('Please open this URL in your browser:');
    console.error(webLogin.authUrl);
    console.error('========================================\n');

    const msg = 'Waiting for authentication... Check your browser.';
    logToFile(msg);
    if (this.onStatusUpdate) {
      this.onStatusUpdate(msg);
    }

    const authTimeout = 5 * 60 * 1000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('User is not authenticated. Authentication timed out after 5 minutes.'));
      }, authTimeout);
    });
    
    await Promise.race([webLogin.loginCompletePromise, timeoutPromise]);

    await OAuthCredentialStorage.saveCredentials(oAuth2Client.credentials);
    this.client = oAuth2Client;
    return this.client;
  }

  /**
   * 明示的に認証フローを開始し、ブラウザを開きます（インストーラー/セットアップ用）。
   */
  public async startAuthFlow(): Promise<void> {
    logToFile('startAuthFlow called');
    await this.getAuthenticatedClient();
    logToFile('Authentication completed successfully via startAuthFlow');
  }

  public async clearAuth(): Promise<void> {
    logToFile('Clearing authentication...');
    this.client = null;
    await OAuthCredentialStorage.clearCredentials();
    logToFile('Authentication cleared.');
  }

  public async refreshToken(): Promise<void> {
    logToFile('Manual token refresh triggered');
    if (!this.client) {
      logToFile('No client available to refresh, getting new client');
      this.client = await this.getAuthenticatedClient();
    }
    try {
      const secret = await this.getClientSecret();
      if (secret) {
        logToFile('Refreshing token locally using client secret...');
        const { credentials } = await this.client.refreshAccessToken();
        await OAuthCredentialStorage.saveCredentials(credentials);
        logToFile('Token refreshed and saved successfully locally');
        return;
      }

      const currentCredentials = { ...this.client.credentials };
      if (!currentCredentials.refresh_token) {
        throw new Error('No refresh token available');
      }

      logToFile('Calling cloud function to refresh token...');
      const response = await fetch(`${CLOUD_FUNCTION_URL}/refreshToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: currentCredentials.refresh_token }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
      }

      const newTokens = await response.json();
      const mergedCredentials = {
        ...newTokens,
        refresh_token: currentCredentials.refresh_token,
      };

      this.client.setCredentials(mergedCredentials);
      await OAuthCredentialStorage.saveCredentials(mergedCredentials);
      logToFile('Token refreshed and saved successfully via cloud function');
    } catch (error) {
      logToFile(`Error during token refresh: ${error}`);
      throw error;
    }
  }

  private async getAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const preferredPort = 8080;
      const tester = net.createServer();
      tester.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          const server = net.createServer();
          server.listen(0, () => {
            const address = server.address()! as net.AddressInfo;
            resolve(address.port);
            server.close();
          });
        } else {
          reject(err);
        }
      });
      tester.once('listening', () => {
        tester.close();
        resolve(preferredPort);
      });
      tester.listen(preferredPort);
    });
  }

  private async authWithWeb(client: Auth.OAuth2Client): Promise<OauthWebLogin> {
    logToFile(`Requesting authentication with scopes: ${this.scopes.join(', ')}`);

    const port = await this.getAvailablePort();
    const host = process.env['OAUTH_CALLBACK_HOST'] || 'localhost';
    const localRedirectUri = `http://${host}:${port}/oauth2callback`;
    const isGuiAvailable = shouldLaunchBrowser();
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const secret = await this.getClientSecret();

    let authUrl: string;

    if (secret) {
      logToFile('Using local direct OAuth flow...');
      authUrl = client.generateAuthUrl({
        redirect_uri: localRedirectUri,
        access_type: 'offline',
        scope: this.scopes,
        state: csrfToken,
        prompt: 'consent',
      });
    } else {
      logToFile('Using Cloud Function OAuth flow...');
      const statePayload = {
        uri: isGuiAvailable ? localRedirectUri : undefined,
        manual: !isGuiAvailable,
        csrf: csrfToken,
      };
      const state = Buffer.from(JSON.stringify(statePayload)).toString('base64');
      authUrl = client.generateAuthUrl({
        redirect_uri: CLOUD_FUNCTION_URL,
        access_type: 'offline',
        scope: this.scopes,
        state: state,
        prompt: 'consent',
      });
    }

    const loginCompletePromise = new Promise<void>((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        try {
          if (!req.url || !req.url.startsWith('/oauth2callback')) {
            res.end();
            return;
          }

          const qs = new url.URL(req.url, `http://${host}:${port}`).searchParams;
          const returnedState = qs.get('state');

          if (secret && returnedState !== csrfToken) {
            res.end('State mismatch. Possible CSRF attack.');
            reject(new Error('OAuth state mismatch.'));
            return;
          }

          if (qs.get('error')) {
            res.end();
            reject(new Error(`Google OAuth error: ${qs.get('error')}`));
            return;
          }

          if (secret) {
            const code = qs.get('code');
            if (code) {
              const { tokens } = await client.getToken({
                code,
                redirect_uri: localRedirectUri,
              });
              client.setCredentials(tokens);
              res.end('Authentication successful! Please return to the console.');
              resolve();
            } else {
              reject(new Error('No code received in direct OAuth flow.'));
            }
          } else {
            const access_token = qs.get('access_token');
            if (access_token) {
              const tokens: Auth.Credentials = {
                access_token: access_token,
                refresh_token: qs.get('refresh_token'),
                scope: qs.get('scope') || undefined,
                token_type: 'Bearer',
                expiry_date: parseInt(qs.get('expiry_date') || '0', 10),
              };
              client.setCredentials(tokens);
              res.end('Authentication successful! Please return to the console.');
              resolve();
            } else {
              reject(new Error('Authentication failed: Did not receive tokens from callback.'));
            }
          }
        } catch (e) {
          reject(e);
        } finally {
          server.close();
        }
      });

      server.listen(port, host);
    });

    return { authUrl, loginCompletePromise };
  }
}

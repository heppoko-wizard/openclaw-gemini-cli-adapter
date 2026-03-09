const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const url = require('url');
const { spawnSync, spawn } = require('child_process');

async function openBrowser(targetUrl) {
    const { exec } = require('child_process');
    let command;
    switch (process.platform) {
        case 'darwin': command = `open "${targetUrl}"`; break;
        case 'win32': command = `start "" "${targetUrl}"`; break;
        default: command = `xdg-open "${targetUrl}"`; break;
    }
    exec(command, (err) => {
        if (err) {
            console.log('\n  ブラウザを自動で開けませんでした。以下のURLを手動で開いてください:\n');
            console.log(`  ${targetUrl}\n`);
        }
    });
}

const CLIENT_ID = '749757772377-a5a7ks4ovgcrm4rftds6vb7419amc3lb.apps.googleusercontent.com';
const DUMMY_SECRET = 'DUMMY_SECRET_PROXY'; // The real secret is safely on Vercel
const VERCEL_TOKEN_URI = 'https://gws-oauth-proxy.vercel.app/api/oauth';
const SCOPES = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.appdata',
    'https://www.googleapis.com/auth/profile.agerange.read',
    'https://www.googleapis.com/auth/profile.language.read',
    'https://www.googleapis.com/auth/user.addresses.read',
    'https://www.googleapis.com/auth/user.birthday.read',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/tasks',
    'https://www.googleapis.com/auth/contacts',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
];

async function exchangeCodeThroughVercelProxy(code, redirectUri) {
    // Vercelプロキシにトークン交換リクエストを送信
    const fetch = require('node-fetch') || global.fetch; // Supports node 18+ native fetch
    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);

    console.log(`  Vercelプロキシ (${VERCEL_TOKEN_URI}) でトークンを安全に交換中...`);

    // Basic Auth header for proxy to parse client_id
    const authHeader = 'Basic ' + Buffer.from(`${CLIENT_ID}:${DUMMY_SECRET}`).toString('base64');

    const tokenRes = await fetch(VERCEL_TOKEN_URI, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': authHeader
        },
        body: params.toString()
    });

    const data = await tokenRes.json();
    if (!tokenRes.ok) {
        throw new Error(`Token exchange failed: ${data.error} - ${data.error_description || ''}`);
    }
    return data;
}

async function runAuth() {
    return new Promise((resolve, reject) => {
        const client = new OAuth2Client(CLIENT_ID, DUMMY_SECRET);

        const server = http.createServer();
        server.listen(0, '127.0.0.1', async () => {
            const port = server.address().port;
            const redirectUri = `http://127.0.0.1:${port}/oauth2/callback`;

            const state = crypto.randomBytes(32).toString('hex');
            const authUrl = client.generateAuthUrl({
                redirect_uri: redirectUri,
                access_type: 'offline',
                scope: SCOPES,
                state,
                prompt: 'consent'
            });

            console.log('\n  ブラウザで Google Workspace の認証を完了してください...');
            console.log(`  🔗 ${authUrl}\n`);
            await openBrowser(authUrl);

            server.on('request', async (req, res) => {
                try {
                    const reqUrl = new url.URL(req.url, `http://127.0.0.1:${port}`);

                    if (!reqUrl.pathname.startsWith('/oauth2/callback')) {
                        res.writeHead(404);
                        res.end('Not Found');
                        return;
                    }

                    const code = reqUrl.searchParams.get('code');
                    const err = reqUrl.searchParams.get('error');
                    const returnedState = reqUrl.searchParams.get('state');

                    if (err) {
                        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end('<h1>認証エラー</h1><p>ブラウザを閉じてターミナルを確認してください。</p>');
                        reject(new Error(`Google OAuth error: ${err}`));
                        server.close();
                        return;
                    }

                    if (returnedState !== state) {
                        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end('<h1>セキュリティエラー</h1><p>状態が一致しません。CSRF攻撃の可能性があります。</p>');
                        reject(new Error('State mismatch'));
                        server.close();
                        return;
                    }

                    if (code) {
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end('<h1>認証準備完了！</h1><p>ブラウザを閉じてターミナルに戻り、gogcliのインポートを完了してください。</p><script>window.close();</script>');

                        try {
                            const tokens = await exchangeCodeThroughVercelProxy(code, redirectUri);

                            // gogcliインポート用のJSONを生成
                            const email = 'brownie-user@openclaw.local'; // dummy label for gogcli
                            const importData = {
                                email: email,
                                access_token: tokens.access_token,
                                token_type: tokens.token_type,
                                refresh_token: tokens.refresh_token,
                                expiry: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString()
                            };

                            const tmpFile = path.join(os.tmpdir(), 'gog-import.json');
                            fs.writeFileSync(tmpFile, JSON.stringify(importData, null, 2), { mode: 0o600 });

                            console.log(`\n  ✅ トークンを取得しました！gogcli にインポートします...`);
                            console.log(`  🔑 Keyringのパスフレーズを求められた場合は入力してください。`);

                            const gogImport = spawnSync('gog', ['auth', 'tokens', 'import', tmpFile], { stdio: 'inherit' });

                            // 削除して安全に
                            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);

                            if (gogImport.status === 0) {
                                console.log(`  🎉 gogCLI への認証情報のインポートが成功しました！`);
                                resolve();
                            } else {
                                reject(new Error(`gog auth tokens import failed with exit code ${gogImport.status}`));
                            }
                        } catch (exchangeErr) {
                            reject(exchangeErr);
                        } finally {
                            server.close();
                        }
                    } else {
                        res.writeHead(400);
                        res.end('No code provided');
                        reject(new Error('No authorization code provided'));
                        server.close();
                    }
                } catch (e) {
                    res.writeHead(500);
                    res.end('Internal Server Error');
                    reject(e);
                    server.close();
                }
            });
        });

        server.on('error', (err) => {
            reject(err);
        });
    });
}

runAuth().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error(`\n  ❌ 認証失敗: ${err.message}`);
    process.exit(1);
});

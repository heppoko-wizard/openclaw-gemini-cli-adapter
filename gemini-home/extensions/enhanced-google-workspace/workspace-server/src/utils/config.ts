/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'node:path';
import { logToFile } from './logger';

// .env ファイルをプロジェクトルートから読み込む（開発モード用）
// Node.js v20.6+ に組み込まれた機能を使用するため dotenv は不要
// WORKSPACE_CLIENT_SECRET が空の場合 → Cloud Function 経由 OAuth に自動フォールバック
const envPath = path.resolve(__dirname, '../../.env');
try {
  // @ts-ignore — process.loadEnvFile は Node v20.6+ で使用可能
  (process as any).loadEnvFile(envPath);
  logToFile(`Loaded .env from: ${envPath}`);
} catch {
  // .env が存在しない場合は無視（Cloud Function モードで動作）
  logToFile('.env not found, running without local credentials (Cloud Function mode)');
}

export interface WorkspaceConfig {
  clientId: string;
  clientSecret: string;
  cloudFunctionUrl: string;
}

// デフォルト値：Cloud Function URL のみ設定（CLIENT_SECRET なし = Cloud Function OAuth）
const DEFAULT_CLOUD_FUNCTION_URL = 'https://google-workspace-extension.geminicli.com';

/**
 * Loads the configuration.
 * - 開発モード: .env の WORKSPACE_CLIENT_ID / WORKSPACE_CLIENT_SECRET を使用（ローカル直接 OAuth）
 * - 配布モード: 環境変数未設定 or CLIENT_SECRET なし → CLOUD_FUNCTION_URL 経由 OAuth
 */
export function loadConfig(): WorkspaceConfig {
  const config: WorkspaceConfig = {
    clientId: process.env['WORKSPACE_CLIENT_ID'] || '',
    clientSecret: process.env['WORKSPACE_CLIENT_SECRET'] || '',
    cloudFunctionUrl:
      process.env['WORKSPACE_CLOUD_FUNCTION_URL'] ||
      DEFAULT_CLOUD_FUNCTION_URL,
  };

  const mode = config.clientSecret ? 'LOCAL DIRECT OAuth' : 'CLOUD FUNCTION OAuth';
  logToFile(`Auth mode: ${mode} (clientId: ${config.clientId ? '***' + config.clientId.slice(-4) : 'NOT SET'})`);

  return config;
}

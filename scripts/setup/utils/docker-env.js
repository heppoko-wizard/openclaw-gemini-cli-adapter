'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

// パス定義：すべてのルートはプロジェクトの一番上
// このファイルは src/setup/utils/ にある前提なので、その３つ上の階層がルート
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// 統合設定ディレクトリ
const DOCKER_CONFIG_DIR = path.join(PROJECT_ROOT, '.docker-config');

// 各種設定の格納先
const GEMINI_CREDS_DIR = path.join(DOCKER_CONFIG_DIR, 'gemini');
const OPENCLAW_DIR = path.join(DOCKER_CONFIG_DIR, 'openclaw');
const OPENCLAW_CONFIG = path.join(OPENCLAW_DIR, 'openclaw.json');

// gogcli の設定ファイル保存先
const GOG_CONFIG_DIR = path.join(GEMINI_CREDS_DIR, '.config', 'gogcli');
const GOG_CREDS_FILE = path.join(GOG_CONFIG_DIR, 'client_secret.json');


/**
 * Gemini CLI の認証トークンが存在するかチェックする
 */
function hasCredentials() {
    const checkDir = (dir) => ['oauth_creds.json', 'google_accounts.json'].every(f =>
        fs.existsSync(path.join(dir, '.gemini', f))
    );
    return checkDir(GEMINI_CREDS_DIR);
}

/**
 * Google Workspace (gogcli) 用の環境変数を構築する
 * .docker-config配下をXDG_CONFIG_HOMEとして指定して隔離する
 */
function getGogEnv() {
    return {
        ...process.env,
        XDG_CONFIG_HOME: path.join(GEMINI_CREDS_DIR, '.config'),
        GOG_KEYRING_BACKEND: 'file',
        GOG_KEYRING_PASSWORD: 'openclaw-adapter'
    };
}

module.exports = {
    PROJECT_ROOT,
    DOCKER_CONFIG_DIR,
    GEMINI_CREDS_DIR,
    OPENCLAW_DIR,
    OPENCLAW_CONFIG,
    GOG_CONFIG_DIR,
    GOG_CREDS_FILE,
    hasCredentials,
    getGogEnv
};

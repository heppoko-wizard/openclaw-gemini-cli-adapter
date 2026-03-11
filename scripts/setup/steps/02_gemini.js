'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { C, logBold, logSuccess } = require('../utils/logger');
const { pressEnter } = require('../utils/prompt');
const { L } = require('../utils/i18n');
const { hasCredentials, PROJECT_ROOT, GEMINI_CREDS_DIR } = require('../utils/docker-env');

module.exports = async function runStep() {
    if (hasCredentials()) {
        logSuccess('✓ [済] Gemini CLI 認証');
        return;
    }

    logBold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logBold(L().auth_title);
    logBold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    L().auth_guide.forEach(line => console.log(`  ${line}`));

    await pressEnter(L().auth_start);

    // docker-setup.js はルートに存在するため、scripts/setup-gemini-auth.js の参照先は ./scripts/setup-gemini-auth.js
    const authScript = path.join(PROJECT_ROOT, 'scripts', 'setup-gemini-auth.js');

    if (fs.existsSync(authScript)) {
        try {
            // 認証用の依存パッケージがない場合はインストールする (npm i --omit=dev)
            if (!fs.existsSync(path.join(PROJECT_ROOT, 'node_modules'))) {
                console.log(C.dim('  認証用の依存パッケージをインストール中...'));
                const res = spawnSync('npm', ['install', '--omit=dev'], { stdio: 'ignore', cwd: PROJECT_ROOT, shell: true });
                if (res.status !== 0) {
                    throw new Error('依存関係のインストールに失敗しました。');
                }
            }

            await new Promise((resolve, reject) => {
                const child = spawn('node', [authScript], {
                    cwd: PROJECT_ROOT,
                    env: { ...process.env, GEMINI_CLI_HOME: GEMINI_CREDS_DIR },
                    stdio: ['ignore', 'inherit', 'inherit'],
                    shell: false
                });
                child.on('close', resolve);
                child.on('error', reject);
            });
        } catch (e) {
            console.error(e);
            throw new Error('Gemini認証スクリプトの実行に失敗しました。');
        }
    } else {
        throw new Error('認証スクリプトが見つかりません: ' + authScript);
    }

    if (hasCredentials()) {
        console.log(`\n  ${C.green(L().auth_done)}`);
    } else {
        throw new Error('認証が正しく完了しなかったようです。リトライしてください。');
    }
};

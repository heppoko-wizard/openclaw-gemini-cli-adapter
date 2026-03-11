'use strict';

const fs = require('fs');
const path = require('path');
const { C, logDim, logSuccess, logError } = require('../utils/logger');
const { OPENCLAW_CONFIG, GEMINI_CREDS_DIR } = require('../utils/docker-env');

module.exports = async function runStep() {
    let needsUpdate = true;

    // スキップ判定（簡易版）: configファイルが既に書き込まれていればスキップ
    const settingsDir = path.join(GEMINI_CREDS_DIR, '.gemini');
    const settingsPath = path.join(settingsDir, 'settings.json');
    if (fs.existsSync(OPENCLAW_CONFIG) && fs.existsSync(settingsPath)) {
        // 設定済みならスキップ
        logSuccess('✓ [済] 設定ファイルの生成');
        return;
    }

    process.stdout.write(`\n  ${C.dim('設定ファイルを生成中...')} `);
    try {
        let config = {};
        fs.mkdirSync(path.dirname(OPENCLAW_CONFIG), { recursive: true });
        config.agents = { defaults: { model: 'gemini-adapter/auto-gemini-3' } };
        config.gateway = { mode: 'local', auth: { token: 'openclaw-docker-session' } };
        fs.writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2));

        fs.mkdirSync(settingsDir, { recursive: true });

        let settings = {
            model: { name: 'auto-gemini-3' },
            security: { auth: { selectedType: 'oauth-personal' }, folderTrust: { enabled: false } },
            tools: { sandbox: false },
            // コンテナ側のワークスペースパス (/workspace) のみを許可する
            context: { includeDirectories: ['/workspace'] }
        };
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        logSuccess('DONE');
    } catch (e) { logError('FAIL: ' + e.message); throw e; }
};

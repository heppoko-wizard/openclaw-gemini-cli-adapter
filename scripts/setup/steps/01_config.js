'use strict';

const fs = require('fs');
const path = require('path');
const { C, logDim, logSuccess, logError } = require('../utils/logger');
const { OPENCLAW_CONFIG, GEMINI_CREDS_DIR, PROJECT_ROOT } = require('../utils/docker-env');

module.exports = async function runStep() {
    const settingsDir = path.join(GEMINI_CREDS_DIR, '.gemini');
    const settingsPath = path.join(settingsDir, 'settings.json');

    process.stdout.write(`\n  ${C.dim('設定ファイルを生成・更新中...')} `);
    try {
        let config = {};
        fs.mkdirSync(path.dirname(OPENCLAW_CONFIG), { recursive: true });
        if (fs.existsSync(OPENCLAW_CONFIG)) {
            try { config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf8')); } catch (e) { }
        }
        config.agents = config.agents || {};
        config.agents.defaults = config.agents.defaults || {};
        config.agents.defaults.model = 'gemini-adapter/auto-gemini-3';
        config.gateway = config.gateway || {};
        config.gateway.mode = 'local';
        config.gateway.auth = config.gateway.auth || {};
        config.gateway.auth.mode = 'none';
        if (config.gateway.auth.token) delete config.gateway.auth.token;
        fs.writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2));

        fs.mkdirSync(settingsDir, { recursive: true });
        let settings = {};
        if (fs.existsSync(settingsPath)) {
            try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch (e) { }
        }
        settings.model = settings.model || { name: 'auto-gemini-3' };
        settings.security = settings.security || { auth: { selectedType: 'oauth-personal' }, folderTrust: { enabled: false } };
        settings.tools = settings.tools || { sandbox: false };
        settings.context = settings.context || { includeDirectories: ['/workspace'] };
        settings.mcpServers = settings.mcpServers || {};
        settings.mcpServers["openclaw-tools"] = {
            "command": "node",
            "args": [path.join(PROJECT_ROOT, "mcp-server.mjs"), "mcp-default", "/workspace"],
            "trust": true
        };
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        logSuccess('DONE');
    } catch (e) { logError('FAIL: ' + e.message); throw e; }
};

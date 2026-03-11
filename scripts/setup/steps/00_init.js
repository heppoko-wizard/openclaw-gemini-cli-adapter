'use strict';

const fs = require('fs');
const { setLang, L } = require('../utils/i18n');
const { select } = require('../utils/prompt');
const { C, logBold, logInfo, clear } = require('../utils/logger');
const { DOCKER_CONFIG_DIR, GEMINI_CREDS_DIR, OPENCLAW_DIR } = require('../utils/docker-env');

module.exports = async function runStep() {
    clear();

    const langIdx = await select(['日本語 (Japanese)', 'English'], 'Select Language / 言語選択');
    const lang = langIdx === 0 ? 'ja' : 'en';
    setLang(lang);

    clear();
    console.log(`\n  ${C.magenta(C.bold(L().welcome))}`);
    console.log(`\n  ${C.cyan(C.bold(L().caution_title))}`);
    console.log(`  ${L().caution_text}`);

    // ディレクトリ初期化
    fs.mkdirSync(DOCKER_CONFIG_DIR, { recursive: true });
    fs.mkdirSync(GEMINI_CREDS_DIR, { recursive: true });
    fs.mkdirSync(OPENCLAW_DIR, { recursive: true });

    logInfo('✓ 状態隔離用の一時ディレクトリ（.docker-config）を初期化しました');
};

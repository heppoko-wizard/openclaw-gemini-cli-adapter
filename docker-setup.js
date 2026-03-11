#!/usr/bin/env node
/**
 * docker-setup.js — OpenClaw Gemini CLI Adapter (Docker Hybrid Setup)
 * モジュール化されたセットアップの各工程を順次呼び出すオーケストレーターです。
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const { clear, logBold, logSuccess, logError, logWarn, C } = require('./scripts/setup/utils/logger');
const { PROJECT_ROOT } = require('./scripts/setup/utils/docker-env');
const { L } = require('./scripts/setup/utils/i18n');

async function main() {
    clear();

    // ==========================================
    // 1. 各セットアップステップの順次実行
    // ==========================================
    try {
        await require('./scripts/setup/steps/00_init')();
        await require('./scripts/setup/steps/01_config')();
        await require('./scripts/setup/steps/02_gemini')();
        await require('./scripts/setup/steps/03_gogcli')();
        await require('./scripts/setup/steps/05_workspace')();
    } catch (e) {
        logError('\n⚠ 致命的なエラーが発生し、セットアップが中断されました:');
        console.error(e);
        process.exit(1);
    }

    // ==========================================
    // 2. 完了メッセージ
    // ==========================================
    logBold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logSuccess(L()?.done || '🎉 全ての準備が整いました。');
    logBold(C.green('\n🎉 セットアップが正常に完了しました！'));
    console.log(`\n  ダッシュボード: ${C.cyan('http://localhost:18789?token=openclaw-docker-session')}`);
    console.log(`  (Tailscale利用時: http://TailscaleのIP:18789?token=openclaw-docker-session)`);
}

main().catch(err => {
    logError('\n⚠ 予期せぬエラーが発生しました:');
    console.error(err);
    process.exit(1);
});

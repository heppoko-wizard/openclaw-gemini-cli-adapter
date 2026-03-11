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
        await require('./scripts/setup/steps/04_tailscale')();
        await require('./scripts/setup/steps/05_workspace')();
    } catch (e) {
        logError('\n⚠ 致命的なエラーが発生し、セットアップが中断されました:');
        console.error(e);
        process.exit(1);
    }

    // ==========================================
    // 2. Docker Daemon の状態確認と起動 (WSL対策)
    // ==========================================
    const dockerCheck = require('child_process').spawnSync('docker', ['info'], { stdio: 'ignore' });
    if (dockerCheck.status !== 0) {
        logWarn('\n⚠ Dockerデーモンが停止しているようです。起動を試みます...');
        if (process.platform === 'linux') {
            const startRes = require('child_process').spawnSync('sudo', ['service', 'docker', 'start'], { stdio: 'inherit' });
            if (startRes.status === 0) {
                logSuccess('✓ Dockerデーモンを起動しました。');
                // デーモン起動直後の待機
                require('child_process').spawnSync('sleep', ['2']);
            } else {
                logError('⚠ Dockerデーモンの起動に失敗しました。');
            }
        }
    }

    // ==========================================
    // 3. Docker Compose コンテナ起動
    // ==========================================
    logBold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logSuccess(L()?.done || '🎉 全ての準備が整いました。コンテナを起動しています...');

    const composeCmd = 'docker';
    const composeArgs = ['compose', 'up', '-d', '--build'];

    console.log(`  ${C.cyan(`$ ${composeCmd} ${composeArgs.join(' ')}`)}`);
    const dockerProc = spawn(composeCmd, composeArgs, { stdio: 'inherit', cwd: PROJECT_ROOT });

    dockerProc.on('close', (code) => {
        if (code === 0) {
            logBold(C.green('\n🎉 セットアップと起動が完了しました！'));
            console.log(`  ダッシュボード: ${C.cyan('http://localhost:18789?token=openclaw-docker-session')}`);
            console.log(`  (Tailscale利用時: http://TailscaleのIP:18789?token=openclaw-docker-session)`);
        } else {
            // WSLなどグループ反映が遅延している場合のフォールバック
            logWarn('\n⚠ 通常のDocker起動に失敗しました。sudo を使用して再試行します...');
            const sudoProc = spawn('sudo', ['docker', 'compose', 'up', '-d', '--build'], { stdio: 'inherit', cwd: PROJECT_ROOT });

            sudoProc.on('close', (sudoCode) => {
                if (sudoCode === 0) {
                    logBold(C.green('\n🎉 セットアップと起動が完了しました！(sudoモード)'));
                    console.log(`  ダッシュボード: ${C.cyan('http://localhost:18789?token=openclaw-docker-session')}`);
                    console.log(`  (Tailscale利用時: http://TailscaleのIP:18789?token=openclaw-docker-session)`);
                } else {
                    logError('\n⚠ コンテナの起動に失敗しました。Docker Desktop またはデーモンが起動しているか確認してください。');
                    process.exit(1);
                }
            });
        }
    });
}

main().catch(err => {
    logError('\n⚠ 予期せぬエラーが発生しました:');
    console.error(err);
    process.exit(1);
});

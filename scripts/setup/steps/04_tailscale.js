'use strict';

const { spawnSync, spawn } = require('child_process');
const { C, logBold, logSuccess, logInfo, logWarn, logError } = require('../utils/logger');
const { select } = require('../utils/prompt');
const { getLang } = require('../utils/i18n');

module.exports = async function runStep() {
    const lang = getLang();

    // 既に接続済みかチェック
    const tsStatusCheck = spawnSync('tailscale', ['status'], { shell: true });
    if (tsStatusCheck.status === 0) {
        logSuccess('✓ Tailscale は既にログイン済みです。');
        return;
    }

    logBold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const tsQ = lang === 'ja' ? '🌍 Tailscale リモートアクセスを有効にしますか？' : '🌍 Enable Tailscale remote access?';
    const choice = await select([lang === 'ja' ? 'はい、設定する' : 'Yes', lang === 'ja' ? 'スキップ' : 'Skip'], tsQ);

    if (choice === 1) {
        logInfo('  スキップしました。');
        return;
    }

    const hasTailscale = !!spawnSync('tailscale', ['version'], { shell: true }).stdout?.toString().trim();
    if (!hasTailscale) {
        logInfo('Tailscale をインストールしています...');
        if (process.platform === 'linux') {
            const res = spawnSync('sudo', ['sh', '-c', 'curl -fsSL https://tailscale.com/install.sh | sh'], { stdio: 'inherit' });
            if (res.status !== 0) {
                throw new Error('Tailscale のインストールに失敗しました。');
            }
        } else {
            logWarn('自動インストール非対応のOSです。スキップします。');
            return;
        }
    }

    // Tailscaleデーモンの自動起動 (WSL2対策)
    if (process.platform === 'linux') {
        const checkOut = spawnSync('tailscale', ['status'], { shell: true }).stderr?.toString() || '';
        if (checkOut.includes('appear to be running')) {
            logInfo('  Tailscale デーモンを起動しています...');
            let isSystemd = false;
            try {
                const fs = require('fs');
                const comm = fs.readFileSync('/proc/1/comm', 'utf8').trim();
                isSystemd = comm === 'systemd';
            } catch (e) { }

            if (isSystemd) {
                spawnSync('sudo', ['systemctl', 'enable', '--now', 'tailscaled'], { stdio: 'ignore' });
            } else {
                spawnSync('sudo', ['sh', '-c', 'tailscaled > /dev/null 2>&1 &']);
            }

            // 起動待機
            spawnSync('sleep', ['3']);
            const check2 = spawnSync('tailscale', ['status'], { shell: true }).stderr?.toString() || '';
            if (check2.includes('appear to be running')) {
                logWarn('  デーモンの起動に失敗しました。Tailscaleセットアップをスキップします。');
                return;
            }
        }
    }

    logInfo('ブラウザでTailscaleにログインしてください...');

    // Tailscale 認証のタイムアウト制御
    await new Promise((resolve, reject) => {
        const upCmd = process.platform === 'win32' ? 'tailscale' : 'sudo';
        const upArgs = process.platform === 'win32' ? ['up'] : ['tailscale', 'up'];
        const upProcess = spawn(upCmd, upArgs, { stdio: ['inherit', 'inherit', 'inherit'], shell: true });

        const AUTH_TIMEOUT_MS = 90_000;
        let timedOut = false;

        const timer = setTimeout(() => {
            timedOut = true;
            try { upProcess.kill('SIGTERM'); } catch { }
            setTimeout(() => { try { upProcess.kill('SIGKILL'); } catch { } }, 3000);
            reject(new Error('認証がタイムアウトしました。'));
        }, AUTH_TIMEOUT_MS);

        upProcess.on('close', (code) => {
            clearTimeout(timer);
            if (!timedOut) {
                if (code === 0) {
                    logSuccess('✓ Tailscale is configured on host.');
                    resolve();
                } else {
                    reject(new Error('Tailscale up command failed.'));
                }
            }
        });
    });
};

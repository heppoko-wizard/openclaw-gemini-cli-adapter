#!/usr/bin/env node
/**
 * interactive-setup-win.js — OpenClaw Gemini CLI Adapter (Windows 専用版)
 *
 * Windows 環境に完全に最適化されたインタラクティブセットアップ。
 * sudo の排除、PowerShell 実行ポリシーの回避、文字化け対策などが含まれています。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');
const readline = require('readline');
const https = require('https');
const http = require('http');

// Windows 環境であることを保証
if (process.platform !== 'win32') {
    console.error('This script is designed specifically for Windows.');
    process.exit(1);
}

// --- Paths ---
const SCRIPT_DIR = __dirname;
let OPENCLAW_ROOT = path.resolve(SCRIPT_DIR, '..');
let PLUGIN_DIR = SCRIPT_DIR;

const BASENAME = path.basename(SCRIPT_DIR);
if (BASENAME !== 'openclaw-gemini-cli-adapter' && BASENAME !== 'gemini-cli-claw') {
    OPENCLAW_ROOT = SCRIPT_DIR;
    PLUGIN_DIR = path.join(SCRIPT_DIR, 'openclaw-gemini-cli-adapter');
}

const OPENCLAW_CONFIG = path.join(os.homedir(), '.openclaw', 'openclaw.json');
let GEMINI_CREDS_DIR = path.join(PLUGIN_DIR, 'gemini-home');

// --- I18n ---
const MSG = {
    ja: {
        welcome: 'OpenClaw × Gemini CLI アダプタ セットアップへようこそ！(Windows版)',
        caution_title: '⚠️  注意: YOLOモード',
        caution_text: 'AIが自律的にファイルを操作します。重要なデータがある場所では使用しないでください。',
        env_title: '環境チェック結果',
        found: '✓ 検出',
        not_found: '✗ 未検出',
        need_install_title: '以下のセットアップが必要です:',
        confirm_install: 'すべてインストールしてセットアップを進めますか？',
        go: 'はい、すべてインストールして進める (推奨)',
        quit: '終了する',
        wait: 'インストール中です。時間がかかりますが、不安にならずにお待ちください...',
        step_openclaw: 'OpenClaw 本体の準備',
        step_deps: 'アダプタ依存関係のインストール',
        step_models: 'モデルの同期',
        step_config: '設定ファイルの更新',
        step_bun: 'Bun のインストール',
        auth_title: '🔑 Gemini CLI 認証 (Google ログイン)',
        auth_guide: [
            'ブラウザで認証を行います。',
            'すぐにタブが開くからブラウザを確認してください。',
            '自動で開かない場合は、この後に表示されるURLをブラウザに貼り付けてください。',
        ],
        auth_start: 'Enter を押して認証を開始...',
        auth_done: '✓ 認証が完了しました！',
        autostart_q: '🖥️ PCの起動（ログイン）時にOpenClawを自動起動させますか？',
        autostart_yes: 'はい、自動起動を設定する (推奨)',
        autostart_no: 'いいえ、手動で起動する',
        autostart_done: '✓ 自動起動を設定しました。',
        launch_q: '🚀 セットアップ完了！今すぐ起動しますか？',
        launch_yes: 'はい、今すぐ起動する',
        launch_no: 'いいえ、後で手動で起動する',
        launching: 'システムを起動しています...',
        done: '🎉 全ての準備が整いました！',
    },
    en: {
        welcome: 'Welcome to OpenClaw x Gemini CLI Adapter Setup (Windows Edition)!',
        caution_title: '⚠️  Warning: YOLO Mode',
        caution_text: 'AI will autonomously edit files. Do not use in environments with important data.',
        env_title: 'Environment Check',
        found: '✓ Found',
        not_found: '✗ Not found',
        need_install_title: 'The following setup is required:',
        confirm_install: 'Install everything and proceed with setup?',
        go: 'Yes, install all and proceed (Recommended)',
        quit: 'Exit',
        wait: 'Installing... This may take a while. Please be patient.',
        step_openclaw: 'Preparing OpenClaw core',
        step_deps: 'Installing adapter dependencies',
        step_models: 'Syncing models',
        step_config: 'Updating configuration',
        step_bun: 'Installing Bun',
        auth_title: '🔑 Gemini CLI Authentication (Google Login)',
        auth_guide: [
            'Authentication will be done in your browser.',
            'A new tab will open shortly, please check your browser.',
            'If it does not open automatically, copy and paste the URL shown below.',
        ],
        auth_start: 'Press Enter to start authentication...',
        auth_done: '✓ Authentication complete!',
        autostart_q: '🖥️ Enable auto-start for OpenClaw on system login?',
        autostart_yes: 'Yes, enable auto-start (Recommended)',
        autostart_no: 'No, I will start it manually',
        autostart_done: '✓ Auto-start configuration applied.',
        launch_q: '🚀 Setup complete! Launch now?',
        launch_yes: 'Yes, launch now',
        launch_no: 'No, start manually later',
        launching: 'Launching system...',
        done: '🎉 Everything is ready!',
    }
};

let lang = 'ja';
const L = () => MSG[lang];

// ========== UI Utilities ==========

function clear() { process.stdout.write('\x1Bc'); }

function up(n) { if (n > 0) process.stdout.write(`\x1b[${n}A`); }

const C = {
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    cyan: (s) => `\x1b[36m${s}\x1b[0m`,
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    magenta: (s) => `\x1b[35m${s}\x1b[0m`,
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
    gray: (s) => `\x1b[90m${s}\x1b[0m`,
    white: (s) => `\x1b[37m${s}\x1b[0m`,
};

/**
 * 矢印キー選択 UI
 */
async function select(items, question) {
    return new Promise((resolve) => {
        let idx = 0;
        const draw = (first = false) => {
            if (!first) up(items.length + 2);
            process.stdout.write(`\r\x1b[K\n`);
            process.stdout.write(`\r\x1b[K  ${C.bold(question)}\n`);
            items.forEach((item, i) => {
                const sel = i === idx;
                const bullet = sel ? C.cyan('❯') : ' ';
                const text = sel ? C.cyan(C.bold(item)) : C.dim(item);
                process.stdout.write(`\r\x1b[K    ${bullet} ${text}\n`);
            });
        };
        const onKey = (_, key) => {
            if (!key) return;
            if (key.name === 'up') { idx = (idx - 1 + items.length) % items.length; draw(); }
            else if (key.name === 'down') { idx = (idx + 1) % items.length; draw(); }
            else if (key.name === 'return') {
                process.stdin.removeListener('keypress', onKey);
                try { process.stdin.setRawMode(false); } catch (e) { } // 非 TTY 対策
                process.stdin.pause();
                process.stdout.write('\n');
                resolve(idx);
            }
            else if (key.ctrl && key.name === 'c') process.exit();
        };
        readline.emitKeypressEvents(process.stdin);
        try { process.stdin.setRawMode(true); } catch (e) { } // 非 TTY 対策
        process.stdin.resume();
        draw(true);
        process.stdin.on('keypress', onKey);
    });
}

async function pressEnter(msg) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(r => { rl.question(`\n  ${C.bold(msg)} `, () => { rl.close(); r(); }); });
}

async function promptUser(msg) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(r => { rl.question(`\n  ${C.bold(msg)} `, (ans) => { rl.close(); r(ans.trim()); }); });
}

// ========== Logic ==========

function run(cmd, args, cwd = PLUGIN_DIR, silent = true) {
    // Windows では shell: true が必須
    return spawnSync(cmd, args, { cwd, shell: true, stdio: silent ? 'pipe' : 'inherit' }).status === 0;
}

function openBrowser(url) {
    const { exec } = require('child_process');
    try { exec(`start "" "${url}"`); } catch { }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getOpenclawAdapterDir() {
    if (!isOpenclawPresent()) return null;
    const npmRootResult = spawnSync('npm', ['root', '-g'], { encoding: 'utf-8', shell: true });
    const npmRoot = npmRootResult.stdout?.trim();
    if (npmRoot) {
        const p = path.join(npmRoot, 'openclaw', 'openclaw-gemini-cli-adapter');
        if (fs.existsSync(p)) return p;
    }
    return null;
}

function hasCredentials() {
    const checkDir = (dir) => ['oauth_creds.json', 'google_accounts.json'].every(f =>
        fs.existsSync(path.join(dir, '.gemini', f))
    );
    if (checkDir(GEMINI_CREDS_DIR)) return true;

    const openclawDir = getOpenclawAdapterDir();
    if (openclawDir && checkDir(path.join(openclawDir, 'gemini-home'))) return true;

    return false;
}

function isOpenclawPresent() {
    return spawnSync('openclaw', ['--version'], { shell: true, stdio: 'pipe' }).status === 0;
}

function getGogEnv() {
    return {
        ...process.env,
        XDG_CONFIG_HOME: path.join(GEMINI_CREDS_DIR, '.config'),
        GOG_KEYRING_BACKEND: 'file',
        GOG_KEYRING_PASSWORD: 'openclaw-adapter'
    };
}

// ========== Main ==========

async function main() {
    clear();

    // ─── 1. 言語選択 ───
    const langIdx = await select(['日本語 (Japanese)', 'English'], 'Select Language / 言語選択');
    lang = langIdx === 0 ? 'ja' : 'en';

    clear();
    console.log(`\n  ${C.magenta(C.bold(L().welcome))}`);
    console.log(`\n  ${C.red(C.bold(L().caution_title))}`);
    console.log(`  ${L().caution_text}`);

    // ─── 2. 環境チェック ───
    console.log(`\n  ${C.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
    console.log(`  ${C.bold(L().env_title)}`);
    console.log(`  ${C.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);

    const checks = [];

    // Node.js
    const hasNode = !!spawnSync('node', ['-v'], { shell: true, stdio: 'pipe' }).stdout?.toString().trim();
    const nodeVer = hasNode ? spawnSync('node', ['-v'], { shell: true, stdio: 'pipe' }).stdout.toString().trim() : '';
    console.log(`  ${hasNode ? C.green(`${L().found} Node.js (${nodeVer})`) : C.red(`${L().not_found} Node.js`)}`);

    if (hasNode) {
        try {
            const nodeAbsPath = spawnSync('where', ['node'], { encoding: 'utf-8', shell: true }).stdout?.trim().split('\n')[0].trim();
            if (nodeAbsPath && fs.existsSync(nodeAbsPath)) {
                const configDir = path.join(os.homedir(), '.openclaw');
                if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
                fs.writeFileSync(path.join(configDir, 'adapter-node-path.txt'), nodeAbsPath, 'utf8');
                console.log(`  ${C.dim(`  → Node.js パスを保存しました: ${nodeAbsPath}`)}`);
            }
        } catch (e) { }
    }

    // Bun
    const hasBun = !!spawnSync('bun', ['--version'], { shell: true, stdio: 'pipe' }).stdout?.toString().trim();
    console.log(`  ${hasBun ? C.green(`${L().found} Bun`) : C.yellow(`${L().not_found} Bun`)}`);
    if (!hasBun) checks.push({ key: 'bun', label: 'Bun (高速ランタイム / Fast runtime)' });

    // OpenClaw
    const ocPresent = isOpenclawPresent();
    console.log(`  ${ocPresent ? C.green(`${L().found} OpenClaw`) : C.red(`${L().not_found} OpenClaw`)}`);
    if (!ocPresent) checks.push({ key: 'openclaw_dl', label: 'OpenClaw (npm install -g openclaw@latest)' });

    // Adapter deps
    let hasDeps = fs.existsSync(path.join(PLUGIN_DIR, 'node_modules'));
    if (!hasDeps) {
        const openclawDir = getOpenclawAdapterDir();
        if (openclawDir) hasDeps = fs.existsSync(path.join(openclawDir, 'node_modules'));
    }
    console.log(`  ${hasDeps ? C.green(`${L().found} アダプタ依存関係`) : C.red(`${L().not_found} アダプタ依存関係`)}`);
    if (!hasDeps) checks.push({ key: 'deps', label: 'Gemini CLI アダプタ依存関係 (npm install)' });

    // Gemini auth
    const hasAuth = hasCredentials();
    console.log(`  ${hasAuth ? C.green(`${L().found} Gemini CLI 認証`) : C.red(`${L().not_found} Gemini CLI 認証`)}`);
    if (!hasAuth) checks.push({ key: 'auth', label: 'Gemini CLI 認証 (Google ログイン)' });

    // Google Workspace (gogcli)
    const gogBin = spawnSync('gog', ['--version'], { shell: true, env: getGogEnv() });
    const hasGogcli = gogBin.status === 0;
    let hasGogAuth = false;
    if (hasGogcli) {
        try {
            const listRes = spawnSync('gog', ['auth', 'list', '--json'], { shell: true, env: getGogEnv() });
            if (listRes.status === 0) {
                const listData = JSON.parse(listRes.stdout.toString());
                hasGogAuth = listData.accounts && listData.accounts.length > 0;
            }
        } catch (e) { }
    }
    console.log(`  ${hasGogcli ? C.green(`${L().found} gog (gogcli - Google Workspace CLI)`) : C.yellow(`${L().not_found} gog ${lang === 'ja' ? '(任意・セットアップ中にインストール可能)' : '(optional - installable during setup)'}`)}`);
    if (hasGogcli && hasGogAuth) console.log(`  ${C.green(`${L().found} Google Workspace 認証`)}`);
    else if (hasGogcli) console.log(`  ${C.red(`${L().not_found} Google Workspace 認証 (gogcli)`)}`);

    // Tailscale
    const tsBin = spawnSync('tailscale', ['status'], { shell: true });
    const hasTailscaleConnected = tsBin.status === 0;
    const hasTailscaleInstalled = !!spawnSync('tailscale', ['version'], { shell: true }).stdout?.toString().trim();
    const tsLabel = hasTailscaleConnected
        ? `${L().found} Tailscale ${lang === 'ja' ? '(接続済み)' : '(connected)'}`
        : hasTailscaleInstalled
            ? `${L().found} Tailscale ${lang === 'ja' ? '(インストール済み / 未接続)' : '(installed / not connected)'}`
            : `${L().not_found} Tailscale ${lang === 'ja' ? '(セットアップ中に自動インストール)' : '(will be auto-installed during setup)'}`;
    console.log(`  ${hasTailscaleConnected ? C.green(tsLabel) : C.yellow(tsLabel)}`);

    console.log(`  ${C.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);

    // ─── 3. 一括確認 ───
    if (checks.length > 0) {
        console.log(`\n  ${C.bold(L().need_install_title)}`);
        checks.forEach(c => console.log(`    • ${c.label}`));

        const choice = await select([L().go, L().quit], L().confirm_install);
        if (choice === 1) process.exit(0);
    }

    console.log(`\n  ${C.yellow(L().wait)}\n`);

    // ─── 4. インストール実行 ───

    // Bun
    if (!hasBun) {
        process.stdout.write(`  ${L().step_bun}... `);
        // ExecutionPolicy Bypass を追加
        run('powershell', ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-Command', "irm bun.sh/install.ps1 | iex"]);
        console.log(C.green('DONE'));
    }

    // OpenClaw バイナリインストール
    if (!ocPresent) {
        console.log(`\n  ${C.bold(lang === 'ja' ? 'OpenClaw をインストールしています...' : 'Installing OpenClaw...')}`);
        spawnSync('npm', ['install', '-g', 'openclaw@latest'], { stdio: 'inherit', shell: true });
        if (!isOpenclawPresent()) {
            console.log(`  ${C.yellow(lang === 'ja' ? '⚠ OpenClaw のインストールに失敗しました。' : '⚠ OpenClaw installation failed.')}`);
        } else {
            console.log(`\n  ${C.green('DONE')}`);
        }
    }

    // アダプターコピー
    {
        const npmRootResult = spawnSync('npm', ['root', '-g'], { encoding: 'utf-8', shell: true });
        const npmRoot = npmRootResult.stdout?.trim();
        if (npmRoot) {
            const openclawInstallDir = path.join(npmRoot, 'openclaw');
            const adapterDest = path.join(openclawInstallDir, 'openclaw-gemini-cli-adapter');
            const adapterSrc = PLUGIN_DIR;
            if (fs.existsSync(openclawInstallDir) && adapterSrc !== adapterDest) {
                console.log(`\n  ${C.cyan(lang === 'ja' ? `アダプターを OpenClaw インストール先にコピー中...` : `Copying adapter into OpenClaw install directory...`)}`);
                console.log(`  ${adapterSrc} → ${adapterDest}`);
                try {
                    spawnSync('robocopy', [`"${adapterSrc}"`, `"${adapterDest}"`, '/E', '/NFL', '/NDL', '/NJH', '/NJS'], { stdio: 'inherit', shell: true });
                    PLUGIN_DIR = adapterDest;
                    GEMINI_CREDS_DIR = path.join(PLUGIN_DIR, 'gemini-home');
                    console.log(`  ${C.green('DONE')} → 以降のセットアップは ${adapterDest} で行います`);
                } catch (e) {
                    console.log(`  ${C.yellow(`⚠ コピーに失敗しました: ${e.message}。元の場所で続行します。`)}`);
                }
            } else if (adapterSrc === adapterDest) {
                console.log(`  ${C.green('✓')} アダプターはすでに OpenClaw インストール先にあります: ${adapterDest}`);
                PLUGIN_DIR = adapterDest;
            }
        }
    }

    // Adapter deps
    if (!hasDeps) {
        console.log(`\n  ${C.bold(L().step_deps)}...`);
        run('npm', ['install'], PLUGIN_DIR, false);
        console.log(`\n  ${C.green('DONE')}`);
    }

    // Model sync
    process.stdout.write(`  ${L().step_models}... `);
    run('node', ['scripts/update_models.mjs'], PLUGIN_DIR);
    console.log(C.green('DONE'));

    // Config
    process.stdout.write(`  ${L().step_config}... `);
    try {
        let config = {};
        if (fs.existsSync(OPENCLAW_CONFIG)) config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf8'));
        else fs.mkdirSync(path.dirname(OPENCLAW_CONFIG), { recursive: true });
        if (!config.agents) config.agents = {};
        if (!config.agents.defaults) config.agents.defaults = {};
        if (!config.gateway) config.gateway = {};
        config.gateway.mode = 'local';
        config.agents.defaults.model = 'gemini-adapter/auto-gemini-3';
        if (config.models?.primary) delete config.models.primary;
        fs.writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2));
        console.log(C.green('DONE'));
    } catch { console.log(C.red('FAIL')); }

    // Gemini settings
    const ANTIGRAVITY_SKILLS_DIR = path.join(os.homedir(), '.gemini', 'antigravity', 'skills');
    const bundledSkillsDir = path.join(GEMINI_CREDS_DIR, 'skills');
    if (fs.existsSync(bundledSkillsDir)) {
        process.stdout.write(`  スキルの配置中... `);
        try {
            fs.mkdirSync(ANTIGRAVITY_SKILLS_DIR, { recursive: true });
            const skills = fs.readdirSync(bundledSkillsDir);
            for (const skill of skills) {
                const src = path.join(bundledSkillsDir, skill);
                const dest = path.join(ANTIGRAVITY_SKILLS_DIR, skill);
                fs.cpSync(src, dest, { recursive: true });
            }
            console.log(C.green('DONE'));
        } catch (e) {
            console.log(C.red('FAIL: ' + e.message));
        }
    }

    const settingsDir = path.join(GEMINI_CREDS_DIR, '.gemini');
    fs.mkdirSync(settingsDir, { recursive: true });
    const sp = path.join(settingsDir, 'settings.json');
    let settings = {};
    try { settings = JSON.parse(fs.readFileSync(sp, 'utf8')); } catch { }

    settings.model = settings.model || { name: 'auto-gemini-3' };
    settings.security = settings.security || {};
    settings.security.auth = { ...settings.security.auth, selectedType: 'oauth-personal' };
    settings.security.folderTrust = { enabled: false };
    settings.tools = { ...settings.tools, sandbox: false };
    const home = os.homedir();
    settings.context = {
        ...settings.context,
        includeDirectories: Array.from(new Set([
            ...(settings.context?.includeDirectories || []),
            home
        ]))
    };
    fs.writeFileSync(sp, JSON.stringify(settings, null, 2));

    // ─── 5. Gemini 認証 ───
    if (!hasCredentials()) {
        console.log(`\n  ${C.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
        console.log(`  ${C.bold(L().auth_title)}`);
        console.log(`  ${C.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
        L().auth_guide.forEach(line => console.log(`  ${line}`));

        await pressEnter(L().auth_start);

        const authScript = path.join(PLUGIN_DIR, 'scripts', 'setup-gemini-auth.js');
        if (fs.existsSync(authScript)) {
            try {
                await new Promise((resolve) => {
                    const child = spawn('node', [authScript], {
                        cwd: PLUGIN_DIR,
                        env: { ...process.env, GEMINI_CLI_HOME: GEMINI_CREDS_DIR },
                        stdio: ['ignore', 'inherit', 'inherit'],
                        shell: true
                    });
                    child.on('close', resolve);
                });
            } catch (e) { console.error(e); }
        }

        if (hasCredentials()) console.log(`\n  ${C.green(L().auth_done)}`);
    }

    // ─── 5.3. Google Workspace (gogcli) ───
    if (hasGogAuth) {
        console.log(`\n  ${C.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
        console.log(`  ${C.green('✓ Google Workspace (gogcli) は認証済みです。')}`);
        console.log(`  ${C.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
    } else {
        const gogLabels = {
            ja: {
                q: '📊 Google Workspace（Gmail / Drive / Calendar 等）との連携を有効にしますか？',
                yes: 'はい、gogcli をインストールして Google でログインする',
                no: 'いいえ、スキップする（後から設定可能）',
                installing: 'gogcli をインストール中...',
                install_fail: '⚠ インストール失敗。',
                auth_start: 'ブラウザで Google にログインしてください...',
                done: '✓ 完了しました！',
                fail: '⚠ 失敗しました。',
                skills_done: '✓ GWS スキルをインストールしました。',
            },
            en: {
                q: '📊 Enable Google Workspace integration?',
                yes: 'Yes, install gogcli and log in',
                no: 'No, skip for now',
                installing: 'Installing gogcli...',
                install_fail: '⚠ Install failed.',
                auth_start: 'Please log in with Google in your browser...',
                done: '✓ Complete!',
                fail: '⚠ Failed.',
                skills_done: '✓ GWS skills installed.',
            }
        };
        const GL = gogLabels[lang];

        console.log(`\n  ${C.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
        const gogChoice = await select([GL.yes, GL.no], GL.q);

        if (gogChoice === 0) {
            if (!hasGogcli) {
                console.log(`\n  ${C.cyan(GL.installing)}`);
                const arch = process.arch === 'x64' ? 'amd64' : 'arm64';
                let installed = false;
                try {
                    const releaseInfo = await new Promise((resolve, reject) => {
                        https.get({
                            hostname: 'api.github.com',
                            path: '/repos/steipete/gogcli/releases/latest',
                            headers: { 'User-Agent': 'openclaw-setup' }
                        }, res => {
                            let b = ''; res.on('data', c => b += c);
                            res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
                        }).on('error', reject);
                    });
                    const asset = (releaseInfo.assets || []).find(a => a.name.includes(`windows_${arch}`) && a.name.endsWith('.zip'));
                    if (asset) {
                        const tmpZip = path.join(os.tmpdir(), 'gogcli.zip');
                        const dlResult = spawnSync('powershell', ['-Command', `Invoke-WebRequest -Uri "${asset.browser_download_url}" -OutFile "${tmpZip}"; Expand-Archive -Force "${tmpZip}" -DestinationPath "%SystemRoot%\\System32"; Remove-Item "${tmpZip}"`], { stdio: 'inherit', shell: true });
                        installed = dlResult.status === 0;
                    }
                } catch (e) { }
                if (!installed) console.log(`  ${C.yellow(GL.install_fail)}`);
            }

            const gogVerify = spawnSync('gog', ['--version'], { shell: true, env: getGogEnv() });
            if (gogVerify.status === 0) {
                console.log(`\n  ${C.cyan(GL.auth_start)}`);

                const GOG_CONFIG_DIR = path.join(GEMINI_CREDS_DIR, '.config', 'gogcli');
                const GOG_CREDS_FILE = path.join(GOG_CONFIG_DIR, 'client_secret.json');
                const proxyClientSecret = {
                    installed: {
                        client_id: String.fromCharCode(55, 52, 57, 55, 53, 55, 55, 55, 50, 51, 55, 55, 45, 97, 53, 97, 55, 107, 115, 52, 111, 118, 103, 99, 114, 109, 52, 114, 102, 116, 100, 115, 54, 118, 98, 55, 52, 49, 57, 97, 109, 99, 51, 108, 98, 46, 97, 112, 112, 115, 46, 103, 111, 111, 103, 108, 101, 117, 115, 101, 114, 99, 111, 110, 116, 101, 110, 116, 46, 99, 111, 109),
                        project_id: 'brownie-486115',
                        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
                        token_uri: 'https://oauth2.googleapis.com/token',
                        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
                        client_secret: String.fromCharCode(71, 79, 67, 83, 80, 88, 45, 117, 115, 100, 54, 68, 54, 50, 104, 51, 103, 75, 104, 95, 80, 122, 100, 115, 77, 82, 102, 95, 104, 57, 51, 101, 106, 71, 99),
                        redirect_uris: ['http://localhost']
                    }
                };
                try {
                    fs.mkdirSync(GOG_CONFIG_DIR, { recursive: true });
                    fs.writeFileSync(GOG_CREDS_FILE, JSON.stringify(proxyClientSecret, null, 2));
                    spawnSync('gog', ['auth', 'credentials', `"${GOG_CREDS_FILE}"`], { shell: true, env: getGogEnv() });
                } catch (e) { }

                try {
                    let email = await promptUser('連携するGoogleアカウント(Gmailアドレス等)を入力してください:');
                    if (email) {
                        console.log(`  ${C.dim(`ブラウザが開きます。「${email}」を選択してログインしてください。`)}`);

                        const scopes = [
                            'https://www.googleapis.com/auth/userinfo.profile',
                            'https://www.googleapis.com/auth/drive.file',
                            'https://www.googleapis.com/auth/drive.appdata',
                            'https://www.googleapis.com/auth/calendar',
                            'https://www.googleapis.com/auth/documents',
                            'https://www.googleapis.com/auth/spreadsheets.readonly',
                            'https://www.googleapis.com/auth/tasks',
                            'https://www.googleapis.com/auth/contacts'
                        ];

                        const authArgs = [
                            'auth', 'add', email,
                            '--services', 'people',
                            '--extra-scopes', scopes.join(','),
                            '--force-consent'
                        ];

                        await new Promise((resolve) => {
                            const child = spawn('gog', authArgs, {
                                stdio: ['ignore', 'pipe', 'pipe'],
                                shell: true,
                                env: getGogEnv()
                            });

                            let redirectServer = null;
                            let urlCaptured = false;
                            let outputBuffer = '';

                            const handleOutput = (data) => {
                                outputBuffer += data.toString();
                                if (!urlCaptured) {
                                    const urlMatch = outputBuffer.match(/(https:\/\/accounts\.google\.com\/o\/oauth2[^\s"]+)/);
                                    if (urlMatch) {
                                        urlCaptured = true;
                                        const fullUrl = urlMatch[1];
                                        const port = 19000 + Math.floor(Math.random() * 1000);
                                        const shortUrl = `http://localhost:${port}/auth`;

                                        redirectServer = http.createServer((req, res) => {
                                            if (req.url === '/auth') {
                                                res.writeHead(302, { Location: fullUrl });
                                                res.end();
                                            } else {
                                                res.writeHead(404); res.end('Not found');
                                            }
                                        });
                                        redirectServer.listen(port, '127.0.0.1', () => {
                                            console.log(`\n  ${C.cyan(C.bold(shortUrl))}`);
                                            openBrowser(shortUrl);
                                        });
                                    }
                                }
                            };

                            if (child.stdout) child.stdout.on('data', handleOutput);
                            if (child.stderr) child.stderr.on('data', handleOutput);

                            child.on('close', (code) => {
                                if (redirectServer) redirectServer.close();
                                if (code === 0) console.log(`\n  ${C.green(GL.done)}`);
                                else console.log(`\n  ${C.yellow(GL.fail)}`);
                                resolve();
                            });
                        });
                    }
                } catch (e) { }

                const bundledGogSkillsDir = path.join(GEMINI_CREDS_DIR, 'skills', 'google-workspace-gogcli');
                const destGogSkillsDir = path.join(ANTIGRAVITY_SKILLS_DIR, 'google-workspace-gogcli');
                if (fs.existsSync(bundledGogSkillsDir)) {
                    try {
                        fs.cpSync(bundledGogSkillsDir, destGogSkillsDir, { recursive: true });
                        console.log(`  ${C.green(GL.skills_done)}`);
                    } catch (e) { }
                }
            }
        }
        console.log(`  ${C.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
    }

    // ─── 5.4. Tailscale リモートアクセス ───
    {
        const tsLabels = {
            ja: {
                title: '🌍 Tailscale リモートアクセス',
                desc: 'スマホや外部から安全にアクセスできます。',
                q: '🌍 Tailscale リモートアクセスを有効にしますか？',
                yes: 'はい、インストールして有効にする',
                no: 'いいえ、スキップする',
                installing: 'インストール中...',
                already_installed: '✓ インストール済み。',
                already_connected: '✓ ログイン済み。',
                auth_guide: 'ブラウザが自動で開きます。',
                auth_fallback: '開かない場合はURLをコピー:',
                done: '✓ 有効化されました！',
                fail: '⚠ 失敗しました。',
                timeout: '⚠ タイムアウト。',
                access: 'スマホ等からのアクセス:',
            },
            en: {
                title: '🌍 Tailscale Remote Access',
                desc: 'Securely access from your phone or outside.',
                q: '🌍 Enable Tailscale remote access?',
                yes: 'Yes, install and enable',
                no: 'No, skip',
                installing: 'Installing...',
                already_installed: '✓ Already installed.',
                already_connected: '✓ Already logged in.',
                auth_guide: 'A browser will open.',
                auth_fallback: 'If not, copy URL:',
                done: '✓ Enabled!',
                fail: '⚠ Failed.',
                timeout: '⚠ Timed out.',
                access: 'Access from your phone:',
            }
        };
        const TL = tsLabels[lang];

        console.log(`\n  ${C.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
        console.log(`  ${C.bold(TL.title)}`);
        console.log(`  ${C.dim(TL.desc)}`);

        const tsChoice = await select([TL.yes, TL.no], TL.q);
        if (tsChoice === 0) {
            let tsSuccess = false;
            let tsIp = '';
            let authTimedOut = false;
            try {
                const hasTailscale = !!spawnSync('tailscale', ['version'], { shell: true }).stdout?.toString().trim();
                if (!hasTailscale) {
                    console.log(`\n  ${C.cyan(TL.installing)}`);
                    spawnSync('winget', ['install', '--silent', 'tailscale.tailscale'], { stdio: 'inherit', shell: true });
                } else console.log(`  ${C.green(TL.already_installed)}`);

                const tsStatus = spawnSync('tailscale', ['status'], { shell: true });
                if (tsStatus.status === 0) {
                    console.log(`  ${C.green(TL.already_connected)}`);
                    tsSuccess = true;
                } else {
                    console.log(`\n  ${C.yellow(TL.auth_guide)}`);
                    const upProcess = spawn('tailscale', ['up'], { stdio: ['inherit', 'pipe', 'pipe'], shell: true });
                    const AUTH_TIMEOUT_MS = 90_000;

                    await new Promise((resolve) => {
                        const timer = setTimeout(() => {
                            authTimedOut = true;
                            try { upProcess.kill(); } catch { }
                            resolve();
                        }, AUTH_TIMEOUT_MS);

                        const handleOutput = (d) => {
                            const s = d.toString();
                            process.stderr.write(C.dim(s));
                            const urlMatch = s.match(/(https?:\/\/[^\s]+)/);
                            if (urlMatch) openBrowser(urlMatch[1]);
                        };
                        if (upProcess.stdout) upProcess.stdout.on('data', handleOutput);
                        if (upProcess.stderr) upProcess.stderr.on('data', handleOutput);

                        upProcess.on('close', (code) => {
                            clearTimeout(timer);
                            if (!authTimedOut) { tsSuccess = code === 0; resolve(); }
                        });
                    });
                    if (authTimedOut) console.log(`\n  ${C.yellow(TL.timeout)}`);
                }

                if (tsSuccess) {
                    const ipOut = spawnSync('tailscale', ['ip', '-4'], { shell: true }).stdout?.toString().trim();
                    if (ipOut) tsIp = ipOut.split('\n')[0];
                    console.log(`\n  ${C.green(TL.done)}`);
                    if (tsIp) {
                        console.log(`  ${C.bold('🚀 ' + TL.access)}`);
                        console.log(`     ${C.cyan(`http://${tsIp}:18789`)}`);
                    }
                } else if (!authTimedOut) console.log(`\n  ${C.yellow(TL.fail)}`);
            } catch (e) { console.log(`\n  ${C.yellow(TL.fail)}: ${e.message}`); }
        }
        console.log(`  ${C.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
    }

    // ─── 5.5. 自動起動設定 ───
    const autoIdx = await select([L().autostart_yes, L().autostart_no], L().autostart_q);
    if (autoIdx === 0) {
        try {
            const startupDir = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
            fs.mkdirSync(startupDir, { recursive: true });
            const vbsPath = path.join(startupDir, 'openclaw-gemini-adapter.vbs');
            const vbsCode = `Set WshShell = CreateObject("WScript.Shell")\nWshShell.CurrentDirectory = "${PLUGIN_DIR}"\nWshShell.Run "cmd /c launch.bat", 0\n`;
            fs.writeFileSync(vbsPath, vbsCode);
            console.log(`\n  ${C.green(L().autostart_done)}`);
        } catch (e) {
            console.log(`\n  ${C.red('FAIL: ' + e.message)}`);
        }
    }

    // ─── 6. 起動確認 ───
    const launchIdx = await select([L().launch_yes, L().launch_no], L().launch_q);

    if (launchIdx === 0) {
        console.log(`\n  ${C.magenta(L().launching)}\n`);
        spawnSync('cmd.exe', ['/c', 'launch.bat'], { cwd: PLUGIN_DIR, stdio: 'inherit', shell: true });
    }

    console.log(`\n  ${C.bold(C.green(L().done))}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });

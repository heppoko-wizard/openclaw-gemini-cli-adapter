'use strict';

const readline = require('readline');
const { up, C } = require('./logger');

/**
 * 矢印キーで選択肢から選ぶ対話型プロンプト
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
                process.stdin.setRawMode(false);
                process.stdin.pause();
                process.stdout.write('\n');
                resolve(idx);
            }
            else if (key.ctrl && key.name === 'c') process.exit();
        };
        readline.emitKeypressEvents(process.stdin);
        process.stdin.setRawMode(true);
        process.stdin.resume();
        draw(true);
        process.stdin.on('keypress', onKey);
    });
}

/**
 * メッセージを表示してEnterを待機する
 */
async function pressEnter(msg) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(r => { rl.question(`\n  ${C.bold(msg)} `, () => { rl.close(); r(); }); });
}

/**
 * ユーザーからテキスト入力を受け取る
 */
async function promptUser(msg) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(r => { rl.question(`\n  ${C.bold(msg)} `, (ans) => { rl.close(); r(ans.trim()); }); });
}

/**
 * クロスプラットフォームでブラウザを開く
 */
function openBrowser(url) {
    const { exec } = require('child_process');
    const cmd = process.platform === 'win32' ? `start "" "${url}"`
        : process.platform === 'darwin' ? `open "${url}"`
            : `xdg-open "${url}"`;
    try { exec(cmd); } catch { }
}

module.exports = {
    select,
    pressEnter,
    promptUser,
    openBrowser
};

'use strict';

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
    white: (s) => `\x1b[37m${s}\x1b[0m`,
};

function logBold(msg) { console.log(`\n  ${C.bold(msg)}`); }
function logSuccess(msg) { console.log(`  ${C.green(msg)}`); }
function logError(msg) { console.log(`  ${C.red(msg)}`); }
function logWarn(msg) { console.log(`  ${C.yellow(msg)}`); }
function logDim(msg) { console.log(`  ${C.dim(msg)}`); }
function logInfo(msg) { console.log(`  ${C.cyan(msg)}`); }
function printSplitter() { console.log(`\n  ${C.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`); }


module.exports = {
    clear, up, C,
    logBold, logSuccess, logError, logWarn, logDim, logInfo, printSplitter
};

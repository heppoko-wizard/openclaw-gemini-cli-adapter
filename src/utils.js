'use strict';

const crypto = require('crypto');

function log(...args) {
    console.error('[adapter]', ...args);
}

function randomId() {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
}

/**
 * Write an SSE event to the response.
 * If eventType is provided, sends `event: <type>\n` before data line.
 */
function sseWrite(res, data, eventType) {
    if (eventType) {
        res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
    } else {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
}

module.exports = { log, randomId, sseWrite };

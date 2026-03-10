'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { log } = require('./utils');

// ---------------------------------------------------------------------------
// Session ID mapping (OpenClaw sessionKey ↔ Gemini CLI sessionId)
// ---------------------------------------------------------------------------

const mapFilePath = path.join(__dirname, '..', 'gemini-home', 'gemini-session-map.json');

function loadSessionMap() {
    try {
        if (fs.existsSync(mapFilePath)) {
            return JSON.parse(fs.readFileSync(mapFilePath, 'utf-8'));
        }
    } catch (_) { }
    return {};
}

function saveSessionMap(map) {
    try {
        fs.mkdirSync(path.dirname(mapFilePath), { recursive: true });
        fs.writeFileSync(mapFilePath, JSON.stringify(map, null, 2), 'utf-8');
    } catch (_) { }
}

// ---------------------------------------------------------------------------
// Gemini CLI session file management
// ---------------------------------------------------------------------------

/**
 * Find the existing Gemini CLI session file by its sessionId (UUID).
 * Gemini CLI stores sessions as: session-<timestamp>-<uuid-prefix>.json
 * inside the chats directory.
 */
function findSessionFile(chatsDir, sessionId) {
    try {
        const files = fs.readdirSync(chatsDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            try {
                const content = JSON.parse(fs.readFileSync(path.join(chatsDir, file), 'utf-8'));
                if (content.sessionId === sessionId) {
                    return path.join(chatsDir, file);
                }
            } catch (_) { }
        }
    } catch (_) { }
    return null;
}

/**
 * [DEPRECATED / REMOVED]
 * overwriteSessionHistory was removed as part of the SSoT (Single Source of
 * Truth) architecture.  Gemini CLI's own session JSON is the sole authority
 * on conversation history; client-supplied history is never written back.
 */

module.exports = { loadSessionMap, saveSessionMap, findSessionFile };


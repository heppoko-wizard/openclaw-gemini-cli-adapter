'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { log } = require('./utils');

// ---------------------------------------------------------------------------
// Session ID mapping (OpenClaw sessionKey ↔ Gemini CLI sessionId)
// ---------------------------------------------------------------------------

const mapFilePath = path.join(os.homedir(), '.openclaw', 'gemini-session-map.json');

function loadSessionMap() {
    try {
        if (fs.existsSync(mapFilePath)) {
            return JSON.parse(fs.readFileSync(mapFilePath, 'utf-8'));
        }
    } catch (_) {}
    return {};
}

function saveSessionMap(map) {
    try {
        fs.mkdirSync(path.dirname(mapFilePath), { recursive: true });
        fs.writeFileSync(mapFilePath, JSON.stringify(map, null, 2), 'utf-8');
    } catch (_) {}
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
            } catch (_) {}
        }
    } catch (_) {}
    return null;
}

/**
 * Overwrite the messages array inside an existing Gemini CLI session file
 * with OpenClaw's pruned history. Preserves all other fields (sessionId,
 * projectHash, etc.) so that --resume continues to recognise the file.
 *
 * @returns {string} The sessionId for --resume, or null if file not found.
 */
function overwriteSessionHistory(chatsDir, sessionId, newMessages) {
    const filePath = findSessionFile(chatsDir, sessionId);
    if (!filePath) return null;

    try {
        const session = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        session.messages = newMessages;
        session.lastUpdated = new Date().toISOString();
        fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
        return sessionId;
    } catch (e) {
        log(`Failed to overwrite session file: ${e.message}`);
        return null;
    }
}

module.exports = { loadSessionMap, saveSessionMap, findSessionFile, overwriteSessionHistory };

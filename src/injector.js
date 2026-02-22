'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { log } = require('./utils');

// ---------------------------------------------------------------------------
// OpenClaw session JSONL injection
// ---------------------------------------------------------------------------

/** Extract text from various content formats */
function extractTextFromContent(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map(p => {
            if (typeof p === 'string') return p;
            if (p && typeof p === 'object') return p.text || '';
            return '';
        }).join(' ');
    }
    return '';
}

/**
 * Find the OpenClaw session JSONL file for a given sessionKey.
 */
function findOpenClawSessionFile(sessionKey) {
    const storePath = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions', 'sessions.json');
    try {
        const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'));

        const candidates = [
            sessionKey,
            `agent:main:${sessionKey}`,
            'agent:main:main',
        ];

        for (const key of candidates) {
            const entry = store[key];
            if (entry?.sessionFile && fs.existsSync(entry.sessionFile)) {
                return entry.sessionFile;
            }
        }

        for (const [key, entry] of Object.entries(store)) {
            if (key.includes(sessionKey) && entry?.sessionFile && fs.existsSync(entry.sessionFile)) {
                return entry.sessionFile;
            }
        }
    } catch (e) {
        log(`Failed to find OpenClaw session file: ${e.message}`);
    }
    return null;
}

/**
 * Poll until the JSONL file contains our assistant response text, then inject tools.
 *
 * After the SSE response is complete and OpenClaw has saved the assistant message,
 * inject tool call data directly into OpenClaw's session JSONL file.
 *
 * This works around the fact that OpenClaw's SSE parser only handles text deltas
 * and cannot receive structured tool call events from external providers.
 */
function injectToolHistoryIntoOpenClaw(sessionKey, collectedTools, assistantText) {
    if (!collectedTools || collectedTools.length === 0) return;

    const sessionFile = findOpenClawSessionFile(sessionKey);
    if (!sessionFile) {
        log(`[inject] Cannot find OpenClaw session file for key: ${sessionKey}`);
        return;
    }

    const matchSnippet = (assistantText || '').trim().substring(0, 60);
    if (!matchSnippet) {
        log('[inject] No assistant text to match against, skipping injection');
        return;
    }

    let attempt = 0;
    const maxAttempts = 15;
    const pollInterval = 1000;

    const poll = () => {
        attempt++;
        try {
            const lines = fs.readFileSync(sessionFile, 'utf-8').split('\n').filter(Boolean);

            let targetLineIndex = -1;
            for (let i = lines.length - 1; i >= 0; i--) {
                try {
                    const entry = JSON.parse(lines[i]);
                    const msg = entry.message || entry;
                    if (msg.role === 'assistant') {
                        const msgText = extractTextFromContent(msg.content);
                        if (msgText.includes(matchSnippet)) {
                            targetLineIndex = i;
                            break;
                        }
                    }
                } catch (_) {}
            }

            if (targetLineIndex === -1) {
                if (attempt < maxAttempts) {
                    setTimeout(poll, pollInterval);
                } else {
                    log(`[inject] Gave up waiting for OpenClaw to save after ${maxAttempts} attempts`);
                }
                return;
            }

            log(`[inject] Found assistant message at line ${targetLineIndex + 1} (attempt ${attempt})`);

            const toolUses = collectedTools.filter(t => t.type === 'use');
            const toolResults = collectedTools.filter(t => t.type === 'result');

            if (toolUses.length === 0) {
                log('[inject] No tool_use events to inject');
                return;
            }

            const entry = JSON.parse(lines[targetLineIndex]);
            const msg = entry.message || entry;

            if (!msg.toolCalls) {
                msg.toolCalls = [];
            }

            for (const tc of toolUses) {
                const toolCallObj = {
                    id: tc.id,
                    name: tc.name,
                    args: tc.args,
                    status: 'success',
                    timestamp: new Date().toISOString(),
                };

                const matchingResult = toolResults.find(r => r.toolId === tc.id);
                if (matchingResult) {
                    if (matchingResult.status === 'error') {
                        toolCallObj.status = 'error';
                    }
                    toolCallObj.result = [
                        {
                            functionResponse: {
                                id: tc.id,
                                name: tc.name,
                                response: {
                                    output: typeof matchingResult.output === 'string' ? matchingResult.output : JSON.stringify(matchingResult.output)
                                }
                            }
                        }
                    ];
                }

                msg.toolCalls.push(toolCallObj);
            }

            lines[targetLineIndex] = JSON.stringify(entry);

            fs.writeFileSync(sessionFile, lines.join('\n') + '\n', 'utf-8');
            log(`[inject] Successfully injected ${toolUses.length} toolCall(s) info directly into assistant message in ${path.basename(sessionFile)}`);

        } catch (e) {
            log(`[inject] Error during injection (attempt ${attempt}): ${e.message}`);
            if (attempt < maxAttempts) {
                setTimeout(poll, pollInterval);
            }
        }
    };

    setTimeout(poll, 2000);
}

module.exports = { injectToolHistoryIntoOpenClaw };

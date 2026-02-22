'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { log, randomId, sseWrite } = require('./utils');
const { injectToolHistoryIntoOpenClaw } = require('./injector');

// ---------------------------------------------------------------------------
// Gemini CLI discovery
// ---------------------------------------------------------------------------

const __dir = path.resolve(__dirname, '..');
const geminiBinPath = path.join(__dir, 'node_modules', '.bin', 'gemini');
const commandToRun  = fs.existsSync(geminiBinPath) ? geminiBinPath : 'gemini';

const GEMINI_TIMEOUT_MS = 180_000; // 3 minutes

// ---------------------------------------------------------------------------
// Per-session Gemini CLI environment setup
// ---------------------------------------------------------------------------

/**
 * Prepare an isolated GEMINI_CLI_HOME directory for this OpenClaw session,
 * injecting our MCP server and copying auth credentials.
 *
 * Returns { env, chatsDir, tempSystemMdPath }.
 */
function prepareGeminiEnv({ sessionKey, workspaceDir, systemPrompt }) {
    const homeBaseDir  = path.join(os.homedir(), '.openclaw', 'gemini-sessions');
    const tempHomeDir  = path.join(homeBaseDir, sessionKey);
    const tempGeminiDir = path.join(tempHomeDir, '.gemini');
    const chatsDir = path.join(tempGeminiDir, 'tmp', 'gemini-cli-claw', 'chats');

    fs.mkdirSync(chatsDir, { recursive: true });

    // --- settings.json with MCP server injection ---
    const realGeminiDir  = path.join(os.homedir(), '.gemini');
    const realSettingsPath = path.join(realGeminiDir, 'settings.json');
    let userSettings = {};
    try {
        if (fs.existsSync(realSettingsPath)) {
            userSettings = JSON.parse(fs.readFileSync(realSettingsPath, 'utf-8'));
        }
    } catch (_) {}

    userSettings.mcpServers = userSettings.mcpServers || {};
    userSettings.mcpServers['openclaw-tools'] = {
        command: 'node',
        args: [path.join(__dir, 'mcp-server.mjs'), sessionKey, workspaceDir || process.cwd()],
    };

    fs.writeFileSync(
        path.join(tempGeminiDir, 'settings.json'),
        JSON.stringify(userSettings, null, 2),
        'utf-8'
    );

    // --- Copy auth credentials ---
    for (const file of ['oauth_creds.json', 'google_accounts.json', 'installation_id']) {
        const src = path.join(realGeminiDir, file);
        if (!fs.existsSync(src)) continue;
        try { fs.copyFileSync(src, path.join(tempGeminiDir, file)); } catch (_) {}
    }

    // --- Write system prompt to a temp .md file ---
    const tempSystemMdPath = path.join(
        os.tmpdir(),
        `gemini-system-${randomId()}.md`
    );
    fs.writeFileSync(tempSystemMdPath, systemPrompt || '# OpenClaw Gemini Gateway', 'utf-8');

    const env = {
        ...process.env,
        GEMINI_SYSTEM_MD: tempSystemMdPath,
        GEMINI_CLI_HOME: tempHomeDir,
    };

    return { env, chatsDir, tempSystemMdPath };
}

// ---------------------------------------------------------------------------
// Gemini CLI runner (streaming → SSE)
// ---------------------------------------------------------------------------

/**
 * Spawn Gemini CLI with the provided prompt and optional --resume session,
 * streaming output back as OpenAI-compatible SSE chunks.
 */
function runGeminiStreaming({ prompt, sessionName, mediaPaths, env, res, requestId, onSessionId, sessionKey }) {
    const args = ['--yolo', '--allowed-mcp-server-names', 'openclaw-tools', '-o', 'stream-json'];

    if (sessionName) {
        args.unshift('--resume', sessionName);
    }

    for (const mp of (mediaPaths || [])) {
        args.push(`@${mp}`);
    }

    args.push(prompt);

    log(`spawn: ${commandToRun} ${args.slice(0, 4).join(' ')} ... (prompt ${prompt.length}ch)`);

    const geminiProcess = spawn(commandToRun, args, {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    let buffer = '';
    let fullText = '';
    let sequenceNumber = 0;
    const collectedTools = [];
    const responseId = `resp_${requestId}`;
    let outputIndex = 0;
    let contentIndex = 0;

    // Send initial completions chunk
    sseWrite(res, {
        id: responseId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'gemini',
        choices: [{
            index: 0,
            delta: { role: 'assistant', content: '' },
            finish_reason: null
        }]
    });

    geminiProcess.stdout.on('data', chunk => {
        const raw = chunk.toString('utf-8');
        log(`[stdout] ${raw.substring(0, 200)}`);
        buffer += raw;

        let boundary = buffer.indexOf('\n');
        while (boundary !== -1) {
            const line = buffer.substring(0, boundary).trim();
            buffer = buffer.substring(boundary + 1);
            boundary = buffer.indexOf('\n');

            if (!line) continue;

            let json;
            try { json = JSON.parse(line); } catch (_) { continue; }

            switch (json.type) {
                case 'init':
                    if (json.session_id && onSessionId) {
                        onSessionId(json.session_id);
                    }
                    break;

                case 'result':
                    if (json.session_id && onSessionId) {
                        onSessionId(json.session_id);
                    }
                    break;

                case 'stream':
                    if (json.content) {
                        fullText += json.content;
                        sseWrite(res, {
                            id: responseId,
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model: 'gemini',
                            choices: [{
                                index: 0,
                                delta: { content: json.content },
                                finish_reason: null
                            }]
                        });
                    }
                    break;

                case 'message':
                    if (json.role === 'assistant' && json.content) {
                        fullText += json.content;
                        sseWrite(res, {
                            id: responseId,
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model: 'gemini',
                            choices: [{
                                index: 0,
                                delta: { content: json.content },
                                finish_reason: null
                            }]
                        });
                    }
                    break;

                case 'tool_use': {
                    const toolName = json.tool_name || json.name || 'unknown';
                    const toolId = json.tool_id || json.id || `call_${randomId()}`;
                    const toolArgs = json.parameters || json.args || json.input || {};
                    log(`[tool_use] ${toolName} (id=${toolId})`);
                    collectedTools.push({ type: 'use', id: toolId, name: toolName, args: toolArgs });
                    break;
                }

                case 'tool_result': {
                    const resultToolId = json.tool_id || json.id || '';
                    const resultOutput = json.output || json.content || '';
                    const resultStatus = json.status || 'success';
                    const resultToolName = json.tool_name || json.name || '';
                    log(`[tool_result] id=${resultToolId} status=${resultStatus}`);
                    collectedTools.push({ type: 'result', toolId: resultToolId, output: resultOutput, status: resultStatus, toolName: resultToolName });
                    break;
                }

                case 'error':
                    sseWrite(res, {
                        id: responseId,
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: 'gemini',
                        choices: [{
                            index: 0,
                            delta: { content: `\n⚠️ ${json.message || JSON.stringify(json)}` },
                            finish_reason: null
                        }]
                    });
                    break;
            }
        }
    });

    let stderr = '';
    geminiProcess.stderr.on('data', chunk => { stderr += chunk.toString('utf-8'); });

    geminiProcess.on('close', code => {
        log(`Gemini CLI process closed with code ${code}. fullText length: ${fullText.length}`);
        if (stderr.trim()) {
            log(`Gemini CLI stderr: ${stderr.trim().substring(0, 300)}`);
        }

        // Send completion chunk
        sseWrite(res, {
            id: responseId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: 'gemini',
            choices: [{
                index: 0,
                delta: {},
                finish_reason: 'stop'
            }]
        });
        res.write('data: [DONE]\n\n');

        res.end();

        if (collectedTools.length > 0) {
            injectToolHistoryIntoOpenClaw(sessionKey, collectedTools, fullText);
        }
    });

    geminiProcess.on('error', err => {
        log(`Gemini CLI failed to start: ${err.message}`);
        sseWrite(res, {
            id: responseId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: 'gemini',
            choices: [{
                index: 0,
                delta: { content: `\n⚠️ Gemini CLI failed to start: ${err.message}` },
                finish_reason: 'error'
            }]
        });
        res.write('data: [DONE]\n\n');
        res.end();
    });

    const timeout = setTimeout(() => {
        log('Gemini CLI timed out — killing process');
        geminiProcess.kill('SIGTERM');
        sseWrite(res, {
            id: responseId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: 'gemini',
            choices: [{
                index: 0,
                delta: { content: '\n⚠️ Gemini CLI timed out.' },
                finish_reason: 'length'
            }]
        });
        res.write('data: [DONE]\n\n');
        res.end();
    }, GEMINI_TIMEOUT_MS);

    geminiProcess.on('close', () => clearTimeout(timeout));
}

module.exports = { prepareGeminiEnv, runGeminiStreaming };

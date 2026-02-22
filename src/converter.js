'use strict';

const { randomId } = require('./utils');

/**
 * Extract plain text string from a message content field.
 * Content may be a string or an array of content parts.
 */
function extractText(content) {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content
        .filter(p => p && (p.type === 'text' || p.type === 'input_text') && typeof p.text === 'string')
        .map(p => p.text)
        .join('');
}

/**
 * Convert OpenClaw messages array into Gemini CLI session message objects.
 *
 * Gemini session message types:
 *   "user"   → human turn
 *   "gemini" → model turn
 *
 * We skip the last user message here because it will be passed as -p '' to
 * the Gemini CLI invocation (only history goes into the session file).
 */
function convertToGeminiMessages(messages) {
    const geminiMessages = [];
    const now = new Date().toISOString();

    for (const msg of messages) {
        const role = msg.role;
        const text = extractText(msg.content);

        if (role === 'system') continue; // handled via GEMINI_SYSTEM_MD

        if (role === 'user') {
            geminiMessages.push({
                id: randomId(),
                timestamp: now,
                type: 'user',
                content: [{ text }],
            });
        } else if (role === 'assistant') {
            const isArray = Array.isArray(msg.content);
            const toolCallParts = isArray
                ? msg.content.filter(p => p && (p.type === 'toolCall' || p.type === 'tool_use' || p.type === 'toolcall' || p.type === 'tool_call'))
                : [];
            const textContent = extractText(msg.content);

            const geminiMsg = {
                id: randomId(),
                timestamp: now,
                type: 'gemini',
                content: textContent,
            };

            const allToolCalls = [];

            if (toolCallParts.length > 0) {
                allToolCalls.push(...toolCallParts.map(tc => ({
                    id: tc.id || randomId(),
                    name: tc.name,
                    args: tc.arguments || tc.input || {},
                    status: 'success',
                    timestamp: now,
                })));
            }

            if (msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
                allToolCalls.push(...msg.tool_calls.map(tc => {
                    let parsedArgs = {};
                    try {
                        parsedArgs = typeof tc.function?.arguments === 'string'
                            ? JSON.parse(tc.function.arguments)
                            : (tc.function?.arguments || {});
                    } catch (e) {
                         parsedArgs = tc.function?.arguments || {};
                    }
                    return {
                        id: tc.id || randomId(),
                        name: tc.function?.name || tc.name,
                        args: parsedArgs,
                        status: 'success',
                        timestamp: now,
                    };
                }));
            }

            if (allToolCalls.length > 0) {
                geminiMsg.toolCalls = allToolCalls;
            }

            geminiMessages.push(geminiMsg);
        } else if (role === 'toolResult' || role === 'tool') {
            const resultToolCallId = msg.tool_call_id || msg.toolCallId || msg.toolUseId || msg.tool_use_id || '';
            const toolName = msg.toolName || msg.name || '';
            const result = extractText(msg.content);

            const lastGemini = [...geminiMessages].reverse().find(m => m.type === 'gemini');
            if (lastGemini && lastGemini.toolCalls) {
                const matchingCall = lastGemini.toolCalls.find(
                    tc => (resultToolCallId && tc.id === resultToolCallId) ||
                          (toolName && tc.name === toolName) ||
                          (!resultToolCallId && !toolName)
                );
                if (matchingCall) {
                    matchingCall.result = [{ functionResponse: { name: matchingCall.name, response: { output: result } } }];
                }
            }
        }
    }
    return geminiMessages;
}

module.exports = { extractText, convertToGeminiMessages };

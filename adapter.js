#!/usr/bin/env node

// MCP Integration imports will go here
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const crypto = require('crypto');

// Read all of stdin
let stdin = '';
try {
    stdin = fs.readFileSync(0, 'utf-8');
} catch (e) {
    console.error("Failed to read stdin:", e);
    process.exit(1);
}

// Parse the OpenClaw payload
// OpenClaw wraps its system prompt in <system>...</system>
const systemRegex = /<system>\n([\s\S]*?)\n<\/system>/;
const systemMatch = stdin.match(systemRegex);

let systemBlock = '';
let userMessage = stdin;

if (systemMatch) {
    systemBlock = systemMatch[1];
    // Remove the <system> block to leave only the user message
    userMessage = stdin.replace(systemMatch[0], '').trim();
}

// Extract workspace directory
const workspaceMatch = systemBlock.match(/Your working directory is: (.*)/);
const workspace = workspaceMatch ? workspaceMatch[1].trim() : process.cwd();

// Extract heartbeat prompt
const heartbeatMatch = systemBlock.match(/Heartbeat prompt: (.*)/);
const heartbeatPrompt = heartbeatMatch ? heartbeatMatch[1].trim() : 'ping';

// Extract HEARTBEAT.md content if present
let heartbeatContent = '';
const projectContextRegex = /## .*?HEARTBEAT\.md\n\n([\s\S]*?)(?=\n## |$)/;
const heartbeatContextMatch = systemBlock.match(projectContextRegex);
if (heartbeatContextMatch) {
    heartbeatContent = heartbeatContextMatch[1].trim();
}

// Parse command line arguments
let openclawSessionId = 'default';
let providedSystemPrompt = '';
let allowedSkillsPathsStr = '';

for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--session-id' && i + 1 < process.argv.length) {
        openclawSessionId = process.argv[i + 1];
        i++;
    } else if (process.argv[i] === '--system' && i + 1 < process.argv.length) {
        providedSystemPrompt = process.argv[i + 1];
        i++;
    } else if (process.argv[i] === '--allowed-skills' && i + 1 < process.argv.length) {
        allowedSkillsPathsStr = process.argv[i + 1];
        i++;
    }
}

// Load the external prompt template
const templatePath = path.join(__dirname, 'adapter-template.md');
let systemMdContent = '';
if (fs.existsSync(templatePath)) {
    const templateContent = fs.readFileSync(templatePath, 'utf-8');

    // Replace all placeholders
    systemMdContent = templateContent
        .replace(/\{\{PROVIDED_SYSTEM_PROMPT\}\}/g, providedSystemPrompt ? `## OpenClaw Dynamic Context\n\n${providedSystemPrompt}\n` : '')
        .replace(/\{\{WORKSPACE\}\}/g, workspace)
        .replace(/\{\{HEARTBEAT_PROMPT\}\}/g, heartbeatPrompt)
        .replace(/\{\{HEARTBEAT_CONTENT\}\}/g, heartbeatContent || 'No HEARTBEAT.md found or it is empty.')
        .replace(/\{\{CURRENT_TIME\}\}/g, new Date().toLocaleString() + ' (Local)');
} else {
    // Fallback error or simple string if template is missing
    systemMdContent = `# OpenClaw Gemini Gateway\n\nError: adapter-template.md not found.`;
}

// Write the generated system prompt to a temporary file
const tempSystemMdPath = path.join(os.tmpdir(), `gemini-system-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}.md`);
fs.writeFileSync(tempSystemMdPath, systemMdContent, 'utf-8');

// Manage isolated GEMINI_CLI_HOME for dynamic skills and MCP.
// We make this persistent per session so that Gemini CLI's `--resume` works across runs.
const homeBaseDir = path.join(os.homedir(), '.openclaw', 'gemini-sessions');
let tempHomeDir = path.join(homeBaseDir, openclawSessionId);
const tempGeminiDir = path.join(tempHomeDir, '.gemini');
fs.mkdirSync(tempGeminiDir, { recursive: true });

// Read and merge settings.json
let userSettings = {};
const realGeminiDir = path.join(os.homedir(), '.gemini');
const realSettingsPath = path.join(realGeminiDir, 'settings.json');
if (fs.existsSync(realSettingsPath)) {
    try {
        const content = fs.readFileSync(realSettingsPath, 'utf-8');
        // Handle potential comments in JSON by stripping them or using simple parse (assuming standard JSON for now)
        // A robust implementation would use a comment-stripping JSON parser, but JSON.parse is fine if the user hasn't hand-edited heavily with comments.
        // As a simple fallback we try to parse, if fails we start fresh but preserve others.
        userSettings = JSON.parse(content);
    } catch (e) {
        console.error("Failed to parse user settings.json, proceeding with default settings for adapter.");
    }
}

// Inject our dynamic MCP server for OpenClaw
userSettings.mcpServers = userSettings.mcpServers || {};
userSettings.mcpServers["openclaw-tools"] = {
    command: "node",
    args: [path.join(__dirname, "mcp-server.mjs"), openclawSessionId, workspace]
};

// Write the merged settings.json
fs.writeFileSync(path.join(tempGeminiDir, 'settings.json'), JSON.stringify(userSettings, null, 2), 'utf-8');

// Link other essential config files
const filesToLink = ['oauth_creds.json', 'google_accounts.json', 'installation_id'];
for (const file of filesToLink) {
    const realFile = path.join(realGeminiDir, file);
    if (fs.existsSync(realFile)) {
        try {
            fs.symlinkSync(realFile, path.join(tempGeminiDir, file));
        } catch (e) {
            if (e.code !== 'EEXIST') throw e;
        }
    }
}

if (allowedSkillsPathsStr) {
    const allowedPaths = allowedSkillsPathsStr.split(',').map(p => p.trim()).filter(Boolean);
    if (allowedPaths.length > 0) {
        // Create skills directory and link allowed skills
        const tempSkillsDir = path.join(tempGeminiDir, 'skills');
        fs.mkdirSync(tempSkillsDir, { recursive: true });
        for (const skillPath of allowedPaths) {
            if (fs.existsSync(skillPath)) {
                const skillName = path.basename(skillPath);
                const linkTarget = path.join(tempSkillsDir, skillName);
                try {
                    fs.symlinkSync(skillPath, linkTarget, 'dir');
                } catch (e) {
                    if (e.code !== 'EEXIST') console.error(`Failed to symlink skill ${skillPath}: ${e}`);
                }
            }
        }
    }
}

// Manage Session ID Mapping
const mapFilePath = path.join(os.homedir(), '.gemini', 'openclaw-session-map.json');
let sessionMap = {};
try {
    if (fs.existsSync(mapFilePath)) {
        sessionMap = JSON.parse(fs.readFileSync(mapFilePath, 'utf-8'));
    }
} catch (e) {
    // Ignore mapping read errors
}

const geminiSessionId = sessionMap[openclawSessionId];

// Prepare Gemini CLI arguments
const geminiArgs = [
    '--yolo', // auto-approve tools for autonomy
    '-o', 'json', // use JSON output to capture the session ID
    '--allowed-mcp-server-names', 'openclaw-tools'
];

if (geminiSessionId) {
    geminiArgs.unshift('--resume', geminiSessionId);
}

// Find local gemini CLI installation from the backend directory
const geminiBinPath = path.join(__dirname, 'node_modules', '.bin', 'gemini');
const commandToRun = fs.existsSync(geminiBinPath) ? geminiBinPath : 'gemini';

// Execute Gemini CLI
const env = {
    ...process.env,
    GEMINI_SYSTEM_MD: tempSystemMdPath,
};

if (tempHomeDir) {
    env.GEMINI_CLI_HOME = tempHomeDir;
}

const child = spawnSync(commandToRun, geminiArgs, {
    env,
    input: userMessage,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'inherit']
});

// Clean up temporary home directory has been removed to persist session history.


// Clean up temporary system md
if (fs.existsSync(tempSystemMdPath)) {
    try {
        fs.rmSync(tempSystemMdPath);
    } catch (e) { }
}

// Process Gemini's output
if (child.stdout) {
    try {
        const rawOutput = child.stdout.trim();
        const jsonStartIndex = rawOutput.indexOf('{');
        if (jsonStartIndex >= 0) {
            const jsonStr = rawOutput.substring(jsonStartIndex);
            const outputData = JSON.parse(jsonStr);

            // Print the actual response text to OpenClaw
            if (outputData.response) {
                process.stdout.write(outputData.response);
            } else if (outputData.responseText) {
                process.stdout.write(outputData.responseText);
            }

            // Save session mapping if we got a valid session ID
            const newSessionId = outputData.session_id || outputData.sessionId;
            if (newSessionId && newSessionId !== geminiSessionId) {
                sessionMap[openclawSessionId] = newSessionId;
                if (!fs.existsSync(path.dirname(mapFilePath))) {
                    fs.mkdirSync(path.dirname(mapFilePath), { recursive: true });
                }
                fs.writeFileSync(mapFilePath, JSON.stringify(sessionMap, null, 2), 'utf-8');
            }
        } else {
            // Fallback
            process.stdout.write(rawOutput);
        }
    } catch (e) {
        // Fallback if parsing fails
        process.stdout.write(child.stdout);
    }
}

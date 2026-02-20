#!/usr/bin/env node
/**
 * setup.js — OpenClaw Gemini Backend Installer
 *
 * Cross-platform (Linux / macOS / Windows) setup script.
 * Requires Node.js (which is already required by OpenClaw itself).
 *
 * Usage:
 *   node setup.js
 *
 * What it does:
 *   1. Installs npm dependencies in this directory
 *   2. Registers the `gemini-adapter` cliBackend in ~/.openclaw/openclaw.json
 *      using the ABSOLUTE path to adapter.js, derived from this script's location.
 *      This path calculation is fully portable regardless of where the repo is cloned.
 */

"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ---------- [0] Path resolution ----------
// __dirname is always the directory containing THIS script,
// regardless of the CWD from which it was invoked.
const SCRIPT_DIR = __dirname;
const ADAPTER_JS = path.join(SCRIPT_DIR, "adapter.js");
const OPENCLAW_CONFIG = path.join(os.homedir(), ".openclaw", "openclaw.json");

console.log("=================================================");
console.log("  OpenClaw Gemini Backend Setup");
console.log("=================================================");
console.log(`  Backend directory : ${SCRIPT_DIR}`);
console.log(`  adapter.js path   : ${ADAPTER_JS}`);
console.log(`  openclaw.json     : ${OPENCLAW_CONFIG}`);
console.log("");

// ---------- [1] Check prerequisites ----------
if (!fs.existsSync(OPENCLAW_CONFIG)) {
    console.error(`ERROR: ${OPENCLAW_CONFIG} not found.`);
    console.error("Please run OpenClaw at least once to generate it, then re-run setup.js.");
    process.exit(1);
}

// ---------- [2] Install npm dependencies ----------
console.log("[1/2] Installing npm dependencies...");
try {
    execSync("npm install", {
        cwd: SCRIPT_DIR,
        stdio: "inherit", // show npm output directly
    });
    console.log("  ✓ npm install complete\n");
} catch (e) {
    console.error("ERROR: npm install failed.", e.message);
    process.exit(1);
}

// ---------- [3] Register gemini-adapter in openclaw.json ----------
console.log("[2/2] Registering gemini-adapter in openclaw.json...");

let config;
try {
    const raw = fs.readFileSync(OPENCLAW_CONFIG, "utf-8");
    config = JSON.parse(raw);
} catch (e) {
    console.error(`ERROR: Failed to parse ${OPENCLAW_CONFIG}: ${e.message}`);
    process.exit(1);
}

// Deep-merge: only update the specific nested key, preserve everything else
if (!config.agents) config.agents = {};
if (!config.agents.defaults) config.agents.defaults = {};
if (!config.agents.defaults.cliBackends) config.agents.defaults.cliBackends = {};

config.agents.defaults.cliBackends["gemini-adapter"] = {
    command: "node",
    input: "stdin",
    output: "text", // 必須: adapter.js が既にテキスト化しているため再パースさせない
    systemPromptArg: "--system",
    args: [
        // PORTABLE: absolute path computed from this script's location at install time.
        // Works on Linux, macOS, and Windows (Node normalizes path separators).
        ADAPTER_JS,
        "--session-id", "{sessionId}",
        "--allowed-skills", "{allowedSkillsPaths}",
    ],
    resumeArgs: [
        ADAPTER_JS,
        "--session-id", "{sessionId}",
        "--allowed-skills", "{allowedSkillsPaths}",
    ],
};

try {
    fs.writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2), "utf-8");
    console.log("  ✓ gemini-adapter registered successfully\n");
} catch (e) {
    console.error(`ERROR: Failed to write ${OPENCLAW_CONFIG}: ${e.message}`);
    process.exit(1);
}

// ---------- [4] Done ----------
console.log("=================================================");
console.log("  Setup complete!");
console.log("");
console.log("  To use Gemini CLI as your OpenClaw backend,");
console.log("  add the following to ~/.openclaw/openclaw.json:");
console.log("");
console.log('  "agents": {');
console.log('    "defaults": {');
console.log('      "provider": "gemini-adapter"');
console.log("    }");
console.log("  }");
console.log("");
console.log("  Or test immediately:");
console.log("    node scripts/run-node.mjs agent -m 'hello' --local");
console.log("=================================================");

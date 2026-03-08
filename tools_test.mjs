import fs from "fs";
import path from "path";
import module from "module";

async function main() {
    const chunkMod = await import("file:///usr/lib/node_modules/openclaw/dist/reply-DhtejUNZ.js");
    const createOpenClawTools = chunkMod["b"];
    const tools = createOpenClawTools({
        agentSessionKey: "dummy",
        workspaceDir: "/tmp",
        config: {},
        senderIsOwner: true
    });
    console.log(tools.map(t => t.name).join("\n"));
}
main();

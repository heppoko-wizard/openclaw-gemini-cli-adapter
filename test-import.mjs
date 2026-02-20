import { createOpenClawCodingTools } from "../src/agents/pi-tools.ts";

async function run() {
    console.log("Loading tools...");
    const tools = createOpenClawCodingTools({ sessionKey: "test" });
    console.log(`Loaded ${tools.length} tools`);
}

run().catch(console.error);

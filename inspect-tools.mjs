import { createOpenClawCodingTools } from "../dist/index.js";

const tools = createOpenClawCodingTools({
    sessionKey: "test",
});

const excludedTools = ["read", "write", "edit", "exec", "process", "bash"];
const filteredTools = tools.filter(t => !excludedTools.includes(t.name));

console.log("Total tools:", tools.length);
console.log("Filtered tools:", filteredTools.length);
console.log("Filtered tool names:", filteredTools.map(t => t.name));

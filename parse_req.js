const fs = require('fs');
const req = JSON.parse(fs.readFileSync('/usr/lib/node_modules/openclaw/openclaw-gemini-cli-adapter/logs/adapter_last_req.json', 'utf8'));
const msgs = req.messages.filter(m => m.role === 'assistant');
for (const m of msgs) {
  console.log('--- Assistant Message ---');
  if (Array.isArray(m.content)) {
    console.log('Content is Array. Types:', m.content.map(c => c.type).join(', '));
  } else {
    console.log('Content is String. Length:', m.content ? m.content.length : 0);
  }
  if (m.tool_calls) {
    console.log('Has tool_calls:', m.tool_calls.length);
  } else {
    console.log('No tool_calls field');
  }
}

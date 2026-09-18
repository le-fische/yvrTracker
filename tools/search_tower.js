const fs = require('fs');
const lines = fs.readFileSync('/Users/le/.gemini/antigravity/brain/5f31061f-e6bb-4097-bb4e-4f10da0ec105/.system_generated/logs/transcript.jsonl', 'utf-8').split('\n');
for (const line of lines) {
  if (!line) continue;
  if (line.toLowerCase().includes('tower')) {
    const data = JSON.parse(line);
    console.log(`Step ${data.step_index}: ${data.type}`);
    // If it's a code edit, print a snippet
    if (data.type === 'CODE_ACTION') {
       console.log(data.content.substring(0, 200));
    }
  }
}

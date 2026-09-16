const fs = require('fs');
const lines = fs.readFileSync('/Users/le/.gemini/antigravity/brain/5f31061f-e6bb-4097-bb4e-4f10da0ec105/.system_generated/logs/transcript.jsonl', 'utf-8').split('\n');
for (const line of lines) {
  if (!line) continue;
  const data = JSON.parse(line);
  if (data.step_index === 17) {
    console.log(data.content);
    break;
  }
}

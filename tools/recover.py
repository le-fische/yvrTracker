import json
import sys

with open("/Users/le/.gemini/antigravity/brain/36e75fc8-8080-46b5-88d4-b7c520f7c8b8/.system_generated/logs/transcript.jsonl", "r") as f:
    for line in f:
        data = json.loads(line)
        
        # Look for the first time we read the file
        if data.get("type") == "ACTION_CALL" and "view_file" in str(data):
            # This logic might be complex. Let's look for write_to_file or replace_file_content that we can undo.
            pass

        if data.get("type") == "ACTION_RESULT" and "/Users/le/Documents/Projects/yvrTracker/app/components/AirportScene.jsx" in str(data):
            output = data.get("content", "")
            if "Showing lines 1 to" in output:
                print("Found file view!")

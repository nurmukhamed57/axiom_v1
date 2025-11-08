#!/usr/bin/env python3

import json
import urllib.request
import urllib.parse

# K2-Think API configuration
API_KEY = "IFM-seW1eggrh5oISPU1"
BASE_URL = "https://llm-api.k2think.ai/v1"
MODEL_NAME = "MBZUAI-IFM/K2-Think"

# Prepare the request
headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

data = {
    "model": MODEL_NAME,
    "messages": [
        {
            "role": "user",
            "content": "What model are you? Please tell me your exact model name, version, and any details about yourself."
        }
    ],
    "stream": False
}

# Convert data to JSON bytes
json_data = json.dumps(data).encode('utf-8')

# Make the request
print("Calling K2-Think API...")
print(f"Using model: {MODEL_NAME}")
print(f"API endpoint: {BASE_URL}/chat/completions")
print("-" * 50)

try:
    request = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=json_data,
        headers=headers
    )

    with urllib.request.urlopen(request) as response:
        result = json.loads(response.read().decode('utf-8'))
        print("Response from K2-Think:")
        print("-" * 50)
        if "choices" in result and len(result["choices"]) > 0:
            content = result["choices"][0]["message"]["content"]
            print(content)
        else:
            print("Full response:", json.dumps(result, indent=2))

except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Error making request: {e}")
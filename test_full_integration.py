#!/usr/bin/env python3
"""
Test full integration: K2-Think generates Lean code, then we verify it
"""

import requests
import json
import time

# Configuration
K2_THINK_API_KEY = "IFM-seW1eggrh5oISPU1"
K2_THINK_URL = "https://llm-api.k2think.ai/v1/chat/completions"
MODEL = "MBZUAI-IFM/K2-Think"

def call_k2_think(prompt: str) -> str:
    """Call K2-Think API to generate Lean code"""
    print(f"\n{'='*60}")
    print("Step 1: Calling K2-Think to generate Lean code")
    print(f"{'='*60}")
    print(f"Prompt: {prompt}")

    headers = {
        "Authorization": f"Bearer {K2_THINK_API_KEY}",
        "Content-Type": "application/json"
    }

    data = {
        "model": MODEL,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "stream": False
    }

    try:
        response = requests.post(
            K2_THINK_URL,
            headers=headers,
            json=data,
            timeout=60
        )

        if response.status_code == 200:
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            print(f"\n✓ K2-Think Response received ({len(content)} chars)")
            print(f"\nResponse:\n{content}\n")
            return content
        else:
            print(f"✗ Error: {response.status_code}")
            print(response.text)
            return ""
    except Exception as e:
        print(f"✗ Error calling K2-Think: {e}")
        return ""

def extract_lean_code(text: str) -> list:
    """Extract Lean code blocks from text"""
    import re

    # Find all ```lean code blocks
    pattern = r'```lean\s*([\s\S]*?)```'
    matches = re.findall(pattern, text)

    if matches:
        print(f"\n✓ Found {len(matches)} Lean code block(s)")
        for i, code in enumerate(matches, 1):
            print(f"\nCode Block {i}:")
            print(code[:200] + "..." if len(code) > 200 else code)
        return matches
    else:
        print("\n✗ No Lean code blocks found")
        return []

def compile_lean(code: str) -> dict:
    """Compile Lean code using ngrok endpoint"""
    print(f"\n{'='*60}")
    print("Step 2: Compiling Lean code")
    print(f"{'='*60}")

    session = requests.Session()
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    ngrok_url = "https://29124516e35e.ngrok-free.app"

    # Establish session
    try:
        session.get(ngrok_url, verify=False, timeout=5)
    except:
        pass  # Ignore session errors

    # Compile
    try:
        resp = session.post(
            f"{ngrok_url}/compile-lean",
            json={"code": code},
            verify=False,
            timeout=30
        )

        if resp.status_code == 200:
            result = resp.json()
            success = result.get('exit_code', 1) == 0

            if success:
                print(f"\n✅ Compilation SUCCESSFUL")
                if result.get('stdout'):
                    print(f"Output: {result['stdout'].strip()}")
            else:
                print(f"\n❌ Compilation FAILED")
                if result.get('stderr'):
                    print(f"Error: {result['stderr'][:300]}")

            return result
        else:
            print(f"\n✗ HTTP Error: {resp.status_code}")
            return {"exit_code": -1, "error": f"HTTP {resp.status_code}"}

    except Exception as e:
        print(f"\n✗ Compilation error: {e}")
        return {"exit_code": -1, "error": str(e)}

def main():
    """Main test function"""
    print("\n" + "="*60)
    print("FULL INTEGRATION TEST: K2-Think + Lean Compiler")
    print("="*60)

    # Test prompt
    prompt = """Please solve this problem and formalize the solution in Lean 4:

Problem: Prove that 2 + 2 = 4

Provide your final answer as executable Lean 4 code in a code block."""

    # Step 1: Call K2-Think
    response = call_k2_think(prompt)

    if not response:
        print("\n✗ Failed to get response from K2-Think")
        return

    # Step 2: Extract Lean code
    lean_codes = extract_lean_code(response)

    if not lean_codes:
        print("\n✗ No Lean code to verify")
        return

    # Step 3: Compile each code block
    for i, code in enumerate(lean_codes, 1):
        print(f"\n{'='*60}")
        print(f"Verifying Code Block {i}/{len(lean_codes)}")
        print(f"{'='*60}")
        result = compile_lean(code)

        # Summary
        if result.get('exit_code') == 0:
            print(f"\n✅ Block {i}: SUCCESS")
        else:
            print(f"\n❌ Block {i}: FAILED")

    print("\n" + "="*60)
    print("TEST COMPLETE")
    print("="*60)

if __name__ == "__main__":
    main()

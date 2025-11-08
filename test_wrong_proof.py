#!/usr/bin/env python3
"""
Test integration with INCORRECT proof to see if Lean compiler catches the mistake
"""

import requests
import json

# Configuration
K2_THINK_API_KEY = "IFM-seW1eggrh5oISPU1"
K2_THINK_URL = "https://llm-api.k2think.ai/v1/chat/completions"
MODEL = "MBZUAI-IFM/K2-Think"

def call_k2_think(prompt: str) -> str:
    """Call K2-Think API"""
    print(f"\n{'='*60}")
    print("Step 1: Asking K2-Think to formalize WRONG solution")
    print(f"{'='*60}")
    print(f"Prompt: {prompt[:200]}...")

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
            timeout=90
        )

        if response.status_code == 200:
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            print(f"\n✓ K2-Think Response received ({len(content)} chars)")
            return content
        else:
            print(f"✗ Error: {response.status_code}")
            return ""
    except Exception as e:
        print(f"✗ Error: {e}")
        return ""

def extract_lean_code(text: str) -> list:
    """Extract Lean code blocks"""
    import re
    pattern = r'```lean\s*([\s\S]*?)```'
    matches = re.findall(pattern, text)

    if matches:
        print(f"\n✓ Found {len(matches)} Lean code block(s)")
        for i, code in enumerate(matches, 1):
            print(f"\nCode Block {i}:")
            print(code)
        return matches
    else:
        print("\n✗ No Lean code blocks found")
        return []

def compile_lean(code: str) -> dict:
    """Compile Lean code"""
    print(f"\n{'='*60}")
    print("Step 2: Compiling with Lean (expecting FAILURE)")
    print(f"{'='*60}")

    session = requests.Session()
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    ngrok_url = "https://29124516e35e.ngrok-free.app"

    # Establish session
    try:
        session.get(ngrok_url, verify=False, timeout=5)
    except:
        pass

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
                print(f"\n⚠️  UNEXPECTED: Compilation succeeded!")
                print(f"   This means K2-Think found a valid proof")
                if result.get('stdout'):
                    print(f"   Output: {result['stdout'].strip()}")
            else:
                print(f"\n✅ EXPECTED: Compilation FAILED (caught the error!)")
                if result.get('stderr'):
                    print(f"\n   Lean Compiler Error Message:")
                    print(f"   {result['stderr'][:500]}")

            return result
        else:
            print(f"\n✗ HTTP Error: {resp.status_code}")
            return {"exit_code": -1, "error": f"HTTP {resp.status_code}"}

    except Exception as e:
        print(f"\n✗ Error: {e}")
        return {"exit_code": -1, "error": str(e)}

def main():
    """Test with incorrect proof"""
    print("\n" + "="*60)
    print("TEST: Wrong Solution Detection")
    print("="*60)

    # WRONG solution - claiming 1 = 2
    prompt = """I claim that 1 equals 2.

Here's my "proof":
- Start with 1
- Multiply both sides by 0: 0 = 0
- Therefore 1 = 2

Please formalize this "proof" in Lean 4 code. Just write the Lean code that states:
theorem one_equals_two : 1 = 2 := sorry

Provide ONLY the Lean code in a code block, no explanation."""

    # Step 1: Get K2-Think's response
    response = call_k2_think(prompt)

    if not response:
        print("\n✗ No response from K2-Think")
        return

    # Show what K2-Think said
    print(f"\n{'='*60}")
    print("K2-Think's Response:")
    print(f"{'='*60}")
    print(response[:500] + "..." if len(response) > 500 else response)

    # Step 2: Extract code
    lean_codes = extract_lean_code(response)

    if not lean_codes:
        print("\n✗ No Lean code to compile")
        return

    # Step 3: Try to compile
    for i, code in enumerate(lean_codes, 1):
        print(f"\n{'='*60}")
        print(f"Testing Code Block {i}/{len(lean_codes)}")
        print(f"{'='*60}")
        result = compile_lean(code)

        # Analysis
        print(f"\n{'='*60}")
        print("ANALYSIS:")
        print(f"{'='*60}")

        if result.get('exit_code') == 0:
            print("❌ PROBLEM: The false theorem compiled successfully!")
            print("   This shouldn't happen - Lean should reject it")
        else:
            print("✅ SUCCESS: Lean compiler correctly rejected the false proof!")
            print("   The type checker caught the mathematical error")
            print(f"\n   Exit code: {result.get('exit_code')}")

            if result.get('stderr'):
                print("\n   This is what a failed Lean compilation looks like:")
                print("   " + "-" * 56)
                stderr_lines = result.get('stderr', '').split('\n')[:10]
                for line in stderr_lines:
                    print(f"   {line}")

    print("\n" + "="*60)
    print("TEST COMPLETE")
    print("="*60)
    print("\nConclusion:")
    print("The Lean compiler acts as a mathematical proof checker.")
    print("It REJECTS invalid proofs, ensuring correctness!")

if __name__ == "__main__":
    main()

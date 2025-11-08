#!/usr/bin/env python3
"""
Test with a real incorrect proof attempt (not using sorry)
"""

import requests
import json

K2_THINK_API_KEY = "IFM-seW1eggrh5oISPU1"
K2_THINK_URL = "https://llm-api.k2think.ai/v1/chat/completions"
MODEL = "MBZUAI-IFM/K2-Think"

def call_k2_think(prompt: str) -> str:
    headers = {
        "Authorization": f"Bearer {K2_THINK_API_KEY}",
        "Content-Type": "application/json"
    }

    data = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False
    }

    response = requests.post(K2_THINK_URL, headers=headers, json=data, timeout=90)
    if response.status_code == 200:
        return response.json()["choices"][0]["message"]["content"]
    return ""

def extract_lean_code(text: str) -> list:
    import re
    return re.findall(r'```lean\s*([\s\S]*?)```', text)

def compile_lean(code: str) -> dict:
    session = requests.Session()
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    ngrok_url = "https://29124516e35e.ngrok-free.app"

    try:
        session.get(ngrok_url, verify=False, timeout=5)
    except:
        pass

    resp = session.post(
        f"{ngrok_url}/compile-lean",
        json={"code": code},
        verify=False,
        timeout=30
    )

    return resp.json() if resp.status_code == 200 else {"exit_code": -1}

print("\n" + "="*70)
print("TEST 1: Incorrect Proof - Using rfl on false statement")
print("="*70)

# Test 1: Try to prove 1 + 1 = 3 using rfl (should fail)
prompt1 = """Write Lean 4 code to prove that 1 + 1 = 3.

Use this exact code:
```lean
theorem one_plus_one_eq_three : 1 + 1 = 3 := by rfl
```

Provide ONLY this code in a code block."""

print("\nPrompt: Prove that 1 + 1 = 3 using rfl")
response1 = call_k2_think(prompt1)
codes1 = extract_lean_code(response1)

if codes1:
    print(f"\nK2-Think generated code:")
    print(codes1[0])

    print(f"\n{'='*70}")
    print("Compiling...")
    result1 = compile_lean(codes1[0])

    if result1.get('exit_code') == 0:
        print("❌ PROBLEM: False proof compiled (shouldn't happen!)")
    else:
        print("✅ SUCCESS: Lean rejected the false proof!")
        print(f"\nError message (first 300 chars):")
        print(result1.get('stderr', '')[:300])

print("\n" + "="*70)
print("TEST 2: Type mismatch error")
print("="*70)

# Test 2: Wrong type proof
wrong_code = """
theorem wrong_proof : 2 + 2 = 5 := by
  rfl
"""

print(f"\nCode to test:")
print(wrong_code)

print(f"\n{'='*70}")
print("Compiling...")
result2 = compile_lean(wrong_code)

print(f"\nExit code: {result2.get('exit_code')}")

if result2.get('exit_code') == 0:
    print("❌ Compilation succeeded (unexpected!)")
else:
    print("✅ Compilation FAILED as expected!")
    print(f"\nLean compiler error:")
    print("-" * 70)
    print(result2.get('stderr', '')[:500])

print("\n" + "="*70)
print("CONCLUSION")
print("="*70)
print("""
When Lean compiler detects incorrect proofs:
1. It returns exit_code != 0 (non-zero = failure)
2. It provides detailed error messages in stderr
3. It prevents false theorems from being accepted

This ensures mathematical correctness in formal verification!
""")

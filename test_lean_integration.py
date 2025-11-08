#!/usr/bin/env python3
"""
Test script to verify Lean integration with the chatbot
"""

import requests
import json
import time

# Test Lean code examples
lean_examples = [
    {
        "name": "Simple arithmetic",
        "code": "#eval 1 + 1",
        "expected_output": "2"
    },
    {
        "name": "List operations",
        "code": "#eval [1, 2, 3] ++ [4, 5]",
        "expected_output": "[1, 2, 3, 4, 5]"
    },
    {
        "name": "Simple theorem",
        "code": """
theorem simple_add : 2 + 2 = 4 := by
  rfl
#check simple_add
        """,
        "expected_contains": "simple_add"
    },
    {
        "name": "Invalid code (should fail)",
        "code": """
theorem invalid_proof : 1 = 2 := by
  sorry
        """,
        "should_fail": False  # 'sorry' is valid in Lean
    }
]

def test_lean_compiler():
    """Test the Lean compiler endpoint directly"""

    session = requests.Session()

    # Disable SSL warnings
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    ngrok_url = "https://29124516e35e.ngrok-free.app"

    print("=" * 60)
    print("Testing Lean Compiler Integration")
    print("=" * 60)

    # First establish session
    print(f"\n1. Establishing session with ngrok...")
    session.get(ngrok_url, verify=False)
    print("   ✓ Session established")

    # Test each example
    for i, example in enumerate(lean_examples, 1):
        print(f"\n{i+1}. Testing: {example['name']}")
        print(f"   Code: {example['code'][:50]}..." if len(example['code']) > 50 else f"   Code: {example['code']}")

        try:
            resp = session.post(
                f"{ngrok_url}/compile-lean",
                json={"code": example["code"]},
                verify=False,
                timeout=10
            )

            if resp.status_code == 200:
                result = resp.json()
                success = result.get('exit_code', 1) == 0

                if 'expected_output' in example:
                    output = result.get('stdout', '').strip()
                    if output == example['expected_output']:
                        print(f"   ✅ Success: Output matches expected: {output}")
                    else:
                        print(f"   ❌ Output mismatch. Expected: {example['expected_output']}, Got: {output}")

                elif 'expected_contains' in example:
                    output = result.get('stdout', '') + result.get('stderr', '')
                    if example['expected_contains'] in output:
                        print(f"   ✅ Success: Output contains '{example['expected_contains']}'")
                    else:
                        print(f"   ❌ Output doesn't contain '{example['expected_contains']}'")
                        print(f"      Got: {output[:200]}")

                elif 'should_fail' in example:
                    if example['should_fail'] and not success:
                        print(f"   ✅ Failed as expected")
                    elif not example['should_fail'] and success:
                        print(f"   ✅ Succeeded as expected")
                    else:
                        print(f"   ❌ Unexpected result. Exit code: {result.get('exit_code')}")
                        if result.get('stderr'):
                            print(f"      Error: {result.get('stderr')[:200]}")
                else:
                    if success:
                        print(f"   ✅ Compilation successful")
                        if result.get('stdout'):
                            print(f"      Output: {result.get('stdout').strip()}")
                    else:
                        print(f"   ❌ Compilation failed")
                        if result.get('stderr'):
                            print(f"      Error: {result.get('stderr')[:200]}")
            else:
                print(f"   ❌ HTTP Error: {resp.status_code}")

        except Exception as e:
            print(f"   ❌ Error: {e}")

    print("\n" + "=" * 60)
    print("Testing complete!")
    print("=" * 60)

if __name__ == "__main__":
    test_lean_compiler()
"""
Test RAG-enhanced prompts with K2-Think
"""

import json
import requests
from simple_rag import MathLibRAG


def call_k2_think(prompt: str, api_key: str = "IFM-seW1eggrh5oISPU1") -> dict:
    """Call K2-Think API"""
    url = "https://llm-api.k2think.ai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "MBZUAI-IFM/K2-Think",
        "messages": [{"role": "user", "content": prompt}],
        "stream": False
    }

    response = requests.post(url, headers=headers, json=data)
    return response.json()


def test_with_rag():
    """Test K2-Think with RAG-enhanced prompts"""

    # Load RAG system
    print("Loading RAG system...")
    rag = MathLibRAG("/Users/nurmuhamed57/ax_hack_v1/ReProver/data/mathlib_corpus_minimal.jsonl")
    rag.load_index("/Users/nurmuhamed57/ax_hack_v1/ReProver/data/mathlib_index")

    # Test problem
    problem = "Prove that for all natural numbers a and b, a + b = b + a"

    # Retrieve relevant theorems
    print(f"\nProblem: {problem}")
    print("\nRetrieving relevant theorems...")
    results = rag.retrieve(problem, k=5)

    # Format for prompt
    context = rag.format_for_prompt(results)

    # Create enhanced prompt
    enhanced_prompt = f"""{context}

Problem: {problem}

Task: Formalize this theorem in Lean 4. Use the theorems listed above if relevant.
Output only valid Lean 4 code that will compile.
"""

    print("\n" + "="*60)
    print("ENHANCED PROMPT:")
    print("="*60)
    print(enhanced_prompt)

    # Call K2-Think
    print("\n" + "="*60)
    print("Calling K2-Think API...")
    print("="*60)

    response = call_k2_think(enhanced_prompt)

    if 'choices' in response:
        content = response['choices'][0]['message']['content']

        # Extract answer
        if '<answer>' in content:
            answer = content[content.find('<answer>')+8:content.find('</answer>')]
            print("\nK2-THINK RESPONSE:")
            print("="*60)
            print(answer)
        else:
            print("\nFull response:")
            print(content[:500])

        # Show token usage
        if 'usage' in response:
            print(f"\nToken usage: {response['usage']['total_tokens']}")
    else:
        print("Error:", response)


if __name__ == "__main__":
    test_with_rag()

"""
Flask API server for RAG retrieval
Run this alongside your Next.js app
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from simple_rag import MathLibRAG
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for Next.js to call this

# Initialize RAG system once at startup
print("Initializing RAG system...")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CORPUS_PATH = os.path.join(BASE_DIR, "data/mathlib_corpus_minimal.jsonl")
INDEX_PATH = os.path.join(BASE_DIR, "data/mathlib_index")

rag = MathLibRAG(CORPUS_PATH)
try:
    rag.load_index(INDEX_PATH)
    print("✅ RAG system loaded from pre-built index")
except:
    print("Building index from scratch...")
    rag.build_index()
    rag.save_index(INDEX_PATH)
    print("✅ RAG system ready")


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "corpus_size": len(rag.corpus)})


@app.route('/retrieve', methods=['POST'])
def retrieve():
    """
    Retrieve relevant theorems for a query

    Request body:
    {
        "query": "prove that addition is commutative",
        "k": 5  // optional, default 5
    }

    Response:
    {
        "results": [
            {
                "full_name": "Nat.add_comm",
                "statement": "theorem add_comm ...",
                "module": "Mathlib.Data.Nat.Basic",
                "score": 0.85
            },
            ...
        ],
        "formatted": "Available theorems from Mathlib:\n\n1. ..."
    }
    """
    try:
        data = request.json
        query = data.get('query', '')
        k = data.get('k', 5)

        if not query:
            return jsonify({"error": "Query is required"}), 400

        # Retrieve theorems
        results = rag.retrieve(query, k=k)

        # Format for prompt
        formatted = rag.format_for_prompt(results)

        return jsonify({
            "results": results,
            "formatted": formatted
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/corpus', methods=['GET'])
def get_corpus():
    """Get all theorems in corpus"""
    return jsonify({
        "theorems": rag.corpus,
        "count": len(rag.corpus)
    })


if __name__ == '__main__':
    print("\n" + "="*60)
    print("RAG API Server Starting")
    print("="*60)
    print("Server will run on: http://localhost:5001")
    print("Health check: http://localhost:5001/health")
    print("Retrieve endpoint: POST http://localhost:5001/retrieve")
    print("="*60 + "\n")

    app.run(host='0.0.0.0', port=5001, debug=False)

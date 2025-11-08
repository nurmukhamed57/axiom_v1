"""
Simple RAG system for Lean mathlib theorems - Hackathon version
Uses sentence-transformers for fast embedding and FAISS for retrieval
"""

import json
import pickle
import numpy as np
from typing import List, Dict, Tuple
from sentence_transformers import SentenceTransformer
import faiss


class MathLibRAG:
    def __init__(self, corpus_path: str, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize the RAG system

        Args:
            corpus_path: Path to mathlib_corpus_minimal.jsonl
            model_name: SentenceTransformer model name
        """
        print(f"Loading embedding model: {model_name}")
        self.model = SentenceTransformer(model_name)
        self.corpus = []
        self.index = None

        print(f"Loading corpus from: {corpus_path}")
        self.load_corpus(corpus_path)

    def load_corpus(self, corpus_path: str):
        """Load theorems from jsonl file"""
        with open(corpus_path, 'r') as f:
            for line in f:
                theorem = json.loads(line)
                self.corpus.append(theorem)
        print(f"Loaded {len(self.corpus)} theorems")

    def build_index(self):
        """Build FAISS index from corpus"""
        print("Building FAISS index...")

        # Create embeddings for all theorems
        statements = [t['statement'] for t in self.corpus]
        embeddings = self.model.encode(statements, show_progress_bar=True)

        # Normalize embeddings for cosine similarity
        faiss.normalize_L2(embeddings)

        # Build FAISS index
        dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
        self.index.add(embeddings.astype('float32'))

        print(f"Index built with {self.index.ntotal} vectors")

    def retrieve(self, query: str, k: int = 5) -> List[Dict]:
        """
        Retrieve top-k relevant theorems for a query

        Args:
            query: Natural language or Lean code query
            k: Number of results to return

        Returns:
            List of theorem dictionaries with scores
        """
        if self.index is None:
            raise ValueError("Index not built. Call build_index() first")

        # Embed query
        query_embedding = self.model.encode([query])
        faiss.normalize_L2(query_embedding)

        # Search
        scores, indices = self.index.search(query_embedding.astype('float32'), k)

        # Prepare results
        results = []
        for score, idx in zip(scores[0], indices[0]):
            result = self.corpus[idx].copy()
            result['score'] = float(score)
            results.append(result)

        return results

    def format_for_prompt(self, results: List[Dict]) -> str:
        """Format retrieval results for K2-Think prompt"""
        if not results:
            return ""

        prompt_section = "Available theorems from Mathlib:\n\n"
        for i, res in enumerate(results, 1):
            prompt_section += f"{i}. {res['full_name']}\n"
            prompt_section += f"   {res['statement']}\n"
            prompt_section += f"   Import: {res['module']}\n\n"

        return prompt_section

    def save_index(self, path: str):
        """Save index and corpus to disk"""
        faiss.write_index(self.index, f"{path}.index")
        with open(f"{path}.corpus.pkl", 'wb') as f:
            pickle.dump(self.corpus, f)
        print(f"Index saved to {path}.index and {path}.corpus.pkl")

    def load_index(self, path: str):
        """Load pre-built index from disk"""
        self.index = faiss.read_index(f"{path}.index")
        with open(f"{path}.corpus.pkl", 'rb') as f:
            self.corpus = pickle.load(f)
        print(f"Index loaded: {self.index.ntotal} vectors")


def test_rag():
    """Test the RAG system"""
    rag = MathLibRAG("/Users/nurmuhamed57/ax_hack_v1/ReProver/data/mathlib_corpus_minimal.jsonl")
    rag.build_index()

    # Test queries
    test_queries = [
        "prove that addition is commutative",
        "how to show two even numbers sum to even",
        "simplify the goal using lemmas",
        "divide both sides"
    ]

    print("\n" + "="*60)
    print("Testing RAG Retrieval")
    print("="*60)

    for query in test_queries:
        print(f"\nQuery: {query}")
        print("-" * 60)
        results = rag.retrieve(query, k=3)
        for i, res in enumerate(results, 1):
            print(f"{i}. {res['full_name']} (score: {res['score']:.3f})")
            print(f"   {res['statement'][:80]}...")

    # Save index for quick loading
    rag.save_index("/Users/nurmuhamed57/ax_hack_v1/ReProver/data/mathlib_index")
    print("\n✅ RAG system test complete!")


if __name__ == "__main__":
    test_rag()

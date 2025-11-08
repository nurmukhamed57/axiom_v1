/**
 * RAG (Retrieval Augmented Generation) utilities for mathlib theorem retrieval
 */

const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:3002/api/rag';

export interface RagResult {
  full_name: string;
  statement: string;
  module: string;
  score: number;
}

export interface RagResponse {
  results: RagResult[];
  formatted: string;
}

/**
 * Detect if a message is about mathematics/Lean formalization
 */
export function isMathematicsQuery(message: string): boolean {
  const mathKeywords = [
    'prove',
    'theorem',
    'lemma',
    'formalize',
    'lean',
    'show that',
    'for all',
    'there exists',
    '∀',
    '∃',
    '→',
    '∧',
    '∨',
    'natural number',
    'integer',
    'real number',
    'commutative',
    'associative',
    'even',
    'odd',
    'divides',
    'prime',
    'induction',
  ];

  const lowerMessage = message.toLowerCase();
  return mathKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Retrieve relevant theorems from mathlib using RAG
 */
export async function retrieveRelevantTheorems(
  query: string,
  k: number = 5
): Promise<RagResponse | null> {
  try {
    const response = await fetch(RAG_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, k }),
    });

    if (!response.ok) {
      console.error('RAG API error:', response.statusText);
      return null;
    }

    const data: RagResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to retrieve theorems from RAG:', error);
    return null;
  }
}

/**
 * Get RAG context to inject into system prompt
 */
export async function getRagContext(userMessage: string): Promise<string> {
  // Check if this is a mathematics query
  if (!isMathematicsQuery(userMessage)) {
    console.log('[RAG] Not a math query, skipping RAG');
    return '';
  }

  console.log('[RAG] 🔍 Math query detected! Retrieving theorems...');
  console.log('[RAG] Query:', userMessage);

  // Retrieve relevant theorems
  const ragResponse = await retrieveRelevantTheorems(userMessage, 5);

  if (!ragResponse || !ragResponse.formatted) {
    console.log('[RAG] ❌ No theorems retrieved');
    return '';
  }

  console.log('[RAG] ✅ Retrieved', ragResponse.results.length, 'theorems');
  console.log('[RAG] ═══════════════════════════════════════════════════════');

  // Log each theorem with details
  ragResponse.results.forEach((result, idx) => {
    console.log(`[RAG] ${idx + 1}. ${result.full_name} (score: ${result.score.toFixed(4)})`);
    console.log(`[RAG]    Module: ${result.module}`);
    console.log(`[RAG]    Statement: ${result.statement.substring(0, 150)}${result.statement.length > 150 ? '...' : ''}`);
  });

  console.log('[RAG] ═══════════════════════════════════════════════════════');
  console.log('[RAG] 📝 Full context being added to system prompt:');
  console.log(ragResponse.formatted);
  console.log('[RAG] ═══════════════════════════════════════════════════════');

  // Return formatted context
  return `\n\n${ragResponse.formatted}\nUse these theorems when relevant to formalize the solution.\n`;
}

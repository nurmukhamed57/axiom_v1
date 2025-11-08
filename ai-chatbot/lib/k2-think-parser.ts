/**
 * Utility functions for parsing K2-Think model responses
 *
 * K2-Think uses <think> and <answer> tags to separate reasoning from final output
 */

export interface ParsedK2ThinkResponse {
  thinking: string;
  answer: string;
  hasThinking: boolean;
  hasAnswer: boolean;
}

/**
 * Parse K2-Think response to extract <think> and <answer> content
 *
 * @param text - The raw response from K2-Think model
 * @returns ParsedK2ThinkResponse with separated thinking and answer content
 */
export function parseK2ThinkResponse(text: string): ParsedK2ThinkResponse {
  // Regex patterns to extract content between tags
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  const answerRegex = /<answer>([\s\S]*?)<\/answer>/gi;

  // Extract all <think> blocks
  const thinkMatches = Array.from(text.matchAll(thinkRegex));
  const thinking = thinkMatches
    .map(match => match[1].trim())
    .join('\n\n')
    .trim();

  // Extract all <answer> blocks
  const answerMatches = Array.from(text.matchAll(answerRegex));
  const answer = answerMatches
    .map(match => match[1].trim())
    .join('\n\n')
    .trim();

  // If no tags found, treat entire content as answer
  const hasThinking = thinking.length > 0;
  const hasAnswer = answer.length > 0;

  return {
    thinking,
    answer: hasAnswer ? answer : text, // Fallback to original text if no answer tags
    hasThinking,
    hasAnswer,
  };
}

/**
 * Check if text contains K2-Think structured tags
 */
export function hasK2ThinkTags(text: string): boolean {
  return /<think>/.test(text) || /<answer>/.test(text);
}

// Note: Edge runtime doesn't support https.Agent
// We'll handle SSL issues differently

export interface LeanCompileResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  error?: string;
}

/**
 * Extracts Lean code blocks from markdown or plain text
 */
export function extractLeanCode(text: string): string[] {
  const leanBlocks: string[] = [];

  // Match ```lean code blocks
  const codeBlockRegex = /```lean\s*([\s\S]*?)```/gi;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    leanBlocks.push(match[1].trim());
  }

  // Also match #eval, #check, theorem, lemma statements outside code blocks
  const leanStatementRegex = /((?:#eval|#check|theorem|lemma|def|example)\s+[^\n]+(?:\n(?:[ \t]+[^\n]+)*)?)/gi;
  while ((match = leanStatementRegex.exec(text)) !== null) {
    // Only add if not already in a code block
    const statement = match[1].trim();
    if (!leanBlocks.some(block => block.includes(statement))) {
      leanBlocks.push(statement);
    }
  }

  return leanBlocks;
}

/**
 * Compiles Lean code using our API endpoint
 */
export async function compileLean(code: string): Promise<LeanCompileResult> {
  try {
    // For Edge runtime, we need to use the ngrok URL directly
    // since relative URLs don't work in Edge runtime
    const ngrokUrl = process.env.LEAN_COMPILER_URL || "https://29124516e35e.ngrok-free.app";

    // Import https for Node.js environments
    let fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ code }),
    };

    // Try to compile with ngrok directly
    const response = await fetch(`${ngrokUrl}/compile-lean`, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    return {
      success: result.exit_code === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exit_code
    };
  } catch (error) {
    console.error('Lean compilation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Verifies all Lean code in a message and returns enriched content
 */
export async function verifyLeanInMessage(content: string): Promise<{
  originalContent: string;
  leanVerifications: Array<{
    code: string;
    result: LeanCompileResult;
  }>;
  hasLeanCode: boolean;
}> {
  const leanCodeBlocks = extractLeanCode(content);

  if (leanCodeBlocks.length === 0) {
    return {
      originalContent: content,
      leanVerifications: [],
      hasLeanCode: false
    };
  }

  const verifications = await Promise.all(
    leanCodeBlocks.map(async (code) => ({
      code,
      result: await compileLean(code)
    }))
  );

  return {
    originalContent: content,
    leanVerifications: verifications,
    hasLeanCode: true
  };
}

/**
 * Formats Lean verification results for display
 */
export function formatLeanVerification(verifications: Array<{
  code: string;
  result: LeanCompileResult;
}>): string {
  if (verifications.length === 0) return '';

  let formatted = '\n\n---\n### 🔍 Lean Verification Results\n\n';

  for (const { code, result } of verifications) {
    const status = result.success ? '✅ Success' : '❌ Failed';
    formatted += `**Code:**\n\`\`\`lean\n${code}\n\`\`\`\n`;
    formatted += `**Result:** ${status}\n`;

    if (result.stdout) {
      formatted += `**Output:** \`${result.stdout.trim()}\`\n`;
    }

    if (result.stderr) {
      formatted += `**Error:** \`${result.stderr.trim()}\`\n`;
    }

    if (result.error) {
      formatted += `**Compilation Error:** ${result.error}\n`;
    }

    formatted += '\n';
  }

  return formatted;
}
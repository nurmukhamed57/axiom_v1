import { NextRequest, NextResponse } from 'next/server';

// Use Node.js runtime instead of Edge to support https.Agent
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Code is required' },
        { status: 400 }
      );
    }

    const ngrokUrl = process.env.LEAN_COMPILER_URL || "https://29124516e35e.ngrok-free.app";

    // Import https module for Node.js runtime
    const https = await import('https');
    const agent = new https.Agent({
      rejectUnauthorized: false
    });

    // Create custom fetch with the agent
    const nodeFetch = (await import('node-fetch')).default;

    // Step 1: Establish session with ngrok (bypass interstitial)
    await nodeFetch(ngrokUrl, {
      method: 'GET',
      agent: agent as any
    });

    // Step 2: Compile the Lean code
    const response = await nodeFetch(`${ngrokUrl}/compile-lean`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
      agent: agent as any
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    return NextResponse.json({
      success: result.exit_code === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exit_code
    });

  } catch (error) {
    console.error('Lean compilation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
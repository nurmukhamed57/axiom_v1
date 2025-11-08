import { NextRequest, NextResponse } from 'next/server';

const RAG_SERVER_URL = process.env.RAG_SERVER_URL || 'http://localhost:5001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, k = 5 } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Call Python RAG server
    const response = await fetch(`${RAG_SERVER_URL}/retrieve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, k }),
    });

    if (!response.ok) {
      throw new Error(`RAG server error: ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('RAG API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Health check - forward to RAG server
    const response = await fetch(`${RAG_SERVER_URL}/health`);
    const data = await response.json();

    return NextResponse.json({
      status: 'ok',
      rag_server: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'RAG server not available',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

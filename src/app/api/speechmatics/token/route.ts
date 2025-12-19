import { NextResponse } from 'next/server';

const SPEECHMATICS_API_KEY = process.env.SPEECHMATICS_API_KEY;
const TOKEN_ENDPOINT = 'https://mp.speechmatics.com/v1/api_keys?type=rt';
const TOKEN_TTL = 300; // 5 minutes

export async function GET() {
  if (!SPEECHMATICS_API_KEY) {
    console.error('[Speechmatics Token] API key not configured');
    return NextResponse.json(
      { error: 'Speechmatics API key not configured' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SPEECHMATICS_API_KEY}`,
      },
      body: JSON.stringify({ ttl: TOKEN_TTL }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Speechmatics Token] Failed to get token:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to generate Speechmatics token', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ token: data.key_value });
  } catch (error) {
    console.error('[Speechmatics Token] Exception:', error);
    return NextResponse.json(
      { error: 'Failed to generate Speechmatics token' },
      { status: 500 }
    );
  }
}


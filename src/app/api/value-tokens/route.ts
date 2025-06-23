import { NextRequest, NextResponse } from 'next/server';
import mockData from '@/data/mockData';

// GET handler for value tokens (mock or real)
export async function GET(request: NextRequest) {
  try {
    // Return mock value tokens
    return NextResponse.json(mockData.valueTokens);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch value tokens' }, { status: 500 });
  }
}

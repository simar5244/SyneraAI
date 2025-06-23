import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// This endpoint is for testing the Claude API integration
export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }
    
    // Initialize Claude client
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
    if (!CLAUDE_API_KEY) {
      throw new Error('CLAUDE_API_KEY environment variable is not set');
    }
    
    const anthropic = new Anthropic({
      apiKey: CLAUDE_API_KEY,
    });
    
    // Call Claude API
    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: query
        }
      ],
      temperature: 0.7,
    });
    
    // Extract text from the response content
    const responseText = response.content[0].type === 'text' 
      ? response.content[0].text 
      : 'I could not generate a proper response.';
    
    return NextResponse.json({ 
      response: responseText,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error in Claude test:', error);
    return NextResponse.json({
      error: 'An unexpected error occurred',
      details: error.message,
      response: "I'm sorry, I encountered an error while processing your query."
    }, { status: 500 });
  }
} 
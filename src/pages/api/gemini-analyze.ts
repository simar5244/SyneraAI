import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '@/lib/auth';
import axios from 'axios';

// Define response types
type GeminiResponse = {
  result?: any;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GeminiResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const userData = await verifyToken(token);

    if (!userData || !userData.email) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Extract request data
    const { prompt, companyCode } = req.body;

    if (!prompt || !companyCode) {
      return res.status(400).json({ 
        error: 'Invalid request: prompt and companyCode are required' 
      });
    }

    // Get Gemini API key from environment
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    // Call Gemini API
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 1024
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // Return the Gemini API response
    return res.status(200).json({ result: response.data });
  } catch (error: any) {
    console.error('Gemini API error:', error);
    return res.status(500).json({ 
      error: `Server error: ${error.message}` 
    });
  }
}

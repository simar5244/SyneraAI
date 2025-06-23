import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '@/lib/auth';

type UserData = {
  email: string;
  name: string;
  role: string;
  companyCode: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UserData | { error: string }>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Received request to /api/auth/me');
    
    // Check for authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Missing or invalid authorization header');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    console.log('Verifying token...');
    
    // Verify the token
    const userData = await verifyToken(token);
    
    if (!userData || !userData.email) {
      console.log('Invalid token or missing email');
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    console.log('User authenticated:', userData.email);
    
    // Return user data
    return res.status(200).json({
      email: userData.email,
      name: userData.name || '',
      role: userData.role || 'user',
      companyCode: userData.companyCode || ''
    });
  } catch (error: any) {
    console.error('Error in /api/auth/me endpoint:', error);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}

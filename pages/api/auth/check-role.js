import { verifyAuth } from '../../../src/lib/auth';

export default async function handler(req, res) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        authenticated: false,
        message: 'Authorization header missing or malformed' 
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Verify the token
    const user = await verifyAuth(token);
    
    if (!user) {
      return res.status(401).json({ 
        authenticated: false,
        message: 'Invalid or expired token' 
      });
    }
    
    // Return user information including role
    return res.status(200).json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        company: user.company,
        companyCode: user.companyCode
      }
    });
  } catch (error) {
    console.error('Error in auth check:', error);
    return res.status(500).json({ 
      authenticated: false,
      message: 'Server error during authentication check',
      error: error.message
    });
  }
} 
import { verifyToken } from '../../../src/lib/auth';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  try {
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    // Extract only the necessary user information to send back
    const user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      company: decoded.company,
      companyCode: decoded.companyCode
    };
    
    return res.status(200).json({ authenticated: true, user });
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 
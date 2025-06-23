import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

// Custom JWT payload interface
interface CustomJwtPayload {
  userId: string;
  id?: string;
  role?: string;
  email?: string;
  isMfaSession?: boolean;
  iat?: number;
  exp?: number;
}

// Get JWT secret from environment or use fallback
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn('WARNING: JWT_SECRET is not set in environment variables. Using fallback secret.');
    return 'supersecureorganizationgalaxykey2024'; // Fallback secret
  }
  return secret;
}

// Verify JWT token
export function verifyJwtToken(token: string): CustomJwtPayload | null {
  try {
    if (!token) return null;
    
    const decoded = jwt.verify(token, getJwtSecret()) as CustomJwtPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// Extract and verify token from request
export async function verifyToken(req: NextRequest) {
  try {
    // Extract token from Authorization header or cookie
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : req.cookies.get('token')?.value;
    
    if (!token) {
      return null;
    }
    
    // Verify the token
    const user = verifyJwtToken(token);
    
    // For this simple auth utility, we're just returning the payload
    // In a real-world scenario, you might want to fetch the full user from the database
    return user;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
} 
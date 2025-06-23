// Edge-compatible JWT verification utilities
import { jwtVerify, SignJWT } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'organization-galaxy-secret-key';
const JWT_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Interface for verified token payload
 */
export interface EdgeVerifiedTokenPayload {
  id: string;
  userId?: string;
  email?: string;
  role: string;
  companyCode?: string;
  company?: string;
  [key: string]: any;
}

/**
 * Verify JWT token - Edge runtime compatible
 * @param token JWT token to verify
 * @returns Token payload or null if invalid
 */
export async function verifyEdgeToken(token: string): Promise<EdgeVerifiedTokenPayload | null> {
  if (!token) return null;
  
  try {
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secretKey);
    
    // Type cast and normalize payload
    const result = payload as EdgeVerifiedTokenPayload;
    
    // Ensure id is set
    if (!result.id && result.userId) {
      result.id = result.userId;
    } else if (!result.userId && result.id) {
      result.userId = result.id;
    }
    
    // Validate essential fields
    if (!result.id || !result.role) {
      console.error('Token missing required fields (id or role)');
      return null;
    }
    
    return result;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

/**
 * Create a JWT token - Edge runtime compatible
 * @param payload Data to include in the token
 * @returns Signed JWT token
 */
export async function createEdgeToken(payload: Partial<EdgeVerifiedTokenPayload>): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(JWT_SECRET);
  
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + JWT_EXPIRES_IN)
    .sign(secretKey);
} 
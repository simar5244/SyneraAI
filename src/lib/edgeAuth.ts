// Edge-compatible JWT verification utilities
import { jwtVerify, SignJWT } from 'jose';
import { JwtPayload } from 'jsonwebtoken';
import { VerifiedTokenPayload } from './auth';

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
  
  const jwt = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + JWT_EXPIRES_IN)
    .sign(secretKey);
    
  return jwt;
}

/**
 * Verify auth token and return payload - WORKS IN BOTH NODE.JS AND EDGE
 * Ensures the returned payload includes id, userId, and role.
 * @param token JWT token to verify
 * @returns Decoded and normalized token payload or null if invalid/missing required fields
 */
export async function verifyAuth(token: string): Promise<VerifiedTokenPayload | null> {
  try {
    // For Edge Runtime, use the edge-compatible verifier
    if (typeof process === 'undefined' || process.env.NEXT_RUNTIME === 'edge') {
      return await verifyEdgeToken(token) as VerifiedTokenPayload;
    }
    
    // For Node.js runtime
    let decoded: JwtPayload;
    try {
      const { verify } = await import('jsonwebtoken');
      decoded = verify(token, JWT_SECRET) as JwtPayload;
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }

    // Normalize the payload to ensure required fields exist
    const normalized: any = { ...decoded };

    // Ensure id and userId are set and consistent
    if (!normalized.id && normalized.userId) {
      normalized.id = normalized.userId;
    } else if (!normalized.userId && normalized.id) {
      normalized.userId = normalized.id;
    }

    // Ensure required fields exist
    if (!normalized.id || !normalized.role) {
      console.error('Token missing required fields (id or role)');
      return null;
    }

    // Handle company code aliases
    if (!normalized.companyCode) {
      if (normalized.company_code) {
        normalized.companyCode = normalized.company_code;
      } else if (normalized.organizationCode) {
        normalized.companyCode = normalized.organizationCode;
      }
      // Do not perform DB lookup here to avoid CastErrors; require token to include companyCode or company_code
    }

    return normalized as VerifiedTokenPayload;
  } catch (error) {
    console.error('Auth verification failed unexpectedly:', error);
    return null;
  }
}
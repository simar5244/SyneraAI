// src/lib/auth.ts
import { SignOptions, sign, verify, JwtPayload } from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { NextAuthOptions, DefaultSession, DefaultUser } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import connectDB from '@/lib/dbConnect';
import User, { getUserModel } from '@/models/User';
import { verifyEdgeToken, EdgeVerifiedTokenPayload } from './edgeAuth';

/**
 * Authentication Utilities
 * 
 * Functions for generating and verifying JWT tokens.
 */

// In a real app, these would be stored in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'organization-galaxy-secret-key';

// Parse JWT expiration time from environment or use default (7 days in seconds)
const parseJwtExpiresIn = (): number => {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const value = parseInt(expiresIn);
  
  if (expiresIn.endsWith('d')) return value * 24 * 60 * 60; // days to seconds
  if (expiresIn.endsWith('h')) return value * 60 * 60; // hours to seconds
  if (expiresIn.endsWith('m')) return value * 60; // minutes to seconds
  return value || 60 * 60 * 24 * 7; // default to 7 days if invalid
};

const JWT_EXPIRES_IN = parseJwtExpiresIn();

interface TokenPayload extends JwtPayload {
  id: string;
  userId?: string;
  email: string;
  role: string;
  company?: string;
  companyCode?: string;
  tier?: number;
  notificationPreferences?: {
    email: boolean;
    browser: boolean;
    types: {
      system: boolean;
      project: boolean;
      mention: boolean;
      task: boolean;
    };
  };
  [key: string]: unknown;
}

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role?: string;
      tier?: number;
      notificationPreferences?: TokenPayload['notificationPreferences'];
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    id: string;
    role?: string;
    tier?: number;
    notificationPreferences?: TokenPayload['notificationPreferences'];
  }
}

// Define the structure of the payload returned by verifyAuth
// This is the payload structure that API routes and middleware will receive
export interface VerifiedTokenPayload {
  id: string; // Primary identifier expected by consumers
  userId?: string; // Keep for compatibility if needed
  role: string; // Role is expected to be present after verification
  organizationId?: string; // Organization ID is now optional
  company?: string; // Company is optional
  companyCode?: string; // Company code
  email?: string; // Add other fields if they are in the token and needed
  [key: string]: any;
}

/**
 * Generate a JWT token
 * @param payload Data to include in the token
 * @param options Additional JWT sign options
 * @returns Signed JWT token
 */
export const generateToken = (payload: Omit<Partial<TokenPayload>, 'exp' | 'iat'>, options?: SignOptions): string => {
  // Create a new options object to avoid mutating the original
  const signOptions: SignOptions = {
    ...options,
  };
  
  // Only set expiresIn if it's not already set in options
  if (!signOptions.expiresIn) {
    // Use the pre-parsed JWT_EXPIRES_IN value (already in seconds)
    signOptions.expiresIn = JWT_EXPIRES_IN;
  }
  
  return sign(payload as JwtPayload, JWT_SECRET, signOptions);
};

/**
 * Verify a JWT token - ONLY USE IN NODE.JS ENVIRONMENT, NOT IN EDGE
 * @param token JWT token to verify
 * @returns Decoded token payload or null if invalid
 */
export const verifyToken = (token: string): TokenPayload | null => {
  try {
    // Only use this in Node.js environment, NOT in Edge Runtime
    try {
      return verify(token, JWT_SECRET) as TokenPayload;
    } catch (err: unknown) {
      // If token expired, ignore expiration to allow seamless access
      if (err instanceof Error && 'name' in err && err.name === 'TokenExpiredError') {
        console.warn('Token expired, proceeding by ignoring expiration:', err);
        return verify(token, JWT_SECRET, { ignoreExpiration: true }) as TokenPayload;
      } else {
        console.error('Token verification failed:', err);
        return null;
      }
    }
  } catch (error) {
    console.error('Token verification failed unexpectedly:', error);
    return null;
  }
};

// verifyAuth is now imported directly from edgeAuth.ts

/**
 * Refresh user data from database (ONLY IN NODE.JS, never in Edge)
 * @param userId User ID
 * @param companyCode Company code
 * @returns Updated user data or null if not found
 */
export const refreshUserFromDb = async (userId: string, companyCode?: string) => {
  const { MongoClient, ObjectId } = require('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    
    // Determine which database to use
    const dbName = companyCode ? `company_${companyCode}` : 'org_sim_db';
    const db = client.db(dbName);
    const usersCollection = db.collection('users');
    
    // Build query to find user by ID or email
    const query = {
      $or: [
        { _id: ObjectId.isValid(userId) ? new ObjectId(userId) : null },
        { userId },
        { email: userId }
      ].filter(Boolean)
    };
    
    // Execute query and exclude password field
    const user = await usersCollection.findOne(query, { projection: { password: 0 } });
    return user;
  } catch (err) {
    console.error('Error fetching user data:', err);
    return null;
  }
};

/**
 * Extract user information from an HTTP request
 * @param req Next.js API request
 * @returns User data from token, or null if unauthorized
 */
export const getUserFromRequest = (req: Request): TokenPayload | null => {
  // Get authorization header
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  // Extract token
  const token = authHeader.split(' ')[1];
  
  // Verify token
  return verifyToken(token);
};

/**
 * Check if user has required role
 * @param user User object from token
 * @param requiredRoles Roles that are allowed to access the resource
 * @returns Boolean indicating if user has required role
 */
export const hasRole = (user: TokenPayload | null, requiredRoles: string[]): boolean => {
  if (!user || !user.role) {
    return false;
  }
  
  return requiredRoles.includes(user.role);
};

// Generate random token for 2FA, password reset, etc.
export const generateRandomToken = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Auth middleware for API routes (NOT EDGE) - use in route handlers
export const authMiddleware = async (req: NextRequest) => {
  try {
    const token = req.cookies.get('token')?.value || 
                 (req.headers.get('authorization') || '').replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the token
    const decoded = await (await import('./edgeAuth')).verifyAuth(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // For Node.js environment, refresh user data from database
    if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME !== 'edge') {
      const updatedUser = await refreshUserFromDb(decoded.id, decoded.companyCode);
      if (updatedUser) {
        decoded.role = updatedUser.role;
        decoded.company = updatedUser.company;
        decoded.companyCode = updatedUser.companyCode;
      }
    }

    // Attach user to request for use in route handler
    Object.defineProperty(req, 'user', {
      value: decoded,
      enumerable: true,
      configurable: true
    });
    
    return null; // Continue to route handler
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
};




// Extend the Next.js request type
declare module 'next' {
  interface NextApiRequest {
    user?: TokenPayload;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials) return null;
        
        // Find user by email
        const user = await User.findOne({ email: credentials.email });
        
        // Check if user exists and password matches
        if (user && user.password === credentials.password) {
          // In production, you'd use proper password comparison with bcrypt
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            tier: user.tier,
          };
        }
        
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Add custom user properties to the token
        return {
          ...token,
          id: user.id,
          role: user.role,
          tier: user.tier,
          notificationPreferences: {
            email: true,
            browser: true,
            types: {
              system: true,
              project: true,
              mention: true,
              task: true,
            },
          },
        };
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // Add custom token properties to the session
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.tier = token.tier as number;
        if (token.notificationPreferences) {
          session.user.notificationPreferences = token.notificationPreferences as TokenPayload['notificationPreferences'];
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key',
};

// Re-exports are now handled at the top of the file

// Get session from request
export async function getSession(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  
  try {
    const payload = await (await import('./edgeAuth')).verifyAuth(token);
    if (!payload) return null;
    
    return {
      user: {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        company: payload.company,
        companyCode: payload.companyCode,
      },
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  } catch (error) {
    console.error('Error in getSession:', error);
    return null;
  }
}
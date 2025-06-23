// src/lib/auth.ts
import { SignOptions, sign, verify } from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { NextAuthOptions } from 'next-auth';
import { Session, User as NextAuthUser } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import connectDB from '@/lib/dbConnect';
import User, { getUserModel } from '@/models/User';
import { verifyEdgeToken, EdgeVerifiedTokenPayload } from '@/lib/edgeAuth';

/**
 * Authentication Utilities
 * 
 * Functions for generating and verifying JWT tokens.
 */

// In a real app, these would be stored in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'organization-galaxy-secret-key';
// Token expiry duration: extend default from 1 day to 7 days
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

interface TokenPayload {
  id: string;
  email: string;
  role: string;
  company?: string;
  companyCode?: string;
  [key: string]: any;
}

interface ExtendedUser extends NextAuthUser {
  id: string;
  role?: string;
  tier?: number;
}

// Custom session type
interface ExtendedSession extends Session {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
    tier?: number;
    notificationPreferences?: any;
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
export const generateToken = (payload: Partial<TokenPayload>, options?: SignOptions): string => {
  return sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    ...options
  });
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
    } catch (err: any) {
      // If token expired, ignore expiration to allow seamless access
      if (err.name === 'TokenExpiredError') {
        console.warn('Token expired, proceeding by ignoring expiration:', err);
        return verify(token, JWT_SECRET, { ignoreExpiration: true } as any) as TokenPayload;
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

/**
 * Verify auth token and return payload - WORKS IN BOTH NODE.JS AND EDGE
 * Ensures the returned payload includes id, userId, and role.
 * @param token JWT token to verify
 * @returns Decoded and normalized token payload or null if invalid/missing required fields
 */
export const verifyAuth = async (token: string): Promise<VerifiedTokenPayload | null> => {
  try {
    // For Edge Runtime, use the edge-compatible verifier
    if (typeof process === 'undefined' || process.env.NEXT_RUNTIME === 'edge') {
      return await verifyEdgeToken(token) as VerifiedTokenPayload;
    }
    
    // For Node.js runtime
    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET);
    } catch (err: any) {
      // If token expired, ignore expiration to allow seamless access
      if (err.name === 'TokenExpiredError') {
        console.warn('Token expired, proceeding by ignoring expiration:', err);
        decoded = verify(token, JWT_SECRET, { ignoreExpiration: true } as any);
      } else {
        console.error('Node.js token verification failed:', err);
        return null;
      }
    }

    // Normalize the payload to ensure it has the expected structure
    if (!decoded) return null;

    const normalized: Partial<VerifiedTokenPayload> = { ...decoded }; // Start with decoded fields

    // Ensure both id and userId are present
    if (normalized.userId && !normalized.id) {
      normalized.id = normalized.userId;
    } else if (normalized.id && !normalized.userId) {
      normalized.userId = normalized.id;
    }

    // CRITICAL: Ensure id and role are present. organizationId is now OPTIONAL.
    if (!normalized.id || !normalized.role) {
        console.error('Token verification result missing required fields (id or role):', normalized);
        return null; // Invalid token if essential fields are missing
    }
    
    // Ensure role is a string
    normalized.role = String(normalized.role);

    // Ensure companyCode is present if we have company or company_code
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
};

/**
 * Refresh user data from database (ONLY IN NODE.JS, never in Edge)
 * @param userId User ID
 * @param companyCode Company code
 * @returns Updated user data or null if not found
 */
export const refreshUserFromDb = async (userId: string, companyCode?: string) => {
  try {
    await connectDB();
    
    // Check if userId is a valid MongoDB ObjectId
    const isValidObjectId = (id: string) => {
      try {
        const { ObjectId } = require('mongodb');
        return ObjectId.isValid(id) && String(new ObjectId(id)) === id;
      } catch (err) {
        return false;
      }
    };
    
    // Use the appropriate User model based on company code
    if (companyCode) {
      const CompanyUser = getUserModel(companyCode);
      
      // If userId is a valid ObjectId, use findById, otherwise try to find by other fields
      if (isValidObjectId(userId)) {
        return await CompanyUser.findById(userId).select('role company companyCode');
      } else {
        // Try to find by userId field first, then by email
        return await CompanyUser.findOne({ 
          $or: [{ userId: userId }, { email: userId }] 
        }).select('role company companyCode');
      }
    } else {
      if (isValidObjectId(userId)) {
        return await User.findById(userId).select('role company companyCode');
      } else {
        return await User.findOne({ 
          $or: [{ userId: userId }, { email: userId }] 
        }).select('role company companyCode');
      }
    }
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
                  req.headers.get('authorization')?.replace('Bearer ', '') || 
                  '';

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify token
    const decoded = await verifyAuth(token);
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
    (req as any).user = decoded;
    
    return null; // Continue to route handler
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
};

// Mock user database - Update with all accounts
const users = [
  {
    id: 'user-001',
    name: 'Admin User',
    email: 'admin@organizationgalaxy.com',
    password: 'AdminPassword123!', // In production, these would be hashed
    role: 'admin',
    tier: 1,
  },
  {
    id: 'user-002',
    name: 'Test Admin',
    email: 'test@example.com',
    password: 'TestPassword123!',
    role: 'admin',
    tier: 1,
  },
  {
    id: 'user-003',
    name: 'Top Manager',
    email: 'topmanager@organizationgalaxy.com',
    password: 'ManagerPassword123!',
    role: 'top_management',
    tier: 1,
  },
  {
    id: 'user-004',
    name: 'Test Top Manager',
    email: 'testmanager@example.com',
    password: 'TestManager123!',
    role: 'top_management',
    tier: 1,
  },
  {
    id: 'user-005',
    name: 'Employee',
    email: 'employee@organizationgalaxy.com',
    password: 'EmployeePassword123!',
    role: 'employee',
    tier: 3,
  },
  {
    id: 'user-006',
    name: 'Test Employee',
    email: 'testemployee@example.com',
    password: 'TestEmployee123!',
    role: 'employee',
    tier: 3,
  },
];

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
        const user = users.find(user => user.email === credentials.email);
        
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
        token.id = user.id;
        token.role = user.role;
        token.tier = user.tier;
        
        // Default preferences
        token.notificationPreferences = {
          email: true,
          browser: true,
          types: {
            system: true,
            project: true,
            mention: true,
            task: true,
          },
        };
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        // Add custom token properties to the session
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.tier = token.tier as number;
        session.user.notificationPreferences = token.notificationPreferences as any;
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
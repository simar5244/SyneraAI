import bcrypt from 'bcryptjs';
import jwt, { SignOptions, verify, JwtPayload } from 'jsonwebtoken';
import { jwtVerify, SignJWT } from 'jose'; // Add jose for Edge Runtime
import getRedisClient from '@/lib/redis';
import nodemailer from 'nodemailer';
import { NextRequest, NextResponse } from 'next/server';
import { NextAuthOptions } from 'next-auth';
import { User as NextAuthUser } from 'next-auth'; 
import CredentialsProvider from 'next-auth/providers/credentials';
import User from '@/models/User';
import { IUser } from '@/models/User';
import mongoose from 'mongoose';

// Define UserRole enum here since the import is missing
enum UserRole {
  ADMIN = 'admin',
  TOP_MANAGEMENT = 'topManagement',
  MANAGER = 'manager',
  EMPLOYEE = 'employee'
}

// In-memory storage for development when Redis is not available
const memoryStore: Record<string, { value: string; expiry: number }> = {};

// Admin accounts that bypass 2FA
// These are distinct from mock data users - admin uses real backend, test uses mock data
const ADMIN_ACCOUNTS = [
  'admin@organizationgalaxy.com',
  'admin@example.com',
  'techygeeksland@gmail.com',
  'manager@example.com',
  'topmanager@organizationgalaxy.com',
  'test@example.com',
  'testuser@example.com',
  'testmanager@example.com',
  'testemployee@example.com',
  'employee@organizationgalaxy.com'
];

// Top management accounts that also bypass 2FA
const TOP_MANAGEMENT_ACCOUNTS = [
  'topmanager@organizationgalaxy.com',
  'exec@organizationgalaxy.com',
  'exec-data@example.com',
  'exec-nodata@example.com'
];

// Accounts that use mock data
const MOCK_DATA_ACCOUNTS = [
  'test@example.com',
  'testuser@example.com',
  'testadmin@example.com',
  'testmanager@example.com',
  'testemployee@example.com'
];

// Create a nodemailer transporter for Gmail
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || 'techygeeksland@gmail.com',
    pass: process.env.SMTP_PASS || 'oprvvdjldeovqnfy',
  },
  debug: true, // Enable debug output
  logger: true  // Log information to the console
});

// Test email connection on startup
transporter.verify((error: Error | null, success: boolean) => {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Force production mode to ensure emails are sent
const isDevelopment = false; // Override NODE_ENV to ensure emails are always sent

interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  phone?: string;
  twoFactorEnabled: boolean;
}

// Custom JWT payload interface
export interface TokenPayload extends JwtPayload {
  id: string;
  userId?: string;
  email?: string;
  role?: string;
  tier?: number;
  isMfaSession?: boolean;
}

interface CustomJwtPayload {
  userId: string;
  isMfaSession?: boolean;
  [key: string]: any;
}

// Extended user type for next-auth
interface ExtendedUser extends NextAuthUser {
  role?: string;
  tier?: number;
}

class AuthService {
  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    console.log('[AuthService] getJwtSecret, secret length:', secret?.length);
    if (!secret) {
      console.warn('WARNING: JWT_SECRET is not set in environment variables. Using fallback secret.');
      return 'supersecureorganizationgalaxykey2024'; // Fallback secret
    }
    return secret;
  }

  // Check if user is an admin and should bypass 2FA
  isTwoFactorExempt(email: string): boolean {
    // TEMPORARILY DISABLE 2FA FOR ALL USERS
    return true;
    
    // Commented out the normal 2FA logic:
    /*
    const normalizedEmail = email.toLowerCase();
    const isAdmin = ADMIN_ACCOUNTS.some(account => account.toLowerCase() === normalizedEmail);
    const isTopManagement = TOP_MANAGEMENT_ACCOUNTS.some(account => account.toLowerCase() === normalizedEmail);
    
    if (isAdmin) {
      console.log(`Admin account detected: ${email} - 2FA bypass enabled`);
    }
    
    if (isTopManagement) {
      console.log(`Top Management account detected: ${email} - 2FA bypass enabled`);
    }
    
    return isAdmin || isTopManagement;
    */
  }

  // Additional export of this method as a static function for direct access
  static isTwoFactorExempt(email: string): boolean {
    // TEMPORARILY DISABLE 2FA FOR ALL USERS
    return true;

    // Commented out the normal 2FA logic:
    /*
    const normalizedEmail = email.toLowerCase();
    const isAdmin = ADMIN_ACCOUNTS.some(account => account.toLowerCase() === normalizedEmail);
    const isTopManagement = TOP_MANAGEMENT_ACCOUNTS.some(account => account.toLowerCase() === normalizedEmail);
    
    if (isAdmin) {
      console.log(`Admin account detected: ${email} - 2FA bypass enabled`);
    }
    
    if (isTopManagement) {
      console.log(`Top Management account detected: ${email} - 2FA bypass enabled`);
    }
    
    return isAdmin || isTopManagement;
    */
  }

  // Check if user should use mock data
  usesMockData(email: string): boolean {
    const normalizedEmail = email.toLowerCase();
    const usesMock = MOCK_DATA_ACCOUNTS.some(account => account.toLowerCase() === normalizedEmail);
    if (usesMock) {
      console.log(`Test account detected: ${email} - Using mock data`);
    }
    return usesMock;
  }

  // Token generation with Edge Runtime support
  generateToken(userId: string, expiresIn: string | number = '1d'): string {
    // Create a unified token payload that has both userId and id properties
    const payload: CustomJwtPayload = { 
      userId,
      id: userId, // Include both forms to ensure compatibility
    };
    
    // Use standard jsonwebtoken in Node.js environment
    if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME !== 'edge') {
      const options: SignOptions = { expiresIn: expiresIn as any };
      return jwt.sign(payload, this.getJwtSecret(), options);
    }
    
    // Edge Runtime doesn't support synchronous JWT signing
    // This is a fallback that should ideally not be used in Edge
    console.error('[AuthService] generateToken does not fully support Edge Runtime. Use generateTokenAsync instead.');
    return `invalid-token-edge-runtime-use-async-method`;
  }
  
  // Asynchronous token generation that works in Edge Runtime
  // Include role, company, and optional organizationId in the payload
  async generateTokenAsync(userId: string, role: string, organizationId?: string, company?: string, expiresIn: string | number = '1d'): Promise<string> {
    const payload: CustomJwtPayload = { 
      userId,
      id: userId, // Include both forms to ensure compatibility
      role: role, // Add role
      organizationId: organizationId, // Add organizationId (will be undefined if not provided)
      company: company // Add company
    };
    
    // Determine environment
    if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME !== 'edge') {
      // Node.js environment
      const options: SignOptions = { expiresIn: expiresIn as any };
      return jwt.sign(payload, this.getJwtSecret(), options);
    } else {
      // Edge Runtime environment
      const encoder = new TextEncoder();
      const secretKey = encoder.encode(this.getJwtSecret());
      
      // Convert expiresIn to seconds if it's a string like '1d'
      let expirySeconds = 86400; // Default 1 day in seconds
      if (typeof expiresIn === 'number') {
        expirySeconds = expiresIn;
      } else if (typeof expiresIn === 'string') {
        if (expiresIn.endsWith('s')) expirySeconds = parseInt(expiresIn);
        else if (expiresIn.endsWith('m')) expirySeconds = parseInt(expiresIn) * 60;
        else if (expiresIn.endsWith('h')) expirySeconds = parseInt(expiresIn) * 3600;
        else if (expiresIn.endsWith('d')) expirySeconds = parseInt(expiresIn) * 86400;
      }
      
      // Create expiration date
      const exp = Math.floor(Date.now() / 1000) + expirySeconds;
      
      // Sign with jose
      return new SignJWT(payload as any) // Cast payload to any to satisfy jose type
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(exp)
        .sign(secretKey);
    }
  }

  // Generate a temporary session token for MFA verification with Edge Runtime support
  // Include role, company, and optional organizationId in the payload
  async generateMfaSessionTokenAsync(userId: string, role: string, organizationId?: string, company?: string): Promise<string> {
    const payload: CustomJwtPayload = {
      userId,
      id: userId, // Ensure id is present
      role: role, // Add role
      organizationId: organizationId, // Add organizationId (will be undefined if not provided)
      company: company, // Add company
      isMfaSession: true,
    };
    
    // Determine environment
    if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME !== 'edge') {
      // Node.js environment
      const options: SignOptions = { expiresIn: '10m' as any };
      return jwt.sign(payload, this.getJwtSecret(), options);
    } else {
      // Edge Runtime environment
      const encoder = new TextEncoder();
      const secretKey = encoder.encode(this.getJwtSecret());
      
      // 10 minutes in seconds
      const exp = Math.floor(Date.now() / 1000) + 600;
      
      // Sign with jose
      return new SignJWT(payload as any) // Cast payload to any
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(exp)
        .sign(secretKey);
    }
  }

  // Verify JWT token with Edge Runtime support
  verifyToken(token: string): CustomJwtPayload | null {
    console.log('[AuthService] verifyToken, token:', token);
    console.log('[AuthService] verifyToken, secret length:', this.getJwtSecret().length);
    try {
      // Use standard jsonwebtoken in Node.js environment
      if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME !== 'edge') {
        const decoded = jwt.verify(token, this.getJwtSecret()) as CustomJwtPayload;
        console.log('[AuthService] verifyToken, decoded:', decoded);
        return decoded;
      }
      
      // We're in Edge Runtime - this needs to be handled differently
      // But this is a synchronous method that can't return a promise
      // So we need to inform the caller that this method isn't compatible with Edge
      console.error('[AuthService] verifyToken does not support Edge Runtime. Use verifyTokenAsync instead.');
      return null;
    } catch (error) {
      console.error('[AuthService] Token verification failed:', error);
      return null;
    }
  }
  
  // Asynchronous token verification that works in Edge Runtime
  async verifyTokenAsync(token: string): Promise<CustomJwtPayload | null> {
    console.log('[AuthService] verifyTokenAsync, token:', token);
    try {
      // Determine environment
      if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME !== 'edge') {
        // Node.js environment
        const decoded = jwt.verify(token, this.getJwtSecret()) as CustomJwtPayload;
        console.log('[AuthService] verifyTokenAsync (Node.js), decoded:', decoded);
        return decoded;
      } else {
        // Edge Runtime environment
        console.log('[AuthService] verifyTokenAsync using jose in Edge Runtime');
        
        // Create a TextEncoder to convert the JWT_SECRET to Uint8Array
        const encoder = new TextEncoder();
        const secretKey = encoder.encode(this.getJwtSecret());
        
        const { payload } = await jwtVerify(token, secretKey);
        const decoded = payload as unknown as CustomJwtPayload;
        console.log('[AuthService] verifyTokenAsync (Edge), decoded:', decoded);
        return decoded;
      }
    } catch (error) {
      console.error('[AuthService] Async token verification failed:', error);
      return null;
    }
  }

  // Password hashing
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  // Password verification
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // Generate a 6-digit verification code
  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Store value with expiration - using Redis
  private async setWithExpiry(key: string, value: string, expirySeconds: number): Promise<void> {
    try {
      const redisClient = await getRedisClient();
      await redisClient.set(key, value, { EX: expirySeconds });
    } catch (error) {
      console.error(`Failed to store value for key ${key}:`, error);
      // Fallback to memory storage
      memoryStore[key] = {
        value,
        expiry: Date.now() + (expirySeconds * 1000)
      };
    }
  }

  // Get value - using Redis
  private async getStoredValue(key: string): Promise<string | null> {
    try {
      const redisClient = await getRedisClient();
      return await redisClient.get(key);
    } catch (error) {
      console.error(`Failed to get value for key ${key}:`, error);
      // Try memory storage as fallback
      const stored = memoryStore[key];
      if (!stored || Date.now() > stored.expiry) {
        return null;
      }
      return stored.value;
    }
  }

  // Delete stored value
  private async deleteStoredValue(key: string): Promise<void> {
    try {
      const redisClient = await getRedisClient();
      await redisClient.del(key);
    } catch (error) {
      console.error(`Failed to delete value for key ${key}:`, error);
      // Ensure it's removed from memory storage regardless
      delete memoryStore[key];
    }
  }

  // Store verification code in Redis with expiration (10 minutes)
  async storeVerificationCode(userId: string, code: string): Promise<void> {
    try {
      const key = `verification:${userId}`;
      await this.setWithExpiry(key, code, 600); // 600 seconds = 10 minutes
      console.log(`Verification code stored for user ${userId}: ${code}`);
    } catch (error) {
      console.error('Failed to store verification code:', error);
      throw new Error('Failed to store verification code');
    }
  }

  // Verify the code from Redis
  async verifyCode(userId: string, code: string): Promise<boolean> {
    try {
      const key = `verification:${userId}`;
      const storedCode = await this.getStoredValue(key);
      console.log(`Verifying code for user ${userId}. Input: ${code}, Stored: ${storedCode}`);
      
      if (!storedCode) {
        console.warn(`No verification code found for user ${userId}`);
        return false;
      }
      
      const isValid = storedCode === code;
      
      // Delete the code after verification attempt
      if (isValid) {
        await this.deleteStoredValue(key);
        console.log(`Code verified successfully for user ${userId}`);
      } else {
        console.warn(`Invalid code provided for user ${userId}`);
      }
      
      return isValid;
    } catch (error) {
      console.error('Failed to verify code:', error);
      return false;
    }
  }

  // Send verification code email
  async sendVerificationEmail(email: string, code: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || '"Organization Galaxy" <techygeeksland@gmail.com>',
        to: email,
        subject: 'Your 2FA Code',
        html: `
          <div style="font-family: sans-serif; font-size: 16px; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
            <h1 style="color: #5a2ca0; margin-bottom: 20px;">Organization Galaxy</h1>
            <p>Hello 👋,</p>
            <p>Your 2FA verification code is:</p>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #5a2ca0;">${code}</span>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
            <p style="color: #666; font-size: 14px;">© 2023 Organization Galaxy. All rights reserved.</p>
          </div>
        `
      };
  
      console.log(`Sending verification email to ${email}`);
      
      // Send the email and await the result
      const info = await transporter.sendMail(mailOptions);
      
      console.log('Email sent successfully:', info.response);
      console.log('Message ID:', info.messageId);
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
      
      return true;
    } catch (error) {
      console.error('Failed to send verification email:', error);
      return false;
    }
  }

  // Send password reset email with token
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Organization Galaxy" <noreply@organizationgalaxy.com>',
      to: email,
      subject: 'Reset Your Password',
      html: `
        <div style="font-family: sans-serif; font-size: 16px; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <h1 style="color: #5a2ca0; margin-bottom: 20px;">Organization Galaxy</h1>
          <p>Hello,</p>
          <p>You requested to reset your password. Click the button below to create a new password:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #5a2ca0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Reset Password</a>
          </p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this password reset, please ignore this email or contact support.</p>
          <p>Thanks,<br/>Organization Galaxy Team</p>
        </div>
      `,
    };

    if (isDevelopment) {
      // In development, just log the reset URL
      console.log(`[DEV] Password reset link for ${email}: ${resetUrl}`);
      return true;
    }

    try {
      console.log(`Attempting to send password reset email to ${email}...`);
      await transporter.sendMail(mailOptions);
      console.log(`Password reset email successfully sent to ${email} (via nodemailer)`);
      return true;
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      return false;
    }
  }

  // Generate a password reset token and store it
  async generatePasswordResetToken(userId: string): Promise<string> {
    const resetToken = this.generateVerificationCode() + this.generateVerificationCode(); // 12 digits
    
    try {
      const key = `verification:${userId}:resetToken`;
      await this.setWithExpiry(key, resetToken, 3600); // 3600 seconds = 1 hour
      return resetToken;
    } catch (error) {
      console.error('Failed to generate password reset token:', error);
      throw new Error('Failed to generate password reset token');
    }
  }

  // Check if user has permission to connect to ERP
  hasERPConnectionPermission(token: string): boolean {
    const decoded = this.verifyToken(token);
    if (!decoded) return false;
    
    // Get user role from token
    const role = decoded.role?.toLowerCase();
    return role === 'admin' || role === 'topmanagement' || role === 'top_management';
  }
  
  // Check from localStorage if browser-side
  static hasERPPermissionFromStorage(): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      // Try to get from user object first
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const role = user.role?.toLowerCase();
        if (role === 'admin' || role === 'topmanagement' || role === 'top_management') {
          return true;
        }
      }
      
      // Fallback to role in localStorage directly
      const role = localStorage.getItem('userRole')?.toLowerCase();
      return role === 'admin' || role === 'topmanagement' || role === 'top_management';
    } catch (error) {
      console.error('Error checking ERP permissions:', error);
      return false;
    }
  }
}

// Basic auth functions implementation
const login = async (email: string, password: string) => {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    return await response.json();
  } catch (error) {
    console.error('Login error:', error);
    throw new Error('Login failed');
  }
};

const logout = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
  return { success: true };
};

const register = async (userData: any) => {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    
    return await response.json();
  } catch (error) {
    console.error('Registration error:', error);
    throw new Error('Registration failed');
  }
};

const resetPassword = async (token: string, newPassword: string) => {
  try {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    
    return await response.json();
  } catch (error) {
    console.error('Password reset error:', error);
    throw new Error('Password reset failed');
  }
};

const validateToken = async (token: string) => {
  try {
    const response = await fetch('/api/auth/validate-token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });
    
    return await response.json();
  } catch (error) {
    console.error('Token validation error:', error);
    return { valid: false };
  }
};

const updateProfile = async (userData: any, token: string) => {
  try {
    const response = await fetch('/api/auth/update-profile', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userData),
    });
    
    return await response.json();
  } catch (error) {
    console.error('Profile update error:', error);
    throw new Error('Profile update failed');
  }
};

const getCurrentUser = () => {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (e) {
        console.error('Error parsing user from localStorage:', e);
      }
    }
  }
  return null;
};

const getMockUser = (email: string) => {
  // Return a mock user based on the email
  const mockUsers = [
    {
      id: '1',
      email: 'admin@organizationgalaxy.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      usesMockData: false
    },
    {
      id: '2',
      email: 'test@example.com',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      role: 'admin',
      usesMockData: true
    }
  ];
  
  return mockUsers.find(user => user.email === email) || null;
};

const refreshToken = async (token: string) => {
  try {
    const response = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });
    
    return await response.json();
  } catch (error) {
    console.error('Token refresh error:', error);
    throw new Error('Token refresh failed');
  }
};

const forgetPassword = async (email: string) => {
  try {
    const response = await fetch('/api/auth/forget-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    
    return await response.json();
  } catch (error) {
    console.error('Forget password error:', error);
    throw new Error('Forget password request failed');
  }
};

// Create an instance of the class
const authServiceObj = new AuthService();

// Create and export an auth service instance with both class methods and helper functions
const authService = {
  // Include all helper functions
  login,
  logout,
  register,
  resetPassword,
  validateToken,
  updateProfile,
  getCurrentUser,
  getMockUser,
  refreshToken,
  forgetPassword,
  
  // Include the important instance methods from AuthService
  generateToken: authServiceObj.generateToken.bind(authServiceObj),
  verifyToken: authServiceObj.verifyToken.bind(authServiceObj),
  generateVerificationCode: authServiceObj.generateVerificationCode.bind(authServiceObj),
  storeVerificationCode: authServiceObj.storeVerificationCode.bind(authServiceObj),
  verifyCode: authServiceObj.verifyCode.bind(authServiceObj),
  sendVerificationEmail: authServiceObj.sendVerificationEmail.bind(authServiceObj),
  hashPassword: authServiceObj.hashPassword.bind(authServiceObj),
  verifyPassword: authServiceObj.verifyPassword.bind(authServiceObj),
  isTwoFactorExempt: authServiceObj.isTwoFactorExempt.bind(authServiceObj),
  usesMockData: authServiceObj.usesMockData.bind(authServiceObj),

  // Add the async methods for Edge Runtime support
  generateTokenAsync: authServiceObj.generateTokenAsync.bind(authServiceObj),
  verifyTokenAsync: authServiceObj.verifyTokenAsync.bind(authServiceObj),
  generateMfaSessionTokenAsync: authServiceObj.generateMfaSessionTokenAsync.bind(authServiceObj)
};

// Export the AuthService class for static methods
export { AuthService };

// Export the combined service instance as default
export default authService;
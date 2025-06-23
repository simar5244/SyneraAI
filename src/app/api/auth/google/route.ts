import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { generateToken } from '@/lib/auth';
import mongoose from 'mongoose';
import { sendMfaCode } from '@/lib/mfa';

// Mock users for development
const mockUsers = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@organizationgalaxy.com',
    role: 'admin',
  },
  {
    id: '2',
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin',
  }
];

// Handle Google OAuth callback
export async function GET(req: NextRequest) {
  try {
    // In a real implementation, we would use OAuth providers like NextAuth
    // Redirect to the login page with an error if Google Auth is not fully implemented
    const redirectUrl = new URL('/login', req.nextUrl.origin);
    redirectUrl.searchParams.set('status', 'google_auth_required_setup');
    
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Google auth error:', error);
    
    // Redirect to login page with error
    const redirectUrl = new URL('/login', req.nextUrl.origin);
    redirectUrl.searchParams.set('error', 'Failed to authenticate with Google');
    
    return NextResponse.redirect(redirectUrl);
  }
}

// Handle Google authentication from client
export async function POST(request: NextRequest) {
  try {
    // In a real app, this would verify the Google OAuth token
    // For now, let's require 2FA for all Google sign-ins as well
    
    // Generate a mock MFA code for the Google authentication
    const mfaCode = Math.floor(100000 + Math.random() * 900000).toString();
    const mfaSession = crypto.randomUUID();
    
    // Store MFA session (in a real app, this would be in a database)
    const mfaSessions = globalThis as any;
    if (!mfaSessions._googleMfaSessions) {
      mfaSessions._googleMfaSessions = new Map();
    }
    
    mfaSessions._googleMfaSessions.set(mfaSession, {
      userId: 'google_123456789',
      code: mfaCode,
      expires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      userInfo: {
        id: 'google_123456789',
        username: 'googleuser',
        email: 'google@example.com',
        role: 'user'
      }
    });
    
    // In a real app, send the MFA code via email
    console.log(`[DEV] Google auth MFA code: ${mfaCode}`);
    
    // Attempt to send the verification code
    try {
      await sendMfaCode('google@example.com', `Your Google sign-in verification code is: ${mfaCode}`);
    } catch (emailError) {
      console.error('Failed to send MFA code for Google auth:', emailError);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Please verify your Google sign-in with the code sent to your email',
      requireMFA: true,
      mfaSession,
      provider: 'google'
    });
  } catch (error) {
    console.error('Google authentication error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred during Google authentication' },
      { status: 500 }
    );
  }
} 
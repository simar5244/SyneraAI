import { NextRequest, NextResponse } from 'next/server';
import { verifyMfaSession, listActiveSessions } from '@/lib/mfa';
import { generateToken } from '@/lib/auth';
import { getDBConnection } from '@/lib/companyDBConnect';
import { getUserModel } from '@/models/User';
import { getAuthUserModel } from '@/models/AuthUser';
import { getCompanyAuthModel } from '@/models/CompanyAuth';

// Enable debug mode
const DEBUG_MFA = true;

// Mock users from login/route.ts
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

export async function POST(request: NextRequest) {
  try {
    const { mfaCode, mfaSession, provider } = await request.json();

    if (!mfaCode || !mfaSession) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (DEBUG_MFA) {
      console.log(`[MFA-VERIFY] Attempting to verify code ${mfaCode} for session ${mfaSession}`);
      // List all active sessions for debugging
      listActiveSessions();
    }

    // Handle Google OAuth MFA verification
    if (provider === 'google') {
      const mfaSessions = globalThis as any;
      const googleSession = mfaSessions._googleMfaSessions?.get(mfaSession);

      if (!googleSession || 
          googleSession.code !== mfaCode || 
          googleSession.expires < new Date()) {
        return NextResponse.json(
          { success: false, message: 'Invalid or expired verification code' },
          { status: 401 }
        );
      }

      // Delete the session to prevent reuse
      mfaSessions._googleMfaSessions?.delete(mfaSession);

      // Assuming googleSession.userInfo contains id, role, company
      const { userId, userInfo } = googleSession;
      const token = generateToken({
        id: userId,
        role: userInfo.role,
        company: userInfo.company,
        companyCode: userInfo.companyCode,
        email: userInfo.email
      });

      const res = NextResponse.json({
        success: true,
        message: 'Google authentication successful',
        token,
        user: userInfo // Contains id, role, etc.
      });
      // Set cookies
      res.cookies.set('token', token, { httpOnly: true, path: '/', secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
      res.cookies.set('userRole', userInfo.role, { path: '/', secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
      return res;
    }

    // Verify regular MFA session using our library
    const userId = verifyMfaSession(mfaSession, mfaCode);
    
    if (!userId) {
      if (DEBUG_MFA) {
        console.log(`[MFA-VERIFY] Failed to verify session ${mfaSession} with code ${mfaCode}`);
      }
      return NextResponse.json(
        { success: false, message: 'Invalid or expired verification code' },
        { status: 401 }
      );
    }

    if (DEBUG_MFA) {
      console.log(`[MFA-VERIFY] Successfully verified session ${mfaSession} with code ${mfaCode} for user ${userId}`);
    }

    // Fetch user data from database
    try {
      // First, find the user in the auth database to get their company code
      const AuthUserModel = await getAuthUserModel();
      const authUser = await AuthUserModel.findOne({ 
        $or: [
          { userId },
          { _id: userId }
        ]
      });
      
      if (!authUser) {
        console.error(`[MFA-VERIFY] User not found with userId ${userId} in auth database`);
        return NextResponse.json(
          { success: false, message: 'User not found' },
          { status: 404 }
        );
      }
      
      const companyCode = authUser.companyCode;
      
      if (DEBUG_MFA) {
        console.log(`[MFA-VERIFY] Found user ${userId} in auth database with company code ${companyCode}`);
      }
      
      // Now get the user from their company database
      const User = getUserModel(companyCode);
      const user = await User.findById(userId);
      
      if (!user) {
        console.error(`[MFA-VERIFY] User ${userId} not found in company database ${companyCode}`);
        return NextResponse.json(
          { success: false, message: 'User not found in company database' },
          { status: 404 }
        );
      }
      
      // Update user status if needed (for new signups)
      if (user.status === 'pending') {
        // The user is still pending admin approval, but we can mark them as email verified
        user.emailVerified = true;
        await user.save();
        
        if (DEBUG_MFA) {
          console.log(`[MFA-VERIFY] Updated user ${userId} to emailVerified=true in company database`);
        }
        
        // Also update in auth databases
        await AuthUserModel.updateOne({ 
          $or: [
            { userId },
            { _id: userId }
          ]
        }, { emailVerified: true });
        
        const CompanyAuth = await getCompanyAuthModel(companyCode);
        await CompanyAuth.updateOne({ 
          $or: [
            { userId },
            { _id: userId }
          ]
        }, { emailVerified: true });
      }
      
      // Generate token with user data
      const token = generateToken({
        id: userId,
        email: user.email,
        role: user.role,
        company: user.company,
        companyCode: user.companyCode,
        status: user.status
      });
      
      const res = NextResponse.json({
        success: true,
        message: 'Email verification successful',
        token,
        user: {
          id: userId,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          company: user.company,
          companyCode: user.companyCode,
          status: user.status
        },
        pendingApproval: user.status === 'pending'
      });
      
      // Set cookies
      res.cookies.set('token', token, { httpOnly: true, path: '/', secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
      res.cookies.set('userRole', user.role, { path: '/', secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
      
      return res;
    } catch (dbError) {
      console.error('Database error during MFA verification:', dbError);
      return NextResponse.json(
        { success: false, message: 'Database error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('MFA verification error:', error);
    return NextResponse.json(
      { success: false, message: 'MFA verification failed' },
      { status: 500 }
    );
  }
} 
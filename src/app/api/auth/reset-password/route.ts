import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserModel } from '@/models/AuthUser';
import connectDB from '@/lib/dbConnect';
import bcrypt from 'bcryptjs';


export async function POST(request: NextRequest) {
  try {
    const { email, otp, newPassword } = await request.json();

    if (!email || !otp || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Email, verification code and new password are required' },
        { status: 400 }
      );
    }

    console.log(`[PASSWORD-RESET] Verifying OTP for ${email}`);

    try {
      // Connect to the main database to find the user
      await connectDB('org_sim_db');
      
      // Get the auth user model
      const AuthUserModel = await getAuthUserModel();
      
      // Find the user by email and select the password reset fields
      const user = await AuthUserModel.findOne({ email }).select('+resetPasswordToken +resetPasswordExpires');
      
      if (!user) {
        console.log(`[PASSWORD-RESET] User not found with email ${email}`);
        return NextResponse.json(
          { success: false, message: 'Invalid email address' },
          { status: 404 }
        );
      }
      
      // Check if reset token exists and is not expired
      if (!user.resetPasswordToken || !user.resetPasswordExpires) {
        console.log(`[PASSWORD-RESET] No active reset request for ${email}`);
        return NextResponse.json(
          { success: false, message: 'Password reset request has expired or does not exist' },
          { status: 400 }
        );
      }
      
      // Check if token is expired
      const now = new Date();
      if (now > new Date(user.resetPasswordExpires)) {
        console.log(`[PASSWORD-RESET] Reset token expired for ${email}`);
        return NextResponse.json(
          { success: false, message: 'Password reset link has expired' },
          { status: 400 }
        );
      }
      
      // Verify the OTP directly against the stored token
      const otpTrim = otp.trim();
      console.log(`[PASSWORD-RESET] Stored token: ${user.resetPasswordToken}, Received OTP: ${otpTrim}`);
      if (String(user.resetPasswordToken).trim() !== otpTrim) {
        console.log(`[PASSWORD-RESET] Invalid OTP for ${email}`);
        return NextResponse.json(
          { success: false, message: 'Invalid verification code' },
          { status: 400 }
        );
      }
      
      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      // Update password and clear reset token in the auth database
      user.password = hashedPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      
      console.log(`[PASSWORD-RESET] Password reset successful for ${email}`);
      
      return NextResponse.json({
        success: true,
        message: 'Password has been reset successfully'
      });
    } catch (error) {
      console.error('[PASSWORD-RESET] Database error:', error);
      return NextResponse.json(
        { success: false, message: 'An error occurred while processing your request' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[PASSWORD-RESET] Request error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred' },
      { status: 500 }
    );
  }
} 
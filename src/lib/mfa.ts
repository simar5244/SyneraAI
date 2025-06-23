/**
 * Multi-Factor Authentication Utilities
 * 
 * Functions for generating and validating MFA codes.
 */
import { sendOTPVerificationEmail } from '@/services/emailService';

// In-memory store persisted in globalThis to survive module reloads during development
const globalAny = globalThis as any;
if (!globalAny._otpSessions) {
  globalAny._otpSessions = new Map<string, { userId: string, code: string, expires: Date, email: string, username: string }>();
}
const otpSessions: Map<string, { userId: string, code: string, expires: Date, email: string, username: string }> = globalAny._otpSessions;

// Enable debug mode
const DEBUG_MFA = true;

/**
 * Generate a random MFA code
 * @returns A 6-digit MFA code
 */
export const generateMfaCode = (): string => {
  // Generate a random 6-digit code
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Store an MFA session
 * @param userId User ID associated with the session
 * @param code MFA code to store
 * @param email User's email address
 * @param username User's username
 * @returns Session ID for verification
 */
export const storeMfaSession = (userId: string, code: string, email: string, username: string): string => {
  // Generate a unique session ID
  const sessionId = crypto.randomUUID();
  
  // Set expiration for 30 minutes from now (increased from 10 minutes)
  const expires = new Date();
  expires.setMinutes(expires.getMinutes() + 30);
  
  // Store the session
  otpSessions.set(sessionId, {
    userId,
    code,
    expires,
    email,
    username
  });
  
  if (DEBUG_MFA) {
    console.log(`[MFA-DEBUG] Created new session ${sessionId} for user ${userId}`);
    console.log(`[MFA-DEBUG] Code ${code} expires at ${expires.toISOString()}`);
  }
  
  return sessionId;
};

/**
 * Verify an MFA code
 * @param sessionId Session ID from storeMfaSession
 * @param code Code entered by the user
 * @returns User ID if valid, null if invalid
 */
export const verifyMfaSession = (sessionId: string, code: string): string | null => {
  if (DEBUG_MFA) {
    console.log(`[MFA-DEBUG] Verifying session ${sessionId} with code ${code}`);
  }
  
  // Get the session
  const session = otpSessions.get(sessionId);
  
  if (!session) {
    if (DEBUG_MFA) {
      console.log(`[MFA-DEBUG] Session ${sessionId} not found`);
    }
    return null;
  }
  
  // Check if session has expired
  const now = new Date();
  if (session.expires < now) {
    if (DEBUG_MFA) {
      console.log(`[MFA-DEBUG] Session ${sessionId} expired at ${session.expires.toISOString()}, current time is ${now.toISOString()}`);
    }
    otpSessions.delete(sessionId); // Clean up expired session
    return null;
  }
  
  // Check if code matches
  if (DEBUG_MFA) {
    console.log(`[MFA-VERIFY-DETAIL] Comparing session.code: '${session.code}' (type: ${typeof session.code}) with input code: '${code}' (type: ${typeof code})`);
  }
  if (session.code !== code) {
    if (DEBUG_MFA) {
      console.log(`[MFA-DEBUG] Code mismatch for session ${sessionId}. Expected ${session.code}, got ${code}`);
    }
    return null;
  }
  
  if (DEBUG_MFA) {
    console.log(`[MFA-DEBUG] Session ${sessionId} verified successfully for user ${session.userId}`);
  }
  
  // Delete the session to prevent reuse
  otpSessions.delete(sessionId);
  
  // Return the user ID
  return session.userId;
};

/**
 * List all active MFA sessions (for debugging only)
 */
export const listActiveSessions = (): void => {
  if (!DEBUG_MFA) return;
  
  console.log(`[MFA-DEBUG] Currently ${otpSessions.size} active sessions:`);
  
  otpSessions.forEach((session, id) => {
    console.log(`[MFA-DEBUG] Session ${id}: User ${session.userId}, Code ${session.code}, Expires ${session.expires.toISOString()}`);
  });
};

/**
 * Send MFA code via email
 * @param email Email address to send to
 * @param code MFA code to send
 * @param username User's username
 */
export const sendMfaCode = async (email: string, code: string, username: string): Promise<boolean> => {
  console.log(`Sending MFA code ${code} to ${email}`);
  
  try {
    // Use our email service to send the OTP code
    const result = await sendOTPVerificationEmail(email, code, username);
    return result;
  } catch (error) {
    console.error('Failed to send MFA code:', error);
    return false;
  }
};

/**
 * Create and send an MFA code
 * @param userId User ID
 * @param email User's email
 * @param username User's username
 * @returns Session ID for verification, or null if sending failed
 */
/**
 * Generates an OTP, sends it via email, and returns the OTP string.
 * This function is intended for stateless OTP flows like password reset and does not use in-memory sessions.
 * @param email User's email
 * @param username User's username
 * @returns The generated OTP string if successful, otherwise null.
 */
export const generateAndSendPasswordResetOtp = async (email: string, username: string): Promise<string | null> => {
  const code = generateMfaCode();
  
  if (DEBUG_MFA) {
    console.log(`[MFA-DEBUG] Generated password reset OTP ${code} for ${email}`);
  }
  
  const sent = await sendMfaCode(email, code, username);
  
  if (!sent) {
    console.error(`[MFA-ERROR] Failed to send password reset OTP to ${email}`);
    return null;
  }
  
  if (DEBUG_MFA) {
    console.log(`[MFA-DEBUG] Password reset OTP ${code} sent successfully to ${email}`);
  }
  
  return code;
};

/**
 * Generates an OTP for signup, sends it via email, and returns the OTP string.
 * This function is intended for stateless OTP flows like email verification during signup.
 * @param email User's email
 * @param username User's username
 * @returns The generated OTP string if successful, otherwise null.
 */
export const generateAndSendSignupOtp = async (email: string, username: string): Promise<string | null> => {
  const code = generateMfaCode();

  if (DEBUG_MFA) {
    console.log(`[MFA-DEBUG] Generated signup OTP ${code} for ${email}`);
  }

  const sent = await sendMfaCode(email, code, username);

  if (!sent) {
    console.error(`[MFA-ERROR] Failed to send signup OTP to ${email}`);
    return null;
  }

  if (DEBUG_MFA) {
    console.log(`[MFA-DEBUG] Signup OTP ${code} sent successfully to ${email}`);
  }

  return code;
};

export const createAndSendMfaCode = async (userId: string, email: string, username: string): Promise<string | null> => {
  // Generate a code
  const code = generateMfaCode();
  
  if (DEBUG_MFA) {
    console.log(`[MFA-DEBUG] Generated code ${code} for user ${userId} (${email})`);
  }
  
  // Send the code
  const sent = await sendMfaCode(email, code, username);
  
  if (!sent) {
    console.error(`[MFA-ERROR] Failed to send code to ${email}`);
    return null;
  }
  
  // Store the session
  const sessionId = storeMfaSession(userId, code, email, username);
  
  if (DEBUG_MFA) {
    console.log(`[MFA-DEBUG] Created and sent MFA code ${code} for session ${sessionId}`);
    listActiveSessions();
  }
  
  return sessionId;
}; 
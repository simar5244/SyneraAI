import { NextRequest, NextResponse } from 'next/server';
import { generateRandomToken, generateToken } from '@/lib/auth';
import connectDB from '@/lib/dbConnect';
import { getDBConnection } from '@/lib/companyDBConnect';
import { getUserModel } from '@/models/User';
import { MongoClient } from 'mongodb';
import { getAuthUserModel } from '@/models/AuthUser';
import { getCompanyAuthModel } from '@/models/CompanyAuth';
import Subscription from '@/models/Subscription';
import { createAndSendMfaCode } from '@/lib/mfa';
import Stripe from 'stripe';

// MongoDB connection string
const uri = process.env.MONGODB_URI || '';

export async function POST(req: NextRequest) {
  let client: MongoClient | null = null;
  
  try {
    console.log('[SIGNUP] Starting user signup process');
    
    // Parse request body
    const { username, email, password, firstName, lastName, company, companyCode } = await req.json();
    console.log(`[SIGNUP] Received signup request for email: ${email}, company code: ${companyCode}`);

    // Validate input
    if (!username || !email || !password || !companyCode) {
      console.log('[SIGNUP] Missing required fields');
      return NextResponse.json(
        { success: false, message: 'Username, email, password, and company code are required' },
        { status: 400 }
      );
    }

    // Sanitize and normalize company code: remove non-alphanumeric and lowercase
    const sanitizedCompanyCode = companyCode.trim().replace(/[^a-zA-Z0-9]/g, '');
    const normalizedCompanyCode = sanitizedCompanyCode.toLowerCase();
    console.log(`[SIGNUP] Normalized company code: ${normalizedCompanyCode}`);

    // Connect to MongoDB directly first to verify company exists
    client = new MongoClient(uri);
    await client.connect();
    console.log('[SIGNUP] Connected to MongoDB');

    // Step 1: Check if the database physically exists first
    let companyExists = false;
    let companyDbName = `company_${normalizedCompanyCode}`;
    let companyInfo = null;

    // List all databases and check if our company database exists
    const adminDb = client.db('admin');
    const dbList = await adminDb.admin().listDatabases();
    const databaseNames = dbList.databases.map((db: any) => db.name);
    
    console.log(`[SIGNUP] Checking if database ${companyDbName} exists among:`, databaseNames);
    
    if (databaseNames.includes(companyDbName)) {
      console.log(`[SIGNUP] Company database ${companyDbName} exists!`);
      companyExists = true;
    }

    // Step 2: If database doesn't exist, check organization collection as before
    if (!companyExists) {
      console.log(`[SIGNUP] Database not found directly, checking organizations collection`);
      
      // Check if company exists in main DB
      const mainDb = client.db('org_sim_db');
      const organizationsCollection = mainDb.collection('organizations');
      
      console.log(`[SIGNUP] Searching for company with code: ${normalizedCompanyCode}`);
      
      let companyRecord = await organizationsCollection.findOne({ 
        $or: [
          { companyCode: normalizedCompanyCode },
          { companyCode: companyCode } // Try original case too
        ]
      });
      
      if (!companyRecord) {
        console.log(`[SIGNUP] Company with code ${normalizedCompanyCode} not found in organizations collection`);
        
        // Try a broader search with case-insensitive regex
        const companyRecordAlt = await organizationsCollection.findOne({
          companyCode: { $regex: `^${normalizedCompanyCode}$`, $options: 'i' }
        });
        
        if (!companyRecordAlt) {
          console.log(`[SIGNUP] Company not found with case-insensitive search either`);
          
          if (!companyExists) {
            return NextResponse.json(
              { success: false, message: 'Invalid company code' },
              { status: 404 }
            );
          }
        } else {
          console.log(`[SIGNUP] Found company with case-insensitive search: ${companyRecordAlt.companyCode}`);
          companyRecord = companyRecordAlt;
          companyExists = true;
          companyInfo = companyRecord;
        }
      } else {
        console.log(`[SIGNUP] Found company in organizations: ${companyRecord.name}, code: ${companyRecord.companyCode}`);
        companyExists = true;
        companyInfo = companyRecord;
      }
    }

    // If we've confirmed the company exists (either in database list or organizations collection)
    if (companyExists) {
      console.log(`[SIGNUP] Company exists, proceeding with signup`);
      
      // Use the verified company code for all operations
      const verifiedCompanyCode = normalizedCompanyCode;
      
      // If we didn't get company info from organizations, create minimal info
      if (!companyInfo) {
        companyInfo = {
          name: company || normalizedCompanyCode,
          companyCode: normalizedCompanyCode
        };
        
        // Try to add this company to organizations if it doesn't exist there
        try {
          const mainDb = client.db('org_sim_db');
          const organizationsCollection = mainDb.collection('organizations');
          
          // Check if it exists first
          const existingOrg = await organizationsCollection.findOne({ companyCode: normalizedCompanyCode });
          
          if (!existingOrg) {
            // Add it to organizations for future consistency
            await organizationsCollection.insertOne({
              name: company || normalizedCompanyCode,
              companyCode: normalizedCompanyCode,
              createdAt: new Date(),
              autoCreated: true  // Flag that this was auto-created
            });
            console.log(`[SIGNUP] Auto-created organization record for ${normalizedCompanyCode}`);
          }
        } catch (err) {
          console.error(`[SIGNUP] Failed to auto-create organization:`, err);
          // Continue anyway since the database exists
        }
      }
      
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-05-28.basil' });
      // Attempt to retrieve active subscription via Stripe (wrapped in try/catch)
      const PLAN_LIMITS: Record<string, number> = { starter: 1, standard: 2, enterprise: 3 };
      await connectDB('org_sim_db');
      let stripeSubscription: Stripe.Subscription | null = null;
      try {
        const customers = await stripe.customers.search({ query: `metadata['companyCode']:'${verifiedCompanyCode}'`, limit: 1 });
        if (customers.data.length) {
          const cust = customers.data[0];
          const subs = await stripe.subscriptions.list({ customer: cust.id, status: 'active', limit: 1 });
          stripeSubscription = subs.data[0] || null;
        }
      } catch (err) {
        console.error('[SIGNUP] Stripe subscription lookup failed, falling back:', err);
      }
 
      let userLimit = 0;
      let planType = '';
      // Determine plan and limit, fallback to local DB if no Stripe data or on error
      if (stripeSubscription) {
        console.log('[SIGNUP] Using Stripe subscription for limit before expansion');
        // No expansion: rely on fallbackSearch / local model instead
      }
      const localSub = await Subscription.findOne({ companyCode: verifiedCompanyCode });
      if (localSub) {
        userLimit = localSub.userLimit;
        planType = localSub.planType;
      }
      
      if (userLimit > 0) {
        const companyDb = client.db(`company_${verifiedCompanyCode}`);
        const usersCollection = companyDb.collection('users');
        const userCount = await usersCollection.countDocuments({ status: 'active' });
        if (userCount >= userLimit) {
          return NextResponse.json({ success: false, message: `User limit reached for ${planType}`, planLimitReached: true, currentPlan: planType }, { status: 403 });
        }
      }
      
      // Now connect to company database using the verified code
      try {
        console.log(`[SIGNUP] Connecting to company database: company_${verifiedCompanyCode}`);
        const companyConn = await getDBConnection(verifiedCompanyCode);
        console.log(`[SIGNUP] Successfully connected to company database`);
        
        const User = getUserModel(verifiedCompanyCode);
        console.log(`[SIGNUP] Got User model for company: ${verifiedCompanyCode}`);

        // Check if user with email or username already exists
        const existingUser = await User.findOne({ 
          $or: [
            { email: email.toLowerCase() },
            { username }
          ]
        });

        if (existingUser) {
          console.log(`[SIGNUP] User with email ${email} or username ${username} already exists`);
          return NextResponse.json(
            { success: false, message: 'User with this email or username already exists' },
            { status: 400 }
          );
        }

        // Generate email verification token
        const emailVerificationToken = generateRandomToken();

        // Always store company name in lowercase
        const companyName = company ? company.toLowerCase() : (companyInfo.name || '').toLowerCase();

        // Create new user with pending status
        console.log(`[SIGNUP] Creating new user with email: ${email}`);
        const newUser = new User({
          username,
          email: email.toLowerCase(),
          password, // Will be hashed by User model pre-save hook
          firstName: firstName || '',
          lastName: lastName || '',
          company: companyName,
          companyCode: verifiedCompanyCode,
          emailVerificationToken,
          status: 'pending', // All new users start as pending until admin approval
          role: 'employee_tier_3' // Default role
        });

        // Save user to database
        await newUser.save();
        console.log(`[SIGNUP] User saved to company database with ID: ${newUser._id}`);
        const userId = String(newUser._id);
        
        // Sync user data to the central auth database
        try {
          console.log(`[SIGNUP] Syncing to central auth database`);
          const AuthUserModel = await getAuthUserModel();
          const existingAuth = await AuthUserModel.findOne({ email: newUser.email });
          if (!existingAuth) {
            await AuthUserModel.create({
              userId: userId,
              originalId: newUser._id,
              username: newUser.username,
              email: newUser.email,
              password: newUser.password, // already hashed by pre-save hook
              role: newUser.role,
              status: newUser.status,
              companyCode: verifiedCompanyCode,
              companyName: newUser.company,
              databaseName: `company_${verifiedCompanyCode}`,
            });
            console.log('[SIGNUP] Central auth record created');
          }
        } catch (err) {
          console.error('[SIGNUP] Failed to sync user to central auth DB:', err);
        }

        // Sync user data to the company-specific auth collection
        try {
          console.log(`[SIGNUP] Syncing to company auth collection`);
          const CompanyAuth = await getCompanyAuthModel(verifiedCompanyCode);
          const existingCompanyAuth = await CompanyAuth.findOne({ email: newUser.email });
          if (!existingCompanyAuth) {
            await CompanyAuth.create({
              userId: userId,
              originalId: newUser._id,
              username: newUser.username,
              email: newUser.email,
              password: newUser.password,
              role: newUser.role,
              status: newUser.status,
              companyCode: verifiedCompanyCode,
              companyName: newUser.company,
            });
            console.log('[SIGNUP] Company auth record created');
          }
        } catch (err) {
          console.error('[SIGNUP] Failed to sync user to company auth collection:', err);
        }

        // Send OTP verification email
        console.log(`[SIGNUP] Generating and sending OTP verification code to ${email}`);
        const mfaSession = await createAndSendMfaCode(userId, email, username);
        
        if (!mfaSession) {
          console.error(`[SIGNUP] Failed to send OTP verification email to ${email}`);
          // Continue anyway but log the error
        }

        // Generate token with necessary data (the user remains pending)
        const token = generateToken({
          id: userId,
          email: newUser.email,
          role: newUser.role,
          company: companyName,
          companyCode: verifiedCompanyCode,
          status: 'pending'
        });

        console.log(`[SIGNUP] Signup successful for ${email}`);
        
        // Return success with token, user data, and MFA session
        return NextResponse.json({
          success: true,
          token,
          message: 'Signup successful. Please verify your email with the code we sent.',
          requireMFA: true,
          mfaSession,
          user: {
            id: userId,
            username: newUser.username,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            role: newUser.role,
            company: companyName,
            companyCode: verifiedCompanyCode,
            status: 'pending'
          }
        });
      } catch (dbError: any) {
        console.error(`[SIGNUP] Database error: ${dbError.message}`, dbError);
        return NextResponse.json(
          { success: false, message: `Database error: ${dbError.message}` },
          { status: 500 }
        );
      }
    } else {
      console.log(`[SIGNUP] Company does not exist with code: ${normalizedCompanyCode}`);
      return NextResponse.json(
        { success: false, message: 'Invalid company code' },
        { status: 404 }
      );
    }
  } catch (error: any) {
    console.error('[SIGNUP] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'An error occurred during signup' },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
      console.log('[SIGNUP] MongoDB client closed');
    }
  }
}
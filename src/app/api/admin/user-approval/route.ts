import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/dbConnect';
import User from '@/models/User';
import { getUserModel } from '@/models/User';
import { MongoClient, ObjectId } from 'mongodb';
import { verifyToken } from '@/lib/auth';

// MongoDB connection string
const uri = process.env.MONGODB_URI || '';

// Define a type for pendingUsers to avoid implicit any[] errors
interface PendingUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  createdAt: Date;
  company: string;
  companyCode: string;
}

// Default user limits based on plan type
const DEFAULT_USER_LIMITS = {
  starter: 1,
  standard: 2,
  enterprise: 3
};

// Helper function to check if user limit has been reached
async function checkUserLimit(companyCode: string, mongoClient: MongoClient): Promise<{ 
  limitReached: boolean; 
  currentCount: number; 
  userLimit: number;
  planType: string;
}> {
  try {
    // Connect to the company database
    const companyDb = mongoClient.db(`company_${companyCode}`);
    const usersCollection = companyDb.collection('users');
    
    console.log(`[USER APPROVAL] Checking user limit for company: ${companyCode}`);
    
    // Count active users - using EXACT query format from the example
    const currentCount = await usersCollection.countDocuments({ status: "active" });
    console.log(`[USER APPROVAL] Found ${currentCount} active users`);
    
    // Get subscription details from the main database
    const mainDb = mongoClient.db('org_sim_db');
    const subscriptionsCollection = mainDb.collection('subscriptions');
    
    // Find subscription for the company
    const subscription = await subscriptionsCollection.findOne({ companyCode });
    
    // Get plan type and user limit
    const planType = subscription?.planType || 'standard';
    const userLimit = subscription?.userLimit || DEFAULT_USER_LIMITS[planType as keyof typeof DEFAULT_USER_LIMITS] || DEFAULT_USER_LIMITS.standard;
    
    // Check if limit has been reached
    const limitReached = currentCount >= userLimit;
    
    console.log(`[USER APPROVAL] Company ${companyCode} has ${currentCount}/${userLimit} active users (${planType} plan)`);
    console.log(`[USER APPROVAL] Limit reached: ${limitReached}`);
    
    return { 
      limitReached, 
      currentCount, 
      userLimit,
      planType
    };
  } catch (error) {
    console.error(`[USER APPROVAL] Error checking user limit:`, error);
    // Default to limit not reached to avoid blocking approvals due to errors
    return { 
      limitReached: false, 
      currentCount: 0, 
      userLimit: 2,
      planType: 'standard'
    };
  }
}

export async function GET(req: NextRequest) {
  let client: MongoClient | null = null;
  let authClient: MongoClient | null = null;

  try {
    // Get the token to verify admin permissions
    const token = req.cookies.get('token')?.value || 
                  req.headers.get('authorization')?.split(' ')[1] || 
                  '';
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the token and extract user details
    const decodedToken = verifyToken(token);
    if (!decodedToken) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    console.log('User approval request from:', {
      userId: decodedToken.id,
      role: decodedToken.role,
      company: decodedToken.company,
      companyCode: decodedToken.companyCode
    });
    
    // Only admins can view pending users
    const userRole = (decodedToken.role || '').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get company code from token or query parameter
    const companyCode = decodedToken.companyCode || 
                        new URL(req.url).searchParams.get('companyCode') || 
                        '';

    if (!companyCode && userRole !== 'superadmin') {
      return NextResponse.json(
        { success: false, message: 'Company code is required' },
        { status: 400 }
      );
    }

    console.log('Fetching pending users for company code:', companyCode.toLowerCase());

    // Connect to MongoDB directly - we don't need connectDB here since we're using MongoClient
    // await connectDB();
    
    client = new MongoClient(uri);
    await client.connect();
    
    let pendingUsers: PendingUser[] = [];
    
    // Direct company database query (most reliable approach)
    if (companyCode) {
      try {
        const companyDbName = `company_${companyCode.toLowerCase()}`;
        console.log(`Querying database: ${companyDbName}`);
        
        const companyDb = client.db(companyDbName);
        const usersCollection = companyDb.collection('users');
        
        // Query for pending users directly in the company database
        const companyPendingUsers = await usersCollection.find({
          status: 'pending'
        }).toArray();
        
        console.log(`Found ${companyPendingUsers.length} pending users in company database`);
        
        // Get company name from company database 
        const companyInfo = await companyDb.collection('company_info').findOne({}) || 
                            { name: companyCode.toUpperCase() }; // Fallback to formatted company code
        
        const companyName = companyInfo.name || companyCode.toUpperCase();
        
        // Map and add to results
        pendingUsers = companyPendingUsers.map(user => ({
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          status: user.status,
          createdAt: user.createdAt,
          company: companyName,
          companyCode: companyCode.toLowerCase()
        }));
      } catch (err) {
        console.error(`Error fetching pending users from company ${companyCode} database:`, err);
      }
    }
    
    // For superadmins only, check all companies if no specific company is requested
    // Regular admins should never see data from other companies
    if (userRole === 'superadmin' && !companyCode && pendingUsers.length === 0) {
      try {
        // Connect to auth database to get list of companies
        const authDbURI = uri.replace(/\/[^/]+(\?|$)/, '/auth_db$1');
        authClient = new MongoClient(authDbURI);
        await authClient.connect();
        
        const authDb = authClient.db('auth_db');
        
        // Get distinct company codes from the authUsers collection
        const companyCodes = await authDb.collection('authUsers')
          .distinct('companyCode', { companyCode: { $exists: true, $ne: '' } });
        
        console.log(`Found ${companyCodes.length} distinct company codes in auth database`);
        
        // Check each company database for pending users
        for (const orgCode of companyCodes) {
          if (!orgCode) continue;
          
          try {
            const companyDb = client.db(`company_${orgCode}`);
            const usersCollection = companyDb.collection('users');
            
            // Query for pending users
            const companyPendingUsers = await usersCollection.find({
              status: 'pending'
            }).toArray();
            
            if (companyPendingUsers.length > 0) {
              console.log(`Found ${companyPendingUsers.length} pending users for company: ${orgCode}`);
              
              // Get company name from company database if possible
              let companyName = orgCode.toUpperCase();
              try {
                const companyInfo = await companyDb.collection('company_info').findOne({});
                if (companyInfo && companyInfo.name) {
                  companyName = companyInfo.name;
                }
              } catch (err) {
                console.error(`Error getting company name for ${orgCode}:`, err);
              }
              
              // Map and add to results
              const mappedUsers: PendingUser[] = companyPendingUsers.map(user => ({
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                status: user.status,
                createdAt: user.createdAt,
                company: companyName,
                companyCode: orgCode
              }));
              
              pendingUsers = [...pendingUsers, ...mappedUsers];
            }
          } catch (err) {
            console.error(`Error checking company ${orgCode}:`, err);
          }
        }
      } catch (err) {
        console.error('Error fetching company codes from auth database:', err);
      }
    }
    
    // Only if we still don't have users, check the central auth database
    // But always filter by company code for regular admins
    if (pendingUsers.length === 0) {
      try {
        // Connect to auth database
        const authDbURI = uri.replace(/\/[^/]+(\?|$)/, '/auth_db$1');
        authClient = new MongoClient(authDbURI);
        await authClient.connect();
        
        const authDb = authClient.db('auth_db');
        const authUsersCollection = authDb.collection('authUsers');
        
        // Query for pending users in the central auth database
        // Always filter by companyCode if user is not a superadmin
        const query = companyCode || userRole !== 'superadmin'
          ? { status: 'pending', companyCode: companyCode.toLowerCase() }
          : { status: 'pending' };
          
        const authPendingUsers = await authUsersCollection.find(query).toArray();
        
        console.log(`Found ${authPendingUsers.length} pending users in auth database`);
        
        // Map to remove sensitive data
        const mappedAuthUsers: PendingUser[] = authPendingUsers.map(user => ({
          id: user.userId || user._id.toString(),
          username: user.username,
          email: user.email,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          status: user.status,
          createdAt: user.createdAt,
          company: user.companyName || '',
          companyCode: user.companyCode
        }));
        
        pendingUsers = [...pendingUsers, ...mappedAuthUsers];
      } catch (err) {
        console.error('Error fetching pending users from auth database:', err);
      }
    }

    return NextResponse.json({
      success: true,
      pendingUsers
    });
  } catch (error: any) {
    console.error('Error fetching pending users:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Error fetching pending users' },
      { status: 500 }
    );
  } finally {
    if (client) await client.close();
    if (authClient) await authClient.close();
  }
}

export async function POST(req: NextRequest) {
  let mongoClient: MongoClient | null = null;
  let authClient: MongoClient | null = null;

  try {
    console.log('[USER APPROVAL] Starting user approval/rejection process');
    
    // Get the token to verify admin permissions
    const token = req.cookies.get('token')?.value || 
                  req.headers.get('authorization')?.split(' ')[1] || 
                  '';
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the token and extract user details
    const decodedToken = verifyToken(token);
    if (!decodedToken) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }
    
    // Only admins can approve users
    const userRole = (decodedToken.role || '').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Parse request body
    const { userId, email, action, companyCode } = await req.json();
    
    console.log('[USER APPROVAL] Request:', { userId, email, action, companyCode });
    
    if (!userId && !email) {
      return NextResponse.json(
        { success: false, message: 'User ID or email is required' },
        { status: 400 }
      );
    }
    
    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'Valid action (approve or reject) is required' },
        { status: 400 }
      );
    }
    
    if (!companyCode) {
      return NextResponse.json(
        { success: false, message: 'Company code is required' },
        { status: 400 }
      );
    }

    // Normalize company code to lowercase
    const normalizedCompanyCode = companyCode.toLowerCase();
    console.log(`[USER APPROVAL] Normalized company code: ${normalizedCompanyCode}`);

    // New status based on the action
    const newStatus = action === 'approve' ? 'active' : 'rejected';
    console.log(`[USER APPROVAL] Setting user status to: ${newStatus}`);

    // Connect to MongoDB directly - we don't need connectDB here since we're using MongoClient
    // await connectDB();
    
    // Create MongoDB client for direct access to company DB
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    
    // Check user limit if approving a user
    if (action === 'approve') {
      const { limitReached, currentCount, userLimit, planType } = await checkUserLimit(normalizedCompanyCode, mongoClient);
      
      if (limitReached) {
        return NextResponse.json(
          { 
            success: false, 
            message: `Maximum number of active users (${userLimit}) reached for ${planType} plan. Please upgrade your subscription to add more users.`,
            limitReached: true,
            currentCount,
            userLimit,
            planType
          },
          { status: 403 }
        );
      }
    }

    // Connect to auth database
    const authDbURI = uri.replace(/\/[^/]+(\?|$)/, '/auth_db$1');
    authClient = new MongoClient(authDbURI);
    await authClient.connect();
    
    // Update status in all three collections
    const updateResults = {
      companyUsers: false,
      companyAuth: false,
      centralAuth: false
    };

    // Gather all user information first
    let userData = null;
    let userIdString = '';
    let userEmail = '';
    let username = '';
    let role = '';
    let companyName = '';
    
    // 1. First try to find user in company_companycode.users collection
    try {
      const companyDb = mongoClient.db(`company_${normalizedCompanyCode}`);
      const usersCollection = companyDb.collection('users');
      
      // Create query to find the user
      let userQuery: any = {};
      if (userId) {
        // Try to convert to ObjectId if it looks like one
        try {
          userQuery = { _id: new ObjectId(userId) };
        } catch (err) {
          // If not a valid ObjectId, use it as a string
          userQuery = { _id: userId };
        }
      } else if (email) {
        userQuery = { email: email.toLowerCase() };
      }
      
      console.log(`[USER APPROVAL] Looking for user with query:`, userQuery);
      
      // Find user first to get complete information
      const user = await usersCollection.findOne(userQuery);
      
      if (user) {
        console.log(`[USER APPROVAL] Found user in company_${normalizedCompanyCode}.users collection:`, 
          { id: user._id, email: user.email });
        
        // Store user data for creating/updating other collections
        userData = user;
        userIdString = user._id.toString();
        userEmail = user.email.toLowerCase();
        username = user.username;
        role = user.role;
        companyName = user.company || '';
        
        // Update user status
        const updateResult = await usersCollection.updateOne(
          { _id: user._id },
          { $set: { 
              status: newStatus,
              updatedAt: new Date()
            } 
          }
        );
        
        console.log(`[USER APPROVAL] Updated user in company_${normalizedCompanyCode}.users collection:`, 
          { matchedCount: updateResult.matchedCount, modifiedCount: updateResult.modifiedCount });
        
        updateResults.companyUsers = updateResult.modifiedCount > 0;
      }
    } catch (err) {
      console.error(`[USER APPROVAL] Error updating company users:`, err);
    }
    
    // If user not found in company.users collection, try to find in central auth
    if (!userData && email) {
      try {
        const authDb = authClient.db('auth_db');
        const authUsersCollection = authDb.collection('authUsers');
        
        const authUser = await authUsersCollection.findOne({ 
          email: email.toLowerCase(),
          companyCode: normalizedCompanyCode
        });
        
        if (authUser) {
          console.log(`[USER APPROVAL] Found user in central auth database:`, 
            { id: authUser._id, email: authUser.email });
          
          userIdString = authUser.userId || authUser._id.toString();
          userEmail = authUser.email.toLowerCase();
          username = authUser.username;
          role = authUser.role;
          companyName = authUser.companyName || '';
        }
      } catch (err) {
        console.error(`[USER APPROVAL] Error finding user in central auth:`, err);
      }
    }
    
    // If we have user information, ensure all three collections are updated
    if (userEmail) {
      // 2. Update company_companycode.auth collection
      try {
        const companyDb = mongoClient.db(`company_${normalizedCompanyCode}`);
        const authCollection = companyDb.collection('auth');
        
        // Try to find matching auth record
        const authRecord = await authCollection.findOne({ 
          $or: [
            { userId: userIdString },
            { email: userEmail }
          ]
        });
        
        if (authRecord) {
          // Update existing record
          const authUpdateResult = await authCollection.updateOne(
            { _id: authRecord._id },
            { $set: { 
                status: newStatus,
                updatedAt: new Date()
              } 
            }
          );
          
          console.log(`[USER APPROVAL] Updated existing auth record in company_${normalizedCompanyCode}.auth:`, 
            { matchedCount: authUpdateResult.matchedCount, modifiedCount: authUpdateResult.modifiedCount });
          
          updateResults.companyAuth = authUpdateResult.modifiedCount > 0;
        } else {
          // Create new record if not found
          const newAuthRecord = {
            userId: userIdString,
            originalId: userData?._id || null,
            username: username,
            email: userEmail,
            password: userData?.password || '', // May be missing if we only found in auth collection
            role: role,
            status: newStatus,
            companyCode: normalizedCompanyCode,
            companyName: companyName,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          const insertResult = await authCollection.insertOne(newAuthRecord);
          console.log(`[USER APPROVAL] Created new auth record in company_${normalizedCompanyCode}.auth:`, 
            { acknowledged: insertResult.acknowledged });
          
          updateResults.companyAuth = insertResult.acknowledged;
        }
      } catch (err) {
        console.error(`[USER APPROVAL] Error updating company auth:`, err);
      }
      
      // 3. Update auth_db.authUsers collection
      try {
        const authDb = authClient.db('auth_db');
        const authUsersCollection = authDb.collection('authUsers');
        
        // Try to find matching auth record
        const centralAuthRecord = await authUsersCollection.findOne({ 
          $or: [
            { userId: userIdString },
            { email: userEmail, companyCode: normalizedCompanyCode }
          ]
        });
        
        if (centralAuthRecord) {
          // Update existing record
          const centralAuthUpdateResult = await authUsersCollection.updateOne(
            { _id: centralAuthRecord._id },
            { $set: { 
                status: newStatus,
                updatedAt: new Date()
              } 
            }
          );
          
          console.log(`[USER APPROVAL] Updated existing record in central auth.authUsers:`, 
            { matchedCount: centralAuthUpdateResult.matchedCount, modifiedCount: centralAuthUpdateResult.modifiedCount });
          
          updateResults.centralAuth = centralAuthUpdateResult.modifiedCount > 0;
        } else {
          // Create new record if not found
          const newCentralAuthRecord = {
            userId: userIdString,
            originalId: userData?._id || null,
            username: username,
            email: userEmail,
            password: userData?.password || '', // May be missing if we only found in auth collection
            role: role,
            status: newStatus,
            companyCode: normalizedCompanyCode,
            companyName: companyName,
            databaseName: `company_${normalizedCompanyCode}`,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          const insertResult = await authUsersCollection.insertOne(newCentralAuthRecord);
          console.log(`[USER APPROVAL] Created new record in central auth.authUsers:`, 
            { acknowledged: insertResult.acknowledged });
          
          updateResults.centralAuth = insertResult.acknowledged;
        }
      } catch (err) {
        console.error(`[USER APPROVAL] Error updating central auth:`, err);
      }
      
      // If we've managed to update or create in at least one collection, try to update company users too if we haven't already
      if ((updateResults.companyAuth || updateResults.centralAuth) && !updateResults.companyUsers && userEmail) {
        try {
          const companyDb = mongoClient.db(`company_${normalizedCompanyCode}`);
          const usersCollection = companyDb.collection('users');
          
          // Try to find user by email
          const user = await usersCollection.findOne({ email: userEmail });
          
          if (user) {
            // Update existing user
            const updateResult = await usersCollection.updateOne(
              { _id: user._id },
              { $set: { 
                  status: newStatus,
                  updatedAt: new Date()
                } 
              }
            );
            
            console.log(`[USER APPROVAL] Updated user in company_${normalizedCompanyCode}.users collection via secondary attempt:`, 
              { matchedCount: updateResult.matchedCount, modifiedCount: updateResult.modifiedCount });
            
            updateResults.companyUsers = updateResult.modifiedCount > 0;
          } else if (userEmail && username) {
            // Create a minimal user record if one doesn't exist
            const newUser = {
              username: username,
              email: userEmail,
              firstName: '',
              lastName: '',
              company: companyName,
              companyCode: normalizedCompanyCode,
              status: newStatus,
              role: role || 'employee_tier_3',
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            const insertResult = await usersCollection.insertOne(newUser);
            console.log(`[USER APPROVAL] Created new user in company_${normalizedCompanyCode}.users collection:`, 
              { acknowledged: insertResult.acknowledged });
            
            if (insertResult.acknowledged) {
              // Update records in other collections with the new user ID
              const newUserId = insertResult.insertedId.toString();
              
              try {
                // Update company auth
                await companyDb.collection('auth').updateOne(
                  { email: userEmail },
                  { $set: { userId: newUserId, originalId: insertResult.insertedId } }
                );
                
                // Update central auth
                await authClient.db('auth_db').collection('authUsers').updateOne(
                  { email: userEmail, companyCode: normalizedCompanyCode },
                  { $set: { userId: newUserId, originalId: insertResult.insertedId } }
                );
              } catch (err) {
                console.error(`[USER APPROVAL] Error updating IDs after creating user:`, err);
              }
              
              updateResults.companyUsers = true;
            }
          }
        } catch (err) {
          console.error(`[USER APPROVAL] Error in secondary attempt to update/create company user:`, err);
        }
      }
      
      console.log(`[USER APPROVAL] Update summary:`, updateResults);
      
      // Return success if at least one collection was updated
      if (updateResults.companyUsers || updateResults.companyAuth || updateResults.centralAuth) {
        return NextResponse.json({
          success: true,
          message: `User ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
          updateResults
        });
      }
    }
    
    // No user was found to update
    return NextResponse.json(
      { success: false, message: 'User not found' },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('[USER APPROVAL] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Error updating user status' },
      { status: 500 }
    );
  } finally {
    if (mongoClient) await mongoClient.close();
    if (authClient) await authClient.close();
  }
}
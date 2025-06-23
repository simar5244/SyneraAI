#!/usr/bin/env node

/**
 * Auth Sync Script
 * 
 * This script watches for changes in user collections across all company databases
 * and syncs changes to:
 * 1. The company-specific Auth collection in each company database
 * 2. The central Auth database for unified authentication
 * 
 * IMPORTANT: This script ONLY runs when changes occur in any users collection
 */

const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env files
const envFiles = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local'
];

envFiles.forEach(file => {
  const envPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment from ${file}`);
    dotenv.config({ path: envPath });
  }
});

// If MONGODB_URI is not set, use a default value for development
let MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  // Check if the connection string is available from Next.js config
  try {
    const nextConfigPath = path.resolve(process.cwd(), 'next.config.js');
    if (fs.existsSync(nextConfigPath)) {
      const nextConfig = require(nextConfigPath);
      if (nextConfig.env && nextConfig.env.MONGODB_URI) {
        MONGODB_URI = nextConfig.env.MONGODB_URI;
        console.log('Using MONGODB_URI from next.config.js');
      }
    }
  } catch (err) {
    console.error('Error loading next.config.js:', err);
  }
}

// Hardcoded fallback for development - to be removed in production
if (!MONGODB_URI) {
  MONGODB_URI = "mongodb+srv://simarjotsingh5244:NUMotMgntP7AcNrQ@cluster0.nen0dzs.mongodb.net/org_sim_db?retryWrites=true&w=majority&appName=Cluster0";
  console.log('Using hardcoded MongoDB URI (for development only)');
}

if (!MONGODB_URI) {
  console.error('Please define the MONGODB_URI environment variable');
  process.exit(1);
}

// How often to check for changes (in milliseconds)
const SYNC_INTERVAL = process.env.AUTH_SYNC_INTERVAL || 5000; // 5 seconds by default
const BATCH_SIZE = 20; // Number of users to process in each batch

// Main database name (for the organization)
const MAIN_DB_NAME = MONGODB_URI.split('/').pop().split('?')[0];

// Auth database name
const AUTH_DB_NAME = 'auth_db';

// Create database connection URIs
const authDBURI = MONGODB_URI.replace(new RegExp(`/${MAIN_DB_NAME}(\\?|$)`), `/${AUTH_DB_NAME}$1`);

// Main MongoDB client
let mainClient;
// Auth database client
let authClient;

// Track active change streams
const changeStreams = new Map();

// Generate a unique userId that's consistent across databases
function generateUserId(email, companyCode) {
  const input = `${email.toLowerCase()}:${companyCode || 'admin'}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    console.log('Connecting to MongoDB...');
    mainClient = new MongoClient(MONGODB_URI);
    await mainClient.connect();
    console.log('Connected to main MongoDB server');

    authClient = new MongoClient(authDBURI);
    await authClient.connect();
    console.log('Connected to auth MongoDB server');

    return true;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    return false;
  }
}

// Get all company databases
async function getAllCompanyDatabases() {
  try {
    const mainDb = mainClient.db(MAIN_DB_NAME);
    const organizations = await mainDb.collection('organizations').find({}).toArray();
    
    return organizations.filter(org => org.companyCode).map(org => ({
      companyCode: org.companyCode,
      companyName: org.name,
      dbName: `company_${org.companyCode.toLowerCase()}`
    }));
  } catch (error) {
    console.error('Error getting company databases:', error);
    return [];
  }
}

// Sync users from a specific company database to its Auth collection
async function syncCompanyUsersToAuth(company, changedUserIds = []) {
  try {
    const { companyCode, companyName, dbName } = company;
    console.log(`Syncing users from ${dbName} to company auth collection...`);

    const companyDb = mainClient.db(dbName);
    const usersCollection = companyDb.collection('users');
    const authCollection = companyDb.collection('auth');

    // Create indexes if they don't exist
    await authCollection.createIndex({ originalId: 1 }, { unique: true });
    await authCollection.createIndex({ email: 1 }, { unique: true });
    await authCollection.createIndex({ userId: 1 }, { unique: true });

    let modifiedUsers = [];
    
    // If specific users changed, only sync those users
    if (changedUserIds && changedUserIds.length > 0) {
      console.log(`Syncing specific changed users in ${dbName}: ${changedUserIds.length} users`);
      
      // Find the specific changed users
      modifiedUsers = await usersCollection.find({
        _id: { $in: changedUserIds }
      }).toArray();
    } else {
      // Fallback to time-based sync for initial sync or full sync requests
      const lastCheckedTime = new Date(Date.now() - 60000); // Last minute as fallback
      
      // Find recently modified users
      modifiedUsers = await usersCollection.find({
        $or: [
          { updatedAt: { $gt: lastCheckedTime } },
          { createdAt: { $gt: lastCheckedTime } }
        ]
      }).limit(BATCH_SIZE).toArray();
    }

    console.log(`Found ${modifiedUsers.length} modified users in ${dbName}`);

    // Process modified users
    for (const user of modifiedUsers) {
      if (!user.email) {
        console.warn(`Skipping user without email in ${dbName}:`, user._id);
        continue;
      }

      // Generate consistent userId across databases
      const userId = generateUserId(user.email, companyCode);

      // Prepare auth record
      const authRecord = {
        originalId: user._id,
        userId,
        username: user.username,
        email: user.email.toLowerCase(),
        password: user.password,
        role: user.role || 'user',
        status: user.status || 'pending',
        companyCode,
        companyName,
        syncedToCentral: false,
        originalLastModified: user.updatedAt || user.createdAt || new Date(),
        updatedAt: new Date()
      };

      // Upsert to auth collection
      await authCollection.updateOne(
        { originalId: user._id },
        { $set: authRecord },
        { upsert: true }
      );
    }

    return modifiedUsers.length;
  } catch (error) {
    console.error(`Error syncing users from company ${company.dbName}:`, error);
    return 0;
  }
}

// Sync auth records from all company Auth collections to central Auth DB
async function syncCompanyAuthToCentral() {
  try {
    console.log('Syncing auth records to central auth database...');
    const companies = await getAllCompanyDatabases();
    const authDb = authClient.db(AUTH_DB_NAME);
    const centralAuthCollection = authDb.collection('authUsers');
    
    // Create indexes if they don't exist
    await centralAuthCollection.createIndex({ userId: 1 }, { unique: true });
    await centralAuthCollection.createIndex({ email: 1 }, { unique: true });

    let totalSynced = 0;

    // Process each company
    for (const company of companies) {
      const { companyCode, companyName, dbName } = company;
      const companyDb = mainClient.db(dbName);
      const companyAuthCollection = companyDb.collection('auth');
      
      // Find records not yet synced to central
      const unsynced = await companyAuthCollection.find({
        $or: [
          { syncedToCentral: false },
          { syncedToCentral: { $exists: false } }
        ]
      }).limit(BATCH_SIZE).toArray();
      
      console.log(`Found ${unsynced.length} unsynced auth records in ${dbName}`);
      
      // Process each unsynced record
      for (const record of unsynced) {
        // Prepare central auth record
        const centralAuthRecord = {
          userId: record.userId,
          originalId: record.originalId,
          username: record.username,
          email: record.email.toLowerCase(),
          password: record.password,
          role: record.role,
          status: record.status,
          companyCode,
          companyName,
          databaseName: dbName,
          lastSynced: new Date()
        };
        
        // Upsert to central auth collection
        await centralAuthCollection.updateOne(
          { userId: record.userId },
          { $set: centralAuthRecord },
          { upsert: true }
        );
        
        // Mark as synced in company auth collection
        await companyAuthCollection.updateOne(
          { _id: record._id },
          { 
            $set: { 
              syncedToCentral: true,
              lastSyncedToCentral: new Date()
            } 
          }
        );
        
        totalSynced++;
      }
    }
    
    // Also sync admin users from main database
    await syncAdminUsersToCentral();
    
    return totalSynced;
  } catch (error) {
    console.error('Error syncing to central auth database:', error);
    return 0;
  }
}

// Sync admin users from main database to central Auth DB
async function syncAdminUsersToCentral(changedUserIds = []) {
  try {
    const mainDb = mainClient.db(MAIN_DB_NAME);
    const mainUsersCollection = mainDb.collection('users');
    const authDb = authClient.db(AUTH_DB_NAME);
    const centralAuthCollection = authDb.collection('authUsers');
    
    let modifiedAdmins = [];
    
    // If specific admin users changed, only sync those
    if (changedUserIds && changedUserIds.length > 0) {
      console.log(`Syncing specific changed admin users: ${changedUserIds.length} users`);
      
      // Find the specific changed admin users
      modifiedAdmins = await mainUsersCollection.find({
        _id: { $in: changedUserIds },
        $or: [
          { role: 'admin' },
          { role: 'ADMIN' },
          { role: 'superadmin' },
          { role: 'SUPERADMIN' }
        ]
      }).toArray();
    } else {
      // Fallback to time-based sync
      const lastCheckedTime = new Date(Date.now() - 60000); // Last minute
      
      // Find admin users modified since last check
      modifiedAdmins = await mainUsersCollection.find({
        $and: [
          {
            $or: [
              { role: 'admin' },
              { role: 'ADMIN' },
              { role: 'superadmin' },
              { role: 'SUPERADMIN' }
            ]
          },
          {
            $or: [
              { updatedAt: { $gt: lastCheckedTime } },
              { createdAt: { $gt: lastCheckedTime } }
            ]
          }
        ]
      }).limit(BATCH_SIZE).toArray();
    }
    
    console.log(`Found ${modifiedAdmins.length} modified admin users in main database`);
    
    // Process modified admin users
    for (const admin of modifiedAdmins) {
      if (!admin.email) {
        console.warn(`Skipping admin without email:`, admin._id);
        continue;
      }
      
      // Generate userId for admin (using 'admin' as company code)
      const userId = generateUserId(admin.email, 'admin');
      
      // Prepare central auth record for admin
      const centralAuthRecord = {
        userId,
        originalId: admin._id,
        username: admin.username,
        email: admin.email.toLowerCase(),
        password: admin.password,
        role: admin.role,
        status: admin.status || 'active', // Admins are typically active by default
        companyCode: null, // Admins don't belong to a specific company
        companyName: 'Admin',
        databaseName: MAIN_DB_NAME,
        lastSynced: new Date()
      };
      
      // Upsert to central auth collection
      await centralAuthCollection.updateOne(
        { userId },
        { $set: centralAuthRecord },
        { upsert: true }
      );
    }
    
    return modifiedAdmins.length;
  } catch (error) {
    console.error('Error syncing admin users to central auth database:', error);
    return 0;
  }
}

// Main sync function
async function runSync(changedCompany = null, changedUserIds = []) {
  try {
    const companies = await getAllCompanyDatabases();
    console.log(`Found ${companies.length} company databases`);
    
    let companyChanges = 0;
    
    // If a specific company changed, only sync that one
    if (changedCompany) {
      const company = companies.find(c => c.dbName === changedCompany);
      if (company) {
        console.log(`Syncing specific company: ${changedCompany}`);
        const changes = await syncCompanyUsersToAuth(company, changedUserIds);
        companyChanges += changes;
      }
    } else {
      // Otherwise sync all companies (initial sync or fallback)
      for (const company of companies) {
        const changes = await syncCompanyUsersToAuth(company);
        companyChanges += changes;
      }
    }
    
    // Step 2: Sync company auth collections to central auth DB
    const centralChanges = await syncCompanyAuthToCentral();
    
    console.log(`Sync completed. Company changes: ${companyChanges}, Central changes: ${centralChanges}`);
  } catch (error) {
    console.error('Error in sync operation:', error);
  }
}

// Set up change streams to watch for user collection changes
async function setupChangeStreams() {
  try {
    console.log('Setting up change streams for all user collections...');
    
    // Get all company databases
    const companies = await getAllCompanyDatabases();
    
    // Set up a change stream for each company's users collection
    for (const company of companies) {
      const { dbName } = company;
      
      // Close existing change stream if any
      if (changeStreams.has(dbName)) {
        const existingStream = changeStreams.get(dbName);
        await existingStream.close();
        changeStreams.delete(dbName);
      }
      
      // Set up new change stream
      const companyDb = mainClient.db(dbName);
      const usersCollection = companyDb.collection('users');
      
      const changeStream = usersCollection.watch([], { fullDocument: 'updateLookup' });
      
      // Store changed document IDs to process in batch
      let changedUserIds = [];
      let timeoutId = null;
      
      changeStream.on('change', change => {
        console.log(`Change detected in ${dbName} users collection:`, change.operationType);
        
        // Get the changed document ID
        let documentId = null;
        
        if (change.operationType === 'insert' || change.operationType === 'update') {
          documentId = change.fullDocument._id;
        } else if (change.operationType === 'replace') {
          documentId = change.fullDocument._id;
        } else if (change.operationType === 'delete') {
          documentId = change.documentKey._id;
        }
        
        if (documentId) {
          // Add to the list of changed users
          changedUserIds.push(documentId);
          
          // Clear previous timeout if any
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          
          // Set a new timeout to batch changes
          timeoutId = setTimeout(() => {
            console.log(`Processing ${changedUserIds.length} changes for ${dbName}`);
            
            // Run sync operation for this specific company and these specific users
            runSync(dbName, changedUserIds);
            
            // Reset the list
            changedUserIds = [];
            timeoutId = null;
          }, 1000); // Wait 1 second to batch changes
        }
      });
      
      changeStream.on('error', error => {
        console.error(`Error in change stream for ${dbName}:`, error);
      });
      
      // Store the change stream
      changeStreams.set(dbName, changeStream);
      console.log(`Change stream set up for ${dbName}`);
    }
    
    // Also set up change stream for main database users (admins)
    const mainDb = mainClient.db(MAIN_DB_NAME);
    const mainUsersCollection = mainDb.collection('users');
    
    // Close existing stream if any
    if (changeStreams.has(MAIN_DB_NAME)) {
      const existingStream = changeStreams.get(MAIN_DB_NAME);
      await existingStream.close();
      changeStreams.delete(MAIN_DB_NAME);
    }
    
    const mainChangeStream = mainUsersCollection.watch([], { fullDocument: 'updateLookup' });
    
    let mainChangedUserIds = [];
    let mainTimeoutId = null;
    
    mainChangeStream.on('change', change => {
      console.log(`Change detected in main database users collection:`, change.operationType);
      
      // Get the changed document ID
      let documentId = null;
      
      if (change.operationType === 'insert' || change.operationType === 'update') {
        documentId = change.fullDocument._id;
      } else if (change.operationType === 'replace') {
        documentId = change.fullDocument._id;
      } else if (change.operationType === 'delete') {
        documentId = change.documentKey._id;
      }
      
      if (documentId) {
        // Add to the list of changed users
        mainChangedUserIds.push(documentId);
        
        // Clear previous timeout if any
        if (mainTimeoutId) {
          clearTimeout(mainTimeoutId);
        }
        
        // Set a new timeout to batch changes
        mainTimeoutId = setTimeout(async () => {
          console.log(`Processing ${mainChangedUserIds.length} admin changes`);
          
          // Sync admin users
          await syncAdminUsersToCentral(mainChangedUserIds);
          
          // Reset the list
          mainChangedUserIds = [];
          mainTimeoutId = null;
        }, 1000); // Wait 1 second to batch changes
      }
    });
    
    mainChangeStream.on('error', error => {
      console.error(`Error in change stream for main database:`, error);
    });
    
    // Store the change stream
    changeStreams.set(MAIN_DB_NAME, mainChangeStream);
    console.log(`Change stream set up for main database`);
    
    return true;
  } catch (error) {
    console.error('Error setting up change streams:', error);
    return false;
  }
}

// Start the sync process
async function startSyncProcess() {
  console.log('Starting authentication sync process with change streams...');
  
  const connected = await connectToMongoDB();
  if (!connected) {
    console.error('Could not connect to MongoDB. Exiting...');
    process.exit(1);
  }
  
  // Initial sync for existing data
  await runSync();
  
  // Set up change streams to watch for further changes
  const streamsSetup = await setupChangeStreams();
  if (!streamsSetup) {
    console.error('Could not set up change streams. Falling back to interval-based sync...');
    
    // Set up recurring sync as fallback
    setInterval(runSync, SYNC_INTERVAL);
    console.log(`Fallback: Auth sync process running on interval. Checking every ${SYNC_INTERVAL/1000} seconds.`);
  } else {
    console.log('Auth sync process running with change streams. Will only sync when data changes.');
  }
}

// Handle termination signals
process.on('SIGINT', async () => {
  console.log('Auth sync process shutting down...');
  
  // Close all change streams
  for (const [dbName, stream] of changeStreams.entries()) {
    console.log(`Closing change stream for ${dbName}...`);
    await stream.close();
  }
  
  if (mainClient) await mainClient.close();
  if (authClient) await authClient.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Auth sync process shutting down...');
  
  // Close all change streams
  for (const [dbName, stream] of changeStreams.entries()) {
    console.log(`Closing change stream for ${dbName}...`);
    await stream.close();
  }
  
  if (mainClient) await mainClient.close();
  if (authClient) await authClient.close();
  process.exit(0);
});

// Start the sync process
startSyncProcess(); 
#!/usr/bin/env node

/**
 * Auth Migration Script
 * 
 * This script initializes the auth structure by:
 * 1. Creating the auth_db database and collections
 * 2. Creating auth collections in each company database
 * 3. Migrating all existing users to the new structure
 */

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

// Create auth_db and necessary collections
async function createAuthStructure() {
  try {
    console.log('Setting up central auth database structure...');
    const authDb = authClient.db(AUTH_DB_NAME);
    
    // Create authUsers collection if it doesn't exist
    if (!(await authDb.listCollections({ name: 'authUsers' }).hasNext())) {
      await authDb.createCollection('authUsers');
      console.log('Created authUsers collection in central auth database');
    }
    
    // Create indexes
    await authDb.collection('authUsers').createIndex({ userId: 1 }, { unique: true });
    await authDb.collection('authUsers').createIndex({ email: 1 }, { unique: true });
    await authDb.collection('authUsers').createIndex({ companyCode: 1 });
    await authDb.collection('authUsers').createIndex({ role: 1 });
    await authDb.collection('authUsers').createIndex({ status: 1 });
    
    console.log('Created indexes in central auth database');
    
    return true;
  } catch (error) {
    console.error('Error creating auth database structure:', error);
    return false;
  }
}

// Create auth collection in a specific company database
async function createCompanyAuthCollection(company) {
  try {
    const { companyCode, dbName } = company;
    console.log(`Setting up auth collection in company database: ${dbName}`);
    
    const companyDb = mainClient.db(dbName);
    
    // Create auth collection if it doesn't exist
    if (!(await companyDb.listCollections({ name: 'auth' }).hasNext())) {
      await companyDb.createCollection('auth');
      console.log(`Created auth collection in ${dbName}`);
    }
    
    // Create indexes
    await companyDb.collection('auth').createIndex({ originalId: 1 }, { unique: true });
    await companyDb.collection('auth').createIndex({ userId: 1 }, { unique: true });
    await companyDb.collection('auth').createIndex({ email: 1 }, { unique: true });
    await companyDb.collection('auth').createIndex({ role: 1 });
    await companyDb.collection('auth').createIndex({ status: 1 });
    await companyDb.collection('auth').createIndex({ syncedToCentral: 1 });
    
    console.log(`Created indexes in ${dbName} auth collection`);
    
    return true;
  } catch (error) {
    console.error(`Error creating auth collection in company ${company.dbName}:`, error);
    return false;
  }
}

// Migrate users from main database to auth database
async function migrateMainUsers() {
  try {
    console.log('Migrating users from main database...');
    const mainDb = mainClient.db(MAIN_DB_NAME);
    const authDb = authClient.db(AUTH_DB_NAME);
    
    // Get all users from main database
    const mainUsers = await mainDb.collection('users').find({}).toArray();
    console.log(`Found ${mainUsers.length} users in main database`);
    
    let migrated = 0;
    
    // Process each user
    for (const user of mainUsers) {
      if (!user.email) {
        console.warn(`Skipping user without email:`, user._id);
        continue;
      }
      
      // Generate consistent userId
      const userId = generateUserId(user.email, 'admin');
      
      // Prepare auth user record
      const authUser = {
        userId,
        originalId: user._id,
        username: user.username,
        email: user.email.toLowerCase(),
        password: user.password,
        role: user.role || 'user',
        status: user.status || 'active',
        companyCode: null, // Main users don't belong to a specific company
        companyName: 'Admin',
        databaseName: MAIN_DB_NAME,
        lastSynced: new Date()
      };
      
      // Insert into auth database
      try {
        await authDb.collection('authUsers').updateOne(
          { userId },
          { $set: authUser },
          { upsert: true }
        );
        migrated++;
      } catch (err) {
        console.error(`Error migrating user ${user.email}:`, err);
      }
    }
    
    console.log(`Migrated ${migrated} users from main database`);
    return migrated;
  } catch (error) {
    console.error('Error migrating main users:', error);
    return 0;
  }
}

// Migrate users from company database to company auth collection and central auth database
async function migrateCompanyUsers(company) {
  try {
    const { companyCode, companyName, dbName } = company;
    console.log(`Migrating users from company database: ${dbName}`);
    
    const companyDb = mainClient.db(dbName);
    const authDb = authClient.db(AUTH_DB_NAME);
    
    // Get all users from company database
    const companyUsers = await companyDb.collection('users').find({}).toArray();
    console.log(`Found ${companyUsers.length} users in company database ${dbName}`);
    
    let migratedToCompanyAuth = 0;
    let migratedToCentralAuth = 0;
    
    // Process each user
    for (const user of companyUsers) {
      if (!user.email) {
        console.warn(`Skipping user without email in ${dbName}:`, user._id);
        continue;
      }
      
      // Generate consistent userId
      const userId = generateUserId(user.email, companyCode);
      
      // Prepare company auth record
      const companyAuthRecord = {
        originalId: user._id,
        userId,
        username: user.username,
        email: user.email.toLowerCase(),
        password: user.password,
        role: user.role || 'user',
        status: user.status || 'pending',
        companyCode,
        companyName,
        syncedToCentral: true,
        originalLastModified: user.updatedAt || user.createdAt || new Date(),
        lastSyncedToCentral: new Date(),
        updatedAt: new Date(),
        createdAt: new Date()
      };
      
      // Prepare central auth record
      const centralAuthRecord = {
        userId,
        originalId: user._id,
        username: user.username,
        email: user.email.toLowerCase(),
        password: user.password,
        role: user.role || 'user',
        status: user.status || 'pending',
        companyCode,
        companyName,
        databaseName: dbName,
        lastSynced: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Insert into company auth collection
      try {
        await companyDb.collection('auth').updateOne(
          { originalId: user._id },
          { $set: companyAuthRecord },
          { upsert: true }
        );
        migratedToCompanyAuth++;
      } catch (err) {
        console.error(`Error migrating user ${user.email} to company auth:`, err);
      }
      
      // Insert into central auth database
      try {
        await authDb.collection('authUsers').updateOne(
          { userId },
          { $set: centralAuthRecord },
          { upsert: true }
        );
        migratedToCentralAuth++;
      } catch (err) {
        console.error(`Error migrating user ${user.email} to central auth:`, err);
      }
    }
    
    console.log(`Migrated ${migratedToCompanyAuth} users to company auth and ${migratedToCentralAuth} to central auth`);
    return { migratedToCompanyAuth, migratedToCentralAuth };
  } catch (error) {
    console.error(`Error migrating company users for ${company.dbName}:`, error);
    return { migratedToCompanyAuth: 0, migratedToCentralAuth: 0 };
  }
}

// Main migration function
async function runMigration() {
  try {
    // Create auth database structure
    await createAuthStructure();
    
    // Get all company databases
    const companies = await getAllCompanyDatabases();
    console.log(`Found ${companies.length} company databases`);
    
    // Create auth collection in each company database
    for (const company of companies) {
      await createCompanyAuthCollection(company);
    }
    
    // Migrate main users
    const mainMigrated = await migrateMainUsers();
    
    // Migrate company users
    let totalCompanyMigrated = 0;
    let totalCentralMigrated = 0;
    
    for (const company of companies) {
      const { migratedToCompanyAuth, migratedToCentralAuth } = await migrateCompanyUsers(company);
      totalCompanyMigrated += migratedToCompanyAuth;
      totalCentralMigrated += migratedToCentralAuth;
    }
    
    console.log('===== Migration Summary =====');
    console.log(`Main users migrated: ${mainMigrated}`);
    console.log(`Company users migrated to company auth: ${totalCompanyMigrated}`);
    console.log(`Company users migrated to central auth: ${totalCentralMigrated}`);
    console.log('============================');
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error in migration process:', error);
    process.exit(1);
  } finally {
    // Close MongoDB connections
    if (mainClient) await mainClient.close();
    if (authClient) await authClient.close();
  }
}

// Start migration
async function startMigration() {
  console.log('Starting auth migration process...');
  
  const connected = await connectToMongoDB();
  if (!connected) {
    console.error('Could not connect to MongoDB. Exiting...');
    process.exit(1);
  }
  
  await runMigration();
  
  console.log('Auth migration completed');
  process.exit(0);
}

// Handle termination signals
process.on('SIGINT', async () => {
  console.log('Auth migration process shutting down...');
  if (mainClient) await mainClient.close();
  if (authClient) await authClient.close();
  process.exit(0);
});

// Start the migration process
startMigration(); 
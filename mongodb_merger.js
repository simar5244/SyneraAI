#!/usr/bin/env node

/**
 * Integration Data Merger Service
 * 
 * This script runs continuously to monitor all company databases and
 * merge integration data into user records. It runs as a standalone
 * process and is automatically started with 'npm run dev' or 'npm start'.
 */

// Load environment variables
require('dotenv').config();

const { MongoClient } = require('mongodb');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const COMPANY_DB_PREFIX = 'company_';

// Global variables
let client = null;
const changeStreams = new Map();
let isRunning = false;
let pollInterval = null;

/**
 * Merge integration data to users collection
 */
async function mergeIntegrationDataToUsers(companyCode) {
  let tempClient = null;
  
  try {
    // Validate inputs
    const normalizedCompanyCode = (companyCode || '').trim().toLowerCase();
    
    if (!normalizedCompanyCode) {
      throw new Error('Company code is required');
    }
    
    if (!MONGODB_URI) {
      throw new Error('MongoDB URI is not configured');
    }
    
    console.log(`[Integration Merger] Starting merge for company: ${normalizedCompanyCode}`);
    
    // Connect to MongoDB if not using global client
    if (!client) {
      tempClient = new MongoClient(MONGODB_URI);
      await tempClient.connect();
      useClient = tempClient;
    } else {
      useClient = client;
    }
    
    // Use company-specific database to ensure tenant isolation
    const dbName = `${COMPANY_DB_PREFIX}${normalizedCompanyCode}`;
    const db = useClient.db(dbName);
    
    // Access collections within this company's database only
    const integrationsCollection = db.collection('integrations');
    const usersCollection = db.collection('users');
    
    // Find all integration records with email that haven't been merged yet
    const query = { 
      email: { $exists: true, $ne: null },
      merged: { $ne: true } 
    };
    
    const integrationRecords = await integrationsCollection.find(query).toArray();
    
    if (integrationRecords.length === 0) {
      console.log(`[Integration Merger] No new integration records for company ${normalizedCompanyCode}`);
      return {
        success: true,
        stats: { total: 0, matched: 0, updated: 0, errors: 0, skipped: 0 },
        message: 'No new integration records to process'
      };
    }
    
    console.log(`[Integration Merger] Found ${integrationRecords.length} records to process for company ${normalizedCompanyCode}`);
    
    // Track statistics
    const stats = {
      total: integrationRecords.length,
      matched: 0,
      updated: 0,
      errors: 0,
      skipped: 0
    };
    
    // Process each record
    for (const record of integrationRecords) {
      const email = typeof record.email === 'string' ? record.email.toLowerCase().trim() : record.email;
      
      if (!email) {
        stats.skipped++;
        continue;
      }
      
      try {
        // Find matching user within the same company database by email
        const user = await usersCollection.findOne({ email: email });
        
        if (!user) {
          console.log(`[Integration Merger] No user found with email: ${email} in company ${normalizedCompanyCode}`);
          stats.skipped++;
          continue;
        }
        
        stats.matched++;
        
        // Prepare update data (exclude special fields and metadata)
        const updateData = {};
        const excludedFields = ['_id', 'email', 'password', 'role', 'uploader', 'uploadedAt', 
                              'status', 'merged', 'mergedAt', 'createdAt', 'updatedAt'];
        
        for (const [key, value] of Object.entries(record)) {
          if (!excludedFields.includes(key) && value !== null) {
            updateData[key] = value;
          }
        }
        
        if (Object.keys(updateData).length === 0) {
          console.log(`[Integration Merger] No fields to update for user ${email}`);
          stats.skipped++;
          continue;
        }
        
        // Update the user record with fields from integration data
        // Using $set to add or update fields in user record
        const updateResult = await usersCollection.updateOne(
          { _id: user._id },
          { $set: updateData }
        );
        
        if (updateResult.modifiedCount > 0) {
          stats.updated++;
          console.log(`[Integration Merger] Updated user ${email} with integration data`);
        } else {
          console.log(`[Integration Merger] No changes made to user ${email}`);
        }
        
        // Mark integration record as merged
        await integrationsCollection.updateOne(
          { _id: record._id },
          { 
            $set: { 
              merged: true, 
              mergedAt: new Date(),
              mergedTo: user._id.toString() 
            } 
          }
        );
        
      } catch (error) {
        console.error(`[Integration Merger] Error updating user ${email} in company ${normalizedCompanyCode}:`, error);
        stats.errors++;
      }
    }
    
    // Log results
    console.log(`[Integration Merger] Merge completed for company: ${normalizedCompanyCode}`);
    console.log(`Total: ${stats.total}, Matched: ${stats.matched}, Updated: ${stats.updated}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`);
    
    return {
      success: true,
      stats,
      message: `Successfully merged ${stats.updated} integration records for company ${normalizedCompanyCode}`
    };
    
  } catch (error) {
    console.error(`[Integration Merger] Error merging data for company ${companyCode}:`, error);
    return {
      success: false,
      message: 'Failed to merge integration data',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    // Only close the connection if we created a temporary client
    if (tempClient) {
      await tempClient.close();
    }
  }
}

/**
 * Watch for changes in a specific company's integrations collection
 */
async function watchCompanyIntegrations(companyCode) {
  if (!client) {
    throw new Error('MongoDB client not initialized');
  }
  
  // Skip if already watching this company
  if (changeStreams.has(companyCode)) {
    return;
  }
  
  const dbName = `${COMPANY_DB_PREFIX}${companyCode}`;
  const db = client.db(dbName);
  const collection = db.collection('integrations');
  
  console.log(`Setting up change stream for ${dbName}.integrations`);
  
  try {
    // Create a change stream to watch for new documents or changes
    const changeStream = collection.watch(
      [{ $match: { operationType: { $in: ['insert', 'update'] } } }],
      { fullDocument: 'updateLookup' }
    );
    
    // Handle change events
    changeStream.on('change', async (change) => {
      if (change.operationType === 'insert' || change.operationType === 'update') {
        console.log(`[${new Date().toISOString()}] Detected change in ${dbName}.integrations`);
        
        // Check if the affected document has an email and hasn't been merged
        const doc = change.fullDocument;
        if (doc && doc.email && doc.merged !== true) {
          try {
            // Process the merge for this company only
            await mergeIntegrationDataToUsers(companyCode);
          } catch (error) {
            console.error(`Error processing automatic merge for ${companyCode}:`, error);
          }
        }
      }
    });
    
    // Handle errors
    changeStream.on('error', (error) => {
      console.error(`Error in change stream for ${dbName}.integrations:`, error);
      
      // Try to recover by recreating the change stream
      setTimeout(() => {
        if (isRunning) {
          watchCompanyIntegrations(companyCode).catch(console.error);
        }
      }, 5000); // Wait 5 seconds before retrying
    });
    
    // Store the change stream
    changeStreams.set(companyCode, changeStream);
    
    console.log(`Change stream active for ${dbName}.integrations`);
  } catch (error) {
    console.error(`Error setting up change stream for ${dbName}:`, error);
  }
}

/**
 * Watch for new company databases being created
 */
function watchForNewCompanies() {
  // Use polling to detect new company databases
  if (pollInterval) {
    clearInterval(pollInterval);
  }
  
  pollInterval = setInterval(async () => {
    if (!client || !isRunning) return;
    
    try {
      // Get current list of company databases
      const dbs = await client.db().admin().listDatabases();
      const companyDbs = dbs.databases
        .filter(db => db.name.startsWith(COMPANY_DB_PREFIX))
        .map(db => db.name.substring(COMPANY_DB_PREFIX.length));
      
      // Check for any companies we're not already monitoring
      for (const companyCode of companyDbs) {
        if (!changeStreams.has(companyCode)) {
          console.log(`Discovered new company database: ${companyCode}`);
          
          // Check if integrations collection exists
          const db = client.db(`${COMPANY_DB_PREFIX}${companyCode}`);
          const collections = await db.listCollections({ name: 'integrations' }).toArray();
          
          if (collections.length > 0) {
            // Process any existing data first
            await mergeIntegrationDataToUsers(companyCode);
            
            // Then set up the watcher
            await watchCompanyIntegrations(companyCode);
          }
        }
      }
    } catch (error) {
      console.error('Error checking for new company databases:', error);
    }
  }, 30000); // Check every 30 seconds
}

/**
 * Regularly process all companies to make sure none are missed
 */
function scheduledMergeAll() {
  setInterval(async () => {
    if (!client || !isRunning) return;
    
    try {
      console.log('[Scheduled Merge] Running scheduled merge for all companies');
      
      // Get all company databases
      const dbs = await client.db().admin().listDatabases();
      const companyDbs = dbs.databases
        .filter(db => db.name.startsWith(COMPANY_DB_PREFIX))
        .map(db => db.name.substring(COMPANY_DB_PREFIX.length));
      
      // Process each company
      for (const companyCode of companyDbs) {
        try {
          await mergeIntegrationDataToUsers(companyCode);
        } catch (error) {
          console.error(`Error in scheduled merge for ${companyCode}:`, error);
        }
      }
      
      console.log('[Scheduled Merge] Completed scheduled merge for all companies');
    } catch (error) {
      console.error('Error in scheduled merge all:', error);
    }
  }, 300000); // Run every 5 minutes (300000 ms)
}

/**
 * Start the integration data merger service
 */
async function start() {
  if (isRunning) {
    console.log('Integration data merger is already running');
    return;
  }
  
  if (!MONGODB_URI) {
    throw new Error('MongoDB URI is not configured');
  }
  
  try {
    // Connect to MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Integration data merger connected to MongoDB');
    
    // Find all company databases
    const dbs = await client.db().admin().listDatabases();
    const companyDbs = dbs.databases.filter(db => 
      db.name.startsWith(COMPANY_DB_PREFIX)
    );
    
    console.log(`Found ${companyDbs.length} company databases to monitor`);
    
    // Set up watchers for each company database
    for (const dbInfo of companyDbs) {
      const dbName = dbInfo.name;
      const companyCode = dbName.substring(COMPANY_DB_PREFIX.length);
      
      // Check if the integrations collection exists
      const db = client.db(dbName);
      const collections = await db.listCollections({ name: 'integrations' }).toArray();
      
      if (collections.length > 0) {
        // Process any existing unmerged data first
        await mergeIntegrationDataToUsers(companyCode);
        
        // Then set up the watcher
        await watchCompanyIntegrations(companyCode);
      }
    }
    
    // Set up a watcher for new databases to handle new companies
    watchForNewCompanies();
    
    // Set up scheduled processing to ensure nothing is missed
    scheduledMergeAll();
    
    isRunning = true;
    console.log('Integration data merger started successfully');
    
  } catch (error) {
    console.error('Error starting integration data merger:', error);
    await shutdown();
    throw error;
  }
}

/**
 * Shutdown the merger service
 */
async function shutdown() {
  try {
    // Clear the polling interval
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    
    // Close all change streams
    for (const [companyCode, stream] of Array.from(changeStreams.entries())) {
      try {
        console.log(`Closing change stream for company ${companyCode}`);
        await stream.close();
      } catch (err) {
        console.error(`Error closing change stream for ${companyCode}:`, err);
      }
    }
    
    // Clear the map
    changeStreams.clear();
    
    // Close the MongoDB connection
    if (client) {
      await client.close();
      client = null;
    }
    
    isRunning = false;
    console.log('Integration data merger shut down');
  } catch (error) {
    console.error('Error during integration data merger shutdown:', error);
    throw error;
  }
}

/**
 * Handle process termination signals
 */
function setupSignalHandlers() {
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down Integration Data Merger service...');
    await shutdown();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down Integration Data Merger service...');
    await shutdown();
    process.exit(0);
  });
  
  // Handle unhandled rejections
  process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection in Integration Data Merger:', error);
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception in Integration Data Merger:', error);
    
    // Try to shutdown gracefully, then exit
    shutdown().catch(console.error).finally(() => {
      process.exit(1);
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log('Starting Integration Data Merger service...');
  
  // Set up signal handlers
  setupSignalHandlers();
  
  try {
    // Start the service
    await start();
    
    console.log('Integration Data Merger service is running continuously.');
    console.log('Press Ctrl+C to stop the service.');
    
    // Keep the process running
    setInterval(() => {
      // This is just to keep the process alive
      // The actual work happens in the change streams and scheduled tasks
    }, 60000);
    
  } catch (error) {
    console.error('Fatal error in Integration Data Merger service:', error);
    process.exit(1);
  }
}

// Start the service
main().catch(console.error); 
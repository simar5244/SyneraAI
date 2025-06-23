/**
 * Scheduled Integration Data Merger
 * 
 * This script sets up a scheduled job to automatically merge data from the 
 * 'integrations' collection into the 'users' collection for specified companies.
 * 
 * Usage:
 *   node scripts/schedule-integration-merge.js
 * 
 * Configure the script by editing the COMPANIES and SCHEDULE constants below.
 * 
 * Requirements:
 *   - npm install node-cron
 *   - npm install mongodb
 *   - npm install dotenv
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');
const cron = require('node-cron');

// MongoDB connection string
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('ERROR: MONGODB_URI environment variable is not set');
  process.exit(1);
}

// Configure companies to process
const COMPANIES = [
  // Add your company codes here
  // Example: 'abc123',
];

// Configure the schedule (default: run daily at 2:00 AM)
// Cron format: second(optional) minute hour day-of-month month day-of-week
const SCHEDULE = process.env.MERGE_SCHEDULE || '0 2 * * *';

// Optional: Update existing fields (default: false)
const UPDATE_EXISTING_FIELDS = process.env.UPDATE_EXISTING_FIELDS === 'true';

/**
 * Merge integration data for a specific company
 */
async function mergeIntegrationsForCompany(companyCode) {
  let client = null;
  
  try {
    console.log(`\n[${new Date().toISOString()}] Starting merge for company: ${companyCode}`);
    
    // Connect to MongoDB
    client = new MongoClient(uri);
    await client.connect();
    
    // Use company specific database
    const dbName = `company_${companyCode}`;
    const db = client.db(dbName);
    
    // Access collections
    const integrationsCollection = db.collection('integrations');
    const usersCollection = db.collection('users');
    
    // Get all integration records with email
    const query = { 
      email: { $exists: true, $ne: null },
      // Optional: Only get records that haven't been merged yet
      // merged: { $ne: true }
    };
    
    const integrationRecords = await integrationsCollection.find(query).toArray();
    
    if (integrationRecords.length === 0) {
      console.log(`No new integration records found for company ${companyCode}`);
      return;
    }
    
    console.log(`Found ${integrationRecords.length} integration records to process for company ${companyCode}`);
    
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
      const email = record.email;
      if (!email) {
        stats.skipped++;
        continue;
      }
      
      try {
        // Find matching user
        const user = await usersCollection.findOne({ email });
        
        if (!user) {
          console.log(`No user found with email: ${email}`);
          stats.skipped++;
          continue;
        }
        
        stats.matched++;
        
        // Prepare update data
        const updateData = {};
        for (const [key, value] of Object.entries(record)) {
          if (!['_id', 'email', 'uploader', 'uploadedAt', 'status', 'type'].includes(key)) {
            updateData[key] = value;
          }
        }
        
        if (Object.keys(updateData).length === 0) {
          stats.skipped++;
          continue;
        }
        
        // Update user
        const updateOperation = UPDATE_EXISTING_FIELDS ? 
          { $set: updateData } : 
          { $setOnInsert: updateData };
        
        const updateResult = await usersCollection.updateOne(
          { email },
          updateOperation,
          { upsert: false }
        );
        
        if (updateResult.modifiedCount > 0) {
          stats.updated++;
        }
        
        // Mark integration record as merged
        await integrationsCollection.updateOne(
          { _id: record._id },
          { $set: { merged: true, mergedAt: new Date() } }
        );
        
      } catch (error) {
        console.error(`Error updating user ${email}:`, error.message);
        stats.errors++;
      }
    }
    
    // Log results
    console.log(`\n[${new Date().toISOString()}] Merge completed for company: ${companyCode}`);
    console.log(`Total records processed: ${stats.total}`);
    console.log(`Users matched: ${stats.matched}`);
    console.log(`Users updated: ${stats.updated}`);
    console.log(`Records skipped: ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error merging data for company ${companyCode}:`, error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

/**
 * Run merge for all configured companies
 */
async function runMergeForAllCompanies() {
  if (COMPANIES.length === 0) {
    console.warn('No companies configured. Add company codes to the COMPANIES array.');
    return;
  }
  
  console.log(`[${new Date().toISOString()}] Starting scheduled merge for ${COMPANIES.length} companies`);
  
  for (const companyCode of COMPANIES) {
    await mergeIntegrationsForCompany(companyCode);
  }
  
  console.log(`[${new Date().toISOString()}] Completed all scheduled merges`);
}

// Validate configuration
if (COMPANIES.length === 0) {
  console.warn('Warning: No companies configured in the COMPANIES array.');
  console.warn('Please edit the script to add company codes.');
}

// Test cron schedule validity
if (!cron.validate(SCHEDULE)) {
  console.error(`ERROR: Invalid cron schedule: ${SCHEDULE}`);
  process.exit(1);
}

// Schedule the job
console.log(`Scheduling integration merge job with schedule: ${SCHEDULE}`);
cron.schedule(SCHEDULE, () => {
  runMergeForAllCompanies().catch(error => {
    console.error('Scheduled job error:', error);
  });
});

console.log('Integration merge scheduler is running...');
console.log('Press Ctrl+C to stop');

// If you want to run immediately on startup as well:
if (process.env.RUN_ON_STARTUP === 'true') {
  console.log('Running initial merge on startup...');
  runMergeForAllCompanies().catch(console.error);
} 
/**
 * Script to merge integration data into user records
 * 
 * This script connects directly to the MongoDB database and merges data 
 * from the 'integrations' collection into the 'users' collection
 * by matching email addresses.
 * 
 * Usage:
 *   node scripts/merge-integrations.js --company=COMPANY_CODE [options]
 * 
 * Options:
 *   --company=CODE      Required: Company code to specify which database to use
 *   --dry-run           Only simulate the merge without making changes
 *   --update-existing   Update fields even if they already exist in the user document
 *   --email=EMAIL       Process only the specified email (can be used multiple times)
 * 
 * Examples:
 *   node scripts/merge-integrations.js --company=abc123
 *   node scripts/merge-integrations.js --company=abc123 --dry-run
 *   node scripts/merge-integrations.js --company=abc123 --email=user@example.com
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('ERROR: MONGODB_URI environment variable is not set');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  companyCode: null,
  dryRun: false,
  updateExistingFields: false,
  emails: []
};

for (const arg of args) {
  if (arg.startsWith('--company=')) {
    options.companyCode = arg.split('=')[1];
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--update-existing') {
    options.updateExistingFields = true;
  } else if (arg.startsWith('--email=')) {
    options.emails.push(arg.split('=')[1]);
  }
}

// Validate required arguments
if (!options.companyCode) {
  console.error('ERROR: Company code is required');
  console.error('Usage: node scripts/merge-integrations.js --company=COMPANY_CODE [options]');
  process.exit(1);
}

async function mergeIntegrations() {
  let client = null;
  
  try {
    // Connect to MongoDB
    console.log(`Connecting to MongoDB...`);
    client = new MongoClient(uri);
    await client.connect();
    console.log('Connected to MongoDB');
    
    // Use company specific database
    const dbName = `company_${options.companyCode}`;
    console.log(`Using database: ${dbName}`);
    const db = client.db(dbName);
    
    // Access collections
    const integrationsCollection = db.collection('integrations');
    const usersCollection = db.collection('users');
    
    // Build query for integrations
    const query = options.emails.length > 0 ? 
      { email: { $in: options.emails } } : 
      { email: { $exists: true, $ne: null } };
    
    // Get integration records
    const integrationRecords = await integrationsCollection.find(query).toArray();
    
    if (integrationRecords.length === 0) {
      console.log('No integration records with email field found');
      return;
    }
    
    console.log(`Found ${integrationRecords.length} integration records with email field`);
    
    // Track statistics
    const stats = {
      total: integrationRecords.length,
      matched: 0,
      updated: 0,
      errors: 0,
      skipped: 0
    };
    
    // Process the records
    if (options.dryRun) {
      console.log('DRY RUN MODE: No changes will be made to the database');
    }
    
    for (const record of integrationRecords) {
      const email = record.email;
      if (!email) {
        stats.skipped++;
        continue;
      }
      
      // Find matching user
      const user = await usersCollection.findOne({ email });
      
      if (!user) {
        console.log(`No user found with email: ${email}`);
        stats.skipped++;
        continue;
      }
      
      stats.matched++;
      
      // Prepare update object
      const updateData = {};
      for (const [key, value] of Object.entries(record)) {
        // Skip MongoDB internal fields and fields used for matching
        if (!['_id', 'email', 'uploader', 'uploadedAt', 'status', 'type'].includes(key)) {
          updateData[key] = value;
        }
      }
      
      // Skip if no fields to update
      if (Object.keys(updateData).length === 0) {
        console.log(`No fields to update for user: ${email}`);
        stats.skipped++;
        continue;
      }
      
      // In dry run mode, just log what would be updated
      if (options.dryRun) {
        console.log(`Would update user ${email} with fields: ${Object.keys(updateData).join(', ')}`);
        continue;
      }
      
      try {
        // Determine update operation based on options
        const updateOperation = options.updateExistingFields ? 
          { $set: updateData } : 
          { $setOnInsert: updateData };
        
        // Update the user record
        const updateResult = await usersCollection.updateOne(
          { email },
          updateOperation,
          { upsert: false }
        );
        
        if (updateResult.modifiedCount > 0) {
          console.log(`Updated user: ${email}`);
          stats.updated++;
        } else {
          console.log(`No changes needed for user: ${email}`);
        }
      } catch (error) {
        console.error(`Error updating user ${email}:`, error.message);
        stats.errors++;
      }
    }
    
    // Print final statistics
    console.log('\nMERGE RESULTS:');
    console.log(`Total records processed: ${stats.total}`);
    console.log(`Users matched: ${stats.matched}`);
    console.log(`Users updated: ${options.dryRun ? '0 (dry run)' : stats.updated}`);
    console.log(`Records skipped: ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    
  } catch (error) {
    console.error('Error merging integration data:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

// Run the script
mergeIntegrations().catch(console.error); 
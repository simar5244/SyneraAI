#!/usr/bin/env node

/**
 * EMERGENCY DIRECT MERGE SCRIPT
 * Directly merges integration data to users for company_7pmjdlir
 * with robust connection handling and debug
 */

// Load environment variables
require('dotenv').config();

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Company code to process
const COMPANY_CODE = '7pmjdlir';
const COMPANY_DB_PREFIX = 'company_';

// Try to detect MongoDB URI from various sources
function getMongoDB_URI() {
  // First check environment variable
  if (process.env.MONGODB_URI) {
    console.log('Using MONGODB_URI from environment');
    return process.env.MONGODB_URI;
  }

  // Try to read from .env file
  try {
    if (fs.existsSync('.env')) {
      const envContent = fs.readFileSync('.env', 'utf8');
      const match = envContent.match(/MONGODB_URI=(.+)/);
      if (match && match[1]) {
        console.log('Using MONGODB_URI from .env file');
        return match[1];
      }
    }
  } catch (err) {
    console.log('Error reading .env file:', err.message);
  }

  // Also check .env.local
  try {
    if (fs.existsSync('.env.local')) {
      const envContent = fs.readFileSync('.env.local', 'utf8');
      const match = envContent.match(/MONGODB_URI=(.+)/);
      if (match && match[1]) {
        console.log('Using MONGODB_URI from .env.local file');
        return match[1];
      }
    }
  } catch (err) {
    console.log('Error reading .env.local file:', err.message);
  }

  // Check inside next.config.js for MongoDB URI
  try {
    if (fs.existsSync('next.config.js')) {
      const configContent = fs.readFileSync('next.config.js', 'utf8');
      const match = configContent.match(/MONGODB_URI: ['"](.+)['"]/);
      if (match && match[1]) {
        console.log('Using MONGODB_URI from next.config.js');
        return match[1];
      }
    }
  } catch (err) {
    console.log('Error reading next.config.js file:', err.message);
  }

  // Last resort - use default
  console.log('Falling back to default MongoDB URI');
  return 'mongodb://localhost:27017';
}

// Get the MongoDB URI
const MONGODB_URI = getMongoDB_URI();

console.log('MongoDB URI (masked): ' + MONGODB_URI.replace(/mongodb:\/\/([^:]+):([^@]+)@/, 'mongodb://***:***@'));

async function emergencyMerge() {
  let client = null;
  
  try {
    console.log(`[EMERGENCY MERGE] Starting merge for company: ${COMPANY_CODE}`);
    
    // Connect to MongoDB with better options for reliability
    client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 60000,
    });
    
    await client.connect();
    console.log(`[EMERGENCY MERGE] Connected to MongoDB`);
    
    // Use company-specific database
    const dbName = `${COMPANY_DB_PREFIX}${COMPANY_CODE}`;
    const db = client.db(dbName);
    
    console.log(`[EMERGENCY MERGE] Accessing database: ${dbName}`);
    
    // List all collections in the database
    const collections = await db.listCollections().toArray();
    console.log(`[EMERGENCY MERGE] Found collections: ${collections.map(c => c.name).join(', ')}`);
    
    // Verify integrations and users collections exist
    if (!collections.some(c => c.name === 'integrations')) {
      console.error(`[EMERGENCY MERGE] ERROR: 'integrations' collection not found!`);
      return;
    }
    
    if (!collections.some(c => c.name === 'users')) {
      console.error(`[EMERGENCY MERGE] ERROR: 'users' collection not found!`);
      return;
    }
    
    // Access collections
    const integrationsCollection = db.collection('integrations');
    const usersCollection = db.collection('users');
    
    // Count records in each collection
    const integrationsCount = await integrationsCollection.countDocuments();
    const usersCount = await usersCollection.countDocuments();
    console.log(`[EMERGENCY MERGE] Found ${integrationsCount} integrations and ${usersCount} users`);
    
    // First, check for records without merged flag
    const query = { 
      email: { $exists: true, $ne: null },
      merged: { $ne: true } 
    };
    
    console.log(`[EMERGENCY MERGE] Searching for unmerged integration records...`);
    const integrationRecords = await integrationsCollection.find(query).toArray();
    
    console.log(`[EMERGENCY MERGE] Found ${integrationRecords.length} integration records to process`);
    
    // If no records match the query, try to check why (maybe all are already merged)
    if (integrationRecords.length === 0) {
      // Show sample of latest integration records to debug
      const sampleRecords = await integrationsCollection.find().sort({ _id: -1 }).limit(3).toArray();
      console.log(`[EMERGENCY MERGE] Sample of recent integration records:`, 
                 JSON.stringify(sampleRecords.map(r => ({ 
                   email: r.email, 
                   merged: r.merged,
                   fields: Object.keys(r).filter(k => !['_id', 'email', 'merged', 'mergedAt'].includes(k))
                 })), null, 2));
      
      // Force merge ALL records even if they're marked merged
      console.log(`[EMERGENCY MERGE] No unmerged records found. Trying ALL records with email...`);
      const allQuery = { 
        email: { $exists: true, $ne: null }
      };
      const allRecords = await integrationsCollection.find(allQuery).toArray();
      console.log(`[EMERGENCY MERGE] Found ${allRecords.length} total integration records with email`);
      
      if (allRecords.length > 0) {
        console.log(`[EMERGENCY MERGE] FORCING MERGE of all records regardless of merge status!`);
        await processRecords(allRecords, integrationsCollection, usersCollection, true);
      } else {
        console.log(`[EMERGENCY MERGE] No integration records with email field found. Nothing to merge.`);
      }
      
      return;
    }
    
    // Process the unmerged records
    await processRecords(integrationRecords, integrationsCollection, usersCollection, false);
    
  } catch (error) {
    console.error(`[EMERGENCY MERGE] Error:`, error);
  } finally {
    if (client) {
      await client.close();
      console.log(`[EMERGENCY MERGE] MongoDB connection closed`);
    }
  }
}

async function processRecords(records, integrationsCollection, usersCollection, forceMode) {
  // Track statistics
  let matched = 0;
  let updated = 0;
  let errors = 0;
  let skipped = 0;
  
  // Process each record
  for (const record of records) {
    const email = typeof record.email === 'string' ? record.email.toLowerCase().trim() : record.email;
    
    console.log(`[EMERGENCY MERGE] Processing record with email: ${email}`);
    
    if (!email) {
      skipped++;
      console.log(`[EMERGENCY MERGE] Skipping record with no email`);
      continue;
    }
    
    try {
      // Find matching user by email
      const user = await usersCollection.findOne({ email: email });
      
      if (!user) {
        console.log(`[EMERGENCY MERGE] No user found with email: ${email}`);
        skipped++;
        continue;
      }
      
      matched++;
      console.log(`[EMERGENCY MERGE] Found matching user: ${user._id}`);
      
      // Show user data for debugging
      console.log(`[EMERGENCY MERGE] User record fields: ${Object.keys(user).join(', ')}`);
      
      // Prepare update data (exclude special fields and metadata)
      const updateData = {};
      const excludedFields = ['_id', 'email', 'password', 'role', 'uploader', 'uploadedAt', 
                            'status', 'merged', 'mergedAt', 'createdAt', 'updatedAt'];
      
      for (const [key, value] of Object.entries(record)) {
        if (!excludedFields.includes(key) && value !== null) {
          updateData[key] = value;
        }
      }
      
      console.log(`[EMERGENCY MERGE] Fields to update: ${Object.keys(updateData).join(', ')}`);
      
      if (Object.keys(updateData).length === 0) {
        console.log(`[EMERGENCY MERGE] No fields to update for user ${email}`);
        skipped++;
        continue;
      }
      
      // Update the user record with fields from integration data
      const updateResult = await usersCollection.updateOne(
        { _id: user._id },
        { $set: updateData }
      );
      
      if (updateResult.modifiedCount > 0) {
        updated++;
        console.log(`[EMERGENCY MERGE] Updated user ${email} with integration data`);
      } else {
        console.log(`[EMERGENCY MERGE] No changes made to user ${email} (fields already exist or match)`);
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
      console.log(`[EMERGENCY MERGE] Marked integration record as merged`);
      
    } catch (error) {
      console.error(`[EMERGENCY MERGE] Error updating user ${email}:`, error);
      errors++;
    }
  }
  
  // Log results
  console.log(`[EMERGENCY MERGE] Merge ${forceMode ? '(FORCED MODE)' : ''} completed for company: ${COMPANY_CODE}`);
  console.log(`Total: ${records.length}, Matched: ${matched}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
}

console.log('Starting emergency direct merge...');
emergencyMerge().then(() => {
  console.log('Emergency merge completed');
}).catch(error => {
  console.error('Error in emergency merge:', error);
}); 
#!/usr/bin/env node

/**
 * EMERGENCY MERGE SCRIPT
 * Directly merges integration data for company_7pmjdlir
 */

// Load environment variables
require('dotenv').config();

const { MongoClient } = require('mongodb');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const COMPANY_CODE = '7pmjdlir';
const COMPANY_DB_PREFIX = 'company_';

async function emergencyMerge() {
  let client = null;
  
  try {
    console.log(`[EMERGENCY MERGE] Starting merge for company: ${COMPANY_CODE}`);
    
    // Connect to MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log(`[EMERGENCY MERGE] Connected to MongoDB`);
    
    // Use company-specific database
    const dbName = `${COMPANY_DB_PREFIX}${COMPANY_CODE}`;
    const db = client.db(dbName);
    
    console.log(`[EMERGENCY MERGE] Accessing database: ${dbName}`);
    
    // List collections to verify they exist
    const collections = await db.listCollections().toArray();
    console.log(`[EMERGENCY MERGE] Found collections: ${collections.map(c => c.name).join(', ')}`);
    
    // Access collections
    const integrationsCollection = db.collection('integrations');
    const usersCollection = db.collection('users');
    
    // Count records in each collection
    const integrationsCount = await integrationsCollection.countDocuments();
    const usersCount = await usersCollection.countDocuments();
    console.log(`[EMERGENCY MERGE] Found ${integrationsCount} integrations and ${usersCount} users`);
    
    // Find all integration records with email that haven't been merged yet
    const query = { 
      email: { $exists: true, $ne: null },
      merged: { $ne: true } 
    };
    
    console.log(`[EMERGENCY MERGE] Searching for unmerged integration records with query:`, query);
    const integrationRecords = await integrationsCollection.find(query).toArray();
    
    console.log(`[EMERGENCY MERGE] Found ${integrationRecords.length} integration records to process`);
    
    if (integrationRecords.length === 0) {
      // Show sample of latest integration records to debug why none match our query
      const sampleRecords = await integrationsCollection.find().limit(3).toArray();
      console.log(`[EMERGENCY MERGE] Sample of recent integration records:`, JSON.stringify(sampleRecords, null, 2));
      return;
    }
    
    // Track statistics
    let matched = 0;
    let updated = 0;
    let errors = 0;
    let skipped = 0;
    
    // Process each record
    for (const record of integrationRecords) {
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
          console.log(`[EMERGENCY MERGE] No changes made to user ${email}`);
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
    console.log(`[EMERGENCY MERGE] Merge completed for company: ${COMPANY_CODE}`);
    console.log(`Total: ${integrationRecords.length}, Matched: ${matched}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
    
  } catch (error) {
    console.error(`[EMERGENCY MERGE] Error:`, error);
  } finally {
    if (client) {
      await client.close();
      console.log(`[EMERGENCY MERGE] MongoDB connection closed`);
    }
  }
}

console.log('Starting emergency merge...');
emergencyMerge().then(() => {
  console.log('Emergency merge completed');
}).catch(error => {
  console.error('Error in emergency merge:', error);
}); 
/**
 * Immediate Integration Data Merger Utility
 * 
 * This utility provides a simple function to merge data from the integrations collection
 * to the users collection for a specific company. It's designed to be called
 * directly from API routes immediately after new integration data is added.
 */

const { MongoClient } = require('mongodb');

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI || '';
const COMPANY_DB_PREFIX = 'company_';

/**
 * Merge integration data to users immediately
 * 
 * @param {string} companyCode - The company code
 * @returns {Promise<Object>} Result object with stats and status
 */
async function mergeIntegrationDataNow(companyCode) {
  console.log(`[Integration Merger] Starting immediate merge for company: ${companyCode}`);
  
  // Validate inputs
  if (!companyCode) {
    console.error('[Integration Merger] Company code is required');
    return { success: false, message: 'Company code is required' };
  }
  
  if (!MONGODB_URI) {
    console.error('[Integration Merger] MongoDB URI is not configured');
    return { success: false, message: 'MongoDB URI is not configured' };
  }
  
  let client = null;
  
  try {
    // Connect to MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    // Use company-specific database to ensure tenant isolation
    const dbName = `${COMPANY_DB_PREFIX}${companyCode.toLowerCase()}`;
    const db = client.db(dbName);
    
    console.log(`[Integration Merger] Connected to database: ${dbName}`);
    
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
      console.log(`[Integration Merger] No new records to merge for company ${companyCode}`);
      return {
        success: true,
        stats: { total: 0, matched: 0, updated: 0, errors: 0, skipped: 0 },
        message: 'No new integration records to merge'
      };
    }
    
    console.log(`[Integration Merger] Found ${integrationRecords.length} records to process`);
    
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
        // Find matching user by email
        const user = await usersCollection.findOne({ email: email });
        
        if (!user) {
          console.log(`[Integration Merger] No user found with email: ${email}`);
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
          stats.skipped++;
          continue;
        }
        
        // Update the user record with fields from integration data
        const updateResult = await usersCollection.updateOne(
          { _id: user._id },
          { $set: updateData }
        );
        
        if (updateResult.modifiedCount > 0) {
          stats.updated++;
          console.log(`[Integration Merger] Updated user ${email} with integration data`);
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
        console.error(`[Integration Merger] Error updating user ${email}:`, error);
        stats.errors++;
      }
    }
    
    // Log results
    console.log(`[Integration Merger] Merge completed for company: ${companyCode}`);
    console.log(`Total: ${stats.total}, Matched: ${stats.matched}, Updated: ${stats.updated}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`);
    
    return {
      success: true,
      stats,
      message: `Successfully merged ${stats.updated} integration records`
    };
    
  } catch (error) {
    console.error(`[Integration Merger] Error:`, error);
    return {
      success: false,
      message: 'Failed to merge integration data',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    if (client) {
      await client.close();
    }
  }
}

module.exports = { mergeIntegrationDataNow }; 
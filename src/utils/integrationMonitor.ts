import { MongoClient, ChangeStream } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const COMPANY_DB_PREFIX = 'company_';

/**
 * Core utility for automatically merging integration data with user records
 * Ensures strict multi-tenant isolation by operating only within company-specific databases
 */
export async function mergeIntegrationData(companyCode: string): Promise<{
  success: boolean;
  stats?: {
    total: number;
    matched: number;
    updated: number;
    errors: number;
    skipped: number;
  };
  message: string;
  error?: string;
}> {
  let client: MongoClient | null = null;
  
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
    
    // Connect to MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    // Use company-specific database to ensure tenant isolation
    const dbName = `${COMPANY_DB_PREFIX}${normalizedCompanyCode}`;
    const db = client.db(dbName);
    
    // Access collections within this company's database only
    const integrationsCollection = db.collection('integrations');
    const usersCollection = db.collection('users');
    
    // Find integration records with email that haven't been merged yet
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
      const email = record.email;
      if (!email) {
        stats.skipped++;
        continue;
      }
      
      try {
        // Find matching user within the same company database
        const user = await usersCollection.findOne({ email });
        
        if (!user) {
          console.log(`[Integration Merger] No user found with email: ${email} in company ${normalizedCompanyCode}`);
          stats.skipped++;
          continue;
        }
        
        stats.matched++;
        
        // Prepare update data (exclude metadata fields)
        const updateData: any = {};
        for (const [key, value] of Object.entries(record)) {
          if (!['_id', 'email', 'uploader', 'uploadedAt', 'status', 'type', 'merged', 'mergedAt'].includes(key)) {
            updateData[key] = value;
          }
        }
        
        if (Object.keys(updateData).length === 0) {
          stats.skipped++;
          continue;
        }
        
        // Only add new fields from integration data, don't overwrite existing user fields
        const updateResult = await usersCollection.updateOne(
          { email },
          { $setOnInsert: updateData },
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
    if (client) {
      await client.close();
    }
  }
}

/**
 * Unified Integration Monitor that watches all company databases
 * for changes in the integrations collection and triggers automatic merges
 */
class IntegrationMonitor {
  private client: MongoClient | null = null;
  private changeStreams: Map<string, ChangeStream> = new Map();
  private isRunning: boolean = false;
  
  /**
   * Start monitoring all company databases for integration changes
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Integration monitor is already running');
      return;
    }
    
    if (!MONGODB_URI) {
      throw new Error('MongoDB URI is not configured');
    }
    
    try {
      // Connect to MongoDB
      this.client = new MongoClient(MONGODB_URI);
      await this.client.connect();
      console.log('Integration monitor connected to MongoDB');
      
      // Find all company databases
      const dbs = await this.client.db().admin().listDatabases();
      const companyDbs = dbs.databases.filter(db => 
        db.name.startsWith(COMPANY_DB_PREFIX)
      );
      
      console.log(`Found ${companyDbs.length} company databases to monitor`);
      
      // Set up watchers for each company database
      for (const dbInfo of companyDbs) {
        const dbName = dbInfo.name;
        const companyCode = dbName.substring(COMPANY_DB_PREFIX.length);
        
        // Check if the integrations collection exists
        const db = this.client.db(dbName);
        const collections = await db.listCollections({ name: 'integrations' }).toArray();
        
        if (collections.length > 0) {
          await this.watchCompanyIntegrations(companyCode);
        }
      }
      
      // Set up a watcher for new databases to handle new companies
      await this.watchForNewCompanies();
      
      this.isRunning = true;
      console.log('Integration monitor started successfully');
      
    } catch (error) {
      console.error('Error starting integration monitor:', error);
      await this.shutdown();
      throw error;
    }
  }
  
  /**
   * Shutdown the monitor and close all connections
   */
  async shutdown(): Promise<void> {
    try {
      // Close all change streams
      for (const [companyCode, stream] of Array.from(this.changeStreams.entries())) {
        try {
          console.log(`Closing change stream for company ${companyCode}`);
          await stream.close();
        } catch (err) {
          console.error(`Error closing change stream for ${companyCode}:`, err);
        }
      }
      
      // Clear the map
      this.changeStreams.clear();
      
      // Close the MongoDB connection
      if (this.client) {
        await this.client.close();
        this.client = null;
      }
      
      this.isRunning = false;
      console.log('Integration monitor shut down');
    } catch (error) {
      console.error('Error during integration monitor shutdown:', error);
      throw error;
    }
  }
  
  /**
   * Watch for changes in a specific company's integrations collection
   */
  private async watchCompanyIntegrations(companyCode: string): Promise<void> {
    if (!this.client) {
      throw new Error('MongoDB client not initialized');
    }
    
    // Skip if already watching this company
    if (this.changeStreams.has(companyCode)) {
      return;
    }
    
    const dbName = `${COMPANY_DB_PREFIX}${companyCode}`;
    const db = this.client.db(dbName);
    const collection = db.collection('integrations');
    
    console.log(`Setting up change stream for ${dbName}.integrations`);
    
    try {
      // Create a change stream
      const changeStream = collection.watch([
        { 
          $match: { 
            operationType: { $in: ['insert', 'update'] },
            // Only watch unmerged documents
            'fullDocument.merged': { $ne: true }
          } 
        }
      ], { 
        fullDocument: 'updateLookup'
      });
      
      // Handle change events
      changeStream.on('change', async (change) => {
        if (change.operationType === 'insert' || change.operationType === 'update') {
          console.log(`[${new Date().toISOString()}] Detected new integration data in ${dbName}`);
          
          try {
            // Process the merge for this company only
            await mergeIntegrationData(companyCode);
          } catch (error) {
            console.error(`Error processing automatic merge for ${companyCode}:`, error);
          }
        }
      });
      
      // Store the change stream
      this.changeStreams.set(companyCode, changeStream);
      
      console.log(`Change stream active for ${dbName}.integrations`);
    } catch (error) {
      console.error(`Error setting up change stream for ${dbName}:`, error);
    }
  }
  
  /**
   * Watch for new company databases being created
   */
  private async watchForNewCompanies(): Promise<void> {
    // This is a placeholder for advanced functionality to detect new companies
    // For now, we'll use a simple polling approach
    
    setInterval(async () => {
      if (!this.client || !this.isRunning) return;
      
      try {
        // Get current list of company databases
        const dbs = await this.client.db().admin().listDatabases();
        const companyDbs = dbs.databases
          .filter(db => db.name.startsWith(COMPANY_DB_PREFIX))
          .map(db => db.name.substring(COMPANY_DB_PREFIX.length));
        
        // Check for any companies we're not already monitoring
        for (const companyCode of companyDbs) {
          if (!this.changeStreams.has(companyCode)) {
            console.log(`Discovered new company database: ${companyCode}`);
            await this.watchCompanyIntegrations(companyCode);
          }
        }
      } catch (error) {
        console.error('Error checking for new company databases:', error);
      }
    }, 60000); // Check every minute
  }
}

// Create a singleton instance
const integrationMonitor = new IntegrationMonitor();

export default integrationMonitor; 
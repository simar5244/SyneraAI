const { MongoClient } = require('mongodb');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables - try .env.local first, then .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  console.log('Loading environment from .env.local');
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  console.log('Loading environment from .env');
  dotenv.config({ path: envPath });
} else {
  console.log('No .env or .env.local file found');
}

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const SCHEDULED_REPORTS_COLLECTION = "scheduled_reports";
const LOG_FILE = path.resolve(process.cwd(), 'logs/scheduled-reports.log');

// Ensure logs directory exists
const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Logger function
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}\n`;
  
  console.log(logMessage.trim());
  
  // Append to log file
  fs.appendFileSync(LOG_FILE, logMessage);
}

// Function to execute a scheduled report
async function executeScheduledReport(report, companyDbName, adminToken) {
  try {
    log(`Executing scheduled report: ${report._id} - "${report.reportTopic}" for company ${companyDbName}`);
    
    // Call the API to execute the report
    log(`Calling API endpoint to execute report: ${report._id}`, 'DEBUG');
    const response = await fetch(`${API_BASE_URL}/api/scheduled-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        action: 'execute',
        reportId: report._id
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || `API returned status ${response.status}`);
    }
    
    log(`Successfully executed report ${report._id}. Generated report ID: ${result.reportId}`);
    return { success: true, reportId: result.reportId };
  } catch (error) {
    log(`Error executing report ${report._id}: ${error.message}`, 'ERROR');
    if (error.stack) {
      log(`Stack trace: ${error.stack}`, 'ERROR');
    }
    return { success: false, error: error.message };
  }
}

// Main function to check and run scheduled reports
async function runScheduledReports() {
  let client;
  try {
    log('Starting scheduled reports check...');
    
    // Connect to MongoDB
    log('Connecting to MongoDB...', 'DEBUG');
    client = await MongoClient.connect(MONGODB_URI);
    log('Connected to MongoDB');
    
    // Get all database names
    log('Fetching company databases...', 'DEBUG');
    const adminDb = client.db('admin');
    const dbList = await adminDb.admin().listDatabases();
    const companyDbs = dbList.databases
      .filter(db => db.name.startsWith('company_'))
      .map(db => db.name);
    
    log(`Found ${companyDbs.length} company databases`);
    
    // Process each company database
    for (const companyDbName of companyDbs) {
      try {
        log(`Processing company database: ${companyDbName}`, 'DEBUG');
        const companyDb = client.db(companyDbName);
        
        // Check if the scheduled reports collection exists
        const collections = await companyDb.listCollections().toArray();
        const hasScheduledReportsCollection = collections.some(c => c.name === SCHEDULED_REPORTS_COLLECTION);
        
        if (!hasScheduledReportsCollection) {
          log(`Skipping ${companyDbName}: No scheduled reports collection found`);
          continue;
        }
        
        // Get the scheduled reports collection
        const scheduledReportsCollection = companyDb.collection(SCHEDULED_REPORTS_COLLECTION);
        
        // Find reports that need to be executed (nextExecution <= now and isActive = true)
        const now = new Date();
        log(`Finding reports to execute in ${companyDbName} (current time: ${now.toISOString()})`, 'DEBUG');
        const reportsToExecute = await scheduledReportsCollection.find({
          nextExecution: { $lte: now },
          isActive: true
        }).toArray();
        
        log(`Found ${reportsToExecute.length} reports to execute in ${companyDbName}`);
        
        if (reportsToExecute.length === 0) continue;
        
        // Get admin token for this company
        const companyCode = companyDbName.replace('company_', '');
        log(`Getting admin token for company ${companyCode}`, 'DEBUG');
        const adminToken = await getAdminToken(companyCode);
        
        if (!adminToken) {
          log(`Failed to get admin token for ${companyDbName}`, 'ERROR');
          continue;
        }
        
        // Execute each report
        for (const report of reportsToExecute) {
          log(`Processing report: ${report._id} - ${report.reportTopic}`, 'DEBUG');
          const result = await executeScheduledReport(report, companyDbName, adminToken);
          
          if (result.success) {
            log(`Report ${report._id} executed successfully, generated report ID: ${result.reportId}`);
          } else {
            log(`Failed to execute report ${report._id}: ${result.error}`, 'ERROR');
          }
        }
      } catch (companyError) {
        log(`Error processing company database ${companyDbName}: ${companyError.message}`, 'ERROR');
        if (companyError.stack) {
          log(`Stack trace: ${companyError.stack}`, 'ERROR');
        }
      }
    }
    
    log('Scheduled reports check completed');
  } catch (error) {
    log(`Error in runScheduledReports: ${error.message}`, 'ERROR');
    if (error.stack) {
      log(`Stack trace: ${error.stack}`, 'ERROR');
    }
  } finally {
    if (client) {
      await client.close();
      log('MongoDB connection closed');
    }
  }
}

// Function to get an admin token for a company
async function getAdminToken(companyCode) {
  try {
    log(`Getting admin token for company ${companyCode}`);
    
    // Connect to MongoDB to get admin user
    log(`Connecting to MongoDB for company ${companyCode}`, 'DEBUG');
    const client = await MongoClient.connect(MONGODB_URI);
    const companyDb = client.db(`company_${companyCode}`);
    const usersCollection = companyDb.collection('users');
    
    // Find an admin user
    log(`Finding admin user for company ${companyCode}`, 'DEBUG');
    const adminUser = await usersCollection.findOne({ role: 'admin' });
    
    if (!adminUser) {
      log(`No admin user found for company ${companyCode}`, 'ERROR');
      await client.close();
      return null;
    }
    
    log(`Found admin user: ${adminUser.email}`, 'DEBUG');
    
    // For scheduled reports, we'll use a simpler approach - just create a token
    // This avoids having to make an actual login request
    const token = `scheduled_reports_token_${companyCode}_${Date.now()}`;
    log(`Created token for scheduled reports: ${token}`, 'DEBUG');
    
    await client.close();
    return token;
  } catch (error) {
    log(`Error getting admin token for ${companyCode}: ${error.message}`, 'ERROR');
    if (error.stack) {
      log(`Stack trace: ${error.stack}`, 'ERROR');
    }
    return null;
  }
}

// Run the script
runScheduledReports()
  .then(() => {
    log('Script execution completed');
    process.exit(0);
  })
  .catch(error => {
    log(`Unhandled error: ${error.message}`);
    if (error.stack) {
      log(`Stack trace: ${error.stack}`);
    }
    process.exit(1);
  }); 
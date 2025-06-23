const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

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
const SCHEDULED_REPORTS_COLLECTION = "scheduled_reports";
const SAVED_REPORTS_COLLECTION = "saved_reports";
const JWT_SECRET = process.env.JWT_SECRET || 'organization-galaxy-secret-key';
const CHECK_INTERVAL_MS = process.env.REPORT_CHECK_INTERVAL_MS || 30000; // Default to 30 seconds

// Create logs directory if it doesn't exist
const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file setup - create a new log file for each day
function getLogFilePath() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  return path.resolve(logsDir, `scheduled-reports-${dateStr}.log`);
}

// Logger function
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  console.log(logMessage);
  
  // Append to log file
  try {
    fs.appendFileSync(getLogFilePath(), logMessage + '\n');
  } catch (err) {
    console.error(`Error writing to log file: ${err.message}`);
  }
}

// Function to calculate the next execution time based on frequency
function calculateNextExecution(frequency, customMinutes, customHours) {
  const now = new Date();
  
  switch (frequency) {
    case 'daily':
      return new Date(now.setDate(now.getDate() + 1));
    
    case 'weekly':
      return new Date(now.setDate(now.getDate() + 7));
    
    case 'monthly':
      return new Date(now.setMonth(now.getMonth() + 1));
    
    case 'quarterly':
      return new Date(now.setMonth(now.getMonth() + 3));
    
    case 'annually':
      return new Date(now.setFullYear(now.getFullYear() + 1));
    
    case 'custom':
      // Calculate based on custom minutes and hours
      const totalMinutes = (customHours || 0) * 60 + (customMinutes || 0);
      log(`Custom frequency calculation: ${customHours || 0} hours and ${customMinutes || 0} minutes = ${totalMinutes} total minutes`, 'DEBUG');
      if (totalMinutes <= 0) {
        log(`Invalid custom frequency (${totalMinutes} minutes), defaulting to daily`, 'WARN');
        return new Date(now.setDate(now.getDate() + 1)); // Default to daily if invalid
      }
      const nextDate = new Date(now.getTime() + totalMinutes * 60000); // Convert minutes to milliseconds
      log(`Next execution for custom frequency: ${nextDate.toISOString()}`, 'DEBUG');
      return nextDate;
    
    default:
      log(`Unknown frequency "${frequency}", defaulting to daily`, 'WARN');
      return new Date(now.setDate(now.getDate() + 1)); // Default to daily
  }
}

// Function to execute a report using the API endpoint
async function executeReport(report, companyDbName) {
  try {
    log(`Executing report: ${report._id} - ${report.reportTopic} for company ${companyDbName}`, 'INFO');
    
    // Create a fake token for authentication
    const fakeToken = jwt.sign({
      id: report.userId,
      userId: report.userId,
      role: 'user',
      companyCode: companyDbName.replace('company_', '')
    }, JWT_SECRET);
    
    // Call the API endpoint to execute the report
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/scheduled-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${fakeToken}`
      },
      body: JSON.stringify({
        action: 'execute',
        reportId: report._id
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API returned status ${response.status}`);
    }
    
    const result = await response.json();
    log(`Successfully executed report ${report._id}. Generated report ID: ${result.reportId}`, 'INFO');
    return { success: true, reportId: result.reportId };
  } catch (error) {
    log(`Error executing report ${report._id}: ${error.message}`, 'ERROR');
    if (error.stack) {
      log(`Stack trace: ${error.stack}`, 'ERROR');
    }
    return { success: false, error: error.message };
  }
}

// Main function to check and process scheduled reports
async function checkScheduledReports() {
  let client;
  try {
    log('Checking for scheduled reports...', 'INFO');
    
    // Connect to MongoDB
    client = await MongoClient.connect(MONGODB_URI);
    log('Connected to MongoDB', 'DEBUG');
    
    // Get all database names
    const adminDb = client.db('admin');
    const dbList = await adminDb.admin().listDatabases();
    const companyDbs = dbList.databases
      .filter(db => db.name.startsWith('company_'))
      .map(db => db.name);
    
    log(`Found ${companyDbs.length} company databases`, 'INFO');
    
    // Process each company database
    for (const companyDbName of companyDbs) {
      try {
        log(`Processing company database: ${companyDbName}`, 'DEBUG');
        const companyDb = client.db(companyDbName);
        
        // Check if the scheduled reports collection exists
        const collections = await companyDb.listCollections().toArray();
        const hasScheduledReportsCollection = collections.some(c => c.name === SCHEDULED_REPORTS_COLLECTION);
        
        if (!hasScheduledReportsCollection) {
          log(`Skipping ${companyDbName}: No scheduled reports collection found`, 'DEBUG');
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
        
        log(`Found ${reportsToExecute.length} reports to execute in ${companyDbName}`, 'INFO');
        
        // Execute each report
        for (const report of reportsToExecute) {
          try {
            log(`Processing report: ${report._id} - ${report.reportTopic}`, 'INFO');
            log(`Report frequency: ${report.scheduleFrequency}, Custom minutes: ${report.scheduleCustomMinutes || 'N/A'}, Custom hours: ${report.scheduleCustomHours || 'N/A'}`, 'DEBUG');
            
            // Execute the report using the API
            const result = await executeReport(report, companyDbName);
            
            if (result.success) {
              // Calculate next execution time
              const nextExecution = calculateNextExecution(
                report.scheduleFrequency, 
                report.scheduleCustomMinutes, 
                report.scheduleCustomHours
              );
              
              // Update the scheduled report with the execution info
              await scheduledReportsCollection.updateOne(
                { _id: report._id },
                { 
                  $set: {
                    lastExecuted: now,
                    nextExecution: nextExecution
                  },
                  $push: {
                    generatedReportIds: result.reportId
                  }
                }
              );
              
              log(`Updated scheduled report ${report._id} with next execution time: ${nextExecution.toISOString()}`, 'INFO');
            } else {
              log(`Failed to execute report ${report._id}: ${result.error}`, 'ERROR');
            }
          } catch (reportError) {
            log(`Error processing report ${report._id}: ${reportError.message}`, 'ERROR');
            if (reportError.stack) {
              log(`Stack trace: ${reportError.stack}`, 'ERROR');
            }
          }
        }
      } catch (companyError) {
        log(`Error processing company database ${companyDbName}: ${companyError.message}`, 'ERROR');
        if (companyError.stack) {
          log(`Stack trace: ${companyError.stack}`, 'ERROR');
        }
      }
    }
    
    log('Scheduled reports check completed', 'INFO');
  } catch (error) {
    log(`Error in checkScheduledReports: ${error.message}`, 'ERROR');
    if (error.stack) {
      log(`Stack trace: ${error.stack}`, 'ERROR');
    }
  } finally {
    if (client) {
      await client.close();
      log('MongoDB connection closed', 'DEBUG');
    }
  }
}

// Function to run the daemon continuously
async function runDaemon() {
  log(`Starting scheduled reports daemon with check interval of ${CHECK_INTERVAL_MS}ms`, 'INFO');
  
  // Initial check
  try {
    await checkScheduledReports();
  } catch (error) {
    log(`Error during initial check: ${error.message}`, 'ERROR');
    if (error.stack) {
      log(`Stack trace: ${error.stack}`, 'ERROR');
    }
  }
  
  // Set up interval for continuous checking
  setInterval(async () => {
    try {
      await checkScheduledReports();
    } catch (error) {
      log(`Error during scheduled check: ${error.message}`, 'ERROR');
      if (error.stack) {
        log(`Stack trace: ${error.stack}`, 'ERROR');
      }
    }
  }, CHECK_INTERVAL_MS);
  
  // Keep the process running
  log('Daemon is now running continuously...', 'INFO');
  
  // Handle process termination
  process.on('SIGINT', () => {
    log('Received SIGINT signal. Shutting down daemon...', 'INFO');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    log('Received SIGTERM signal. Shutting down daemon...', 'INFO');
    process.exit(0);
  });
  
  // Handle uncaught exceptions to prevent daemon from crashing
  process.on('uncaughtException', (error) => {
    log(`Uncaught exception: ${error.message}`, 'ERROR');
    if (error.stack) {
      log(`Stack trace: ${error.stack}`, 'ERROR');
    }
    // Continue running despite the error
  });
}

// Start the daemon
runDaemon().catch(error => {
  log(`Fatal error starting daemon: ${error.message}`, 'FATAL');
  if (error.stack) {
    log(`Stack trace: ${error.stack}`, 'FATAL');
  }
  process.exit(1);
}); 
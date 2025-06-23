const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const jwt = require('jsonwebtoken');
const http = require('http');

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

// Function to check if the server is running
function isServerRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000/api/health', (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    }).on('error', () => {
      resolve(false);
    });
    
    req.setTimeout(3000, () => {
      req.abort();
      resolve(false);
    });
  });
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
      if (totalMinutes <= 0) return new Date(now.setDate(now.getDate() + 1)); // Default to daily if invalid
      return new Date(now.getTime() + totalMinutes * 60000); // Convert minutes to milliseconds
    
    default:
      return new Date(now.setDate(now.getDate() + 1)); // Default to daily
  }
}

// Function to execute the NextJS API route directly via curl
async function executeReportGenerationAPI(report, lastReport = null) {
  return new Promise((resolve, reject) => {
    console.log(`Generating report for: ${report.reportTopic}`);
    
    try {
      // Create a JWT token for authentication
      const token = jwt.sign({
        id: report.userId,
        userId: report.userId,
        role: 'user',
        companyCode: report.companyCode,
        email: `scheduled-report-${report._id}@system.local`
      }, JWT_SECRET, { expiresIn: '1h' });
      
      // Step 1: Create a JSON file with the request data for prefetch
      const prefetchData = {
        operation: 'prefetch',
        reportTopic: report.reportTopic,
        company: report.company,
        location: report.location,
        website: report.website,
        additionalContext: report.additionalContext,
        wordCount: report.wordCount,
        stakeholders: report.stakeholders,
        targetAudience: report.targetAudience,
        timeframe: report.timeframe,
        deliveryFormat: report.deliveryFormat,
        includeVisuals: report.includeVisuals,
        // Add info about the last report for updates
        lastReportDate: lastReport ? lastReport.createdAt : null,
        lastReportContent: lastReport ? lastReport.content : null,
        includeUpdatesSection: true
      };
      
      const prefetchFilePath = path.resolve(process.cwd(), 'prefetch-data.json');
      fs.writeFileSync(prefetchFilePath, JSON.stringify(prefetchData));
      
      // Step 2: Execute prefetch using curl with authentication
      console.log('Executing prefetch operation...');
      const prefetchCommand = `curl -s -X POST http://localhost:3000/api/report-generation -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" -H "Cookie: token=${token}" -d @${prefetchFilePath}`;
      
      exec(prefetchCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`Prefetch execution error: ${error.message}`);
          fs.unlinkSync(prefetchFilePath);
          return reject(error);
        }
        
        if (stderr) {
          console.error(`Prefetch stderr: ${stderr}`);
        }
        
        // Check if the response is HTML (likely a login page)
        if (stdout.includes('<!DOCTYPE html>') || stdout.includes('<html>')) {
          console.error('Received HTML response instead of JSON. Server might be redirecting to login page.');
          fs.unlinkSync(prefetchFilePath);
          return reject(new Error('Authentication failed - received HTML response'));
        }
        
        // Parse the prefetch results
        try {
          const prefetchResults = JSON.parse(stdout);
          console.log(`Prefetch successful, report ID: ${prefetchResults.reportId}`);
          
          // Step 3: Create a predefined prompt with updates section if this is not the first report
          let predefinedPrompt = `Generate a comprehensive business report on the following topic: "${report.reportTopic}".
Please include detailed information about:
1. Current status and overview
2. Key metrics and statistics
3. Trends and patterns
4. Challenges and opportunities
5. Recommendations and next steps`;

          // Add an Updates section if this isn't the first report
          if (lastReport) {
            predefinedPrompt = `Generate a comprehensive business report on the following topic: "${report.reportTopic}".
Please include detailed information about:
1. UPDATES - What's new since the last report (${new Date(lastReport.createdAt).toLocaleDateString()})
2. Current status and overview
3. Key metrics and statistics
4. Trends and patterns
5. Challenges and opportunities
6. Recommendations and next steps`;
          }
          
          // Step 4: Create a JSON file with the request data for generate
          const generateData = {
            operation: 'generate',
            reportTopic: report.reportTopic,
            company: report.company,
            location: report.location,
            website: report.website,
            additionalContext: report.additionalContext,
            wordCount: report.wordCount,
            stakeholders: report.stakeholders,
            targetAudience: report.targetAudience,
            timeframe: report.timeframe,
            deliveryFormat: report.deliveryFormat,
            includeVisuals: report.includeVisuals,
            approvedData: prefetchResults.claudeResponse?.response,
            approvedWebContext: prefetchResults.webContext,
            approvedWebData: prefetchResults.webData,
            approvedDbSourceInfo: prefetchResults.dbSourceInfo,
            reportId: prefetchResults.reportId,
            predefinedPrompt: predefinedPrompt,
            lastReportDate: lastReport ? lastReport.createdAt : null,
            includeUpdatesSection: true
          };
          
          const generateFilePath = path.resolve(process.cwd(), 'generate-data.json');
          fs.writeFileSync(generateFilePath, JSON.stringify(generateData));
          
          // Step 5: Execute generate using curl with authentication
          console.log('Executing generate operation...');
          const generateCommand = `curl -s -X POST http://localhost:3000/api/report-generation -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" -H "Cookie: token=${token}" -d @${generateFilePath}`;
          
          exec(generateCommand, (genError, genStdout, genStderr) => {
            // Clean up temporary files
            fs.unlinkSync(prefetchFilePath);
            fs.unlinkSync(generateFilePath);
            
            if (genError) {
              console.error(`Generate execution error: ${genError.message}`);
              return reject(genError);
            }
            
            if (genStderr) {
              console.error(`Generate stderr: ${genStderr}`);
            }
            
            // Check if the response is HTML
            if (genStdout.includes('<!DOCTYPE html>') || genStdout.includes('<html>')) {
              console.error('Received HTML response instead of JSON for generate operation.');
              return reject(new Error('Authentication failed - received HTML response'));
            }
            
            // Parse the generate results
            try {
              const generatedReport = JSON.parse(genStdout);
              console.log(`Report generation successful, title: ${generatedReport.title}`);
              
              resolve({
                reportId: generatedReport.reportId || prefetchResults.reportId,
                title: generatedReport.title,
                content: generatedReport.content,
                visualizations: generatedReport.visualizations || generatedReport.charts || []
              });
            } catch (parseError) {
              console.error(`Error parsing generate response: ${parseError.message}`);
              reject(parseError);
            }
          });
        } catch (parseError) {
          console.error(`Error parsing prefetch response: ${parseError.message}`);
          fs.unlinkSync(prefetchFilePath);
          reject(parseError);
        }
      });
    } catch (error) {
      console.error(`Error generating report: ${error.message}`);
      reject(error);
    }
  });
}

async function checkScheduledReports() {
  let client;
  try {
    console.log('Checking for scheduled reports...');
    
    // First check if the server is running
    const serverRunning = await isServerRunning();
    if (!serverRunning) {
      console.error('NextJS server is not running. Cannot generate reports.');
      console.error('Please start the server with: npm run dev');
      return;
    }
    
    // Connect to MongoDB
    client = await MongoClient.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Get all database names
    const adminDb = client.db('admin');
    const dbList = await adminDb.admin().listDatabases();
    const companyDbs = dbList.databases
      .filter(db => db.name.startsWith('company_'))
      .map(db => db.name);
    
    console.log(`Found ${companyDbs.length} company databases`);
    
    // Process each company database
    for (const companyDbName of companyDbs) {
      try {
        console.log(`Processing company database: ${companyDbName}`);
        const companyDb = client.db(companyDbName);
        
        // Check if the scheduled reports collection exists
        const collections = await companyDb.listCollections().toArray();
        const hasScheduledReportsCollection = collections.some(c => c.name === SCHEDULED_REPORTS_COLLECTION);
        
        if (!hasScheduledReportsCollection) {
          console.log(`Skipping ${companyDbName}: No scheduled reports collection found`);
          continue;
        }
        
        // Get the scheduled reports collection
        const scheduledReportsCollection = companyDb.collection(SCHEDULED_REPORTS_COLLECTION);
        const savedReportsCollection = companyDb.collection(SAVED_REPORTS_COLLECTION);
        
        // Find reports that need to be executed (nextExecution <= now and isActive = true)
        const now = new Date();
        console.log(`Finding reports to execute in ${companyDbName} (current time: ${now.toISOString()})`);
        const reportsToExecute = await scheduledReportsCollection.find({
          nextExecution: { $lte: now },
          isActive: true
        }).toArray();
        
        console.log(`Found ${reportsToExecute.length} reports to execute in ${companyDbName}`);
        
        // Execute each report
        for (const report of reportsToExecute) {
          try {
            console.log(`Processing report: ${report._id} - ${report.reportTopic}`);
            
            // Get the most recent report generated from this scheduled report
            let lastReport = null;
            if (report.generatedReportIds && report.generatedReportIds.length > 0) {
              const lastReportId = report.generatedReportIds[report.generatedReportIds.length - 1];
              lastReport = await savedReportsCollection.findOne({ _id: lastReportId });
              console.log(`Found last report: ${lastReportId}, exists: ${!!lastReport}`);
            }
            
            // Add companyCode to the report
            report.companyCode = companyDbName.replace('company_', '');
            
            // Generate a full report using the API
            const generatedReport = await executeReportGenerationAPI(report, lastReport);
            
            // Save the report to the database
            const now = new Date();
            const savedReport = {
              _id: generatedReport.reportId,
              userId: report.userId,
              title: generatedReport.title,
              topic: report.reportTopic,
              content: generatedReport.content,
              visualizations: generatedReport.visualizations,
              company: report.company,
              wordCount: report.wordCount,
              targetAudience: report.targetAudience,
              timeframe: report.timeframe,
              deliveryFormat: report.deliveryFormat,
              hasVisualizations: report.includeVisuals,
              createdAt: now.toISOString(),
              scheduledReportId: report._id,
              isScheduled: true,
              previousReportId: lastReport ? lastReport._id : null,
              includesUpdates: !!lastReport
            };
            
            await savedReportsCollection.insertOne(savedReport);
            console.log(`Saved report with ID: ${generatedReport.reportId}`);
            
            // Calculate next execution time based on frequency
            const nextExecution = calculateNextExecution(
              report.scheduleFrequency, 
              report.scheduleCustomMinutes, 
              report.scheduleCustomHours
            );
            
            console.log(`Setting next execution time for ${report.scheduleFrequency} frequency: ${nextExecution.toISOString()}`);
            
            // Update the scheduled report with the execution info
            await scheduledReportsCollection.updateOne(
              { _id: report._id },
              { 
                $set: {
                  lastExecuted: now,
                  nextExecution: nextExecution
                },
                $push: {
                  generatedReportIds: generatedReport.reportId
                }
              }
            );
            
            console.log(`Updated scheduled report ${report._id} with next execution time: ${nextExecution.toISOString()}`);
          } catch (reportError) {
            console.error(`Error processing report ${report._id}: ${reportError.message}`);
          }
        }
      } catch (companyError) {
        console.error(`Error processing company database ${companyDbName}: ${companyError.message}`);
      }
    }
    
    console.log('Scheduled reports check completed');
  } catch (error) {
    console.error(`Error in checkScheduledReports: ${error.message}`);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

// For testing purposes, force all scheduled reports to execute now
async function forceExecuteAllScheduledReports() {
  let client;
  try {
    console.log('Forcing execution of all scheduled reports...');
    
    // Connect to MongoDB
    client = await MongoClient.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Get all database names
    const adminDb = client.db('admin');
    const dbList = await adminDb.admin().listDatabases();
    const companyDbs = dbList.databases
      .filter(db => db.name.startsWith('company_'))
      .map(db => db.name);
    
    console.log(`Found ${companyDbs.length} company databases`);
    
    // Process each company database
    for (const companyDbName of companyDbs) {
      try {
        console.log(`Processing company database: ${companyDbName}`);
        const companyDb = client.db(companyDbName);
        
        // Check if the scheduled reports collection exists
        const collections = await companyDb.listCollections().toArray();
        const hasScheduledReportsCollection = collections.some(c => c.name === SCHEDULED_REPORTS_COLLECTION);
        
        if (!hasScheduledReportsCollection) {
          console.log(`Skipping ${companyDbName}: No scheduled reports collection found`);
          continue;
        }
        
        // Get the scheduled reports collection
        const scheduledReportsCollection = companyDb.collection(SCHEDULED_REPORTS_COLLECTION);
        
        // Set all active reports to be executed now
        const now = new Date();
        const result = await scheduledReportsCollection.updateMany(
          { isActive: true },
          { $set: { nextExecution: now } }
        );
        
        console.log(`Updated ${result.modifiedCount} reports in ${companyDbName} to execute now`);
      } catch (companyError) {
        console.error(`Error processing company database ${companyDbName}: ${companyError.message}`);
      }
    }
    
    console.log('Force execution completed');
  } catch (error) {
    console.error(`Error in forceExecuteAllScheduledReports: ${error.message}`);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

// Check if we should force execute all reports
const shouldForceExecute = process.argv.includes('--force');

// Run the script
if (shouldForceExecute) {
  forceExecuteAllScheduledReports()
    .then(() => {
      console.log('Force execution completed, now checking for reports to execute...');
      return checkScheduledReports();
    })
    .then(() => {
      console.log('Script execution completed');
      process.exit(0);
    })
    .catch(error => {
      console.error(`Unhandled error: ${error.message}`);
      process.exit(1);
    });
} else {
  checkScheduledReports()
    .then(() => {
      console.log('Script execution completed');
      process.exit(0);
    })
    .catch(error => {
      console.error(`Unhandled error: ${error.message}`);
      process.exit(1);
    });
} 
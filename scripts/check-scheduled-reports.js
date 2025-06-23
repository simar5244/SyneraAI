const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Import the report-generation module directly
const reportGeneration = require('../pages/api/report-generation');

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

// Simple local verifyAuth function instead of importing from @/lib/auth
function verifyAuth(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return {
      id: decoded.id || decoded.userId,
      userId: decoded.id || decoded.userId,
      role: decoded.role,
      companyCode: decoded.companyCode || decoded.company_code || decoded.organizationCode,
      email: decoded.email
    };
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
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
      console.log(`Custom frequency calculation: ${customHours || 0} hours and ${customMinutes || 0} minutes = ${totalMinutes} total minutes`);
      if (totalMinutes <= 0) {
        console.log(`Invalid custom frequency (${totalMinutes} minutes), defaulting to daily`);
        return new Date(now.setDate(now.getDate() + 1)); // Default to daily if invalid
      }
      const nextDate = new Date(now.getTime() + totalMinutes * 60000); // Convert minutes to milliseconds
      console.log(`Next execution for custom frequency: ${nextDate.toISOString()}`);
      return nextDate;
    
    default:
      console.log(`Unknown frequency "${frequency}", defaulting to daily`);
      return new Date(now.setDate(now.getDate() + 1)); // Default to daily
  }
}

// Function to generate a report directly using the report-generation module
async function generateReport(report, lastReport = null) {
  console.log(`Generating full report for: ${report.reportTopic}`);
  
  try {
    // Create a fake token for authentication
    const fakeToken = jwt.sign({
      id: report.userId,
      userId: report.userId,
      role: 'user',
      companyCode: report.companyCode
    }, JWT_SECRET);
    
    // Step 1: Create a mock request for prefetch
    const mockPrefetchReq = {
      method: 'POST',
      body: {
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
      },
      cookies: { token: fakeToken },
      headers: { authorization: `Bearer ${fakeToken}` }
    };
    
    // Create a mock response to capture the prefetch results
    let prefetchResults = null;
    const mockPrefetchRes = {
      status: (code) => ({
        json: (data) => {
          prefetchResults = data;
          return mockPrefetchRes;
        }
      })
    };
    
    // Call the prefetch operation directly
    console.log('Calling prefetch operation directly...');
    await reportGeneration(mockPrefetchReq, mockPrefetchRes);
    
    if (!prefetchResults || prefetchResults.error) {
      const errorMsg = prefetchResults?.error || "Failed to prefetch report data";
      throw new Error(errorMsg);
    }
    
    console.log(`Prefetch successful, report ID: ${prefetchResults.reportId}`);
    
    // Step 2: Create a predefined prompt with updates section if this is not the first report
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
    
    // Step 3: Create a mock request for generate
    const mockGenerateReq = {
      method: 'POST',
      body: {
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
      },
      cookies: { token: fakeToken },
      headers: { authorization: `Bearer ${fakeToken}` }
    };
    
    // Create a mock response to capture the generated report
    let generatedReport = null;
    const mockGenerateRes = {
      status: (code) => ({
        json: (data) => {
          generatedReport = data;
          return mockGenerateRes;
        }
      })
    };
    
    // Call the generate operation directly
    console.log('Calling generate operation directly...');
    await reportGeneration(mockGenerateReq, mockGenerateRes);
    
    if (!generatedReport || generatedReport.error) {
      const errorMsg = generatedReport?.error || "Failed to generate report";
      throw new Error(errorMsg);
    }
    
    console.log(`Report generation successful, title: ${generatedReport.title}`);
    
    return {
      reportId: generatedReport.reportId || prefetchResults.reportId,
      title: generatedReport.title,
      content: generatedReport.content,
      visualizations: generatedReport.visualizations || generatedReport.charts || []
    };
  } catch (error) {
    console.error(`Error generating report: ${error.message}`);
    throw error;
  }
}

async function checkScheduledReports() {
  let client;
  try {
    console.log('Checking for scheduled reports...');
    
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
            console.log(`Report frequency: ${report.scheduleFrequency}, Custom minutes: ${report.scheduleCustomMinutes || 'N/A'}, Custom hours: ${report.scheduleCustomHours || 'N/A'}`);
            console.log(`Current nextExecution: ${report.nextExecution}`);
            
            // Get the most recent report generated from this scheduled report
            let lastReport = null;
            if (report.generatedReportIds && report.generatedReportIds.length > 0) {
              const lastReportId = report.generatedReportIds[report.generatedReportIds.length - 1];
              lastReport = await savedReportsCollection.findOne({ _id: lastReportId });
              console.log(`Found last report: ${lastReportId}, exists: ${!!lastReport}`);
            }
            
            // Generate a full report using the report-generation module directly
            const generatedReport = await generateReport(report, lastReport);
            
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
            
            // Update the scheduled report with the execution info
            const nextExecution = calculateNextExecution(
              report.scheduleFrequency, 
              report.scheduleCustomMinutes, 
              report.scheduleCustomHours
            );
            
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
            console.log(`Report structure: { title: '${generatedReport.title}', contentLength: ${generatedReport.content.length}, visualizationsCount: ${(generatedReport.visualizations || []).length} }`);
            console.log(`[DEBUG] Successfully executed and saved scheduled report: ${report._id}`);
            console.log(`[DEBUG] Report details:
      - Title: ${savedReport.title}
      - Generated report ID: ${savedReport._id}
      - Last executed: ${now.toISOString()}
      - Next execution: ${nextExecution.toISOString()}
      - Frequency: ${report.scheduleFrequency}
      - Custom minutes: ${report.scheduleCustomMinutes || 'N/A'}
      - Custom hours: ${report.scheduleCustomHours || 'N/A'}`);
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
const runOnce = process.argv.includes('--once');

// Function to run the check at regular intervals
async function runScheduledChecks() {
  try {
    console.log(`[${new Date().toISOString()}] Starting scheduled reports check...`);
    
    if (shouldForceExecute) {
      await forceExecuteAllScheduledReports();
      console.log('Force execution completed, now checking for reports to execute...');
    }
    
    await checkScheduledReports();
    console.log(`[${new Date().toISOString()}] Scheduled reports check completed`);
    
    if (runOnce) {
      console.log('Running in one-time mode. Exiting.');
      process.exit(0);
    } else {
      // Schedule the next check in 1 minute
      console.log('Waiting 60 seconds for next check...');
      setTimeout(runScheduledChecks, 60000);
    }
  } catch (error) {
    console.error(`Unhandled error: ${error.message}`);
    if (error.stack) {
      console.error(`Stack trace: ${error.stack}`);
    }
    
    if (runOnce) {
      process.exit(1);
    } else {
      // Even if there was an error, try again in 1 minute
      console.log('Error occurred. Waiting 60 seconds for next check...');
      setTimeout(runScheduledChecks, 60000);
    }
  }
}

// Start the scheduled checks
console.log(`Starting check-scheduled-reports.js in ${runOnce ? 'one-time' : 'continuous'} mode`);
runScheduledChecks(); 
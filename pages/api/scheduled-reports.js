import { MongoClient, ObjectId } from 'mongodb';
import { verifyAuth } from '@/lib/auth';
import reportGeneration from './report-generation.js';

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const SCHEDULED_REPORTS_COLLECTION = "scheduled_reports";
const SAVED_REPORTS_COLLECTION = "saved_reports";

export default async function handler(req, res) {
  // Check for valid authentication
  let authPayload;
  try {
    // Get token from Authorization header or cookies
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies.token;
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Special handling for scheduled reports tokens
    if (token.startsWith('scheduled_reports_token_')) {
      console.log("Processing request with scheduled reports token");
      const parts = token.split('_');
      const companyCode = parts[3]; // Format: scheduled_reports_token_COMPANYCODE_TIMESTAMP
      
      if (!companyCode) {
        return res.status(401).json({ error: 'Invalid scheduled reports token' });
      }
      
      // Create a simple auth payload for scheduled reports
      authPayload = {
        companyCode: companyCode,
        userId: 'system',
        sub: 'system',
        role: 'admin',
        isScheduledReportsToken: true
      };
    } else {
      // Verify the token
      authPayload = await verifyAuth(token);
      
      if (!authPayload || !authPayload.companyCode) {
        return res.status(401).json({ error: 'Invalid authentication' });
      }
    }
  } catch (authError) {
    console.error("Authentication error:", authError);
    return res.status(401).json({ error: 'Authentication failed' });
  }
  
  // Handle different HTTP methods
  if (req.method === 'GET') {
    return handleGetScheduledReports(req, res, authPayload);
  } else if (req.method === 'POST') {
    // Process POST requests based on the action parameter
    const { action } = req.body;
    
    switch (action) {
      case 'create':
        return handleCreateScheduledReport(req, res, authPayload);
      case 'update':
        return handleUpdateScheduledReport(req, res, authPayload);
      case 'delete':
        return handleDeleteScheduledReport(req, res, authPayload);
      case 'execute':
        return handleExecuteScheduledReport(req, res, authPayload);
      case 'cancel':
        return handleCancelScheduledReport(req, res, authPayload);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

// Handler for GET requests - retrieve scheduled reports
async function handleGetScheduledReports(req, res, authPayload) {
  let client;
  try {
    // Connect to MongoDB
    client = await MongoClient.connect(MONGODB_URI);
    
    // Get the company DB based on authenticated user
    const companyDbName = `company_${authPayload.companyCode.toLowerCase()}`;
    const companyDb = client.db(companyDbName);
    const scheduledReportsCollection = companyDb.collection(SCHEDULED_REPORTS_COLLECTION);
    
    // Get the reports for the current user
    const userId = authPayload.userId || authPayload.sub;
    const reports = await scheduledReportsCollection.find({ userId }).sort({ createdAt: -1 }).toArray();
    
    return res.status(200).json({ reports });
  } catch (error) {
    console.error("Error retrieving scheduled reports:", error);
    return res.status(500).json({ error: "Failed to retrieve scheduled reports" });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Handler for creating a new scheduled report
async function handleCreateScheduledReport(req, res, authPayload) {
  let client;
  try {
    const { 
      reportTopic, 
      company, 
      location, 
      website, 
      additionalContext, 
      wordCount, 
      stakeholders, 
      targetAudience, 
      timeframe, 
      deliveryFormat, 
      includeVisuals,
      scheduleFrequency,
      scheduleCustomMinutes,
      scheduleCustomHours
    } = req.body;
    
    if (!reportTopic) {
      return res.status(400).json({ error: "Report topic is required" });
    }
    
    if (!scheduleFrequency) {
      return res.status(400).json({ error: "Schedule frequency is required" });
    }
    
    // Validate custom frequency parameters if frequency is 'custom'
    if (scheduleFrequency === 'custom') {
      const totalMinutes = (parseInt(scheduleCustomHours) || 0) * 60 + (parseInt(scheduleCustomMinutes) || 0);
      if (totalMinutes <= 0) {
        return res.status(400).json({ error: "For custom frequency, you must specify a positive value for minutes or hours" });
      }
    }
    
    // Connect to MongoDB
    client = await MongoClient.connect(MONGODB_URI);
    
    // Get the company DB based on authenticated user
    const companyDbName = `company_${authPayload.companyCode.toLowerCase()}`;
    const companyDb = client.db(companyDbName);
    const scheduledReportsCollection = companyDb.collection(SCHEDULED_REPORTS_COLLECTION);
    
    // Create scheduled report object
    const userId = authPayload.userId || authPayload.sub;
    const now = new Date();
    
    // Parse custom minutes and hours as integers
    const parsedCustomMinutes = scheduleCustomMinutes ? parseInt(scheduleCustomMinutes) : null;
    const parsedCustomHours = scheduleCustomHours ? parseInt(scheduleCustomHours) : null;
    
    // Calculate next execution time based on frequency
    const nextExecution = calculateNextExecution(scheduleFrequency, parsedCustomMinutes, parsedCustomHours);
    
    console.log(`[DEBUG] Creating scheduled report with frequency: ${scheduleFrequency}`);
    console.log(`[DEBUG] Custom minutes: ${parsedCustomMinutes || 'N/A'}, Custom hours: ${parsedCustomHours || 'N/A'}`);
    console.log(`[DEBUG] Next execution time: ${nextExecution.toISOString()}`);
    
    const scheduledReport = {
      _id: new ObjectId().toString(),
      userId,
      reportTopic,
      company,
      location,
      website,
      additionalContext,
      wordCount: parseInt(wordCount) || 1000,
      stakeholders,
      targetAudience,
      timeframe,
      deliveryFormat,
      includeVisuals: includeVisuals === true || includeVisuals === 'true',
      scheduleFrequency,
      scheduleCustomMinutes: parsedCustomMinutes,
      scheduleCustomHours: parsedCustomHours,
      nextExecution,
      createdAt: now,
      updatedAt: now,
      lastExecuted: null,
      isActive: true,
      generatedReportIds: []
    };
    
    // Insert the scheduled report
    await scheduledReportsCollection.insertOne(scheduledReport);
    console.log(`[DEBUG] Created scheduled report: ${scheduledReport._id}`);

    // Trigger an immediate first execution of the scheduled report *asynchronously*
    (async () => {
      try {
        console.log(`[DEBUG] Triggering immediate execution of new scheduled report: ${scheduledReport._id}`);
        // Re-use the same auth payload and business logic already implemented in
        // handleExecuteScheduledReport so that we don't duplicate code.
        const mockReq = {
          method: 'POST',
          body: { reportId: scheduledReport._id },
          headers: req.headers,
          cookies: req.cookies || {},
        };

        // Minimal mock res – we don't need the actual output, only the side-effects.
        const mockRes = {
          status: () => ({
            json: () => null,
          }),
        };

        await handleExecuteScheduledReport(mockReq, mockRes, authPayload);
        console.log(`[DEBUG] Successfully triggered initial report generation for: ${scheduledReport._id}`);
      } catch (execErr) {
        console.error(`[ERROR] Failed to run initial scheduled report generation: ${execErr.message}`);
        if (execErr.stack) {
          console.error(`[ERROR] Stack trace: ${execErr.stack}`);
        }
      }
    })();
    
    return res.status(201).json({ 
      success: true, 
      message: "Scheduled report created successfully. The first version is being generated.",
      scheduledReport
    });
  } catch (error) {
    console.error("Error creating scheduled report:", error);
    return res.status(500).json({ error: "Failed to create scheduled report: " + error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Handler for updating a scheduled report
async function handleUpdateScheduledReport(req, res, authPayload) {
  let client;
  try {
    const { 
      reportId,
      reportTopic, 
      company, 
      location, 
      website, 
      additionalContext, 
      wordCount, 
      stakeholders, 
      targetAudience, 
      timeframe, 
      deliveryFormat, 
      includeVisuals,
      scheduleFrequency,
      scheduleCustomMinutes,
      scheduleCustomHours,
      isActive
    } = req.body;
    
    if (!reportId) {
      return res.status(400).json({ error: "Report ID is required" });
    }
    
    // Connect to MongoDB
    client = await MongoClient.connect(MONGODB_URI);
    
    // Get the company DB based on authenticated user
    const companyDbName = `company_${authPayload.companyCode.toLowerCase()}`;
    const companyDb = client.db(companyDbName);
    const scheduledReportsCollection = companyDb.collection(SCHEDULED_REPORTS_COLLECTION);
    
    // Get the current report to check ownership
    const userId = authPayload.userId || authPayload.sub;
    const existingReport = await scheduledReportsCollection.findOne({ _id: reportId, userId });
    
    if (!existingReport) {
      return res.status(404).json({ error: "Report not found or you don't have permission to update it" });
    }
    
    // Calculate next execution time if frequency changed
    let nextExecution = existingReport.nextExecution;
    if (scheduleFrequency && (
      scheduleFrequency !== existingReport.scheduleFrequency || 
      scheduleCustomMinutes !== existingReport.scheduleCustomMinutes ||
      scheduleCustomHours !== existingReport.scheduleCustomHours
    )) {
      nextExecution = calculateNextExecution(scheduleFrequency, scheduleCustomMinutes, scheduleCustomHours);
    }
    
    // Update the report
    const updateData = {
      updatedAt: new Date(),
      nextExecution
    };
    
    // Only update fields that are provided
    if (reportTopic !== undefined) updateData.reportTopic = reportTopic;
    if (company !== undefined) updateData.company = company;
    if (location !== undefined) updateData.location = location;
    if (website !== undefined) updateData.website = website;
    if (additionalContext !== undefined) updateData.additionalContext = additionalContext;
    if (wordCount !== undefined) updateData.wordCount = parseInt(wordCount) || 1000;
    if (stakeholders !== undefined) updateData.stakeholders = stakeholders;
    if (targetAudience !== undefined) updateData.targetAudience = targetAudience;
    if (timeframe !== undefined) updateData.timeframe = timeframe;
    if (deliveryFormat !== undefined) updateData.deliveryFormat = deliveryFormat;
    if (includeVisuals !== undefined) updateData.includeVisuals = includeVisuals === true || includeVisuals === 'true';
    if (scheduleFrequency !== undefined) updateData.scheduleFrequency = scheduleFrequency;
    if (scheduleCustomMinutes !== undefined) updateData.scheduleCustomMinutes = scheduleCustomMinutes ? parseInt(scheduleCustomMinutes) : null;
    if (scheduleCustomHours !== undefined) updateData.scheduleCustomHours = scheduleCustomHours ? parseInt(scheduleCustomHours) : null;
    if (isActive !== undefined) updateData.isActive = isActive === true || isActive === 'true';
    
    await scheduledReportsCollection.updateOne(
      { _id: reportId },
      { $set: updateData }
    );
    
    return res.status(200).json({ 
      success: true, 
      message: "Scheduled report updated successfully" 
    });
  } catch (error) {
    console.error("Error updating scheduled report:", error);
    return res.status(500).json({ error: "Failed to update scheduled report" });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Handler for deleting a scheduled report
async function handleDeleteScheduledReport(req, res, authPayload) {
  let client;
  try {
    const { reportId } = req.body;
    
    if (!reportId) {
      return res.status(400).json({ error: "Report ID is required" });
    }
    
    // Connect to MongoDB
    client = await MongoClient.connect(MONGODB_URI);
    
    // Get the company DB based on authenticated user
    const companyDbName = `company_${authPayload.companyCode.toLowerCase()}`;
    const companyDb = client.db(companyDbName);
    const scheduledReportsCollection = companyDb.collection(SCHEDULED_REPORTS_COLLECTION);
    
    // Get the current report to check ownership
    const userId = authPayload.userId || authPayload.sub;
    const existingReport = await scheduledReportsCollection.findOne({ _id: reportId, userId });
    
    if (!existingReport) {
      return res.status(404).json({ error: "Report not found or you don't have permission to delete it" });
    }
    
    // Delete the report
    await scheduledReportsCollection.deleteOne({ _id: reportId });
    
    return res.status(200).json({ 
      success: true, 
      message: "Scheduled report deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting scheduled report:", error);
    return res.status(500).json({ error: "Failed to delete scheduled report" });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Handler for executing a scheduled report (can be triggered manually or by cron)
async function handleExecuteScheduledReport(req, res, authPayload) {
  let client;
  try {
    const { reportId } = req.body;
    
    if (!reportId) {
      return res.status(400).json({ error: "Report ID is required" });
    }
    
    console.log(`[DEBUG] Starting execution of scheduled report: ${reportId}`);
    
    // Connect to MongoDB
    client = await MongoClient.connect(MONGODB_URI);
    console.log(`[DEBUG] Connected to MongoDB for scheduled report execution`);
    
    // Get the company DB based on authenticated user
    const companyDbName = `company_${authPayload.companyCode.toLowerCase()}`;
    const companyDb = client.db(companyDbName);
    const scheduledReportsCollection = companyDb.collection(SCHEDULED_REPORTS_COLLECTION);
    const savedReportsCollection = companyDb.collection(SAVED_REPORTS_COLLECTION);
    
    // Get the scheduled report
    const scheduledReport = await scheduledReportsCollection.findOne({ _id: reportId });
    
    if (!scheduledReport) {
      console.log(`[ERROR] Scheduled report not found: ${reportId}`);
      return res.status(404).json({ error: "Scheduled report not found" });
    }
    
    console.log(`[DEBUG] Found scheduled report: ${JSON.stringify(scheduledReport)}`);
    
    // Get the most recent report generated from this scheduled report
    let lastReport = null;
    if (scheduledReport.generatedReportIds && scheduledReport.generatedReportIds.length > 0) {
      const lastReportId = scheduledReport.generatedReportIds[scheduledReport.generatedReportIds.length - 1];
      lastReport = await savedReportsCollection.findOne({ _id: lastReportId });
      console.log(`[DEBUG] Found last report: ${lastReportId}, exists: ${!!lastReport}`);
    }
    
    // Create a mock request to the report-generation API
    const mockReq = {
      method: 'POST',
      body: {
        operation: 'prefetch',
        reportTopic: scheduledReport.reportTopic,
        company: scheduledReport.company,
        location: scheduledReport.location,
        website: scheduledReport.website,
        additionalContext: scheduledReport.additionalContext,
        wordCount: scheduledReport.wordCount,
        stakeholders: scheduledReport.stakeholders,
        targetAudience: scheduledReport.targetAudience,
        timeframe: scheduledReport.timeframe,
        deliveryFormat: scheduledReport.deliveryFormat,
        includeVisuals: scheduledReport.includeVisuals,
        // Add info about the last report for updates
        lastReportDate: lastReport ? lastReport.createdAt : null,
        lastReportContent: lastReport ? lastReport.content : null,
        includeUpdatesSection: true
      },
      cookies: req.cookies,
      headers: req.headers
    };
    
    console.log(`[DEBUG] Prefetching data for scheduled report`);
    
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
    
    // Call the prefetch operation
    await reportGeneration(mockReq, mockPrefetchRes);
    
    if (!prefetchResults || prefetchResults.error) {
      const errorMsg = prefetchResults?.error || "Failed to prefetch report data";
      console.log(`[ERROR] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    console.log(`[DEBUG] Successfully prefetched data, reportId: ${prefetchResults.reportId}`);
    
    // Modify the predefined prompt to include an updates section if this is not the first report
    let predefinedPrompt = `Generate a comprehensive business report on the following topic: "${scheduledReport.reportTopic}".
Please include detailed information about:
1. Current status and overview
2. Key metrics and statistics
3. Trends and patterns
4. Challenges and opportunities
5. Recommendations and next steps`;

    // Add an Updates section if this isn't the first report
    if (lastReport) {
      predefinedPrompt = `Generate a comprehensive business report on the following topic: "${scheduledReport.reportTopic}".
Please include detailed information about:
1. UPDATES - What's new since the last report (${new Date(lastReport.createdAt).toLocaleDateString()})
2. Current status and overview
3. Key metrics and statistics
4. Trends and patterns
5. Challenges and opportunities
6. Recommendations and next steps`;
    }

    // Now generate the report with the prefetched data
    const generateReq = {
      method: 'POST',
      body: {
        operation: 'generate',
        reportTopic: scheduledReport.reportTopic,
        company: scheduledReport.company,
        location: scheduledReport.location,
        website: scheduledReport.website,
        additionalContext: scheduledReport.additionalContext,
        wordCount: scheduledReport.wordCount,
        stakeholders: scheduledReport.stakeholders,
        targetAudience: scheduledReport.targetAudience,
        timeframe: scheduledReport.timeframe,
        deliveryFormat: scheduledReport.deliveryFormat,
        includeVisuals: scheduledReport.includeVisuals,
        approvedData: prefetchResults.claudeResponse.response,
        approvedWebContext: prefetchResults.webContext,
        approvedWebData: prefetchResults.webData,
        approvedDbSourceInfo: prefetchResults.dbSourceInfo,
        reportId: prefetchResults.reportId,
        predefinedPrompt: predefinedPrompt,
        lastReportDate: lastReport ? lastReport.createdAt : null,
        includeUpdatesSection: true
      },
      cookies: req.cookies,
      headers: req.headers
    };
    
    console.log(`[DEBUG] Generating report with approved data`);
    
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
    
    // Call the generate operation
    await reportGeneration(generateReq, mockGenerateRes);
    
    if (!generatedReport || generatedReport.error) {
      const errorMsg = generatedReport?.error || "Failed to generate report";
      console.log(`[ERROR] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    console.log(`[DEBUG] Successfully generated report: ${generatedReport.reportId}`);
    
    // Save the report
    const userId = authPayload.userId || authPayload.sub;
    const now = new Date();
    const savedReport = {
      _id: generatedReport.reportId,
      userId,
      title: generatedReport.title,
      topic: scheduledReport.reportTopic,
      content: generatedReport.content,
      visualizations: generatedReport.visualizations || [],
      company: scheduledReport.company,
      wordCount: scheduledReport.wordCount,
      targetAudience: scheduledReport.targetAudience,
      timeframe: scheduledReport.timeframe,
      deliveryFormat: scheduledReport.deliveryFormat,
      hasVisualizations: scheduledReport.includeVisuals,
      createdAt: now.toISOString(),
      scheduledReportId: scheduledReport._id,
      isScheduled: true,
      previousReportId: lastReport ? lastReport._id : null,
      includesUpdates: !!lastReport
    };
    
    console.log(`[DEBUG] Saving report to database`);
    await savedReportsCollection.insertOne(savedReport);
    
    // Update the scheduled report with the execution info
    await scheduledReportsCollection.updateOne(
      { _id: reportId },
      { 
        $set: {
          lastExecuted: now,
          nextExecution: calculateNextExecution(
            scheduledReport.scheduleFrequency, 
            scheduledReport.scheduleCustomMinutes, 
            scheduledReport.scheduleCustomHours
          )
        },
        $push: {
          generatedReportIds: generatedReport.reportId
        }
      }
    );
    
    // Log detailed information about the report execution
    console.log(`[DEBUG] Successfully executed and saved scheduled report: ${reportId}`);
    console.log(`[DEBUG] Report details:
      - Title: ${generatedReport.title}
      - Generated report ID: ${generatedReport.reportId}
      - Last executed: ${now.toISOString()}
      - Next execution: ${calculateNextExecution(
        scheduledReport.scheduleFrequency, 
        scheduledReport.scheduleCustomMinutes, 
        scheduledReport.scheduleCustomHours
      ).toISOString()}
      - Frequency: ${scheduledReport.scheduleFrequency}
      - Custom minutes: ${scheduledReport.scheduleCustomMinutes || 'N/A'}
      - Custom hours: ${scheduledReport.scheduleCustomHours || 'N/A'}
    `);

    return res.status(200).json({
      success: true,
      message: "Scheduled report executed successfully",
      reportId: generatedReport.reportId
    });
  } catch (error) {
    console.error(`[ERROR] Error executing scheduled report: ${error.message}`);
    if (error.stack) {
      console.error(`[ERROR] Stack trace: ${error.stack}`);
    }
    return res.status(500).json({ error: "Failed to execute scheduled report: " + error.message });
  } finally {
    if (client) {
      await client.close();
      console.log(`[DEBUG] MongoDB connection closed`);
    }
  }
}

// Handler for canceling a scheduled report (keeps the report and history, but stops future executions)
async function handleCancelScheduledReport(req, res, authPayload) {
  let client;
  try {
    const { reportId } = req.body;
    
    if (!reportId) {
      return res.status(400).json({ error: "Report ID is required" });
    }
    
    // Connect to MongoDB
    client = await MongoClient.connect(MONGODB_URI);
    
    // Get the company DB based on authenticated user
    const companyDbName = `company_${authPayload.companyCode.toLowerCase()}`;
    const companyDb = client.db(companyDbName);
    const scheduledReportsCollection = companyDb.collection(SCHEDULED_REPORTS_COLLECTION);
    
    // Get the current report to check ownership
    const userId = authPayload.userId || authPayload.sub;
    const existingReport = await scheduledReportsCollection.findOne({ _id: reportId, userId });
    
    if (!existingReport) {
      return res.status(404).json({ error: "Report not found or you don't have permission to cancel it" });
    }
    
    // Update the report to set isActive to false
    await scheduledReportsCollection.updateOne(
      { _id: reportId },
      { 
        $set: {
          isActive: false,
          updatedAt: new Date()
        }
      }
    );
    
    return res.status(200).json({ 
      success: true, 
      message: "Scheduled report canceled successfully. Generated reports are still available." 
    });
  } catch (error) {
    console.error("Error canceling scheduled report:", error);
    return res.status(500).json({ error: "Failed to cancel scheduled report" });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Helper function to calculate the next execution time based on frequency
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
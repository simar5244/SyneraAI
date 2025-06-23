import { MongoClient } from 'mongodb';
import { verifyAuth } from '@/lib/auth';

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const REPORT_COLLECTION_NAME = "saved_reports";

export default async function handler(req, res) {
  // Check for valid authentication
  let authPayload;
  try {
    // Get token from Authorization header or cookies
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies.token;
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Verify the token
    authPayload = await verifyAuth(token);
    
    if (!authPayload || !authPayload.companyCode) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }
  } catch (authError) {
    console.error("Authentication error:", authError);
    return res.status(401).json({ error: 'Authentication failed' });
  }
  
  // Handle different HTTP methods
  if (req.method === 'GET') {
    return handleGetReports(req, res, authPayload);
  } else if (req.method === 'POST') {
    // Process POST requests based on the action parameter
    const { action } = req.body;
    
    switch (action) {
      case 'getReport':
        return handleGetReport(req, res, authPayload);
      case 'updateReport':
        return handleUpdateReport(req, res, authPayload);
      case 'deleteReport':
        return handleDeleteReport(req, res, authPayload);
      case 'saveReport':
        return handleSaveReport(req, res, authPayload);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

// Handler for GET requests - retrieve saved reports
async function handleGetReports(req, res, authPayload) {
  let client;
  try {
    // Connect to MongoDB
    client = await MongoClient.connect(process.env.MONGODB_URI);
    
    // Get the company DB based on authenticated user
    const companyDbName = `company_${authPayload.companyCode.toLowerCase()}`;
    const companyDb = client.db(companyDbName);
    const savedReportsCollection = companyDb.collection("saved_reports");
    
    // Get the reports for the current user
    const userId = authPayload.userId || authPayload.sub;
    const reports = await savedReportsCollection.find({ userId }).sort({ createdAt: -1 }).toArray();
    
    return res.status(200).json({ reports });
  } catch (error) {
    console.error("Error retrieving saved reports:", error);
    return res.status(500).json({ error: "Failed to retrieve saved reports" });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Handler for POST requests to get a specific report
async function handleGetReport(req, res, authPayload) {
  let client;
  try {
    const { reportId } = req.body;
    
    if (!reportId) {
      return res.status(400).json({ error: "Report ID is required" });
    }
    
    // Connect to MongoDB
    client = await MongoClient.connect(process.env.MONGODB_URI);
    
    // Get the company DB based on authenticated user
    const companyDbName = `company_${authPayload.companyCode.toLowerCase()}`;
    const companyDb = client.db(companyDbName);
    const savedReportsCollection = companyDb.collection("saved_reports");
    
    // Find the report
    const report = await savedReportsCollection.findOne({ _id: reportId });
    
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    
    // Ensure report has versions array initialized if not already present
    if (!report.versions || !Array.isArray(report.versions)) {
      report.versions = [];
    }
    
    // Convert dates to ISO strings for proper serialization
    if (report.versions && report.versions.length > 0) {
      report.versions = report.versions.map(version => ({
        ...version,
        timestamp: new Date(version.timestamp).toISOString()
      }));
    }
    
    return res.status(200).json({ report });
  } catch (error) {
    console.error("Error retrieving report:", error);
    return res.status(500).json({ error: "Failed to retrieve report" });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Handler for POST requests to update a report
async function handleUpdateReport(req, res, authPayload) {
  let client;
  try {
    const { reportId, reportData } = req.body;
    
    if (!reportId || !reportData) {
      return res.status(400).json({ error: "Report ID and updated data are required" });
    }
    
    // Connect to MongoDB
    client = await MongoClient.connect(process.env.MONGODB_URI);
    
    // Get the company DB based on authenticated user
    const companyDbName = `company_${authPayload.companyCode.toLowerCase()}`;
    const companyDb = client.db(companyDbName);
    const savedReportsCollection = companyDb.collection("saved_reports");
    
    // Make sure versions is an array
    if (!reportData.versions || !Array.isArray(reportData.versions)) {
      reportData.versions = [];
    }
    
    // Ensure timestamps are Date objects
    reportData.versions = reportData.versions.map(version => ({
      ...version,
      timestamp: new Date(version.timestamp)
    }));
    
    // Update the report
    const result = await savedReportsCollection.updateOne(
      { _id: reportId },
      { $set: reportData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Report not found" });
    }
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error updating report:", error);
    return res.status(500).json({ error: "Failed to update report" });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Handler for POST requests to save (insert or upsert) a report
async function handleSaveReport(req, res, authPayload) {
  let client;
  try {
    const { reportId, reportData } = req.body;
    if (!reportId || !reportData) {
      return res.status(400).json({ error: 'Report ID and report data are required' });
    }

    // Ensure timestamps are Date objects for MongoDB
    if (reportData.metadata) {
      reportData.metadata.createdAt = reportData.metadata.createdAt ? new Date(reportData.metadata.createdAt) : new Date();
      reportData.metadata.updatedAt = new Date();
    }

    // Connect to MongoDB
    client = await MongoClient.connect(process.env.MONGODB_URI);

    const companyDbName = `company_${authPayload.companyCode.toLowerCase()}`;
    const companyDb = client.db(companyDbName);
    const savedReportsCollection = companyDb.collection('saved_reports');

    // Prepare timestamps
    const now = new Date();
    reportData.createdAt = reportData.createdAt ? new Date(reportData.createdAt) : now;
    reportData.updatedAt = now;

    // Also keep metadata timestamps in sync
    if (reportData.metadata) {
      reportData.metadata.createdAt = reportData.metadata.createdAt ? new Date(reportData.metadata.createdAt) : now;
      reportData.metadata.updatedAt = now;
    }

    // Upsert report (insert if new, update if exists)
    // Exclude fields that conflict with $setOnInsert
    const { createdAt: _cA, updatedAt: _uA, ...reportDataForSet } = reportData;

    await savedReportsCollection.updateOne(
      { _id: reportId },
      {
        $set: {
          ...reportDataForSet,
          userId: authPayload.userId || authPayload.sub,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving report:', error);
    return res.status(500).json({ error: 'Failed to save report' });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Handler for POST requests to delete a report
async function handleDeleteReport(req, res, authPayload) {
  let client;
  try {
    const { reportId } = req.body;
    
    if (!reportId) {
      return res.status(400).json({ error: "Report ID is required" });
    }
    
    // Connect to MongoDB
    client = await MongoClient.connect(process.env.MONGODB_URI);
    
    // Get the company DB based on authenticated user
    const companyDbName = `company_${authPayload.companyCode.toLowerCase()}`;
    const companyDb = client.db(companyDbName);
    const savedReportsCollection = companyDb.collection("saved_reports");
    
    // Delete the report
    const result = await savedReportsCollection.deleteOne({ _id: reportId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Report not found or you do not have permission to delete it" });
    }
    
    return res.status(200).json({ success: true, message: "Report deleted successfully" });
  } catch (error) {
    console.error("Error deleting report:", error);
    return res.status(500).json({ error: "Failed to delete report" });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

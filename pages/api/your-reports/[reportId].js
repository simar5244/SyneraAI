import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DATABASE || process.env.MONGODB_DB_NAME || "org_sim_db";
const REPORT_HISTORY_COLLECTION_NAME = "report_history";
const AUTOMATED_REPORTS_COLLECTION_NAME = "automated_reports";

export default async function handler(req, res) {
  // Extract the report ID from the request URL
  const { reportId } = req.query;
  
  if (!reportId || typeof reportId !== 'string') {
    return res.status(400).json({ error: 'Valid report ID is required' });
  }
  
  let client;
  
  try {
    // For demo purposes - in a real app, get this from the authenticated session
    const userEmail = req.headers['user-email'] || 'user@example.com';
    
    // Connect to MongoDB
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set.');
    }
    
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    const reportHistoryCollection = db.collection(REPORT_HISTORY_COLLECTION_NAME);
    const automatedReportsCollection = db.collection(AUTOMATED_REPORTS_COLLECTION_NAME);
    
    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getReport(reportId, userEmail, reportHistoryCollection, automatedReportsCollection, res);
      case 'DELETE':
        return await deleteReport(reportId, userEmail, reportHistoryCollection, automatedReportsCollection, res);
      default:
        res.setHeader('Allow', ['GET', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error(`Error processing request for report ${reportId}:`, error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : String(error)
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

async function getReport(reportId, userEmail, reportHistoryCollection, automatedReportsCollection, res) {
  let report;
  let isAutomated = false;
  
  try {
    // First, try to find the report in the manual reports collection
    report = await reportHistoryCollection.findOne({ 
      _id: new ObjectId(reportId),
      userEmail: userEmail  // Ensure user can only access their own reports
    });
    
    // If not found in manual reports, check automated reports
    if (!report) {
      report = await automatedReportsCollection.findOne({ 
        _id: new ObjectId(reportId),
        userEmail: userEmail,
        isCompleted: true
      });
      
      if (report) {
        isAutomated = true;
      }
    }
    
    // If report still not found, return 404
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    // Format the report for the response
    const formattedReport = {
      reportId: report._id.toString(),
      title: isAutomated 
        ? (report.reportName || 'Automated Report') 
        : (report.title || report.reportTopic || 'Untitled Report'),
      content: report.content || '',
      visualizations: report.visualizations || [],
      queryResults: report.queryResults || {},
      createdAt: isAutomated 
        ? (report.generatedAt || report.createdAt) 
        : report.createdAt,
      wordCount: report.wordCount || null,
      isAutomated
    };
    
    return res.status(200).json(formattedReport);
  } catch (error) {
    console.error(`Error retrieving report ${reportId}:`, error);
    throw error; // Let the main handler catch this
  }
}

async function deleteReport(reportId, userEmail, reportHistoryCollection, automatedReportsCollection, res) {
  try {
    // Try to delete from manual reports first
    let result = await reportHistoryCollection.deleteOne({ 
      _id: new ObjectId(reportId),
      userEmail: userEmail  // Ensure user can only delete their own reports
    });
    
    // If not found or not deleted, try automated reports
    if (result.deletedCount === 0) {
      result = await automatedReportsCollection.deleteOne({ 
        _id: new ObjectId(reportId),
        userEmail: userEmail
      });
    }
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Report not found or you do not have permission to delete it' });
    }
    
    return res.status(200).json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    console.error(`Error deleting report ${reportId}:`, error);
    throw error; // Let the main handler catch this
  }
} 
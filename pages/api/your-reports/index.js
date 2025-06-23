import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DATABASE || process.env.MONGODB_DB_NAME || "org_sim_db";
const REPORT_HISTORY_COLLECTION_NAME = "report_history";
const AUTOMATED_REPORTS_COLLECTION_NAME = "automated_reports";

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }
  
  let client;
  
  try {
    // For now, we're just getting a dummy userEmail from the request (session would provide this in a real app)
    // In a production app, we would get this from the authenticated session
    const userEmail = req.headers['user-email'] || 'user@example.com';
    
    // Connect to MongoDB
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set.');
    }
    
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    const reportHistoryCollection = db.collection(REPORT_HISTORY_COLLECTION_NAME);
    const automatedReportsCollection = db.collection(AUTOMATED_REPORTS_COLLECTION_NAME);
    
    // Fetch both manual and automated reports for this user
    const manualReports = await reportHistoryCollection.find({ 
      userEmail: userEmail 
    }).sort({ createdAt: -1 }).toArray();
    
    const automatedReports = await automatedReportsCollection.find({ 
      userEmail: userEmail,
      isCompleted: true  // Only include completed automated reports
    }).sort({ generatedAt: -1 }).toArray();
    
    // Format and combine the reports
    const formattedManualReports = manualReports.map(report => ({
      reportId: report._id.toString(),
      title: report.title || report.reportTopic || 'Untitled Report',
      createdAt: report.createdAt || new Date(),
      wordCount: report.wordCount || null,
      isAutomated: false
    }));
    
    const formattedAutomatedReports = automatedReports.map(report => ({
      reportId: report._id.toString(),
      title: report.reportName || 'Automated Report',
      createdAt: report.generatedAt || report.createdAt || new Date(),
      wordCount: report.wordCount || null,
      isAutomated: true
    }));
    
    // Combine and sort by date
    const allReports = [...formattedManualReports, ...formattedAutomatedReports]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return res.status(200).json({ 
      reports: allReports 
    });
    
  } catch (error) {
    console.error('Error fetching reports:', error);
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
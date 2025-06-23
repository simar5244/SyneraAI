import { MongoClient, ObjectId } from 'mongodb';
import { verifyAuth } from '@/lib/auth';

// MongoDB connection parameters
const MONGODB_URI = process.env.MONGODB_URI;
const GENERATED_REPORTS_COLLECTION_NAME = "generated_reports";

export default async function handler(req, res) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Valid report ID is required' });
  }
  
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  let client;
  
  try {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set.');
    }
    
    // Get token from request
    const token = req.cookies.token || 
                 req.headers.authorization?.split(' ')[1] || 
                 '';
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Verify token and get company code
    const payload = await verifyAuth(token);
    
    if (!payload || !payload.companyCode) {
      return res.status(401).json({ error: 'Invalid authentication or missing company code' });
    }
    
    // Connect to MongoDB
    client = await MongoClient.connect(MONGODB_URI);
    
    // Get company-specific database
    const companyDbName = `company_${payload.companyCode.toLowerCase()}`;
    const companyDb = client.db(companyDbName);
    const generatedReportsCollection = companyDb.collection(GENERATED_REPORTS_COLLECTION_NAME);
    
    // Fetch the report by ID
    let reportId;
    try {
      reportId = new ObjectId(id);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid report ID format' });
    }
    
    const report = await generatedReportsCollection.findOne({ _id: reportId });
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    return res.status(200).json({
      success: true,
      report
    });
    
  } catch (error) {
    console.error('Error fetching report:', error);
    return res.status(500).json({
      error: 'Failed to fetch report',
      details: error instanceof Error ? error.message : String(error)
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
} 
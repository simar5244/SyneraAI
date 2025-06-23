import { MongoClient } from 'mongodb';
import { verifyAuth } from '@/lib/auth';

// MongoDB connection parameters
const MONGODB_URI = process.env.MONGODB_URI;
const GENERATED_REPORTS_COLLECTION_NAME = "generated_reports";

export default async function handler(req, res) {
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
    
    // Fetch all generated reports, sorted by creation date (newest first)
    const reports = await generatedReportsCollection.find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    return res.status(200).json({
      success: true,
      reports
    });
    
  } catch (error) {
    console.error('Error fetching reports:', error);
    return res.status(500).json({
      error: 'Failed to fetch reports',
      details: error instanceof Error ? error.message : String(error)
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
} 
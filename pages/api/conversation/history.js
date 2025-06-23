import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const MAIN_DB_NAME = process.env.MONGODB_DATABASE || process.env.MONGODB_DB_NAME || "org_sim_db";
const HISTORY_COLLECTION_NAME = "conversation_history";
const JWT_SECRET = process.env.JWT_SECRET || 'organization-galaxy-secret-key';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  let client;
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id parameter is required' });
    }

    // Get token from request
    const token = req.cookies.token || 
                 req.headers.authorization?.split(' ')[1] || 
                 '';
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Verify token and get company code
    let companyCode;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      companyCode = decoded.companyCode;
      
      if (!companyCode) {
        return res.status(403).json({ error: 'No company code found in token' });
      }
    } catch (tokenError) {
      console.error('Token verification failed:', tokenError);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
    
    // Connect to MongoDB
    client = await MongoClient.connect(MONGODB_URI);
    
    // Use company-specific database
    const companyDbName = `company_${companyCode.toLowerCase()}`;
    const db = client.db(companyDbName);
    const historyCollection = db.collection(HISTORY_COLLECTION_NAME);

    // Get conversation history
    const history = await getConversationHistory(historyCollection, session_id);

    // Return history
    return res.status(200).json({ history });
  } catch (error) {
    console.error('Error retrieving conversation history:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      details: error.message,
      history: []
    });
  } finally {
    // Close MongoDB connection
    if (client) {
      await client.close();
    }
  }
}

// Get conversation history for a session
async function getConversationHistory(collection, sessionId, limit = 20) {
  try {
    const history = await collection.find({ session_id: sessionId })
      .sort({ timestamp: 1 }) // Sort by timestamp in ascending order
      .limit(limit)
      .toArray();
    
    console.log(`Retrieved ${history.length} messages for session ${sessionId}`);
    return history;
  } catch (error) {
    console.error(`Error retrieving history for session ${sessionId}:`, error);
    return [];
  }
} 
import { MongoClient } from 'mongodb';
import { verifyAuth } from '@/lib/auth';

const MONGODB_URI = process.env.MONGODB_URI;
const COLLECTION_NAME = 'conversations';

export default async function handler(req, res) {
  // Authenticate user
  let authPayload;
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    authPayload = await verifyAuth(token);
    if (!authPayload || !authPayload.companyCode) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(401).json({ error: 'Authentication failed' });
  }

  switch (req.method) {
    case 'POST':
      return saveConversation(req, res, authPayload);
    case 'GET':
      return getConversations(req, res, authPayload);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function saveConversation(req, res, authPayload) {
  const { reportId, conversations } = req.body;
  if (!reportId || !Array.isArray(conversations)) {
    return res.status(400).json({ error: 'reportId and conversations array are required' });
  }
  let client;
  try {
    client = await MongoClient.connect(MONGODB_URI);
    const dbName = `company_${authPayload.companyCode.toLowerCase()}`;
    const db = client.db(dbName);
    const collection = db.collection(COLLECTION_NAME);

    await collection.updateOne(
      { reportId },
      {
        $set: { reportId, userId: authPayload.userId || authPayload.sub },
        $push: { messages: { $each: conversations } },
        $setOnInsert: { createdAt: new Date() },
        $currentDate: { updatedAt: true },
      },
      { upsert: true }
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error saving conversation:', err);
    return res.status(500).json({ error: 'Failed to save conversation' });
  } finally {
    if (client) await client.close();
  }
}

async function getConversations(req, res, authPayload) {
  const { reportId } = req.query;
  if (!reportId) {
    return res.status(400).json({ error: 'reportId is required' });
  }
  let client;
  try {
    client = await MongoClient.connect(MONGODB_URI);
    const dbName = `company_${authPayload.companyCode.toLowerCase()}`;
    const db = client.db(dbName);
    const collection = db.collection(COLLECTION_NAME);

    const doc = await collection.findOne({ reportId });
    return res.status(200).json({ conversations: doc?.messages || [] });
  } catch (err) {
    console.error('Error retrieving conversations:', err);
    return res.status(500).json({ error: 'Failed to retrieve conversations' });
  } finally {
    if (client) await client.close();
  }
}

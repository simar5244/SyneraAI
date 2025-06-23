import { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient } from 'mongodb';
import { jwtVerify } from 'jose';

// Determine MongoDB connection URI using primary or base env var
const uri: string | undefined = process.env.MONGODB_URI || process.env.MONGODB_URI_BASE;
console.log('[active-user-count] Using MongoDB URI:', uri);
let cachedClient: MongoClient | null = null;

async function getClient() {
  if (!uri) {
    throw new Error('MONGODB_URI must be defined');
  }
  if (cachedClient) {
    console.log('[active-user-count] Reusing cached MongoClient');
    return cachedClient;
  }
  // Create new MongoClient with verified URI
  const client = new MongoClient(uri!);
  console.log('[active-user-count] Connecting new MongoClient');
  await client.connect();
  console.log('[active-user-count] MongoClient connected');
  cachedClient = client;
  return client;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[active-user-count] Handler start, URI present:', Boolean(uri));
  if (!uri) {
    console.error('[active-user-count] No MongoDB URI configured');
    return res.status(500).json({ error: 'Database URI not configured' });
  }
  console.log('[active-user-count] API handler invoked');
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1] || '';
    if (!token) {
      console.log('[active-user-count] No token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
    const { payload } = await jwtVerify(token, secret);
    const companyCode = (payload.companyCode as string) || '';
    if (!companyCode) {
      console.log('[active-user-count] No companyCode in token');
      return res.status(400).json({ error: 'No company code in token' });
    }

    const client = await getClient();
    const db = client.db(`company_${companyCode.toLowerCase()}`);
    const activeCount = await db.collection('users').countDocuments({ active: true });
    console.log(`[active-user-count] Count for company_${companyCode.toLowerCase()}: ${activeCount}`);
    return res.status(200).json({ activeCount });
  } catch (err: any) {
    console.error('[active-user-count] Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import mongoose from 'mongoose';
import { verifyToken } from '@/lib/auth';

// Define response types
type VectorSearchResponse = {
  employees: any[];
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VectorSearchResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ employees: [], error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ employees: [], error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const userData = await verifyToken(token);

    if (!userData || !userData.email) {
      return res.status(401).json({ employees: [], error: 'Invalid token' });
    }

    // Extract request data
    const { embedding, companyCode, limit = 10 } = req.body;

    if (!embedding || !Array.isArray(embedding) || !companyCode) {
      return res.status(400).json({ 
        employees: [], 
        error: 'Invalid request: embedding and companyCode are required' 
      });
    }

    // Connect to the company-specific database
    // Following multi-tenancy pattern where each company has its own database
    const dbName = `company_${companyCode.toLowerCase()}`;
    const db = mongoose.connection.useDb(dbName, { useCache: true });
    
    // Get the employees collection
    const employeesCollection = db.collection('users');
    
    // Perform vector search
    // Note: This assumes the collection has a vector index set up
    const pipeline = [
      {
        $vectorSearch: {
          index: 'skills_vector_index', // Make sure this index exists
          path: 'skills_embedding',
          queryVector: embedding,
          numCandidates: limit * 3,
          limit: limit
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          position: 1,
          department: 1,
          skills: 1,
          utilization: 1,
          jobResponsibilities: 1,
          score: { $meta: 'vectorSearchScore' }
        }
      }
    ];

    // Execute the aggregation pipeline
    const results = await employeesCollection.aggregate(pipeline).toArray();

    // Return the results
    return res.status(200).json({ employees: results });
  } catch (error: any) {
    console.error('Vector search error:', error);
    return res.status(500).json({ 
      employees: [], 
      error: `Server error: ${error.message}` 
    });
  }
}

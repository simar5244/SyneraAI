import { MongoClient, ObjectId } from 'mongodb';
import { verifyAuth } from '@/lib/auth';

const MONGODB_URI = process.env.MONGODB_URI;
const AUTOMATED_REPORTS_COLLECTION_NAME = "automated_reports";

export default async function handler(req, res) {
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
    const automatedReportsCollection = companyDb.collection(AUTOMATED_REPORTS_COLLECTION_NAME);
    
    if (req.method === 'GET') {
      // Fetch all scheduled reports, sorted by creation date (newest first)
      const reports = await automatedReportsCollection.find({})
        .sort({ createdAt: -1 })
        .toArray();
      
      return res.status(200).json({
        success: true,
        reports
      });
    } else if (req.method === 'POST') {
      // Create a new scheduled report
      const {
        title,
        description,
        frequency,
        customFrequency,
        reportSpecification,
        includeDepartmentBreakdown,
        includeAttritionRisk,
        includeUtilizationScores,
        includeDuties,
        includeProjects,
        includeEmployeeProfiles
      } = req.body;
      
      if (!title || !frequency || !reportSpecification) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      // Calculate the next generation date
      const nextGenerationDate = calculateNextGenerationDate(frequency, customFrequency);
      
      // Create the new report
      const now = new Date();
      const newReport = {
        title,
        description: description || '',
        frequency,
        customFrequency: frequency === 'custom' ? customFrequency : null,
        reportSpecification,
        includeDepartmentBreakdown: includeDepartmentBreakdown || false,
        includeAttritionRisk: includeAttritionRisk || false,
        includeUtilizationScores: includeUtilizationScores || false,
        includeDuties: includeDuties || false,
        includeProjects: includeProjects || false,
        includeEmployeeProfiles: includeEmployeeProfiles || false,
        isActive: true,
        nextGenerationDate,
        createdAt: now,
        updatedAt: now,
        companyCode: payload.companyCode // Store the company code for reference
      };
      
      const result = await automatedReportsCollection.insertOne(newReport);
      
      return res.status(201).json({
        success: true,
        reportId: result.insertedId.toString(),
        report: {
          ...newReport,
          _id: result.insertedId
        }
      });
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error processing automated reports:', error);
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

// Helper function to calculate next generation date
function calculateNextGenerationDate(frequency, customFrequency) {
  const now = new Date();
  let nextDate = new Date(now);
  
  switch(frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'custom':
      if (customFrequency?.value && customFrequency?.unit) {
        switch(customFrequency.unit) {
          case 'days':
            nextDate.setDate(nextDate.getDate() + customFrequency.value);
            break;
          case 'weeks':
            nextDate.setDate(nextDate.getDate() + (customFrequency.value * 7));
            break;
          case 'months':
            nextDate.setMonth(nextDate.getMonth() + customFrequency.value);
            break;
          default:
            nextDate.setDate(nextDate.getDate() + 30); // Default to 30 days
        }
      } else {
        nextDate.setDate(nextDate.getDate() + 30); // Default to 30 days
      }
      break;
    default:
      nextDate.setMonth(nextDate.getMonth() + 1); // Default to monthly
  }
  
  return nextDate;
} 
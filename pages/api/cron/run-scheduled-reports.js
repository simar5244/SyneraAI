import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DATABASE || process.env.MONGODB_DB_NAME || "org_sim_db";
const AUTOMATED_REPORTS_COLLECTION_NAME = "automated_reports";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

export default async function handler(req, res) {
  // This endpoint is intended to be called by a cron job
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // API key validation for security
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  let client;
  
  try {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set.');
    }
    
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    const automatedReportsCollection = db.collection(AUTOMATED_REPORTS_COLLECTION_NAME);
    
    // Find all active reports that are due for generation
    const now = new Date();
    const reportsToRun = await automatedReportsCollection.find({
      isActive: true,
      nextGenerationDate: { $lte: now }
    }).toArray();
    
    console.log(`Found ${reportsToRun.length} reports to generate`);
    
    // Generate each report
    const results = await Promise.allSettled(
      reportsToRun.map(async (report) => {
        try {
          // Call our generate API endpoint for each report
          const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/automated-reports/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': INTERNAL_API_KEY
            },
            body: JSON.stringify({
              reportId: report._id.toString()
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to generate report: ${errorData.error || response.statusText}`);
          }
          
          return {
            reportId: report._id.toString(),
            status: 'success',
            message: 'Report generated successfully'
          };
        } catch (error) {
          console.error(`Error generating report ${report._id}:`, error);
          
          // Update the report with error information
          await automatedReportsCollection.updateOne(
            { _id: report._id },
            { 
              $set: {
                lastError: error.message,
                lastErrorAt: new Date(),
                // Calculate next generation date despite the error
                nextGenerationDate: calculateNextGenerationDate(report.frequency, report.customFrequency),
                updatedAt: new Date()
              }
            }
          );
          
          return {
            reportId: report._id.toString(),
            status: 'error',
            error: error.message
          };
        }
      })
    );
    
    // Return results
    const successes = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected').length;
    
    return res.status(200).json({
      message: `Processed ${reportsToRun.length} reports`,
      success: successes,
      failed: failures,
      details: results
    });
    
  } catch (error) {
    console.error('Error running scheduled reports:', error);
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
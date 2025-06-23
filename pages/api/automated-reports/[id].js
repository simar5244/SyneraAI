import { MongoClient, ObjectId } from 'mongodb';
import { verifyAuth } from '@/lib/auth';

// MongoDB connection parameters
const MONGODB_URI = process.env.MONGODB_URI;
const AUTOMATED_REPORTS_COLLECTION_NAME = "automated_reports";

export default async function handler(req, res) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Valid report ID is required' });
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
    const automatedReportsCollection = companyDb.collection(AUTOMATED_REPORTS_COLLECTION_NAME);
    
    // Convert ID string to MongoDB ObjectId
    let reportId;
    try {
      reportId = new ObjectId(id);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid report ID format' });
    }
    
    if (req.method === 'GET') {
      // Fetch the scheduled report by ID
      const report = await automatedReportsCollection.findOne({ _id: reportId });
      
      if (!report) {
        return res.status(404).json({ error: 'Scheduled report not found' });
      }
      
      // Ensure the report belongs to the user's company
      if (report.companyCode && report.companyCode !== payload.companyCode) {
        return res.status(403).json({ error: 'Access denied to this report' });
      }
      
      return res.status(200).json({
        success: true,
        report
      });
      
    } else if (req.method === 'DELETE') {
      // Check if report exists and belongs to user's company
      const existingReport = await automatedReportsCollection.findOne({ _id: reportId });
      
      if (!existingReport) {
        return res.status(404).json({ error: 'Scheduled report not found' });
      }
      
      if (existingReport.companyCode && existingReport.companyCode !== payload.companyCode) {
        return res.status(403).json({ error: 'Access denied to this report' });
      }
      
      // Delete the scheduled report
      const result = await automatedReportsCollection.deleteOne({ _id: reportId });
      
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Scheduled report not found' });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Scheduled report deleted successfully'
      });
      
    } else if (req.method === 'PATCH') {
      // Check if report exists and belongs to user's company
      const existingReport = await automatedReportsCollection.findOne({ _id: reportId });
      
      if (!existingReport) {
        return res.status(404).json({ error: 'Scheduled report not found' });
      }
      
      if (existingReport.companyCode && existingReport.companyCode !== payload.companyCode) {
        return res.status(403).json({ error: 'Access denied to this report' });
      }
      
      // Update the scheduled report
      const { 
        title, 
        description, 
        frequency, 
        customFrequency, 
        reportSpecification,
        isActive,
        includeDepartmentBreakdown,
        includeAttritionRisk,
        includeUtilizationScores,
        includeDuties,
        includeProjects,
        includeEmployeeProfiles
      } = req.body;
      
      // Build update document with only provided fields
      const updateDoc = { updatedAt: new Date() };
      
      if (title !== undefined) updateDoc.title = title;
      if (description !== undefined) updateDoc.description = description;
      if (frequency !== undefined) {
        updateDoc.frequency = frequency;
        updateDoc.customFrequency = frequency === 'custom' ? customFrequency : null;
        
        // Update next generation date if frequency changes
        updateDoc.nextGenerationDate = calculateNextGenerationDate(frequency, customFrequency);
      }
      if (reportSpecification !== undefined) updateDoc.reportSpecification = reportSpecification;
      if (isActive !== undefined) updateDoc.isActive = isActive;
      if (includeDepartmentBreakdown !== undefined) updateDoc.includeDepartmentBreakdown = includeDepartmentBreakdown;
      if (includeAttritionRisk !== undefined) updateDoc.includeAttritionRisk = includeAttritionRisk;
      if (includeUtilizationScores !== undefined) updateDoc.includeUtilizationScores = includeUtilizationScores;
      if (includeDuties !== undefined) updateDoc.includeDuties = includeDuties;
      if (includeProjects !== undefined) updateDoc.includeProjects = includeProjects;
      if (includeEmployeeProfiles !== undefined) updateDoc.includeEmployeeProfiles = includeEmployeeProfiles;
      
      const result = await automatedReportsCollection.updateOne(
        { _id: reportId },
        { $set: updateDoc }
      );
      
      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Scheduled report not found' });
      }
      
      // Fetch and return the updated report
      const updatedReport = await automatedReportsCollection.findOne({ _id: reportId });
      
      return res.status(200).json({
        success: true,
        report: updatedReport
      });
      
    } else {
      res.setHeader('Allow', ['GET', 'DELETE', 'PATCH']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('Error processing scheduled report:', error);
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
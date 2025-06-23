import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { unstable_noStore as noStore } from 'next/cache';
import { verifyAuth } from '@/lib/auth';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';

/**
 * Merges integration data into user profiles by matching email addresses
 * This API requires admin privileges or specific permissions
 */
export async function POST(request: NextRequest) {
  noStore();
  let client: MongoClient | null = null;
  
  try {
    // 1. Verify authentication and authorization
    const token = request.headers.get('authorization')?.split(' ')[1] || request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const payload = await verifyAuth(token);
    if (!payload || !payload.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user has admin privileges
    if (!['admin', 'superadmin'].includes(payload.role)) {
      return NextResponse.json({ error: 'Insufficient permissions to perform this operation' }, { status: 403 });
    }
    
    const userEmail = payload.email;
    const companyCode = payload.companyCode;
    
    if (!companyCode) {
      return NextResponse.json({ error: 'Company code not found in user profile' }, { status: 400 });
    }
    
    console.log(`Integration merge operation initiated by: ${userEmail} (User ID: ${payload.id}, Company: ${companyCode})`);

    // Validate MongoDB connection string
    if (!uri || uri.trim() === '') {
      console.error('MongoDB URI is not set or empty');
      return NextResponse.json(
        { error: 'Database configuration missing' },
        { status: 500 }
      );
    }

    // Parse request body for any optional parameters
    const requestBody = await request.json().catch(() => ({}));
    const options = {
      dryRun: requestBody.dryRun === true,
      specificEmails: Array.isArray(requestBody.emails) ? requestBody.emails : null,
      updateExistingFields: requestBody.updateExistingFields === true
    };

    // Connect to MongoDB - Use company specific database
    const dbName = `company_${companyCode}`;
    console.log(`Connecting to MongoDB company database: ${dbName}`);
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(dbName);
    const integrationsCollection = db.collection('integrations');
    const usersCollection = db.collection('users');
    
    // 1. Get all integration records with employee data
    const query = options.specificEmails ? 
      { email: { $in: options.specificEmails } } : 
      { email: { $exists: true, $ne: null } };
    
    const integrationRecords = await integrationsCollection.find(query).toArray();
    
    if (integrationRecords.length === 0) {
      return NextResponse.json({
        message: 'No integration records with email found',
        recordsProcessed: 0
      });
    }
    
    console.log(`Found ${integrationRecords.length} integration records with email`);
    
    // Track statistics
    const stats = {
      total: integrationRecords.length,
      matched: 0,
      updated: 0,
      errors: 0,
      skipped: 0
    };
    
    const errorDetails: { email: string, error: string }[] = [];
    
    // Perform dry run or actual update
    if (options.dryRun) {
      console.log('Performing dry run - no data will be modified');
      
      // Just count matches but don't update
      for (const record of integrationRecords) {
        const email = record.email;
        if (!email) {
          stats.skipped++;
          continue;
        }
        
        // Check if user exists
        const user = await usersCollection.findOne({ email });
        if (user) {
          stats.matched++;
        } else {
          stats.skipped++;
        }
      }
      
      return NextResponse.json({
        success: true,
        dryRun: true,
        stats,
        message: 'Dry run completed successfully'
      });
    }
    
    // Perform the actual update
    for (const record of integrationRecords) {
      const email = record.email;
      if (!email) {
        stats.skipped++;
        continue;
      }
      
      try {
        // Find the user with matching email
        const user = await usersCollection.findOne({ email });
        if (!user) {
          stats.skipped++;
          continue;
        }
        
        stats.matched++;
        
        // Prepare update object excluding MongoDB specific fields and email (which we're matching on)
        const updateData: any = {};
        for (const [key, value] of Object.entries(record)) {
          if (!['_id', 'email', 'uploader', 'uploadedAt', 'status', 'type'].includes(key)) {
            updateData[key] = value;
          }
        }
        
        if (Object.keys(updateData).length === 0) {
          // No fields to update
          stats.skipped++;
          continue;
        }
        
        // Update user document
        // If updateExistingFields is false, we only set fields that don't exist
        const updateOperation = options.updateExistingFields ? 
          { $set: updateData } : 
          { $setOnInsert: updateData };
          
        const updateResult = await usersCollection.updateOne(
          { email },
          updateOperation,
          { upsert: false } // Don't create new documents
        );
        
        if (updateResult.modifiedCount > 0) {
          stats.updated++;
        }
      } catch (error) {
        stats.errors++;
        errorDetails.push({ 
          email, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        console.error(`Error updating user ${email}:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      stats,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
      message: `Successfully merged integration data for ${stats.updated} users`
    });
    
  } catch (error: any) {
    console.error('Error merging integration data:', error);
    let errorMessage = 'Error merging integration data';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
} 
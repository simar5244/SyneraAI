import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { MongoClient } from 'mongodb';
import { unstable_noStore as noStore } from 'next/cache';
import { verifyAuth } from '@/lib/auth';

// Import the integration data merger utility
const { mergeIntegrationDataNow } = require('@/utils/integrationDataMergerUtil');

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';
// We'll use company-specific database names

export async function POST(request: NextRequest) {
  noStore();
  let client: MongoClient | null = null;
  
  // 1. Verify authentication
  const tokenValue = request.headers.get('authorization')?.split(' ')[1] || request.cookies.get('token')?.value;
  if (!tokenValue) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  
  const payload = await verifyAuth(tokenValue);
  if (!payload || !payload.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userEmail = payload.email;
  const userId = payload.id;
  // Ensure companyCode is a string with a default empty value
  const companyCode = (payload.companyCode || '').toLowerCase();
  
  // For users without a company code, return error
  if (!companyCode) {
    return NextResponse.json({
      error: 'No company code found',
      message: 'Your account is not associated with a company'
    }, { status: 400 });
  }

  try {
    // Get FormData from the request
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Only CSV files are accepted' },
        { status: 400 }
      );
    }

    // Parse the CSV file
    const fileBuffer = await file.arrayBuffer();
    const fileContent = new TextDecoder().decode(fileBuffer);
    
    // First, parse the CSV to get the field names from the first row
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty or invalid' },
        { status: 400 }
      );
    }
    
    // Extract field names from the first record
    const fields = Object.keys(records[0]);
    
    console.log(`Parsed ${records.length} records with ${fields.length} fields from CSV file`);
    console.log('Fields:', fields);
    console.log('Sample record:', JSON.stringify(records[0]));

    // Validate MongoDB connection string
    if (!uri || uri.trim() === '') {
      console.error('MongoDB URI is not set or empty');
      return NextResponse.json(
        { error: 'Database connection configuration is missing' },
        { status: 500 }
      );
    }

    // Connect to MongoDB - Use company specific database
    const companyDbName = `company_${companyCode}`;
    console.log(`Connecting to MongoDB database: ${companyDbName}`);
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(companyDbName);
    
    // Check if integrations collection exists, create if not
    const collections = await db.listCollections({ name: 'integrations' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('integrations');
      console.log(`Created 'integrations' collection in ${companyDbName}`);
    }
    
    // Check if integration_history collection exists, create if not
    const historyCollections = await db.listCollections({ name: 'integration_history' }).toArray();
    if (historyCollections.length === 0) {
      await db.createCollection('integration_history');
      console.log(`Created 'integration_history' collection in ${companyDbName}`);
    }
    
    // Store employee records in the integrations collection
    const integrationsCollection = db.collection('integrations');
    
    // Prepare documents for the integrations collection - one document per CSV row
    // Each document will have the fields from the CSV plus minimal metadata
    const documents = records.map((record: Record<string, any>) => {
      // Start with a clean document containing only the company code
      const document: Record<string, any> = {
        _companyCode: companyCode
      };
      
      // Add each field from the CSV directly to the document
      fields.forEach((field: string) => {
        document[field] = record[field];
      });
      
      return document;
    });
    
    // Insert all documents into integrations collection
    const result = await integrationsCollection.insertMany(documents);
    
    // Store upload history in integration_history collection
    const historyCollection = db.collection('integration_history');
    await historyCollection.insertOne({
      type: 'csv_upload',
      filename: file.name,
      recordCount: records.length,
      uploadedAt: new Date(),
      uploader: userEmail,
      userId: userId,
      companyCode: companyCode,
      status: 'success',
      fields: fields // Store field names for reference
    });
    
    console.log(`Successfully inserted integration document with ${records.length} entries into ${companyDbName}.integrations`);
    console.log(`Recorded upload in integration_history collection`);
    
    // Close the MongoDB connection before running the merger
    // This is important because the merger opens its own connection
    if (client) {
      await client.close();
      client = null;
      console.log('MongoDB connection closed');
    }
    
    // IMMEDIATELY run the merger to process new data
    console.log('Triggering immediate data merge...');
    const mergeResult = await mergeIntegrationDataNow(companyCode);
    console.log(`Merge completed with result: ${mergeResult.success ? 'Success' : 'Failed'}`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully imported ${records.length} employee records`,
      count: records.length,
      mergeStatus: mergeResult.success ? 'success' : 'failed',
      mergeStats: mergeResult.stats || null
    });
    
  } catch (error: any) {
    console.error('Error handling CSV upload:', error);
    let errorMessage = 'Error processing CSV file';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error('Error stack:', error.stack);
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Could not connect to database. Please check your connection settings.';
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: typeof error === 'object' ? JSON.stringify(error) : String(error)
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

// Handle listing and downloading CSV uploads
export async function GET(request: NextRequest) {
  noStore();
  let client: MongoClient | null = null;
  
  try {
    console.log(`CSV Upload API called: ${request.url}`);
    
    // 1. Verify authentication - check headers or query param
    const headerToken = request.headers.get('authorization')?.split(' ')[1];
    const queryToken = request.nextUrl.searchParams.get('token');
    const cookieToken = request.cookies.get('token')?.value;
    const token = headerToken || queryToken || cookieToken;
    
    console.log(`Auth sources available: header=${!!headerToken}, query=${!!queryToken}, cookie=${!!cookieToken}`);
    
    if (!token) {
      console.error('No token provided in CSV upload API request');
      return NextResponse.json({ error: 'Authentication required', details: 'No token provided' }, { status: 401 });
    }
    
    const payload = await verifyAuth(token);
    if (!payload || !payload.id) {
      console.error('Unauthorized access to CSV upload API', { 
        hasHeaderToken: !!headerToken,
        hasQueryToken: !!queryToken,
        hasCookieToken: !!cookieToken,
        tokenLength: token?.length,
        tokenFirstChars: token ? token.slice(0, 10) + '...' : 'none'
      });
      return NextResponse.json({ error: 'Unauthorized', details: 'Invalid or expired token' }, { status: 401 });
    }
    
    const userEmail = payload.email;
    const userId = payload.id;
    const companyCode = payload.companyCode?.toLowerCase(); // Force lowercase for consistency
    
    console.log(`CSV API accessed by: ${userEmail} (User ID: ${userId}, Company: ${companyCode})`);
    
    // For users without a company code, return error
    if (!companyCode) {
      return NextResponse.json({
        error: 'No company code found',
        message: 'Your account is not associated with a company'
      }, { status: 400 });
    }

    // Validate MongoDB connection string
    if (!uri || uri.trim() === '') {
      console.error('MongoDB URI is not set or empty in CSV upload GET handler');
      return NextResponse.json(
        { error: 'Database configuration missing', details: 'MongoDB URI not configured properly' },
        { status: 500 }
      );
    }

    // Connect to MongoDB - Use company specific database
    const companyDbName = `company_${companyCode}`;
    console.log(`Connecting to MongoDB for CSV upload: ${companyDbName}`);
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(companyDbName);
    
    // Check if integration_history collection exists
    const collections = await db.listCollections({ name: 'integration_history' }).toArray();
    if (collections.length === 0) {
      // If collection doesn't exist, return empty list
      console.log(`No integration_history collection found in ${companyDbName}`);
      return NextResponse.json([]);
    }
    
    const historyCollection = db.collection('integration_history');
    
    const filename = request.nextUrl.searchParams.get('filename');
    if (filename) {
      console.log(`Attempting to get data for file: ${filename} by user: ${userEmail}`);
      // Only allow users to access their own uploads
      const historyDoc = await historyCollection.findOne({ 
        filename, 
        userId: userId,
        type: 'csv_upload'
      });
      
      if (!historyDoc) {
        console.error(`File not found or not authorized: ${filename} for user: ${userEmail}`);
        return NextResponse.json({ 
          error: 'File not found', 
          details: 'Either the file does not exist or you do not have permission to access it' 
        }, { status: 404 });
      }
      
      // Check if integrations collection exists
      const integrationsExists = (await db.listCollections({ name: 'integrations' }).toArray()).length > 0;
      if (!integrationsExists) {
        return NextResponse.json({ 
          error: 'Integration data not found', 
          details: 'The integration data for this file is no longer available' 
        }, { status: 404 });
      }
      
      // Fetch the actual data from integrations collection
      const integrationsCollection = db.collection('integrations');
      
      // Get the fields from the history document
      const fields = historyDoc.fields || [];
      
      if (fields.length === 0) {
        return NextResponse.json({ 
          error: 'Field information missing', 
          details: 'Cannot retrieve data without field information' 
        }, { status: 404 });
      }
      
      // Query all documents for this file
      const records = await integrationsCollection.find({ 
        _companyCode: companyCode
      }).toArray();
      
      if (records.length === 0) {
        return NextResponse.json({ 
          error: 'No data found', 
          details: 'No records found for this company' 
        }, { status: 404 });
      }
      
      // Create CSV header row
      let csvContent = fields.join(',') + '\n';
      
      // Add data rows
      records.forEach((record: Record<string, any>) => {
        // Skip metadata fields
        const row = fields.map((field: string) => {
          const value = record[field];
          // Handle values with commas by quoting them
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value !== undefined ? value : '';
        }).join(',');
        csvContent += row + '\n';
      });
      
      console.log(`Generated CSV content for: ${filename} with ${records.length} records`);
      return new NextResponse(csvContent, { 
        headers: { 
          'Content-Type': 'text/csv', 
          'Content-Disposition': `attachment; filename="${filename}"` 
        } 
      });
    }
    
    // List only uploads by this user
    console.log(`Listing uploads for user: ${userEmail} (${userId})`);
    const list = await historyCollection.find(
      { 
        userId: userId,
        type: 'csv_upload'
      },
      { projection: { filename: 1, uploadedAt: 1, recordCount: 1, status: 1 } }
    ).sort({ uploadedAt: -1 }).toArray();
    
    console.log(`Found ${list.length} uploads for user: ${userEmail}`);
    return NextResponse.json(list);
  } catch (err) {
    console.error('Error in CSV upload API:', err);
    // Return a detailed error response
    return NextResponse.json({ 
      error: 'Failed to process request',
      details: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined
    }, { status: 500 });
  } finally {
    if (client) {
      try {
        await client.close();
        console.log('MongoDB connection closed successfully');
      } catch (closeErr) {
        console.error('Error closing MongoDB connection:', closeErr);
      }
    }
  }
}
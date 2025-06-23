import mongoose from 'mongoose';

// Ensure MONGODB_URI is defined
const MONGODB_URI: string = process.env.MONGODB_URI!;
if (!MONGODB_URI) {
  throw new Error('Please set the MONGODB_URI environment variable');
}

// Extract the base URI (without database specification or query params)
function getBaseUri() {
  // Strip any query parameters
  let baseUri = MONGODB_URI.split('?')[0];
  
  // Remove database name if present
  const lastSlashIndex = baseUri.lastIndexOf('/');
  // Only remove DB name if the last slash is after the @ in the connection string
  // This ensures we don't accidentally mangle a URL without a database name
  if (lastSlashIndex > baseUri.indexOf('@') && lastSlashIndex !== baseUri.length - 1) {
    baseUri = baseUri.substring(0, lastSlashIndex);
  }
  
  return baseUri;
}

// Cache for database connections
const connectionCache: Record<string, mongoose.Connection> = {};

/**
 * Ensures the main MongoDB connection is established
 */
async function ensureMainConnection() {
  // If already connected, just return
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  
  try {
    // Connect to MongoDB using the original URI
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    return mongoose.connection;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

/**
 * Connect to a company-specific database
 * @param companyCode The company code
 * @returns A mongoose connection to the company database
 */
export async function connectToCompanyDB(companyCode: string) {
  if (!companyCode) {
    throw new Error('Company code is required');
  }
  
  // Ensure companyCode is lowercase to maintain consistency
  companyCode = companyCode.toLowerCase();
  
  // Sanitize company code for database name
  const sanitizedCode = companyCode.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  const dbName = `company_${sanitizedCode}`;
  
  // Check cache first
  if (connectionCache[dbName]) {
    return connectionCache[dbName];
  }
  
  try {
    // Make sure we have a main connection first
    await ensureMainConnection();
    
    // Log the database we're connecting to
    console.log(`Connecting to company database: ${dbName}`);
    
    // Use the main connection to access the company database
    const connection = mongoose.connection.useDb(dbName, { useCache: true });
    
    // Cache the connection
    connectionCache[dbName] = connection;
    
    console.log(`Successfully connected to company database: ${dbName}`);
    return connection;
  } catch (error) {
    console.error(`Error connecting to company database (${dbName}):`, error);
    throw error;
  }
}

/**
 * Get the appropriate database connection
 * @param companyCode The company code (optional)
 * @returns The appropriate mongoose connection
 */
export async function getDBConnection(companyCode?: string) {
  // If no company code, return main connection
  if (!companyCode) {
    await ensureMainConnection();
    return mongoose.connection;
  }
  
  // Always convert companyCode to lowercase for consistency
  companyCode = companyCode.toLowerCase();
  
  // Get the company-specific connection
  return connectToCompanyDB(companyCode);
}

// Default export for backward compatibility
export default connectToCompanyDB; 
import mongoose, { ConnectOptions } from 'mongoose';

// Use MONGODB_URI_BASE for multi-tenant support
const MONGODB_URI_BASE = process.env.MONGODB_URI_BASE!;
// MONGODB_URI_BASE is asserted non-null; ensure this env var is set before starting

// Log the connection being used (for debugging only)
console.log(`Using MongoDB base connection: ${MONGODB_URI_BASE.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);

// Maintain a cache of connections per company
const companyDbCache: Record<string, {
  conn: any;
  promise: Promise<typeof import('mongoose')> | null;
}> = {};

/**
 * Gets the MongoDB URI for a specific company
 * @param companyCode The company code to get the URI for
 * @returns The MongoDB URI for the specified company
 */
function getCompanyMongoURI(companyCode: string): string {
  const MONGODB_URI_BASE = process.env.MONGODB_URI_BASE || 'mongodb://localhost:27017';
  
  // If the base URI already has query parameters, append to them
  if (MONGODB_URI_BASE.includes('?')) {
    const [base, query] = MONGODB_URI_BASE.split('?');
    return `${base}/company_${companyCode}?${query}`;
  }
  return `${MONGODB_URI_BASE}/company_${companyCode}`;
}

/**
 * Connects to a specific company's MongoDB database
 * @param companyCode The company code to connect to
 * @returns Mongoose connection to the company's database
 */
export async function connectToMongoDB(companyCode: string) {
  if (!companyCode) {
    throw new Error('Company code is required to connect to MongoDB');
  }

  if (companyDbCache[companyCode]?.conn) {
    return companyDbCache[companyCode].conn;
  }

  const uri = getCompanyMongoURI(companyCode);
  
  if (!companyDbCache[companyCode]) {
    companyDbCache[companyCode] = { conn: null, promise: null };
  }
  
  const entry = companyDbCache[companyCode];
  
  if (!entry.promise) {
    entry.promise = mongoose.connect(uri).then((mongoose) => {
      console.log(`MongoDB connected successfully to company_${companyCode}`);
      return mongoose;
    }).catch(err => {
      console.error(`Failed to connect to company_${companyCode}:`, err);
      throw err;
    });
  }
  
  try {
    entry.conn = await entry.promise;
    return entry.conn;
  } catch (err) {
    // Clear the cache on error to allow retries
    delete companyDbCache[companyCode];
    throw err;
  }
}

// Ensure default export of tenant connector
export default connectToMongoDB;
import mongoose, { ConnectOptions } from 'mongoose';
import { env } from './env';

// Log the connection being used (for debugging only)
const logSafeUri = (uri: string) => {
  try {
    return uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  } catch (e) {
    return 'invalid-uri';
  }
};

// Get the MongoDB URIs
const MONGODB_URI = env.mongodbUri;
const MONGODB_URI_BASE = env.mongodbUriBase;

// Log the connection being used
console.log(`Using MongoDB connection: ${logSafeUri(MONGODB_URI_BASE)}`);

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
  if (!companyCode) {
    throw new Error('Company code is required');
  }

  // Use MONGODB_URI directly if it's set and no company code is provided
  if (!companyCode && MONGODB_URI) {
    return MONGODB_URI;
  }
  
  // If we have a base URI, use it to construct the company-specific URI
  if (MONGODB_URI_BASE) {
    // If the base URI already has query parameters, append to them
    if (MONGODB_URI_BASE.includes('?')) {
      const [base, query] = MONGODB_URI_BASE.split('?');
      return `${base}/company_${companyCode}?${query}`;
    }
    return `${MONGODB_URI_BASE}/company_${companyCode}`;
  }
  
  // Fallback to default local MongoDB if nothing else is configured
  return `mongodb://localhost:27017/company_${companyCode}`;
}

/**
 * Connects to a specific company's MongoDB database
 * @param companyCode The company code to connect to
 * @returns Mongoose connection to the company's database
 */
async function connectToMongoDB(companyCode: string) {
  // If we're in the browser, we can't connect directly to MongoDB
  if (typeof window !== 'undefined') {
    throw new Error('Cannot connect to MongoDB from the browser');
  }

  if (!companyCode) {
    throw new Error('Company code is required to connect to MongoDB');
  }

  // Check if we have a cached connection
  if (companyDbCache[companyCode]?.conn) {
    return companyDbCache[companyCode].conn;
  }

  // Get the MongoDB URI for this company
  const uri = getCompanyMongoURI(companyCode);
  
  // Initialize cache entry if it doesn't exist
  if (!companyDbCache[companyCode]) {
    companyDbCache[companyCode] = { conn: null, promise: null };
  }
  
  const entry = companyDbCache[companyCode];
  
  // Only create a new connection promise if one doesn't exist
  if (!entry.promise) {
    const connectionOptions: ConnectOptions = {
      // Better connection handling
      maxPoolSize: 10, // Maximum number of connections in the connection pool
      serverSelectionTimeoutMS: 5000, // Time to wait for server selection
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      retryWrites: true,
      w: 'majority'
    };

    console.log(`Connecting to MongoDB for company: ${companyCode}`);
    
    entry.promise = mongoose.connect(uri, connectionOptions)
      .then((mongooseConnection) => {
        console.log(`✅ MongoDB connected successfully to company_${companyCode}`);
        
        // Set up error handling for the connection
        mongooseConnection.connection.on('error', (err) => {
          console.error('MongoDB connection error:', err);
          // Clear the cache on error to allow reconnection
          delete companyDbCache[companyCode];
        });
        
        mongooseConnection.connection.on('disconnected', () => {
          console.log('MongoDB disconnected');
          // Clear the cache on disconnection to allow reconnection
          delete companyDbCache[companyCode];
        });
        
        return mongooseConnection;
      })
      .catch((err) => {
        console.error(`❌ Failed to connect to company_${companyCode}:`, err.message);
        // Clear the failed promise from cache
        delete companyDbCache[companyCode];
        throw err;
      });
  }
  
  try {
    // Wait for the connection to be established
    entry.conn = await entry.promise;
    return entry.conn;
  } catch (err) {
    // Clear the cache on error to allow retries
    delete companyDbCache[companyCode];
    throw err;
  }
}

/**
 * Get a connection to the main database (without company prefix)
 */
export async function connectToMainDatabase() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined');
  }
  
  if (companyDbCache['main']?.conn) {
    return companyDbCache['main'].conn;
  }
  
  if (!companyDbCache['main']) {
    companyDbCache['main'] = { conn: null, promise: null };
  }
  
  const entry = companyDbCache['main'];
  
  if (!entry.promise) {
    console.log('Connecting to main MongoDB database...');
    
    entry.promise = mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      retryWrites: true,
      w: 'majority'
    })
    .then((mongooseConnection) => {
      console.log('✅ Connected to main MongoDB database');
      return mongooseConnection;
    })
    .catch((err) => {
      console.error('❌ Failed to connect to main MongoDB:', err.message);
      delete companyDbCache['main'];
      throw err;
    });
  }
  
  try {
    entry.conn = await entry.promise;
    return entry.conn;
  } catch (err) {
    delete companyDbCache['main'];
    throw err;
  }
}

// Export connectToMongoDB as both default and named export
export { connectToMongoDB };
export default connectToMongoDB;
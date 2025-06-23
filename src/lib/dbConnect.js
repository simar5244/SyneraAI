import mongoose from 'mongoose';

// Allow using MONGODB_URI or fallback to MONGODB_URI_BASE
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URI_BASE;

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI or MONGODB_URI_BASE in .env.local');
}

// Cache connections to avoid reconnecting for every request
let cachedMainConnection = null;
let cachedAuthConnection = null;

// Connect to the main database
async function connectDB() {
  // Return cached connection if available
  if (cachedMainConnection) {
    return cachedMainConnection;
  }

  // Connect to main database
  try {
    console.log('MongoDB connecting to main database...');
    const conn = await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected successfully');
    cachedMainConnection = conn;
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Connect to the central auth database
async function connectAuthDB() {
  // Return cached connection if available
  if (cachedAuthConnection) {
    return cachedAuthConnection;
  }

  // Connect to auth database (auth_db)
  try {
    console.log('MongoDB connecting to auth database...');
    // Create a new connection for auth DB instead of reusing the default connection
    const authDBURI = MONGODB_URI.replace(/\/[^/]+(\?|$)/, '/auth_db$1');
    const authConn = mongoose.createConnection(authDBURI);
    
    // Add connection event listeners
    authConn.on('connected', () => {
      console.log('MongoDB auth database connected successfully');
    });
    
    authConn.on('error', (err) => {
      console.error('MongoDB auth database connection error:', err);
    });
    
    cachedAuthConnection = authConn;
    return authConn;
  } catch (error) {
    console.error('MongoDB auth database connection error:', error);
    throw error;
  }
}

// Get a connection to a specific company database
async function getCompanyDBConnection(companyCode) {
  if (!companyCode) {
    throw new Error('Company code is required');
  }
  
  try {
    const dbName = `company_${companyCode}`;
    const companyDBURI = MONGODB_URI.replace(/\/[^/]+(\?|$)/, `/${dbName}$1`);
    return mongoose.createConnection(companyDBURI);
  } catch (error) {
    console.error(`Error connecting to company database ${companyCode}:`, error);
    throw error;
  }
}

export { connectAuthDB, getCompanyDBConnection };
export default connectDB; 
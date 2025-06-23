import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://simarjotsingh5244:NUMotMgntP7AcNrQ@cluster0.nen0dzs.mongodb.net/org_sim_db';
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'org_sim_db';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

// Define interface for the cached connection
interface MongoClientCache {
  conn: { client: MongoClient; db: Db } | null;
  promise: Promise<{ client: MongoClient; db: Db }> | null;
}

// Define global for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var mongoClientPromise: MongoClientCache | undefined;
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached: MongoClientCache = global.mongoClientPromise || { conn: null, promise: null };

if (!global.mongoClientPromise) {
  global.mongoClientPromise = cached;
}

/**
 * Connect to MongoDB database using MongoClient
 */
export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    console.log(`Connecting to MongoDB Atlas: ${MONGODB_DATABASE}`);
    cached.promise = MongoClient.connect(MONGODB_URI).then((client) => {
      console.log('Successfully connected to MongoDB Atlas');
      return {
        client,
        db: client.db(MONGODB_DATABASE),
      };
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('Failed to connect to MongoDB:', e);
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase; 
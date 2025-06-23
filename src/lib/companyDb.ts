import { MongoClient } from 'mongodb';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';
const mainDbName = 'org_sim_db';

/**
 * Connect to a company's database based on company code
 * @param companyCode The company code
 * @returns Object containing MongoDB client, main database, and company database
 */
export async function connectToCompanyDb(companyCode: string) {
  const client = new MongoClient(uri);
  await client.connect();
  
  // Main database for cross-company data
  const mainDb = client.db(mainDbName);
  
  // Company-specific database
  const companyDbName = `company_${companyCode.toLowerCase()}`;
  const companyDb = client.db(companyDbName);
  
  return {
    client,
    mainDb,
    companyDb
  };
}

/**
 * Get the company database name from a company code
 * @param companyCode The company code
 * @returns The company database name
 */
export function getCompanyDbName(companyCode: string): string {
  return `company_${companyCode.toLowerCase()}`;
}

/**
 * Middleware to handle database selection based on user token
 * This can be used in API routes to select the appropriate database
 * @param req The Next.js request object
 * @param tokenPayload The decoded JWT token payload (should include companyCode)
 * @returns Object containing MongoDB client, main database, and company database
 */
export async function selectCompanyDb(req: any, tokenPayload: any) {
  if (!tokenPayload || !tokenPayload.companyCode) {
    throw new Error('No company code found in token payload');
  }
  
  const { companyCode } = tokenPayload;
  return await connectToCompanyDb(companyCode);
} 
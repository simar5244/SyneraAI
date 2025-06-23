import mongoose from 'mongoose';

// Keep track of connections for different company databases
const connections: { [key: string]: mongoose.Connection } = {};
// Cache to store model instances by company code
const modelCache: Record<string, any> = {};

// Main MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || '';

/**
 * Get company database name from company code
 */
export function getCompanyDbName(companyCode: string): string {
  return `company_${companyCode.toLowerCase()}`;
}

/**
 * Get a model instance for a specific company database (SYNCHRONOUS VERSION)
 * 
 * @param modelName The name of the model
 * @param schema The mongoose schema
 * @param companyCode The company code
 * @returns A mongoose model instance
 */
export function getCompanyModel<T>(modelName: string, schema: mongoose.Schema, companyCode: string): mongoose.Model<T> {
  try {
    if (!companyCode) {
      throw new Error('Company code is required to get a company model');
    }
    
    const dbName = getCompanyDbName(companyCode);
    const cacheKey = `${dbName}:${modelName}`;
    
    // Check if model is already in cache
    if (modelCache[cacheKey]) {
      return modelCache[cacheKey];
    }
    
    // Create a connection to the company database using useDb
    const connection = mongoose.connection.useDb(dbName);
    
    // Check if model is already registered with connection
    let model;
    if (connection.models[modelName]) {
      model = connection.models[modelName];
    } else {
      model = connection.model<T>(modelName, schema);
    }
    
    // Cache the model instance
    modelCache[cacheKey] = model;
    
    return model;
  } catch (error) {
    console.error(`Error getting company model ${modelName} for ${companyCode}:`, error);
    throw error;
  }
}

/**
 * Get a model from the standard database (org_sim_db)
 * @param modelName The name of the model (e.g., 'User')
 * @param schema The mongoose schema to use for the model
 * @returns A mongoose model connected to the main database
 */
export function getStandardModel<T>(modelName: string, schema: mongoose.Schema): mongoose.Model<T> {
  try {
    // Use the default mongoose connection (should be connected to org_sim_db)
    return mongoose.models[modelName] || mongoose.model<T>(modelName, schema);
  } catch (error) {
    console.error(`Error getting standard model ${modelName}:`, error);
    throw error;
  }
} 
import mongoose from 'mongoose';
import { getCompanyDBConnection } from '@/lib/dbConnect';

// Company Auth schema - For auth collection in each company database
const companyAuthSchema = new mongoose.Schema(
  {
    // Reference to original user document in the company's users collection
    originalId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    // Global unique identifier used in the central auth database
    userId: {
      type: String,
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    // We store password here too for quick access without needing central DB
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: [
        'user', 'admin', 'superadmin', 
        'USER', 'ADMIN', 'SUPERADMIN',
        'employee_tier_1', 'employee_tier_2', 'employee_tier_3',
        'top_management_tier_1', 'top_management_tier_2', 'top_management_tier_3'
      ],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'rejected', 'inactive'],
      default: 'pending',
    },
    companyCode: {
      type: String,
      required: true,
    },
    companyName: {
      type: String,
    },
    // Permission settings specific to this company
    permissions: {
      type: Map,
      of: Boolean,
      default: {},
    },
    // Flag to indicate if this record has been synced to central auth DB
    syncedToCentral: {
      type: Boolean,
      default: false,
    },
    // When the record was last synced to the central auth database
    lastSyncedToCentral: {
      type: Date,
    },
    // When the original user record was last modified
    originalLastModified: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Get CompanyAuth model for a specific company
export async function getCompanyAuthModel(companyCode) {
  if (!companyCode) {
    throw new Error('Company code is required to get CompanyAuth model');
  }

  try {
    // Get connection to specific company database
    const companyConn = await getCompanyDBConnection(companyCode);
    
    // Check if model is already registered with this connection
    const modelName = 'Auth';
    
    try {
      return companyConn.model(modelName);
    } catch (error) {
      if (error.name === 'MissingSchemaError') {
        // If model doesn't exist yet, define it
        // Specify 3rd arg to force exact collection name 'auth'
        return companyConn.model(modelName, companyAuthSchema, 'auth');
      }
      throw error;
    }
  } catch (error) {
    console.error(`Error getting CompanyAuth model for ${companyCode}:`, error);
    throw error;
  }
}

// Export the schema for use elsewhere
export { companyAuthSchema }; 
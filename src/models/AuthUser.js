import mongoose from 'mongoose';
import { connectAuthDB } from '@/lib/dbConnect';

// Auth User schema - Minimal version of user data needed for authentication
const authUserSchema = new mongoose.Schema(
  {
    // Unique identifier across all databases
    userId: {
      type: String,
      required: true,
      unique: true,
    },
    // Original MongoDB _id from source database
    originalId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    username: {
      type: String,
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
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
    // Store which database this user primarily belongs to
    companyCode: {
      type: String,
    },
    companyName: {
      type: String,
    },
    // For admins or global users, this may be null
    databaseName: {
      type: String,
    },
    lastLogin: {
      type: Date,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false, // Ensures this field is not returned by default
    },
    resetPasswordExpires: {
      type: Date,
    },
    signupOtp: {
      type: String,
      select: false, // Ensures this field is not returned by default
    },
    signupOtpExpires: {
      type: Date,
    },
    // When the record was last updated from the source database
    lastSynced: {
      type: Date,
      default: Date.now,
    }
  },
  {
    timestamps: true,
  }
);

// Static method to initialize the model with a connection
authUserSchema.statics.initializeModel = async function() {
  try {
    const authConn = await connectAuthDB();
    // Force collection name to 'authUsers' (camelCase) to avoid duplicates like 'authusers'
    return authConn.model('AuthUser', authUserSchema, 'authUsers');
  } catch (error) {
    console.error('Error initializing AuthUser model:', error);
    throw error;
  }
};

// Helper function to get the AuthUser model
export async function getAuthUserModel() {
  try {
    // Connect to auth database
    const authConn = await connectAuthDB();
    
    try {
      return authConn.model('AuthUser');
    } catch (error) {
      if (error.name === 'MissingSchemaError') {
        // If model doesn't exist yet, define it with explicit collection name
        return authConn.model('AuthUser', authUserSchema, 'authUsers');
      }
      throw error;
    }
  } catch (error) {
    console.error('Error getting AuthUser model:', error);
    throw error;
  }
}

// Export schema for use elsewhere
export { authUserSchema };

// No default export as we need to initialize with a connection first 
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// User schema
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Please provide a username'],
      unique: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
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
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    company: {
      type: String,
    },
    companyCode: {
      type: String,
    },
    // Extended profile fields
    jobTitle: {
      type: String,
    },
    jobResponsibilities: {
      type: [{ duty: String, hours: Number }],
      default: [],
    },
    toolsProficient: {
      type: String,
    },
    salary: {
      type: String,
    },
    totalduration: {
      type: String,
    },
    currentroleduration: {
      type: String,
    },
    workMode: {
      type: String,
    },
    officeLocation: {
      type: String,
    },
    industry: {
      type: String,
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'rejected', 'inactive'],
      default: 'pending',
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
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
      select: false,
    },
    resetPasswordExpire: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(10);
    // Hash the password with the salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Helper for working with models across company databases
export function getUserModel(companyCode) {
  try {
    // Ensure companyCode is provided and normalized
    if (!companyCode) {
      // Fallback to default connection and model (main DB)
      return mongoose.models.User || mongoose.model('User', userSchema);
    }

    const normalizedCompanyCode = companyCode.toLowerCase();

    // Get the connection to the specific company database
    const db = mongoose.connection.useDb(`company_${normalizedCompanyCode}`);

    // Always register with **model name 'User'** so the collection is 'users'
    if (db.models.User) {
      return db.models.User;
    }

    // Third argument forces collection name 'users'
    return db.model('User', userSchema, 'users');
  } catch (error) {
    console.error(`Error getting User model for company ${companyCode}:`, error);
    throw error;
  }
}

// Export the model for the main database (default connection)
const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User; 
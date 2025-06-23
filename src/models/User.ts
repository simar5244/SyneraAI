import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { getStandardModel as getStandardModelFromLib, getCompanyModel } from '@/lib/models';

export interface IUser extends Document {
  username: string;
  email: string;
  jobTitle?: string;
  jobResponsibilities?: { duty: string; hours: number }[];
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  companyCode?: string; // Link to organization's unique code
  stripeCustomerId?: string; // Stripe customer ID
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  emailVerificationToken?: string;
  emailVerified: boolean;
  googleId?: string;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  organizationId?: mongoose.Types.ObjectId;
  employeeId?: string; // Link to Employee record
  role: 'admin' | 'top_management_tier_1' | 'top_management_tier_2' | 'top_management_tier_3' | 'employee_tier_1' | 'employee_tier_2' | 'employee_tier_3' | 'superadmin';
  status: 'active' | 'inactive' | 'pending' | 'rejected';
  invitedBy?: mongoose.Types.ObjectId;
  invitationAccepted?: boolean;
  permissions?: string[]; // Array of permission codes
  comparePassword: (candidatePassword: string) => Promise<boolean>;
  toolsProficient?: string;
  notificationPreferences?: object;
  // Employment details
  salary?: string;
  totalduration?: string;
  currentroleduration?: string;
  workMode?: string; // Remote, hybrid, in-office
  officeLocation?: string; // Office city/location for cost of living adjustment
  industry?: string; // Industry sector
  // Feedback metrics
  feedbackMetrics?: {
    given: {
      count: number;
      averageRating: number;
    };
    received: {
      count: number;
      averageRating: number;
      weightedAverageRating: number;
    };
  };
  skillsFeedback?: {
    given: string[];
    received: string[];
  };
  position?: string;
  responsibilities?: string[];
}

const UserSchema: Schema = new Schema({
  jobTitle: {
    type: String,
    trim: true,
    default: ''
  },
  jobResponsibilities: [{
    duty: { type: String, required: true, trim: true },
    hours: { type: Number, required: true, min: 0 }
  }],
  // Employment details
  salary: {
    type: String,
    trim: true
  },
  totalduration: {
    type: String,
    trim: true
  },
  currentroleduration: {
    type: String,
    trim: true
  },
  workMode: {
    type: String,
    trim: true
  },
  officeLocation: {
    type: String,
    trim: true
  },
  industry: {
    type: String,
    trim: true
  },
  username: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple documents without this field
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [20, 'Username cannot exceed 20 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password by default in query results
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  company: {
    type: String,
    trim: true,
    lowercase: true // Always store company name in lowercase
  },
  companyCode: {
    type: String,
    trim: true,
    index: true
  },
  stripeCustomerId: {
    type: String,
    trim: true,
    sparse: true,
    index: true
  },
  phone: {
    type: String,
    trim: true
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  googleId: {
    type: String,
    sparse: true
  },
  lastLogin: {
    type: Date
  },
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    index: true
  },
  employeeId: {
    type: String,
    index: true
  },
  role: {
    type: String,
    enum: ['admin', 'top_management_tier_1', 'top_management_tier_2', 'top_management_tier_3', 'employee_tier_1', 'employee_tier_2', 'employee_tier_3', 'superadmin'],
    default: 'employee_tier_3'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'rejected'],
    default: 'pending'
  },
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  invitationAccepted: {
    type: Boolean,
    default: false
  },
  permissions: [{
    type: String
  }],
  toolsProficient: {
    type: String
  },
  notificationPreferences: {
    type: Object
  },
  // Feedback metrics
  feedbackMetrics: {
    given: {
      count: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 }
    },
    received: {
      count: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      weightedAverageRating: { type: Number, default: 0 }
    }
  },
  skillsFeedback: {
    given: [{ type: String }],
    received: [{ type: String }]
  },
  position: { type: String },
  responsibilities: { type: [String] },
}, {
  timestamps: true
});

// Create compound index for organization and employeeId
UserSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true, sparse: true });
// Create index for company
UserSchema.index({ company: 1 });
// Create index for companyCode
UserSchema.index({ companyCode: 1 });

// Ensure company is always lowercase
UserSchema.pre<IUser>('save', function(next) {
  // Convert company name to lowercase if it exists
  if (this.company) {
    this.company = this.company.toLowerCase();
  }
  next();
});

// Hash password before saving
UserSchema.pre<IUser>('save', async function(next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified('password')) return next();
  
  try {
    // Generate salt
    const salt = await bcrypt.genSalt(12);
    
    // Hash password
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Add virtual for full name
UserSchema.virtual('fullName').get(function(this: IUser) {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.username;
});

// Method to check if user has specific permission
UserSchema.methods.hasPermission = function(permission: string): boolean {
  if (!this.permissions) return false;
  return this.permissions.includes(permission);
};

// Method to check if user has admin role
UserSchema.methods.isAdmin = function(): boolean {
  return this.role === 'admin' || this.role === 'superadmin';
};

// Method to check if user has management role or higher
UserSchema.methods.isManagerOrAdmin = function(): boolean {
  return ['admin', 'top_management_tier_1', 'top_management_tier_2', 'top_management_tier_3', 'superadmin'].includes(this.role);
};

// Method to check if user is superadmin
UserSchema.methods.isSuperAdmin = function(): boolean {
  return this.role === 'superadmin';
};

// Add a virtual getter for company_code to ensure backwards compatibility
UserSchema.virtual('company_code').get(function() {
  return this.companyCode;
});

// Export the standard User model for the main database
const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

// Export a function to get the User model for a specific company
export function getUserModel(companyCode: string): Model<IUser> {
  try {
    if (!companyCode) {
      console.error('No company code provided to getUserModel');
      // Fall back to standard model for admin users
      return User;
    }

    // NOTE: Do NOT force companyCode to lowercase here – keep original case
    // because MongoDB database names are case-sensitive on most systems. The
    // helper that builds the DB name should simply prefix with "company_".
    return getCompanyModel<IUser>('User', UserSchema, companyCode);
  } catch (error) {
    console.error(`Error in getUserModel for company ${companyCode}:`, error);
    // Return the standard model as fallback
    return User;
  }
}

// Create a wrapper for the getStandardModel function
export function getStandardModel(modelName: string): Model<any> {
  console.log(`Getting standard model: ${modelName}`);
  if (modelName === 'User') {
    return User;
  }
  return mongoose.models[modelName] || mongoose.model(modelName, new Schema({}));
}

export default User; 
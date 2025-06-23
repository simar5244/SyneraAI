import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for ERP connection details
export interface IERPConnection {
  type: string;
  details: Record<string, any>;
  status: 'active' | 'inactive' | 'error';
  lastSyncDate: Date;
  connectedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for Organization
export interface IOrganization extends Document {
  name: string;
  companyCode: string;
  domain: string;
  logo?: string;
  description?: string;
  industry?: string;
  size?: string;
  foundedYear?: number;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  hasERPConnection: boolean;
  erpConnections: IERPConnection[];
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Schema for ERP connection
const ERPConnectionSchema = new Schema<IERPConnection>({
  type: {
    type: String,
    required: true,
    enum: ['SAP_HR', 'WORKDAY', 'ORACLE', 'MICROSOFT_AD', 'PEOPLESOFT', 'CUSTOM']
  },
  details: {
    type: Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'error'],
    default: 'active'
  },
  lastSyncDate: {
    type: Date,
    default: Date.now
  },
  connectedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Organization schema
const OrganizationSchema = new Schema<IOrganization>({
  name: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true
  },
  companyCode: {
    type: String,
    required: [true, 'Company code is required'],
    trim: true,
    unique: true
  },
  domain: {
    type: String,
    required: [true, 'Domain is required'],
    trim: true,
    lowercase: true,
    unique: true
  },
  logo: {
    type: String
  },
  description: {
    type: String
  },
  industry: {
    type: String
  },
  size: {
    type: String
  },
  foundedYear: {
    type: Number
  },
  website: {
    type: String
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  hasERPConnection: {
    type: Boolean,
    default: false
  },
  erpConnections: [ERPConnectionSchema],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Create index for domain and companyCode for fast lookups
OrganizationSchema.index({ domain: 1 });
OrganizationSchema.index({ companyCode: 1 }, { unique: true });

// Encrypt sensitive data before saving
OrganizationSchema.pre<IOrganization>('save', function(next) {
  // Here you would add any needed encryption for connection details
  // This is where you'd encrypt API keys, tokens, etc.
  next();
});

// Check if model exists before compiling
const Organization = mongoose.models.Organization as Model<IOrganization> || 
  mongoose.model<IOrganization>('Organization', OrganizationSchema);

export default Organization; 
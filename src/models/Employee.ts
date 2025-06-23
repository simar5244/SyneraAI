import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEmployee extends Document {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  managerId?: string;
  tenure: number; // in months
  skills: string[];
  seniorityLevel: 'Junior' | 'Mid' | 'Senior' | 'Lead';
  orgLevel: 'IC' | 'Manager' | 'Executive';
  status: 'active' | 'inactive' | 'on-leave';
  hireDate: Date;
  profileImage?: string;
  phone?: string;
  location?: string;
  organizationId: mongoose.Types.ObjectId;
  attributes?: Record<string, any>;
  erpSource?: string;
  lastUpdated: Date;
  userId?: mongoose.Types.ObjectId; // Link to User if they have an account
}

const EmployeeSchema: Schema = new Schema({
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true,
    index: true
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  jobTitle: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true,
    index: true
  },
  managerId: {
    type: String,
    index: true
  },
  tenure: {
    type: Number,
    default: 0,
    min: 0
  },
  skills: [{
    type: String,
    trim: true
  }],
  seniorityLevel: {
    type: String,
    enum: ['Junior', 'Mid', 'Senior', 'Lead'],
    default: 'Junior'
  },
  orgLevel: {
    type: String,
    enum: ['IC', 'Manager', 'Executive'],
    default: 'IC'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on-leave'],
    default: 'active'
  },
  hireDate: {
    type: Date,
    required: true
  },
  profileImage: {
    type: String
  },
  phone: {
    type: String
  },
  location: {
    type: String
  },
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  attributes: {
    type: Map,
    of: Schema.Types.Mixed
  },
  erpSource: {
    type: String
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Create compound indexes
EmployeeSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });
EmployeeSchema.index({ skills: 1 });
EmployeeSchema.index({ organizationId: 1, department: 1 });

// Calculate tenure in months before saving
EmployeeSchema.pre<IEmployee>('save', function(next) {
  if (this.isModified('hireDate') || !this.tenure) {
    const today = new Date();
    const hireDate = new Date(this.hireDate);
    const monthDiff = (today.getFullYear() - hireDate.getFullYear()) * 12 + 
                      (today.getMonth() - hireDate.getMonth());
    this.tenure = Math.max(0, monthDiff);
  }
  this.lastUpdated = new Date();
  next();
});

// Virtual for full name
EmployeeSchema.virtual('fullName').get(function(this: IEmployee) {
  return `${this.firstName} ${this.lastName}`;
});

// Check if model exists before compiling
const Employee = mongoose.models.Employee as Model<IEmployee> || 
  mongoose.model<IEmployee>('Employee', EmployeeSchema);

export default Employee; 
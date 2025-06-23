import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProject extends Document {
  projectId: string;
  title: string;
  description: string;
  organizationId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdByRole?: string;
  visibleToAll?: boolean;
  techStack: string[];
  startDate: Date;
  endDate: Date;
  totalHours: number;
  linkedProjects?: mongoose.Types.ObjectId[];
  loggedHoursPerWeek: {
    weekStartDate: Date;
    totalHours: number;
  }[];
  status: 'planning' | 'active' | 'completed' | 'canceled' | 'on-hold';
  employeeContributions: {
    employeeId: string;
    userId?: mongoose.Types.ObjectId;
    role: string;
    isTeamLead: boolean;
    weeklyHours: {
      weekStartDate: Date;
      hours: number;
      reportedTech?: string[];
    }[];
  }[];
  department: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  risks: {
    description: string;
    severity: 'low' | 'medium' | 'high';
    status: 'identified' | 'mitigated' | 'resolved';
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema: Schema = new Schema({
  projectId: {
    type: String,
    required: [true, 'Project ID is required'],
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Project description is required'],
    trim: true
  },
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdByRole: {
    type: String,
    index: true
  },
  visibleToAll: {
    type: Boolean,
    default: false,
    index: true
  },
  techStack: [{
    type: String,
    required: true
  }],
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  totalHours: {
    type: Number,
    default: 0
  },
  linkedProjects: [{
    type: Schema.Types.ObjectId,
    ref: 'Project'
  }],
  loggedHoursPerWeek: [{
    weekStartDate: {
      type: Date,
      required: true
    },
    totalHours: {
      type: Number,
      default: 0
    }
  }],
  status: {
    type: String,
    enum: ['planning', 'active', 'completed', 'canceled', 'on-hold'],
    default: 'planning'
  },
  employeeContributions: [{
    employeeId: {
      type: String,
      required: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      required: true
    },
    isTeamLead: {
      type: Boolean,
      default: false
    },
    weeklyHours: [{
      weekStartDate: {
        type: Date,
        required: true
      },
      hours: {
        type: Number,
        required: true,
        min: 0,
        max: 168 // maximum hours in a week
      },
      reportedTech: [{
        type: String
      }]
    }]
  }],
  department: {
    type: String,
    required: true,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  risks: [{
    description: {
      type: String,
      required: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    status: {
      type: String, 
      enum: ['identified', 'mitigated', 'resolved'],
      default: 'identified'
    }
  }]
}, {
  timestamps: true
});

// Create indexes for querying
ProjectSchema.index({ organizationId: 1, createdBy: 1 });
ProjectSchema.index({ organizationId: 1, department: 1 });
ProjectSchema.index({ organizationId: 1, status: 1 });
ProjectSchema.index({ organizationId: 1, "employeeContributions.employeeId": 1 });
ProjectSchema.index({ techStack: 1 });
ProjectSchema.index({ linkedProjects: 1 });

// Pre-save hook to calculate total hours
ProjectSchema.pre<IProject>('save', function(next) {
  // Calculate total hours based on all weekly hours logged by all team members
  let total = 0;
  let weeklyTotals = new Map<string, number>();
  
  this.employeeContributions.forEach(employee => {
    employee.weeklyHours.forEach(week => {
      // Add to total project hours
      total += week.hours;
      
      // Add to weekly totals
      const weekKey = week.weekStartDate.toISOString().split('T')[0];
      const currentTotal = weeklyTotals.get(weekKey) || 0;
      weeklyTotals.set(weekKey, currentTotal + week.hours);
    });
  });
  
  // Update total hours
  this.totalHours = total;
  
  // Update or create loggedHoursPerWeek entries
  this.loggedHoursPerWeek = Array.from(weeklyTotals.entries()).map(([dateStr, hours]) => ({
    weekStartDate: new Date(dateStr),
    totalHours: hours
  }));
  
  next();
});

// Check if model exists before compiling
const Project = mongoose.models.Project as Model<IProject> || 
  mongoose.model<IProject>('Project', ProjectSchema);

export default Project; 
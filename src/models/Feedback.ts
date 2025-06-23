import mongoose, { Schema, Document, Model, CallbackWithoutResult } from 'mongoose';

export interface IFeedback extends Document {
  // Common fields
  company: string;
  organizationId?: mongoose.Types.ObjectId; // Optional organization context
 
  // For settings documents
  documentType?: 'feedback' | 'settings';
  frequency?: string;
  lastChanged?: Date;
  nextChangeAvailable?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  
  // For feedback documents
  evaluatorId?: mongoose.Types.ObjectId;  // Who gave the feedback
  evaluatorName?: string;
  evaluatorEmail?: string;
  evaluatorInternalRole?: 'top_management_tier_1' | 'top_management_tier_2' | 'top_management_tier_3' | 'employee_tier_1' | 'employee_tier_2' | 'employee_tier_3' | 'admin';  // Employee tier
  evaluatedEmail?: string;  // Email of the person being evaluated
  relationshipType?: 'direct-reporting' | 'project-collaboration' | 'no-connection';
  ratings?: {
    accountability: 'Average' | 'Good' | 'Very Good' | 'Excellent' | 'Outstanding';
    teamContribution: 'Average' | 'Good' | 'Very Good' | 'Excellent' | 'Outstanding';
    adaptability: 'Average' | 'Good' | 'Very Good' | 'Excellent' | 'Outstanding';
    communication: 'Average' | 'Good' | 'Very Good' | 'Excellent' | 'Outstanding';
    confidence: 'Average' | 'Good' | 'Very Good' | 'Excellent' | 'Outstanding';
  };
  topSkills?: string;  // Open-ended response
  quarter?: string;  // Quarter in which feedback was submitted (e.g., "Q1-2023")
  
  // Feedback metrics for aggregation
  averageRating?: number;     // Average of all ratings
  weightedRating?: number;    // Weighted rating based on tier and relationship
  
  // Methods
  calculateWeightedScore(): number;
  getAverageRating(): number;
}

// Interface for the Feedback Model including static methods
export interface IFeedbackModel extends Model<IFeedback> {
  calculateUserFeedbackMetrics(email: string, company: string): Promise<{
    feedbackGiven: {
      count: number;
      averageRating: number;
    };
    feedbackReceived: {
      count: number;
      averageRating: number;
      weightedAverageRating: number;
    };
    skillsFeedback: {
      given: string[];
      received: string[];
    };
  }>;
}

const FeedbackSchema: Schema = new Schema({
  // Company context
  company: {
    type: String,
    required: true,
    index: true
  },
  // Optional organization context for backward compatibility
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: false,
    index: true
  },
  
  // Document type field to distinguish between feedback and settings
  documentType: {
    type: String,
    enum: ['feedback', 'settings'],
    default: 'feedback',
    index: true
  },
  
  // Settings document fields
  frequency: {
    type: String,
    enum: ['monthly', 'quarterly', 'biannually', 'annually'],
    default: 'quarterly'
  },
  lastChanged: {
    type: Date
  },
  nextChangeAvailable: {
    type: Date
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Feedback document fields
  evaluatorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  evaluatorName: {
    type: String
  },
  evaluatorEmail: {
    type: String,
    index: true
  },
  evaluatorInternalRole: {
    type: String,
    enum: [
      'top_management_tier_1','top_management_tier_2','top_management_tier_3',
      'employee_tier_1','employee_tier_2','employee_tier_3',
      'admin'
    ],
    set: (val: string) => {
      if (typeof val !== 'string') return val;
      const cleaned = val.trim().toLowerCase();
      if (cleaned === 'em_tier_1') return 'employee_tier_1';
      if (cleaned === 'em_tier_2') return 'employee_tier_2';
      if (cleaned === 'em_tier_3') return 'employee_tier_3';
      // If it's already a valid full role (or admin), pass it through
      if (['top_management_tier_1', 'top_management_tier_2', 'top_management_tier_3',
           'employee_tier_1', 'employee_tier_2', 'employee_tier_3', 'admin'].includes(cleaned)) {
        return cleaned;
      }
      // Otherwise, return the original value (which will likely fail validation, but correctly)
      return val;
    }
  },
  evaluatedEmail: {
    type: String,
    index: true
  },
  relationshipType: {
    type: String,
    enum: ['direct-reporting', 'project-collaboration', 'no-connection']
  },
  ratings: {
    accountability: {
      type: String,
      enum: ['Average', 'Good', 'Very Good', 'Excellent', 'Outstanding']
    },
    teamContribution: {
      type: String,
      enum: ['Average', 'Good', 'Very Good', 'Excellent', 'Outstanding']
    },
    adaptability: {
      type: String,
      enum: ['Average', 'Good', 'Very Good', 'Excellent', 'Outstanding']
    },
    communication: {
      type: String,
      enum: ['Average', 'Good', 'Very Good', 'Excellent', 'Outstanding']
    },
    confidence: {
      type: String,
      enum: ['Average', 'Good', 'Very Good', 'Excellent', 'Outstanding']
    }
  },
  topSkills: {
    type: String
  },
  quarter: {
    type: String,
    index: true
  },
  
  // Calculated feedback metrics
  averageRating: {
    type: Number
  },
  weightedRating: {
    type: Number
  }
}, {
  timestamps: true
});

// Create compound indexes for queries
FeedbackSchema.index({ evaluatorId: 1, evaluatedEmail: 1, quarter: 1 });
FeedbackSchema.index({ company: 1, evaluatedEmail: 1 });
FeedbackSchema.index({ company: 1, quarter: 1 });
FeedbackSchema.index({ documentType: 1, company: 1 });

// Method to calculate average rating
FeedbackSchema.methods.getAverageRating = function(this: IFeedback & Document): number {
  if (!this.ratings) return 0;
  // Define rating keys and mapping
  type RatingKey = 'Average' | 'Good' | 'Very Good' | 'Excellent' | 'Outstanding';
  const ratingValues: Record<RatingKey, number> = {
    'Average': 1,
    'Good': 2,
    'Very Good': 3,
    'Excellent': 4,
    'Outstanding': 5
  };
  
  // Calculate average score
  const { accountability, teamContribution, adaptability, communication, confidence } = this.ratings;
  return (
    ratingValues[accountability as RatingKey] +
    ratingValues[teamContribution as RatingKey] +
    ratingValues[adaptability as RatingKey] +
    ratingValues[communication as RatingKey] +
    ratingValues[confidence as RatingKey]
  ) / 5;
};

// Helper method to calculate weighted score based on evaluator role and relationship
FeedbackSchema.methods.calculateWeightedScore = function(this: IFeedback & Document): number {
  if (!this.ratings) return 0;
  // Role weights: define type and mapping synced with user roles
  type RoleKey = 'top_management_tier_1' | 'top_management_tier_2' | 'top_management_tier_3' | 'employee_tier_1' | 'employee_tier_2' | 'employee_tier_3' | 'admin';
  const roleWeights: Record<RoleKey, number> = {
    'top_management_tier_1': 1.0,
    'top_management_tier_2': 0.9,
    'top_management_tier_3': 0.8,
    'employee_tier_1': 0.7,
    'employee_tier_2': 0.6,
    'employee_tier_3': 0.5,
    'admin': 1.0
  };
  // Relationship type weights: define type and mapping
  type RelationshipKey = 'direct-reporting' | 'project-collaboration' | 'no-connection';
  const relationshipWeights: Record<RelationshipKey, number> = {
    'direct-reporting': 1.0,
    'project-collaboration': 0.9,
    'no-connection': 0.8
  };
  
  // Compute average rating
  const baseScore = this.getAverageRating();
  // Safely index weights
  const roleWeight = roleWeights[this.evaluatorInternalRole as RoleKey] ?? 0.5;
  const relationshipWeight = relationshipWeights[this.relationshipType as RelationshipKey] ?? 0.5;
  
  // Final weighted score
  return baseScore * roleWeight * relationshipWeight;
};

// Pre-save hook to calculate and store ratings
// Note: Accessing evaluator data here can be complex. We'll adjust the weighted score calculation in the service instead.
FeedbackSchema.pre<IFeedback & Document>('save', function(this: IFeedback & Document, next: CallbackWithoutResult) {
  if (this.documentType === 'feedback' && this.ratings) {
    this.averageRating = this.getAverageRating();
    // We will calculate the final weightedRating (with potential reduction) 
    // in the service before saving the User model.
    // Here we store the basic weighted score first.
    this.weightedRating = this.calculateWeightedScore(); 
  }
  next();
});

// Define the structure of the returned metrics object for clarity
interface FeedbackMetrics {
  feedbackGiven: { count: number; averageRating: number };
  feedbackReceived: { count: number; averageRating: number; weightedAverageRating: number };
  skillsFeedback: { given: string[]; received: string[] };
}

// Explicitly type the return type
FeedbackSchema.statics.calculateUserFeedbackMetrics = async function(email: string, company: string): Promise<FeedbackMetrics> {
  // Type the constants after the await, remove type argument from lean()
  const feedbackGiven: IFeedback[] = await this.find({ documentType: 'feedback', evaluatorEmail: email, company }).lean();
  const feedbackReceived: IFeedback[] = await this.find({ documentType: 'feedback', evaluatedEmail: email, company }).lean();
   
  // Calculate feedback given metrics
  const numFeedbackGiven = feedbackGiven.length;
  const avgFeedbackGiven = feedbackGiven.reduce((sum: number, fb: IFeedback) => sum + (fb.averageRating || 0), 0) / 
                          (numFeedbackGiven || 1);
   
  // Calculate feedback received metrics
  const numFeedbackReceived = feedbackReceived.length;
  const avgFeedbackReceived = feedbackReceived.reduce((sum: number, fb: IFeedback) => sum + (fb.averageRating || 0), 0) / 
                             (numFeedbackReceived || 1);
  const avgWeightedFeedbackReceived = feedbackReceived.reduce((sum: number, fb: IFeedback) => sum + (fb.weightedRating || 0), 0) / 
                                     (numFeedbackReceived || 1);
   
  // Extract skills feedback (given and received)
  // Add explicit 'any' type to skill parameter in filter type guard
  const givenSkillsFeedback = feedbackGiven.map((fb: IFeedback) => fb.topSkills).filter((skill: any): skill is string => Boolean(skill));
  const receivedSkillsFeedback = feedbackReceived.map((fb: IFeedback) => fb.topSkills).filter((skill: any): skill is string => Boolean(skill));
   
  return {
    feedbackGiven: {
      count: numFeedbackGiven,
      averageRating: avgFeedbackGiven
    },
    feedbackReceived: {
      count: numFeedbackReceived,
      averageRating: avgFeedbackReceived,
      weightedAverageRating: avgWeightedFeedbackReceived,
    },
    skillsFeedback: {
        given: givenSkillsFeedback,
        received: receivedSkillsFeedback
    }
  };
};

// Check if model exists before compiling
const modelCache = new Map<string, mongoose.Model<IFeedback>>();

/**
 * Returns a Feedback model bound to the specified company's database
 */
export function getFeedbackModel(companyCode: string): IFeedbackModel {
  if (!companyCode) throw new Error('Company code is required for Feedback model');
  const normalized = companyCode.toLowerCase().trim();
  const dbName = `company_${normalized}`;
  const conn = mongoose.connection.useDb(dbName, { useCache: true, noListener: true });
  // Use existing model if compiled
  if (conn.models.Feedback) {
    return conn.models.Feedback as IFeedbackModel;
  }
  // Compile model with static methods interface
  const model = conn.model<IFeedback, IFeedbackModel>('Feedback', FeedbackSchema);
  modelCache.set(normalized, model);
  return model;
}

// Default global model for fallback
const Feedback = mongoose.models.Feedback as IFeedbackModel || 
                mongoose.model<IFeedback, IFeedbackModel>('Feedback', FeedbackSchema);

export default Feedback;
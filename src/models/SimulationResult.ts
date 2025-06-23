import mongoose, { Schema, Document, Model } from 'mongoose';

// Placeholder interface - Define the actual structure based on simulation output
export interface ISimulationResult extends Document {
  simulationId: string;
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  type: string; // e.g., 'attrition', 'reorganization'
  parameters: Record<string, any>;
  results: Record<string, any>; // Store key metrics, visualizations data, etc.
  status: 'running' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

const SimulationResultSchema: Schema = new Schema({
  simulationId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
  },
  parameters: {
    type: Schema.Types.Mixed,
    required: true,
  },
  results: {
    type: Schema.Types.Mixed,
  },
  status: {
    type: String,
    enum: ['running', 'completed', 'failed'],
    default: 'running',
  },
  errorMessage: {
    type: String,
  },
  completedAt: {
    type: Date,
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
});

// Check if model exists before compiling
const SimulationResult = mongoose.models.SimulationResult as Model<ISimulationResult> || 
                       mongoose.model<ISimulationResult>('SimulationResult', SimulationResultSchema);

export default SimulationResult; 
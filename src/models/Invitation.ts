import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInvitation extends Document {
  email: string;
  token: string;
  organizationId: mongoose.Types.ObjectId;
  employeeId?: string;
  role: 'employee' | 'manager' | 'admin';
  invitedBy: mongoose.Types.ObjectId;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InvitationSchema: Schema = new Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  employeeId: {
    type: String
  },
  role: {
    type: String,
    enum: ['employee', 'manager', 'admin'],
    default: 'employee'
  },
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired', 'revoked'],
    default: 'pending'
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Create compound index for organization and email
InvitationSchema.index({ organizationId: 1, email: 1 }, { unique: true });

// Pre-save hook to check token expiration
InvitationSchema.pre<IInvitation>('save', function(next) {
  // If the invitation is still pending, check if it's expired
  if (this.status === 'pending' && this.expiresAt < new Date()) {
    this.status = 'expired';
  }
  next();
});

// Check if model exists before compiling
const Invitation = mongoose.models.Invitation as Model<IInvitation> || 
  mongoose.model<IInvitation>('Invitation', InvitationSchema);

export default Invitation; 
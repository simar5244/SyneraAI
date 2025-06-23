import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISubscription extends Document {
  companyCode: string;
  companyName: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  productName: string;
  planType: string;
  userLimit: number;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  paymentMethodId?: string;
  latestInvoiceId?: string;
  metadata?: Record<string, any>;
}

const SubscriptionSchema = new Schema<ISubscription>({
  companyCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  companyName: {
    type: String,
    required: true,
  },
  stripeCustomerId: {
    type: String,
    required: true,
  },
  stripeSubscriptionId: {
    type: String,
    required: true,
    unique: true,
  },
  stripePriceId: {
    type: String,
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  planType: {
    type: String,
    required: true,
  },
  userLimit: {
    type: Number,
    required: true,
    default: 2, // Default to starter plan limit
  },
  status: {
    type: String,
    enum: ['active', 'canceled', 'past_due', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid'],
    default: 'active',
  },
  currentPeriodStart: {
    type: Date,
    required: true,
  },
  currentPeriodEnd: {
    type: Date,
    required: true,
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false,
  },
  canceledAt: {
    type: Date,
  },
  paymentMethodId: {
    type: String,
  },
  latestInvoiceId: {
    type: String,
  },
  metadata: {
    type: Schema.Types.Mixed,
  }
}, {
  timestamps: true
});

// Create indexes for faster lookups
SubscriptionSchema.index({ stripeCustomerId: 1 });
SubscriptionSchema.index({ stripeSubscriptionId: 1 }, { unique: true });

// Helper function to get the Subscription model
export const SubscriptionModel =
  mongoose.models.Subscription as Model<ISubscription> || 
  mongoose.model<ISubscription>('Subscription', SubscriptionSchema);

export default SubscriptionModel;
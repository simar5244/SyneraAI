import mongoose, { Schema, Document } from 'mongoose';

export interface IBilling extends Document {
  companyCode: string;
  companyName: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  stripeInvoiceId: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending';
  paymentMethod: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  paymentDate: Date;
  planType: 'starter' | 'standard' | 'enterprise';
  interval: 'month' | 'year';
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const BillingSchema = new Schema<IBilling>(
  {
    companyCode: {
      type: String,
      required: true,
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
    },
    stripePriceId: {
      type: String,
      required: true,
    },
    stripeInvoiceId: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'usd',
    },
    status: {
      type: String,
      required: true,
      enum: ['succeeded', 'failed', 'pending'],
    },
    paymentMethod: {
      type: String,
      required: false,
    },
    billingPeriodStart: {
      type: Date,
      required: true,
    },
    billingPeriodEnd: {
      type: Date,
      required: true,
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    planType: {
      type: String,
      required: true,
      enum: ['starter', 'standard', 'enterprise'],
    },
    interval: {
      type: String,
      required: true,
      enum: ['month', 'year'],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Define indexes for common queries
BillingSchema.index({ companyCode: 1, paymentDate: -1 });
BillingSchema.index({ stripeSubscriptionId: 1 });
BillingSchema.index({ stripeInvoiceId: 1 }, { unique: true });

// Prevent model recompilation error in development
const Billing = mongoose.models.Billing || mongoose.model<IBilling>('Billing', BillingSchema);

export default Billing; 
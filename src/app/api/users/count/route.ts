import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, MongoClientOptions, Db, Collection } from 'mongodb';
import mongoose from 'mongoose';
import Stripe from 'stripe';

// MongoDB connection string
const uri: string = process.env.MONGODB_URI || '';

// Create a global cached MongoClient to reuse across requests
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}
const client: MongoClient = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true } as MongoClientOptions);
if (!global._mongoClientPromise) {
  // First time load, create the promise
  global._mongoClientPromise = client.connect();
}
const clientPromise = global._mongoClientPromise;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil',
});

// Define interfaces for subscription data
interface SubscriptionData {
  _id?: string;
  companyCode: string;
  planType: string;
  userLimit: number;
  status: string;
  currentPeriodEnd: Date;
  stripePriceId?: string;
  productName?: string;
  stripeSubscriptionId?: string;
}

interface UserCountResponse {
  count: number;
  totalCount: number;
  pendingCount: number;
  activeOnly: boolean;
  subscription: {
    id: string;
    planType: string;
    userLimit: number;
    status: string;
    currentPeriodEnd: Date;
    stripePriceId: string;
    productName: string;
    stripeSubscriptionId: string;
  } | null;
  limitReached: boolean;
  remainingSlots: number;
}

// Stripe-first search function
async function stripeFirstSearch(sanitizedCode: string): Promise<SubscriptionData | null> {
  try {
    console.log(`[USER COUNT] Attempting Stripe-first lookup for company: ${sanitizedCode}`);
    
    // Search Stripe customers by metadata.companyCode
    const customers = await stripe.customers.search({
      query: `metadata['companyCode']:'${sanitizedCode}'`,
      limit: 1
    });
    
    if (customers.data.length === 0) {
      console.log(`[USER COUNT] No Stripe customer found for company: ${sanitizedCode}`);
      return null;
    }

    const customer = customers.data[0];
    console.log(`[USER COUNT] Found Stripe customer via metadata: ${customer.id}`);
    
    // Get all subscriptions for this customer
    const subsList = await stripe.subscriptions.list({ 
      customer: customer.id, 
      limit: 10,
      status: 'all' // Include all statuses initially
    });
    
    if (subsList.data.length === 0) {
      console.log(`[USER COUNT] No subscriptions found for customer: ${customer.id}`);
      return null;
    }

    // Sort by creation date to get the most recent
    const sortedSubs = subsList.data.sort((a, b) => (b.created || 0) - (a.created || 0));
    
    // First try to find an active subscription
    let targetSubscription = sortedSubs.find(sub => sub.status === 'active');
    
    // If no active subscription, use the most recent one
    if (!targetSubscription) {
      targetSubscription = sortedSubs[0];
      console.log(`[USER COUNT] No active subscription found, using most recent with status: ${targetSubscription.status}`);
    }
    
    // Retrieve full subscription with product expanded
    const stripeSub = await stripe.subscriptions.retrieve(targetSubscription.id, { 
      expand: ['items.data.price.product'] 
    });
    
    console.log(`[USER COUNT] Using subscription: ${targetSubscription.id} with status: ${stripeSub.status}`);
    
    const priceItem = stripeSub.items.data[0]?.price;
    if (!priceItem || typeof priceItem.product !== 'object') {
      console.log(`[USER COUNT] No valid price/product found for subscription: ${targetSubscription.id}`);
      return null;
    }

    const product = priceItem.product as Stripe.Product;
    
    // Determine planType from metadata or product name
    const metaPlan = product.metadata?.planType?.toLowerCase();
    let planType = ['starter', 'standard', 'enterprise'].includes(metaPlan || '') ? metaPlan! :
      product.name.toLowerCase().includes('starter') ? 'starter' :
      product.name.toLowerCase().includes('enterprise') ? 'enterprise' : 'standard';
    
    // Determine userLimit from metadata or plan type
    const metaLimit = parseInt(product.metadata?.userLimit || '', 10);
    const userLimit = (!isNaN(metaLimit) && metaLimit > 0) ? metaLimit :
      planType === 'starter' ? 1 : planType === 'standard' ? 2 : 3;

    // Fix the currentPeriodEnd date issue
    const currentPeriodEnd = stripeSub.current_period_end ? 
      new Date(stripeSub.current_period_end * 1000) : 
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const subscription: SubscriptionData = {
      _id: stripeSub.id,
      companyCode: sanitizedCode,
      planType,
      userLimit,
      status: stripeSub.status,
      currentPeriodEnd,
      stripePriceId: priceItem.id,
      productName: product.name || `${planType.charAt(0).toUpperCase() + planType.slice(1)} Plan`,
      stripeSubscriptionId: stripeSub.id
    };
    
    console.log('[USER COUNT] Stripe-first subscription:', subscription);
    return subscription;
    
  } catch (error) {
    console.warn('[USER COUNT] Stripe-first lookup failed:', error);
    return null;
  }
}

// Fallback search function
async function fallbackSearch(sanitizedCode: string, sanitizedCode2: string, companyDb: Db): Promise<SubscriptionData | null> {
  console.log(`[USER COUNT] Starting fallback search for company: ${sanitizedCode}`);
  
  // Try local DB first
  const subDoc = await companyDb.collection('subscriptions').findOne({ companyCode: sanitizedCode });
  if (subDoc?.stripeSubscriptionId) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(subDoc.stripeSubscriptionId, {
        expand: ['items.data.price.product']
      });
      const priceItem = stripeSub.items.data[0]?.price;
      if (priceItem && typeof priceItem.product === 'object') {
        const product = priceItem.product as Stripe.Product;
        const metaPlan = product.metadata?.planType?.toLowerCase();
        const planType = ['starter','standard','enterprise'].includes(metaPlan || '') ? metaPlan! :
          product.name.toLowerCase().includes('starter') ? 'starter' :
          product.name.toLowerCase().includes('standard') ? 'standard' : 'enterprise';
        const metaLimit = parseInt(product.metadata?.userLimit || '', 10);
        const userLimit = (!isNaN(metaLimit) && metaLimit > 0) ? metaLimit :
          planType === 'starter' ? 1 : planType === 'standard' ? 2 : 3;
        
        const currentPeriodEnd = stripeSub.current_period_end? 
          new Date(stripeSub.current_period_end * 1000) : 
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const subscription: SubscriptionData = {
          _id: subDoc._id?.toString(),
          companyCode: sanitizedCode,
          planType,
          userLimit,
          status: stripeSub.status,
          currentPeriodEnd,
          stripePriceId: priceItem.id,
          productName: product.name,
          stripeSubscriptionId: stripeSub.id
        };
        console.log('[USER COUNT] Subscription from local DB + Stripe:', subscription);
        return subscription;
      }
    } catch (err) {
      console.error('[USER COUNT] Error retrieving subscription from Stripe via local DB:', err);
    }
  }
  
  // Try subscriptions endpoint
  try {
    console.log(`[USER COUNT] Trying to get subscription from /api/stripe/subscriptions`);
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/subscriptions?companyCode=${sanitizedCode2}`);
    if (response.ok) {
      const subData = await response.json();
      if (subData.id) {
        const subscription: SubscriptionData = {
          _id: subData.id,
          companyCode: sanitizedCode,
          planType: subData.planType || 'standard',
          userLimit: subData.userLimit || 2,
          status: subData.status || 'active',
          currentPeriodEnd: new Date(subData.currentPeriodEnd || Date.now() + 30 * 24 * 60 * 60 * 1000),
          stripePriceId: subData.stripePriceId || '',
          productName: subData.planType ? `${subData.planType.charAt(0).toUpperCase() + subData.planType.slice(1)} Plan` : 'Standard',
          stripeSubscriptionId: subData.stripeSubscriptionId || ''
        };
        console.log(`[USER COUNT] Subscription from /api/stripe/subscriptions:`, JSON.stringify(subscription));
        return subscription;
      }
    }
  } catch (error) {
    console.error(`[USER COUNT] Error fetching from /api/stripe/subscriptions:`, error);
  }
  
  // Try mongoose as final fallback
  let mongooseConn: mongoose.Connection | null = null;
  try {
    console.log(`[USER COUNT] Trying to get subscription with Mongoose`);
    mongooseConn = mongoose.createConnection(uri);
    const SubscriptionSchema = new mongoose.Schema({
      companyCode: String,
      planType: String,
      userLimit: Number,
      status: String,
      currentPeriodEnd: Date,
      stripePriceId: String,
      productName: String,
      stripeSubscriptionId: String
    });
    const SubscriptionModel = mongooseConn.model('Subscription', SubscriptionSchema);
    
    const mongooseSubscription = await SubscriptionModel.findOne({ companyCode: sanitizedCode }).lean();
    if (mongooseSubscription) {
      let subscription = mongooseSubscription as unknown as SubscriptionData;
      console.log(`[USER COUNT] Subscription from Mongoose:`, JSON.stringify(subscription));
      
      // Update product details if needed
      if (subscription.stripeSubscriptionId && (!subscription.productName || subscription.productName === 'Unknown Plan')) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId, {
            expand: ['items.data.price.product']
          });
          
          const priceItem = stripeSub.items.data[0]?.price;
          if (priceItem && typeof priceItem.product === 'object') {
            const product = priceItem.product as Stripe.Product;
            subscription.productName = product.name || 'Standard';
            
            const name = subscription.productName.toLowerCase();
            if (name.includes('starter')) subscription.planType = 'starter';
            else if (name.includes('standard')) subscription.planType = 'standard';
            else if (name.includes('enterprise')) subscription.planType = 'enterprise';
            
            console.log(`[USER COUNT] Updated subscription with Stripe product details:`, {
              productName: subscription.productName,
              planType: subscription.planType
            });
          }
        } catch (err) {
          console.error(`[USER COUNT] Error fetching subscription details from Stripe:`, err);
        }
      }
      return subscription;
    }
  } catch (err) {
    console.error(`[USER COUNT] Error getting subscription with Mongoose:`, err);
  } finally {
    if (mongooseConn) {
      await mongooseConn.close();
    }
  }
  
  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse<UserCountResponse | { error: string }>> {
  try {
    // Get the company code from the query parameters
    const url = new URL(req.url);
    const companyCodeRaw = url.searchParams.get('companyCode');
    if (!companyCodeRaw) {
      return NextResponse.json({ error: 'Company code is required' }, { status: 400 });
    }
    
    const sanitizedCode = companyCodeRaw.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    console.log(`[USER COUNT] Sanitized companyCode to: ${sanitizedCode}`);

    console.log(`[USER COUNT] Fetching user count for company: ${sanitizedCode}`);

    // Reuse cached MongoClient
    const client = await clientPromise;
    const companyDb = client.db(`company_${sanitizedCode}`);
    const usersCollection: Collection = companyDb.collection('users');
    
    // [USER COUNT] BEGIN: preserve active user count (do not remove)
    console.log(`[USER COUNT] Counting active users in company_${sanitizedCode}`);
    const count = await usersCollection.countDocuments({ status: "active" });
    console.log(`[USER COUNT] Found ${count} active users in company_${sanitizedCode}`);
    const totalCount = await usersCollection.countDocuments();
    console.log(`[USER COUNT] Total users in company_${sanitizedCode}: ${totalCount}`);
    const pendingCount = await usersCollection.countDocuments({ status: "pending" });
    console.log(`[USER COUNT] Pending users in company_${sanitizedCode}: ${pendingCount}`);
    // [USER COUNT] END
    
    // Attempt to retrieve subscription doc from MongoDB subscriptions collection
    console.log('[USER COUNT] Attempting MongoDB subscription lookup for company:', sanitizedCode);
    let subscription: SubscriptionData | null = null;
    try {
      const subDoc = await companyDb.collection<SubscriptionData>('subscriptions')
        .findOne({ companyCode: sanitizedCode });
      console.log('[USER COUNT] Subscription document from MongoDB:', JSON.stringify(subDoc));
      if (subDoc) {
        subscription = subDoc;
        console.log('[USER COUNT] Using subscription from MongoDB with planType:', subDoc.planType, 'and userLimit:', subDoc.userLimit);
      } else {
        console.log('[USER COUNT] No subscription doc found in MongoDB, proceeding to Stripe-first lookup');
      }
    } catch (err) {
      console.error('[USER COUNT] Error fetching subscription doc from MongoDB:', err);
    }
    // If no MongoDB doc, fallback to Stripe
    if (!subscription) {
      console.log('[USER COUNT] Calling stripeFirstSearch for company:', sanitizedCode);
      subscription = await stripeFirstSearch(sanitizedCode);
      console.log('[USER COUNT] stripeFirstSearch returned:', JSON.stringify(subscription));
    }
    // If still no subscription or not active, try fallbackSearch
    if (!subscription || subscription.status !== 'active') {
      console.log('[USER COUNT] Subscription is missing or not active (status:', subscription?.status, '), trying fallbackSearch');
      const fallbackSub = await fallbackSearch(sanitizedCode, sanitizedCode, companyDb);
      console.log('[USER COUNT] fallbackSearch returned:', JSON.stringify(fallbackSub));
      if (fallbackSub) {
        subscription = fallbackSub;
        console.log('[USER COUNT] Using subscription from fallbackSearch with planType:', fallbackSub.planType, 'and userLimit:', fallbackSub.userLimit);
      }
    }
    console.log('[USER COUNT] Final subscription object:', JSON.stringify(subscription));
    // If still no subscription, create default
    if (!subscription) {
      console.log('[USER COUNT] No subscription found at all, creating default based on user count');
      const defaultPlanType = count >= 3 ? 'enterprise' : count >= 2 ? 'standard' : 'starter';
      const defaultUserLimit = count >= 3 ? 3 : count >= 2 ? 2 : 1;
      
      subscription = {
        companyCode: sanitizedCode,
        planType: defaultPlanType,
        userLimit: defaultUserLimit,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        stripePriceId: '',
        productName: defaultPlanType.charAt(0).toUpperCase() + defaultPlanType.slice(1) + ' Plan',
        stripeSubscriptionId: ''
      };
      console.log('[USER COUNT] Created default subscription:', JSON.stringify(subscription));
    }
    
    // Default user limits based on plan type
    const defaultLimits: Record<string, number> = {
      starter: 1,
      standard: 2,
      enterprise: 3
    };
    
    // Get plan type and user limit with detailed logging
    const planType = subscription?.planType?.toLowerCase() || 'standard';
    console.log(`[USER COUNT] Plan type:`, planType);
    
    const userLimitFromSubscription = subscription?.userLimit;
    console.log(`[USER COUNT] User limit from subscription:`, userLimitFromSubscription);
    
    const userLimit = typeof userLimitFromSubscription === 'number' && userLimitFromSubscription > 0 ? 
      userLimitFromSubscription : 
      defaultLimits[planType] || defaultLimits.standard;
    
    console.log(`[USER COUNT] Final user limit:`, userLimit);
    
    // Check if limit has been reached
    const limitReached = count >= userLimit;
    const remainingSlots = Math.max(0, userLimit - count);
    
    console.log(`[USER COUNT] Limit reached: ${limitReached}, Remaining slots: ${remainingSlots}`);
    
    const response: UserCountResponse = { 
      count,
      totalCount,
      pendingCount,
      activeOnly: true,
      subscription: subscription ? {
        id: subscription._id?.toString() || '',
        planType,
        userLimit,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        stripePriceId: subscription.stripePriceId || '',
        productName: subscription.productName || planType.charAt(0).toUpperCase() + planType.slice(1) + ' Plan',
        stripeSubscriptionId: subscription.stripeSubscriptionId || ''
      } : null,
      limitReached,
      remainingSlots
    };
    
    console.log(`[USER COUNT] Returning response:`, JSON.stringify(response));
    
    return NextResponse.json(response);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[USER COUNT] Error counting users:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
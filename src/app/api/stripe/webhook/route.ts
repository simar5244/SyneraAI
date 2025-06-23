import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { MongoClient, MongoClientOptions } from 'mongodb';
import { getAuthUserModel } from '@/models/AuthUser';
import { getCompanyAuthModel } from '@/models/CompanyAuth';
import Subscription from '@/models/Subscription';
import connectDB from '@/lib/dbConnect';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil',
});

// MongoDB connection string
const uri = process.env.MONGODB_URI || '';

// Map Stripe product IDs to plan types and user limits
const PLAN_CONFIGS = {
  'starter': { userLimit: 1 },
  'standard': { userLimit: 2 },
  'enterprise': { userLimit: 3 } // No limit removed for enterprise, set to 3
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') || '';

  let event: Stripe.Event;

  try {
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Connect to MongoDB for database operations
  await connectDB('org_sim_db');
  let client: MongoClient | null = null;
  
  try {
    // Connect to MongoDB
    const options: MongoClientOptions = { monitorCommands: true };
    client = new MongoClient(uri, options);
    await client.connect();
    
    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // On Checkout completion, fetch the subscription and persist
        if (session.subscription && typeof session.subscription === 'string') {
          const subscriptionObj = await stripe.subscriptions.retrieve(session.subscription);
          await handleSubscriptionChange(subscriptionObj);
        }
        break;
      }
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Extract company information from metadata
        const companyName = paymentIntent.metadata.companyName;
        const companyCode = paymentIntent.metadata.companyCode;
        const adminEmail = paymentIntent.metadata.adminEmail;
        const priceId = paymentIntent.metadata.priceId;
        
        if (!companyCode || !adminEmail) {
          console.error('Missing company code or admin email in payment metadata');
          return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
        }
        
        // Update user status to active and role to admin
        await updateAdminStatus(companyCode, adminEmail);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;
        
      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(deletedSubscription);
        break;
        
      case 'invoice.payment_succeeded':
        const invoice = event.data.object as any;
        if (invoice.subscription) {
          const subscriptionDetails = await stripe.subscriptions.retrieve(invoice.subscription as string);
          await handleSubscriptionChange(subscriptionDetails);
        }
        break;
        
      case 'invoice.payment_failed':
        const failedInvoice = event.data.object as any;
        if (failedInvoice.subscription) {
          // Update subscription status to past_due
          await Subscription.updateOne(
            { stripeSubscriptionId: failedInvoice.subscription as string },
            { $set: { status: 'past_due' } }
          );
        }
        break;
    }
  } catch (error) {
    console.error('Error handling webhook event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    if (client) {
      await client.close();
    }
  }

  return NextResponse.json({ received: true });
}

async function updateAdminStatus(companyCode: string, adminEmail: string) {
  let client: MongoClient | null = null;
  
  try {
    // Connect to MongoDB
    const options: MongoClientOptions = { monitorCommands: true };
    client = new MongoClient(uri, options);
    await client.connect();
    
    // Update in central auth DB
    const AuthUserModel = await getAuthUserModel();
    await AuthUserModel.updateOne(
      { email: adminEmail.toLowerCase(), companyCode },
      { $set: { status: 'active', role: 'admin' } }
    );
    
    // Update in company auth collection
    const CompanyAuth = await getCompanyAuthModel(companyCode);
    await CompanyAuth.updateOne(
      { email: adminEmail.toLowerCase() },
      { $set: { status: 'active', role: 'admin' } }
    );
    
    // Update in main users collection
    const mainDb = client.db('org_sim_db');
    const usersCollection = mainDb.collection('users');
    await usersCollection.updateOne(
      { email: adminEmail.toLowerCase(), companyCode },
      { $set: { status: 'active', role: 'admin' } }
    );
    
    // Update in company-specific users collection
    const companyDb = client.db(`company_${companyCode}`);
    const companyUsers = companyDb.collection('users');
    await companyUsers.updateOne(
      { email: adminEmail.toLowerCase() },
      { $set: { status: 'active', role: 'admin' } }
    );
    
    console.log(`Successfully updated admin status for ${adminEmail} in company ${companyCode}`);
  } catch (error) {
    console.error('Error updating admin status:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  try {
    // Get customer info to find company details
    const customer = await stripe.customers.retrieve(subscription.customer as string);
    if (!customer || customer.deleted) {
      throw new Error('Customer not found or deleted');
    }
    
    // Extract company code from customer metadata
    const companyCode = customer.metadata.companyCode;
    const companyName = customer.metadata.companyName;
    
    if (!companyCode) {
      throw new Error('Company code not found in customer metadata');
    }
    
    // Get the product details to determine plan type
    const priceId = subscription.items.data[0].price.id;
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
    const product = price.product as Stripe.Product;
    
    // Determine plan type from product name or metadata
    let planType = 'starter'; // Default
    if (product.name.toLowerCase().includes('standard')) {
      planType = 'standard';
    } else if (product.name.toLowerCase().includes('enterprise')) {
      planType = 'enterprise';
    } else if (product.metadata.planType) {
      planType = product.metadata.planType;
    }
    
    // Get user limit based on plan type
    const userLimit = PLAN_CONFIGS[planType as keyof typeof PLAN_CONFIGS]?.userLimit || 2;
    
    // Find existing subscription in our database
    const existingSubscription = await Subscription.findOne({ stripeSubscriptionId: subscription.id });
    
    if (existingSubscription) {
      // Update existing subscription
      existingSubscription.status = subscription.status as any;
      existingSubscription.stripePriceId = priceId;
      existingSubscription.productName = product.name;
      existingSubscription.planType = planType as any;
      existingSubscription.userLimit = userLimit;
      existingSubscription.currentPeriodStart = new Date((subscription as any).current_period_start * 1000);
      existingSubscription.currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);
      existingSubscription.cancelAtPeriodEnd = subscription.cancel_at_period_end;
      if (subscription.canceled_at) {
        existingSubscription.canceledAt = new Date(subscription.canceled_at * 1000);
      }
      
      await existingSubscription.save();
      console.log(`Updated subscription for company ${companyCode}`);
    } else {
      // Create new subscription record
      await Subscription.create({
        companyCode,
        companyName: companyName || companyCode,
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        productName: product.name,
        planType,
        userLimit,
        status: subscription.status as any,
        currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : undefined,
      });
      console.log(`Created new subscription for company ${companyCode}`);
    }
  } catch (error) {
    console.error('Error handling subscription change:', error);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    // Update subscription status to canceled in our database
    await Subscription.updateOne(
      { stripeSubscriptionId: subscription.id },
      { 
        $set: { 
          status: 'canceled',
          canceledAt: new Date(subscription.canceled_at ? subscription.canceled_at * 1000 : Date.now())
        } 
      }
    );
    console.log(`Marked subscription ${subscription.id} as canceled`);
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
    throw error;
  }
}

import { NextRequest, NextResponse } from 'next/server';
// Using raw headers from request instead of next/headers to avoid async issues
const getStripeSignature = (req: NextRequest) => {
  return req.headers.get('stripe-signature');
};
import Stripe from 'stripe';
import connectToMongoDB from '@/lib/dbConnect';
import User from '@/models/User';

// Define interface
interface ICompany {
  companyCode: string;
  name: string;
  adminEmail: string;
  adminUser: any; // Reference to the admin user
  subscription: {
    status: string;
    plan: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    currentPeriodEnd: Date;
  };
}

// Mock Company model - replace with your actual model
const Company = {
  create: async (data: ICompany) => {
    // In production, this would save to MongoDB
    console.log('Creating company:', data);
    return data;
  }
};

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = getStripeSignature(req);
    
    if (!signature) {
      console.error('Missing Stripe signature');
      return NextResponse.json(
        { error: 'Missing Stripe signature' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      // Verify the webhook signature
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      );
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Get the client reference ID (company code) from the session
      const companyCode = session.client_reference_id;
      const metadata = session.metadata as {
        companyCode?: string;
        companyName?: string;
        adminEmail?: string;
      } | null;
      
      if (!companyCode || !metadata?.adminEmail) {
        console.error('Missing company code or admin email in session metadata');
        return NextResponse.json(
          { error: 'Missing required metadata' },
          { status: 400 }
        );
      }

      try {
        // Connect to the company's database
        await connectToMongoDB(companyCode);

        // Create the admin user first
        const adminUser = new User({
          email: metadata.adminEmail,
          companyCode,
          role: 'admin',
          firstName: 'Admin',
          lastName: 'User',
          password: Math.random().toString(36).slice(-8), // Temporary password
          isVerified: true
        });
        await adminUser.save();

        // Create the company in the database
        const companyData: ICompany = {
          companyCode,
          name: metadata.companyName || `Company-${companyCode}`,
          adminEmail: metadata.adminEmail,
          adminUser: adminUser._id,
          subscription: {
            status: 'active',
            plan: 'pro',
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : '',
            stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : '',
            currentPeriodEnd: new Date(),
          },
        };

        await Company.create(companyData);

        // Create the admin user
        await User.create({
          email: metadata.adminEmail,
          companyCode,
          role: 'admin',
          password: 'temporary-password',
        });

        console.log(`Company ${companyCode} and admin user created successfully`);
        
      } catch (error: any) {
        console.error('Error creating company or user:', error);
        return NextResponse.json(
          { error: 'Failed to create company or user' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: `Webhook handler failed: ${error.message}` },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { generateToken } from '@/lib/auth';
import connectDB from '@/lib/dbConnect';
import { getDBConnection, connectToCompanyDB } from '@/lib/companyDBConnect';
import { getUserModel } from '@/models/User';
import { SubscriptionModel } from '@/models/Subscription';
import Stripe from 'stripe';
import { Types } from 'mongoose';
import { getAuthUserModel } from '@/models/AuthUser';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil',
  typescript: true,
  timeout: 10000, // 10 second timeout
});

interface UserDocument extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  company: string;
  companyCode: string;
  emailVerified: boolean;
  isActive: boolean;
  status: string;
  stripeCustomerId?: string;
  save(): Promise<this>;
}

// MongoDB connection string
const uri = process.env.MONGODB_URI || '';

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    console.log('[COMPANY SIGNUP] Received signup data:', body);
    console.log('Company signup body:', body);
    
    // Extract and validate required fields
    const {
      companyName,
      companyCode,
      adminEmail,
      adminPassword,
      adminFirstName = '',
      adminLastName = '',
      priceId,
      promoCode,
      paymentMethodId // new field from frontend for payment
    } = body;

    if (!companyName || !companyCode || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to main database with company code
    await connectDB(companyCode);
    
    // Connect to the company-specific database
    await connectToCompanyDB(companyCode);
    const User = getUserModel(companyCode);
    const Subscription = SubscriptionModel;

    // Check if email is already in use
    const existingUser = await User.findOne({ email: adminEmail.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already in use' },
        { status: 400 }
      );
    }

    // Generate username from email by taking the part before @
    const generatedUsername = adminEmail.split('@')[0].toLowerCase();

    // Create admin user
    const adminUser = new User({
      email: adminEmail.toLowerCase(),
      username: generatedUsername, // Auto-generate username from email
      password: adminPassword,
      firstName: adminFirstName,
      lastName: adminLastName,
      role: 'admin',
      company: companyName,
      companyCode,
      emailVerified: true,
      status: 'active',
      isActive: true,
      stripeCustomerId: '', // Will be set after Stripe customer creation
    }) as any; // Using any to bypass TypeScript checks for now

    // Save the user to get the _id
    const savedUser = await adminUser.save();
    const userId = savedUser._id.toString();

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: adminEmail.toLowerCase(),
      name: `${adminFirstName} ${adminLastName}`.trim() || companyName,
      metadata: {
        companyCode,
        companyName,
        userId,
        role: 'admin'
      },
    });

    // If a payment method is provided, attach and set as default
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: paymentMethodId }
      });
    }

    // Only create a subscription immediately if we already have a payment method
    let subscription = null;
    let clientSecret: string | null = null;
    if (priceId && paymentMethodId) {
      try {
        // Create default_incomplete subscription and invoice
        subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: priceId }],
          default_payment_method: paymentMethodId,
          payment_behavior: 'default_incomplete',
          expand: ['latest_invoice.payment_intent'],
          metadata: { companyCode, companyName, adminEmail: adminEmail.toLowerCase(), promoCode: promoCode || '' }
        });
        // Extract PaymentIntent client secret for confirmation on frontend
        clientSecret = (subscription.latest_invoice as any).payment_intent.client_secret;
        // Confirm the PaymentIntent immediately to finalize payment
        const paymentIntentId = (subscription.latest_invoice as any).payment_intent.id;
        if (paymentIntentId) {
          await stripe.paymentIntents.confirm(paymentIntentId);
        }
      } catch (error) {
        console.error('Error creating subscription:', error);
      }
    }

    // Update user with Stripe customer ID
    savedUser.stripeCustomerId = customer.id;
    await savedUser.save();

    // Create AuthUser record in central auth database for login
    try {
      const AuthUserModel = await getAuthUserModel();
      // Delete any existing auth user with same email to prevent duplicates
      await AuthUserModel.deleteMany({ email: savedUser.email.toLowerCase() });
      
      // Create new auth user with explicit admin role
      const authUser = await AuthUserModel.create({
        userId,
        originalId: savedUser._id,
        username: savedUser.username,
        email: savedUser.email.toLowerCase(),
        password: savedUser.password, // already hashed from User model
        role: 'admin', // Explicitly set role to admin
        status: 'active',
        companyCode,
        companyName,
        databaseName: `company_${companyCode.toLowerCase()}`,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('Created AuthUser record for', savedUser.email, 'in auth_db with ID:', authUser._id);
      
      // Add a small delay to ensure the auth record is fully committed
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (authErr) {
      console.error('Error creating AuthUser record:', authErr);
      // Don't fail the entire signup if auth user creation fails
      // The user can still log in with email/password which will create the auth record
    }

    // Generate JWT token with explicit admin role
    const token = generateToken({ 
      id: userId, 
      email: savedUser.email, 
      role: 'admin', // Explicitly set role to admin
      companyCode: savedUser.companyCode,
      status: 'active' // Ensure status is set
    });
    
    console.log('Generated token with role:', 'admin', 'for user:', savedUser.email);

    // Create a Stripe Checkout session for subscription
    // priceId should be provided by frontend
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: ['card'],
      subscription_data: { metadata: { companyCode, companyName, userId } },
      success_url: `${origin}/api/auth/verify-session?session_id={CHECKOUT_SESSION_ID}&company_code=${companyCode}&email=${encodeURIComponent(adminEmail)}`,
      cancel_url: `${origin}/company-signup?canceled=true`,
    });

    // Return session URL to frontend
    return NextResponse.json({ success: true, message: 'Signup pending payment', data: { user: savedUser, token, sessionUrl: session.url } });

  } catch (error: any) {
    console.error('Error in company signup:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  } finally {
    // Removed the if (client) condition as it was not defined anywhere in the code
  }
}
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import connectToMongoDB from '@/lib/dbConnect';
import { getUserModel } from '@/models/User';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil',
});

// GET /api/stripe/customers - Get customer for current company
export async function GET(req: NextRequest) {
  try {
    // Get the company code from the query parameters
    const companyCode = req.nextUrl.searchParams.get('companyCode');
    const email = req.nextUrl.searchParams.get('email');
    
    if (!companyCode) {
      return NextResponse.json({ error: 'Company code is required' }, { status: 400 });
    }

    // Connect to the company-specific database
    await connectToMongoDB(companyCode);
    
    // Get the User model for this company
    const User = getUserModel(companyCode);
    
    // Find the user by email or get the admin user
    let user;
    if (email) {
      user = await User.findOne({ email });
    } else {
      user = await User.findOne({ role: 'admin' });
    }
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check if the user has a Stripe customer ID
    if (!user.stripeCustomerId) {
      return NextResponse.json({ 
        error: 'No Stripe customer found for this user',
        code: 'customer_not_found'
      }, { status: 404 });
    }
    
    // Get the customer data from Stripe
    const customer = await stripe.customers.retrieve(user.stripeCustomerId);
    
    // Check if customer is deleted
    if ((customer as any).deleted) {
      return NextResponse.json({ 
        error: 'Customer has been deleted',
        code: 'customer_deleted'
      }, { status: 404 });
    }
    
    // Return the customer data
    return NextResponse.json({
      id: user.stripeCustomerId,
      email: (customer as Stripe.Customer).email,
      name: (customer as Stripe.Customer).name,
      phone: (customer as Stripe.Customer).phone,
      address: (customer as Stripe.Customer).address,
      metadata: (customer as Stripe.Customer).metadata,
    });
  } catch (error: any) {
    console.error('Error fetching customer:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/stripe/customers - Create or update a customer
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyCode, email, name } = body;
    
    // Validate input
    if (!companyCode || !email) {
      return NextResponse.json({ error: 'Company code and email are required' }, { status: 400 });
    }
    
    // Connect to the company-specific database
    await connectToMongoDB(companyCode);
    
    // Get the User model for this company
    const User = getUserModel(companyCode);
    
    // Find the user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    let stripeCustomerId = user.stripeCustomerId;
    
    // If the user doesn't have a Stripe customer ID, create one
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email,
        name: name || user.firstName + ' ' + user.lastName,
        metadata: {
          companyCode,
          userId: user._id?.toString() || '',
        },
      });
      
      stripeCustomerId = customer.id;
      
      // Update the user with the Stripe customer ID
      user.stripeCustomerId = stripeCustomerId;
      await user.save();
    } else {
      // Update the existing customer
      await stripe.customers.update(stripeCustomerId, {
        email,
        name: name || user.firstName + ' ' + user.lastName,
        metadata: {
          companyCode,
          userId: user._id?.toString() || '',
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      customerId: stripeCustomerId,
    });
  } catch (error: any) {
    console.error('Error creating/updating customer:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import connectToMongoDB from '@/lib/dbConnect';
import Subscription from '@/models/Subscription';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil',
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyCode, paymentMethodId } = body;
    
    // Validate input
    if (!companyCode) {
      return NextResponse.json({ error: 'Company code is required' }, { status: 400 });
    }
    
    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Payment method ID is required' }, { status: 400 });
    }
    
    // Connect to the company-specific database
    await connectToMongoDB(companyCode);
    
    // Find the subscription for the company
    const subscription = await Subscription.findOne({ companyCode });
    
    if (!subscription) {
      return NextResponse.json({ error: 'No subscription found for this company' }, { status: 404 });
    }
    
    try {
      // Set the payment method as the default for the customer
      await stripe.customers.update(subscription.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
      
      // Update the subscription to use the new payment method
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        default_payment_method: paymentMethodId,
      });
      
      // Update our database record
      subscription.paymentMethodId = paymentMethodId;
      await subscription.save();
      
      return NextResponse.json({ 
        success: true,
        message: 'Payment method updated successfully',
      });
    } catch (stripeError: any) {
      console.error('Error updating payment method in Stripe:', stripeError);
      return NextResponse.json({ 
        error: stripeError.message || 'Failed to update payment method' 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error updating payment method:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 
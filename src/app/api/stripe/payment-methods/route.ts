import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil',
});

export async function GET(req: NextRequest) {
  try {
    // Get the company code from the query parameters
    const companyCode = req.nextUrl.searchParams.get('companyCode');
    
    if (!companyCode) {
      return NextResponse.json({ error: 'Company code is required' }, { status: 400 });
    }
    
    // Find subscription by company code in metadata
    const subscriptions = await stripe.subscriptions.search({
      query: `metadata['companyCode']:'${companyCode}'`,
      limit: 1,
    });
    
    if (!subscriptions.data || subscriptions.data.length === 0) {
      return NextResponse.json({ 
        error: 'No subscription found for this company',
        message: 'Please create a subscription to manage payment methods',
        code: 'subscription_not_found'
      }, { status: 404 });
    }
    
    const subscription = subscriptions.data[0];
    const stripeCustomerId = typeof subscription.customer === 'string' 
      ? subscription.customer 
      : subscription.customer.id;
    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'No Stripe customer found for this company' }, { status: 404 });
    }
    
    // Get customer details from Stripe
    let customer;
    try {
      customer = await stripe.customers.retrieve(stripeCustomerId, {
        expand: ['invoice_settings.default_payment_method']
      });
      
      if (typeof customer === 'string' || customer.deleted) {
        throw new Error('Customer not found or deleted');
      }
    } catch (customerError: any) {
      console.error('Error retrieving customer from Stripe:', customerError);
      return NextResponse.json({ 
        error: 'Unable to retrieve customer details',
        message: customerError.message
      }, { status: 500 });
    }
    
    // Get payment methods from Stripe
    let paymentMethods;
    try {
      paymentMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: 'card',
      });
    } catch (stripeError: any) {
      console.error('Error retrieving payment methods from Stripe:', stripeError);
      return NextResponse.json({ 
        error: 'Unable to retrieve payment methods',
        message: stripeError.message
      }, { status: 500 });
    }
    
    // Get default payment method ID
    const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method ?
      typeof customer.invoice_settings.default_payment_method === 'string' ?
        customer.invoice_settings.default_payment_method :
        customer.invoice_settings.default_payment_method.id :
      null;
    
    // Add isDefault flag to payment methods
    const enhancedPaymentMethods = paymentMethods.data.map(method => ({
      id: method.id,
      type: method.type,
      card: method.card,
      billingDetails: method.billing_details,
      created: method.created,
      isDefault: method.id === defaultPaymentMethodId,
    }));
    
    // Get upcoming invoice if available
    let upcomingInvoice = null;
    try {
      // Use the subscription we already have from the search
      const stripeSubscription = subscription;
      
      upcomingInvoice = {
        amount: stripeSubscription.items?.data?.[0]?.price?.unit_amount || 0,
        currency: stripeSubscription.currency || 'usd',
        nextBillingDate: new Date((stripeSubscription as any).current_period_end * 1000 || Date.now() + 30 * 24 * 60 * 60 * 1000), // Default to 30 days if not available
      };
    } catch (invoiceError) {
      console.error('Error retrieving subscription details:', invoiceError);
      // Continue without upcoming invoice data
    }
    
    return NextResponse.json({ 
      paymentMethods: enhancedPaymentMethods,
      defaultPaymentMethodId,
      upcomingInvoice,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      }
    });
  } catch (error: any) {
    console.error('Error fetching payment methods:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 
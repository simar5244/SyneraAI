import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { connectToCompanyDB } from '@/lib/companyDBConnect';
import { getUserModel } from '@/models/User';
import Subscription from '@/models/Subscription';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil',
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyCode, priceId, paymentMethodId, customerId } = body;
    
    if (!companyCode || !priceId || !customerId) {
      return NextResponse.json({ 
        error: 'Missing required fields: companyCode, priceId, and customerId are required' 
      }, { status: 400 });
    }

    // Connect to the company database
    await connectToCompanyDB(companyCode);
    
    // Get the User model for this company
    const User = getUserModel(companyCode);
    
    // Find the admin user
    const adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin user not found' }, { status: 404 });
    }
    
    // If customerId is not provided, use the admin's Stripe customer ID
    const stripeCustomerId = customerId || adminUser.stripeCustomerId;
    
    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'No Stripe customer ID found' }, { status: 400 });
    }
    
    // If payment method is provided, attach it to the customer
    if (paymentMethodId) {
      try {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
        await stripe.customers.update(stripeCustomerId, { invoice_settings: { default_payment_method: paymentMethodId } });
      } catch (error: any) {
        console.error('Error attaching payment method:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    
    // Get the price details from Stripe
    const price = await stripe.prices.retrieve(priceId);
    
    // Create subscription off-session and generate invoice/paymentIntent
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice', 'latest_invoice.payment_intent'],
      off_session: true,
    }) as Stripe.Subscription;
    
    // Retrieve expanded invoice and paymentIntent
    let invoice: Stripe.Invoice;
    if (typeof subscription.latest_invoice === 'string') {
      invoice = await stripe.invoices.retrieve(subscription.latest_invoice, { expand: ['payment_intent'] });
    } else {
      invoice = subscription.latest_invoice as Stripe.Invoice;
    }
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    // Confirm and pay the invoice
    if (paymentIntent && paymentIntent.id) {
      try {
        await stripe.paymentIntents.confirm(paymentIntent.id);
      } catch (err) {
        console.error('Confirm Error:', err);
      }
    }
    if (invoice.id && invoice.status !== 'paid') {
      try {
        await stripe.invoices.pay(invoice.id);
      } catch (err) {
        console.error('Invoice Pay Error:', err);
      }
    }

    // Retrieve product for metadata
    const product = await stripe.products.retrieve(price.product as string);

    // Persist subscription in DB
    await Subscription.create({
      companyCode,
      companyName: adminUser.company,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      productName: product.name,
      planType: product.name.toLowerCase(),
      status: subscription.status,
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      latestInvoiceId: invoice.id,
      paymentMethodId: paymentMethodId,
      metadata: subscription.metadata,
    });

    // Return subscription details to frontend
    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: (subscription as any).current_period_start,
        currentPeriodEnd: (subscription as any).current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        clientSecret: paymentIntent.client_secret ?? null,
      },
    });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

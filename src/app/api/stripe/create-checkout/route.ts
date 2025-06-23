import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil',
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      companyCode, 
      companyName, 
      priceId, 
      adminEmail,
      promoCode,
      successUrl,
      cancelUrl,
      interval,
      planName,
      userEmail,
      userName
    } = body;
    
    // Validate required fields
    if (!companyCode || !priceId) {
      return NextResponse.json({ 
        error: 'Company code and price ID are required' 
      }, { status: 400 });
    }
    
    // Get the price details to determine if it's yearly or monthly
    const price = await stripe.prices.retrieve(priceId, {
      expand: ['product']
    });
    
    const product = price.product as Stripe.Product;
    const isYearly = price.recurring?.interval === 'year';
    
    // Build subscription metadata
    const subscriptionMetadata = {
      companyCode,
      companyName: companyName || `Company-${companyCode}`,
      adminEmail: adminEmail || userEmail,
      interval: isYearly ? 'year' : 'month',
      isYearly: isYearly ? 'true' : 'false',
      planName: planName || product.name || 'Standard',
      planType: (product.name || '').toLowerCase().includes('starter') ? 'starter' : 
                (product.name || '').toLowerCase().includes('enterprise') ? 'enterprise' : 'standard',
      ...(promoCode ? { promoCode } : {})
    };
    
    console.log(`[CREATE-CHECKOUT] Creating checkout for ${isYearly ? 'yearly' : 'monthly'} plan: ${subscriptionMetadata.planName}`);
    
    // Attempt to reuse existing customer for this company
    let existingCustomerId: string | undefined = body.customerId;
    if (!existingCustomerId) {
      try {
        // Look for any subscription (active or canceled) tied to this company to find its customer
        const priorSubs = await stripe.subscriptions.search({
          query: `metadata['companyCode']:'${companyCode}'`,
          limit: 1,
        });
        if (priorSubs.data.length) {
          const sub = priorSubs.data[0];
          existingCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
          console.log(`[CREATE-CHECKOUT] Reusing existing customer ${existingCustomerId} for company ${companyCode}`);
        }
      } catch (searchErr) {
        console.warn('[CREATE-CHECKOUT] Unable to search existing customer', searchErr);
      }
    }

    // Create checkout session parameters
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      ...(existingCustomerId ? { customer: existingCustomerId } : {}),
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: successUrl ||
        `${req.headers.get('origin')}/dashboard/billing?success=true`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/dashboard/billing?canceled=true`,
            // Provide email only if not reusing an existing customer (Stripe forbids both customer & customer_email)
      ...(existingCustomerId ? {} : { customer_email: userEmail || adminEmail }),
      client_reference_id: companyCode,
      metadata: subscriptionMetadata,
      subscription_data: {
        metadata: subscriptionMetadata,
        ...(promoCode ? { coupon: promoCode } : {})
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      // Disable automatic tax in test mode
      automatic_tax: {
        enabled: false,
      },
      tax_id_collection: {
        enabled: false,
      },
    };
    
    console.log('Creating checkout session with params:', JSON.stringify(sessionParams, null, 2));
    
    // Create the checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);
    
    if (!session.url) {
      throw new Error('Failed to create checkout session: No URL returned from Stripe');
    }
    
    return NextResponse.json({ 
      url: session.url,
      sessionId: session.id
    });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 
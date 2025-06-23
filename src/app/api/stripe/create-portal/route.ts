import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { companyCode, returnUrl, action } = await req.json();
    if (!companyCode) {
      return NextResponse.json({ error: 'Company code is required' }, { status: 400 });
    }

        // Find the most recent ACTIVE subscription for this company
    const subs = await stripe.subscriptions.search({
      // status:'active' makes sure we don't grab an old or canceled subscription
      query: `status:'active' AND metadata['companyCode']:'${companyCode}'`,
      limit: 1,
      // Stripe search API sorts by created desc by default
    });

    // If no active subscription, fall back to any subscription (old behaviour)
    let sub = subs.data[0];
    if (!sub) {
      const anySubs = await stripe.subscriptions.search({
        query: `metadata['companyCode']:'${companyCode}'`,
        limit: 1,
      });
      sub = anySubs.data[0];
    }
    if (!sub) {
      return NextResponse.json({ error: 'No subscription found for this company' }, { status: 404 });
    }
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

    // Fetch all active recurring prices and map to product list for portal
    const pricesList = await stripe.prices.list({ active: true, limit: 100, expand: ['data.product'] });

    // Build a map of unique active products with their relevant prices
    const productMap = new Map<string, { product: string; prices: string[] }>();

    pricesList.data.forEach(price => {
      const prod = price.product as Stripe.Product;
      if (!prod?.active) return; // skip archived products
      if (!productMap.has(prod.id)) {
        productMap.set(prod.id, { product: prod.id, prices: [] });
      }
      productMap.get(prod.id)!.prices.push(price.id);
    });

    // Convert to array and respect Stripe's 10-product limit
    const productsForConfig = Array.from(productMap.values()).slice(0, 10) as any;

    const config = await stripe.billingPortal.configurations.create({
      features: {
        subscription_update: {
          enabled: true,
          products: productsForConfig,
          default_allowed_updates: ['price'],
        },
        payment_method_update: {
          enabled: true,
        },
        subscription_cancel: {
          enabled: true,
        },
      },
    });

    const sessionParams: any = {
      customer: customerId,
      return_url: returnUrl || `${req.headers.get('origin')}/dashboard/billing`,
      configuration: config.id,
    };

        if (action === 'cancel') {
      // Fetch the customer's active subscription to ensure correct ID
      const activeSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1,
      });
      const activeSub = activeSubs.data[0];
      if (!activeSub) {
        return NextResponse.json({ error: 'No active subscription to cancel' }, { status: 404 });
      }

      sessionParams.flow_data = {
        type: 'subscription_cancel',
        subscription_cancel: {
          subscription: activeSub.id,
        },
      } as any;
    }
    if (action === 'payment-method') {
      sessionParams.flow_data = {
        type: 'payment_method_update',
      } as any;
    }

    const portal = await stripe.billingPortal.sessions.create(sessionParams);

    return NextResponse.json({ portalUrl: portal.url });
  } catch (err: any) {
    console.error('[create-portal] error', err);
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 });
  }
}
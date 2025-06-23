import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil', // Use the required API version
});

export async function POST(req: NextRequest) {
  try {
    // Artificial delay for coupon lookup
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Parse the request body
    const body = await req.json();
    const { priceId, amount, companyName, companyCode, adminEmail, promoCode } = body;

    // Validate required fields
    if ((!priceId && !amount) || !companyName || !companyCode || !adminEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Determine the amount to charge
    let amountInCents: number;
    
    if (priceId) {
      // If priceId is provided, fetch the price from Stripe
      const price = await stripe.prices.retrieve(priceId);
      amountInCents = price.unit_amount || 0;
    } else {
      // Fallback to the provided amount
      amountInCents = Math.round(amount * 100); // Convert to cents
    }

    // Check if promo code exists in Stripe (if provided)
    let discountPercent = 0;
    if (promoCode) {
      let couponObj: Stripe.Coupon | undefined;
      // Try retrieving as coupon ID
      try {
        couponObj = await stripe.coupons.retrieve(promoCode);
      } catch {
        couponObj = undefined;
      }
      // If not a valid coupon, try promotion codes lookup
      if (!couponObj || !couponObj.valid) {
        const promos = await stripe.promotionCodes.list({ code: promoCode, active: true, limit: 1 });
        if (promos.data.length > 0) {
          couponObj = await stripe.coupons.retrieve(promos.data[0].coupon.id);
        }
      }
      if (couponObj && couponObj.valid && couponObj.percent_off) {
        discountPercent = couponObj.percent_off;
        console.log(`Valid coupon found: ${promoCode} with ${discountPercent}% off`);
      } else {
        console.log(`Coupon not found: ${promoCode}`);
      }
    }

    // Apply discount
    if (discountPercent > 0) {
      amountInCents = Math.round(amountInCents * (100 - discountPercent) / 100);
    }

    // If amountInCents is zero, no payment required
    if (amountInCents === 0) {
      // Free plan, no payment required
      return NextResponse.json({ clientSecret: null, amountInCents });
    }

    // Create a payment intent with the correct parameters
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: { 
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: {
        companyName,
        companyCode,
        adminEmail,
        priceId,
        ...(promoCode ? { promoCode } : {}),
      },
      description: `Subscription for ${companyName}`,
      setup_future_usage: 'off_session',
      confirm: false,
      payment_method_options: {
        card: {
          request_three_d_secure: 'any',
        },
      },
    });
    
    console.log('Created payment intent:', paymentIntent.id);

    // Return the client secret and amountInCents
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amountInCents,
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}

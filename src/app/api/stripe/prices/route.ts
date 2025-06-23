import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil',
});

// GET /api/stripe/prices - Fetch active prices with full product details
export async function GET(req: NextRequest) {
  try {
    // Get interval from query parameters if provided
    const interval = req.nextUrl.searchParams.get('interval');
    console.log('Fetching prices with interval:', interval);
    
    // Map UI intervals to Stripe intervals
    const stripeInterval = interval === 'monthly' ? 'month' : interval === 'yearly' ? 'year' : interval;
    console.log('Mapped to Stripe interval:', stripeInterval);
    
    // Fetch all active prices with product data expanded
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product'],
      limit: 100,
    });
    
    console.log(`Found ${prices.data.length} prices`);
    
    // Filter prices by interval if specified
    let filteredPrices = prices.data.filter(price => {
      const prod = price.product as Stripe.Product;
      return prod.active; // exclude archived products
    });
    if (stripeInterval) {
      filteredPrices = filteredPrices.filter(price => 
        price.recurring && price.recurring.interval === stripeInterval
      );
      console.log(`After filtering by interval ${stripeInterval}: ${filteredPrices.length} prices`);
    }
    
    // Transform the data to match the expected StripePrice format
    const formattedPrices = filteredPrices.map(price => ({
      priceId: price.id,
      productName: price.product ? (price.product as Stripe.Product).name : 'Unknown Product',
      unitAmount: price.unit_amount || 0,
      currency: price.currency,
      interval: price.recurring ? price.recurring.interval : null,
      productDescription: price.product ? (price.product as Stripe.Product).description || '' : '',
    }));
    
    console.log('Formatted prices:', formattedPrices);
    
    // Return the formatted prices data
    return NextResponse.json({ 
      prices: formattedPrices,
      success: true
    });
  } catch (error: any) {
    console.error('Error fetching Stripe prices:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

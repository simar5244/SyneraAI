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
    const { companyCode, promoCode } = body;
    
    // Validate input
    if (!companyCode || !promoCode) {
      return NextResponse.json({ 
        error: 'Company code and promo code are required' 
      }, { status: 400 });
    }
    
    // Connect to the company-specific database
    await connectToMongoDB(companyCode);
    
    // Find the subscription for the company
    const subscription = await Subscription.findOne({ companyCode });
    
    if (!subscription) {
      return NextResponse.json({ 
        error: 'No subscription found for this company' 
      }, { status: 404 });
    }
    
    // Validate the promo code first
    let promotionCode;
    try {
      // Search for the promotion code in Stripe
      const promotionCodes = await stripe.promotionCodes.list({
        code: promoCode,
        active: true,
      });
      
      if (promotionCodes.data.length === 0) {
        return NextResponse.json({ 
          error: 'Invalid or expired promotion code' 
        }, { status: 400 });
      }
      
      promotionCode = promotionCodes.data[0];
      
      // Check if the promotion code has already been used
      if (promotionCode.max_redemptions && 
          promotionCode.times_redeemed >= promotionCode.max_redemptions) {
        return NextResponse.json({ 
          error: 'This promotion code has reached its maximum number of redemptions' 
        }, { status: 400 });
      }
    } catch (error: any) {
      console.error('Error validating promotion code:', error);
      return NextResponse.json({ 
        error: 'Error validating promotion code' 
      }, { status: 500 });
    }
    
    // Apply the promotion code to the subscription
    try {
      // Use type assertion to bypass TypeScript checking
      const updateParams = { promotion_code: promotionCode.id };
      await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        updateParams as any
      );
      
      return NextResponse.json({ 
        success: true,
        message: 'Promotion code applied successfully',
        discount: {
          id: promotionCode.coupon.id,
          name: promotionCode.coupon.name,
          percentOff: promotionCode.coupon.percent_off,
          amountOff: promotionCode.coupon.amount_off,
          duration: promotionCode.coupon.duration,
        }
      });
    } catch (error: any) {
      console.error('Error applying promotion code to subscription:', error);
      return NextResponse.json({ 
        error: error.message || 'Failed to apply promotion code to subscription' 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error applying promotion code:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 
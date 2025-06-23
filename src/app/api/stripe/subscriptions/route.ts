import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import connectToCompanyDB from '@/lib/companyDBConnect';
import Subscription from '@/models/Subscription';
import { getAuthUserModel } from '@/models/AuthUser.js';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil',
});

// GET /api/stripe/subscriptions - Get subscription for current company
export async function GET(req: NextRequest) {
  try {
    // Extract and sanitize companyCode
    const companyCodeRaw = req.nextUrl.searchParams.get('companyCode');
    if (!companyCodeRaw) {
      return NextResponse.json({ error: 'Company code is required' }, { status: 400 });
    }
    const sanitizedCode = companyCodeRaw.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    console.log(`[GET /api/stripe/subscriptions] Using sanitized companyCode: ${sanitizedCode}`);

    // Connect to company-specific DB
    const companyConn = await connectToCompanyDB(sanitizedCode);
    const nativeDb = companyConn.db;
    // Ensure db is available to satisfy TypeScript non-null
    if (!nativeDb) {
      throw new Error(`Company database unavailable for ${sanitizedCode}`);
    }

    // Get active user count
    const userCount = await nativeDb.collection('users').countDocuments({ status: 'active' });
    console.log(`[GET /api/stripe/subscriptions] Found ${userCount} active users for company: ${sanitizedCode}`);
    // First try to find subscription in the company's database
    try {
      const localSubscription = await Subscription.findOne({ companyCode: sanitizedCode }).lean(); 

      if (localSubscription && ['active','trialing','past_due','incomplete','unpaid'].includes(localSubscription.status)) {
        console.log('[GET /api/stripe/subscriptions] Using active local subscription');
        console.log(`[GET /api/stripe/subscriptions] Found local subscription with stripeSubscriptionId: ${localSubscription.stripeSubscriptionId}`);
        try {
          // Retrieve subscription and expand product for price to access metadata
          const stripeSub = await stripe.subscriptions.retrieve(localSubscription.stripeSubscriptionId, { 
            expand: [
              'discount.coupon', 
              'items.data.price.product',
              'plan',
              'latest_invoice'
            ]
          });
          
          console.log(`[GET /api/stripe/subscriptions] Retrieved subscription from Stripe: ${stripeSub.id}, status: ${stripeSub.status}`);
          
          // Get upcoming invoice to determine the actual next billing date
          let nextInvoiceDate = null;
          try {
            if (stripeSub.status === 'active' && !stripeSub.cancel_at_period_end) {
              // Use the correct Stripe API call for upcoming invoice
              const upcomingInvoice = await stripe.invoices.list({
                customer: typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer.id,
                subscription: stripeSub.id,
                limit: 1,
                status: 'open',
                expand: ['data.payment_intent']
              });
              
              if (upcomingInvoice.data && upcomingInvoice.data.length > 0 && upcomingInvoice.data[0].next_payment_attempt) {
                nextInvoiceDate = new Date(upcomingInvoice.data[0].next_payment_attempt * 1000);
                console.log(`[GET /api/stripe/subscriptions] Found next invoice date: ${nextInvoiceDate}`);
              } else {
                // If no upcoming invoice found, use current_period_end
                nextInvoiceDate = new Date((stripeSub as any).current_period_end * 1000);
                console.log(`[GET /api/stripe/subscriptions] No upcoming invoice found, using current_period_end: ${nextInvoiceDate}`);
              }
            } else {
              // For canceled subscriptions, use current_period_end
              nextInvoiceDate = new Date((stripeSub as any).current_period_end * 1000);
            }
          } catch (invoiceError: any) {
            console.warn(`[GET /api/stripe/subscriptions] Error fetching upcoming invoice: ${invoiceError.message}`);
            // Continue without the invoice data, use current_period_end as fallback
            nextInvoiceDate = new Date((stripeSub as any).current_period_end * 1000);
          }
          
          // Get complete plan details
          let planDetails = null;
          if (stripeSub.items && stripeSub.items.data && stripeSub.items.data.length > 0) {
            const firstItem = stripeSub.items.data[0];
            const price = firstItem.price;
            if (price && price.recurring) {
              planDetails = {
                id: price.id,
                object: 'price',
                active: price.active,
                amount: price.unit_amount,
                currency: price.currency,
                interval: price.recurring.interval,
                interval_count: price.recurring.interval_count,
                product: typeof price.product === 'string' ? price.product : (price.product as any).id
              };
              console.log(`[GET /api/stripe/subscriptions] Retrieved price details: ${planDetails.id}, interval: ${planDetails.interval}`);
            }
          }
          
          let discount = null;
          if (stripeSub && (stripeSub as any).discount) {
            const coupon = (stripeSub as any).discount.coupon;
            discount = { 
              id: coupon.id, 
              name: coupon.name, 
              percentOff: coupon.percent_off, 
              amountOff: coupon.amount_off, 
              currency: coupon.currency, 
              duration: coupon.duration, 
              durationInMonths: coupon.duration_in_months 
            };
          }
          // Get the price and product details from Stripe
          const priceItem = stripeSub.items.data[0]?.price;
          const product = priceItem?.product as Stripe.Product | undefined;
          
          // Check if this is a yearly plan by looking at price interval and product name
          const isYearlyPlan = 
            (priceItem?.recurring?.interval === 'year') || 
            (product?.name?.toLowerCase().includes('yearly')) ||
            (product?.metadata?.interval === 'year') ||
            (product?.metadata?.isYearly === 'true');
          
          // Get product name, append yearly/monthly if not already in the name
          let productName = product?.name || '';
          if (productName && !productName.toLowerCase().includes('yearly') && !productName.toLowerCase().includes('monthly')) {
            productName += isYearlyPlan ? ' Yearly' : ' Monthly';
          }
          
          // Determine plan type from product name or metadata
          let planType = localSubscription.planType;
          if (product) {
            // First try to get from metadata, then from product name
            planType = product.metadata.planType || 
                      (product.name ? product.name.toLowerCase().split(' ')[0] : planType);
            
            // Ensure we have a valid plan type
            if (!['starter', 'standard', 'enterprise'].includes(planType)) {
              planType = 'standard'; // Default fallback
            }
          }
          
          // Determine user limit
          let computedUserLimit = localSubscription.userLimit;
          if (product?.metadata?.userLimit) {
            const metaLimit = parseInt(product.metadata.userLimit, 10);
            if (!isNaN(metaLimit) && metaLimit > 0) {
              computedUserLimit = metaLimit;
            }
          } else {
            // Set default based on plan type if no metadata
            if (planType === 'starter') computedUserLimit = 1;
            else if (planType === 'standard') computedUserLimit = 2;
            else if (planType === 'enterprise') computedUserLimit = 3; // Unlimited for enterprise
          }
          
          // Ensure user limit is at least the current user count
          if (computedUserLimit < userCount) {
            console.log(`[SUBSCRIPTION] Increasing user limit from ${computedUserLimit} to match current user count: ${userCount}`);
            computedUserLimit = userCount;
          }
          
          // Get current period end date
          const currentPeriodEnd = new Date((stripeSub as any).current_period_end * 1000);
          
          // Extract plan details for better display in the UI
          const planDetailsForUI = priceItem?.recurring ? {
            interval: priceItem.recurring.interval,
            interval_count: priceItem.recurring.interval_count,
            amount: priceItem.unit_amount,
            currency: priceItem.currency,
            product_id: typeof priceItem.product === 'string' ? priceItem.product : (priceItem.product as any)?.id
          } : null;
          
          // Upsert latest subscription details into local DB
          const updateObject = {
            companyCode: sanitizedCode,
            companyName: localSubscription.companyName,
            planType,
            productName: productName,
            userLimit: computedUserLimit,
            status: stripeSub.status,
            currentPeriodStart: new Date((stripeSub as any).current_period_start * 1000),
            currentPeriodEnd: currentPeriodEnd,
            nextInvoiceDate: nextInvoiceDate || currentPeriodEnd,
            cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
            stripeSubscriptionId: stripeSub.id,
            stripePriceId: stripeSub.items.data[0]?.price.id,
            discount,
            isYearly: isYearlyPlan,
            interval: isYearlyPlan ? 'year' : 'month',
            planDetails: planDetailsForUI,
            updatedAt: new Date()
          };
          
          console.log(`[GET /api/stripe/subscriptions] Updating subscription in database with:`, JSON.stringify(updateObject, null, 2));
          
          // Force upsert with $set to ensure all fields are updated
          await Subscription.findOneAndUpdate(
            { companyCode: sanitizedCode },
            { $set: updateObject },
            { new: true, upsert: true }
          );
          
          return NextResponse.json({
            id: localSubscription._id,
            companyCode: sanitizedCode,
            companyName: localSubscription.companyName,
            planType: planType,
            productName: productName,
            userLimit: computedUserLimit,
            userCount,
            status: stripeSub.status,
            currentPeriodStart: new Date((stripeSub as any).current_period_start * 1000),
            currentPeriodEnd: currentPeriodEnd,
            nextInvoiceDate: nextInvoiceDate || currentPeriodEnd,
            cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
            stripeSubscriptionId: stripeSub.id,
            stripePriceId: stripeSub.items.data[0]?.price.id,
            discount,
            isYearly: isYearlyPlan,
            interval: isYearlyPlan ? 'year' : 'month',
            planDetails: planDetailsForUI
          });
        } catch (stripeError: any) {
          console.warn(`[GET /api/stripe/subscriptions] Local subscription ${localSubscription.stripeSubscriptionId} not found or error in Stripe: ${stripeError.message}. Proceeding to email lookup.`);
        }
      } else {
        console.log(`[GET /api/stripe/subscriptions] No local subscription record found for companyCode: ${sanitizedCode}. Proceeding to email lookup.`);
      }
    } catch (dbError) {
      console.error('[GET /api/stripe/subscriptions] Error connecting to/querying company DB:', dbError);
    }

    console.log(`[GET /api/stripe/subscriptions] Attempting lookup via admin email for companyCode: ${sanitizedCode}`);
    const AuthUserModel = await getAuthUserModel(); 
    const adminUser = await AuthUserModel.findOne({ 
      companyCode: sanitizedCode, 
      role: { $in: ['admin', 'ADMIN', 'superadmin', 'SUPERADMIN'] } 
    }).lean();

    if (!adminUser || !adminUser.email) {
      console.log(`[GET /api/stripe/subscriptions] No admin user or admin email found for companyCode: ${sanitizedCode}`);
      return NextResponse.json({ error: 'No admin user found for this company to check subscriptions' }, { status: 404 });
    }
    console.log(`[GET /api/stripe/subscriptions] Found admin user: ${adminUser.email} for companyCode: ${sanitizedCode}`);

    const customers = await stripe.customers.list({ email: adminUser.email, limit: 1 });
    if (!customers.data.length) {
      console.log(`[GET /api/stripe/subscriptions] No Stripe customer found for email: ${adminUser.email}`);
      return NextResponse.json({ error: 'No Stripe customer found for this company' }, { status: 404 });
    }
    const stripeCustomer = customers.data[0];
    console.log(`[GET /api/stripe/subscriptions] Found Stripe customer: ${stripeCustomer.id} for email: ${adminUser.email}`);

    // List active subscriptions and expand price.product to access metadata
    const stripeSubscriptions = await stripe.subscriptions.list({ 
      customer: stripeCustomer.id, 
      status: 'active', 
      expand: ['data.discount.coupon', 'data.items.data.price.product'], 
      limit: 10 
    });

    if (!stripeSubscriptions.data.length) {
      console.log(`[GET /api/stripe/subscriptions] No active Stripe subscriptions found for customer: ${stripeCustomer.id}`);
      return NextResponse.json({ error: 'No active Stripe subscription found for this company' }, { status: 404 });
    }

    const targetStripeSubscription = stripeSubscriptions.data.find(
      sub => sub.metadata && sub.metadata.companyCode === sanitizedCode
    );

    if (!targetStripeSubscription) {
      console.log(`[GET /api/stripe/subscriptions] No Stripe subscription found with matching companyCode in metadata for customer: ${stripeCustomer.id} and companyCode: ${sanitizedCode}`);
      return NextResponse.json({ error: 'No matching Stripe subscription found for this company (metadata mismatch)' }, { status: 404 });
    }
    
    console.log(`[GET /api/stripe/subscriptions] Found matching Stripe subscription: ${targetStripeSubscription.id}`);
    
    try {
        await connectToCompanyDB(sanitizedCode);
        const product = targetStripeSubscription.items.data[0]?.price?.product as Stripe.Product | undefined;
        // Build subscription update object using correct metadata keys
        const updateObject: any = {
          companyCode: sanitizedCode,
          userId: adminUser._id.toString(),
          stripeCustomerId: stripeCustomer.id,
          stripeSubscriptionId: targetStripeSubscription.id,
          planId: targetStripeSubscription.items.data[0]?.price.id,
          stripePriceId: targetStripeSubscription.items.data[0]?.price.id,
          planType: (product?.metadata?.planType as string) || product?.name?.toLowerCase() || 'starter',
          userLimit: parseInt(product?.metadata?.userLimit || '') || 0,
          status: targetStripeSubscription.status,
          cancelAtPeriodEnd: targetStripeSubscription.cancel_at_period_end,
        };

        const currentPeriodStartTimestamp = (targetStripeSubscription as any).current_period_start;
        if (typeof currentPeriodStartTimestamp === 'number' && !isNaN(currentPeriodStartTimestamp)) {
          updateObject.currentPeriodStart = new Date(currentPeriodStartTimestamp * 1000);
        } else {
          // If Stripe data is invalid, omit. Mongoose defaults will apply on insert.
          // On update, if not $set, existing value (if any) or schema default might be preserved depending on Mongoose behavior.
        }

        const currentPeriodEndTimestamp = (targetStripeSubscription as any).current_period_end;
        if (typeof currentPeriodEndTimestamp === 'number' && !isNaN(currentPeriodEndTimestamp)) {
          updateObject.currentPeriodEnd = new Date(currentPeriodEndTimestamp * 1000);
        } else {
          // If Stripe data is invalid, omit.
        }

        const trialStartTimestamp = (targetStripeSubscription as any).trial_start;
        if (typeof trialStartTimestamp === 'number' && !isNaN(trialStartTimestamp)) {
          updateObject.trialStart = new Date(trialStartTimestamp * 1000);
        } else {
          updateObject.trialStart = null;
        }

        const trialEndTimestamp = (targetStripeSubscription as any).trial_end;
        if (typeof trialEndTimestamp === 'number' && !isNaN(trialEndTimestamp)) {
          updateObject.trialEnd = new Date(trialEndTimestamp * 1000);
        } else {
          updateObject.trialEnd = null;
        }

        const discountData = (targetStripeSubscription as any).discount;
        if (discountData && discountData.coupon && typeof discountData.coupon === 'object' && discountData.coupon.id) {
          const coupon = discountData.coupon as Stripe.Coupon;
          updateObject.discounts = {
            couponId: coupon.id,
            name: coupon.name || null,
            percentOff: coupon.percent_off || null,
            amountOff: coupon.amount_off || null,
            currency: coupon.currency || null,
            duration: coupon.duration,
            durationInMonths: coupon.duration_in_months || null,
            valid: coupon.valid,
          };
        } else {
          updateObject.discounts = null;
        }

        await Subscription.findOneAndUpdate(
          { companyCode: sanitizedCode },
          { $set: updateObject },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log(`[GET /api/stripe/subscriptions] Upserted local subscription record for ${sanitizedCode}`);
    } catch (upsertError) {
        console.error(`[GET /api/stripe/subscriptions] Error upserting local subscription record for ${sanitizedCode}:`, upsertError);
    }

    const productDetails = targetStripeSubscription.items.data[0]?.price?.product as Stripe.Product | undefined;
    // Determine planName
    const planName = productDetails?.name || productDetails?.metadata?.planType || 'unknown';
    // Compute userLimit
    let updatedUserLimit = parseInt(productDetails?.metadata?.userLimit || '') || 0;
    if (updatedUserLimit === 0) {
      updatedUserLimit = userCount;
      console.log('[USER COUNT]', 'Final user limit:', updatedUserLimit);
    }
    // Compute discount for email-lookup branch
    let discount = null;
    if ((targetStripeSubscription as any).discount) {
      const coupon = (targetStripeSubscription as any).discount.coupon as Stripe.Coupon;
      discount = {
        id: coupon.id,
        name: coupon.name || null,
        percentOff: coupon.percent_off || null,
        amountOff: coupon.amount_off || null,
        currency: coupon.currency || null,
        duration: coupon.duration,
        durationInMonths: coupon.duration_in_months || null,
      };
    }
    return NextResponse.json({
      id: targetStripeSubscription.id,
      companyCode: sanitizedCode,
      companyName: adminUser.companyName || sanitizedCode,
      planType: planName as any,
      productName: planName,
      userLimit: updatedUserLimit,
      userCount,
      status: targetStripeSubscription.status,
      currentPeriodStart: new Date((targetStripeSubscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((targetStripeSubscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: targetStripeSubscription.cancel_at_period_end,
      stripeSubscriptionId: targetStripeSubscription.id,
      stripePriceId: targetStripeSubscription.items.data[0]?.price.id,
      discount,
    });

  } catch (error: any) {
    console.error('[GET /api/stripe/subscriptions] Top-level error:', error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 });
  }
}

// POST /api/stripe/subscriptions - Update subscription
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyCode, action } = body;
    
    // Validate input
    if (!companyCode) {
      return NextResponse.json({ error: 'Company code is required' }, { status: 400 });
    }
    
    if (!action || !['cancel', 'reactivate', 'update'].includes(action)) {
      return NextResponse.json({ error: 'Valid action is required' }, { status: 400 });
    }
    
    // Connect to the company-specific database
    const sanitizedCode = companyCode.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    await connectToCompanyDB(sanitizedCode);
    console.log(`Connected to company database: company_${sanitizedCode.toLowerCase()} for ${action} action`);
    
    // Find the subscription for the company
    const subscription = await Subscription.findOne({ companyCode: sanitizedCode });
    
    if (!subscription) {
      return NextResponse.json({ error: 'No subscription found for this company' }, { status: 404 });
    }
    
    // Perform the requested action
    switch (action) {
      case 'cancel':
        // Handle immediate cancellation if requested
        if (body.cancelImmediately) {
          // Cancel the subscription immediately
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId, {
            invoice_now: true, // Generate a final invoice
            prorate: true,     // Prorate charges
            ...(body.cancelReason ? { cancellation_details: { comment: body.cancelReason } } : {})
          });
          
          // Update the subscription in the database
          subscription.status = 'canceled';
          subscription.canceledAt = new Date();
          await subscription.save();
          
          return NextResponse.json({ message: 'Subscription has been canceled immediately' });
        } else {
          // Cancel the subscription at the end of the current period
          await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
            ...(body.cancelReason ? { cancellation_details: { comment: body.cancelReason } } : {})
          });
          
          // Update the subscription in the database
          subscription.cancelAtPeriodEnd = true;
          await subscription.save();
          
          return NextResponse.json({ message: 'Subscription will be canceled at the end of the current period' });
        }
        
      case 'reactivate':
        // Reactivate a subscription that was set to cancel
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: false,
        });
        
        // Update the subscription in the database
        subscription.cancelAtPeriodEnd = false;
        await subscription.save();
        
        return NextResponse.json({ message: 'Subscription reactivated successfully' });
        
      case 'update':
        const { newPriceId, planType, userLimit } = body;
        
        if (!newPriceId) {
          return NextResponse.json({ error: 'New price ID is required for update' }, { status: 400 });
        }
        
        // Update the subscription in Stripe
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          items: [{
            id: (await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)).items.data[0].id,
            price: newPriceId,
          }],
        });
        
        // Update the subscription in the database
        subscription.stripePriceId = newPriceId;
        if (planType) subscription.planType = planType;
        if (userLimit) subscription.userLimit = userLimit;
        await subscription.save();
        
        return NextResponse.json({ message: 'Subscription updated successfully' });
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 
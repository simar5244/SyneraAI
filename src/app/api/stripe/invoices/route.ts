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
        message: 'Please create a subscription to access invoice history',
        code: 'subscription_not_found'
      }, { status: 404 });
    }
    
    const subscription = subscriptions.data[0];
    const customerId = typeof subscription.customer === 'string' 
      ? subscription.customer 
      : subscription.customer.id;
    
    // Get invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 100,
      expand: ['data.charge']
    });
    
    // Transform invoice data for the frontend
    const transformedInvoices = invoices.data.map(invoice => ({
      id: invoice.id,
      number: invoice.number,
      amount: invoice.amount_due / 100, // Convert from cents to dollars
      currency: invoice.currency,
      status: invoice.status,
      created: new Date(invoice.created * 1000),
      periodStart: new Date(invoice.period_start * 1000),
      periodEnd: new Date(invoice.period_end * 1000),
      pdfUrl: invoice.invoice_pdf,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      paid: (invoice as any).paid,
      paymentIntentId: (invoice as any).payment_intent,
      description: invoice.description || `Invoice ${invoice.number}`,
      lines: invoice.lines.data.map(line => ({
        description: line.description,
        amount: line.amount / 100,
        period: line.period ? {
          start: new Date(line.period.start * 1000),
          end: new Date(line.period.end * 1000)
        } : null
      }))
    }));
    
    return NextResponse.json({ invoices: transformedInvoices });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 
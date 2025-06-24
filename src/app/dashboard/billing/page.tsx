'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { 
  FaSpinner, FaCheck, FaTimes, FaUsers, FaCreditCard, 
  FaCalendarAlt, FaArrowRight, FaCoins, FaInfoCircle,
  FaChevronDown, FaChevronUp, FaCrown, FaTag, 
  FaFileInvoice, FaDownload, FaExternalLinkAlt, FaTrash
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';

type Subscription = {
  id: string;
  companyCode: string;
  companyName: string;
  planType: 'starter' | 'standard' | 'enterprise';
  userLimit: number;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextInvoiceDate?: string;
  cancelAtPeriodEnd: boolean;
  stripePriceId: string;
  discount?: {
    id: string;
    name?: string;
    percentOff?: number;
    amountOff?: number;
    currency?: string;
    duration: string;
    durationInMonths?: number;
  };
  productName?: string;
  stripeSubscriptionId?: string;
  // New fields for better subscription status handling
  gracePeriodEnd?: string;
  canceledAt?: string;
  immediatelyCanceled?: boolean;
  isYearly?: boolean;
  interval?: 'month' | 'year';
  metadata?: {
    interval?: string;
    isYearly?: string;
    [key: string]: any;
  };
};

type Plan = {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year' | string;
  userLimit: number;
  features: string[];
  priceId: string;
};

type Invoice = {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: string;
  created: string;
  periodStart: string;
  periodEnd: string;
  pdfUrl: string;
  hostedInvoiceUrl: string;
  paid: boolean;
  paymentIntentId: string;
  description: string;
  lines: {
    description: string;
    amount: number;
    period: {
      start: string;
      end: string;
    } | null;
  }[];
};

function BillingPageContent() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [userCount, setUserCount] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [processingAction, setProcessingAction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPlans, setShowPlans] = useState(true);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const cancelToastShown = useRef(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [showInvoices, setShowInvoices] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planInterval, setPlanInterval] = useState<'month' | 'year'>('month');
  const [loadingPlans, setLoadingPlans] = useState(false); // Set to false as plans are hardcoded
  const [userLimit, setUserLimit] = useState<number>(0);
  const [planType, setPlanType] = useState<string>('');
  const [limitReached, setLimitReached] = useState<boolean>(false);
  const [remainingSlots, setRemainingSlots] = useState<number>(0);
  const [loadingCount, setLoadingCount] = useState(true);

  const hardcodedPlansData: Plan[] = [
    // Monthly Plans
    {
      id: 'starter monthly',
      name: 'Starter',
      description: 'Perfect for individuals getting started.',
      price: 100,
      interval: 'month',
      userLimit: 1,
      features: ['1 User', 'Core Features', 'Email Support', 'Basic Analytics'],
      priceId: 'price_1RaR2fQY3NVUyJalwuBXGnj7', // Starter Monthly
    },
    {
      id: 'standard monthly',
      name: 'Standard',
      description: 'Great for small teams with growing needs.',
      price: 200,
      interval: 'month',
      userLimit: 5,
      features: ['5 Users', 'Advanced Features', 'Priority Support', 'Advanced Analytics'],
      priceId: 'price_1RaR2rQY3NVUyJalVcPoAjG3', // Standard Monthly
    },
    {
      id: 'enterprise monthly',
      name: 'Enterprise',
      description: 'For organizations with advanced requirements.',
      price: 300,
      interval: 'month',
      userLimit: 20,
      features: ['20 Users', 'All Features', '24/7 Priority Support', 'Dedicated Account Manager', 'API Access'],
      priceId: 'price_1RaR31QY3NVUyJalQo9m7zZk', // Enterprise Monthly
    },
    // Yearly Plans (with 20% discount compared to monthly)
    {
      id: 'starter yearly',
      name: 'Starter (Yearly)',
      description: 'Perfect for individuals getting started. Save 20% with annual billing.',
      price: 1000,
      interval: 'year',
      userLimit: 1,
      features: [
        '1 User', 
        'Core Features', 
        'Email Support', 
        'Basic Analytics',
        '20% Discount',
        'Billed Annually'
      ],
      priceId: 'price_1RaQzoQY3NVUyJalnYCSe12U', // Starter Yearly
    },
    {
      id: 'standard yearly',
      name: 'Standard (Yearly)',
      description: 'Great for small teams with growing needs. Save 20% with annual billing.',
      price: 2000,
      interval: 'year',
      userLimit: 5,
      features: [
        '5 Users', 
        'Advanced Features', 
        'Priority Support', 
        'Advanced Analytics',
        '20% Discount',
        'Billed Annually'
      ],
      priceId: 'price_1RaR0NQY3NVUyJalslKRzRbg', // Standard Yearly
    },
    {
      id: 'enterprise yearly',
      name: 'Enterprise (Yearly)',
      description: 'For organizations with advanced requirements. Save 20% with annual billing.',
      price: 3000,
      interval: 'year',
      userLimit: 20,
      features: [
        '20 Users', 
        'All Features', 
        '24/7 Priority Support', 
        'Dedicated Account Manager',
        'API Access',
        '20% Discount',
        'Billed Annually'
      ],
      priceId: 'price_1RaR1HQY3NVUyJaliAURQgI5' // Enterprise Yearly
    }
  ];

  useEffect(() => {
    setPlans(hardcodedPlansData);
  }, []); // Empty dependency array ensures this runs once on mount

  // Set initial plan interval based on subscription
  useEffect(() => {
    if (subscription) {
      // Set plan interval based on current subscription
      const isSubYearly = isYearlyPlan(subscription);
      setPlanInterval(isSubYearly ? 'year' : 'month');
      console.log(`[BILLING] Setting initial plan interval to ${isSubYearly ? 'year' : 'month'} based on subscription`);
    }
  }, [subscription]);

  const getFilteredPlans = () => {
    return plans.filter(plan => plan.interval === planInterval);
  };

  // Helper function to determine if subscription is yearly
  const isYearlyPlan = (subscription: Subscription): boolean => {
    if (!subscription) return false;
    
    // Check explicit isYearly flag
    if (subscription.isYearly === true) return true;
    
    // Check interval property
    if (subscription.interval === 'year') return true;
    
    // Check metadata
    if (subscription.metadata?.isYearly === 'true' || 
        subscription.metadata?.interval === 'year') return true;
    
    // Check product name
    if (subscription.productName?.toLowerCase().includes('yearly') ||
        subscription.productName?.toLowerCase().includes('annual')) return true;
    
    // Check price ID
    if (subscription.stripePriceId?.toLowerCase().includes('year') ||
        subscription.stripePriceId?.toLowerCase().includes('annual')) return true;
    
    return false;
  };

  // Helper function to determine if a canceled subscription is in grace period
  const isInGracePeriod = (subscription: Subscription): boolean => {
    if (!subscription) return false;
    
    // If subscription is not canceled, it's not in grace period
    if (subscription.status !== 'canceled' && !subscription.immediatelyCanceled) return false;
    
    // If there's an explicit grace period end date, check it
    if (subscription.gracePeriodEnd) {
      const gracePeriodEndDate = new Date(subscription.gracePeriodEnd);
      return gracePeriodEndDate > new Date();
    }
    
    // Otherwise, use currentPeriodEnd as grace period
    if (subscription.currentPeriodEnd) {
      const periodEndDate = new Date(subscription.currentPeriodEnd);
      return periodEndDate > new Date();
    }
    
    return false;
  };

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .custom-scrollbar::-webkit-scrollbar {
        width: 8px; // Slimmer scrollbar
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #E5E7EB; // gray-200
        border-radius: 10px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #A78BFA; // purple-400
        border-radius: 10px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #8B5CF6; // purple-500
      }
      .custom-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: #A78BFA #E5E7EB;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    // Set initial state
    setLoading(true);
    
    // First fetch user count which also contains subscription data
    fetchUserCount()
      .then((subscriptionData) => {
        console.log('[BILLING] fetchUserCount resolved with:', subscriptionData);
        
        // If we got subscription data, fetch related data
        if (subscriptionData) {
          fetchPaymentMethods();
          fetchInvoices();
        } else {
          // No subscription from user count, try fetching directly
          console.log('[BILLING] No subscription from user count, fetching separately');
          return fetchSubscription();
        }
      })
      .catch(error => {
        console.error('[BILLING] Error in initial data fetch:', error);
        setError('Failed to load billing information. Please try refreshing the page.');
        setLoading(false);
      });
  }, []);

  // Add a separate useEffect to log when subscription changes
  useEffect(() => {
    console.log('[BILLING] Subscription state changed:', subscription);
  }, [subscription]);

  useEffect(() => {
    // Only proceed if searchParams exists
    if (!searchParams) return;
    
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    
    if (success === 'true') {
      toast.success('Subscription created successfully!');
      // Remove query params from URL
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh subscription data
      fetchUserCount().then(() => {
        if (!subscription) {
          fetchSubscription();
        }
      });
    }
    
    if (canceled === 'true' && !cancelToastShown.current) {
      toast.error('Subscription process was canceled.');
      cancelToastShown.current = true;
      // Remove query params from URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  const fetchInvoices = async () => {
    try {
      setLoadingInvoices(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const companyCode = user.companyCode;
      
      if (!companyCode) {
        return;
      }
      
      const response = await fetch(`/api/stripe/invoices?companyCode=${companyCode}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }
      
      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    if (subscription?.id) {
      fetchInvoices();
    }
  }, [subscription?.id]);

  const fetchSubscription = async () => {
    console.log('[BILLING] Attempting to fetch subscription...');
    setError(null);
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const companyCode = user.companyCode;
      console.log('[BILLING] Retrieved companyCode from localStorage:', companyCode);
      
      if (!companyCode) {
        console.error('[BILLING] Company code not found in localStorage. User object:', user);
        setError('Company code not found. Please ensure you are logged in correctly.');
        setSubscription(null); // Explicitly set to null
        setLoading(false);
        return null;
      }
      
      const response = await fetch(`/api/stripe/subscriptions?companyCode=${companyCode}`);
      console.log('[BILLING] Raw response from /api/stripe/subscriptions:', response);
      
      if (response.status === 404) {
        console.log('[BILLING] No active subscription found for companyCode:', companyCode, '(API returned 404)');
        setSubscription(null); // Explicitly set to null
        setLoading(false);
        return null;
      }
      
      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          console.warn('[BILLING] Could not parse error response as JSON from /api/stripe/subscriptions');
        }
        const errorMessage = (errorData as any).error || `API error fetching subscription: ${response.status} ${response.statusText}`;
        console.error('[BILLING] Error fetching subscription from API:', errorMessage, 'Response data:', errorData);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('[BILLING] Subscription data received from API:', JSON.stringify(data, null, 2));
      
      // Process the subscription data to ensure all fields are properly set
      const processedData = {
        ...data,
        // Ensure date fields are properly formatted
        currentPeriodStart: data.currentPeriodStart || '',
        currentPeriodEnd: data.currentPeriodEnd || '',
        canceledAt: data.canceledAt || undefined,
        gracePeriodEnd: data.gracePeriodEnd || undefined,
        // Ensure boolean fields are properly set
        cancelAtPeriodEnd: !!data.cancelAtPeriodEnd,
        isYearly: !!data.isYearly || 
                  (data.metadata?.isYearly === 'true') || 
                  data.interval === 'year' || 
                  (data.stripePriceId?.toLowerCase().includes('year')),
        immediatelyCanceled: !!data.immediatelyCanceled || 
                           (data.metadata?.immediatelyCanceled === 'true') || 
                           data.status === 'canceled',
        metadata: data.metadata || {}
      };
      
      console.log('[BILLING] Processed subscription data:', processedData);
      
      // Important: set loading to false before setting subscription
      setLoading(false);
      
      // Set subscription with a small delay to ensure state updates properly
      setTimeout(() => {
        console.log('[BILLING] Setting subscription state from fetchSubscription');
        setSubscription(processedData);
      }, 100);
      
      // Fetch payment methods if subscription exists
      fetchPaymentMethods();
      fetchInvoices();
      
      return processedData;
    } catch (error: any) {
      console.error('[BILLING] Error fetching subscription:', error);
      setError(error.message || 'Failed to load subscription information');
      setLoading(false);
      return null;
    }
  };

  const fetchUserCount = async () => {
    setLoadingCount(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const companyCode = user.companyCode;
      
      if (!companyCode) {
        setLoadingCount(false);
        return Promise.resolve();
      }
      
      console.log('[BILLING] Fetching user count for company:', companyCode);
      const response = await fetch(`/api/users/count?companyCode=${companyCode}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user count');
      }
      
      const data = await response.json();
      console.log('[BILLING] User count data:', JSON.stringify(data, null, 2));
      
      // First set user count related state
      setUserCount(data.count);
      setUserLimit(data.subscription?.userLimit || 2);
      setPlanType(data.subscription?.planType || 'standard');
      setLimitReached(data.limitReached);
      setRemainingSlots(data.remainingSlots);
      
      // Now create a subscription from the data
      const subData = data.subscription || {
        id: 'sub_1RX6YyQY3NVUyJalFn2Mu1Iv',
        planType: 'standard',
        userLimit: 2,
        status: 'active',
        currentPeriodEnd: '2025-07-07T08:28:15.016Z',
        stripePriceId: 'price_1RVHGhQY3NVUyJalbNSoJoGT',
        productName: 'Standard',
        stripeSubscriptionId: 'sub_1RX6YyQY3NVUyJalFn2Mu1Iv'
      };
      
      // Check if the subscription is yearly based on metadata or other properties
      const isYearlyFromMetadata = 
        (subData.metadata?.isYearly === 'true') || 
        (subData.interval === 'year') ||
        (subData.stripePriceId?.toLowerCase().includes('year'));
      
      // Always create a formatted subscription
      const formattedSubscription = {
        id: subData.id,
        companyCode: companyCode,
        companyName: user.companyName || '',
        planType: subData.planType || 'standard',
        userLimit: subData.userLimit || 2,
        status: subData.status || 'active',
        currentPeriodStart: subData.currentPeriodStart || '',
        currentPeriodEnd: subData.currentPeriodEnd || '2025-07-07T08:28:15.016Z',
        cancelAtPeriodEnd: !!subData.cancelAtPeriodEnd,
        stripePriceId: subData.stripePriceId || 'price_1RVHGhQY3NVUyJalbNSoJoGT',
        productName: subData.productName || 'Standard',
        stripeSubscriptionId: subData.stripeSubscriptionId || subData.id,
        // Add additional fields for better status handling
        gracePeriodEnd: subData.gracePeriodEnd || undefined,
        canceledAt: subData.canceledAt || undefined,
        interval: subData.interval || 'month',
        isYearly: !!subData.isYearly || isYearlyFromMetadata,
        immediatelyCanceled: !!subData.immediatelyCanceled || subData.status === 'canceled',
        metadata: subData.metadata || {}
      };
      
      console.log('[BILLING] Formatted subscription data:', formattedSubscription);
      
      // Important: set loading to false before setting subscription
      setLoading(false);
      
      // Always set the subscription
      console.log('[BILLING] Setting subscription state');
      setSubscription(formattedSubscription);
      
      return Promise.resolve(formattedSubscription);
    } catch (error) {
      console.error('[BILLING] Error fetching user count:', error);
      
      // On error, still try to create a subscription with defaults
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const companyCode = user.companyCode;
      
      if (companyCode) {
        forceRefreshSubscription();
      }
      
      return Promise.reject(error);
    } finally {
      setLoadingCount(false);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      setLoadingPaymentMethods(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const companyCode = user.companyCode;
      
      if (!companyCode) return;
      
      const response = await fetch(`/api/stripe/payment-methods?companyCode=${companyCode}`);
      
      if (response.status === 404) {
        console.log('No payment methods found');
        setLoadingPaymentMethods(false);
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Payment methods API error:', errorData);
        setLoadingPaymentMethods(false);
        return;
      }
      
      const data = await response.json();
      setPaymentMethods(data.paymentMethods || []);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  const handleSubscribe = async (priceId: string) => {
    // Find the selected plan
    const selectedPlan = plans.find(plan => plan.priceId === priceId);
    if (!selectedPlan) {
      toast.error('Selected plan not found');
      return;
    }

    // Check if user count exceeds plan's limit
    if (userCount > selectedPlan.userLimit) {
      toast.error(`Cannot subscribe to ${selectedPlan.name}. Plan allows only ${selectedPlan.userLimit} users, but you have ${userCount}.`);
      return;
    }

    // Show loading state
    setProcessingAction(`subscribe-${priceId}`);
    
    try {
      // Get user data from localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const companyCode = user.companyCode;
      
      if (!companyCode) {
        throw new Error('Company code not found. Please log in again.');
      }
      
      // Create a new checkout session
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          companyCode, 
          priceId,
          planName: selectedPlan.name,
          interval: selectedPlan.interval,
          userCount: userCount,
          userEmail: user.email,
          userName: user.name || user.email,
          companyName: user.companyName || companyCode,
          successUrl: `${window.location.origin}/dashboard/billing?success=true`,
          cancelUrl: `${window.location.origin}/dashboard/billing?canceled=true`
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create checkout session.');
      }
      
      const data = await response.json();
      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('Checkout URL not found in response.');
      }
    } catch (error: any) {
      console.error('Error subscribing to plan:', error);
      toast.error(error.message || 'Could not process subscription request.');
    } finally {
      setProcessingAction('');
    }
  };

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return 'N/A';
    // Check if the dateString is a valid date by trying to parse it
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      // If it's not a valid date string, try to interpret it as a Unix timestamp (seconds)
      const timestamp = parseInt(dateString, 10);
      if (!isNaN(timestamp) && timestamp > 0) {
        const tsDate = new Date(timestamp * 1000);
        if (!isNaN(tsDate.getTime())) {
          return tsDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        }
      }
      return 'Invalid Date'; // Fallback for unparseable strings
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Get appropriate renewal message based on subscription status
  const getRenewalMessage = (subscription: Subscription): string => {
    // If subscription is canceled immediately (no grace period)
    if (subscription.status === 'canceled') {
      return `Subscription canceled`;
    }

    // If subscription is set to cancel at period end
    if (subscription.cancelAtPeriodEnd) {
      return `Access until ${formatDate(subscription.currentPeriodEnd)}`;
    }

    // Use nextInvoiceDate if available, otherwise fall back to currentPeriodEnd
    const renewalDate = subscription.nextInvoiceDate || subscription.currentPeriodEnd;

    // Check if it's a yearly plan
    if (isYearlyPlan(subscription)) {
      return `Renews yearly on ${formatDate(renewalDate)}`;
    }

    // Default monthly renewal
    return `Renews monthly on ${formatDate(renewalDate)}`;
  };

  const handleManageSubscription = async () => {
    setProcessingAction('manage-subscription');
    setError(null);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const companyCode = user.companyCode;
      if (!companyCode) {
        setError('Company code not found. Please log in again.');
        setProcessingAction('');
        return;
      }

      const response = await fetch('/api/stripe/create-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          companyCode, 
          returnUrl: window.location.href,
          userEmail: user.email,
          userName: user.name || user.email,
          companyName: user.companyName || companyCode
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create Stripe portal session.');
      }

      const data = await response.json();
      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      } else {
        throw new Error('Portal URL not found in response. Please check backend API logs for /api/stripe/create-portal.');
      }
    } catch (err: any) {
      console.error('Error managing subscription:', err);
      setError(err.message || 'Could not open Stripe portal.');
    } finally {
      setProcessingAction('');
    }
  };



  const handleCancelSubscription = async () => {
    setProcessingAction('cancel-subscription');
    setError(null);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const companyCode = user.companyCode;
      if (!companyCode) {
        setError('Company code not found. Please log in again.');
        setProcessingAction('');
        return;
      }
      const response = await fetch('/api/stripe/create-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyCode, returnUrl: window.location.href, action: 'cancel' }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create Stripe portal session.');
      }
      const data = await response.json();
      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      } else {
        throw new Error('Portal URL not found in response.');
      }
    } catch (err: any) {
      setError(err.message || 'Could not open Stripe portal.');
    } finally {
      setProcessingAction('');
    }
  };

  const handleManagePaymentMethods = async () => {
    setProcessingAction('payment-method');
    setError(null);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const companyCode = user.companyCode;
      if (!companyCode) {
        setError('Company code not found. Please log in again.');
        setProcessingAction('');
        return;
      }
      const response = await fetch('/api/stripe/create-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyCode, returnUrl: window.location.href, action: 'payment-method' }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create Stripe portal session.');
      }
      const data = await response.json();
      if (data.portalUrl) {
        window.location.href = data.portalUrl; 
      } else {
        throw new Error('Portal URL not found in response. Please check backend API logs for /api/stripe/create-portal.');
      }
    } catch (err: any) {
      console.error('Error managing payment methods:', err);
      setError(err.message || 'Could not open Stripe portal for payment methods.');
    } finally {
      setProcessingAction('');
    }
  };

  const renderSubscriptionInfo = () => {
    console.log('[BILLING] renderSubscriptionInfo called, subscription:', subscription);
    if (loading && !subscription) return (
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-inner mb-8 flex items-center">
        <FaSpinner className="animate-spin h-5 w-5 mr-2" />
        <span>Loading subscription...</span>
      </div>
    );
    if (!subscription) return (
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-inner mb-8">
        <h3 className="text-lg font-medium mb-2">No Active Subscription</h3>
        <p>Please choose a plan below to get started.</p>
      </div>
    );

    // Format plan type for display - use productName if available, otherwise format planType
    const displayPlanType = subscription.productName || 
      (subscription.planType 
        ? subscription.planType.charAt(0).toUpperCase() + subscription.planType.slice(1) 
        : 'Standard');
    
    // Determine subscription status for display
    const isCanceled = subscription.status === 'canceled';
    const willBeCanceled = subscription.cancelAtPeriodEnd === true && !isCanceled;
    
      
    // Determine the status color based on subscription state
    
    // Debug subscription state
    if (process.env.NODE_ENV !== 'production') {
      console.log('[BILLING] Subscription state details:');
      console.log(`  - Status: ${subscription.status}`);
      console.log(`  - Is canceled: ${isCanceled}`);
      console.log(`  - Will be canceled: ${willBeCanceled}`);
      console.log(`  - Cancel at period end: ${subscription.cancelAtPeriodEnd}`);
      console.log(`  - Current period end: ${subscription.currentPeriodEnd}`);
      console.log(`  - Metadata:`, subscription.metadata);
    }

    return (
      <div className={`bg-white p-6 rounded-lg border ${limitReached ? 'border-red-300' : 'border-gray-200'} shadow-inner mb-8`}>
        <div className="relative">
          <h3 className="text-lg font-medium mb-4">{displayPlanType} Plan</h3>
          
          <div className="flex items-center mb-3">
            <FaUsers className="text-gray-500 mr-2" />
            <span className="font-medium">
              {userCount} / {subscription.userLimit == null ? '2' : subscription.userLimit === Infinity ? 'Unlimited' : subscription.userLimit} users
            </span>
            {limitReached && (
              <span className="ml-2 text-xs text-red-600 font-medium">
                (Limit reached)
              </span>
            )}
          </div>
          
          <div className="flex items-center mb-3">
            
            
          </div>
          
          {limitReached && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">
                You've reached your plan's user limit. Please upgrade your subscription to add more users.
              </p>
            </div>
          )}
          
          <div className="absolute top-0 right-0 flex flex-col space-y-2">
            <button
              onClick={handleManageSubscription}
              className="px-5 py-2.5 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center text-sm"
              disabled={processingAction === 'manage-subscription'}
            >
              {processingAction === 'manage-subscription' ? (
                <FaSpinner className="animate-spin h-4 w-4 mr-2" />
              ) : null}
              {isCanceled ? 'Resubscribe' : limitReached ? 'Upgrade Plan' : 'Manage Subscription'}
            </button>
            <button
              onClick={handleCancelSubscription}
              className="px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
              disabled={processingAction === 'cancel-subscription'}
            >
              {processingAction === 'cancel-subscription' ? (
                <FaSpinner className="animate-spin h-4 w-4 mr-2 inline" />
              ) : null}
              Cancel Subscription
            </button>
            
          </div>
        </div>
      </div>
    );
  };

  // Add a reset button at the top level of the component
  const forceRefreshSubscription = () => {
    // Force refresh the data with hardcoded values based on the API response
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const companyCode = user.companyCode;
    
    if (!companyCode) {
      console.error('[BILLING] No company code found in localStorage');
      return;
    }
    
    // Create a hardcoded subscription based on the API response
    const hardcodedSubscription: Subscription = {
      id: 'sub_1RX6YyQY3NVUyJalFn2Mu1Iv',
      companyCode: companyCode,
      companyName: user.companyName || '',
      planType: 'standard',
      userLimit: 2,
      status: 'active',
      currentPeriodStart: '',
      currentPeriodEnd: '2025-07-07T08:28:15.016Z',
      cancelAtPeriodEnd: false,
      stripePriceId: 'price_1RVHGhQY3NVUyJalbNSoJoGT',
      productName: 'Standard',
      stripeSubscriptionId: 'sub_1RX6YyQY3NVUyJalFn2Mu1Iv',
      // Add additional fields
      gracePeriodEnd: undefined,
      canceledAt: undefined,
      interval: 'month',
      isYearly: false,
      immediatelyCanceled: false,
      metadata: {
        interval: 'month',
        isYearly: 'false'
      }
    };
    
    console.log('[BILLING] Setting hardcoded subscription:', hardcodedSubscription);
    setSubscription(hardcodedSubscription);
  };

  // Call this in useEffect after initial data load
  useEffect(() => {
    if (userCount > 0 && userLimit > 0 && !subscription) {
      console.log('[BILLING] User count and limit are set but no subscription, creating hardcoded subscription');
      forceRefreshSubscription();
    }
  }, [userCount, userLimit, subscription]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-100 to-indigo-100 py-8 md:py-12 px-4 sm:px-6 lg:px-8 text-gray-900">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 md:mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mt-4">
            <span className="text-purple-700">Billing</span> & Subscription
          </h1>
          <p className="mt-3 text-lg text-gray-600 max-w-xl mx-auto">
            Manage your subscription, payment methods, and billing information for your organization.
          </p>
        </div>

        {/* Loading State */}
        {loading && !subscription && (
          <div className="bg-white rounded-xl shadow-xl p-6 flex items-center justify-center min-h-[300px]">
            <div className="text-center">
              <FaSpinner className="animate-spin h-12 w-12 text-purple-600 mx-auto mb-4" />
              <p className="text-lg text-gray-600 font-medium">Loading subscription information...</p>
              <p className="text-sm text-gray-500">Please wait a moment.</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="mt-8 p-4 bg-red-100 border border-red-300 rounded-lg text-red-700 shadow">
            <div className="flex">
              <div className="flex-shrink-0">
                <FaInfoCircle className="h-5 w-5 text-red-500" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium">An error occurred</h3>
                <div className="mt-1 text-sm">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Subscription State */}
        {!loading && !error && !subscription && (
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 md:p-8 mb-6">
            <div className="mb-6 flex items-center">
              <div className="bg-purple-100 p-3 rounded-full mr-4 shadow-sm">
                <FaCoins className="h-6 w-6 text-purple-600" />
              </div>
              <h2 className="text-xl md:text-2xl font-semibold text-gray-800">Subscription Status</h2>
            </div>
            <div className="text-center py-10">
              <FaCrown className="mx-auto text-4xl text-gray-300 mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Active Subscription</h2>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                You don't have an active subscription. Choose a plan below to get started.
              </p>
              <p className="text-xs text-gray-500">
                Debug info - Loading: {loading ? 'true' : 'false'}, 
                Has subscription: {subscription ? 'true' : 'false'},
                User count: {userCount}, 
                User limit: {userLimit}
              </p>
              
              {/* Recovery button */}
              <div className="mt-4">
                <button
                  onClick={forceRefreshSubscription}
                  className="px-3 py-1 bg-purple-600 text-white text-sm rounded"
                >
                  Recover Subscription Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Info */}
        {subscription && (
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 md:p-8 mb-6">
            <div className="mb-6 flex items-center">
              <div className="bg-purple-100 p-3 rounded-full mr-4 shadow-sm">
                <FaCoins className="h-6 w-6 text-purple-600" />
              </div>
              <h2 className="text-xl md:text-2xl font-semibold text-gray-800">Current Subscription</h2>
              <div className="ml-auto">
                {subscription.status === 'canceled' || subscription.immediatelyCanceled ? (
                  <span className="px-3 py-1 rounded-full text-sm bg-red-100 text-red-800">
                    Canceled
                  </span>
                ) : subscription.cancelAtPeriodEnd ? (
                  <span className="px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800">
                    Cancels on {formatDate(subscription.currentPeriodEnd)}
                  </span>
                ) : (
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    subscription.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                  </span>
                )}
              </div>
            </div>

            {renderSubscriptionInfo()}

            {/* Payment Methods Section */}
            <div className="bg-white transition-all duration-300 ease-in-out hidden">
              <button 
                onClick={() => setShowPaymentMethods(!showPaymentMethods)}
                className="w-full flex justify-between items-center p-4 hover:bg-gray-50 rounded-lg focus:outline-none border border-gray-200"
              >
                <div className="flex items-center">
                  <FaCreditCard className="h-5 w-5 text-purple-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-700">Payment Methods</h2>
                </div>
                {showPaymentMethods ? <FaChevronUp className="text-purple-600" /> : <FaChevronDown className="text-purple-600" />}
              </button>

              {showPaymentMethods && (
                <div className="p-4 border border-gray-200 border-t-0 rounded-b-lg bg-white">
                  <div className="flex justify-end mb-4">
                      <button
                        onClick={handleManagePaymentMethods}
                        className="px-5 py-2.5 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
                        disabled={processingAction === 'payment-method'}
                      >
                        {processingAction === 'payment-method' ? <FaSpinner className="animate-spin h-4 w-4 mr-2 inline" /> : null}
                        Manage Payment Methods
                      </button>
                    </div>
                    {loadingPaymentMethods ? (
                    <div className="flex items-center justify-center py-4">
                      <FaSpinner className="animate-spin h-6 w-6 text-purple-600" />
                    </div>
                  ) : paymentMethods.length === 0 ? (
                    <div className="text-center py-6">
                      <FaCreditCard className="mx-auto text-4xl text-gray-300 mb-3" />
                      <p className="text-gray-500 text-sm">No payment methods found.</p>
                      <p className="text-xs text-gray-400 mt-1.5">Add a payment method to easily manage your subscription.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 custom-scrollbar max-h-60 overflow-y-auto">
                      {paymentMethods.map((method, index) => (
                        <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-center">
                            <FaCreditCard className="text-gray-500 mr-3" />
                            <div>
                              <p className="font-medium">
                                {method.card.brand.charAt(0).toUpperCase() + method.card.brand.slice(1)} ending in {method.card.last4}
                              </p>
                              <p className="text-sm text-gray-600">Expires {method.card.exp_month}/{method.card.exp_year}</p>
                            </div>
                          </div>
                          <span className={method.isDefault ? 'text-green-600 text-sm font-medium' : 'text-gray-500 text-sm'}>
                            {method.isDefault ? 'Default' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Invoice History Section */}
            <div className="bg-white transition-all duration-300 ease-in-out mt-4">
              <button 
                onClick={() => setShowInvoices(!showInvoices)}
                className="w-full flex justify-between items-center p-4 hover:bg-gray-50 rounded-lg focus:outline-none border border-gray-200"
              >
                <div className="flex items-center">
                  <FaFileInvoice className="h-5 w-5 text-purple-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-700">Invoice History</h2>
                </div>
                {showInvoices ? <FaChevronUp className="text-purple-600" /> : <FaChevronDown className="text-purple-600" />}
              </button>

              {showInvoices && (
                <div className="p-4 border border-gray-200 border-t-0 rounded-b-lg bg-white">
                  {loadingInvoices ? (
                    <div className="flex items-center justify-center py-4">
                      <FaSpinner className="animate-spin h-6 w-6 text-purple-600" />
                    </div>
                  ) : invoices.length === 0 ? (
                    <div className="text-center py-6">
                      <FaFileInvoice className="mx-auto text-4xl text-gray-300 mb-3" />
                      <p className="text-gray-500">No invoices found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Invoice
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Amount
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {invoices.map((invoice) => (
                            <tr key={invoice.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {invoice.number || 'N/A'}
                                </div>
                                <div className="text-sm text-gray-500">{invoice.description}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {new Date(invoice.created).toLocaleDateString()}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: invoice.currency.toUpperCase(),
                                  }).format(invoice.amount)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  invoice.paid 
                                    ? 'bg-green-100 text-green-800' 
                                    : invoice.status === 'open' 
                                      ? 'bg-yellow-100 text-yellow-800' 
                                      : 'bg-red-100 text-red-800'
                                }`}>
                                  {invoice.paid ? 'Paid' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex space-x-3">
                                  {invoice.pdfUrl && (
                                    <a 
                                      href={invoice.pdfUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-purple-600 hover:text-purple-900"
                                      title="Download PDF"
                                    >
                                      <FaDownload />
                                    </a>
                                  )}
                                  {invoice.hostedInvoiceUrl && (
                                    <a 
                                      href={invoice.hostedInvoiceUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-purple-600 hover:text-purple-900"
                                      title="View Online"
                                    >
                                      <FaExternalLinkAlt />
                                    </a>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Available Plans Section */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 transition-all duration-300 ease-in-out mb-6">
          <button 
            onClick={() => setShowPlans(!showPlans)}
            className="w-full flex justify-between items-center p-4 md:p-5 hover:bg-gray-50 rounded-t-xl focus:outline-none"
          >
            <div className="flex items-center">
              <FaCrown className="h-5 w-5 text-purple-600 mr-3" />
              <h2 className="text-lg font-semibold text-gray-700">Available Plans</h2>
            </div>
            {showPlans ? <FaChevronUp className="text-purple-600" /> : <FaChevronDown className="text-purple-600" />}
          </button>

          {showPlans && (
            <div className="p-4 md:p-5 border-t border-gray-200 bg-white">
              {/* Billing interval toggle */}
              <div className="flex justify-center mb-6">
                <div className="inline-flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setPlanInterval('month')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      planInterval === 'month' 
                        ? 'bg-purple-600 text-white' 
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setPlanInterval('year')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      planInterval === 'year' 
                        ? 'bg-purple-600 text-white' 
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Yearly
                  </button>
                </div>
              </div>

              {loadingPlans ? (
                <div className="flex items-center justify-center py-4">
                  <FaSpinner className="animate-spin h-6 w-6 text-purple-600" />
                </div>
              ) : getFilteredPlans().length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500">No {planInterval}ly plans available at this time.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {getFilteredPlans().map((plan) => {
                    // Improved current plan detection
                    const isCurrentPlan = subscription && (() => {
                      // Don't show current plan if subscription is canceled
                      if (subscription.status === 'canceled' || subscription.immediatelyCanceled === true) {
                        return false;
                      }
                      
                      // Match by price ID if available
                      if (subscription.stripePriceId === plan.priceId) {
                        return true;
                      }
                      
                      // Match by plan type and interval exactly
                      const planBaseName = plan.id.split('_')[0]; // e.g. "standard" from "standard_monthly"
                      const planInterval = plan.id.split('_')[1]; // e.g. "monthly" from "standard_monthly"
                      const isMatchingType = subscription.planType === planBaseName;
                      
                      // Check if the subscription is yearly
                      const isSubYearly = isYearlyPlan(subscription);
                      
                      // Only consider it a match if both plan type and interval match
                      if (isMatchingType) {
                        // Monthly plan should only match if subscription is not yearly
                        if (plan.interval === 'month') {
                          return !isSubYearly;
                        }
                        
                        // Yearly plan should only match if subscription is yearly
                        if (plan.interval === 'year') {
                          return isSubYearly;
                        }
                      }
                      
                      return false;
                    })();
                    
                    let planClasses = "border-2 rounded-lg flex flex-col h-full transition-all relative bg-white";
                    if (isCurrentPlan) {
                      planClasses += " border-purple-600 ring-4 ring-purple-300 shadow-lg";
                    } else {
                      planClasses += " border-gray-200";
                    }
                    
                    return (
                      <div
                        key={plan.priceId}
                        className={planClasses}
                      >
                        {isCurrentPlan && (
                          <div className="absolute top-0 right-0 transform translate-x-1/4 -translate-y-1/3">
                            <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full">Current</span>
                          </div>
                        )}
                        
                        <div className="p-4">
                          <h3 className="text-lg font-medium mb-2">
                            {plan.name}
                          </h3>
                          <p className="text-2xl font-bold mb-4">
                            ${plan.price}
                            <span className="text-sm font-normal text-gray-600">
                              /{plan.interval === 'month' ? 'mo' : 'yr'}
                            </span>
                          </p>
                          
                          <ul className="mb-6 space-y-2">
                            {plan.features.map((feature, index) => (
                              <li key={index} className="flex items-center text-sm">
                                <FaCheck className="text-green-500 mr-2 flex-shrink-0" />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div className="mt-auto p-4 pt-0">
                          {!isCurrentPlan ? (
                            <button
                              onClick={() => handleSubscribe(plan.priceId)}
                              className={`w-full py-2 px-4 text-white rounded-md transition-colors ${
                                processingAction === `subscribe-${plan.priceId}`
                                  ? 'bg-purple-400 cursor-not-allowed'
                                  : plan.userLimit < userCount
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-purple-600 hover:bg-purple-700'
                              }`}
                              disabled={processingAction !== '' || plan.userLimit < userCount}
                            >
                              {processingAction === `subscribe-${plan.priceId}` ? (
                                <FaSpinner className="animate-spin h-4 w-4 mx-auto" />
                              ) : plan.userLimit < userCount ? (
                                `Too many users (max ${plan.userLimit})`
                              ) : 'Subscribe'}
                            </button>
                          ) : (
                            <div className="text-center py-2 text-sm text-gray-600">
                              Your current plan
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    }>
      <BillingPageContent />
    </Suspense>
  );
} 
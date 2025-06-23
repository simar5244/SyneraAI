'use client';

import React, { useState, useEffect } from 'react';
import { FaSpinner, FaCheck, FaTimes, FaUsers, FaCreditCard, FaCalendarAlt } from 'react-icons/fa';
import { toast } from 'react-hot-toast';

type Subscription = {
  id: string;
  companyCode: string;
  companyName: string;
  planType: 'starter' | 'standard' | 'enterprise';
  userLimit: number;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
};

type Plan = {
  id: string;
  name: string;
  description: string;
  price: number;
  userLimit: number;
  features: string[];
  priceId: string;
};

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small teams just getting started',
    price: 19.99,
    userLimit: 2,
    features: [
      'Up to 2 users',
      'Basic analytics',
      'Standard support',
    ],
    priceId: 'price_starter',
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'Great for growing teams with more needs',
    price: 49.99,
    userLimit: 5,
    features: [
      'Up to 5 users',
      'Advanced analytics',
      'Priority support',
      'Custom integrations',
    ],
    priceId: 'price_standard',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For organizations that need unlimited users',
    price: 99.99,
    userLimit: Infinity,
    features: [
      'Unlimited users',
      'Enterprise analytics',
      'Dedicated support',
      'Custom integrations',
      'Advanced security',
      'Custom features',
    ],
    priceId: 'price_enterprise',
  },
];

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [userCount, setUserCount] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [processingAction, setProcessingAction] = useState('');
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  useEffect(() => {
    fetchSubscription();
    fetchUserCount();
  }, []);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const companyCode = user.companyCode;
      
      if (!companyCode) {
        toast.error('Company code not found');
        setLoading(false);
        return;
      }
      
      const response = await fetch(`/api/stripe/subscriptions?companyCode=${companyCode}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }
      
      const data = await response.json();
      setSubscription(data);
      
      // Fetch payment methods if subscription exists
      fetchPaymentMethods();
    } catch (error) {
      console.error('Error fetching subscription:', error);
      toast.error('Failed to load subscription information');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserCount = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const companyCode = user.companyCode;
      
      if (!companyCode) return;
      
      const response = await fetch(`/api/users/count?companyCode=${companyCode}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user count');
      }
      
      const data = await response.json();
      setUserCount(data.count);
    } catch (error) {
      console.error('Error fetching user count:', error);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      setLoadingPaymentMethods(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const companyCode = user.companyCode;
      
      if (!companyCode) return;
      
      const response = await fetch(`/api/stripe/payment-methods?companyCode=${companyCode}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch payment methods');
      }
      
      const data = await response.json();
      setPaymentMethods(data.paymentMethods || []);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;
    
    if (!confirm('Are you sure you want to cancel your subscription? Your plan will remain active until the end of the billing period.')) {
      return;
    }
    
    try {
      setProcessingAction('cancel');
      const response = await fetch('/api/stripe/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyCode: subscription.companyCode,
          action: 'cancel',
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }
      
      toast.success('Subscription will be canceled at the end of the billing period');
      fetchSubscription();
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast.error('Failed to cancel subscription');
    } finally {
      setProcessingAction('');
    }
  };

  const handleReactivateSubscription = async () => {
    if (!subscription) return;
    
    try {
      setProcessingAction('reactivate');
      const response = await fetch('/api/stripe/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyCode: subscription.companyCode,
          action: 'reactivate',
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to reactivate subscription');
      }
      
      toast.success('Subscription reactivated successfully');
      fetchSubscription();
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      toast.error('Failed to reactivate subscription');
    } finally {
      setProcessingAction('');
    }
  };

  const handleChangePlan = async () => {
    if (!subscription || !selectedPlan) return;
    
    try {
      setProcessingAction('update');
      const response = await fetch('/api/stripe/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyCode: subscription.companyCode,
          action: 'update',
          newPriceId: selectedPlan.priceId,
          planType: selectedPlan.id,
          userLimit: selectedPlan.userLimit,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update subscription');
      }
      
      toast.success(`Successfully changed to ${selectedPlan.name} plan`);
      setShowChangePlanModal(false);
      fetchSubscription();
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast.error('Failed to update subscription');
    } finally {
      setProcessingAction('');
    }
  };

  const handleUpdatePaymentMethod = () => {
    // Redirect to payment method update page
    toast.success('Redirecting to payment method update page');
    // Implementation would depend on your Stripe integration
  };

  const getCurrentPlan = () => {
    if (!subscription) return null;
    return plans.find(plan => plan.id === subscription.planType) || null;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <FaSpinner className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  const currentPlan = getCurrentPlan();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Billing & Subscription</h1>
        <p className="text-gray-600">Manage your subscription, payment methods, and billing information</p>
      </div>

      {!subscription ? (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">No Active Subscription</h2>
          <p className="text-gray-600">You don't have an active subscription. Please contact support for assistance.</p>
        </div>
      ) : (
        <>
          {/* Current Plan */}
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Current Plan</h2>
              <div>
                {subscription.cancelAtPeriodEnd ? (
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-800">
                    Cancels on {formatDate(subscription.currentPeriodEnd)}
                  </span>
                ) : (
                  <span className={`rounded-full px-3 py-1 text-sm ${
                    subscription.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                  </span>
                )}
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-lg font-medium">{currentPlan?.name || subscription.planType} Plan</h3>
                <p className="mb-4 text-gray-600">{currentPlan?.description}</p>
                
                <div className="mb-2 flex items-center">
                  <FaUsers className="mr-2 text-gray-500" />
                  <span>
                    {userCount} / {subscription.userLimit === Infinity ? 'Unlimited' : subscription.userLimit} users
                  </span>
                </div>
                
                <div className="mb-2 flex items-center">
                  <FaCalendarAlt className="mr-2 text-gray-500" />
                  <span>Renews on {formatDate(subscription.currentPeriodEnd)}</span>
                </div>
                
                <div className="mt-6">
                  {subscription.cancelAtPeriodEnd ? (
                    <button
                      onClick={handleReactivateSubscription}
                      disabled={processingAction === 'reactivate'}
                      className="mr-4 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {processingAction === 'reactivate' ? (
                        <FaSpinner className="mr-2 inline animate-spin" />
                      ) : null}
                      Reactivate Subscription
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setShowChangePlanModal(true)}
                        className="mr-4 rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
                      >
                        Change Plan
                      </button>
                      <button
                        onClick={handleCancelSubscription}
                        disabled={processingAction === 'cancel'}
                        className="rounded border border-red-600 bg-white px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {processingAction === 'cancel' ? (
                          <FaSpinner className="mr-2 inline animate-spin" />
                        ) : null}
                        Cancel Subscription
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="mb-2 text-lg font-medium">Features</h3>
                <ul className="space-y-2">
                  {currentPlan?.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <FaCheck className="mr-2 text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          
          {/* Payment Methods */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Payment Methods</h2>
            
            {loadingPaymentMethods ? (
              <div className="flex items-center justify-center py-4">
                <FaSpinner className="h-6 w-6 animate-spin text-purple-600" />
              </div>
            ) : paymentMethods.length === 0 ? (
              <p className="text-gray-600">No payment methods found.</p>
            ) : (
              <div className="space-y-4">
                {paymentMethods.map((method, index) => (
                  <div key={index} className="flex items-center justify-between rounded border p-4">
                    <div className="flex items-center">
                      <FaCreditCard className="mr-3 text-gray-500" />
                      <div>
                        <p className="font-medium">
                          {method.card.brand.charAt(0).toUpperCase() + method.card.brand.slice(1)} ending in {method.card.last4}
                        </p>
                        <p className="text-sm text-gray-600">Expires {method.card.exp_month}/{method.card.exp_year}</p>
                      </div>
                    </div>
                    <span className={method.isDefault ? 'text-green-600' : 'text-gray-500'}>
                      {method.isDefault ? 'Default' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-6">
              <button
                onClick={handleUpdatePaymentMethod}
                className="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-900"
              >
                Update Payment Method
              </button>
            </div>
          </div>
        </>
      )}

      {/* Change Plan Modal */}
      {showChangePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Change Subscription Plan</h2>
              <button
                onClick={() => setShowChangePlanModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`cursor-pointer rounded-lg border p-4 transition-all hover:shadow-md ${
                    selectedPlan?.id === plan.id
                      ? 'border-purple-500 ring-2 ring-purple-200'
                      : 'border-gray-200'
                  }`}
                >
                  <h3 className="mb-2 text-lg font-medium">{plan.name}</h3>
                  <p className="mb-4 text-2xl font-bold">${plan.price}<span className="text-sm font-normal text-gray-600">/month</span></p>
                  <p className="mb-4 text-sm text-gray-600">{plan.description}</p>
                  
                  <ul className="mb-4 space-y-2 text-sm">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center">
                        <FaCheck className="mr-2 text-green-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {subscription?.planType === plan.id && (
                    <div className="mt-2 text-center text-sm font-medium text-purple-600">
                      Current Plan
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-6 flex justify-end space-x-4">
              <button
                onClick={() => setShowChangePlanModal(false)}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePlan}
                disabled={!selectedPlan || processingAction === 'update' || selectedPlan.id === subscription?.planType}
                className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {processingAction === 'update' ? (
                  <FaSpinner className="mr-2 inline animate-spin" />
                ) : null}
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { FaEye, FaEyeSlash, FaCheck, FaArrowRight, FaArrowLeft } from 'react-icons/fa';
import PaymentForm from '@/components/stripe/PaymentForm';
import { stripePromise } from '@/components/stripe/PaymentForm';
import { toast } from 'react-hot-toast';

type StripePrice = {
  priceId: string;
  productName: string;
  unitAmount: number;
  currency: string;
  interval: string | null;
  productDescription: string;
};

type CompanySignupFormData = {
  companyName: string;
  adminEmail: string;
  adminPassword: string;
  confirmPassword: string;
  promoCode?: string;
  priceId?: string;
};

type SignupStep = 'form' | 'plan' | 'payment' | 'success';

function generateRandomCompanyCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

function CompanySignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<CompanySignupFormData>();
  const componentKey = React.useId();
  const [isLoading, setIsLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [companyCode, setCompanyCode] = useState('');
  const [currentStep, setCurrentStep] = useState<SignupStep>('form');
  const [formData, setFormData] = useState<CompanySignupFormData | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [prices, setPrices] = useState<StripePrice[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<StripePrice | null>(null);
  // Use 'month' and 'year' to match Stripe's interval format
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('month');
  const [promoInput, setPromoInput] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);
  const [codeError, setCodeError] = useState<string|null>(null);
  const [appliedAmount, setAppliedAmount] = useState<number|null>(null);
  const [appliedClientSecret, setAppliedClientSecret] = useState<string|null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  // Debug state to track priceId through the flow
  const [debugPriceId, setDebugPriceId] = useState<string|null>(null);

  // Watch password for confirmation validation
  const password = watch('adminPassword');

  // Fetch Stripe prices for selected cycle - only runs when billingCycle changes
  useEffect(() => {
    let isMounted = true;
    
    const fetchPrices = async () => {
      try {
        console.log('Fetching prices for interval:', billingCycle);
        // Set loading to false immediately to prevent delay
        setPaymentLoading(false);
        
        const res = await fetch(`/api/stripe/prices?interval=${billingCycle}`);
        const json = await res.json();
        
        if (!isMounted) return;
        
        console.log('Stripe prices response:', json);
        
        if (json.prices && Array.isArray(json.prices)) {
          console.log('Setting prices:', json.prices);
          
          // Filter prices based on the billing cycle
          const filteredPrices = json.prices.filter((price: StripePrice) => {
            // Check if product name contains the billing cycle (monthly/yearly)
            const productNameLower = price.productName.toLowerCase();
            if (billingCycle === 'month') {
              return productNameLower.includes('monthly') || 
                    (price.interval === 'month' && !productNameLower.includes('yearly'));
            } else {
              return productNameLower.includes('yearly') || 
                    (price.interval === 'year' && !productNameLower.includes('monthly'));
            }
          });
          
          // Only update prices if they've changed
          setPrices(prevPrices => 
            JSON.stringify(prevPrices) === JSON.stringify(filteredPrices) 
              ? prevPrices 
              : filteredPrices
          );
          
          // Only set initial selected plan if we don't have one yet or if billing cycle changed
          if (filteredPrices.length > 0 && (!selectedPlan || selectedPlan.interval !== billingCycle)) {
            const firstPrice = filteredPrices[0];
            console.log('Setting initial selected plan:', firstPrice);
            setSelectedPlan(firstPrice);
            setDebugPriceId(firstPrice.priceId);
            
            // Update formData with the first priceId
            setFormData(prev => prev ? { ...prev, priceId: firstPrice.priceId } : null);
          }
        } else {
          console.error('Invalid prices data:', json);
          toast.error('Invalid plan data received');
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error fetching prices:', error);
          toast.error('Failed to load plans');
        }
      }
    };
    
    fetchPrices();
    
    return () => {
      isMounted = false;
    };
  }, [billingCycle, selectedPlan]);

  useEffect(() => {
    stripePromise;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('redirect_status') === 'succeeded') {
      handlePaymentSuccess();
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const secret = params.get('payment_intent_client_secret');
    const status = params.get('redirect_status');
    if (secret && status === 'succeeded') {
      setAppliedClientSecret(secret);
    }
  }, []);

  useEffect(() => {
    const codeParam = searchParams?.get('company_code');
    if (codeParam) {
      setCompanyCode(codeParam);
      setSignupSuccess(true);
      setCurrentStep('success');
    }
  }, [searchParams]);

  useEffect(() => {
    if (formData && selectedPlan) {
      setPaymentLoading(true);
      fetch('/api/stripe/create-payment-intent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: selectedPlan.priceId,
          companyName: formData.companyName,
          companyCode,
          adminEmail: formData.adminEmail,
          promoCode: formData.promoCode,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          setAppliedAmount(data.amountInCents);
          setAppliedClientSecret(data.clientSecret);
        })
        .finally(() => setPaymentLoading(false));
    }
  }, [formData, selectedPlan]);

  useEffect(() => {
    if (selectedPlan) {
      console.log('Selected plan changed:', selectedPlan);
      setFormData(prev => {
        const newData = prev ? { ...prev, priceId: selectedPlan.priceId } : null;
        console.log('Updated formData with priceId:', newData);
        return newData;
      });
    }
  }, [selectedPlan]);

  const onSubmit = async (data: CompanySignupFormData) => {
    if (!data.companyName || !data.adminEmail || !data.adminPassword || !data.confirmPassword) {
      toast.error('Please enter all fields');
      return;
    }
    if (!agreed) {
      setSignupError('You must agree to Terms and Privacy Policy');
      return;
    }
    if (data.adminPassword !== data.confirmPassword) {
      setSignupError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setSignupError(null);

    // Generate a company code if not already generated
    if (!companyCode) {
      setCompanyCode(generateRandomCompanyCode());
    }

    // Store the form data
    setFormData(data);

    // Move to plan selection
    setCurrentStep('plan');

    // Clear any previous errors
    setSignupError(null);
    
    console.log('Form submitted, data stored:', data);
  };

  const handlePaymentSuccess = async (paymentMethodId?: string) => {
    if (!formData || !companyCode || !selectedPlan || !selectedPlan.priceId) {
      console.error('Missing required data:', { formData, companyCode, selectedPlan });
      setSignupError('Please select a plan before proceeding');
      return;
    }
    
    // Get the priceId either from formData or selectedPlan
    const usePriceId = formData.priceId || selectedPlan.priceId;
    
    if (!usePriceId) {
      console.error('No priceId found in formData or selectedPlan');
      setSignupError('Missing subscription plan data');
      return;
    }
    
    // Build signup payload with explicit debug logs
    const signupPayload = {
      companyName: formData.companyName,
      adminEmail: formData.adminEmail,
      adminPassword: formData.adminPassword,
      companyCode,
      paymentCompleted: true,
      promoCode: formData.promoCode,
      priceId: usePriceId, // Using the verified priceId
      paymentMethodId,
    };
    
    console.log('VERIFIED PRICE ID BEFORE SENDING:', usePriceId);
    console.log('Posting signup payload:', signupPayload);

    setIsLoading(true);
    setSignupError(null);

    try {
      const response = await fetch('/api/auth/company-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupPayload),
      });
      const { data } = await response.json();
      if (!response.ok) {
        setSignupError(data?.error || 'Signup failed');
        setCurrentStep('form');
        setIsLoading(false);
        return;
      }
      // Redirect to Stripe Checkout
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      } else {
        setSignupError('Missing session URL');
        setCurrentStep('form');
        setIsLoading(false);
      }
    } catch (error) {
      setSignupError('Failed to connect to the server');
      setCurrentStep('form');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentError = (error: string) => {
    toast.error(error);
    setSignupError(error || 'Payment failed');
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  // Promo handling
  const applyPromoCode = async () => {
    if (!selectedPlan || !formData) return;
    setApplyingCode(true);
    setCodeError(null);
    
    const priceIdToUse = selectedPlan.priceId;
    console.log('Using priceId for promo code:', priceIdToUse);
    
    try {
      const res = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          priceId: priceIdToUse,
          companyName: formData.companyName,
          companyCode,
          promoCode: promoInput,
        })
      });
      const data = await res.json();
      
      // Add the promo code to the form data while preserving priceId
      setFormData({
        ...formData,
        promoCode: promoInput,
        priceId: selectedPlan.priceId // Ensure priceId is set here too
      });
      
      console.log('Updated formData with promo code and ensured priceId:', selectedPlan.priceId);
      
      // Update localStorage with the new formData including promo code
      localStorage.setItem('companySignupData', JSON.stringify({
        ...formData,
        promoCode: promoInput,
        priceId: selectedPlan.priceId // Ensure priceId is set here too
      }));
      
      // Update UI
      setAppliedAmount(data.amountInCents);
      setAppliedClientSecret(data.clientSecret);
      
      toast.success('Promo code applied successfully!');
    } catch (err: any) {
      setCodeError(err.message || 'Invalid code');
      toast.error(err.message || 'Invalid promo code');
    } finally {
      setApplyingCode(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" key={componentKey}>
      {/* Full-page background image */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center z-0" 
        style={{ 
          backgroundImage: 'url(/images/philip-oroni-C_y8UiVIzP8-unsplash.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      ></div>
      
      <div className="flex w-[900px] h-[640px] overflow-hidden rounded-xl shadow-2xl bg-white relative z-10" style={{ width: '800px !important', height: '550px !important' }}>
        {/* Left side - Signup form */}
        <div className="p-8 bg-white overflow-y-auto" style={{ width: '350px !important', height: '100%', flexShrink: 0 }}>
          {currentStep === 'form' && (
            <>
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-gray-800">Company Signup</h2>
              </div>

              {signupError && (
                <div className="mb-3 p-2.5 bg-red-50 text-red-700 rounded-md">
                  <p className="text-sm">{signupError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5">
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-600 mb-0.5">
                    Company Name
                  </label>
                  <input
                    id="companyName"
                    type="text"
                    {...register('companyName', { required: 'Company name is required' })}
                    className="mt-0 block w-full px-2.5 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900"
                  />
                  {errors.companyName && <p className="mt-0.5 text-sm text-red-500">{errors.companyName.message}</p>}
                </div>

                <div>
                  <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-600 mb-0.5">
                    Administrator Email
                  </label>
                  <input
                    id="adminEmail"
                    type="email"
                    {...register('adminEmail', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address',
                      },
                    })}
                    className="mt-0 block w-full px-2.5 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900"
                  />
                  {errors.adminEmail && <p className="mt-0.5 text-sm text-red-500">{errors.adminEmail.message}</p>}
                </div>

                <div>
                  <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-600 mb-0.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="adminPassword"
                      type={showPassword ? 'text' : 'password'}
                      {...register('adminPassword', {
                        required: 'Password is required',
                        minLength: {
                          value: 8,
                          message: 'Password must be at least 8 characters',
                        },
                      })}
                      className="mt-0 block w-full px-2.5 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="absolute inset-y-0 right-0 px-2 flex items-center text-sm text-gray-500"
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  {errors.adminPassword && <p className="mt-0.5 text-sm text-red-500">{errors.adminPassword.message}</p>}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-600 mb-0.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      {...register('confirmPassword', {
                        required: 'Confirm password is required',
                        validate: value =>
                          value === password || 'Passwords do not match',
                      })}
                      className="mt-0 block w-full px-2.5 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={toggleConfirmPasswordVisibility}
                      className="absolute inset-y-0 right-0 px-2 flex items-center text-sm text-gray-500"
                    >
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="mt-0.5 text-sm text-red-500">{errors.confirmPassword.message}</p>}
                </div>
                
                <div className="flex items-center pt-0.5">
                  <input
                    id="agreeTerms"
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="h-3.5 w-3.5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="agreeTerms" className="ml-1.5 block text-sm text-gray-700">
                    I agree to the{' '}
                    <a href="/terms" className="font-medium text-purple-600 hover:text-purple-500">
                      T&C
                    </a>{' '}
                    and{' '}
                    <a href="/privacy" className="font-medium text-purple-600 hover:text-purple-500">
                      Privacy Policy
                    </a>
                  </label>
                </div>

                <div className="pt-1.5">
                  <button
                    type="submit"
                    disabled={isLoading || !agreed}
                    className="w-full flex justify-center py-1.5 px-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                  >
                    {isLoading ? 'Processing...' : 'Continue to Plan Selection'} 
                  </button>
                </div>
              </form>
              <p className="mt-3 text-center text-sm text-gray-500">
                Already have an account?{' '}
                <a href="/login" className="font-medium text-purple-600 hover:text-purple-500">
                  Login
                </a>
              </p>
              <p className="mt-1.5 text-center text-sm text-gray-500">
                Need a personal account?{' '}
                <a href="/signup" className="font-medium text-purple-600 hover:text-purple-500">
                  Sign up here
                </a>
              </p>
            </>
          )}

          {currentStep === 'plan' && formData && (
            <div className="p-2">
              <div className="flex items-center mb-3">
                <button
                  onClick={() => setCurrentStep('form')}
                  className="text-sm text-purple-600 hover:underline flex items-center"
                >
                  <FaArrowLeft className="mr-1" /> Back to Details
                </button>
              </div>
              <h2 className="text-lg font-semibold text-gray-800 text-center mb-3">Select Your Plan</h2>
              <div className="flex items-center justify-center mb-4">
                <div className="inline-flex rounded-md shadow-sm">
                  <button 
                    onClick={() => setBillingCycle('month')} 
                    className={`px-4 py-2 text-sm rounded-l-md ${billingCycle === 'month' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    Monthly
                  </button>
                  <button 
                    onClick={() => setBillingCycle('year')} 
                    className={`px-4 py-2 text-sm rounded-r-md ${billingCycle === 'year' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    Yearly 
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {/* Debug info in comment: {prices.length} plans available */}
                {prices.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500">No plans available. Please try again later.</p>
                  </div>
                ) : (
                  prices.filter(plan => plan.interval === billingCycle).map(plan => (
                    <div 
                      key={plan.priceId} 
                      className={`relative p-3 border rounded-lg cursor-pointer ${selectedPlan?.priceId === plan.priceId ? 'border-purple-500 ring-1 ring-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'}`}
                      onClick={() => { setSelectedPlan(plan); setFormData({ ...formData, priceId: plan.priceId }); }}
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm text-gray-700">{plan.productName}</h3>
                        <p className="text-lg text-gray-800">${(plan.unitAmount/100).toFixed(2)}/{billingCycle}{billingCycle === 'month' ? 'ly' : 'ly'}</p>
                      </div>
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">{plan.productDescription}</p>
                      
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 flex justify-end items-center">
                <button
                  onClick={async () => {
                    if (!selectedPlan || !formData) {
                      toast.error("Incomplete signup data.");
                      return;
                    }
                    try {
                      setPaymentLoading(true);
                      const signupPayload = {
                        companyName: formData.companyName,
                        companyCode: companyCode || generateRandomCompanyCode(),
                        adminEmail: formData.adminEmail,
                        adminPassword: formData.adminPassword,
                        priceId: selectedPlan.priceId,
                        ...(formData.promoCode ? { promoCode: formData.promoCode } : {})
                      };
                      console.log('Calling signup endpoint with:', signupPayload);
                      const res = await fetch('/api/auth/company-signup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(signupPayload),
                      });
                      const result = await res.json();
                      if (!res.ok) {
                        throw new Error(result.error || 'Signup failed');
                      }
                      if (result.data?.sessionUrl) {
                        window.location.href = result.data.sessionUrl;
                      } else {
                        throw new Error('Missing session URL');
                      }
                    } catch (err: any) {
                      console.error('Signup initiation error:', err);
                      toast.error(err.message || 'Unable to start signup');
                    } finally {
                      setPaymentLoading(false);
                    }
                  }}
                  disabled={!selectedPlan || paymentLoading}
                  className="py-1.5 px-3 border border-transparent rounded-md shadow-sm text-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 flex items-center"
                >
                  {paymentLoading ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-t-2 border-white border-opacity-75 rounded-full mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    'Proceed to Payment'
                  )} <FaArrowRight className="ml-1.5" />
                </button>
              </div>
            </div>
          )}

          {currentStep === 'payment' && formData && selectedPlan && (
            <div className="text-center space-y-3 p-2">
              {/* Show Total */}
              <p className="text-[15px] font-medium text-purple-600">
                Total: {(
                  (appliedAmount != null ? appliedAmount : (
                    billingCycle === 'year' ? selectedPlan.unitAmount * 12 : selectedPlan.unitAmount
                  )) / 100
                ).toFixed(2)}
              </p>
              {/* Debug priceId */}
              <div className="text-xs text-left text-gray-500 mb-2">
                Plan ID: {formData?.priceId || selectedPlan?.priceId || 'Not set'}
              </div>
              
              {/* Stripe payment form */}
              {paymentLoading && !appliedClientSecret ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin h-10 w-10 border-t-2 border-purple-500 rounded-full mb-4"></div>
                  <p className="text-gray-600">Preparing payment form...</p>
                </div>
              ) : appliedClientSecret ? (
                <PaymentForm
                  clientSecret={appliedClientSecret}
                  onPaymentSuccess={handlePaymentSuccess}
                  onPaymentError={handlePaymentError}
                />
              ) : (
                <div className="text-red-500 text-sm">
                  Failed to load payment form. Please try again or contact support.
                </div>
              )}
              {/* Promo Code below payment */}
              <div className="mt-4 p-2 border border-gray-200 rounded">
                <label htmlFor="promoInput" className="block text-sm font-medium text-gray-700 mb-1">Promo Code</label>
                <div className="flex">
                  <input
                    id="promoInput"
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded-l-md text-sm text-black"
                  />
                  <button
                    onClick={applyPromoCode}
                    disabled={applyingCode || !promoInput}
                    className="px-3 py-1 flex justify-center items-center text-sm font-medium text-white bg-purple-600 rounded-r-md hover:bg-purple-700 disabled:opacity-50"
                  >
                    {applyingCode ? <div className="animate-spin h-5 w-5 border-t-2 border-purple-600 rounded-full" /> : 'Apply'}
                  </button>
                </div>
                {codeError && <p className="mt-1 text-sm text-red-500">{codeError}</p>}
              </div>
              <button
                onClick={() => setCurrentStep('plan')}
                className="flex items-center text-sm text-purple-600 hover:underline"
              >
                <FaArrowLeft className="mr-1" /> Back to Plan
              </button>
            </div>
          )}

          {currentStep === 'success' && signupSuccess && (
            <div className="text-center p-2 space-y-3">
              <FaCheck className="text-green-500 text-3xl mx-auto" />
              <h2 className="text-lg font-semibold text-gray-700">Signup Successful!</h2>
              <p className="text-sm text-gray-600">
                Your company account has been created. Your company code is{' '}
                <span className="font-semibold text-purple-600">{companyCode}</span>.
              </p>
              <div className="mt-4">
                <a href="/login">
                  <button className="w-full flex justify-center py-1.5 px-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500">
                    Go to Login
                  </button>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Right side - Image and Title */}
        <div className="bg-gradient-to-br from-purple-600 to-pink-500 p-8 flex flex-col justify-center items-center text-white relative overflow-hidden" style={{ width: '528px !important', height: '100%', flexShrink: 0 }}>
          <img 
            src="/images/sincerely-media-cuEpo721ACY-unsplash.jpg"
            alt="Abstract Background Texture"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="relative z-10 text-center">
            <h1 className="text-[2.75rem] leading-tight font-bold mb-1.5">
              <span className="text-purple-300">Synera</span> <span className="text-white">AI</span>
            </h1>
            <p className="text-xl text-purple-100 mb-6">
              
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompanySignupPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CompanySignupPageContent />
    </Suspense>
  );
}
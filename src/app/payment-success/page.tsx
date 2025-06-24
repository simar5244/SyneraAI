'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

function PaymentSuccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'processing' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [companyCode, setCompanyCode] = useState<string | null>(null);

  useEffect(() => {
    if (!searchParams) return;
    
    // Check if we have a payment_intent and redirect_status in URL
    const paymentIntent = searchParams.get('payment_intent');
    const redirectStatus = searchParams.get('redirect_status');
    const clientSecret = searchParams.get('payment_intent_client_secret');

    if (!paymentIntent || !clientSecret) {
      setPaymentStatus('error');
      setErrorMessage('No payment information found');
      setIsLoading(false);
      return;
    }

    if (redirectStatus === 'succeeded') {
      // Get user data from local storage
      const formDataStr = localStorage.getItem('companySignupData');
      const companyCodeStr = localStorage.getItem('companyCode');
      
      if (!formDataStr || !companyCodeStr) {
        setPaymentStatus('error');
        setErrorMessage('Registration data not found. Please try again.');
        setIsLoading(false);
        return;
      }

      try {
        const formData = JSON.parse(formDataStr);
        const companyCode = companyCodeStr;
        setCompanyCode(companyCode);

        // Complete the registration process
        completeRegistration(formData, companyCode);
      } catch (error) {
        console.error('Error parsing stored data:', error);
        setPaymentStatus('error');
        setErrorMessage('Error processing your registration. Please try again.');
        setIsLoading(false);
      }
    } else {
      setPaymentStatus('error');
      setErrorMessage('Payment was not completed successfully');
      setIsLoading(false);
    }
  }, [searchParams, router]);

  const completeRegistration = async (formData: any, companyCode: string) => {
    try {
      const response = await fetch('/api/auth/company-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formData.companyName,
          adminEmail: formData.adminEmail,
          adminPassword: formData.adminPassword,
          companyCode,
          paymentCompleted: true,
          promoCode: formData.promoCode,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Store authentication data
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Clear signup data
        localStorage.removeItem('companySignupData');
        localStorage.removeItem('companyCode');
        
        setPaymentStatus('success');
        toast.success('Registration completed successfully!');
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push('/dashboard');
        }, 6000); // Increased from 3000 to 6000 ms
      } else {
        setPaymentStatus('error');
        setErrorMessage(data.message || data.error || 'An error occurred during signup');
        toast.error('Registration failed: ' + (data.message || data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Registration error:', error);
      setPaymentStatus('error');
      setErrorMessage('Failed to connect to the server');
      toast.error('Registration failed: Server connection error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Full-page background image - matching company-signup page */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center z-0" 
        style={{ 
          backgroundImage: 'url(/images/philip-oroni-C_y8UiVIzP8-unsplash.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      ></div>
      
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 relative z-10">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            <p className="mt-4 text-gray-600">Processing your payment...</p>
          </div>
        ) : paymentStatus === 'success' ? (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg className="h-10 w-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Successful!</h2>
            <p className="text-gray-600 mb-4">
              Your company has been registered successfully. You can now access your dashboard.
            </p>
            {companyCode && (
              <p className="text-gray-700 mb-4">
                Your company code is: <span className="font-semibold text-purple-600">{companyCode}</span>
              </p>
            )}
            <p className="text-gray-500 text-sm mb-6">
              Redirecting you to the dashboard in a few seconds...
            </p>
            <Link 
              href="/dashboard" 
              className="inline-block px-6 py-3 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <svg className="h-10 w-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Error</h2>
            <p className="text-gray-600 mb-6">
              {errorMessage || 'There was an issue with your payment.'}
            </p>
            <div className="flex flex-col space-y-3">
              <Link 
                href="/company-signup" 
                className="px-6 py-3 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 transition-colors"
              >
                Try Again
              </Link>
              <Link 
                href="/contact" 
                className="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 transition-colors"
              >
                Contact Support
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    }>
      <PaymentSuccessPageContent />
    </Suspense>
  );
}

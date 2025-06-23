'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaExclamationTriangle, FaCreditCard, FaArrowRight } from 'react-icons/fa';

export default function SubscriptionRequiredPage() {
  const router = useRouter();

  // Redirect to billing page when the button is clicked
  const handleGoToBilling = () => {
    router.push('/dashboard/billing');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <FaExclamationTriangle className="mx-auto h-12 w-12 text-yellow-500" />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Subscription Inactive
          </h2>
        </div>
        
        <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-700 text-left text-justify">
                Your company subscription is currently inactive. As an administrator, you can not access any features untill the subscription is reactivated.
              </p>
            </div>
            
            <div className="mt-6">
              <p className="text-sm text-gray-700 text-left text-justify">
                Please update your payment information or select a new subscription plan to restore access for all users in your organization.
              </p>
            </div>
            
            <div className="mt-6">
              <button
                onClick={handleGoToBilling}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                <FaCreditCard className="mr-2 h-5 w-5" />
                Go to Billing
                <FaArrowRight className="ml-2 h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
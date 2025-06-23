'use client';

import React from 'react';
import { FaExclamationTriangle, FaEnvelope } from 'react-icons/fa';

export default function AccountInactivePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <FaExclamationTriangle className="mx-auto h-12 w-12 text-yellow-500" />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Account Inactive
          </h2>
        </div>
        
        <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-700 text-left text-justify">
                Your account is currently inactive because your company's subscription has expired, has been canceled or exceeded it's permissible usage.
              </p>
            </div>
            
            <div className="mt-6">
              <p className="text-sm text-gray-700 text-left text-justify">
                Please contact your administrator to reactivate the subscription.
              </p>
            </div>
            
            <div className="mt-6">
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <FaEnvelope className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-gray-800">Need help?</h3>
                    <div className="mt-2 text-sm text-gray-700">
                      <p>
                        If you believe this is an error, please contact your company administrator or support team.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { checkUserAuth, handleAuthRedirect } from '@/utils/auth';
import UserTabs from './tabs';
import { Spinner } from '@/components/ui/spinner';

export default function UserManagementPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check user authentication and authorization
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authState = await checkUserAuth(['admin', 'superadmin']);
        if (handleAuthRedirect(router, authState)) {
          return; // Will redirect if not authenticated/authorized
        }
        
        setCurrentUser(authState.user);
        setIsLoading(false);
      } catch (error) {
        console.error('Auth check error:', error);
        setError('Authentication failed. Please try logging in again.');
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 bg-gray-50 min-h-screen">
      <div className="text-center mb-10 md:mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mt-4">
          <span className="text-purple-700">User</span> Management
        </h1>
        <p className="mt-3 text-lg text-gray-600 max-w-xl mx-auto">
          Manage user accounts, roles, and permissions within your organization.
        </p>
      </div>

      {currentUser && <UserTabs currentUser={currentUser} />}

      <div className="mt-8 text-center text-gray-500 text-sm">
      </div>
    </div>
  );
}
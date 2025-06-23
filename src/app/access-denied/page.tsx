"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { FaLock, FaHome } from 'react-icons/fa';

export default function AccessDenied() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    // Get user info if available
    try {
      const userJSON = localStorage.getItem('user');
      if (userJSON) {
        setUser(JSON.parse(userJSON));
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, []);
  
  const goToDashboard = () => {
    router.push('/dashboard');
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-red-600 p-6 flex justify-center">
          <FaLock className="text-white text-6xl" />
        </div>
        
        <div className="p-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page. 
            {user?.role && (
              <span className="block mt-2">
                Your current role is <span className="font-medium">{user.role}</span>.
              </span>
            )}
          </p>
          
          <Button
            className="flex items-center justify-center mx-auto gap-2 bg-indigo-600 hover:bg-indigo-700"
            onClick={goToDashboard}
          >
            <FaHome className="w-4 h-4" />
            <span>Go to Dashboard</span>
          </Button>
        </div>
      </div>
    </div>
  );
} 
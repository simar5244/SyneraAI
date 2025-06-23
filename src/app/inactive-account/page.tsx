'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiBan, FiLogOut, FiArrowLeft, FiMail } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export default function InactiveAccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  
  useEffect(() => {
    // Get user data from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        // Try to get admin contact email if company code is available
        if (parsedUser.companyCode) {
          fetchAdminContact(parsedUser.companyCode);
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
    
    // Check if user is already active
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/check-status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(async res => {
          // Check content type to avoid parsing HTML as JSON
          const contentType = res.headers.get("content-type");
          if (!res.ok || !contentType || !contentType.includes("application/json")) {
            console.log(`Status check returned ${res.status}, content-type: ${contentType}`);
            return { success: false, status: "unknown" };
          }
          try {
            return await res.json();
          } catch (parseError) {
            console.error("JSON parse error:", parseError);
            return { success: false, status: "unknown" };
          }
        })
        .then(data => {
          setLoading(false);
          if (data.success && data.status === 'active') {
            router.push('/dashboard');
          }
        })
        .catch(err => {
          console.error('Error checking user status:', err);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [router]);
  
  // Fetch admin contact email
  const fetchAdminContact = async (companyCode: string) => {
    try {
      const response = await fetch(`/api/company/admin-contact?companyCode=${companyCode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.adminEmail) {
          setAdminEmail(data.adminEmail);
        }
      }
    } catch (error) {
      console.error('Error fetching admin contact:', error);
    }
  };
  
  const handleLogout = async () => {
    try {
      // Clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Redirect to login page
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-red-50 to-orange-50 flex items-center justify-center p-4">
        <Spinner size="lg" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-r from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-10 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Account Inactive</h1>
          
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-red-100 p-4">
              <FiBan className="w-12 h-12 text-red-500" />
            </div>
          </div>
          
          <p className="text-gray-600 text-lg mb-6">
            Your account has been deactivated and is currently inactive.
          </p>
          
          {user && (
            <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Your Account Information</h2>
              <div className="space-y-3">
                <p className="text-gray-700">
                  <span className="font-medium inline-block w-24">Username:</span> {user.username}
                </p>
                <p className="text-gray-700">
                  <span className="font-medium inline-block w-24">Email:</span> {user.email}
                </p>
                <p className="text-gray-700">
                  <span className="font-medium inline-block w-24">Company:</span> {user.company}
                </p>
                <p className="text-gray-700">
                  <span className="font-medium inline-block w-24">Role:</span> {user.role?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>
              </div>
            </div>
          )}
          
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 text-amber-700 mb-6 text-left">
            <p>
              <span className="font-semibold">Why is my account inactive?</span> Your account may have been deactivated by an administrator. 
              This could be due to inactivity, security concerns, or organization policy.
            </p>
          </div>
          
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 text-blue-700 mb-6 text-left">
            <p>
              <span className="font-semibold">What can I do?</span> Please contact your system administrator to request reactivation of your account.
              {adminEmail && (
                <span> You can reach out to your administrator at <a href={`mailto:${adminEmail}`} className="font-semibold text-blue-600 hover:underline">{adminEmail}</a>.</span>
              )}
            </p>
          </div>
          
          <p className="text-gray-600 mb-6">
            If you believe this is a mistake, please contact your administrator for assistance.
          </p>
        </div>
        
        <div className="flex flex-col space-y-4">
          {adminEmail && (
            <a
              href={`mailto:${adminEmail}?subject=Account%20Reactivation%20Request&body=Hello,%0D%0A%0D%0AI'm%20requesting%20reactivation%20of%20my%20account.%0D%0A%0D%0AUsername:%20${user?.username}%0D%0AEmail:%20${user?.email}%0D%0ACompany:%20${user?.company}%0D%0A%0D%0AThank%20you.`}
              className="py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium flex items-center justify-center gap-2"
            >
              <FiMail />
              Contact Administrator
            </a>
          )}
          
          <Button
            onClick={handleLogout}
            className="py-3 px-4 bg-red-100 hover:bg-red-200 text-red-700 rounded-md font-medium flex items-center justify-center gap-2"
            variant="ghost"
          >
            <FiLogOut />
            Log Out
          </Button>
          
          <Link 
            href="/login" 
            className="py-3 px-4 text-center bg-blue-100 hover:bg-blue-200 rounded-md text-blue-700 font-medium transition-colors flex items-center justify-center gap-2"
          >
            <FiArrowLeft />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
} 
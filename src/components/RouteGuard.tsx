"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { hasRouteAccess } from '@/lib/permissions';
import { toast } from 'react-hot-toast';

interface RouteGuardProps {
  children: React.ReactNode;
}

export default function RouteGuard({ children }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  
  useEffect(() => {
    // Check if user is authorized to access this route
    const checkAuth = () => {
      // Get user from localStorage
      let user = null;
      try {
        const userJSON = localStorage.getItem('user');
        if (userJSON) {
          user = JSON.parse(userJSON);
        }
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
      }

      // If no user found, redirect to login
      if (!user) {
        setAuthorized(false);
        router.push('/login');
        return;
      }

      // Get user role
      const userRole = user.role;
      
      // Check if user has access to this route
      const hasAccess = hasRouteAccess(userRole, pathname);
      
      if (hasAccess) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
        // Redirect to dashboard instead of access-denied
        router.push('/dashboard');
        toast.error('You do not have permission to access this page. Redirected to dashboard.');
      }
    };

    // Check auth on initial load and path changes
    checkAuth();
  }, [pathname, router]);

  // Show loading or nothing while checking auth
  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // If authorized, render children
  return <>{children}</>;
} 
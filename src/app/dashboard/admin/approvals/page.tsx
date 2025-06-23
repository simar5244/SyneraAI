"use client"

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UserApprovalsPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the user management page
    router.push('/dashboard/user-management');
  }, [router]);

  // This page will never actually render as it will redirect
  return null;
} 
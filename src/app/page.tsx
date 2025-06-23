'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import GalaxyView from '../components/visualization/GalaxyView';
import NetworkChart from '../components/visualization/NetworkChart';
import OrgTree from '../components/visualization/OrgTree';
import { Employee } from '@/types/organization';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  return null; // No need to render anything as we're redirecting
} 
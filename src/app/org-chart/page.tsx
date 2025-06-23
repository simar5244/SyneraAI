'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OrgChartRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.push('/dashboard/org-chart');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-lg">Redirecting to Organization Chart...</p>
      </div>
    </div>
  );
} 
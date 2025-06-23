'use client';

import { useEffect, useState } from 'react';

export default function DataProcessorInitializer() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initializeDataProcessors = async () => {
      if (initialized) return;
      
      try {
        console.log('Initializing data processors...');
        const response = await fetch('/api/init-data-processors', { 
          method: 'POST',
          cache: 'no-store'
        });
        
        const data = await response.json();
        console.log('Initialization response:', data);
        setInitialized(true);
      } catch (error) {
        console.error('Error initializing data processors:', error);
      }
    };
    
    // Only run on client-side
    if (typeof window !== 'undefined') {
      initializeDataProcessors();
    }
  }, [initialized]);

  // This component doesn't render anything visible
  return null;
} 
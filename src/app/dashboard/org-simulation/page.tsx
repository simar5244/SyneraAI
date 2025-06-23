'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { CircularProgress, Box, Typography } from '@mui/material';

// Import the OrgSimulationPage with dynamic loading and SSR disabled
// This ensures ReactFlow works properly in Next.js
const OrgSimulationPage = dynamic(
  () => import('../../../../frontend/pages/OrgSimulationPage'),
  { 
    ssr: false,
    loading: () => (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading Organizational Simulation...
        </Typography>
      </Box>
    )
  }
);

export default function OrgSimulation() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <CircularProgress />
      </Box>
    }>
      <OrgSimulationPage />
    </Suspense>
  );
} 
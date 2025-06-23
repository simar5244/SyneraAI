"use client";
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { FaGlobe, FaProjectDiagram, FaUserFriends } from 'react-icons/fa';
import OrgTree from '@/components/visualization/OrgTree';
import NetworkChart from '@/components/visualization/NetworkChart';

// Import GalaxyView dynamically to avoid window undefined
const GalaxyView = dynamic(
  () => import('@/components/visualization/GalaxyView'),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-[600px]">Loading Galaxy View...</div> }
);

type VisualizationType = 'galaxy' | 'tree' | 'network';

export default function GraphsPage() {
  const [visualizationType, setVisualizationType] = useState<VisualizationType>('galaxy');

  return (
    <div className="space-y-6 h-full flex flex-col p-6">
      <div className="flex space-x-2">
        <button
          onClick={() => setVisualizationType('galaxy')}
          className={`px-4 py-2 rounded-md transition-colors flex items-center ${
            visualizationType === 'galaxy'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <FaGlobe className="mr-2" />
          3D Galaxy
        </button>
        <button
          onClick={() => setVisualizationType('tree')}
          className={`px-4 py-2 rounded-md transition-colors flex items-center ${
            visualizationType === 'tree'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <FaProjectDiagram className="mr-2" />
          Org Tree
        </button>
        <button
          onClick={() => setVisualizationType('network')}
          className={`px-4 py-2 rounded-md transition-colors flex items-center ${
            visualizationType === 'network'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <FaUserFriends className="mr-2" />
          Network
        </button>
      </div>

      <div className="flex-1 border rounded-md overflow-hidden bg-white">
        {visualizationType === 'galaxy' && <GalaxyView />}
        {visualizationType === 'tree' && <OrgTree />}
        {visualizationType === 'network' && <NetworkChart employees={[]} allEmployees={[]} />}
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { FaSearch, FaFilter } from 'react-icons/fa';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import ErrorBoundary from '@/components/visualization/ErrorBoundary';

// Dynamically import the 3D visualization component to prevent SSR issues
const GalaxyVisualization = dynamic(
  () => import('@/components/visualization/GalaxyVisualization'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[calc(100vh-4rem)] flex items-center justify-center bg-black">
        <div className="text-white text-xl">Loading Galaxy Visualization...</div>
      </div>
    )
  }
);

export default function GalaxyPage() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const fullScreenRef = useRef<HTMLDivElement>(null);

  // Load initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Include credentials to send auth cookies
        const response = await fetch('/api/galaxy', { credentials: 'same-origin' });
        // Debug: log status and raw text for troubleshooting auth redirect
        const text = await response.text();
        console.log('GalaxyPage fetch status:', response.status, 'response text:', text);
        // If JSON, parse it
        const data = response.headers.get('content-type')?.includes('application/json')
          ? JSON.parse(text)
          : { nodes: [], links: [] };
        console.log('GalaxyPage parsed data:', data);
        if (!response.ok) {
          throw new Error('Failed to fetch galaxy data');
        }
        setGraphData(data);
        setLoading(false);
      } catch (error) {
        console.error('Error loading galaxy data:', error);
        setError('Failed to load visualization data. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Extract unique departments for the filter dropdown
  const departments = React.useMemo(() => {
    if (!graphData.nodes || !graphData.nodes.length) return [];
    
    return Array.from(
      new Set(
        graphData.nodes
          .map((node: any) => node.department)
          .filter(Boolean)
      )
    ).sort();
  }, [graphData.nodes]);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Searching is now handled in the visualization component
  };

  // Handle department filter change
  const handleDepartmentChange = (value: string) => {
    setSelectedDepartment(value === 'all' ? null : value);
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div 
      ref={fullScreenRef}
      className="w-full h-screen relative bg-black overflow-hidden"
    >
      <div className="absolute top-0 left-0 z-10 p-4 flex flex-col gap-2 w-64 bg-black/50 backdrop-blur-sm rounded-br-lg">
        <h1 className="text-white text-xl font-bold">Organization Galaxy</h1>
        
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            type="text"
            placeholder="Search names, emails, roles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-gray-800 text-white border-gray-700"
          />
          <Button type="submit" size="icon" variant="outline">
            <FaSearch />
          </Button>
        </form>
        
        {/* Department filter */}
        <Select value={selectedDepartment || 'all'} onValueChange={handleDepartmentChange}>
          <SelectTrigger className="bg-gray-800 text-white border-gray-700">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 text-white border-gray-700">
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((dept: string) => (
              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Main Visualization */}
      {loading ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-white text-xl">Loading visualization data...</div>
        </div>
      ) : error ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-white text-xl">{error}</div>
        </div>
      ) : (
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-white text-xl">Rendering galaxy...</div>
          </div>
        }>
          <ErrorBoundary>
            <GalaxyVisualization 
              graphData={graphData} 
              searchTerm={searchTerm}
              selectedDepartment={selectedDepartment}
            />
          </ErrorBoundary>
        </Suspense>
      )}
    </div>
  );
} 
'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

// Import GalaxyView with dynamic loading to prevent SSR issues
const GalaxyView = dynamic(
  () => import('@/components/visualization/GalaxyView'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="text-white text-xl">Loading Galaxy View...</div>
      </div>
    )
  }
);

export default function GalaxyPage() {
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setSearchError(null);
    
    try {
      const response = await fetch(`http://localhost:8000/api/galaxy/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching employees:', error);
      setSearchError('Failed to search employees. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDepartmentFilter = async (department: string) => {
    setIsSearching(true);
    setSearchError(null);
    
    try {
      const response = await fetch(`http://localhost:8000/api/galaxy/department/${encodeURIComponent(department)}`);
      if (!response.ok) {
        throw new Error('Department filter failed');
      }
      
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Error filtering by department:', error);
      setSearchError('Failed to filter by department. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="w-full h-screen">
      <GalaxyView 
        onSearch={handleSearch}
        onDepartmentFilter={handleDepartmentFilter}
      />
    </div>
  );
} 
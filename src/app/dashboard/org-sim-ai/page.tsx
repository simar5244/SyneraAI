"use client";

import React from 'react';
import NewOrgSimAIContent from './components/NewOrgSimAIContent';

export default function OrgSimAIPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Organization Simulation AI</h1>
        <p className="text-gray-600">
          Visualize and optimize your organizational structure with AI-powered insights
        </p>
      </div>
      
      <NewOrgSimAIContent />
    </div>
  );
} 
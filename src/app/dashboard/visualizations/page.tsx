'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import { FaProjectDiagram, FaStar } from 'react-icons/fa'; // Example icons

export default function VisualizationsPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto p-6 bg-gray-50 min-h-full">
      {/* Simple Background Pattern */}
      <div 
        className="absolute inset-0 w-full h-full opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #a78bfa 1px, transparent 1px)',
          backgroundSize: '30px 30px',
        }}
      />

      {/* Content overlaid on background */}
      <div className="relative z-10">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            <span className="text-purple-700">Organization Visualizations</span>
          </h1>
          <p className="text-lg text-gray-600">
            Explore different ways to view your organizational structure and data.
          </p>
        </div>

        {/* Placeholder for other fluff visuals/text */}
        <div className="text-center my-12 text-gray-700">
          <p>Select a visualization mode below.</p>
          {/* Add more fluff here if needed */}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Org Chart Box */}
          <Card className="hover:shadow-xl transition-shadow bg-white/80 backdrop-blur-sm border-purple-200">
            <CardHeader className="bg-purple-50/50">
              <CardTitle className="flex items-center gap-2 text-purple-800">
                <FaProjectDiagram />
                Standard Org Chart
              </CardTitle>
              <CardDescription className="text-purple-600">
                Interactive hierarchical view
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-sm text-gray-700 mb-4">
                View the organization chart with reporting lines, departments, and workload indicators.
              </p>
              <Button 
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => router.push('/dashboard/org-chart')}
              >
                Open Full View
              </Button>
            </CardContent>
          </Card>

          {/* 3D Galaxy Box (Placeholder) */}
          <Card className="hover:shadow-xl transition-shadow bg-white/80 backdrop-blur-sm border-indigo-200">
            <CardHeader className="bg-indigo-50/50">
              <CardTitle className="flex items-center gap-2 text-indigo-800">
                <FaStar />
                3D Galaxy View
              </CardTitle>
              <CardDescription className="text-indigo-600">
                Immersive network visualization
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-sm text-gray-700 mb-4">
                Explore organizational connections and data relationships in an immersive 3D space.
              </p>
              <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => router.push('/dashboard/galaxy-view')} 
              >
                Open 3D View
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 
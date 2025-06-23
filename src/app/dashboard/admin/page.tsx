'use client';
import React, { useState } from 'react';
import { FaSync, FaCog, FaServer, FaDatabase, FaUsers, FaCalendarCheck, FaKey } from 'react-icons/fa';
import Link from 'next/link';

export default function AdminPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState('');
  
  const triggerReportGeneration = async () => {
    if (!adminKey) {
      setError('Admin key is required');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch('/api/cron/manual-trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ adminKey })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger report generation');
      }
      
      setResult(data);
    } catch (error) {
      console.error('Error triggering reports:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          <span className="text-purple-700">Admin</span> Panel
        </h1>
        <p className="text-lg text-gray-600">
          Manage system settings and scheduled tasks
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link href="/dashboard" className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
          <FaUsers className="text-3xl text-purple-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Dashboard</h3>
          <p className="text-sm text-gray-600">Return to the main dashboard</p>
        </Link>
        
        <Link href="/dashboard/your-reports" className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
          <FaCalendarCheck className="text-3xl text-purple-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Scheduled Reports</h3>
          <p className="text-sm text-gray-600">View and manage automated reports</p>
        </Link>
        
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <FaDatabase className="text-3xl text-purple-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">System Status</h3>
          <p className="text-sm text-gray-600 mb-4">Gemini & Claude API keys configured in .env.local</p>
          <div className="flex space-x-2">
            <div className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">GEMINI_API_KEY: ✓</div>
            <div className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">CLAUDE_API_KEY: ✓</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <FaSync className="mr-2 text-purple-600" />
          Manual Report Generation
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Manually trigger the report generation process for all scheduled reports that are due.
          This is typically handled by a cron job on the server.
        </p>
        
        <div className="mb-4">
          <label htmlFor="adminKey" className="block text-sm font-medium text-gray-700 mb-1">
            Admin Key
          </label>
          <div className="flex items-center">
            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500">
              <FaKey className="h-4 w-4" />
            </span>
            <input
              type="password"
              id="adminKey"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="focus:ring-purple-500 focus:border-purple-500 flex-1 block w-full rounded-none rounded-r-md sm:text-sm border-gray-300"
              placeholder="Enter admin key"
            />
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={triggerReportGeneration}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                <FaSync className="mr-2" /> Trigger Report Generation
              </>
            )}
          </button>
        </div>
        
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <p>{error}</p>
          </div>
        )}
        
        {result && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Result</h3>
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              <p className="mb-2">{result.message}</p>
              <p>Processed: {result.details?.success || 0} successful, {result.details?.failed || 0} failed</p>
              
              {result.details?.details?.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2">Details:</h4>
                  <pre className="p-3 bg-white rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(result.details.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <FaCog className="mr-2 text-purple-600" />
          System Configuration
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          The system is configured to use both Claude (for query refinement) and Gemini (for final report generation).
          This allows for detailed, multi-page reports with departmental breakdowns and high-quality visuals.
        </p>
        
        <div className="mt-4 space-y-4">
          <div className="flex items-center text-sm text-gray-600">
            <FaServer className="mr-2 text-green-500" />
            <span>LLM for query generation: <strong>Claude 3.7 Sonnet</strong></span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <FaServer className="mr-2 text-green-500" />
            <span>LLM for report generation: <strong>Gemini 2.0 Pro</strong></span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <FaCalendarCheck className="mr-2 text-green-500" />
            <span>Automated report minimum length: <strong>10 pages</strong></span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <FaCalendarCheck className="mr-2 text-green-500" />
            <span>Department reports: <strong>2 pages per department</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
} 
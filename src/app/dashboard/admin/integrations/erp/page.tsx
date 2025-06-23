'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiArrowLeft, FiRefreshCw, FiDownload, FiSettings, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import Link from 'next/link';

interface ERPConnection {
  _id: string;
  orgId: string;
  type: 'SAP_HR' | 'ORACLE' | 'MICROSOFT_AD' | 'PEOPLESOFT' | 'WORKDAY';
  host: string;
  port?: number;
  username: string;
  lastSync: string;
  status: 'active' | 'inactive' | 'error';
  employeeCount: number;
  departmentCount: number;
  createdAt: string;
  errorMessage?: string;
}

interface SyncJob {
  _id: string;
  connectionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  recordsProcessed: number;
  errorMessage?: string;
}

export default function ERPDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [connection, setConnection] = useState<ERPConnection | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'syncHistory' | 'settings'>('overview');
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch connection details and sync history on load
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // In a real implementation, this would use the ID from params
        // For this demo, we'll fetch the first connection
        const response = await fetch('/api/admin/integrations/erp');
        
        if (!response.ok) {
          throw new Error('You do not have permission to access integration settings');
        }
        
        const data = await response.json();
        
        if (data.connections && data.connections.length > 0) {
          setConnection(data.connections[0]);
          
          // Fetch sync history
          const historyResponse = await fetch(`/api/admin/integrations/erp/${data.connections[0]._id}/sync-history`);
          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            setSyncHistory(historyData.jobs || []);
          }
        } else {
          router.push('/dashboard/admin/integrations');
        }
        
        setIsLoading(false);
      } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const syncData = async () => {
    if (!connection) return;
    
    setIsSyncing(true);
    
    try {
      const response = await fetch(`/api/admin/integrations/erp/${connection._id}/sync`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync data');
      }
      
      // Refresh connection data and sync history
      const connectionResponse = await fetch(`/api/admin/integrations/erp/${connection._id}`);
      const connectionData = await connectionResponse.json();
      setConnection(connectionData);
      
      const historyResponse = await fetch(`/api/admin/integrations/erp/${connection._id}/sync-history`);
      const historyData = await historyResponse.json();
      setSyncHistory(historyData.jobs || []);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const downloadEmployeeData = async () => {
    if (!connection) return;
    
    try {
      const response = await fetch(`/api/admin/integrations/erp/${connection._id}/export`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to export data');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `erp_employees_${connection.type.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (error) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Not Found: </strong>
          <span className="block sm:inline">The requested ERP connection was not found.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/admin/integrations" className="inline-flex items-center text-indigo-600 hover:text-indigo-900 mb-4">
          <FiArrowLeft className="mr-2" />
          Back to Integrations
        </Link>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div className={`h-12 w-12 rounded-md flex items-center justify-center mr-4 ${
              connection.status === 'active' ? 'bg-green-100' : 
              connection.status === 'error' ? 'bg-red-100' : 'bg-gray-100'
            }`}>
              {connection.type === 'SAP_HR' && 'SAP'}
              {connection.type === 'ORACLE' && 'ORC'}
              {connection.type === 'MICROSOFT_AD' && 'AD'}
              {connection.type === 'PEOPLESOFT' && 'PS'}
              {connection.type === 'WORKDAY' && 'WD'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{connection.type.replace('_', ' ')} Integration</h1>
              <p className="text-gray-500">{connection.host}{connection.port ? `:${connection.port}` : ''}</p>
            </div>
          </div>
          
          <div className={`text-sm font-medium rounded-full px-3 py-1 ${
            connection.status === 'active' 
              ? 'bg-green-100 text-green-800' 
              : connection.status === 'error'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
          }`}>
            {connection.status}
          </div>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex mb-6 space-x-4">
        <button
          onClick={syncData}
          disabled={isSyncing}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {isSyncing ? (
            <>
              <span className="animate-spin inline-block h-4 w-4 border-t-2 border-white rounded-full mr-2"></span>
              Syncing...
            </>
          ) : (
            <>
              <FiRefreshCw className="mr-2" />
              Sync Now
            </>
          )}
        </button>
        
        <button
          onClick={downloadEmployeeData}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <FiDownload className="mr-2" />
          Export Data
        </button>
      </div>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('syncHistory')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'syncHistory'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Sync History
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Settings
          </button>
        </nav>
      </div>
      
      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          <div className="bg-white shadow overflow-hidden rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Connection Details</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">Information about your ERP connection.</p>
            </div>
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">System Type</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{connection.type.replace('_', ' ')}</dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Host</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{connection.host}{connection.port ? `:${connection.port}` : ''}</dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Username</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{connection.username}</dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Last Sync</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(connection.lastSync)}</dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(connection.createdAt)}</dd>
                </div>
              </dl>
            </div>
          </div>
          
          {/* Statistics */}
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                    <svg className="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Employees
                      </dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-900">
                          {connection.employeeCount}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                    <svg className="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Departments
                      </dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-900">
                          {connection.departmentCount || 0}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Status Message */}
          {connection.status === 'error' && connection.errorMessage && (
            <div className="mt-6 bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <FiAlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">
                    {connection.errorMessage}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {connection.status === 'active' && (
            <div className="mt-6 bg-green-50 border-l-4 border-green-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <FiCheckCircle className="h-5 w-5 text-green-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">
                    Connection is active and working properly.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Sync History Tab */}
      {activeTab === 'syncHistory' && (
        <div className="bg-white shadow overflow-hidden rounded-md">
          <ul role="list" className="divide-y divide-gray-200">
            {syncHistory.length > 0 ? (
              syncHistory.map((job) => (
                <li key={job._id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Sync Job {job._id.substring(0, 8)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Started: {formatDate(job.startedAt)}
                        {job.completedAt && ` • Completed: ${formatDate(job.completedAt)}`}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm text-gray-500 mr-4">
                        {job.recordsProcessed} records processed
                      </span>
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        job.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : job.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : job.status === 'running'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                  </div>
                  {job.errorMessage && (
                    <div className="mt-2 text-sm text-red-600">
                      Error: {job.errorMessage}
                    </div>
                  )}
                </li>
              ))
            ) : (
              <li className="px-6 py-4 text-center text-gray-500">
                No sync history available.
              </li>
            )}
          </ul>
        </div>
      )}
      
      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Connection Settings</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Manage your ERP connection settings.</p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-900 mb-2">Sync Schedule</h4>
              <div className="bg-gray-50 p-4 rounded">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <input
                      id="auto-sync"
                      name="sync-schedule"
                      type="checkbox"
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      defaultChecked
                    />
                    <label htmlFor="auto-sync" className="ml-2 block text-sm text-gray-900">
                      Enable automatic synchronization
                    </label>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="frequency" className="block text-sm font-medium text-gray-700">Frequency</label>
                    <select
                      id="frequency"
                      name="frequency"
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                      defaultValue="daily"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="time" className="block text-sm font-medium text-gray-700">Time</label>
                    <input
                      type="time"
                      name="time"
                      id="time"
                      defaultValue="03:00"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-900 mb-2">Data Filter Options</h4>
              <div className="bg-gray-50 p-4 rounded">
                <div className="mb-4">
                  <label htmlFor="employeeFilter" className="block text-sm font-medium text-gray-700">Employee Status</label>
                  <select
                    id="employeeFilter"
                    name="employeeFilter"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    defaultValue="all"
                  >
                    <option value="all">All Employees</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Include Inactive</option>
                  </select>
                </div>
                
                <div className="mb-4">
                  <label htmlFor="dataFields" className="block text-sm font-medium text-gray-700">Data Fields to Import</label>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="basic-info"
                          name="basic-info"
                          type="checkbox"
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          defaultChecked
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="basic-info" className="font-medium text-gray-700">Basic Information</label>
                        <p className="text-gray-500">Name, employee ID, email, phone</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="department"
                          name="department"
                          type="checkbox"
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          defaultChecked
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="department" className="font-medium text-gray-700">Department & Hierarchy</label>
                        <p className="text-gray-500">Department, title, manager relationships</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="employment"
                          name="employment"
                          type="checkbox"
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          defaultChecked
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="employment" className="font-medium text-gray-700">Employment Details</label>
                        <p className="text-gray-500">Hire date, employment type, location</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="custom-fields"
                          name="custom-fields"
                          type="checkbox"
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="custom-fields" className="font-medium text-gray-700">Custom Fields</label>
                        <p className="text-gray-500">Import organization-specific custom fields</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <FiSettings className="mr-2" />
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
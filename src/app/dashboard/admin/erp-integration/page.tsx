'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiArrowLeft, FiRefreshCw, FiDownload, FiSettings, FiAlertTriangle, FiCheckCircle, FiTrash2, FiEdit, FiTimes } from 'react-icons/fi';
import Link from 'next/link';
import { UserRole, Permission, hasPermission } from '@/utils/roles';

interface ERPConnection {
  _id: string;
  orgId: string;
  type: 'SAP_HR' | 'MICROSOFT_AD' | 'PEOPLESOFT';
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

export default function AdminERPIntegrationPage() {
  const router = useRouter();
  const [connection, setConnection] = useState<ERPConnection | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'syncHistory' | 'settings'>('overview');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(UserRole.ADMIN);

  // Fetch connection details and sync history on load
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Get user role from localStorage
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setUserRole(user.role as UserRole || UserRole.ADMIN);
          
          // Check if user has admin permission
          const isAdmin = hasPermission(user.role as UserRole, Permission.ACCESS_SETTINGS);
          
          if (!isAdmin) {
            // Redirect to dashboard if not admin
            router.push('/dashboard');
            return;
          }
        }
        
        // Fetch connection
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

  const handleDeleteConnection = async () => {
    if (!connection) return;
    
    try {
      const response = await fetch(`/api/admin/integrations/erp/${connection._id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete connection');
      }
      
      // Redirect back to integrations page
      router.push('/dashboard/admin/integrations');
      
    } catch (err: any) {
      setError(err.message);
      setShowDeleteModal(false);
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
              {connection.type === 'MICROSOFT_AD' && 'AD'}
              {connection.type === 'PEOPLESOFT' && 'PS'}
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
        
        <button
          onClick={() => setShowEditModal(true)}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <FiEdit className="mr-2" />
          Edit Connection
        </button>
        
        <button
          onClick={() => setShowDeleteModal(true)}
          className="inline-flex items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <FiTrash2 className="mr-2" />
          Delete
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
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 bg-gray-50">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Connection Details</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Technical information about the ERP connection.
            </p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Connection Type</dt>
                <dd className="mt-1 text-sm text-gray-900">{connection.type.replace('_', ' ')}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1 text-sm text-gray-900 flex items-center">
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                    connection.status === 'active' ? 'bg-green-500' : 
                    connection.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                  }`}></span>
                  {connection.status}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Server Host</dt>
                <dd className="mt-1 text-sm text-gray-900">{connection.host}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Port</dt>
                <dd className="mt-1 text-sm text-gray-900">{connection.port || 'Default'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Username</dt>
                <dd className="mt-1 text-sm text-gray-900">{connection.username}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Synced</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(connection.lastSync)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Employee Count</dt>
                <dd className="mt-1 text-sm text-gray-900">{connection.employeeCount}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Department Count</dt>
                <dd className="mt-1 text-sm text-gray-900">{connection.departmentCount}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(connection.createdAt)}</dd>
              </div>
            </dl>
          </div>
          {connection.status === 'error' && connection.errorMessage && (
            <div className="bg-red-50 border-t border-red-200 px-4 py-3">
              <div className="flex">
                <div className="flex-shrink-0">
                  <FiAlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{connection.errorMessage}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Sync History Tab */}
      {activeTab === 'syncHistory' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 bg-gray-50">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Synchronization History</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Recent synchronization attempts with this ERP system.
            </p>
          </div>
          <div className="border-t border-gray-200">
            {syncHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Records
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {syncHistory.map((job) => {
                      const startDate = new Date(job.startedAt);
                      const endDate = job.completedAt ? new Date(job.completedAt) : null;
                      const duration = endDate ? Math.round((endDate.getTime() - startDate.getTime()) / 1000) : null;
                      
                      return (
                        <tr key={job._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(job.startedAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              job.status === 'completed' ? 'bg-green-100 text-green-800' :
                              job.status === 'failed' ? 'bg-red-100 text-red-800' :
                              job.status === 'running' ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {job.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {job.recordsProcessed}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {duration !== null ? `${duration} seconds` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No synchronization history found.
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 bg-gray-50">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Connection Settings</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Advanced settings for this ERP integration.
            </p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
            <div className="mb-6">
              <h4 className="text-base font-medium text-gray-800 mb-3">Synchronization Schedule</h4>
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex items-center mb-4">
                  <input
                    id="auto-sync"
                    name="auto-sync"
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    defaultChecked
                  />
                  <label htmlFor="auto-sync" className="ml-2 block text-sm text-gray-700">
                    Enable automatic synchronization
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="sync-frequency" className="block text-sm font-medium text-gray-700">
                      Frequency
                    </label>
                    <select
                      id="sync-frequency"
                      name="sync-frequency"
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
                    <label htmlFor="sync-time" className="block text-sm font-medium text-gray-700">
                      Time (UTC)
                    </label>
                    <input
                      type="time"
                      name="sync-time"
                      id="sync-time"
                      defaultValue="01:00"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-base font-medium text-gray-800 mb-3">Data Mapping</h4>
              <p className="text-sm text-gray-500 mb-4">
                Configure how ERP data fields map to application data fields.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ERP Field
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Application Field
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transformation
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {[
                      { erpField: 'EMPLOYEE_ID', appField: 'id', transform: 'None' },
                      { erpField: 'FIRST_NAME', appField: 'firstName', transform: 'None' },
                      { erpField: 'LAST_NAME', appField: 'lastName', transform: 'None' },
                      { erpField: 'EMAIL', appField: 'email', transform: 'Lowercase' },
                      { erpField: 'DEPARTMENT_ID', appField: 'departmentId', transform: 'None' },
                      { erpField: 'JOB_TITLE', appField: 'position', transform: 'None' },
                      { erpField: 'MANAGER_ID', appField: 'managerId', transform: 'None' }
                    ].map((mapping, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {mapping.erpField}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {mapping.appField}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {mapping.transform}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
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
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <FiAlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Delete ERP Connection
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete this ERP connection? This action cannot be undone.
                        All data synchronization will stop and any dependent features may become unavailable.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleDeleteConnection}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
              <div className="flex justify-between items-center bg-gray-50 px-4 py-3 border-b">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Edit ERP Connection
                </h3>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <span className="sr-only">Close</span>
                  <FiTimes className="h-6 w-6" />
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-4">
                  Edit connection form would go here in a real implementation.
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
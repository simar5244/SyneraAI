'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiArrowLeft, FiRefreshCw, FiAlertTriangle, FiCheckCircle, FiLock } from 'react-icons/fi';
import Link from 'next/link';
import { UserRole, Permission, hasPermission } from '@/utils/roles';

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

export default function EmployeesERPIntegrationPage() {
  const router = useRouter();
  const [connection, setConnection] = useState<ERPConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState<UserRole>(UserRole.EMPLOYEE);
  const [hasPermissionToSync, setHasPermissionToSync] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  // Fetch connection details on load
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Get user role from localStorage
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setUserRole(user.role as UserRole || UserRole.EMPLOYEE);
          
          // Check if user has permission to trigger sync
          const canSync = 
            hasPermission(user.role as UserRole, Permission.MANAGE_EMPLOYEES) ||
            hasPermission(user.role as UserRole, Permission.ACCESS_SETTINGS);
          
          setHasPermissionToSync(canSync);
        }
        
        // Fetch ERP connection
        const response = await fetch('/api/erp/status');
        
        if (!response.ok) {
          throw new Error('Failed to fetch ERP connection status');
        }
        
        const data = await response.json();
        
        if (data.connection) {
          setConnection(data.connection);
        } else {
          // No connection found
          router.push('/dashboard/employees');
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
    if (!connection || !hasPermissionToSync) return;
    
    setIsSyncing(true);
    setSyncStatus('syncing');
    setSyncMessage('');
    
    try {
      const response = await fetch(`/api/erp/sync`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync data');
      }
      
      const result = await response.json();
      
      // Update sync status
      setSyncStatus('success');
      setSyncMessage(result.message || 'Data synchronized successfully');
      
      // Refresh connection data
      const connectionResponse = await fetch('/api/erp/status');
      const connectionData = await connectionResponse.json();
      setConnection(connectionData.connection);
      
    } catch (err: any) {
      setSyncStatus('error');
      setSyncMessage(err.message);
    } finally {
      setIsSyncing(false);
      
      // Reset status after 5 seconds
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncMessage('');
      }, 5000);
    }
  };

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (error) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Not Connected: </strong>
          <span className="block sm:inline">No ERP connection has been established.</span>
          <Link href="/dashboard/employees" className="mt-3 inline-flex items-center text-yellow-700 hover:underline">
            <FiArrowLeft className="mr-2" size={16} />
            Return to Employees
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/employees" className="inline-flex items-center text-indigo-600 hover:text-indigo-900 mb-4">
          <FiArrowLeft className="mr-2" />
          Back to Employees
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
      
      {/* Sync Status */}
      {syncStatus !== 'idle' && (
        <div className={`mb-6 p-4 rounded-md ${
          syncStatus === 'syncing' ? 'bg-blue-50 text-blue-700' :
          syncStatus === 'success' ? 'bg-green-50 text-green-700' :
          'bg-red-50 text-red-700'
        }`}>
          <div className="flex items-center">
            {syncStatus === 'syncing' && (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current mr-2"></div>
            )}
            {syncStatus === 'success' && <FiCheckCircle className="mr-2" />}
            {syncStatus === 'error' && <FiAlertTriangle className="mr-2" />}
            <p>{syncMessage || (
              syncStatus === 'syncing' ? 'Synchronizing data...' :
              syncStatus === 'success' ? 'Synchronization successful' :
              'Synchronization failed'
            )}</p>
          </div>
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="flex mb-6 space-x-4">
        {hasPermissionToSync ? (
          <button
            onClick={syncData}
            disabled={isSyncing}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
          >
            {isSyncing ? (
              <>
                <span className="animate-spin inline-block h-4 w-4 border-t-2 border-white rounded-full mr-2"></span>
                Syncing...
              </>
            ) : (
              <>
                <FiRefreshCw className="mr-2" />
                Refresh Data
              </>
            )}
          </button>
        ) : (
          <button
            disabled
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-400 bg-gray-100 cursor-not-allowed"
          >
            <FiLock className="mr-2" />
            Restricted Action
          </button>
        )}
      </div>
      
      {/* Connection Details */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
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
      </div>
      
      {/* Error Message */}
      {connection.status === 'error' && connection.errorMessage && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiAlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{connection.errorMessage}</p>
              </div>
              <div className="mt-4">
                <div className="-mx-2 -my-1.5 flex">
                  <button
                    onClick={syncData}
                    disabled={isSyncing || !hasPermissionToSync}
                    className="bg-red-50 px-2 py-1.5 rounded-md text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Retry Sync
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Permissions Explanation */}
      {!hasPermissionToSync && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start">
            <FiLock className="h-5 w-5 text-gray-400 mt-0.5 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-gray-700">Limited Access</h3>
              <p className="mt-1 text-sm text-gray-500">
                You have view-only access to this ERP connection. Contact your administrator or manager
                if you need to refresh the data.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
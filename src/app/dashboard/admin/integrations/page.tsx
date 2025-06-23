'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FiCheck, FiX, FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';

interface ERPConnectionConfig {
  type: 'SAP_HR' | 'ORACLE' | 'MICROSOFT_AD' | 'PEOPLESOFT' | 'WORKDAY';
  host: string;
  port?: number;
  username: string;
  password: string;
  database?: string;
  apiKey?: string;
  domain?: string;
  useSsl?: boolean;
  additionalParams?: Record<string, any>;
}

interface ERPConnection {
  _id: string;
  orgId: string;
  type: 'SAP_HR' | 'ORACLE' | 'MICROSOFT_AD' | 'PEOPLESOFT' | 'WORKDAY';
  host: string;
  lastSync: string;
  status: 'active' | 'inactive' | 'error';
  employeeCount: number;
  createdAt: string;
}

export default function IntegrationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'configured' | 'available'>('configured');
  const [connections, setConnections] = useState<ERPConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ERPConnectionConfig['type']>('SAP_HR');
  const [formData, setFormData] = useState<ERPConnectionConfig>({
    type: 'SAP_HR',
    host: '',
    port: 443,
    username: '',
    password: '',
    useSsl: true
  });
  
  // Test connection states
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [submitMessage, setSubmitMessage] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Fetch existing connections on load
  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const fetchConnections = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/integrations/erp');
      
      if (!response.ok) {
        throw new Error('You do not have permission to access integration settings');
      }
      
      const data = await response.json();
      setConnections(data.connections || []);
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
      // Redirect to dashboard if not authorized
      if (err.message.includes('permission')) {
        router.push('/dashboard');
      }
    }
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (name === 'type') {
      const erpType = value as ERPConnectionConfig['type'];
      setSelectedType(erpType);
      // Reset form with appropriate defaults for the selected type
      setFormData({
        type: erpType,
        host: '',
        port: erpType === 'PEOPLESOFT' ? 8000 : 443,
        username: '',
        password: '',
        useSsl: true,
        ...(erpType === 'MICROSOFT_AD' ? { domain: '' } : {}),
        ...(erpType === 'SAP_HR' ? { 
          additionalParams: { clientId: '', systemNumber: '' } 
        } : {})
      });
      return;
    }
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : name === 'port' 
          ? parseInt(value, 10) 
          : value
    });
  };

  const handleNestedInputChange = (parentKey: string, key: string, value: string) => {
    setFormData({
      ...formData,
      [parentKey]: {
        ...formData[parentKey as keyof ERPConnectionConfig],
        [key]: value
      }
    });
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/admin/integrations/erp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      setTestResult({
        success: result.success,
        message: result.message
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Connection test failed. Please check your network connection and try again.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const saveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitMessage(null);
    
    try {
      const response = await fetch('/api/admin/integrations/erp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save connection');
      }
      
      const result = await response.json();
      
      setSubmitMessage({
        type: 'success',
        message: 'Connection saved successfully'
      });
      
      // Refresh connections list
      fetchConnections();
      
      // Close form after short delay
      setTimeout(() => {
        setIsFormOpen(false);
        resetForm();
      }, 2000);
      
    } catch (err: any) {
      setSubmitMessage({
        type: 'error',
        message: err.message
      });
    }
  };

  const syncData = async (connectionId: string) => {
    try {
      const response = await fetch(`/api/admin/integrations/erp/${connectionId}/sync`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync data');
      }
      
      // Refresh connections
      fetchConnections();
      
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/integrations/erp/${connectionId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete connection');
      }
      
      // Refresh connections
      fetchConnections();
      
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'SAP_HR',
      host: '',
      port: 443,
      username: '',
      password: '',
      useSsl: true
    });
    setTestResult(null);
    setSubmitMessage(null);
  };

  // Different fields based on ERP type
  const renderERPSpecificFields = () => {
    switch (formData.type) {
      case 'SAP_HR':
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Client ID</label>
              <input
                type="text"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="100"
                value={formData.additionalParams?.clientId || ''}
                onChange={(e) => handleNestedInputChange('additionalParams', 'clientId', e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">System Number</label>
              <input
                type="text"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="00"
                value={formData.additionalParams?.systemNumber || ''}
                onChange={(e) => handleNestedInputChange('additionalParams', 'systemNumber', e.target.value)}
              />
            </div>
          </>
        );
      case 'ORACLE':
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Database Name</label>
            <input
              type="text"
              name="database"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="HR_PROD"
              value={formData.database || ''}
              onChange={handleInputChange}
            />
          </div>
        );
      case 'MICROSOFT_AD':
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Domain</label>
            <input
              type="text"
              name="domain"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="example.com"
              value={formData.domain || ''}
              onChange={handleInputChange}
            />
          </div>
        );
      case 'WORKDAY':
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">API Key</label>
            <input
              type="text"
              name="apiKey"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="wday_api_xxxxxxxxxxxx"
              value={formData.apiKey || ''}
              onChange={handleInputChange}
            />
          </div>
        );
      default:
        return null;
    }
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

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">ERP Integrations</h1>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('configured')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'configured'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Configured Systems
          </button>
          <button
            onClick={() => setActiveTab('available')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'available'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Available Integrations
          </button>
        </nav>
      </div>
      
      {/* Configured Systems Tab */}
      {activeTab === 'configured' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-medium text-gray-900">Configured ERP Systems</h2>
            <button
              onClick={() => setIsFormOpen(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Connect New ERP
            </button>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : connections.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-gray-500 mb-4">No ERP systems have been configured yet.</p>
              <button
                onClick={() => setIsFormOpen(true)}
                className="inline-flex items-center bg-indigo-100 text-indigo-800 px-4 py-2 rounded-md hover:bg-indigo-200"
              >
                Connect your first ERP system
              </button>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden rounded-md">
              <ul role="list" className="divide-y divide-gray-200">
                {connections.map((connection) => (
                  <li key={connection._id} className="px-6 py-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className={`h-10 w-10 rounded-md flex items-center justify-center ${
                            connection.status === 'active' ? 'bg-green-100' : 
                            connection.status === 'error' ? 'bg-red-100' : 'bg-gray-100'
                          }`}>
                            {connection.type === 'SAP_HR' && 'SAP'}
                            {connection.type === 'ORACLE' && 'ORC'}
                            {connection.type === 'MICROSOFT_AD' && 'AD'}
                            {connection.type === 'PEOPLESOFT' && 'PS'}
                            {connection.type === 'WORKDAY' && 'WD'}
                          </div>
                        </div>
                        <div className="ml-4">
                          <h3 className="text-lg font-medium text-gray-900">{connection.type.replace('_', ' ')}</h3>
                          <p className="text-sm text-gray-500">{connection.host}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">{connection.employeeCount}</span> employees
                          </p>
                          <p className="text-xs text-gray-500">
                            Last synced: {new Date(connection.lastSync).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => syncData(connection._id)}
                            className="p-2 rounded-full text-gray-400 hover:text-indigo-600 hover:bg-gray-100"
                            title="Sync Data"
                          >
                            <FiRefreshCw />
                          </button>
                          <button 
                            onClick={() => deleteConnection(connection._id)}
                            className="p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-gray-100"
                            title="Delete Connection"
                          >
                            <FiX />
                          </button>
                        </div>
                        <div className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${
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
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {/* Available Integrations Tab */}
      {activeTab === 'available' && (
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-6">Available ERP Integrations</h2>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { 
                type: 'SAP_HR', 
                name: 'SAP HR', 
                description: 'Connect to SAP HR systems for employee and organizational data.',
                logo: '🔵'
              },
              { 
                type: 'ORACLE', 
                name: 'Oracle HCM', 
                description: 'Link to Oracle HCM for comprehensive HR data integration.',
                logo: '🔴'
              },
              { 
                type: 'MICROSOFT_AD', 
                name: 'Microsoft Active Directory', 
                description: 'Connect to your AD environment for users and hierarchy data.',
                logo: '🟠'
              },
              { 
                type: 'PEOPLESOFT', 
                name: 'PeopleSoft', 
                description: 'Integrate with PeopleSoft HCM for organizational structure.',
                logo: '🟢'
              },
              { 
                type: 'WORKDAY', 
                name: 'Workday', 
                description: 'Connect to Workday for modern HR data integration.',
                logo: '🟣'
              }
            ].map((integration) => (
              <div key={integration.type} className="bg-white overflow-hidden shadow rounded-lg divide-y divide-gray-200">
                <div className="px-6 py-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 text-3xl">{integration.logo}</div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">{integration.name}</h3>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-500">{integration.description}</p>
                </div>
                <div className="px-6 py-3 bg-gray-50">
                  <button
                    onClick={() => {
                      setSelectedType(integration.type as ERPConnectionConfig['type']);
                      setFormData({
                        ...formData,
                        type: integration.type as ERPConnectionConfig['type']
                      });
                      setIsFormOpen(true);
                    }}
                    className="w-full text-center text-sm text-indigo-600 hover:text-indigo-900 font-medium"
                  >
                    Configure Integration
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* New Connection Form */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative mx-auto p-5 border w-full max-w-md bg-white rounded-md shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Connect to {selectedType.replace('_', ' ')}
              </h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-500"
                onClick={() => setIsFormOpen(false)}
              >
                <span className="sr-only">Close</span>
                <FiX className="h-6 w-6" />
              </button>
            </div>
            
            {submitMessage && (
              <div 
                className={`mb-4 p-2 rounded ${
                  submitMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {submitMessage.message}
              </div>
            )}
            
            <form onSubmit={saveConnection}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">ERP System</label>
                <select
                  name="type"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.type}
                  onChange={handleInputChange}
                >
                  <option value="SAP_HR">SAP HR</option>
                  <option value="ORACLE">Oracle HCM</option>
                  <option value="MICROSOFT_AD">Microsoft Active Directory</option>
                  <option value="PEOPLESOFT">PeopleSoft</option>
                  <option value="WORKDAY">Workday</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Host</label>
                <input
                  type="text"
                  name="host"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="erp.example.com"
                  value={formData.host}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Port</label>
                <input
                  type="number"
                  name="port"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="443"
                  value={formData.port}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <input
                  type="text"
                  name="username"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="admin"
                  value={formData.username}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange}
                />
              </div>
              
              {/* Dynamic fields based on ERP type */}
              {renderERPSpecificFields()}
              
              <div className="mb-4 flex items-center">
                <input
                  type="checkbox"
                  id="useSsl"
                  name="useSsl"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  checked={formData.useSsl}
                  onChange={handleInputChange}
                />
                <label htmlFor="useSsl" className="ml-2 block text-sm text-gray-900">
                  Use SSL/TLS
                </label>
              </div>
              
              {/* Test Connection Result */}
              {testResult && (
                <div className={`mb-4 p-3 rounded flex items-start ${
                  testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  {testResult.success ? 
                    <FiCheck className="h-5 w-5 mr-2 mt-0.5" /> : 
                    <FiAlertTriangle className="h-5 w-5 mr-2 mt-0.5" />
                  }
                  <div className="text-sm">{testResult.message}</div>
                </div>
              )}
              
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={testConnection}
                  disabled={isTesting}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {isTesting ? (
                    <>
                      <span className="animate-spin inline-block h-4 w-4 border-t-2 border-gray-500 rounded-full mr-2"></span>
                      Testing...
                    </>
                  ) : 'Test Connection'}
                </button>
                
                <div>
                  <button
                    type="button"
                    className="bg-white mr-2 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    onClick={() => setIsFormOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    disabled={!testResult?.success}
                  >
                    Save Connection
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 
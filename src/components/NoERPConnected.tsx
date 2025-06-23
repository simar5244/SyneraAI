'use client';

import React, { useState, useEffect } from 'react';
import { MdOutlineIntegrationInstructions } from 'react-icons/md';
import { BsCashStack, BsShieldLock, BsUpload } from 'react-icons/bs';
import { FiArrowLeft } from 'react-icons/fi';
import { HiOutlineServerStack } from 'react-icons/hi2';
import { useRouter } from 'next/navigation';
import { hasERPConnections } from '@/lib/dataProvider';
import { CSVUploadForm } from './CSVUploadForm';

interface NoERPConnectedProps {
  onConnectClick?: () => void;
  showConnectButton?: boolean;
}

export default function NoERPConnected({ onConnectClick, showConnectButton = false }: NoERPConnectedProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'benefits' | 'security' | 'steps' | 'connections'>('overview');
  const [showContactForm, setShowContactForm] = useState(false);
  const [selectedERPSystem, setSelectedERPSystem] = useState<string | null>(null);
  const [showCSVUpload, setShowCSVUpload] = useState(false);

  // ERP connection form state and status
  const [erpFormData, setErpFormData] = useState({host: '', port: '', database: '', username: '', password: '', systemId: '', domain: ''});
  const [connectionStatus, setConnectionStatus] = useState<'idle'|'connecting'|'success'|'error'>('idle');
  const [connectionErrorMessage, setConnectionErrorMessage] = useState('');

  const handleConnectButtonClick = () => {
    setSelectedERPSystem(null);
    setShowCSVUpload(false);
    setShowContactForm(true);
    
    if (onConnectClick) {
      onConnectClick();
    }
  };

  const getERPSystemName = (type: string): string => {
    switch (type) {
      case 'SAP_HR':
        return 'SAP HR';
      case 'MICROSOFT_AD':
        return 'Microsoft Active Directory';
      case 'PEOPLESOFT':
        return 'PeopleSoft';
      case 'CSV_UPLOAD':
        return 'CSV File Upload';
      default:
        return type;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setErpFormData(prev => ({ ...prev, [name]: value }));
  };

  const getRequiredFields = () => {
    switch (selectedERPSystem) {
      case 'SAP_HR': return { host: true, port: true, username: true, password: true, systemId: true };
      case 'MICROSOFT_AD': return { domain: true, username: true, password: true };
      case 'PEOPLESOFT': return { host: true, username: true, password: true };
      default: return {};
    }
  };

  const connectToERP = async () => {
    setConnectionStatus('connecting'); setConnectionErrorMessage('');
    const required = getRequiredFields();
    const missing = Object.entries(required).filter(([k,req])=>req && !erpFormData[k as keyof typeof erpFormData]).map(([k])=>k);
    if (missing.length) {
      setConnectionStatus('error'); setConnectionErrorMessage(`Missing: ${missing.join(', ')}`); return;
    }
    let payload: any = {};
    switch (selectedERPSystem) {
      case 'SAP_HR': payload = { host: erpFormData.host, port: erpFormData.port, username: erpFormData.username, password: erpFormData.password, systemId: erpFormData.systemId }; break;
      case 'MICROSOFT_AD': payload = { domain: erpFormData.domain, username: erpFormData.username, password: erpFormData.password }; break;
      case 'PEOPLESOFT': payload = { host: erpFormData.host, username: erpFormData.username, password: erpFormData.password }; break;
    }
    try {
      const res = await fetch('/api/erp/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: selectedERPSystem, ...payload }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || result.message || 'Unauthorized');
      if (result.success) {
        setConnectionStatus('success');
        setTimeout(() => { setShowContactForm(false); setConnectionStatus('idle'); }, 1500);
      } else {
        setConnectionStatus('error'); setConnectionErrorMessage(result.message || 'Failed');
      }
    } catch (err: any) {
      setConnectionStatus('error'); setConnectionErrorMessage(err.message || 'Error');
    }
  };

  // Load uploads history and connection status
  const [uploads, setUploads] = useState<{filename: string; uploadedAt: string}[]>([]);
  const [connectionsActive, setConnectionsActive] = useState(false);
  useEffect(() => {
    fetch('/api/erp/csv-upload')
      .then(res => res.json())
      .then(data => setUploads(data))
      .catch(console.error);
    hasERPConnections()
      .then(h => setConnectionsActive(h))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (activeTab !== 'connections') return;
    fetch('/api/erp/csv-upload')
      .then((res) => res.json())
      .then((data) => setUploads(data))
      .catch(console.error);
    hasERPConnections()
      .then((h) => setConnectionsActive(h))
      .catch(console.error);
  }, [activeTab]);

  // Prepare the navigation tabs, only show 'connections' if user has uploads or active connections
  const tabs = [
    { id: 'overview', label: 'Overview', icon: MdOutlineIntegrationInstructions },
    { id: 'benefits', label: 'Benefits', icon: BsCashStack },
    { id: 'security', label: 'Security', icon: BsShieldLock },
    { id: 'steps', label: 'Integration Steps', icon: MdOutlineIntegrationInstructions },
    { id: 'connections', label: 'Upload History', icon: BsUpload, show: uploads.length > 0 || connectionsActive }
  ];

  // Add displayName for debugging
  NoERPConnected.displayName = 'NoERPConnected';
  
  console.log('NoERPConnected rendering, showContactForm:', showContactForm, 'showCSVUpload:', showCSVUpload);
  
  return (
    <>
      <div className="bg-white rounded-xl shadow-md mx-4 mt-4 overflow-hidden" style={{display: 'block', visibility: 'visible'}}>
        <div className="bg-gradient-to-r from-indigo-700 to-purple-800 p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">ERP Integration Required</h1>
          <p className="text-indigo-100 max-w-3xl">
            Connect your organization's Enterprise Resource Planning system to unlock comprehensive data visualization.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleConnectButtonClick}
            className="px-5 py-2 bg-white text-indigo-700 rounded-md hover:bg-indigo-50 transition-colors text-sm font-medium"
          >
            Connect ERP System
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          {tabs.map((tab) => (
            // Only render the 'connections' tab if show is truthy
            tab.show === false ? null : (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center py-4 px-6 text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="mr-2" size={18} />
              {tab.label}
            </button>
            )
          ))}
        </nav>
      </div>

      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="max-w-3xl">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">What is ERP Integration?</h2>
              <p className="text-gray-600 mb-4">
                Enterprise Resource Planning (ERP) integration allows this application to securely connect to your 
                organization's data systems.
              </p>
              <p className="text-sm text-gray-500">
                
              </p>
            </div>
          </div>
        )}

        {activeTab === 'benefits' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Benefits of ERP Integration</h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  title: "Real-time Data Visualization",
                  description: "Access up-to-date visualizations of your organization's structure and relationships."
                },
                {
                  title: "Secure Information Flow",
                  description: "Military-grade encryption ensures your organizational data remains protected."
                },
                {
                  title: "Project Resource Allocation",
                  description: "Visualize how resources are allocated across projects and departments."
                },
                {
                  title: "Hierarchical Mapping",
                  description: "Interactive tree and network visualizations of your command structure."
                },
                {
                  title: "Personnel Analytics",
                  description: "Gain insights into expertise distribution and specialized capabilities."
                },
                {
                  title: "Strategic Decision Support",
                  description: "Enhanced decision-making with comprehensive organizational data."
                }
              ].map((benefit, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center mb-3">
                    <h3 className="ml-2 font-medium text-gray-800">{benefit.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Security and Compliance</h2>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <div>
                  <h3 className="font-medium text-blue-800 mb-1">Military-Grade Security</h3>
                  <p className="text-sm text-gray-700">
                    Our integration uses AES-256 encryption, secure token authentication, and follows strict 
                    security protocols designed for military and government applications.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-800 mb-3">Security Features</h3>
                <ul className="space-y-3">
                  {[
                    "End-to-end encryption for all data transfers",
                    "Role-based access control with multi-factor authentication",
                    "Isolated secure channels for sensitive information",
                    "Regular security audits and penetration testing"
                  ].map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <BsShieldLock className="text-green-600 mr-2 flex-shrink-0" size={16} />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-800 mb-3">Compliance Standards</h3>
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200">
                  {[
                    { standard: "FIPS 140-2", status: "Validated" },
                    { standard: "Zero Trust Architecture", status: "Implemented" }
                  ].map((item, index) => (
                    <div key={index} className="flex justify-between items-center px-4 py-3">
                      <span className="text-sm font-medium text-gray-700">{item.standard}</span>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'steps' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Integration Process</h2>
            
            <div className="space-y-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-600 text-white">
                    1
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Select your ERP system</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Choose from SAP HR, Microsoft Active Directory, PeopleSoft, or use CSV file upload.
                  </p>
                </div>
              </div>
              
              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-600 text-white">
                    2
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Provide connection details</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Enter your ERP system credentials and connection information.
                  </p>
                </div>
              </div>
              
              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-600 text-white">
                    3
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Verify and connect</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Approve the connection and begin data synchronization.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'connections' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">ERP Connections</h2>
              <p className={`text-sm ${connectionsActive ? 'text-green-600' : 'text-red-600'}`}>
                {connectionsActive ? 'Active connections' : 'No active connections'}
              </p>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Upload History</h2>
              {uploads.length === 0 ? (
                <p className="text-sm text-gray-700">No uploads</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {uploads.map(file => (
                    <li key={`${file.filename}-${file.uploadedAt}`} className="py-2 flex justify-between items-center">
                      <a
                        href={`/api/erp/csv-upload?filename=${encodeURIComponent(file.filename)}`}
                        className="text-indigo-600 hover:underline text-sm font-medium"
                      >
                        {file.filename}
                      </a>
                      <span className="text-xs text-gray-500">{new Date(file.uploadedAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {showContactForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="bg-white rounded-lg shadow-xl z-10 w-full max-w-md p-6 relative">
              <button
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                onClick={() => setShowContactForm(false)}
              >
                ✕
              </button>
              
              {!showCSVUpload ? (
                <div>
                  {!selectedERPSystem ? (
                    <>
                      <h2 className="text-xl font-semibold mb-4">Connect an ERP System</h2>
                      <div className="grid grid-cols-1 gap-3 mt-4">
                        {['SAP_HR', 'MICROSOFT_AD', 'PEOPLESOFT', 'CSV_UPLOAD'].map((system) => (
                          <button
                            key={system}
                            type="button"
                            onClick={() => {
                              if (system === 'CSV_UPLOAD') {
                                setShowCSVUpload(true);
                              } else {
                                setSelectedERPSystem(system);
                              }
                            }}
                            className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <div className="bg-indigo-100 p-2 rounded-md">
                              {system === 'CSV_UPLOAD' ? (
                                <BsUpload className="h-6 w-6 text-indigo-600" />
                              ) : (
                                <HiOutlineServerStack className="h-6 w-6 text-indigo-600" />
                              )}
                            </div>
                            <div className="ml-3 text-left">
                              <span className="font-medium text-gray-800">{getERPSystemName(system)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center mb-4">
                        <button 
                          type="button" 
                          onClick={() => setSelectedERPSystem(null)}
                          className="text-indigo-600 hover:text-indigo-800 flex items-center mr-4"
                        >
                          <FiArrowLeft className="mr-1" />
                          Back
                        </button>
                        <h3 className="text-lg font-medium text-gray-900">
                          Connect to {getERPSystemName(selectedERPSystem)}
                        </h3>
                      </div>
                      
                      <form className="space-y-4" onSubmit={e => { e.preventDefault(); connectToERP(); }}>
                        {connectionStatus === 'error' && (
                          <div className="p-2 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                            {connectionErrorMessage}
                          </div>
                        )}
                        {connectionStatus === 'success' && (
                          <div className="p-2 bg-green-100 border border-green-400 text-green-700 rounded text-sm">
                            Successfully connected to {getERPSystemName(selectedERPSystem || '')}.
                          </div>
                        )}
                        {selectedERPSystem === 'SAP_HR' && (
                          <>
                            <div>
                              <label htmlFor="host" className="block text-sm font-medium text-gray-700">SAP Server Host</label>
                              <input
                                type="text"
                                id="host"
                                name="host"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                value={erpFormData.host}
                                onChange={handleInputChange}
                                required
                              />
                            </div>
                            <div>
                              <label htmlFor="port" className="block text-sm font-medium text-gray-700">Port</label>
                              <input
                                type="text"
                                id="port"
                                name="port"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                value={erpFormData.port}
                                onChange={handleInputChange}
                                required
                              />
                            </div>
                            <div>
                              <label htmlFor="systemId" className="block text-sm font-medium text-gray-700">System ID</label>
                              <input
                                type="text"
                                id="systemId"
                                name="systemId"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                value={erpFormData.systemId}
                                onChange={handleInputChange}
                                required
                              />
                            </div>
                            <div>
                              <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
                              <input
                                type="text"
                                id="username"
                                name="username"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                value={erpFormData.username}
                                onChange={handleInputChange}
                                required
                              />
                            </div>
                            <div>
                              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                              <input
                                type="password"
                                id="password"
                                name="password"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                value={erpFormData.password}
                                onChange={handleInputChange}
                                required
                              />
                            </div>
                          </>
                        )}
                        
                        {selectedERPSystem === 'MICROSOFT_AD' && (
                          <>
                            <div>
                              <label htmlFor="domain" className="block text-sm font-medium text-gray-700">Domain</label>
                              <input
                                type="text"
                                id="domain"
                                name="domain"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                value={erpFormData.domain}
                                onChange={handleInputChange}
                                required
                              />
                            </div>
                            <div>
                              <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
                              <input
                                type="text"
                                id="username"
                                name="username"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                value={erpFormData.username}
                                onChange={handleInputChange}
                                required
                              />
                            </div>
                            <div>
                              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                              <input
                                type="password"
                                id="password"
                                name="password"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                value={erpFormData.password}
                                onChange={handleInputChange}
                                required
                              />
                            </div>
                          </>
                        )}
                        
                        {selectedERPSystem === 'PEOPLESOFT' && (
                          <>
                            <div>
                              <label htmlFor="host" className="block text-sm font-medium text-gray-700">Server Host</label>
                              <input
                                type="text"
                                id="host"
                                name="host"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                value={erpFormData.host}
                                onChange={handleInputChange}
                                required
                              />
                            </div>
                            <div>
                              <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
                              <input
                                type="text"
                                id="username"
                                name="username"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                value={erpFormData.username}
                                onChange={handleInputChange}
                                required
                              />
                            </div>
                            <div>
                              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                              <input
                                type="password"
                                id="password"
                                name="password"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                value={erpFormData.password}
                                onChange={handleInputChange}
                                required
                              />
                            </div>
                          </>
                        )}
                        
                        <div className="flex justify-end space-x-3 pt-4">
                          <button
                            type="button"
                            onClick={() => setSelectedERPSystem(null)}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={connectionStatus === 'connecting'}
                            className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 ${connectionStatus === 'connecting' ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect'}
                          </button>
                        </div>
                      </form>
                    </>
                  )}
                </div>
              ) : (
                <div className="p-4">
                  <button
                    type="button"
                    onClick={() => setShowCSVUpload(false)}
                    className="flex items-center text-gray-700 hover:text-gray-900 mb-4"
                  >
                    <FiArrowLeft className="mr-2" /> Back to ERP options
                  </button>
                  <CSVUploadForm onSuccess={() => { setShowCSVUpload(false); setShowContactForm(false); }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
} 
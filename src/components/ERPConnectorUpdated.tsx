'use client';

import React, { useState } from 'react';
import { MdOutlineIntegrationInstructions } from 'react-icons/md';
import { BsCashStack, BsShieldLock, BsUpload } from 'react-icons/bs';
import { FiArrowLeft, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { HiOutlineServerStack } from 'react-icons/hi2';
import { useRouter } from 'next/navigation';
import { CSVUploadForm } from './CSVUploadForm';
import { Button } from "@/components/ui/button";

interface ERPConnectorProps {
  onConnectClick?: () => void;
  showConnectButton?: boolean;
  className?: string;
}

export default function ERPConnector({ 
  onConnectClick, 
  showConnectButton = true,
  className = ""
}: ERPConnectorProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'benefits' | 'security' | 'steps'>('overview');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedERPSystem, setSelectedERPSystem] = useState<string | null>(null);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState('');
  const [erpFormData, setErpFormData] = useState({
    host: '',
    username: '',
    password: '',
    domain: '',
    apiKey: '',
    systemId: '',
    clientNumber: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setErpFormData({
      ...erpFormData,
      [name]: value
    });
  };

  const handleConnectButtonClick = () => {
    setSelectedERPSystem(null);
    setShowCSVUpload(false);
    setConnectionStatus('idle');
    setConnectionError('');
    setShowConnectModal(true);
    
    if (onConnectClick) {
      onConnectClick();
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectionStatus('connecting');
    
    try {
      // Simulate connection API call
      setTimeout(() => {
        if (Math.random() > 0.3) {
          setConnectionStatus('success');
          setTimeout(() => {
            setShowConnectModal(false);
            router.push('/dashboard');
          }, 2000);
        } else {
          setConnectionStatus('error');
          setConnectionError('Failed to connect. Please check your credentials and try again.');
        }
      }, 1500);
    } catch (error) {
      setConnectionStatus('error');
      setConnectionError('An unexpected error occurred');
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

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      <div className="bg-gradient-to-r from-indigo-700 to-purple-800 p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">ERP Integration Required</h1>
        <p className="text-indigo-100 max-w-3xl">
          Connect your organization's Enterprise Resource Planning system to unlock comprehensive data visualization.
        </p>
        {showConnectButton && (
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleConnectButtonClick}
              className="px-5 py-2 bg-white text-indigo-700 rounded-md hover:bg-indigo-50 transition-colors text-sm font-medium"
            >
              Connect ERP System
            </button>
          </div>
        )}
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex -mb-px overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: HiOutlineServerStack },
            { id: 'benefits', label: 'Benefits', icon: BsCashStack },
            { id: 'security', label: 'Security', icon: BsShieldLock },
            { id: 'steps', label: 'Integration Steps', icon: MdOutlineIntegrationInstructions }
          ].map((tab) => (
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
                organization's data systems. This provides comprehensive employee data management and visualization.
              </p>
              <Button
                onClick={handleConnectButtonClick}
                className="mt-2"
              >
                Connect to ERP System
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'benefits' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Benefits of ERP Integration</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                "Real-time employee data synchronization",
                "Automated organizational structure visualization",
                "Seamless project and resource allocation tracking",
                "Comprehensive skills and expertise mapping",
                "Secure and compliant data exchange",
                "Simplified HR analytics and reporting"
              ].map((benefit, index) => (
                <div key={index} className="flex items-start p-4 border border-gray-200 rounded-lg">
                  <FiCheckCircle className="text-green-500 mt-0.5 mr-3" size={18} />
                  <p className="text-gray-700">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Security and Compliance</h2>
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
              <p className="text-gray-700">
                Our ERP integration uses industry-standard security protocols including encryption, 
                secure authentication, and strict access controls to protect your organization's data.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                "End-to-end encryption for all data transfers",
                "Role-based access control",
                "Regular security audits and testing",
                "Compliance with data protection regulations",
                "Secure API integration with minimal permissions",
                "No storage of ERP credentials"
              ].map((feature, index) => (
                <div key={index} className="flex items-start">
                  <BsShieldLock className="text-indigo-600 mt-0.5 mr-2" size={16} />
                  <p className="text-gray-700 text-sm">{feature}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'steps' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Integration Process</h2>
            <ol className="space-y-4 ml-5 list-decimal">
              <li className="text-gray-700">Select your ERP system from our supported integrations</li>
              <li className="text-gray-700">Provide necessary connection details or upload a CSV file</li>
              <li className="text-gray-700">Review data mapping and field configuration</li>
              <li className="text-gray-700">Complete integration and start using enhanced features</li>
            </ol>
            <Button
              onClick={handleConnectButtonClick}
              className="mt-4"
            >
              Start Integration
            </Button>
          </div>
        )}
      </div>

      {showConnectModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="bg-white rounded-lg shadow-xl z-10 w-full max-w-md p-6 relative">
              <button
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                onClick={() => setShowConnectModal(false)}
              >
                ✕
              </button>
              
              {connectionStatus === 'success' && (
                <div className="text-center py-6">
                  <FiCheckCircle className="mx-auto h-16 w-16 text-green-500" />
                  <h3 className="text-lg font-medium text-gray-900 mt-4">Connection Successful!</h3>
                  <p className="text-gray-600 mt-2">
                    Your ERP system has been connected successfully. You'll be redirected to the dashboard shortly.
                  </p>
                </div>
              )}
              
              {connectionStatus === 'error' && (
                <div className="text-center py-6">
                  <FiAlertTriangle className="mx-auto h-16 w-16 text-red-500" />
                  <h3 className="text-lg font-medium text-gray-900 mt-4">Connection Failed</h3>
                  <p className="text-gray-600 mt-2">
                    {connectionError || 'There was an error connecting to your ERP system. Please try again.'}
                  </p>
                  <Button
                    onClick={() => setConnectionStatus('idle')}
                    className="mt-4"
                    variant="outline"
                  >
                    Try Again
                  </Button>
                </div>
              )}
              
              {connectionStatus === 'connecting' && (
                <div className="text-center py-10">
                  <div className="inline-block h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <h3 className="text-lg font-medium text-gray-900 mt-4">Connecting...</h3>
                  <p className="text-gray-600 mt-2">
                    Establishing connection to your ERP system. This may take a moment.
                  </p>
                </div>
              )}
              
              {connectionStatus === 'idle' && !showCSVUpload && selectedERPSystem === null && (
                <>
                  <h2 className="text-xl font-semibold mb-4">Connect an ERP System</h2>
                  <div className="grid grid-cols-1 gap-3 mt-4">
                    {['SAP_HR', 'MICROSOFT_AD', 'PEOPLESOFT', 'CSV_UPLOAD'].map((system) => (
                      <button
                        key={system}
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
              )}
              
              {connectionStatus === 'idle' && !showCSVUpload && selectedERPSystem !== null && (
                <form onSubmit={handleConnect} className="space-y-4">
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
                  
                  <div>
                    <label htmlFor="host" className="block text-sm font-medium text-gray-700">Server Host</label>
                    <input
                      type="text"
                      id="host"
                      name="host"
                      value={erpFormData.host}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
                    <input
                      type="text"
                      id="username"
                      name="username"
                      value={erpFormData.username}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={erpFormData.password}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                      required
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowConnectModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      Connect
                    </Button>
                  </div>
                </form>
              )}
              
              {showCSVUpload && (
                <div>
                  <div className="flex items-center mb-4">
                    <button 
                      type="button" 
                      onClick={() => setShowCSVUpload(false)}
                      className="text-indigo-600 hover:text-indigo-800 flex items-center mr-4"
                    >
                      <FiArrowLeft className="mr-1" />
                      Back
                    </button>
                    <h3 className="text-lg font-medium text-gray-900">
                      Upload Employee Data (CSV)
                    </h3>
                  </div>
                  <CSVUploadForm />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
//DISCARD THIS PAGE. IT IS NOT USED.

'use client';

import React, { useState } from 'react';
import { MdOutlineIntegrationInstructions } from 'react-icons/md';
import { BsCashStack, BsShieldLock, BsUpload } from 'react-icons/bs';
import { FiArrowLeft } from 'react-icons/fi';
import { HiOutlineServerStack } from 'react-icons/hi2';
import { useRouter } from 'next/navigation';
import { CSVUploadForm } from './CSVUploadForm';

interface NoERPConnectedProps {
  onConnectClick?: () => void;
  showConnectButton?: boolean;
}

export default function NoERPConnectedSimple({ onConnectClick, showConnectButton = false }: NoERPConnectedProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'benefits' | 'security' | 'steps'>('overview');
  const [showContactForm, setShowContactForm] = useState(false);
  const [selectedERPSystem, setSelectedERPSystem] = useState<string | null>(null);
  const [showCSVUpload, setShowCSVUpload] = useState(false);

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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
        <div className="space-y-6">
          <div className="max-w-3xl">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">What is ERP Integration?</h2>
            <p className="text-gray-600 mb-4">
              Enterprise Resource Planning (ERP) integration allows this application to securely connect to your 
              organization's data systems.
            </p>
            <button
              onClick={() => setShowContactForm(true)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Connect to ERP System
            </button>
          </div>
        </div>
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
                  <h2 className="text-xl font-semibold mb-4 text-black">Connect an ERP System</h2>
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
                            // For simplicity, just close the form and show success
                            setTimeout(() => {
                              setShowContactForm(false);
                              router.push('/dashboard');
                            }, 1000);
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
                </div>
              ) : (
                <div>
                  <div className="flex items-center mb-4">
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowCSVUpload(false);
                      }}
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
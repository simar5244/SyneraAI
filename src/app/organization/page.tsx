'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import GalaxyView from '@/components/visualization/GalaxyView';
import NetworkChart from '@/components/visualization/NetworkChart';
import OrgTree from '@/components/visualization/OrgTree';
import { FaBars, FaTimes, FaProjectDiagram, FaUserFriends, FaDatabase, FaSignOutAlt, FaTachometerAlt, FaGlobe, FaExclamationTriangle } from 'react-icons/fa';
import Image from 'next/image';
import { isMockDataUser, hasERPConnections } from '@/lib/dataProvider';
import NoERPConnected from '@/components/NoERPConnected';

type TabType = 'erp' | 'galaxy' | 'tree' | 'network';

export default function OrganizationPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('galaxy');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [hasRealData, setHasRealData] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [canConnectERP, setCanConnectERP] = useState(false);

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const mockDataFlag = localStorage.getItem('useMockData') === 'true';
    
    if (!token) {
      router.push('/login');
      return;
    }
    
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      
      // Check if user role can connect to ERP
      const userRole = parsedUser.role?.toLowerCase() || '';
      const canConnectToERP = ['admin', 'top_management'].includes(userRole);
      setCanConnectERP(canConnectToERP);
      
      // Check if user is using mock data
      const mockUser = isMockDataUser();
      setUsingMockData(mockUser);
      
      // If mock data flag is set or using mock user, default to galaxy view
      if (mockUser || mockDataFlag) {
        setHasRealData(true);
        setActiveTab('galaxy');
        setIsLoading(false);
      }
      // If real user, check for ERP connections
      else if (!mockUser) {
        hasERPConnections().then(connected => {
          setHasRealData(connected);
          setIsLoading(false);
          
          // If has real connections, default to galaxy view
          if (connected) {
            setActiveTab('galaxy');
          }
        });
      } else {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }

    // Check for token in URL params (from Google redirect)
    const searchParams = new URLSearchParams(window.location.search);
    const tokenParam = searchParams.get('token');

    if (tokenParam) {
      localStorage.setItem('token', tokenParam);
      // Remove token from URL to prevent security issues
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white shadow-lg transition-all duration-300 z-10 flex flex-col`}>
        <div className="p-4 flex items-center justify-between border-b">
          {sidebarOpen ? (
            <h1 className="text-xl font-semibold text-gray-800">Organization Galaxy</h1>
          ) : (
            <h1 className="text-xl font-semibold text-gray-800">OG</h1>
          )}
          <button 
            onClick={toggleSidebar}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
          >
            {sidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>

        <div className="flex-grow py-6 px-4 space-y-1 overflow-y-auto">
          <button
            onClick={() => router.push('/dashboard')}
            className={`flex items-center w-full p-3 rounded-md hover:bg-gray-100 transition-colors 
              ${sidebarOpen ? 'justify-start space-x-3' : 'justify-center'}`}
          >
            <FaTachometerAlt className="text-gray-600" />
            {sidebarOpen && <span className="text-gray-700">Dashboard</span>}
          </button>

          <div className="pt-4 pb-2">
            {sidebarOpen && <p className="px-3 text-xs font-semibold text-gray-500 uppercase">Organization</p>}
            <div className="h-px bg-gray-200 my-2"></div>
          </div>

          {/* Only show ERP tab for users who can connect to ERP (admin or top_management) */}
          {!usingMockData && canConnectERP && (
            <button
              onClick={() => setActiveTab('erp')}
              className={`flex items-center w-full p-3 rounded-md transition-colors 
                ${activeTab === 'erp' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-700'}
                ${sidebarOpen ? 'justify-start space-x-3' : 'justify-center'}`}
            >
              <FaDatabase className={activeTab === 'erp' ? 'text-blue-600' : 'text-gray-600'} />
              {sidebarOpen && <span>ERP Connection</span>}
            </button>
          )}

          <button
            onClick={() => setActiveTab('galaxy')}
            className={`flex items-center w-full p-3 rounded-md transition-colors 
              ${activeTab === 'galaxy' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-700'}
              ${sidebarOpen ? 'justify-start space-x-3' : 'justify-center'}`}
          >
            <FaGlobe className={activeTab === 'galaxy' ? 'text-blue-600' : 'text-gray-600'} />
            {sidebarOpen && <span>Galaxy View</span>}
          </button>

          <button
            onClick={() => setActiveTab('tree')}
            className={`flex items-center w-full p-3 rounded-md transition-colors 
              ${activeTab === 'tree' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-700'}
              ${sidebarOpen ? 'justify-start space-x-3' : 'justify-center'}`}
          >
            <FaProjectDiagram className={activeTab === 'tree' ? 'text-blue-600' : 'text-gray-600'} />
            {sidebarOpen && <span>Organization Tree</span>}
          </button>

          <button
            onClick={() => setActiveTab('network')}
            className={`flex items-center w-full p-3 rounded-md transition-colors 
              ${activeTab === 'network' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-700'}
              ${sidebarOpen ? 'justify-start space-x-3' : 'justify-center'}`}
          >
            <FaUserFriends className={activeTab === 'network' ? 'text-blue-600' : 'text-gray-600'} />
            {sidebarOpen && <span>Network Chart</span>}
          </button>
        </div>

        <div className="p-4 border-t">
          {user && (
            <div className={`flex items-center ${sidebarOpen ? 'space-x-3' : 'justify-center'} mb-4`}>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                {user.username?.substring(0, 1).toUpperCase() || 'U'}
              </div>
              {sidebarOpen && (
                <div className="overflow-hidden">
                  <p className="font-medium text-gray-800 truncate">{user.username || 'User'}</p>
                  <p className="text-sm text-gray-500 truncate">{user.email || ''}</p>
                  {(usingMockData || localStorage.getItem('useMockData') === 'true') && (
                    <p className="text-xs text-blue-500">Using Demo Data</p>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center w-full p-3 rounded-md text-red-600 hover:bg-red-50 transition-colors 
              ${sidebarOpen ? 'justify-start space-x-3' : 'justify-center'}`}
          >
            <FaSignOutAlt />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full p-6">
          {/* ERP Connection screen - only for admin or top management users with real backend */}
          {activeTab === 'erp' && !usingMockData && canConnectERP && (
            <div className="h-full">
              <NoERPConnected />
            </div>
          )}

          {/* Show visualization only for test accounts or if real data exists */}
          {(usingMockData || hasRealData || activeTab !== 'erp') && (
            <>
              {activeTab === 'galaxy' && (
                <div className="h-full bg-white rounded-xl shadow-sm overflow-hidden">
                  <GalaxyView />
                </div>
              )}
              
              {activeTab === 'tree' && (
                <div className="h-full bg-white rounded-xl shadow-sm overflow-hidden">
                  <OrgTree />
                </div>
              )}
              
              {activeTab === 'network' && (
                <div className="h-full bg-white rounded-xl shadow-sm overflow-hidden">
                  <NetworkChart />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
} 
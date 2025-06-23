'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HiOutlineServerStack, HiOutlineChartBar } from 'react-icons/hi2';
import { isMockDataUser, hasERPConnections } from '@/lib/dataProvider';
import NoERPConnected from '@/components/NoERPConnected';

export default function EmployeesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [hasRealData, setHasRealData] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedERPSystem, setSelectedERPSystem] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<any>('idle');
  const [connectionErrorMessage, setConnectionErrorMessage] = useState('');
  const [canConnect, setCanConnect] = useState(false);

  // ERP connection form states
  const [erpFormData, setErpFormData] = useState({
    host: '',
    port: '',
    username: '',
    password: '',
    database: '',
    domain: '',
    apiKey: '',
    tenantId: '',
    systemId: '',
    useSsl: true
  });

  useEffect(() => {
    // existing employee page data loading logic
  }, []);

  useEffect(() => {
    // Get user from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      
      // Check if the user is using mock data
      const mockUser = isMockDataUser();
      setUsingMockData(mockUser);
      
      // Check if user can connect to ERP (admin or top_management)
      const userRole = parsedUser.role || localStorage.getItem('userRole') || '';
      const canConnectERP = ['admin', 'top_management'].includes(userRole.toLowerCase());
      setCanConnect(canConnectERP);
      
      // For real users, check if there's any real data connected
      if (!mockUser) {
        hasERPConnections().then(hasConnections => {
          setHasRealData(hasConnections);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  // Required fields based on ERP system type
  const getRequiredFields = () => {
    switch (selectedERPSystem) {
      case 'SAP_HR':
        return {
          host: true,
          port: true,
          username: true,
          password: true,
          systemId: true
        };
      case 'WORKDAY':
        return {
          apiKey: true,
          tenantId: true
        };
      case 'ORACLE':
        return {
          host: true,
          port: true,
          username: true,
          password: true,
          database: true
        };
      case 'MICROSOFT_AD':
        return {
          domain: true,
          username: true,
          password: true
        };
      case 'PEOPLESOFT':
        return {
          host: true,
          port: true,
          username: true,
          password: true,
          database: true
        };
      default:
        return {};
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setErpFormData({
      ...erpFormData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    });
  };

  const handleERPSystemSelect = (system: any) => {
    setSelectedERPSystem(system);
    // Reset form data when changing system type
    setErpFormData({
      host: '',
      port: '',
      username: '',
      password: '',
      database: '',
      domain: '',
      apiKey: '',
      tenantId: '',
      systemId: '',
      useSsl: true
    });
  };

  const connectToERP = async () => {
    setConnectionStatus('connecting');
    setConnectionErrorMessage('');
    
    // Validate required fields based on selected ERP system
    const requiredFields = getRequiredFields();
    const missingFields = Object.entries(requiredFields)
      .filter(([key, required]) => required && !erpFormData[key as keyof typeof erpFormData])
      .map(([key]) => key);
    
    if (missingFields.length > 0) {
      setConnectionStatus('error');
      setConnectionErrorMessage(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }
    
    // Password validation
    if (erpFormData.password && erpFormData.password.length < 8) {
      setConnectionStatus('error');
      setConnectionErrorMessage('Password must be at least 8 characters');
      return;
    }
    
    try {
      // Prepare the payload based on the selected ERP system
      const payload: any = {
        type: selectedERPSystem
      };
      
      // Add specific fields based on ERP type
      switch (selectedERPSystem) {
        case 'SAP_HR':
          payload.host = erpFormData.host;
          payload.sysnr = erpFormData.port;
          payload.client = erpFormData.systemId;
          payload.user = erpFormData.username;
          payload.passwd = erpFormData.password;
          break;
        case 'WORKDAY':
          payload.apiKey = erpFormData.apiKey;
          payload.tenantId = erpFormData.tenantId;
          break;
        case 'ORACLE':
          payload.host = erpFormData.host;
          payload.port = erpFormData.port;
          payload.database = erpFormData.database;
          payload.username = erpFormData.username;
          payload.password = erpFormData.password;
          break;
        case 'MICROSOFT_AD':
          payload.server = `ldap://${erpFormData.domain}`;
          payload.domain = erpFormData.domain;
          payload.username = erpFormData.username;
          payload.password = erpFormData.password;
          break;
        case 'PEOPLESOFT':
          payload.url = `http://${erpFormData.host}:${erpFormData.port}`;
          payload.database = erpFormData.database;
          payload.username = erpFormData.username;
          payload.password = erpFormData.password;
          break;
      }
      
      // Make the actual API call to the Python backend
      const response = await fetch('/api/erp/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to connect to ERP system');
      }
      
      if (result.success) {
        setConnectionStatus('success');
        localStorage.setItem('erpConnected', 'true');
        
        // After successful connection, close modal and update state
        setTimeout(() => {
          setHasRealData(true);
          setShowConnectModal(false);
          setConnectionStatus('idle');
        }, 1500);
      } else {
        setConnectionStatus('error');
        setConnectionErrorMessage(result.message || 'Failed to connect to ERP system');
      }
    } catch (error: any) {
      console.error('Error connecting to ERP:', error);
      setConnectionStatus('error');
      setConnectionErrorMessage(error.message || 'Failed to connect to ERP system');
    }
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    connectToERP();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading organization data...</p>
        </div>
      </div>
    );
  }

  console.log('Employees page rendering, usingMockData:', usingMockData, 'hasRealData:', hasRealData);
  
  // Always render NoERPConnected component for debugging
  return (
    <div>
      {/* Force NoERPConnected to always render */}
      <NoERPConnected
        onConnectClick={() => setShowConnectModal(true)}
        showConnectButton={canConnect}
      />
    </div>
  );
}
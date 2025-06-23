'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import GalaxyView from '../../components/visualization/GalaxyView';
import NetworkChart from '../../components/visualization/NetworkChart';
import OrgTree from '../../components/visualization/OrgTree';
import { Employee } from '@/types/organization';

// Main App Component
const AppPage = () => {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [visType, setVisType] = useState<'galaxy' | 'network' | 'tree'>('galaxy');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Check if user is already authenticated from localStorage
  useEffect(() => {
    const storedEmail = localStorage.getItem('userEmail');
    if (storedEmail) {
      setIsAuthenticated(true);
      setUserEmail(storedEmail);
    } else {
      // If not authenticated, redirect to login page
      router.push('/');
    }
  }, [router]);

  // Handle logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserEmail(null);
    localStorage.removeItem('userEmail');
    router.push('/');
  };

  // Sample organization data
  const orgData = {
    employees: [
      { id: 'e1', name: 'John CEO', position: 'CEO', department: 'Executive', level: 1, email: 'john@example.com', phone: '555-123-4567', hireDate: '2018-01-15', skills: ['Leadership', 'Strategy', 'Business Development'] },
      { id: 'e2', name: 'Sarah CTO', position: 'CTO', department: 'Engineering', managerId: 'e1', level: 2, email: 'sarah@example.com', phone: '555-234-5678', hireDate: '2018-03-12', skills: ['Architecture', 'Cloud', 'Team Leadership'] },
      { id: 'e3', name: 'Mike CFO', position: 'CFO', department: 'Finance', managerId: 'e1', level: 2, email: 'mike@example.com', phone: '555-345-6789', hireDate: '2018-02-21', skills: ['Financial Planning', 'Risk Management', 'Investor Relations'] },
      { id: 'e4', name: 'Lisa CMO', position: 'CMO', department: 'Marketing', managerId: 'e1', level: 2, email: 'lisa@example.com', phone: '555-456-7890', hireDate: '2019-04-10', skills: ['Brand Strategy', 'Market Research', 'Digital Marketing'] },
      { id: 'e5', name: 'David COO', position: 'COO', department: 'Operations', managerId: 'e1', level: 2, email: 'david@example.com', phone: '555-567-8901', hireDate: '2019-05-05', skills: ['Process Optimization', 'Resource Management', 'Strategic Planning'] },
      { id: 'e6', name: 'Jennifer', position: 'HR Director', department: 'HR', managerId: 'e1', level: 2, email: 'jennifer@example.com', phone: '555-678-9012', hireDate: '2019-06-15', skills: ['Recruiting', 'Employee Relations', 'Policy Development'] },
      { id: 'e7', name: 'Alex', position: 'Senior Engineer', department: 'Engineering', managerId: 'e2', level: 3, email: 'alex@example.com', phone: '555-789-0123', hireDate: '2019-07-22', skills: ['JavaScript', 'React', 'Node.js'] },
      { id: 'e8', name: 'Emily', position: 'Senior Engineer', department: 'Engineering', managerId: 'e2', level: 3, email: 'emily@example.com', phone: '555-890-1234', hireDate: '2019-08-01', skills: ['Python', 'Machine Learning', 'Data Science'] },
      { id: 'e9', name: 'Marcus', position: 'Marketing Manager', department: 'Marketing', managerId: 'e4', level: 3, email: 'marcus@example.com', phone: '555-901-2345', hireDate: '2020-01-10', skills: ['Social Media', 'Content Strategy', 'Analytics'] },
      { id: 'e10', name: 'Rachel', position: 'Finance Manager', department: 'Finance', managerId: 'e3', level: 3, email: 'rachel@example.com', phone: '555-012-3456', hireDate: '2020-02-14', skills: ['Budgeting', 'Financial Analysis', 'Forecasting'] },
      { id: 'e11', name: 'Thomas', position: 'DevOps Engineer', department: 'Engineering', managerId: 'e2', level: 3, email: 'thomas@example.com', phone: '555-123-7890', hireDate: '2020-03-05', skills: ['Docker', 'Kubernetes', 'CI/CD'] },
      { id: 'e12', name: 'Jessica', position: 'Frontend Developer', department: 'Engineering', managerId: 'e7', level: 4, email: 'jessica@example.com', phone: '555-234-8901', hireDate: '2020-04-12', skills: ['HTML', 'CSS', 'JavaScript', 'React'] },
      { id: 'e13', name: 'Daniel', position: 'Backend Developer', department: 'Engineering', managerId: 'e7', level: 4, email: 'daniel@example.com', phone: '555-345-9012', hireDate: '2020-05-20', skills: ['Node.js', 'Python', 'Databases'] },
      { id: 'e14', name: 'Sophia', position: 'UX Designer', department: 'Marketing', managerId: 'e9', level: 4, email: 'sophia@example.com', phone: '555-456-0123', hireDate: '2020-06-15', skills: ['UI/UX', 'Figma', 'User Research'] },
      { id: 'e15', name: 'Oliver', position: 'Data Analyst', department: 'Finance', managerId: 'e10', level: 4, email: 'oliver@example.com', phone: '555-567-1234', hireDate: '2020-07-01', skills: ['SQL', 'Excel', 'Data Visualization'] },
    ],
    connections: [
      { source: 'e1', target: 'e2' },
      { source: 'e1', target: 'e3' },
      { source: 'e1', target: 'e4' },
      { source: 'e1', target: 'e5' },
      { source: 'e1', target: 'e6' },
      { source: 'e2', target: 'e7' },
      { source: 'e2', target: 'e8' },
      { source: 'e2', target: 'e11' },
      { source: 'e4', target: 'e9' },
      { source: 'e3', target: 'e10' },
      { source: 'e7', target: 'e12' },
      { source: 'e7', target: 'e13' },
      { source: 'e9', target: 'e14' },
      { source: 'e10', target: 'e15' },
    ],
  };

  // Convert data for OrgTree
  const orgTreeData = {
    employees: orgData.employees.map(emp => ({
      id: emp.id,
      firstName: emp.name.split(' ')[0],
      lastName: emp.name.split(' ').slice(1).join(' '),
      position: emp.position,
      departmentId: emp.department?.toLowerCase(),
      email: emp.email,
      status: 'active' as const,
      hireDate: new Date(emp.hireDate || ''),
      managerId: emp.managerId
    })),
    connections: orgData.connections
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Organization Galaxy</h1>
          <p className="text-xl text-gray-400">Redirecting to login...</p>
          <div className="mt-6">
            <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-gray-950 text-white">
      <header className="border-b border-gray-800 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Organization Galaxy</h1>
          <div className="flex items-center space-x-4">
            {userEmail && (
              <span className="text-gray-400">{userEmail}</span>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 text-white"
            >
              Logout
            </button>
          </div>
        </div>
        <p className="text-gray-400 mt-2">Visualize your organization structure</p>
      </header>

      <div className="flex h-16 items-center px-4 border-b border-gray-800">
        <div className="flex space-x-4">
          <button
            onClick={() => setVisType('galaxy')}
            className={`px-4 py-2 rounded-md transition-colors ${
              visType === 'galaxy'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            3D Galaxy View
          </button>
          <button
            onClick={() => setVisType('network')}
            className={`px-4 py-2 rounded-md transition-colors ${
              visType === 'network'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Network Chart
          </button>
          <button
            onClick={() => setVisType('tree')}
            className={`px-4 py-2 rounded-md transition-colors ${
              visType === 'tree'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Organization Tree
          </button>
        </div>
      </div>

      <div className="flex-grow p-4">
        <div className="w-full h-[calc(100vh-12rem)] rounded-xl overflow-hidden border border-gray-800">
          {visType === 'galaxy' && (
            <GalaxyView data={orgData} />
          )}
          
          {visType === 'network' && (
            <NetworkChart
              data={{
                employees: orgData.employees,
                links: orgData.connections.map(conn => ({
                  source: conn.source,
                  target: conn.target
                }))
              }}
              width={1200}
              height={800}
            />
          )}
          
          {visType === 'tree' && (
            <OrgTree 
              data={orgTreeData}
              onEmployeeSelect={setSelectedEmployee}
            />
          )}
        </div>
      </div>

      <footer className="border-t border-gray-800 p-4 text-center text-gray-500 text-sm">
        &copy; {new Date().getFullYear()} Organization Galaxy - A 3D Organization Visualization Tool
      </footer>
    </main>
  );
};

export default AppPage; 
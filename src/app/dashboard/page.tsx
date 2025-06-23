'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FaUsers,
  FaProjectDiagram,
  FaUserTie,
  FaSearch,
  FaCoins,
  FaLightbulb,
  FaChartLine,
  FaFileAlt,
  FaPlug,
  FaComments
} from 'react-icons/fa';

// Initial state for the dashboard
const initialStats = {
  totalEmployees: 0,
  activeProjects: 0,
  overworkedEmployees: 0,
  underutilizedEmployees: 0,
  criticalRoles: 0,
  avgUtilization: 0,
  feedback: {
    given: 0,
    received: 0
  },
  integrations: {
    active: 0
  },
  reports: {
    count: 0
  }
};

export default function Dashboard() {
  const [stats, setStats] = useState(initialStats);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch user from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    
    // Fetch dashboard data from API
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/dashboard');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch dashboard data: ${response.status}`);
        }
        
        const data = await response.json();
        setStats(data);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  // Define features with a consistent purple/white theme
  const features = [
    {
      title: 'Organization Galaxy',
      description: '3D visualization of your organization with departments as suns and employees as planets.',
      icon: <FaProjectDiagram className="h-8 w-8 text-purple-600" />,
      href: '/visualization/galaxy',
      color: 'border-purple-200 bg-purple-50 hover:bg-purple-100'
    },
    {
      title: 'Project Allocation Assistant',
      description: 'AI-powered recommendations for optimal team allocation and skills matching.',
      icon: <FaProjectDiagram className="h-8 w-8 text-indigo-600" />,
      href: '/dashboard/projects/allocation',
      color: 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100' // Keep some variation
    },
    {
      title: 'Executive Intelligence',
      description: 'Monthly reports on team performance, utilization, and workforce insights.',
      icon: <FaChartLine className="h-8 w-8 text-purple-600" />,
      href: '/dashboard/executive-reports',
      color: 'border-purple-200 bg-purple-50 hover:bg-purple-100'
    },
    {
      title: 'Succession Planning',
      description: 'Identify critical roles and plan for organizational continuity.',
      icon: <FaUserTie className="h-8 w-8 text-teal-600" />,
      href: '/dashboard/succession-planning',
      color: 'border-teal-200 bg-teal-50 hover:bg-teal-100' // Use complementary colors
    },
    {
      title: 'OrgGPT Search',
      description: 'Natural language search to find the right people with the right skills.',
      icon: <FaSearch className="h-8 w-8 text-purple-600" />,
      href: '/dashboard/org-search',
      color: 'border-purple-200 bg-purple-50 hover:bg-purple-100'
    },
    {
      title: 'Chart Visualization',
      description: 'Interactive charts and graphs for organizational data analysis.',
      icon: <FaChartLine className="h-8 w-8 text-green-600" />,
      href: '/dashboard/charts',
      color: 'border-green-200 bg-green-50 hover:bg-green-100'
    }
  ];

  return (
    // Added padding and max-width for better spacing on larger screens
    <div className="space-y-8 max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Welcome section - using purple accent */} 
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome, <span className="text-purple-700">{user?.firstName || 'User'}</span>
        </h1>
        <p className="text-lg text-gray-600">
          Here's your organization's dashboard overview and AI-powered tools.
        </p>
      </div>

      {/* Error message if API fetch failed */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          <p>{error}</p>
        </div>
      )}

      {/* Stats grid - cleaner cards */} 
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stat Card Example */} 
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Employees</p>
              {isLoading ? (
                <div className="h-8 w-20 bg-gray-200 animate-pulse rounded mt-2"></div>
              ) : (
                <p className="text-3xl font-semibold text-gray-900 mt-1">{stats.totalEmployees}</p>
              )}
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <FaUsers className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Active Projects</p>
              {isLoading ? (
                <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mt-2"></div>
              ) : (
                <p className="text-3xl font-semibold text-gray-900 mt-1">{stats.activeProjects}</p>
              )}
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <FaProjectDiagram className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Avg. Utilization</p>
              {isLoading ? (
                <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mt-2"></div>
              ) : (
                <p className="text-3xl font-semibold text-gray-900 mt-1">{stats.avgUtilization}%</p>
              )}
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <FaChartLine className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Insights section - refined styling */} 
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-800 mb-5">Organization Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Insight Item Example */} 
          <div className="flex items-center p-4 border border-purple-100 bg-purple-50 rounded-lg">
            <div className="p-2 bg-purple-100 rounded-full mr-4">
              <FaUsers className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Overworked Employees</p>
              <p className="text-sm text-purple-800 font-medium">
                {isLoading ? (
                  <span className="inline-block h-4 w-16 bg-gray-200 animate-pulse rounded"></span>
                ) : (
                  `${stats.overworkedEmployees} employees working >45 hours/week`
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center p-4 border border-orange-100 bg-orange-50 rounded-lg">
            <div className="p-2 bg-orange-100 rounded-full mr-4">
              <FaUsers className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Underutilized Employees</p>
              <p className="text-sm text-orange-800 font-medium">
                {isLoading ? (
                  <span className="inline-block h-4 w-16 bg-gray-200 animate-pulse rounded"></span>
                ) : (
                  `${stats.underutilizedEmployees} employees working <20 hours/week`
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center p-4 border border-indigo-100 bg-indigo-50 rounded-lg">
            <div className="p-2 bg-indigo-100 rounded-full mr-4">
              <FaUserTie className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Critical Roles</p>
              <p className="text-sm text-indigo-800 font-medium">
                {isLoading ? (
                  <span className="inline-block h-4 w-16 bg-gray-200 animate-pulse rounded"></span>
                ) : (
                  `${stats.criticalRoles} positions need succession planning`
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center p-4 border border-teal-100 bg-teal-50 rounded-lg">
            <div className="p-2 bg-teal-100 rounded-full mr-4">
              <FaProjectDiagram className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Active Projects</p>
              <p className="text-sm text-teal-800 font-medium">
                {isLoading ? (
                  <span className="inline-block h-4 w-16 bg-gray-200 animate-pulse rounded"></span>
                ) : (
                  `${stats.activeProjects} projects in progress`
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Insights - Preview sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Reports Preview */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Reports</h3>
            <div className="p-2 bg-blue-100 rounded-full">
              <FaFileAlt className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2"></div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-2">You have access to {stats.reports.count} reports</p>
              <Link href="/dashboard/reports" className="text-sm font-medium text-purple-700 hover:text-purple-900">
                View all reports →
              </Link>
            </>
          )}
        </div>

        {/* ERP Integrations Preview */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">ERP Integrations</h3>
            <div className="p-2 bg-green-100 rounded-full">
              <FaPlug className="h-5 w-5 text-green-600" />
            </div>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2"></div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-2">{stats.integrations.active} active connections</p>
              <Link href="/dashboard/integrations" className="text-sm font-medium text-purple-700 hover:text-purple-900">
                Manage integrations →
              </Link>
            </>
          )}
        </div>

        {/* Feedback Preview */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Feedback</h3>
            <div className="p-2 bg-yellow-100 rounded-full">
              <FaComments className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2"></div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-2">
                {stats.feedback.given} given / {stats.feedback.received} received
              </p>
              <Link href="/dashboard/feedback" className="text-sm font-medium text-purple-700 hover:text-purple-900">
                View feedback →
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Features grid - updated theme */} 
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-5">AI-Powered Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Link key={index} href={feature.href} passHref>
              <div className={`p-6 rounded-xl shadow-md border cursor-pointer transition-all duration-300 ease-in-out ${feature.color} hover:shadow-lg hover:scale-[1.03] h-full flex flex-col`}>
                <div className="mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm flex-grow mb-4">{feature.description}</p>
                <div className="mt-auto text-sm font-medium text-purple-700 hover:text-purple-900">
                  Explore Feature →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
} 
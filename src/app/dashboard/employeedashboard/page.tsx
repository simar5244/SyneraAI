'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FaUsers,
  FaProjectDiagram,
  FaUserTie,
  FaSearch,
  FaChartLine,
  FaFileAlt,
  FaComments,
  FaUserCog,
  FaCalendarAlt,
  FaClipboardList
} from 'react-icons/fa';

// Initial state for the employee dashboard
const initialStats = {
  assignedProjects: 0,
  weeklyHours: 0,
  feedbackReceived: 0,
  feedbackGiven: 0,
  upcomingDeadlines: 0,
  projects: []
};

// Type definitions
interface Project {
  id: string;
  title: string;
  status: string;
  endDate: string;
  priority: string;
  department: string;
  weeklyHours: number;
}

interface DashboardStats {
  assignedProjects: number;
  weeklyHours: number;
  feedbackReceived: number;
  feedbackGiven: number;
  upcomingDeadlines: number;
  projects: Project[];
}

export default function EmployeeDashboard() {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch user from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    
    // Fetch employee dashboard data from API
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/dashboard/employee');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch dashboard data: ${response.status}`);
        }
        
        const data = await response.json();
        setStats(data);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching employee dashboard data:', err);
        setError('Failed to load dashboard data. Please try again later.');
        
        // Set mock data for development/fallback
        setStats({
          assignedProjects: 3,
          weeklyHours: 38,
          feedbackReceived: 5,
          feedbackGiven: 2,
          upcomingDeadlines: 2,
          projects: [
            {
              id: '1',
              title: 'Security System Upgrade',
              status: 'In Progress',
              endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
              priority: 'high',
              department: 'IT Security',
              weeklyHours: 12
            },
            {
              id: '2',
              title: 'Command Center Integration',
              status: 'Planning',
              endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              priority: 'medium',
              department: 'Operations',
              weeklyHours: 18
            },
            {
              id: '3',
              title: 'Resource Allocation System',
              status: 'Active',
              endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              priority: 'low',
              department: 'Strategic Planning',
              weeklyHours: 8
            }
          ]
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  // Format date to display
  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} days`;
    return `Due in ${diffDays} days`;
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'planning': return 'bg-blue-100 text-blue-800';
      case 'active': 
      case 'in progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'on-hold': return 'bg-orange-100 text-orange-800';
      case 'canceled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Define features for employee dashboard
  const features = [
    {
      title: 'My Projects',
      description: 'View and manage your assigned projects and tasks.',
      icon: <FaProjectDiagram className="h-8 w-8 text-blue-600" />,
      href: '/dashboard/myprojects',
      color: 'border-blue-200 bg-blue-50 hover:bg-blue-100'
    },
    {
      title: 'Time Tracking',
      description: 'Log and manage your work hours across different projects.',
      icon: <FaCalendarAlt className="h-8 w-8 text-green-600" />,
      href: '/dashboard/timetracking',
      color: 'border-green-200 bg-green-50 hover:bg-green-100'
    },
    {
      title: 'Feedback',
      description: 'Give and receive feedback from your colleagues.',
      icon: <FaComments className="h-8 w-8 text-yellow-600" />,
      href: '/dashboard/feedback',
      color: 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100'
    },
    {
      title: 'Skill Development',
      description: 'Track your skills and find learning opportunities.',
      icon: <FaUserCog className="h-8 w-8 text-purple-600" />,
      href: '/dashboard/skills',
      color: 'border-purple-200 bg-purple-50 hover:bg-purple-100'
    },
    {
      title: 'Team Directory',
      description: 'Find and connect with colleagues across the organization.',
      icon: <FaUsers className="h-8 w-8 text-indigo-600" />,
      href: '/dashboard/directory',
      color: 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100'
    },
    {
      title: 'My Reports',
      description: 'Access and download your personal reports and analytics.',
      icon: <FaFileAlt className="h-8 w-8 text-pink-600" />,
      href: '/dashboard/myreports',
      color: 'border-pink-200 bg-pink-50 hover:bg-pink-100'
    }
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Welcome section */} 
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome, <span className="text-blue-700">{user?.firstName || 'User'}</span>
        </h1>
        <p className="text-lg text-gray-600">
          Here's your personal dashboard with your projects and tasks.
        </p>
      </div>

      {/* Error message if API fetch failed */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          <p>{error}</p>
        </div>
      )}

      {/* Personal Stats grid */} 
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Assigned Projects */} 
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Assigned Projects</p>
              {isLoading ? (
                <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mt-2"></div>
              ) : (
                <p className="text-3xl font-semibold text-gray-900 mt-1">{stats.assignedProjects}</p>
              )}
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FaProjectDiagram className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        {/* Weekly Hours */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Weekly Hours</p>
              {isLoading ? (
                <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mt-2"></div>
              ) : (
                <p className="text-3xl font-semibold text-gray-900 mt-1">{stats.weeklyHours}</p>
              )}
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FaCalendarAlt className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Upcoming Deadlines</p>
              {isLoading ? (
                <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mt-2"></div>
              ) : (
                <p className="text-3xl font-semibold text-gray-900 mt-1">{stats.upcomingDeadlines}</p>
              )}
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <FaClipboardList className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Current Projects section */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Current Projects</h2>
          <Link href="/dashboard/myprojects" className="text-sm font-medium text-blue-700 hover:text-blue-900">
            View all →
          </Link>
        </div>
        
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-16 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-16 bg-gray-200 animate-pulse rounded"></div>
          </div>
        ) : stats.projects && stats.projects.length > 0 ? (
          <div className="space-y-4">
            {stats.projects.map(project => (
              <div key={project.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-gray-900">{project.title}</h3>
                    <p className="text-sm text-gray-600">
                      {formatDueDate(project.endDate)} • {project.weeklyHours} hours this week
                    </p>
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 italic">No active projects assigned to you.</p>
        )}
      </div>

      {/* Feedback section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                {stats.feedbackGiven} given / {stats.feedbackReceived} received
              </p>
              <Link href="/dashboard/feedback" className="text-sm font-medium text-blue-700 hover:text-blue-900">
                View feedback →
              </Link>
            </>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Skill Development</h3>
            <div className="p-2 bg-purple-100 rounded-full">
              <FaUserCog className="h-5 w-5 text-purple-600" />
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
                Top skills: JavaScript, React, Project Management
              </p>
              <Link href="/dashboard/skills" className="text-sm font-medium text-blue-700 hover:text-blue-900">
                View skill profile →
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Features grid */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-5">Quick Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Link key={index} href={feature.href} passHref>
              <div className={`p-6 rounded-xl shadow-md border cursor-pointer transition-all duration-300 ease-in-out ${feature.color} hover:shadow-lg hover:scale-[1.03] h-full flex flex-col`}>
                <div className="mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm flex-grow mb-4">{feature.description}</p>
                <div className="mt-auto text-sm font-medium text-blue-700 hover:text-blue-900">
                  Access →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
} 
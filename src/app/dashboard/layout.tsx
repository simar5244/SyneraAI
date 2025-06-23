'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  FaChartLine, FaUsers, FaProjectDiagram, FaSearch, 
  FaCoins, FaUserTie, FaBars, FaSignOutAlt,
  FaUserAlt, FaTimes, FaChevronLeft, FaChevronRight, FaCamera, FaShieldAlt, FaFileAlt
} from 'react-icons/fa';
import NotificationCenter from '@/components/NotificationCenter';
import Sidebar from '@/components/dashboard/Sidebar';

import DataProcessorInitializer from '@/components/DataProcessorInitializer';
import RouteGuard from '@/components/RouteGuard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for auth token
    const checkAuth = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        // Get user data from localStorage
        const userData = localStorage.getItem('user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
        } else {
          // Try to refresh user data from API
          try {
            const response = await fetch('/api/auth/me', {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);
              } else {
                throw new Error('No user data returned');
              }
            } else {
              throw new Error('Failed to fetch user data');
            }
          } catch (error) {
            console.error('Error fetching user data:', error);
            localStorage.removeItem('token');
            router.push('/login');
            return;
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Auth check error:', error);
        localStorage.removeItem('token');
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    // Check window size for responsive design
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };

    // Retrieve sidebar state from localStorage
    const savedSidebarState = localStorage.getItem('sidebarOpen');
    if (savedSidebarState !== null && !isMobile) {
      setSidebarOpen(savedSidebarState === 'true');
    }

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, [isMobile]);

  // Save sidebar state when it changes
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem('sidebarOpen', String(sidebarOpen));
    }
  }, [sidebarOpen, isMobile]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleNotificationNavigate = (path: string) => {
    router.push(path);
  };

  const navItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: <FaChartLine className="w-5 h-5" />,
    },
    {
      name: 'Employees',
      href: '/dashboard/employees',
      icon: <FaUsers className="w-5 h-5" />,
    },
    {
      name: 'Visualizations',
      href: '/dashboard/visualizations',
      icon: <FaChartLine className="w-5 h-5" />,
    },
    {
      name: 'Projects',
      href: '/dashboard/projects',
      icon: <FaProjectDiagram className="w-5 h-5" />,
    },
    {
      name: 'Billing',
      href: '/dashboard/billing',
      icon: <FaCoins className="w-5 h-5" />,
    },
    {
      name: 'OrgGPT Search',
      href: '/dashboard/org-search',
      icon: <FaSearch className="w-5 h-5" />,
    },
    {
      name: 'Database Query',
      href: '/dashboard/db-query',
      icon: <FaSearch className="w-5 h-5" />,
    },
    {
      name: 'OrgAI',
      href: '/dashboard/orgai',
      icon: <FaSearch className="w-5 h-5" />,
    },
    {
      name: 'Internal Economy',
      href: '/dashboard/internal-economy',
      icon: <FaCoins className="w-5 h-5" />,
    },
    {
      name: 'Succession Planning',
      href: '/dashboard/succession-planning',
      icon: <FaUserTie className="w-5 h-5" />,
    },
    {
      name: 'Report Generation',
      href: '/dashboard/report-generation',
      icon: <FaFileAlt className="w-5 h-5" />,
    }
  ];

  // Add Org Simulation link for top management roles
  const isTopManagement = user?.role === 'eco' || user?.role?.startsWith('top_mgmt_');
  if (isTopManagement) {
    navItems.push({
      name: 'Org Simulation',
      href: '/dashboard/org-simulation',
      icon: <FaProjectDiagram className="w-5 h-5" />,
    });
    navItems.push({
      name: 'Org Sim AI',
      href: '/dashboard/org-sim-ai',
      icon: <FaProjectDiagram className="w-5 h-5" />,
    });
    navItems.push({
      name: 'Visual AI',
      href: '/dashboard/visual-ai',
      icon: <FaCamera className="w-5 h-5" />,
    });
  }

  // Add Admin Settings link for admin users
  const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN';
  if (isAdmin) {
    navItems.push({
      name: 'Admin Panel',
      href: '/dashboard/admin',
      icon: <FaShieldAlt className="w-5 h-5" />,
    });
    navItems.push({
      name: 'Admin Settings',
      href: '/dashboard/admin/settings',
      icon: <FaUserAlt className="w-5 h-5" />,
    });
    navItems.push({
      name: 'User Management',
      href: '/dashboard/admin/users',
      icon: <FaUsers className="w-5 h-5" />,
    });
    navItems.push({
      name: 'Integrations',
      href: '/dashboard/admin/integrations',
      icon: <FaProjectDiagram className="w-5 h-5" />,
    });
    navItems.push({
      name: 'Org Sim AI',
      href: '/dashboard/org-sim-ai',
      icon: <FaProjectDiagram className="w-5 h-5" />,
    });
  }

  // Check if user is a superadmin to add superadmin page
  const isSuperAdmin = user?.role === 'superadmin';
  if (isSuperAdmin) {
    navItems.push({
      name: 'Super Admin',
      href: '/dashboard/superadmin',
      icon: <FaShieldAlt className="w-5 h-5" />,
    });
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-t-4 border-solid border-primary"></div>
      </div>
    );
  }

  // Fullscreen Org Chart override
  if (pathname === '/dashboard/org-chart') {
    return (
      <div className="h-screen w-full">
        <DataProcessorInitializer />
        <RouteGuard>
          {children}
        </RouteGuard>
      </div>
    );
  }
  
  // Galaxy View fullscreen override
  if (pathname === '/dashboard/galaxy-view') {
    return (
      <div className="h-screen w-full">
        <DataProcessorInitializer />
        <RouteGuard>
          {children}
        </RouteGuard>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <DataProcessorInitializer />
      <RouteGuard>
        <Sidebar user={user} isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
        <div 
          className={`flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}
        >
          <main className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6 lg:p-8">
            {children}
          </main>
          
        </div>
      </RouteGuard>
    </div>
  );
} 
"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  FaHome, FaUsers, FaProjectDiagram, FaSearch, FaCoins, FaUserTie, FaCamera,
  FaUserAlt, FaCog, FaSignOutAlt, FaTimes, FaBars, FaChevronLeft, FaChevronRight,
  FaChartLine, FaDatabase, FaBuilding, FaShieldAlt, FaComment, FaTasks, FaBriefcase,
  FaClipboardList, FaPlug, FaFileAlt
} from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { ROUTES, getUserAccessibleRoutes } from '@/lib/permissions';
import Image from 'next/image';

interface SidebarProps {
  user: any;
  isOpen: boolean;
  toggleSidebar: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  order: number;
}

export default function Sidebar({ user, isOpen, toggleSidebar }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  // Define all possible navigation items with their respective order
  const allNavItems: NavItem[] = [
    { name: 'Dashboard', href: ROUTES.DASHBOARD, icon: <FaHome className="w-5 h-5" />, order: 1 },
    { name: 'Projects', href: ROUTES.PROJECTS, icon: <FaClipboardList className="w-5 h-5" />, order: 2 },
    { name: 'Feedback', href: ROUTES.FEEDBACK, icon: <FaComment className="w-5 h-5" />, order: 3 },
    { name: 'Integrations', href: ROUTES.INTEGRATIONS, icon: <FaPlug className="w-5 h-5" />, order: 4 },
    { name: 'Visualizations', href: ROUTES.VISUALIZATIONS, icon: <FaProjectDiagram className="w-5 h-5" />, order: 5 },
    { name: 'Succession Planning', href: ROUTES.SUCCESSION_PLANNING, icon: <FaUserTie className="w-5 h-5" />, order: 6 },
    { name: 'Org AI', href: ROUTES.WEB_QUERY, icon: <FaDatabase className="w-5 h-5" />, order: 7 },
    { name: 'Report Generation', href: ROUTES.REPORT_GENERATION, icon: <FaFileAlt className="w-5 h-5" />, order: 8 },
    { name: 'User Management', href: ROUTES.USER_MANAGEMENT, icon: <FaUsers className="w-5 h-5" />, order: 9 },
    { name: 'User Approvals', href: ROUTES.USER_APPROVALS, icon: <FaShieldAlt className="w-5 h-5" />, order: 10 },
    { name: 'Platform Settings', href: ROUTES.PLATFORM_SETTINGS, icon: <FaCog className="w-5 h-5" />, order: 11 },
  ];

  // Get navigation items based on user role
  const getNavItems = (): NavItem[] => {
    if (!user || !user.role) return [];
    
    // Get routes the user has access to
    const accessibleRoutes = getUserAccessibleRoutes(user.role);
    
    // Filter navigation items based on accessible routes and sort by order
    return allNavItems
      .filter(item => accessibleRoutes.includes(item.href))
      .sort((a, b) => a.order - b.order);
  };

  const navItems = getNavItems();

  // Effect to check screen size (keep as is)
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Use router.replace instead of push to ensure a full page refresh
    window.location.href = '/login';
  };

  // Use `isOpen` prop for width and visibility logic
  return (
    <>
      {/* Overlay for mobile */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-20" 
          onClick={toggleSidebar} // Close on overlay click
        ></div>
      )}

      <div 
        className={`fixed inset-y-0 left-0 z-30 flex flex-col h-full bg-gradient-to-b from-gray-900 to-gray-800 text-gray-200 transition-all duration-300 ease-in-out 
          ${isOpen ? 'w-64' : 'w-20'} 
          ${isMobile ? (isOpen ? 'translate-x-0 shadow-lg' : '-translate-x-full') : ''}`}
      >
        {/* Header with Logo, Title, and Collapse Button */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700 flex-shrink-0">
          <Link href="/dashboard" className="flex items-center gap-1 overflow-hidden">
            {/* Logo using Image component */}
            <div className={`flex-shrink-0 ${isOpen ? 'h-10 w-10' : 'h-8 w-8'}`}>
              <Image 
                src="/logo.png" 
                alt="Synera Logo" 
                width={isOpen ? 40 : 30} 
                height={isOpen ? 40 : 30}
                className="object-contain"
              />
            </div>
            {isOpen && <span className="text-lg font-semibold text-white whitespace-nowrap">Synera</span>}
          </Link>
          <div className="flex items-center">
            {/* Desktop Collapse Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="text-gray-300 hover:text-white hover:bg-gray-700"
              title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {isOpen ? <FaChevronLeft className="h-4 w-4" /> : <FaChevronRight className="h-4 w-4" />}
              <span className="sr-only">{isOpen ? 'Collapse' : 'Expand'} Sidebar</span>
            </Button>
            
            {/* Mobile Close Button */}
            {isMobile && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleSidebar} 
                className="ml-2 text-gray-300 hover:text-white hover:bg-gray-700"
              >
                <FaTimes />
              </Button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-grow overflow-y-auto overflow-x-hidden p-3 space-y-1">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.name} className="list-none">
                <Link
                  href={item.href}
                  className={`flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors group
                    ${pathname === item.href
                      ? 'bg-purple-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    } 
                    ${!isOpen ? 'justify-center' : ''}`}
                  title={!isOpen ? item.name : undefined}
                >
                  <span className={`flex-shrink-0 h-5 w-5 ${isOpen ? 'mr-3' : ''}`}>{item.icon}</span>
                  {isOpen && <span className="truncate">{item.name}</span>}
                  {!isOpen && <span className="sr-only">{item.name}</span>} 
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer Area with Billing, Profile and Logout */}
        <div className="mt-auto border-t border-gray-700 p-3 flex-shrink-0 space-y-2">
          {/* Billing Button */}
          <Link
            href={ROUTES.BILLING}
            className={`flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors w-full
              ${pathname === ROUTES.BILLING
                ? 'bg-purple-600 text-white' 
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              } 
              ${!isOpen ? 'justify-center' : ''}`}
            title={!isOpen ? 'Billing' : undefined}
          >
            <FaCoins className={`h-4 w-4 ${isOpen ? 'mr-2' : ''}`} />
            {isOpen && <span className="text-sm">Billing</span>}
            {!isOpen && <span className="sr-only">Billing</span>}
          </Link>
          
          {/* Profile Button */}
          <Link
            href="/dashboard/profile"
            className={`flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors w-full
              ${pathname === '/dashboard/profile'
                ? 'bg-purple-600 text-white' 
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              } 
              ${!isOpen ? 'justify-center' : ''}`}
            title={!isOpen ? 'Profile' : undefined}
          >
            <FaUserAlt className={`h-4 w-4 ${isOpen ? 'mr-2' : ''}`} />
            {isOpen && <span className="text-sm">Profile</span>}
            {!isOpen && <span className="sr-only">Profile</span>}
          </Link>
          
          {/* Logout Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className={`w-full flex items-center text-gray-400 hover:bg-red-600 hover:text-white transition-colors ${!isOpen ? 'justify-center' : ''}`}
            title={!isOpen ? 'Sign Out' : undefined}
          >
            <FaSignOutAlt className={`h-4 w-4 ${isOpen ? 'mr-2' : ''}`} />
            {isOpen && <span className="text-sm">Sign Out</span>}
            <span className="sr-only">Sign Out</span>
          </Button>
        </div>
      </div>
    </>
  );
} 
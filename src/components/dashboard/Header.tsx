import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaBars, FaUserAlt, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

interface HeaderProps {
  user: any;
}

export default function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const isMobile = window.innerWidth < 768;

  // Get the current page title based on pathname
  const getPageTitle = () => {
    const path = pathname || '';
    
    if (path.includes('/dashboard/user-management')) return 'User Management';
    if (path.includes('/admin/users')) return 'User Management';
    if (path.includes('/superadmin')) return 'Company Management';
    if (path.includes('/profile')) return 'My Profile';
    if (path === '/dashboard') return 'Dashboard';
    if (path === '/dashboard/employees') return 'Integrations';
    if (path.includes('/dashboard/visualizations')) return 'Visualizations';
    if (path.includes('/dashboard/projects')) return 'Projects';
    if (path.includes('/dashboard/feedback')) return 'Feedback';
    if (path.includes('/dashboard/web-query') || path.includes('/dashboard/db-query')) return 'Web Query';
    if (path.includes('/dashboard/succession-planning')) return 'Succession Planning';
    if (path.includes('/dashboard/report-generation')) return 'Report Generation';
    if (path.includes('/dashboard/admin')) return 'Admin Controls';
    
    // Default title
    return 'Dashboard';
  };

  return (
    <header className="bg-white shadow-sm z-10">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <div className="ml-4 text-lg font-semibold text-black">
            {getPageTitle()}
          </div>
        </div>

        <div className="flex items-center">
          {/* Profile Link */}
          <Link 
            href="/dashboard/profile" 
            className="ml-4 flex items-center justify-center w-10 h-10 rounded-full bg-purple-500 text-white hover:bg-purple-700 transition-colors"
            title="Profile"
          >
            <FaUserAlt className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
} 
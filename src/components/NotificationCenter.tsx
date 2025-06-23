'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FaBell, FaCheck, FaTrash, FaCheckDouble, FaProject, FaProjectDiagram, FaUsers, FaUserPlus, FaExclamationTriangle } from 'react-icons/fa';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { formatDistanceToNow } from 'date-fns';

// Define notification type
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'project' | 'employee';
  isRead: boolean;
  createdAt: string;
  link?: string;
}

interface NotificationCenterProps {
  onNavigate?: (path: string) => void;
}

export default function NotificationCenter({ onNavigate }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // In a real app, this would be an API call
        const response = await fetch('/api/notifications');
        
        if (!response.ok) {
          throw new Error('Failed to fetch notifications');
        }
        
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.notifications.filter((notification: Notification) => !notification.isRead).length);
      } catch (err) {
        console.error('Error fetching notifications:', err);
        setError('Failed to load notifications');
        
        // Use demo notifications for development
        const demoNotifications = getDemoNotifications();
        setNotifications(demoNotifications);
        setUnreadCount(demoNotifications.filter(notification => !notification.isRead).length);
      } finally {
        setLoading(false);
      }
    };
    
    fetchNotifications();
    
    // Set up polling for new notifications (every 30 seconds in a real app)
    const intervalId = setInterval(fetchNotifications, 300000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Mark a notification as read
  const markAsRead = async (id: string) => {
    try {
      // Call the API endpoint
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isRead: true }),
      });
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === id 
            ? { ...notification, isRead: true } 
            : notification
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };
  
  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      // Call the API endpoint
      await fetch('/api/notifications/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'markAllAsRead' }),
      });
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, isRead: true }))
      );
      
      // Update unread count
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };
  
  // Clear all notifications
  const clearAllNotifications = async () => {
    try {
      // In a real app, this would use an API endpoint like bulk delete
      const unreadNotifications = notifications.filter(n => !n.isRead).map(n => n.id);
      
      if (unreadNotifications.length > 0) {
        await fetch('/api/notifications/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            action: 'delete',
            ids: unreadNotifications 
          }),
        });
      }
      
      // Update local state
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };
  
  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    
    if (notification.link && onNavigate) {
      onNavigate(notification.link);
      setShowNotifications(false);
    }
  };
  
  // Get icon based on notification type
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'info':
        return <FaBell className="text-blue-500" />;
      case 'success':
        return <FaCheck className="text-green-500" />;
      case 'warning':
        return <FaExclamationTriangle className="text-yellow-500" />;
      case 'error':
        return <FaExclamationTriangle className="text-red-500" />;
      case 'project':
        return <FaProjectDiagram className="text-purple-500" />;
      case 'employee':
        return <FaUsers className="text-indigo-500" />;
      default:
        return <FaBell className="text-gray-500" />;
    }
  };
  
  // Demo notifications for development/testing
  const getDemoNotifications = (): Notification[] => {
    return [
      {
        id: '1',
        title: 'New Project Created',
        message: 'Mobile App Redesign project has been created and assigned to your team.',
        type: 'project',
        isRead: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
        link: '/dashboard/projects/1'
      },
      {
        id: '2',
        title: 'New Team Member',
        message: 'Sarah Johnson has joined the Engineering department.',
        type: 'employee',
        isRead: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        link: '/dashboard/employees/E001'
      },
      {
        id: '3',
        title: 'Project Update',
        message: 'Customer Dashboard is now 75% complete. 3 tasks remaining.',
        type: 'project',
        isRead: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        link: '/dashboard/projects/2'
      },
      {
        id: '4',
        title: 'Warning: Overutilized Resources',
        message: '3 employees have been working more than 45 hours per week.',
        type: 'warning',
        isRead: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
        link: '/dashboard'
      }
    ];
  };
  
  // Format timestamp to relative time
  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'some time ago';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification bell icon with badge */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-gray-600 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Notifications"
      >
        <FaBell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      
      {/* Notification dropdown */}
      {showNotifications && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg overflow-hidden z-50 max-h-[80vh] flex flex-col">
          <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-700">Notifications</h3>
            <div className="flex space-x-2">
              <button 
                onClick={markAllAsRead}
                className="p-1 text-xs text-gray-600 hover:text-gray-900 rounded hover:bg-gray-200 focus:outline-none"
                title="Mark all as read"
              >
                <FaCheckDouble className="h-4 w-4" />
              </button>
              <button 
                onClick={clearAllNotifications}
                className="p-1 text-xs text-gray-600 hover:text-gray-900 rounded hover:bg-gray-200 focus:outline-none"
                title="Clear all notifications"
              >
                <FaTrash className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div className="overflow-y-auto flex-grow">
            {loading && (
              <div className="py-4 text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
                <p className="text-sm text-gray-500 mt-2">Loading notifications...</p>
              </div>
            )}
            
            {error && !loading && notifications.length === 0 && (
              <div className="py-6 text-center">
                <FaExclamationTriangle className="mx-auto h-6 w-6 text-yellow-500" />
                <p className="text-sm text-gray-500 mt-2">{error}</p>
              </div>
            )}
            
            {!loading && notifications.length === 0 && !error && (
              <div className="py-6 text-center">
                <FaBell className="mx-auto h-6 w-6 text-gray-400" />
                <p className="text-sm text-gray-500 mt-2">No notifications</p>
              </div>
            )}
            
            {notifications.map((notification) => (
              <div 
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition ${notification.isRead ? 'bg-white' : 'bg-blue-50'}`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className={`text-sm font-medium ${notification.isRead ? 'text-gray-900' : 'text-blue-800'}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatTimestamp(notification.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {notifications.length > 0 && (
            <div className="p-2 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => onNavigate && onNavigate('/dashboard/notifications')}
                className="w-full p-2 text-xs text-center text-blue-600 hover:text-blue-800 flex items-center justify-center"
              >
                View all notifications
                <MdKeyboardArrowDown className="ml-1" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 
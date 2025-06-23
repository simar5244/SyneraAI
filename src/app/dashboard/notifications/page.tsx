'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FiBell, FiSettings, FiSearch, FiTrash2, FiCheckCircle, 
  FiInfo, FiAlertTriangle, FiMessageSquare, FiFilter, FiX, FiMail 
} from 'react-icons/fi';
import notificationService, { Notification, NotificationType } from '@/services/notificationService';

// Notification icon mapping
const NotificationTypeIcons: Record<NotificationType, React.ReactNode> = {
  'system': <FiInfo className="text-blue-500" size={20} />,
  'project': <FiMessageSquare className="text-green-500" size={20} />,
  'mention': <FiAlertTriangle className="text-orange-500" size={20} />,
  'task': <FiCheckCircle className="text-purple-500" size={20} />
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<NotificationType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    email: true,
    browser: true,
    types: {
      system: true,
      project: true,
      mention: true,
      task: true
    }
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Create a memoized version of mockNotifications
  const mockNotifications = useMemo(() => [
    {
      id: '1',
      userId: 'user123',
      type: 'alert',
      title: 'Critical System Update',
      message: 'A critical system update is scheduled for tonight at 2:00 AM. The system will be unavailable for approximately 30 minutes.',
      isRead: false,
      createdAt: new Date(Date.now() - 3600000) // 1 hour ago
    },
    {
      id: '2',
      userId: 'user123',
      type: 'message',
      title: 'New Message from John Smith',
      message: 'Hi, can we discuss the project timeline for the new feature?',
      isRead: false,
      createdAt: new Date(Date.now() - 86400000) // 1 day ago
    },
    {
      id: '3',
      userId: 'user123',
      type: 'task',
      title: 'Task Assigned',
      message: 'You have been assigned a new task: "Complete the Q3 financial report".',
      isRead: true,
      createdAt: new Date(Date.now() - 172800000) // 2 days ago
    },
    {
      id: '4',
      userId: 'user123',
      type: 'project',
      title: 'Project Milestone Reached',
      message: 'The Mobile App project has reached the "Beta Testing" milestone.',
      isRead: false,
      createdAt: new Date(Date.now() - 259200000) // 3 days ago
    },
    {
      id: '5',
      userId: 'user123',
      type: 'system',
      title: 'Password Changed',
      message: 'Your account password was changed successfully.',
      isRead: true,
      createdAt: new Date(Date.now() - 604800000) // 1 week ago
    }
  ], []);

  // Fetch notifications when component mounts
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        
        // Get user from localStorage (in production, use proper auth)
        const user = localStorage.getItem('user');
        if (!user) {
          router.push('/login');
          return;
        }
        
        const parsedUser = JSON.parse(user);
        
        // Load notification preferences from localStorage
        const storedPrefs = localStorage.getItem('notificationPreferences');
        if (storedPrefs) {
          setPreferences(JSON.parse(storedPrefs));
        }
        
        // Fetch notifications from API
        const result = await notificationService.getUserNotifications(parsedUser.id);
        
        if (Array.isArray(result) && result.length > 0) {
          setNotifications(result);
          setUnreadCount(result.filter(n => !n.isRead).length);
        } else {
          // Use mock data if API returns empty
          setNotifications(mockNotifications);
          setUnreadCount(mockNotifications.filter(n => !n.isRead).length);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
        // Use mock data if API fails
        setNotifications(mockNotifications);
        setUnreadCount(mockNotifications.filter(n => !n.isRead).length);
      } finally {
        setLoading(false);
      }
    };
    
    fetchNotifications();
  }, [router, mockNotifications]);

  // Filter notifications based on search and type
  const filteredNotifications = notifications.filter(notification => {
    // Apply type filter
    if (filterType !== 'all' && notification.type !== filterType) {
      return false;
    }
    
    // Apply search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      return (
        notification.title.toLowerCase().includes(searchLower) ||
        notification.message.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      setIsLoading(true);
      
      // Use the bulk actions endpoint
      const response = await fetch('/api/notifications/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'markAllAsRead'
        })
      });
      
      if (response.ok) {
        // Update local state to avoid refetching
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, isRead: true }))
        );
        setUnreadCount(0);
      } else {
        console.error('Failed to mark all notifications as read');
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Mark multiple notifications as read
  const handleMarkMultipleAsRead = async (ids: string[]) => {
    try {
      setIsLoading(true);
      
      // Use the bulk action endpoint
      const response = await fetch('/api/notifications/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'markAsRead',
          ids
        })
      });
      
      if (response.ok) {
        // Update local state to avoid refetching
        setNotifications(prev => 
          prev.map(notif => 
            ids.includes(notif.id) ? { ...notif, isRead: true } : notif
          )
        );
        
        // Update unread count
        const markedCount = notifications.filter(n => 
          ids.includes(n.id) && !n.isRead
        ).length;
        setUnreadCount(prev => Math.max(0, prev - markedCount));
      } else {
        console.error('Failed to mark notifications as read');
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Delete multiple notifications
  const handleDeleteMultiple = async (ids: string[]) => {
    try {
      setIsLoading(true);
      
      // Use the bulk action endpoint
      const response = await fetch('/api/notifications/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'delete',
          ids
        })
      });
      
      if (response.ok) {
        // Update local state to avoid refetching
        const updatedNotifications = notifications.filter(
          notif => !ids.includes(notif.id)
        );
        setNotifications(updatedNotifications);
        
        // Update unread count
        const deletedUnreadCount = notifications.filter(n => 
          ids.includes(n.id) && !n.isRead
        ).length;
        setUnreadCount(prev => Math.max(0, prev - deletedUnreadCount));
      } else {
        console.error('Failed to delete notifications');
      }
    } catch (error) {
      console.error('Error deleting notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save notification preferences
  const handleSavePreferences = () => {
    localStorage.setItem('notificationPreferences', JSON.stringify(preferences));
    
    // In a real app, we would also save to the backend
    // For now, just show a success message
    alert('Notification preferences saved successfully!');
    setShowSettings(false);
  };

  // Format date for display
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600">View and manage your notifications</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors flex items-center"
          >
            <FiSettings className="mr-2" />
            Settings
          </button>
          
          <button
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center"
            disabled={unreadCount === 0}
          >
            <FiTrash2 className="mr-2" />
            Clear All
          </button>
        </div>
      </div>
      
      {/* Search and filter */}
      <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <FiSearch className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <FiFilter className="text-gray-400" />
            <select
              className="pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as NotificationType | 'all')}
            >
              <option value="all">All Types</option>
              <option value="system">System</option>
              <option value="project">Project</option>
              <option value="mention">Mentions</option>
              <option value="task">Tasks</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Notification settings overlay */}
      {showSettings && (
        <div className="bg-white rounded-xl shadow border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Notification Preferences</h2>
            <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-gray-700">
              <FiX size={20} />
            </button>
          </div>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-md font-medium text-gray-800 mb-3">Delivery Methods</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FiMail className="text-gray-500 mr-2" size={18} />
                    <span className="text-gray-700">Email Notifications</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.email}
                      onChange={() => setPreferences({...preferences, email: !preferences.email})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FiBell className="text-gray-500 mr-2" size={18} />
                    <span className="text-gray-700">Browser Notifications</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.browser}
                      onChange={() => setPreferences({...preferences, browser: !preferences.browser})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-md font-medium text-gray-800 mb-3">Notification Types</h3>
              <div className="space-y-3">
                {(Object.keys(preferences.types) as NotificationType[]).map(type => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center">
                      {NotificationTypeIcons[type]}
                      <span className="ml-2 text-gray-700 capitalize">{type}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.types[type]}
                        onChange={() => setPreferences({
                          ...preferences,
                          types: {
                            ...preferences.types,
                            [type]: !preferences.types[type]
                          }
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleSavePreferences}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Notifications list */}
      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        {filteredNotifications.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredNotifications.map(notification => (
              <div 
                key={notification.id} 
                className={`p-4 hover:bg-gray-50 transition-colors ${!notification.isRead ? 'bg-indigo-50' : ''}`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-1">
                    {NotificationTypeIcons[notification.type]}
                  </div>
                  
                  <div className="ml-3 flex-grow">
                    <div className="flex justify-between">
                      <h3 className={`text-sm font-medium ${!notification.isRead ? 'text-indigo-900' : 'text-gray-900'}`}>
                        {notification.title}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatDate(notification.createdAt)}
                      </span>
                    </div>
                    
                    <p className="mt-1 text-sm text-gray-600">
                      {notification.message}
                    </p>
                    
                    {notification.link && (
                      <a 
                        href={notification.link} 
                        className="mt-2 inline-block text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        View Details →
                      </a>
                    )}
                  </div>
                  
                  <div className="ml-4 flex-shrink-0 flex space-x-2">
                    {!notification.isRead && (
                      <button
                        onClick={() => handleMarkMultipleAsRead([notification.id])}
                        className="text-gray-400 hover:text-gray-600"
                        title="Mark as read"
                      >
                        <FiCheckCircle size={18} />
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleDeleteMultiple([notification.id])}
                      className="text-gray-400 hover:text-red-600"
                      title="Delete"
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <FiBell className="mx-auto text-gray-400 mb-4" size={32} />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No notifications</h3>
            <p className="text-gray-600">
              {searchQuery || filterType !== 'all' 
                ? 'No notifications match your current filters' 
                : 'You have no notifications at this time'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 
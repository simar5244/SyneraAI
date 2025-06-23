'use client';

import React, { useState, useEffect } from 'react';
import { FiUsers, FiUserPlus, FiUserCheck, FiEdit } from 'react-icons/fi';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UserManagement from './user-management-tab';
import UserApprovals from './approvals-tab';
import CreateUserTab from './create-user-tab';
import EditUserTab from './edit-user-tab';

interface UserTabsProps {
  currentUser?: {
    id: string;
    companyCode?: string;
    role?: string;
  }
}

export default function UserTabs({ currentUser }: UserTabsProps) {
  const [activeTab, setActiveTab] = useState('users');
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showEditTab, setShowEditTab] = useState(false);

  // Fetch pending users count to update badge
  useEffect(() => {
    const fetchPendingCount = async () => {
      if (!currentUser?.companyCode) return;
      
      try {
        const token = localStorage.getItem('token');
        
        if (!token) return;
        
        const response = await fetch('/api/admin/user-approval', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch pending users');
        }
        
        const data = await response.json();
        
        if (data.success) {
          setPendingCount(data.pendingUsers?.length || 0);
        }
      } catch (error) {
        console.error('Error fetching pending users count:', error);
      }
    };
    
    fetchPendingCount();
    
    // Poll for new pending users every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    
    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, [currentUser]);

  // Handle user edit action
  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setShowEditTab(true);
    setActiveTab('edit');
  };

  // Reset edit tab when another tab is selected
  const handleTabChange = (value: string) => {
    if (value !== 'edit') {
      setShowEditTab(false);
    }
    setActiveTab(value);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm">
        <Tabs defaultValue="users" value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid grid-cols-4 gap-2 w-full p-1 bg-purple-100 rounded-xl">
            <TabsTrigger 
              value="users" 
              className="rounded-lg flex items-center gap-2 text-black data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              <FiUsers className="h-4 w-4" />
              <span>Manage Users</span>
            </TabsTrigger>
            <TabsTrigger 
              value="approvals" 
              className="rounded-lg flex items-center gap-2 text-black data-[state=active]:bg-purple-600 data-[state=active]:text-white relative"
            >
              <FiUserCheck className="h-4 w-4" />
              <span>Manage Signups</span>
              {pendingCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="create" 
              className="rounded-lg flex items-center gap-2 text-black data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              <FiUserPlus className="h-4 w-4" />
              <span>Create User</span>
            </TabsTrigger>
            {showEditTab && (
              <TabsTrigger 
                value="edit" 
                className="rounded-lg flex items-center gap-2 text-black data-[state=active]:bg-purple-600 data-[state=active]:text-white"
              >
                <FiEdit className="h-4 w-4" />
                <span>Edit User</span>
              </TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="users" className="mt-6">
            <UserManagement currentUser={currentUser} onEditUser={handleEditUser} />
          </TabsContent>
          
          <TabsContent value="approvals" className="mt-6">
            <UserApprovals currentUser={currentUser} />
          </TabsContent>
          
          <TabsContent value="create" className="mt-6">
            <CreateUserTab currentUser={currentUser} />
          </TabsContent>
          
          {showEditTab && (
            <TabsContent value="edit" className="mt-6">
              <EditUserTab currentUser={currentUser} userToEdit={selectedUser} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
} 
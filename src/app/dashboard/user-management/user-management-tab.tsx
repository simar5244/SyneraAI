'use client';

import React, { useState, useEffect } from 'react';
import { FiSearch, FiEdit, FiTrash2, FiUser, FiPlus } from 'react-icons/fi';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

interface User {
  _id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  company?: string;
  companyCode?: string;
  status?: 'active' | 'inactive' | 'pending' | 'rejected';
  createdAt: string;
}

interface UserManagementProps {
  currentUser: any;
  onEditUser: (user: User) => void;
}

export default function UserManagement({ currentUser, onEditUser }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch users when component mounts
  useEffect(() => {
    if (currentUser) {
      fetchUsers();
    }
  }, [currentUser, searchTerm, roleFilter, statusFilter]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams();
      
      if (searchTerm) queryParams.append('search', searchTerm);
      if (roleFilter !== 'all') queryParams.append('role', roleFilter);
      if (statusFilter !== 'all') queryParams.append('status', statusFilter);
      if (currentUser?.company) queryParams.append('company', currentUser.company);
      if (currentUser?.companyCode) queryParams.append('companyCode', currentUser.companyCode);
      
      console.log(`Fetching users with params: ${queryParams.toString()}`);
      
      const response = await fetch(`/api/admin/users?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      console.log('Users data:', data);
      
      // Handle different response formats
      setUsers(Array.isArray(data) ? data : (data.users || []));
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setError(error.message || 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    try {
      const token = localStorage.getItem('token');
      
      // First attempt: Try the bulk delete API
      let response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userIds: [user._id]
        })
      });
      
      // If failed, try the individual user delete endpoint
      if (!response.ok) {
        console.log("Falling back to [id] endpoint");
        response = await fetch(`/api/admin/users/${user._id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccessMessage(`User ${user.username} has been deleted.`);
        fetchUsers(); // Refresh the user list
        
        // Hide success message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(data.error || 'Failed to delete user.');
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      setError(error.message || 'Failed to delete user');
    }
  };

  // Helper function to get appropriate badge class for role
  const getRoleBadgeClass = (role: string): string => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'superadmin':
        return 'bg-red-100 text-red-800';
      case 'top_management_tier_1':
      case 'top_management_tier_2':
      case 'top_management_tier_3':
        return 'bg-blue-100 text-blue-800';
      case 'employee_tier_1':
      case 'employee_tier_2':
      case 'employee_tier_3':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper function to get appropriate status badge class
  const getStatusClass = (status?: string): string => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium';
      case 'pending':
        return 'bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-medium';
      case 'rejected':
        return 'bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium';
      default:
        return 'bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium';
    }
  };

  // Helper function to display role in a more readable format
  const displayRole = (role: string): string => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'superadmin': return 'Super Admin';
      case 'top_management_tier_1': return 'Top Management';
      case 'top_management_tier_2': return 'Top Management';
      case 'top_management_tier_3': return 'Top Management';
      case 'employee_tier_1': return 'Employee';
      case 'employee_tier_2': return 'Employee';
      case 'employee_tier_3': return 'Employee';
      default: return role;
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="relative w-full md:w-[60%]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="h-5 w-5 text-gray-400" />
          </div>
          <Input
            type="text"
            placeholder="Search users..."
            className="pl-10 pr-4 py-2 w-full rounded-lg border-gray-300"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value)}>
            <SelectTrigger className="w-[150px] bg-white rounded-lg text-black border border-gray-300">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent className="bg-white text-black">
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="top_management_tier_1">Top Management</SelectItem>
              <SelectItem value="employee_tier_1">Employee</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
            <SelectTrigger className="w-[150px] bg-white rounded-lg text-black border border-gray-300">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-white text-black">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 text-green-700 p-4 rounded-lg mb-6">
          {successMessage}
        </div>
      )}
      
      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-purple-100">
              <tr>
                <th className="px-6 py-3 font-semibold text-gray-600 rounded-tl-lg">USER</th>
                <th className="px-6 py-3 font-semibold text-gray-600">EMAIL</th>
                <th className="px-6 py-3 font-semibold text-gray-600">ROLE</th>
                <th className="px-6 py-3 font-semibold text-gray-600">STATUS</th>
                <th className="px-6 py-3 font-semibold text-gray-600 rounded-tr-lg">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center">
                    <Spinner size="lg" className="mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 flex items-center">
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                        <FiUser className="h-5 w-5 text-gray-500" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {user.username}
                        </div>
                        <div className="text-gray-500">
                          {user.firstName} {user.lastName}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {user.email}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`${getRoleBadgeClass(user.role)} px-2 py-1 rounded-full text-xs font-medium`}>
                        {displayRole(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={getStatusClass(user.status)}>
                        {user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <Button 
                          onClick={() => onEditUser(user)}
                          variant="ghost" 
                          size="sm"
                          className="text-gray-700 hover:bg-purple-100 hover:text-purple-700 rounded-lg"
                        >
                          <FiEdit className="h-4 w-4" />
                          <span className="ml-1">Edit</span>
                        </Button>
                        <Button 
                          onClick={() => handleDeleteUser(user)}
                          variant="ghost" 
                          size="sm"
                          className="text-gray-700 hover:bg-red-100 hover:text-red-700 rounded-lg"
                        >
                          <FiTrash2 className="h-4 w-4" />
                          <span className="ml-1">Delete</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 
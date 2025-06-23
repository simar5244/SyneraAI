'use client';

import React, { useState, useEffect } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { FiUser, FiMail, FiLock, FiSave, FiArrowLeft } from 'react-icons/fi';

interface EditUserTabProps {
  currentUser: any;
  userToEdit: any;
}

interface UserFormData {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  password?: string;
  status: string;
  companyCode: string;
}

export default function EditUserTab({ currentUser, userToEdit }: EditUserTabProps) {
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    role: '',
    password: '',
    status: '',
    companyCode: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  
  // Set form data when userToEdit changes
  useEffect(() => {
    if (userToEdit) {
      console.log('User to edit:', userToEdit);
      // Use either _id or id, depending on which one exists
      const id = userToEdit._id || userToEdit.id;
      setUserId(id);
      
      setFormData({
        username: userToEdit.username || '',
        email: userToEdit.email || '',
        firstName: userToEdit.firstName || '',
        lastName: userToEdit.lastName || '',
        role: userToEdit.role || 'employee_tier_3',
        password: '',  // Don't fill password for security
        status: userToEdit.status || 'active',
        companyCode: userToEdit.companyCode || currentUser?.companyCode || ''
      });
    }
  }, [userToEdit, currentUser]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name: string, value: string) => {
    // Ensure status and role are never empty strings
    if ((name === 'status' || name === 'role') && !value) {
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError('Cannot identify user ID');
      return;
    }
    
    // Validate required fields
    if (!formData.username || !formData.email || !formData.role || !formData.status) {
      setError('Username, email, role, and status are required fields');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }
      
      // Create payload - remove empty password if needed
      const payload = { ...formData } as Record<string, any>;
      if (!payload.password) {
        delete payload.password;
      }
      
      console.log(`Updating user with ID: ${userId}`);
      console.log('Update payload:', payload);
      
      // First try the updated admin/users API
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      // If that fails, try the older [id] endpoint with PUT method
      if (response.status === 404) {
        console.log('Falling back to [id] endpoint');
        const fallbackResponse = await fetch(`/api/admin/users/${userId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        if (!fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          throw new Error(fallbackData.error || 'Failed to update user');
        }
        
        const fallbackResult = await fallbackResponse.json();
        console.log('User updated successfully (fallback):', fallbackResult);
        
        setSuccessMessage('User updated successfully!');
        return;
      }
      
      // Handle normal response
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user');
      }
      
      console.log('User updated successfully:', data);
      setSuccessMessage('User updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      
    } catch (error: any) {
      console.error('Error updating user:', error);
      setError(error.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!userToEdit) {
    return (
      <div className="bg-white shadow-sm rounded-xl p-6 border border-gray-200">
        <div className="text-center py-8">
          <p className="text-gray-500">No user selected for editing</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white shadow-sm rounded-xl p-6 border border-gray-200">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Edit User: {userToEdit?.username}
        </h2>
        <p className="text-gray-600">
          Update user information and permissions.
        </p>
        <p className="text-gray-500 text-sm mt-1">
          User ID: {userId}
        </p>
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
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-gray-700">
              Username <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiUser className="text-gray-400" />
              </div>
              <Input
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="pl-10 rounded-lg"
                placeholder="username"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-700">
              Email <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiMail className="text-gray-400" />
              </div>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                className="pl-10 rounded-lg"
                placeholder="email@example.com"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-gray-700">
              First Name
            </Label>
            <Input
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              className="rounded-lg"
              placeholder="First name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-gray-700">
              Last Name
            </Label>
            <Input
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              className="rounded-lg"
              placeholder="Last name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-700">
              Password
              <span className="text-gray-500 text-xs ml-2">(Leave empty to keep current)</span>
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiLock className="text-gray-400" />
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                className="pl-10 rounded-lg"
                placeholder="New password"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role" className="text-gray-700">
              Role <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={formData.role} 
              onValueChange={(value) => handleSelectChange('role', value)}
              name="role"
            >
              <SelectTrigger className="rounded-lg bg-white text-black border border-gray-300">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="bg-white text-black">
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="top_management_tier_1">Top Management Tier 1</SelectItem>
                <SelectItem value="top_management_tier_2">Top Management Tier 2</SelectItem>
                <SelectItem value="top_management_tier_3">Top Management Tier 3</SelectItem>
                <SelectItem value="employee_tier_1">Employee Tier 1</SelectItem>
                <SelectItem value="employee_tier_2">Employee Tier 2</SelectItem>
                <SelectItem value="employee_tier_3">Employee Tier 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status" className="text-gray-700">
              Status <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={formData.status} 
              onValueChange={(value) => handleSelectChange('status', value)}
              name="status"
            >
              <SelectTrigger className="rounded-lg bg-white text-black border border-gray-300">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-white text-black">
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="pt-4 flex justify-end space-x-3">
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" /> Updating...
              </>
            ) : (
              <>
                <FiSave className="h-4 w-4" /> Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
} 
'use client';

import React, { useState } from 'react';
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
import { FiUser, FiMail, FiLock, FiUserPlus } from 'react-icons/fi';

interface CreateUserTabProps {
  currentUser: any;
}

export default function CreateUserTab({ currentUser }: CreateUserTabProps) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'employee_tier_3',
    password: '',
    status: 'active'
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Use-Collection': 'users'
        },
        body: JSON.stringify({
          ...formData,
          company: currentUser?.company || '',
          companyCode: currentUser?.companyCode || ''
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }
      
      // Reset form
      setFormData({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        role: 'employee_tier_3',
        password: '',
        status: 'active'
      });
      
      setSuccessMessage('User created successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      
    } catch (error: any) {
      console.error('Error creating user:', error);
      setError(error.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="bg-white shadow-sm rounded-xl p-6 border border-gray-200">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Create New User</h2>
        <p className="text-gray-600">
          Add a new user to your organization with specific role and permissions.
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
              Password <span className="text-red-500">*</span>
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
                placeholder="Minimum 8 characters"
                required
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
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="mt-8 flex justify-end">
          <Button
            type="submit"
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Spinner size="sm" />
            ) : (
              <FiUserPlus className="h-4 w-4" />
            )}
            {isSubmitting ? 'Creating...' : 'Create User'}
          </Button>
        </div>
      </form>
    </div>
  );
} 
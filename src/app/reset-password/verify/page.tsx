'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

export default function ResetPasswordVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Get email from URL parameters
  useEffect(() => {
    const emailParam = searchParams?.get('email');
    if (emailParam) setEmail(emailParam);
  }, [searchParams]);
  
  // Clean up any verification messages when showing success state
  useEffect(() => {
    if (success) {
      // Remove any verification notification elements that might appear
      const verificationMsgs = document.querySelectorAll('.green-notification:not(.success-notification)');
      verificationMsgs.forEach(el => el.remove());
    }
  }, [success]);
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          otp,
          newPassword: password
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }
      
      setSuccess(true);
      
      // Redirect to login page after a delay
      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);
    } catch (error: any) {
      console.error('Password reset error:', error);
      setError(error.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Handle page title to avoid showing "Password Reset Complete" */}
      <div id="password-reset-verify-page" style={{ display: 'none' }} />
      {/* Full-page background image */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center z-0" 
        style={{ 
          backgroundImage: 'url(/images/philip-oroni-C_y8UiVIzP8-unsplash.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      ></div>
      
      <div className="flex w-[900px] h-[640px] overflow-hidden rounded-xl shadow-2xl bg-white relative z-10" style={{ width: '800px !important', height: '550px !important' }}>
        {/* Left side - Reset form */}
        <div className="p-8 bg-white overflow-y-auto" style={{ width: '350px !important', height: '100%', flexShrink: 0 }}>
          <h2 className="text-lg font-semibold text-gray-800 mb-5">Reset Your Password</h2>
          
          {error && (
            <div className="mb-3 p-2.5 bg-red-50 text-red-700 rounded-md">
              <p className="text-sm">{error}</p>
            </div>
          )}
          
          {success ? (
            <>
              <h2 className="text-lg font-semibold text-gray-800 mb-5" style={{display: 'none'}}></h2>
              <div className="mb-3 p-2.5 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-md">
                <p className="font-medium text-sm">Password Reset Successful!</p>
                <p className="mt-1 text-sm">
                  
                </p>
              </div>
              
              <div className="mt-4">
                <a href="/login" 
                  className="w-full flex justify-center py-1.5 px-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500">
                  Go to Login
                </a>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2.5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-600 mb-0.5">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-0 block w-full px-2.5 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900"
                  placeholder="you@example.com"
                  required
                  readOnly={!!searchParams?.get('email')}
                />
              </div>
              
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-600 mb-0.5">
                  Verification Code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-2.5 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-center text-xl tracking-widest text-gray-900"
                  placeholder="000000"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-600 mb-0.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-0 block w-full px-2.5 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900"
                    placeholder="••••••••"
                    minLength={8}
                    required
                  />
                  <button 
                    type="button"
                    className="absolute inset-y-0 right-0 px-2 flex items-center text-sm text-gray-500"
                    onClick={togglePasswordVisibility}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-600 mb-0.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-0 block w-full px-2.5 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900"
                    placeholder="••••••••"
                    minLength={8}
                    required
                  />
                  <button 
                    type="button"
                    className="absolute inset-y-0 right-0 px-2 flex items-center text-sm text-gray-500"
                    onClick={toggleConfirmPasswordVisibility}
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-1.5 px-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
              >
                {isLoading ? 'Resetting Password...' : 'Reset Password'}
              </button>
              
              <div className="mt-3 text-center">
                <p className="text-sm text-gray-500">
                  Remember your password?{' '}
                  <a href="/login" className="font-medium text-purple-600 hover:text-purple-500">
                    Sign in
                  </a>
                </p>
              </div>
            </form>
          )}
        </div>
        
        {/* Right side - Image and Title */}
        <div className="bg-gradient-to-br from-purple-600 to-pink-500 p-8 flex flex-col justify-center items-center text-white relative overflow-hidden" style={{ width: '528px !important', height: '100%', flexShrink: 0 }}>
          <img
            src="/images/sincerely-media-cuEpo721ACY-unsplash.jpg"
            alt="Abstract Background Texture"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="relative z-10 text-center">
            <h1 className="text-[2.75rem] leading-tight font-bold mb-1.5">
              <span className="text-purple-300">Synera</span> <span className="text-white">AI</span>
            </h1>
            <p className="text-xl text-purple-100 mb-6"></p>
          </div>
        </div>
      </div>
    </div>
  );
} 
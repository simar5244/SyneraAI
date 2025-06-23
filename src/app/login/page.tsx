'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMFA, setShowMFA] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSession, setMfaSession] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Create a common function for status check and redirect
  const checkStatusAndRedirect = (token: string) => {
    // Force status check to make sure we have latest status
    fetch('/api/auth/check-status', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache, no-store, max-age=0',
        'Pragma': 'no-cache'
      }
    })
      .then(res => res.json())
      .then(statusData => {
        console.log('User status from fresh check:', statusData?.status);
        
        // Update user data in localStorage with latest status
        if (statusData?.user) {
          localStorage.setItem('user', JSON.stringify(statusData.user));
        }
        
        // Redirect based on status
        if (statusData?.status === 'active') {
          window.location.href = '/dashboard';
        } else if (statusData?.status === 'pending') {
          window.location.href = '/pending-approval';
        } else {
          // Default fallback
          window.location.href = '/dashboard';
        }
      })
      .catch(err => {
        console.error('Error checking status:', err);
        // Fallback to dashboard on error
        window.location.href = '/dashboard';
      });
  };

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/dashboard');
    }
    // Check if we have saved credentials
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    console.log('Login attempt for:', email);

    try {
      // Save email for "Remember me" feature
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      // Make login request to API
      console.log('Sending login request...');
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      console.log('Login response status:', response.status);
      const data = await response.json();
      console.log('Login response data:', JSON.stringify(data));

      if (!response.ok) {
        // Check for special status scenarios
        if (data.status === 'pending') {
          console.log('User account status: pending');
          // Clear any existing authentication tokens to prevent stale login
          localStorage.removeItem('token');
          document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          // Store minimal user info for the pending approval page
          localStorage.setItem('user', JSON.stringify({
            email,
            username: data.username || email.split('@')[0],
            company: data.company,
            role: data.role || 'user',
            companyCode: data.companyCode
          }));
          window.location.href = data.redirectTo || '/pending-approval';
          return;
        } else if (data.status === 'rejected') {
          console.log('User account status: rejected');
          // Store minimal user info for the access blocked page
          localStorage.setItem('user', JSON.stringify({
            email,
            username: data.username || email.split('@')[0],
            company: data.company,
            role: data.role || 'user',
            companyCode: data.companyCode
          }));
          window.location.href = data.redirectTo || '/access-blocked';
          return;
        }
        
        console.error('Login failed:', data.message);
        throw new Error(data.message || 'Failed to login');
      }

      // Check if MFA is required
      if (data.requireMFA) {
        console.log('MFA required');
        setShowMFA(true);
        setMfaSession(data.mfaSession);
        setIsLoading(false);
        return;
      }

      // Store authentication data
      console.log('Login successful, storing token and user data');
      localStorage.setItem('token', data.token);
      
      // Ensure companyCode is available in user data 
      const userData = data.user ? { 
        ...data.user,
        // Ensure companyCode is set (using company_code as fallback)
        companyCode: data.user.companyCode || data.user.company_code,
        // Also set company_code for backward compatibility
        company_code: data.user.companyCode || data.user.company_code
      } : null;
      
      if (userData) {
        console.log('User data being stored:', JSON.stringify({
          id: userData.id,
          email: userData.email,
          role: userData.role,
          companyCode: userData.companyCode,
          company: userData.company
        }));
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        console.error('No user data received from login response');
      }
      
      console.log('LoginPage: stored token', data.token?.substring(0, 10) + '...');
      // Also set cookie for API routes
      document.cookie = `token=${data.token}; path=/;`;

      // Successful login, but check status before redirecting
      console.log('Checking current status before redirecting');
      
      checkStatusAndRedirect(data.token);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-mfa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mfaCode,
          mfaSession
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to verify MFA code');
      }

      // Store authentication data after MFA
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      console.log('LoginPage MFA: stored token', localStorage.getItem('token'));
      document.cookie = `token=${data.token}; path=/;`;

      // Successful login, but check status before redirecting
      console.log('Checking current status before redirecting');
      
      checkStatusAndRedirect(data.token);
    } catch (err: any) {
      console.error('MFA verification error:', err);
      setError(err.message || 'An error occurred during MFA verification');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleBackToLogin = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent default button behavior
    setShowMFA(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 w-full h-full bg-cover bg-center z-0" style={{backgroundImage: 'url(/images/philip-oroni-C_y8UiVIzP8-unsplash.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat'}} />
      <div className="flex w-[900px] h-[640px] overflow-hidden rounded-xl shadow-2xl bg-white relative z-10" style={{ width: '800px !important', height: '550px !important' }}>
        {/* Left side - Login form */}
        <div className="p-8 bg-white overflow-y-auto" style={{ width: '350px !important', height: '100%', flexShrink: 0 }}>
          <h2 className="text-lg font-semibold text-gray-800 mb-5">Sign In</h2>
          {error && (
            <div className="mb-3 p-2.5 bg-red-50 text-red-700 rounded-md">
              <p className="text-sm">{error}</p>
            </div>
          )}
          {!showMFA ? (
            <form onSubmit={handleSubmit} className="space-y-2.5">
              <div className="mb-6">
                <label htmlFor="email" className="block text-sm font-medium text-gray-600 mb-0.5">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-0 block w-full px-2.5 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900"
                  placeholder="example@email.com"
                  required
                />
              </div>

              <div className="mb-6">
                <label htmlFor="password" className="block text-sm font-medium text-gray-600 mb-0.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-0 block w-full px-2.5 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                    onClick={togglePasswordVisibility}
                  >
                    {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mb-7">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={() => setRememberMe(!rememberMe)}
                    className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-600">Remember me</label>
                </div>
                <div>
                  <a href="/reset-password" className="text-purple-600 hover:text-purple-700 font-medium text-sm">Forgot your password?</a>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center py-1.5 px-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                  isLoading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMFASubmit} className="space-y-2.5">
              <div className="mb-6 bg-purple-50 border-l-4 border-purple-500 text-purple-700 p-5 rounded-md">
                <p className="font-medium text-[15px]">Two-Factor Authentication</p>
                <p className="mt-2 text-[15px]">A verification code has been sent to your email address. Please enter it below.</p>
              </div>
              
              <div className="mb-7">
                <label htmlFor="mfa-code" className="block text-gray-700 font-medium mb-3 text-[15px]">
                  Verification Code
                </label>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="mt-0 block w-full px-2.5 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900 text-center"
                  placeholder="000000"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center py-1.5 px-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                  isLoading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </button>
              
              <button
                type="button"
                onClick={handleBackToLogin}
                className="w-full flex justify-center mt-4 py-1.5 px-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                Back to Login
              </button>
            </form>
          )}

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <a href="/signup" className="text-purple-600 hover:text-purple-800 font-medium">
                Sign up
              </a>
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Need a company account?{' '}
              <a href="/company-signup" className="text-purple-600 hover:text-purple-800 font-medium">
                Create one 
              </a>
            </p>
          </div>
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
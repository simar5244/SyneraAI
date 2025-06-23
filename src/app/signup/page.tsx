'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

type SignupFormData = {
  username: string;
  email: string;
  company: string;
  companyCode: string;
  password: string;
  confirmPassword: string;
};

export default function SignupPage() {
  const router = useRouter();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<SignupFormData>();
  const [isLoading, setIsLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showMFA, setShowMFA] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSession, setMfaSession] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  
  // Watch password for confirmation validation
  const password = watch('password');
  
  // Add console debugging
  useEffect(() => {
    console.log('SignupPage loaded successfully');
  }, []);
  
  const onSubmit = async (data: SignupFormData) => {
    if (data.password !== data.confirmPassword) {
      setSignupError('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    setSignupError(null);
    
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: data.username,
          email: data.email,
          company: data.company,
          companyCode: data.companyCode,
          password: data.password,
          firstName: '', // Add these fields if needed
          lastName: ''
        }),
      });
      
      const result = await response.json();
      console.log('Signup response:', result);
      
      if (response.ok) {
        // Store user data for later use
        setUserData(result.user);
        
        // Check if MFA is required (it should be)
        if (result.requireMFA && result.mfaSession) {
          console.log('MFA required, showing verification form');
          setMfaSession(result.mfaSession);
          setShowMFA(true);
        } else {
          // Fallback in case MFA is not required for some reason
          console.log('MFA not required, storing token and redirecting');
          localStorage.setItem('token', result.token);
          localStorage.setItem('user', JSON.stringify(result.user));
          
          // Redirect based on user status
          if (result.user && result.user.status === 'pending') {
            window.location.href = '/pending-approval';
          } else {
            window.location.href = '/dashboard';
          }
        }
      } else {
        setSignupError(result.message || 'An error occurred during signup');
      }
    } catch (error) {
      console.error('Signup error:', error);
      setSignupError('Failed to connect to the server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSignupError(null);
    
    try {
      console.log('Verifying MFA code:', mfaCode);
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
      
      const result = await response.json();
      console.log('MFA verification response:', result);
      
      if (response.ok) {
        // Store authentication data
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        
        console.log('MFA verification successful, checking user status');
        
        // Always redirect to pending approval page after MFA verification for new signups
        console.log('User is pending approval, redirecting');
        window.location.href = '/pending-approval';
      } else {
        setSignupError(result.message || 'Failed to verify code');
      }
    } catch (error) {
      console.error('MFA verification error:', error);
      setSignupError('Failed to connect to the server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!userData || !userData.email || !userData.username) {
      setSignupError('Missing user data for resending code');
      return;
    }
    
    setResendLoading(true);
    setResendSuccess(false);
    setSignupError(null);
    
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.email,
          username: userData.username,
          userId: userData.id
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setResendSuccess(true);
        setMfaSession(result.mfaSession || mfaSession);
      } else {
        setSignupError(result.message || 'Failed to resend verification code');
      }
    } catch (error) {
      console.error('Resend code error:', error);
      setSignupError('Failed to connect to the server');
    } finally {
      setResendLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
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
        {/* Left side - Signup form */}
        <div className="p-8 bg-white overflow-y-auto" style={{ width: '350px !important', height: '100%', flexShrink: 0 }}>
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-800">Sign Up to InsideBox</h2>
          </div>
          
          {signupError && (
            <div className="mb-3 p-2.5 bg-red-50 text-red-700 rounded-md">
              <p className="text-sm">{signupError}</p>
            </div>
          )}
          
          {showMFA ? (
            <form onSubmit={handleMFASubmit}>
              <div className="mb-3 bg-purple-50 border-l-4 border-purple-500 text-purple-700 p-2.5 rounded-md">
                <p className="font-medium text-sm">Verify Your Email</p>
                <p className="mt-1 text-sm">We&apos;ve sent a verification code to your email address. Please enter it below to complete your registration.</p>
              </div>
              
              {resendSuccess && (
                <div className="mb-3 bg-green-50 border-l-4 border-green-500 text-green-700 p-2.5 rounded-md">
                  <p className="text-sm">A new verification code has been sent to your email.</p>
                </div>
              )}
              
              <div className="mb-3">
                <label htmlFor="mfa-code" className="block text-sm font-medium text-gray-600 mb-0.5">
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
                  className="w-full px-2.5 py-1 border border-gray-300 bg-white text-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-center text-xl tracking-widest"
                  placeholder="000000"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-1.5 px-3 text-sm rounded-md font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                  isLoading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? 'Verifying...' : 'Verify Account'}
              </button>
              
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendLoading}
                  className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                >
                  {resendLoading ? 'Sending...' : 'Resend Verification Code'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-600 mb-0.5">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  {...register('username', { required: 'Username is required' })}
                  className="mt-0 block w-full px-2.5 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900"
                />
                {errors.username && <p className="mt-0.5 text-sm text-red-500">{errors.username.message}</p>}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-600 mb-0.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                  className="mt-0 block w-full px-2.5 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900"
                />
                {errors.email && <p className="mt-0.5 text-sm text-red-500">{errors.email.message}</p>}
              </div>

              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-600 mb-0.5">
                  Company Name
                </label>
                <input
                  id="company"
                  type="text"
                  {...register('company', { required: 'Company name is required' })}
                  className="mt-0 block w-full px-2.5 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900"
                />
                {errors.company && <p className="mt-0.5 text-sm text-red-500">{errors.company.message}</p>}
              </div>

              <div>
                <label htmlFor="companyCode" className="block text-sm font-medium text-gray-600 mb-0.5">
                  Company Code
                </label>
                <input
                  id="companyCode"
                  type="text"
                  {...register('companyCode', { required: 'Company code is required' })}
                  className="mt-0 block w-full px-2.5 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900"
                />
                {errors.companyCode && <p className="mt-0.5 text-sm text-red-500">{errors.companyCode.message}</p>}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-600 mb-0.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    {...register('password', {
                      required: 'Password is required',
                      minLength: {
                        value: 8,
                        message: 'Password must be at least 8 characters',
                      },
                    })}
                    className="mt-0 block w-full px-2.5 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 px-2 flex items-center text-sm text-gray-500"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                {errors.password && <p className="mt-0.5 text-sm text-red-500">{errors.password.message}</p>}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-600 mb-0.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    {...register('confirmPassword', {
                      required: 'Confirm password is required',
                      validate: value =>
                        value === password || 'Passwords do not match',
                    })}
                    className="mt-0 block w-full px-2.5 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={toggleConfirmPasswordVisibility}
                    className="absolute inset-y-0 right-0 px-2 flex items-center text-sm text-gray-500"
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-0.5 text-sm text-red-500">{errors.confirmPassword.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-1.5 px-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
              >
                {isLoading ? 'Signing Up...' : 'Sign Up'}
              </button>
              
              <div className="mt-3 text-center">
                <p className="text-sm text-gray-500">
                  Already have an account?{' '}
                  <a href="/login" className="font-medium text-purple-600 hover:text-purple-500">
                    Sign in
                  </a>
                </p>
              </div>
              
              <div className="mt-1.5 text-center">
                <p className="text-sm text-gray-500">
                  Need a company account?{' '}
                  <a href="/company-signup" className="font-medium text-purple-600 hover:text-purple-500">
                    Create one
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
            <p className="text-xl text-purple-100 mb-6">
              
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 
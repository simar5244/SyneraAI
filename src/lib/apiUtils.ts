import { toast } from 'react-hot-toast';

/**
 * Utility functions for API calls to handle authentication and multi-tenancy
 */

/**
 * Get the authentication token from localStorage
 * @returns The token or null if not found
 */
export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem('token');
  } catch (error) {
    console.error('Error accessing localStorage:', error);
    return null;
  }
};

/**
 * Get the current user from localStorage
 * @returns The user object or null if not found
 */
export const getCurrentUser = (): any | null => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch (error) {
    console.error('Error parsing user from localStorage:', error);
    return null;
  }
};

/**
 * Get the company code from the current user
 * @returns The company code or null if not found
 */
export const getCompanyCode = (): string | null => {
  const user = getCurrentUser();
  return user?.companyCode || user?.company_code || null;
};

/**
 * Refreshes the authentication token
 * @returns A promise that resolves to true if successful, false otherwise
 */
export const refreshAuthToken = async (): Promise<boolean> => {
  try {
    const currentToken = getAuthToken();
    if (!currentToken) {
      console.error('No token to refresh');
      return false;
    }

    // Call the refresh token endpoint
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      }
    });

    if (!response.ok) {
      console.error('Token refresh failed:', response.status, response.statusText);
      return false;
    }

    const data = await response.json();
    if (data.token) {
      localStorage.setItem('token', data.token);
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return false;
  }
};

/**
 * Makes an authenticated API call with token refresh on 401
 * @param url The API endpoint URL
 * @param options Fetch options
 * @returns The fetch response
 */
export const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  try {
    // Get the token
    let token = getAuthToken();
    if (!token) {
      toast.error('Authentication required. Please log in.');
      throw new Error('No authentication token found');
    }

    // Add the token to the headers
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };

    // Make the API call
    let response = await fetch(url, {
      ...options,
      headers
    });

    // If unauthorized, try to refresh the token and retry
    if (response.status === 401) {
      console.log('Token expired, attempting to refresh...');
      const refreshed = await refreshAuthToken();
      
      if (refreshed) {
        // Get the new token
        token = getAuthToken();
        if (!token) throw new Error('Token refresh succeeded but no token found');
        
        // Retry the API call with the new token
        response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`
          }
        });
      } else {
        toast.error('Your session has expired. Please log in again.');
        // Clear the token and user data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Redirect to login if we're in the browser
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }

    return response;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

/**
 * Checks if the user is authenticated
 * @returns true if authenticated, false otherwise
 */
export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

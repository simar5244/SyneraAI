import { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export default function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Here you would normally fetch the user from your authentication provider
        // For now, we'll mock a successful authentication
        const mockUser = {
          id: '1',
          name: 'Demo User',
          email: 'demo@example.com',
          role: 'admin',
        };

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));

        setAuthState({
          user: mockUser,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (error) {
        console.error('Auth error:', error);
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Mock successful login
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const mockUser = {
        id: '1',
        name: 'Demo User',
        email,
        role: 'admin',
      };
      
      setAuthState({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
      });
      
      return { success: true };
    } catch (error) {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      
      return { success: false, error: 'Invalid credentials' };
    }
  };
  
  const logout = async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Mock logout
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      
      return { success: true };
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: 'Logout failed' };
    }
  };

  return {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    login,
    logout,
  };
} 
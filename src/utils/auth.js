// Client-side authentication helpers

/**
 * Checks if the user is authenticated and has the required role
 * @param {string[]} requiredRoles - Array of roles that are allowed
 * @returns {Promise<{authenticated: boolean, authorized: boolean, user: object|null}>}
 */
export async function checkUserAuth(requiredRoles = []) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { authenticated: false, authorized: false, user: null };
    }

    const response = await fetch('/api/auth/check-role', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error('Auth check failed:', response.status);
      return { authenticated: false, authorized: false, user: null };
    }

    const data = await response.json();
    
    if (!data.authenticated) {
      return { authenticated: false, authorized: false, user: null };
    }
    
    // Check role authorization if roles are specified
    const isAuthorized = requiredRoles.length === 0 || 
                         (data.user && requiredRoles.includes(data.user.role));
    
    return { 
      authenticated: true, 
      authorized: isAuthorized,
      user: data.user
    };
  } catch (error) {
    console.error('Error checking authentication:', error);
    return { authenticated: false, authorized: false, user: null };
  }
}

/**
 * Redirects user based on authentication status
 * @param {function} router - Next.js router
 * @param {object} authState - Result from checkUserAuth
 * @param {string} redirectTo - Where to redirect if not authenticated
 * @returns {boolean} - Whether a redirect was performed
 */
export function handleAuthRedirect(router, authState, redirectTo = '/login') {
  if (!authState.authenticated) {
    router.push(redirectTo);
    return true;
  }
  
  // Even if not authorized for specific role, still allow user to stay
  // (they'll be redirected to dashboard by the natural UI flow)
  return false;
} 
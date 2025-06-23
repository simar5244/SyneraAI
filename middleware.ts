import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

console.log('[AccessControlMiddleware] middleware.ts loaded');

// This middleware runs on the Edge Runtime
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  console.log('[EXTREME_DEBUG] ========== MIDDLEWARE START ==========');
  console.log('[EXTREME_DEBUG] Processing path:', path);
  console.log('[EXTREME_DEBUG] Full URL:', request.url);
  console.log('[EXTREME_DEBUG] Request method:', request.method);
  
  // Allow login and signup pages
  if (path === '/login' || path === '/signup' || path.startsWith('/signup/')) {
    console.log('[EXTREME_DEBUG] Bypassing login/signup page for path:', path);
    return NextResponse.next();
  }

  // Paths that don't require authentication
  const publicPaths = [
    '/',
    '/login',
    '/signup',
    '/signup/company',
    '/signup/user',
    '/company-signup',
    '/reset-password',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/signup',
    '/api/auth/company-signup',
    '/api/auth/create-admin',
    '/api/auth/verify-mfa',
    '/api/auth/request-password-reset',  // allow password reset requests without auth
    '/api/auth/resend-verification',     // allow resending MFA codes
    '/api/auth/reset-password',
    '/api/stripe/create-payment-intent',
    '/api/stripe/webhook',
    '/access-blocked',
    '/admin-setup',
    '/terms',
    '/privacy',
    '/api/health', // added to bypass publicPaths
  ];

  // Additional paths that are allowed for specific user statuses
  const statusRestrictedPaths = {
    pending: ['/pending-approval', '/api/auth/logout'],
    inactive: ['/inactive-account', '/api/auth/logout'],
    rejected: ['/rejected-account', '/api/auth/logout'],
  };

  // Function to check if the path matches any public paths
  const isPublicPath = (path: string) => {
    console.log('[EXTREME_DEBUG] Checking if path is public:', path);
    
    // Allow Stripe API routes
    if (path.startsWith('/api/stripe/')) {
      console.log('[EXTREME_DEBUG] Stripe API route detected');
      return true;
    }
    
    // High priority matches for signup pages - check these first
    if (path === '/signup' || path === '/company-signup' || path.startsWith('/signup/')) {
      console.log('[EXTREME_DEBUG] Signup page detected');
      return true;
    }
    
    const isPublic = publicPaths.some(publicPath => 
      path === publicPath || 
      path.startsWith('/api/public') || 
      path.startsWith('/_next') || 
      path.startsWith('/fonts') || 
      path.startsWith('/images') ||
      /\.(js|css|ico|png|jpg|jpeg|svg|woff2|json|map)$/i.test(path)
    );
    
    console.log('[EXTREME_DEBUG] Is public path?', isPublic);
    return isPublic;
  };

  // Function to check if a path is allowed for a specific user status
  const isAllowedForStatus = (path: string, status: string): boolean => {
    const allowedPaths = statusRestrictedPaths[status as keyof typeof statusRestrictedPaths] || [];
    const isAllowed = allowedPaths.some(allowedPath => path === allowedPath);
    console.log('[EXTREME_DEBUG] Is path allowed for status?', { path, status, isAllowed, allowedPaths });
    return isAllowed;
  };

  // Bypass all authentication-related endpoints early
  if (path.startsWith('/api/auth') || path.startsWith('/auth')) {
    console.log('[EXTREME_DEBUG] Bypassing auth routes for path:', path);
    return NextResponse.next();
  }

  // Bypass control for internal user count endpoint
  if (path.startsWith('/api/users/count')) {
    console.log('[EXTREME_DEBUG] Skipping access control for user count API');
    return NextResponse.next();
  }

  // Allow access to public paths without authentication
  if (isPublicPath(path)) {
    console.log('[EXTREME_DEBUG] Public path access granted:', path);
    return NextResponse.next();
  }

  // Get token from request cookies or headers
  const cookieToken = request.cookies.get('token')?.value;
  const headerToken = request.headers.get('authorization')?.split(' ')[1];
  const token = cookieToken || headerToken || '';
  
  console.log('[EXTREME_DEBUG] Token sources:', {
    hasCookieToken: !!cookieToken,
    hasHeaderToken: !!headerToken,
    finalTokenExists: !!token,
    tokenLength: token.length
  });
  
  if (!token) {
    console.log('[EXTREME_DEBUG] ❌ NO TOKEN FOUND - REDIRECTING TO LOGIN');
    console.log('[EXTREME_DEBUG] Available cookies:', request.cookies.getAll().map(c => c.name));
    console.log('[EXTREME_DEBUG] Authorization header:', request.headers.get('authorization'));
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Verify token - Using only edge-compatible JWT verification
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(process.env.JWT_SECRET || 'organization-galaxy-secret-key');
    
    try {
      console.log('[EXTREME_DEBUG] 🔐 Starting token verification');
      console.log('[EXTREME_DEBUG] JWT_SECRET exists:', !!process.env.JWT_SECRET);
      
      const { payload } = await jwtVerify(token, secretKey);
      console.log('[EXTREME_DEBUG] ✅ Token verified successfully');
      console.log('[EXTREME_DEBUG] Raw token payload:', JSON.stringify(payload, null, 2));

      // Extract role and status from payload
      let userRole = String(payload.role || '').toLowerCase(); // Make role check case-insensitive
      let userStatus = String(payload.status || 'active'); // Default to active for backward compatibility
      const userId = String(payload.id || '');
      const companyCode = String(payload.companyCode || '');
      
      console.log('[EXTREME_DEBUG] 👤 Extracted user data:', {
        userId,
        userRole,
        userStatus,
        companyCode
      });

      // If token status is not active, fetch fresh status from /api/auth/check-status
      if (userStatus !== 'active') {
        console.log('[EXTREME_DEBUG] 🔄 User status is not active, fetching fresh status');
        try {
          const statusRes = await fetch(new URL('/api/auth/check-status', request.url), {
            headers: {
              Authorization: `Bearer ${token}`,
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache'
            },
            // Ensure we don't cache this fetch
            next: { revalidate: 0 }
          });
          
          console.log('[EXTREME_DEBUG] Status fetch response:', statusRes.status, statusRes.statusText);
          
          if (statusRes.ok) {
            const statusJson = await statusRes.json();
            console.log('[EXTREME_DEBUG] Status API response:', JSON.stringify(statusJson, null, 2));
            if (statusJson?.status) {
              const oldStatus = userStatus;
              userStatus = statusJson.status;
              console.log('[EXTREME_DEBUG] ✅ Updated status from', oldStatus, 'to', userStatus);
            }
          } else {
            console.warn('[EXTREME_DEBUG] ❌ Failed fresh status fetch:', statusRes.status);
          }
        } catch (err) {
          console.error('[EXTREME_DEBUG] ❌ Error fetching fresh status:', err);
        }
      }

      // Normalize role to handle inconsistent casing or formats
      const originalRole = userRole;
      if (userRole.includes('admin') || userRole.includes('superadmin')) {
        if (userRole.toLowerCase().includes('super')) {
          userRole = 'superadmin';
        } else {
          userRole = 'admin';
        }
      }
      
      console.log('[EXTREME_DEBUG] 🔄 Role normalization:', {
        originalRole,
        normalizedRole: userRole
      });
      
      // Special debug for dashboard access
      if (path.startsWith('/dashboard')) {
        console.log('[EXTREME_DEBUG] 🏠 Dashboard access attempt - Role:', userRole, 'Status:', userStatus);
      }
      
      // Debug output for admin routes
      if (path.startsWith('/dashboard/admin') || path.startsWith('/dashboard/superadmin')) {
        console.log('[EXTREME_DEBUG] 👑 Admin route access attempt:', path, '- Is user admin?', userRole === 'admin' || userRole === 'superadmin');
      }
      
      // Check if user is admin or superadmin - simplified check after normalization
      const isAdmin = userRole === 'admin' || userRole === 'superadmin';
                      
      console.log('[EXTREME_DEBUG] 👑 Admin status:', {
        isAdmin,
        userRole,
        isExactlyAdmin: userRole === 'admin',
        isExactlySuperAdmin: userRole === 'superadmin'
      });

      // Redirect non-admin users trying to access the main dashboard to employee dashboard
      if (path === '/dashboard' && !isAdmin) {
        console.log('[EXTREME_DEBUG] 🔄 Non-admin user trying to access main dashboard, redirecting to employee dashboard');
        return NextResponse.redirect(new URL('/dashboard/employeedashboard', request.url));
      }

      // Bypass control pages to prevent loops (account-inactive, subscription-required, upgrade-plan)
      const bypassPaths = ['/account-inactive', '/subscription-required', '/upgrade-plan'];
      if (bypassPaths.includes(path)) {
        console.log('[EXTREME_DEBUG] 🔄 On control page, skipping fetch and rules for:', path);
        return NextResponse.next();
      }

      // Fetch subscription and counts from your API with caching
      console.log('[EXTREME_DEBUG] 💳 Fetching subscription/count for company:', companyCode);
      const fetchStart = Date.now();
      const countUrl = new URL(`/api/users/count?companyCode=${companyCode}`, request.url);
      console.log('[EXTREME_DEBUG] 💳 Count API URL:', countUrl.toString());
      
      let subscriptionFromApi: any = null;
      let activeCount = 0;
      let planLimit = Infinity;
      let fetchError = null;
      
      try {
        const countRes = await fetch(countUrl, {
          headers: request.headers,
          next: { revalidate: 60 }
        });
        
        const fetchDuration = Date.now() - fetchStart;
        console.log('[EXTREME_DEBUG] 💳 Fetch completed in', fetchDuration, 'ms with status:', countRes.status);
        
        if (countRes.ok) {
          const data = await countRes.json();
          console.log('[EXTREME_DEBUG] 💳 Count API response:', JSON.stringify(data, null, 2));
          activeCount = data.count || 0;
          subscriptionFromApi = data.subscription;
          planLimit = subscriptionFromApi?.userLimit ?? Infinity;
          console.log('[EXTREME_DEBUG] 💳 Parsed data:', { activeCount, planLimit, hasSubscription: !!subscriptionFromApi });
        } else {
          fetchError = `HTTP ${countRes.status}`;
          console.error('[EXTREME_DEBUG] 💳 ❌ Failed to fetch count API:', countRes.status, countRes.statusText);
        }
      } catch (err) {
        fetchError = err;
        console.error('[EXTREME_DEBUG] 💳 ❌ Exception during count API fetch:', err);
      }
      
      // Derive paid status: active or canceled within current period end
      const now = Date.now();
      let paid = false;
      const subscriptionStatus = subscriptionFromApi?.status;
      const periodEnd = subscriptionFromApi?.currentPeriodEnd ? new Date(subscriptionFromApi.currentPeriodEnd).getTime() : 0;
      
      console.log('[EXTREME_DEBUG] 💳 Subscription analysis:', {
        subscriptionStatus,
        currentPeriodEnd: subscriptionFromApi?.currentPeriodEnd,
        periodEndTimestamp: periodEnd,
        nowTimestamp: now,
        isInGracePeriod: subscriptionStatus === 'canceled' && subscriptionFromApi?.cancelAtPeriodEnd && periodEnd > now,
        hasSubscriptionData: !!subscriptionFromApi
      });
      
      if (subscriptionStatus === 'active') {
        paid = true;
        console.log('[EXTREME_DEBUG] 💳 ✅ Paid: Active subscription');
      } else if (subscriptionStatus === 'canceled' && subscriptionFromApi?.cancelAtPeriodEnd && periodEnd > now) {
        paid = true;
        console.log('[EXTREME_DEBUG] 💳 ✅ Paid: Canceled but in grace period until', subscriptionFromApi.currentPeriodEnd);
      } else {
        console.log('[EXTREME_DEBUG] 💳 ❌ Not paid:', { subscriptionStatus, periodEnd, now });
      }
      
      console.log('[EXTREME_DEBUG] 💳 Final subscription state:', {
        paid,
        activeCount,
        planLimit,
        fetchError,
        isOverLimit: activeCount > planLimit
      });

      // CRITICAL DEBUG: Log all the factors that will determine redirects
      console.log('[EXTREME_DEBUG] 🚦 REDIRECT DECISION FACTORS:');
      console.log('[EXTREME_DEBUG] 🚦 - isAdmin:', isAdmin);
      console.log('[EXTREME_DEBUG] 🚦 - paid:', paid);
      console.log('[EXTREME_DEBUG] 🚦 - userStatus:', userStatus);
      console.log('[EXTREME_DEBUG] 🚦 - activeCount:', activeCount);
      console.log('[EXTREME_DEBUG] 🚦 - planLimit:', planLimit);
      console.log('[EXTREME_DEBUG] 🚦 - path:', path);
      console.log('[EXTREME_DEBUG] 🚦 - fetchError:', fetchError);

      // FIXED: Rule 1: Non-admin and unpaid users -> /account-inactive (but not during fetch errors)
      if (!isAdmin && !paid && userStatus === 'active' && !fetchError) {
        console.log('[EXTREME_DEBUG] 🚦 ❌ RULE 1: Non-admin unpaid (with working API), redirecting to /account-inactive');
        return NextResponse.redirect(new URL('/account-inactive', request.url));
      } else if (!isAdmin && !paid && fetchError) {
        console.log('[EXTREME_DEBUG] 🚦 ⚠️ RULE 1: Non-admin unpaid but API fetch failed, allowing temporary access');
      }

      // FIXED: Rule 2: Admin unpaid -> only billing, subscription, and upgrade-plan pages (but handle fetch errors gracefully)
      if (isAdmin && !paid && !fetchError) {
        console.log('[EXTREME_DEBUG] 🚦 ⚠️ RULE 2: Admin unpaid (with working API) - checking allowed pages');
        // Allow any billing page under /billing or /dashboard/billing, subscription-required, upgrade-plan, and stripe-api subscription endpoints
        const isBillingPage = path.includes('/billing');
        const isSubscriptionPage = path === '/subscription-required' || path === '/upgrade-plan';
        const isStripeSubsApi = path.startsWith('/api/stripe/subscriptions');
        const isDashboard = path === '/dashboard';
        
        console.log('[EXTREME_DEBUG] 🚦 RULE 2: Page type check:', {
          isBillingPage,
          isSubscriptionPage,
          isStripeSubsApi,
          isDashboard
        });
        
        if (isBillingPage || isSubscriptionPage || isStripeSubsApi || isDashboard) {
          console.log('[EXTREME_DEBUG] 🚦 ✅ RULE 2: Admin unpaid accessing allowed route:', path);
          return NextResponse.next();
        }
        console.log('[EXTREME_DEBUG] 🚦 ❌ RULE 2: Redirecting unpaid admin to /subscription-required');
        return NextResponse.redirect(new URL('/subscription-required', request.url));
      } else if (isAdmin && !paid && fetchError) {
        console.log('[EXTREME_DEBUG] 🚦 ⚠️ RULE 2: Admin unpaid but API fetch failed, allowing temporary access');
      }

      // Rule 3a: Non-admin users over plan limit -> /account-inactive
      if (!isAdmin && activeCount > planLimit && !fetchError) {
        console.log('[EXTREME_DEBUG] 🚦 ❌ RULE 3a: Non-admin over plan limit, redirecting to /account-inactive');
        if (path !== '/account-inactive') {
          return NextResponse.redirect(new URL('/account-inactive', request.url));
        }
      }

      // Rule 3: Paid users over plan limit -> /upgrade-plan
      if (paid && activeCount > planLimit && !fetchError) {
        console.log('[EXTREME_DEBUG] 🚦 ⚠️ RULE 3: Over plan limit, checking access');
        // Allow access to billing pages for admins even when over plan limit
        if (isAdmin && (path.startsWith('/billing') || path.startsWith('/dashboard/billing'))) {
          console.log('[EXTREME_DEBUG] 🚦 ✅ RULE 3: Allowing admin access to billing while over limit');
          return NextResponse.next();
        }
        // Redirect non-admins or non-billing pages to upgrade plan
        if (!path.startsWith('/billing') && path !== '/upgrade-plan') {
          console.log('[EXTREME_DEBUG] 🚦 ❌ RULE 3: Redirecting to /upgrade-plan');
          return NextResponse.redirect(new URL('/upgrade-plan', request.url));
        }
      }

      // Admin override: only active admins can access directly
      if (isAdmin) {
        console.log('[EXTREME_DEBUG] 👑 ADMIN OVERRIDE: Checking admin status');
        if (userStatus !== 'active') {
          console.log('[EXTREME_DEBUG] 👑 ❌ Admin with status', userStatus, 'redirected to pending-approval');
          return NextResponse.redirect(new URL('/pending-approval', request.url));
        }
        console.log('[EXTREME_DEBUG] 👑 ✅ Active admin access granted for path:', path);
        // For API requests, attach headers
        if (path.startsWith('/api/')) {
          const requestHeaders = new Headers(request.headers);
          requestHeaders.set('x-user-role', userRole);
          requestHeaders.set('x-user-status', userStatus);
          if (companyCode) {
            requestHeaders.set('x-company-code', companyCode);
          }
          console.log('[EXTREME_DEBUG] 👑 ✅ Adding headers for API request');
          return NextResponse.next({ request: { headers: requestHeaders } });
        }
        return NextResponse.next();
      }
      
      // ========== STATUS-BASED ACCESS CONTROL ==========
      // For non-admin users, enforce strict status restrictions
      console.log('[EXTREME_DEBUG] 👤 NON-ADMIN STATUS CHECK: userStatus =', userStatus);
      
      // Handle rejected users - only allow access to /rejected-account and logout
      if (userStatus === 'rejected') {
        console.log('[EXTREME_DEBUG] 👤 REJECTED USER: Checking allowed paths');
        // If trying to access a page that's not allowed for rejected users, redirect
        if (!isAllowedForStatus(path, 'rejected')) {
          console.log('[EXTREME_DEBUG] 👤 ❌ Rejected user redirected from', path);
          return NextResponse.redirect(new URL('/rejected-account', request.url));
        }
      }
      
      // Handle pending users - only allow access to /pending-approval and logout
      if (userStatus === 'pending') {
        console.log('[EXTREME_DEBUG] 👤 PENDING USER: Checking allowed paths');
        if (isAllowedForStatus(path, 'pending')) {
          console.log('[EXTREME_DEBUG] 👤 ✅ Pending user access granted for pending-approval page:', path);
          return NextResponse.next();
        } else {
          console.log('[EXTREME_DEBUG] 👤 ❌ Pending user redirected from', path, 'to pending-approval');
          return NextResponse.redirect(new URL('/pending-approval', request.url));
        }
      }
      
      // Handle inactive users - only allow access to /inactive-account and logout
      if (userStatus === 'inactive') {
        console.log('[EXTREME_DEBUG] 👤 INACTIVE USER: Checking allowed paths');
        // If trying to access a page that's not allowed for inactive users, redirect
        if (!isAllowedForStatus(path, 'inactive')) {
          console.log('[EXTREME_DEBUG] 👤 ❌ Inactive user redirected from', path);
          return NextResponse.redirect(new URL('/inactive-account', request.url));
        }
      }
      
      // Only active users should be able to access protected resources past this point
      if (userStatus !== 'active') {
        console.log('[EXTREME_DEBUG] 👤 ❌ NON-ACTIVE USER attempted to access', path, 'with status', userStatus);
        
        // Redirect to appropriate status page based on user status
        if (userStatus === 'pending') {
          return NextResponse.redirect(new URL('/pending-approval', request.url));
        } else if (userStatus === 'inactive') {
          return NextResponse.redirect(new URL('/inactive-account', request.url));
        } else if (userStatus === 'rejected') {
          return NextResponse.redirect(new URL('/rejected-account', request.url));
        } else {
          // Default fallback for any other status
          console.log('[EXTREME_DEBUG] 👤 ❌ Unknown status, redirecting to login');
          return NextResponse.redirect(new URL('/login', request.url));
        }
      }
      
      // Require companyCode for API access (except for admins, which we already handled)
      if (!companyCode && path.startsWith('/api/')) {
        console.log('[EXTREME_DEBUG] 🏢 ❌ No company code for API access');
        return NextResponse.json(
          { error: 'No company code found in token' },
          { status: 403 }
        );
      }

      // Restrict access to admin routes for non-admin users
      if ((path.startsWith('/dashboard/admin/') || path.startsWith('/dashboard/superadmin/'))) {
        console.log('[EXTREME_DEBUG] 👤 ❌ Non-admin attempting to access admin route, redirecting');
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }

      // For API requests, add company info to headers for database selection
      if (path.startsWith('/api/')) {
        console.log('[EXTREME_DEBUG] 🔌 Adding headers for API request');
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-company-code', companyCode || '');
        requestHeaders.set('x-user-role', userRole);
        requestHeaders.set('x-user-status', userStatus);
        
        return NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
      }

      // Only active users can proceed past this point
      if (userStatus === 'active') {
        console.log('[EXTREME_DEBUG] 👤 ✅ Access granted to active user');
        return NextResponse.next();
      } else {
        // If we somehow got here with a non-active status, redirect to login
        console.log('[EXTREME_DEBUG] 👤 ❌ Non-active user caught by final check, redirecting to login');
        return NextResponse.redirect(new URL('/login', request.url));
      }
      
    } catch (err) {
      console.error('[EXTREME_DEBUG] ❌ Token verification failed in middleware:', err);
      console.error('[EXTREME_DEBUG] ❌ Token that failed:', token.substring(0, 50) + '...');
      return NextResponse.redirect(new URL('/login', request.url));
    }
  } catch (error) {
    console.error('[EXTREME_DEBUG] ❌ Auth middleware error:', error);
    // Redirect to login if token verification fails
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// Explicitly configure matcher to run on all routes except Next.js static files
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ],
};
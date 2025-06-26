import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAuth } from './lib/edgeAuth'
import User from './models/User'
import connectToMongoDB from './lib/dbConnect'

// Middleware must be async in Edge Runtime
export async function middleware(request: NextRequest) {
  // Debug logging
  console.log('MIDDLEWARE: Processing request', request.url);
  
  // Get all cookies
  const cookies = request.cookies.getAll();
  const tokenCookie = request.cookies.get('token');
  console.log('MIDDLEWARE: Cookies:', cookies.length, 'Token cookie exists:', !!tokenCookie);
  
  // Get all headers
  const authHeader = request.headers.get('authorization');
  console.log('MIDDLEWARE: Auth header exists:', !!authHeader);

  // Get the path
  const path = request.nextUrl.pathname
  
  // Skip for API routes and public pages
  if (
    path.startsWith('/api/auth/') ||
    path.startsWith('/api/stripe/prices') ||
    path.startsWith('/api/stripe/create-payment-intent') ||
    path.startsWith('/api/stripe/webhook') ||
    path === '/login' ||
    path === '/signup' ||
    path === '/company-signup' ||
    path === '/payment-success' ||
    path === '/terms' ||
    path === '/privacy' ||
    path === '/' ||
    path.includes('.') ||
    path === '/api/auth/request-password-reset' ||
    path === '/api/auth/resend-verification'
  ) {
    return NextResponse.next()
  }

  // Check for token in both headers and cookies for security
  const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.split(' ')[1]
  const cookieRole = request.cookies.get('userRole')?.value
  
  // If no token is found, redirect to login
  if (!token) {
    console.log(`No token found, redirecting from ${path} to login page`)
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    // Use async verifyAuth instead of synchronous verifyToken
    const decodedToken = await verifyAuth(token)
    
    if (!decodedToken) {
      console.log(`Invalid token, redirecting from ${path} to login page`)
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // CRITICAL: Double-check role against cookie for additional security
    // This prevents token tampering since cookies are http-only
    if (cookieRole && decodedToken.role && cookieRole !== decodedToken.role) {
      console.log(`Role mismatch: Token role=${decodedToken.role}, Cookie role=${cookieRole}`)
      return NextResponse.redirect(new URL('/login?error=invalid_session', request.url))
    }

    console.log(`Access check: User role=${decodedToken.role}, Path=${path}`)

    // Block users whose status is not 'active' - ALWAYS CHECK DB FOR STATUS
    try {
      // Force DB check for user status regardless of token
      await connectToMongoDB(process.env.MONGODB_URI as string);
      
      // Get company code from token for company-specific DB lookup
      const companyCode = decodedToken.companyCode;
      let currentUser;
      
      if (companyCode) {
        console.log(`Using company database for ${companyCode} to check user status`);
        // Connect to company-specific database
        const mongoose = require('mongoose');
        const dbName = `company_${companyCode}`;
        const conn = mongoose.createConnection(`${process.env.MONGODB_URI}/${dbName}`);
        const CompanyUserSchema = new mongoose.Schema({
          status: String
        });
        const CompanyUserModel = conn.model('users', CompanyUserSchema);
        currentUser = await CompanyUserModel.findById(decodedToken.id).select('status');
        await conn.close();
      } else {
        // Use default User model which should connect to right database
        console.log(`Using default database to check user status for ${decodedToken.id}`);
        currentUser = await User.findById(decodedToken.id).select('status');
      }
      
      // Get the actual status from DB, not from token
      const dbStatus = currentUser?.status;
      console.log(`DB Status for user ${decodedToken.id}: ${dbStatus}, Token status: ${decodedToken.status}`);

      // Redirect based on user status
      if (dbStatus === 'pending' && path !== '/pending-approval') {
        console.log(`Redirecting to pending-approval: status is ${dbStatus}`);
        return NextResponse.redirect(new URL('/pending-approval', request.url));
      }
      if (dbStatus === 'rejected' && path !== '/rejected-account') {
        console.log(`Redirecting to rejected-account: status is ${dbStatus}`);
        return NextResponse.redirect(new URL('/rejected-account', request.url));
      }
      if (dbStatus === 'inactive' && path !== '/inactive-account') {
        console.log(`Redirecting to inactive-account: status is ${dbStatus}`);
        return NextResponse.redirect(new URL('/inactive-account', request.url));
      }
      if (dbStatus === 'active' && path === '/pending-approval') {
        console.log(`User is active, redirecting to dashboard from pending-approval`);
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch (statusError) {
      console.error('Error checking user status in middleware:', statusError);
      // Clear any stored tokens and redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('token');
      return response;
    }

    // Check permissions for admin routes - STRICT path checking
    if (path.startsWith('/dashboard/admin') && decodedToken.role !== 'admin' && decodedToken.role !== 'superadmin') {
      console.log(`Blocked unauthorized access to ${path} by user with role ${decodedToken.role}`)
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Check permissions for superadmin routes - STRICT path checking
    if (path.startsWith('/dashboard/superadmin') && decodedToken.role !== 'superadmin') {
      // Re-validate role against the database for superadmin access
      try {
        await connectToMongoDB(process.env.MONGODB_URI as string);
        const currentUser = await User.findById(decodedToken.id).select('role');
        if (!currentUser || currentUser.role !== 'superadmin') {
          console.log(`Blocked unauthorized access to ${path}. Token role: ${decodedToken.role}, DB role: ${currentUser?.role}`);
          return NextResponse.redirect(new URL('/dashboard', request.url));
        } else {
          // DB role IS superadmin, allow access despite stale token role
          console.log(`Allowing superadmin access to ${path} based on DB role, despite token role ${decodedToken.role}`);
        }
      } catch (dbError) {
        console.error(`Database error during superadmin role check in middleware for user ${decodedToken.id}:`, dbError);
        // Fail safe: redirect if DB check fails
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

// Define which routes this middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
} 
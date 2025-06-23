# Authentication System Documentation

## Overview

This project has a robust authentication system that provides:
- JWT-based authentication
- Role-based access control
- Multi-factor authentication capability
- Password hashing and verification
- Session management

## Recent Changes

### 1. Fixed Duplicate POST Handler Issue

We've reorganized the notification API routes to prevent route handler conflicts. Specifically:

- Main notification endpoint (`/api/notifications/route.ts`):
  - `GET`: Fetch user notifications
  - `POST`: Create a new notification
  - `PATCH`: Mark notification as read
  - `DELETE`: Delete notification

- Created dedicated endpoints for bulk operations:
  - `/api/notifications/mark-all-read/route.ts`: Dedicated endpoint for marking all notifications as read
  - `/api/notifications/bulk/route.ts`: Endpoint for bulk operations (mark multiple as read, delete multiple)

This separation prevents duplicate HTTP method handlers in the same route file, which caused the error: "the name 'POST' is defined multiple times".

### 2. Authentication System Organization

The project originally had authentication logic split across multiple files:
- `src/lib/auth.ts`: NextAuth configuration and some utility functions
- `src/utils/auth.ts`: JWT verification functions
- `src/services/authService.ts`: Password hashing and other auth utilities

For better organization, consider consolidating these into a single comprehensive auth service that would:
1. Handle all JWT operations
2. Manage password hashing/verification
3. Provide role-based access control
4. Handle session management

## Environment Variables

The authentication system relies on several environment variables that should be set in your `.env.local` file:

```
JWT_SECRET=your-secure-jwt-secret-key
JWT_EXPIRES_IN=1d
NEXTAUTH_SECRET=your-nextauth-secret-key
NEXTAUTH_URL=http://localhost:3000
```

## Security Considerations

For production deployment:
1. Use strong, unique secrets for JWT and NextAuth
2. Set appropriate token expiration times
3. Implement proper CORS policies
4. Consider rate limiting on auth endpoints
5. Set secure and httpOnly flags on cookies
6. Monitor for unusual authentication patterns

## Authentication Flow

1. User provides credentials (username/password)
2. Server validates credentials and creates a JWT token
3. For admin access, additional checks verify the user's role
4. Optional MFA verification for sensitive operations
5. JWT token is used for subsequent API requests
6. Token verification on protected routes 
/** @type {import('next').NextConfig} */
const webpack = require('webpack');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = require('dotenv').config({ path: envPath });
  if (envConfig.error) {
    console.error('Error loading .env.local:', envConfig.error);
  } else {
    console.log('Successfully loaded .env.local');
  }
} else {
  console.warn('.env.local not found, using environment variables from the system');
}

// Ensure required environment variables are set
const requiredEnvVars = ['STRIPE_SECRET_KEY', 'MONGODB_URI'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

// Check if we're running in a Docker container
const isDocker = process.env.RUNNING_IN_DOCKER === 'true';

// Log environment variables being used (without sensitive values)
console.log('Environment variables loaded for build:');
console.log(`- MONGODB_URI: ${process.env.MONGODB_URI ? 'Set' : 'Not set'}`);
console.log(`- MONGODB_URI_BASE: ${process.env.MONGODB_URI_BASE ? 'Set' : 'Not set'}`);
console.log(`- NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL || 'Not set'}`);

// Validate required environment variables
if (!process.env.MONGODB_URI && !process.env.MONGODB_URI_BASE) {
  console.warn('Warning: Neither MONGODB_URI nor MONGODB_URI_BASE is set. Database connections will fail.');
}

const nextConfig = {
  // Configure environment variables
  env: {
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_URI_BASE: process.env.MONGODB_URI_BASE,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  
  // Disable ESLint during builds entirely
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript type checking during builds
  typescript: {
    ignoreBuildErrors: true,
    // @ts-ignore - Force ignore all TypeScript errors
    ignoreBuildErrors: true,
  },
  
  // Disable React Strict Mode to prevent double rendering in development
  reactStrictMode: false,
  
  // Additional webpack configuration to ignore specific errors
  webpack: (config, { isServer }) => {
    // Ignore specific webpack warnings/errors
    config.ignoreWarnings = [
      // Ignore specific module warnings
      /Failed to parse source map/,
      // Add other warnings to ignore here
    ];
    
    // Return the modified config
    return config;
  },
  
  // Enable React strict mode
  reactStrictMode: true,
  
  // Enable production optimizations in production
  productionBrowserSourceMaps: false,
  
  // Configure output for standalone build
  output: 'standalone',
  
  // Configure base path if needed (e.g., if using a subdirectory)
  // basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  
  // Configure images
  images: {
    domains: ['lh3.googleusercontent.com', 'randomuser.me'],
    unoptimized: process.env.NODE_ENV === 'production', // Disable Image Optimization API in production
  },
  
  // Environment variables
  env: {
    // Make sure these environment variables are available to the client-side
    MONGODB_URI: process.env.MONGODB_URI,
    // Don't hardcode any database names - each company has its own database
    ATLAS_SEARCH_INDEX: process.env.ATLAS_SEARCH_INDEX || '',
  },
  
  // Use SWC minification (default in Next.js 15+)
  swcMinify: true,
  
  // Enable server components
  experimental: {
    serverComponentsExternalPackages: ['mongoose'],
    serverActions: true,
  },
  
  // Configure output file tracing
  outputFileTracingRoot: path.join(__dirname, '../../'),
  
  // Configure webpack
  webpack: (config, { isServer }) => {
    // Fixes npm packages that depend on `buffer` module
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: require.resolve('buffer/'),
        process: require.resolve('process/browser'),
        util: require.resolve('util/'),
        dns: false,
        net: false,
        tls: false,
        fs: false,
        path: false,
        os: false,
        child_process: false,
        stream: require.resolve('stream-browserify'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        zlib: require.resolve('browserify-zlib'),
        crypto: require.resolve('crypto-browserify'),
      };
      
      // Add polyfills explicitly
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        })
      );
    }
    
    return config;
  },
  
  // Configure security headers
  async headers() {
    const securityHeaders = [
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on',
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block',
      },
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'origin-when-cross-origin',
      },
    ];

    // Apply these headers to all routes
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Additional headers for API routes
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          {
            key: 'Access-Control-Allow-Headers',
            value:
              'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
        ],
      },
    ];
  },
  
  // Configure logging for production
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  
  // Use rewrites to handle both API and page paths
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
      {
        source: '/:path*',
        destination: `/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
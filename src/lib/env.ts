// Utility to safely access environment variables with type safety

interface EnvVars {
  MONGODB_URI: string;
  MONGODB_URI_BASE: string;
  NEXT_PUBLIC_APP_URL: string;
  JWT_SECRET: string;
  // Add other environment variables as needed
}

// This function ensures we get type checking for our environment variables
export function getEnvVar<T extends keyof EnvVars>(key: T): EnvVars[T] {
  const value = process.env[key];
  
  if (value === undefined) {
    // In development, we want to fail fast if required env vars are missing
    if (process.env.NODE_ENV === 'development') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    
    // In production, we'll use empty strings as fallbacks
    console.warn(`Warning: Environment variable ${key} is not set`);
    return '' as EnvVars[T];
  }
  
  return value as EnvVars[T];
}

// Predefined getters for commonly used environment variables
export const env = {
  get mongodbUri() {
    return getEnvVar('MONGODB_URI');
  },
  get mongodbUriBase() {
    return getEnvVar('MONGODB_URI_BASE') || this.mongodbUri;
  },
  get appUrl() {
    return getEnvVar('NEXT_PUBLIC_APP_URL');
  },
  get jwtSecret() {
    return getEnvVar('JWT_SECRET');
  }
};

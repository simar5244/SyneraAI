import Redis from 'ioredis';

// In-memory storage for development when Redis is not available
const memoryStore: Record<string, string> = {};

// Mock Redis implementation for when Redis is not available
class MockRedis {
  async get(key: string): Promise<string | null> {
    console.log(`[MockRedis] Getting value for key: ${key}`);
    return memoryStore[key] || null;
  }

  async set(key: string, value: string, expiryMode?: string, time?: number): Promise<'OK'> {
    console.log(`[MockRedis] Setting key: ${key}, value: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
    memoryStore[key] = value;
    
    // Handle expiry if provided
    if (expiryMode === 'EX' && time) {
      setTimeout(() => {
        delete memoryStore[key];
      }, time * 1000);
    }
    
    return 'OK';
  }

  async del(key: string): Promise<number> {
    console.log(`[MockRedis] Deleting key: ${key}`);
    if (key in memoryStore) {
      delete memoryStore[key];
      return 1;
    }
    return 0;
  }
}

// Check if we should use Redis or MockRedis
const shouldUseRealRedis = () => {
  // If explicitly set to use mock, return false
  if (process.env.USE_MOCK_REDIS === 'true') {
    return false;
  }
  
  // In development, make an educated guess based on environment
  if (process.env.NODE_ENV === 'development') {
    // If REDIS_URL is not set, use mock
    if (!process.env.REDIS_URL) {
      return false;
    }
  }
  
  return true;
};

// Initialize Redis client or use MockRedis as fallback
let redis: Redis | MockRedis;

// Use a flag to avoid repeated connection attempts
let hasAttemptedRedisConnection = false;

if (shouldUseRealRedis() && !hasAttemptedRedisConnection) {
  try {
    hasAttemptedRedisConnection = true;
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    console.log(`Attempting to connect to Redis at: ${redisUrl}`);
    
    redis = new Redis(redisUrl, {
      connectTimeout: 5000, // 5 seconds
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 1) {
          console.error(`Max Redis connection attempts reached (${times}), using in-memory storage`);
          return null; // Stop retrying
        }
        return 1000; // Try once more after 1 second
      }
    });
    
    // Test connection
    redis.on('connect', () => {
      console.log('Successfully connected to Redis');
    });
    
    redis.on('error', (err) => {
      console.error('Redis connection error:', err);
      console.warn('Falling back to in-memory storage');
      redis = new MockRedis();
    });
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
    console.warn('Using in-memory storage fallback');
    redis = new MockRedis();
  }
} else {
  console.log('Using in-memory storage (MockRedis)');
  redis = new MockRedis();
}

export default redis; 
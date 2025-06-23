import { createClient } from 'redis';

class MockRedisClient {
  private store: Map<string, string> = new Map();

  async connect(): Promise<void> {
    console.log('Using mock Redis client');
    return Promise.resolve();
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: string, options?: { EX?: number }): Promise<void> {
    this.store.set(key, value);
    return Promise.resolve();
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    this.store.clear();
    return Promise.resolve();
  }
}

// Singleton pattern for Redis client
export class Redis {
  private static instance: any;
  
  static getInstance() {
    if (!Redis.instance) {
      // Use environment variable to determine whether to use real Redis or mock
      const USE_MOCK_REDIS = process.env.USE_MOCK_REDIS === 'true' || !process.env.REDIS_URL;
      
      // Create real Redis client or mock based on environment
      if (USE_MOCK_REDIS) {
        Redis.instance = new MockRedisClient();
      } else {
        Redis.instance = createClient({
          url: process.env.REDIS_URL
        });
      }
      
      // Connect to Redis in a non-blocking way
      (async () => {
        try {
          await Redis.instance.connect();
        } catch (error) {
          console.error('Redis connection error:', error);
        }
      })();
    }
    return Redis.instance;
  }
}

// Create the client for direct export
const redisClient = Redis.getInstance();

export default redisClient; 
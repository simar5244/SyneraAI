import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Redis } from '@/lib/redis';

// In-memory storage fallback reference
import { mockNotifications } from '../route';

// Clear all notifications for a user
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    
    // Try to clear notifications from Redis
    const redis = Redis.getInstance();
    let success = false;
    
    try {
      const notificationsKey = `notifications:${userId}`;
      
      // Set to empty array (we don't want to delete the key entirely)
      await redis.set(notificationsKey, JSON.stringify([]));
      success = true;
    } catch (error) {
      console.error('Redis error:', error);
      console.log('Using in-memory storage (MockRedis)');
      
      // Fall back to in-memory storage by filtering out this user's notifications
      const initialLength = mockNotifications.length;
      const filtered = mockNotifications.filter(n => n.userId !== userId);
      mockNotifications.length = 0;
      mockNotifications.push(...filtered);
      
      success = initialLength !== mockNotifications.length;
    }

    return NextResponse.json({ success });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/utils/auth';
import redis from '@/utils/redis';
import { Notification } from '../route';

// Type definitions for notifications
type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  muted?: boolean;
  link?: string;
  entityId?: string;
  entityType?: 'project' | 'employee' | 'department' | 'task';
  actionable?: boolean;
  source?: 'system' | 'user' | 'api';
}

// Function to get notifications for a user
async function getUserNotifications(userId: string): Promise<Notification[]> {
  try {
    const redisKey = `notifications:${userId}`;
    const storedNotifications = await redis.get(redisKey);
    
    if (!storedNotifications) {
      return [];
    }
    
    return JSON.parse(storedNotifications);
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
}

// Function to store notifications for a user
async function storeUserNotifications(userId: string, notifications: Notification[]): Promise<void> {
  try {
    const redisKey = `notifications:${userId}`;
    await redis.set(redisKey, JSON.stringify(notifications));
  } catch (error) {
    console.error('Error storing notifications:', error);
  }
}

// Mark all notifications as read
export async function PUT(req: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await verifyToken(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get notifications from Redis
    const redisKey = `notifications:${user.id}`;
    const storedNotifications = await redis.get(redisKey);
    
    if (!storedNotifications) {
      return NextResponse.json({ message: 'No notifications to mark as read' });
    }
    
    // Parse notifications
    const notifications: Notification[] = JSON.parse(storedNotifications);
    
    // Mark all as read
    const updatedNotifications = notifications.map(notification => ({
      ...notification,
      read: true
    }));
    
    // Save updated notifications
    await redis.set(redisKey, JSON.stringify(updatedNotifications));
    
    return NextResponse.json({ 
      message: 'All notifications marked as read',
      count: notifications.length
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' }, 
      { status: 500 }
    );
  }
} 
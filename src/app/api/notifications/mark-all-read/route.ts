import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Notification from '@/models/Notification';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth';

// POST /api/notifications/mark-all-read - Mark all notifications as read
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Verify authentication
    const token = await getToken({ req: request, secret: authOptions.secret });
    if (!token || !token.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update all unread notifications for this user
    const result = await Notification.updateMany(
      { userId: token.sub, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    
    return NextResponse.json({
      message: 'All notifications marked as read',
      count: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' },
      { status: 500 }
    );
  }
} 
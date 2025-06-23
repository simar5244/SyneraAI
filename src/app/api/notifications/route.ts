import { NextRequest, NextResponse } from 'next/server';

// Define the notification type
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
  userId: string;
}

// Mock notifications for development/testing
const mockNotifications: Notification[] = [
  {
    id: '1',
    userId: 'user123',
    title: 'New Project Created',
    message: 'Mobile App Redesign project has been created and assigned to your team.',
    type: 'project',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    link: '/dashboard/projects/1'
  },
  {
    id: '2',
    userId: 'user123',
    title: 'New Team Member',
    message: 'Sarah Johnson has joined the Engineering department.',
    type: 'employee',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    link: '/dashboard/employees/E001'
  },
  {
    id: '3',
    userId: 'user123',
    title: 'Project Update',
    message: 'Customer Dashboard is now 75% complete. 3 tasks remaining.',
    type: 'project',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    link: '/dashboard/projects/2'
  },
  {
    id: '4',
    userId: 'user123',
    title: 'Warning: Overutilized Resources',
    message: '3 employees have been working more than 45 hours per week.',
    type: 'warning',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    link: '/dashboard'
  }
];

// GET /api/notifications - Get user notifications
export async function GET(request: NextRequest) {
  try {
    // In a real app, we would verify user authentication
    // For now, just return mock notifications
    return NextResponse.json({
      notifications: mockNotifications,
      pagination: {
        total: mockNotifications.length,
        page: 1,
        limit: 10,
        pages: 1
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// For other endpoints (POST, PATCH, DELETE) we can implement them similarly
// For now, just stub them to return success responses
export async function POST(request: NextRequest) {
  return NextResponse.json({ success: true, message: 'Notification created' }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  return NextResponse.json({ success: true, message: 'Notification updated' });
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json({ success: true, message: 'Notification deleted' });
} 
'use client';

import axios from 'axios';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import Notification, { INotification } from '@/models/Notification';
import User, { IUser } from '@/models/User';
import { sendEmail } from '@/utils/email';

// Define notification types
export type NotificationType = 'system' | 'project' | 'mention' | 'task';

export interface NotificationPreferences {
  email: boolean;
  browser: boolean;
  types: {
    system: boolean;
    project: boolean;
    mention: boolean;
    task: boolean;
  };
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: Date;
}

class NotificationService {
  private transporter: nodemailer.Transporter | null = null;
  private apiUrl = '/api/notifications';
  
  constructor() {
    // Initialize email transporter if running on server
    if (typeof window === 'undefined') {
      this.initEmailTransporter();
    }
  }
  
  private initEmailTransporter() {
    try {
      // In production, you would use real SMTP settings
      const host = process.env.SMTP_HOST || 'smtp.example.com';
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const user = process.env.SMTP_USER || 'user@example.com';
      const pass = process.env.SMTP_PASS || 'password';
      
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });
      
      // For development, you might use a service like Ethereal or Mailtrap
      if (process.env.NODE_ENV === 'development') {
        console.log('Email transporter configured for development');
      }
    } catch (error) {
      console.error('Failed to initialize email transporter:', error);
      this.transporter = null;
    }
  }
  
  // Send email notification
  async sendEmailNotification(to: string, subject: string, text: string, html?: string) {
    if (!this.transporter) {
      if (typeof window === 'undefined') {
        // Only try to reinitialize if we're on the server
        this.initEmailTransporter();
        if (!this.transporter) {
          throw new Error('Email transporter not initialized');
        }
      } else {
        throw new Error('Email notifications can only be sent from the server');
      }
    }
    
    try {
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || '"Organization App" <noreply@example.com>',
        to,
        subject,
        text,
        html: html || text,
      });
      
      console.log('Email sent:', info.messageId);
      return info;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }
  
  // Send browser notification
  async sendBrowserNotification(title: string, options: NotificationOptions = {}) {
    if (typeof window === 'undefined') {
      throw new Error('Browser notifications can only be sent from the client');
    }
    
    try {
      // Check if browser notifications are supported
      if (!('Notification' in window)) {
        console.warn('This browser does not support desktop notifications');
        return false;
      }
      
      // Check if permission is already granted
      if (Notification.permission === 'granted') {
        const notification = new Notification(title, options);
        return notification;
      }
      
      // Otherwise, request permission
      if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
          const notification = new Notification(title, options);
          return notification;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Failed to send browser notification:', error);
      return false;
    }
  }
  
  // Get all notifications for a user
  async getUserNotifications(userId: string): Promise<Notification[]> {
    try {
      const response = await fetch(`/api/notifications?userId=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      
      const data = await response.json();
      return data.notifications.map((notif: any) => ({
        id: notif._id,
        userId: notif.userId,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        isRead: notif.isRead,
        link: notif.link,
        createdAt: new Date(notif.createdAt)
      }));
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }
  
  // Mark a notification as read
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isRead: true }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
      
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }
  
  // Delete a notification
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }
  
  // Create a new notification
  async createNotification(
    userId: string | mongoose.Types.ObjectId,
    data: {
      title: string;
      message: string;
      type?: 'info' | 'success' | 'warning' | 'error' | 'system' | 'other';
      entityId?: string;
      entityType?: string;
      actionable?: boolean;
      actionUrl?: string;
      source?: string;
    },
    options: {
      sendEmail?: boolean;
      emailTemplate?: string;
    } = {}
  ): Promise<INotification> {
    // Create notification in database
    const notification = await Notification.create({
      userId: typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId,
      ...data,
      isRead: false,
    });

    // Get user notification preferences if sending email
    if (options.sendEmail) {
      try {
        const user = await User.findById(userId);
        
        if (user && user.notificationPreferences?.email) {
          // Check if user has enabled this notification type
          const notificationType = data.type || 'info';
          if (user.notificationPreferences[notificationType]) {
            await this.sendEmailNotification(user.email, notification.title, notification.message, `<div>
              <h2>${notification.title}</h2>
              <p>${notification.message}</p>
              ${notification.actionUrl ? `<p><a href="${notification.actionUrl}">View Details</a></p>` : ''}
            </div>`);
          }
        }
      } catch (error) {
        console.error('Failed to send email notification:', error);
        // Continue without failing the whole operation
      }
    }

    return notification;
  }
  
  // Update user notification preferences
  async updatePreferences(userId: string, preferences: any): Promise<boolean> {
    try {
      const response = await fetch(`/api/users/${userId}/notification-preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update notification preferences');
      }
      
      return true;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return false;
    }
  }
  
  // Get user's notification preferences
  async getPreferences(userId: string): Promise<any> {
    try {
      const response = await fetch(`/api/users/${userId}/notification-preferences`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch notification preferences');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      return null;
    }
  }
  
  // Request permission for browser notifications
  async requestBrowserPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('This browser does not support desktop notifications');
      return false;
    }
    
    if (Notification.permission === 'granted') {
      return true;
    }
    
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    
    return false;
  }
  
  // Show a browser notification
  showBrowserNotification(title: string, options?: NotificationOptions): void {
    if (Notification.permission === 'granted') {
      new Notification(title, options);
    }
  }
  
  // Check user preferences and send notifications accordingly
  async notifyUser(
    userId: string,
    userEmail: string,
    preferences: NotificationPreferences,
    notificationType: NotificationType,
    title: string,
    message: string,
    link?: string
  ) {
    // First check if the user wants this type of notification
    if (!preferences.types[notificationType]) {
      return false;
    }
    
    // Create the notification record
    await this.createNotification(userId, {
      title,
      message,
      type: notificationType,
      link,
    });
    
    // Send email if enabled
    if (preferences.email) {
      try {
        // Only attempt to send if we're on the server
        if (typeof window === 'undefined') {
          await this.sendEmailNotification(
            userEmail,
            title,
            message,
            `<div>
              <h2>${title}</h2>
              <p>${message}</p>
              ${link ? `<p><a href="${link}">View Details</a></p>` : ''}
            </div>`
          );
        }
      } catch (error) {
        console.error('Failed to send email notification:', error);
      }
    }
    
    // Send browser notification if enabled
    if (preferences.browser) {
      try {
        // Only attempt to send if we're on the client
        if (typeof window !== 'undefined') {
          await this.sendBrowserNotification(title, {
            body: message,
            icon: '/logo.png',
            data: { url: link },
          });
        }
      } catch (error) {
        console.error('Failed to send browser notification:', error);
      }
    }
    
    return true;
  }

  // Get notifications for a user
  async getUserNotifications(
    userId: string | mongoose.Types.ObjectId,
    options: {
      limit?: number;
      offset?: number;
      isRead?: boolean;
      type?: string;
      sort?: Record<string, 1 | -1>;
    } = {}
  ): Promise<{ notifications: INotification[]; total: number }> {
    const { 
      limit = 10, 
      offset = 0, 
      isRead, 
      type,
      sort = { createdAt: -1 } 
    } = options;
    
    const query: any = { 
      userId: typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId 
    };
    
    if (typeof isRead === 'boolean') {
      query.isRead = isRead;
    }
    
    if (type) {
      query.type = type;
    }
    
    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort(sort)
        .skip(offset)
        .limit(limit),
      Notification.countDocuments(query)
    ]);
    
    return { notifications, total };
  }

  // Get a single notification by ID
  async getNotification(id: string, userId?: string): Promise<INotification | null> {
    const query: any = { _id: id };
    
    if (userId) {
      query.userId = userId;
    }
    
    return Notification.findOne(query);
  }

  // Mark notifications as read
  async markAsRead(
    notificationIds: string | string[],
    userId: string | mongoose.Types.ObjectId
  ): Promise<number> {
    const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
    
    const result = await Notification.updateMany(
      { 
        _id: { $in: ids }, 
        userId: typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId 
      },
      { 
        $set: { 
          isRead: true,
          readAt: new Date()
        } 
      }
    );
    
    return result.modifiedCount;
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string | mongoose.Types.ObjectId): Promise<number> {
    const result = await Notification.updateMany(
      { 
        userId: typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId,
        isRead: false
      },
      { 
        $set: { 
          isRead: true,
          readAt: new Date()
        } 
      }
    );
    
    return result.modifiedCount;
  }

  // Delete notifications
  async deleteNotifications(
    notificationIds: string | string[],
    userId: string | mongoose.Types.ObjectId
  ): Promise<number> {
    const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
    
    const result = await Notification.deleteMany({
      _id: { $in: ids },
      userId: typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId
    });
    
    return result.deletedCount || 0;
  }

  // Send browser notification
  async sendBrowserNotification(notification: INotification): Promise<void> {
    // This would integrate with a WebSocket or SSE implementation
    // Implementation depends on the realtime notification system
    // For now, this is a placeholder
    console.log('Browser notification would be sent:', notification);
  }

  // Send email notification
  private async sendEmailNotification(
    user: IUser,
    notification: INotification,
    template?: string
  ): Promise<void> {
    // Default email template if none provided
    const emailTemplate = template || 'notification';
    
    await sendEmail({
      to: user.email,
      subject: notification.title,
      template: emailTemplate,
      context: {
        firstName: user.firstName || user.username,
        notificationTitle: notification.title,
        notificationMessage: notification.message,
        notificationType: notification.type,
        actionUrl: notification.actionUrl || process.env.NEXT_PUBLIC_APP_URL,
        appName: process.env.APP_NAME || 'Your Application',
      }
    });
  }
}

// Create a singleton instance
const notificationService = new NotificationService();

export default notificationService; 
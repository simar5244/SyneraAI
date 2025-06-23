import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import User from '@/models/User';

// API route to seed admin and superadmin users
export async function GET(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Connect to MongoDB if not already
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI!, { dbName: 'org_sim_db' });
    }

    const usersToSeed = [
      { username: 'admin', email: 'admin@example.com', password: 'AdminPass123', role: 'admin', emailVerified: true },
      { username: 'superadmin', email: 'superadmin@example.com', password: 'SuperPass123', role: 'superadmin', emailVerified: true }
    ];

    const result: { seeded: string[]; existed: string[] } = { seeded: [], existed: [] };

    for (const u of usersToSeed) {
      const existing = await User.findOne({ email: u.email });
      if (existing) {
        result.existed.push(u.email);
        continue;
      }
      const newUser = new User(u as any);
      await newUser.save();
      result.seeded.push(u.email);
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Seed error:', err);
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/dbConnect';
import User from '@/models/User';
import mongoose from 'mongoose';

// GET /api/users/search?term=...
export async function GET(request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectToMongoDB();
    
    // Get search term from query parameters
    const searchParams = request.nextUrl.searchParams;
    const term = searchParams.get('term');
    
    if (!term || term.length < 3) {
      return NextResponse.json(
        { error: 'Search term must be at least 3 characters' },
        { status: 400 }
      );
    }
    
    // Search for users by email, username, firstName, or lastName
    const users = await User.find({
      $or: [
        { email: { $regex: term, $options: 'i' } },
        { username: { $regex: term, $options: 'i' } },
        { firstName: { $regex: term, $options: 'i' } },
        { lastName: { $regex: term, $options: 'i' } }
      ]
    })
      .select('_id email username firstName lastName role')
      .limit(10);
    
    // Format data for frontend
    const formattedUsers = users.map(user => ({
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      name: user.firstName && user.lastName ? 
        `${user.firstName} ${user.lastName}` : 
        user.username || user.email.split('@')[0],
      role: user.role
    }));
    
    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    );
  }
} 
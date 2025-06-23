import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/services/mongodb';
import User from '@/models/User';
import { getSession } from '@/services/authService';

export async function GET(request: NextRequest) {
  try {
    // Connect to the database
    await connectToDatabase();

    // Get the session and verify user is authenticated
    const session = await getSession(request);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get the user from database (excluding password)
    const user = await User.findById(session.user.id).select('-password');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return user profile
    return NextResponse.json(user);
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Connect to the database
    await connectToDatabase();

    // Get the session and verify user is authenticated
    const session = await getSession(request);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get request body
    const updatedProfile = await request.json();
    
    // Remove fields that users shouldn't be able to update directly
    const { password, role, ...allowedUpdates } = updatedProfile;

    // Get the user from database
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If user is trying to update email, check if it's already in use
    if (allowedUpdates.email && allowedUpdates.email !== user.email) {
      const existingUserWithEmail = await User.findOne({ email: allowedUpdates.email });
      if (existingUserWithEmail) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
      }
    }

    // If user is trying to update username, check if it's already in use
    if (allowedUpdates.username && allowedUpdates.username !== user.username) {
      const existingUserWithUsername = await User.findOne({ username: allowedUpdates.username });
      if (existingUserWithUsername) {
        return NextResponse.json({ error: 'Username already in use' }, { status: 409 });
      }
    }

    // Update the user profile
    Object.assign(user, allowedUpdates);
    await user.save();

    // Return updated profile without password
    const updatedUser = user.toObject();
    delete updatedUser.password;

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
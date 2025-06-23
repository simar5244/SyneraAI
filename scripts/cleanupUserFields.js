#!/usr/bin/env node
// Script to remove legacy 'responsibilities' and 'jobDuties' fields from all users
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../src/lib/dbConnect';
import User from '../src/models/User';

dotenv.config({ path: './.env.local' });

async function migrate() {
  try {
    await connectDB();
    console.log('Connected to MongoDB, running migration...');
    const result = await User.updateMany(
      {},
      { $unset: { responsibilities: '', jobDuties: '' } }
    );
    console.log(`Migration complete. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();

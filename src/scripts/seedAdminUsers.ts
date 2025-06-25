import { MongoClient } from 'mongodb';
import { hashPassword } from '../services/authService';
import mongoose from 'mongoose';

async function seedAdminUsers() {
  try {
    // Connect to the main database
    const client = new MongoClient(process.env.MONGODB_URI || '');
    await client.connect();
    console.log('Connected to database');
    
    try {
      const db = client.db('org_sim_db');
      const usersCollection = db.collection('users');

    // Admin account (from logininfo.txt)
    const adminUser = {
      username: 'admin',
      email: 'admin@organizationgalaxy.com',
      password: 'AdminPassword123!', 
      role: 'admin' as const,
      emailVerified: true,
      twoFactorEnabled: false
    };

    // Test account (from logininfo.txt)
    const testUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'TestPassword123!',
      role: 'admin' as const,
      emailVerified: true,
      twoFactorEnabled: false
    };

    // Check if admin user already exists
    const existingAdmin = await usersCollection.findOne({ email: adminUser.email });
    if (!existingAdmin) {
      // Hash password
      const hashedAdminPassword = await hashPassword(adminUser.password);
      
      // Create admin user
      await usersCollection.insertOne({
        ...adminUser,
        password: hashedAdminPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('Admin user created');
    } else {
      console.log('Admin user already exists');
    }

    // Check if test user already exists
    const existingTestUser = await usersCollection.findOne({ email: testUser.email });
    if (!existingTestUser) {
      // Hash password
      const hashedTestPassword = await hashPassword(testUser.password);
      
      // Create test user
      await usersCollection.insertOne({
        ...testUser,
        password: hashedTestPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('Test user created');
    } else {
      console.log('Test user already exists');
    }

      console.log('Seeding completed successfully');
    } catch (error) {
      console.error('Error during database operations:', error);
      throw error;
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
}

// Run the seed function
seedAdminUsers(); 
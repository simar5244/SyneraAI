import { connectToDatabase } from '../lib/db';
import User from '../models/User';
import { hashPassword } from '../lib/auth';

async function seedAdminUsers() {
  try {
    // Connect to the database
    await connectToDatabase();
    console.log('Connected to database');

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
    const existingAdmin = await User.findOne({ email: adminUser.email });
    if (!existingAdmin) {
      // Hash password
      const hashedAdminPassword = await hashPassword(adminUser.password);
      
      // Create admin user
      const newAdminUser = new User({
        ...adminUser,
        password: hashedAdminPassword
      });
      
      await newAdminUser.save();
      console.log('Admin user created');
    } else {
      console.log('Admin user already exists');
    }

    // Check if test user already exists
    const existingTestUser = await User.findOne({ email: testUser.email });
    if (!existingTestUser) {
      // Hash password
      const hashedTestPassword = await hashPassword(testUser.password);
      
      // Create test user
      const newTestUser = new User({
        ...testUser,
        password: hashedTestPassword
      });
      
      await newTestUser.save();
      console.log('Test user created');
    } else {
      console.log('Test user already exists');
    }

    console.log('Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
}

// Run the seed function
seedAdminUsers(); 
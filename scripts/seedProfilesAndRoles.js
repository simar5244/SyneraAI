// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

(async () => {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri, { dbName: 'org_sim_db' });
  try {
    await client.connect();
    const db = client.db();
    const users = db.collection('users');
    const profiles = db.collection('Project3_Profiles');

    const entries = [
      {
        userIdObj: '680fbba781c1389d340a5f1b', // userDoc _id
        profileId: '680fbba781c1389d340a5f1b',
        userId: '680fbba781c1389d340a5f1a',
        profile: {
          _id: new ObjectId('680fbba781c1389d340a5f1b'),
          userId: '680fbba781c1389d340a5f1a',
          email: 'simar5244@gmail.com',
          firstName: 'simarjot',
          lastName: 'singh',
          phone: '8067010519',
          jobTitle: 'asasas',
          jobResponsibilities: 'asasas',
          role: 'admin',
          emailNotifications: true,
          projectUpdates: false,
          teamMessages: true,
          taskReminders: true,
          createdAt: new Date('2025-04-28T17:32:23.500Z'),
          updatedAt: new Date('2025-04-28T18:33:28.209Z')
        }
      },
      {
        userIdObj: '680fbc8e81c1389d340a5f1d',
        profileId: '680fbc8e81c1389d340a5f1d',
        userId: '680fbc8e81c1389d340a5f1c',
        profile: {
          _id: new ObjectId('680fbc8e81c1389d340a5f1d'),
          userId: '680fbc8e81c1389d340a5f1c',
          email: 'techygeeksland@gmail.com',
          firstName: 'Simarjot',
          lastName: 'Singh',
          phone: '8000000000',
          jobTitle: 'superadmin',
          jobResponsibilities: 'Superadmin',
          role: 'superadmin',
          emailNotifications: true,
          projectUpdates: true,
          teamMessages: true,
          taskReminders: true,
          createdAt: new Date('2025-04-28T17:36:14.464Z'),
          updatedAt: new Date('2025-04-28T17:36:14.464Z')
        }
      }
    ];

    for (const e of entries) {
      // Update user role in users collection
      await users.updateOne(
        { _id: new ObjectId(e.userIdObj) },
        { $set: { role: e.profile.role } }
      );
      console.log(`Updated users role for ${e.userIdObj} to ${e.profile.role}`);

      // Upsert profile document
      await profiles.updateOne(
        { _id: new ObjectId(e.profileId) },
        { $set: e.profile },
        { upsert: true }
      );
      console.log(`Upserted profile for userId ${e.userId}`);
    }
    console.log('Seeding complete.');
  } catch (err) {
    console.error('Error seeding profiles and roles:', err);
  } finally {
    await client.close();
  }
})();

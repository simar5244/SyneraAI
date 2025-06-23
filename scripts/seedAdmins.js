require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User').default;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'org_sim_db' });
  const admins = [
    { username: 'admin', email: 'admin@example.com', password: 'AdminPass123', role: 'admin', emailVerified: true },
    { username: 'superadmin', email: 'superadmin@example.com', password: 'SuperPass123', role: 'superadmin', emailVerified: true }
  ];

  for (const u of admins) {
    let user = await User.findOne({ email: u.email });
    if (user) {
      console.log(`User ${u.email} already exists`);
      continue;
    }
    user = new User(u);
    await user.save();
    console.log(`Created user ${u.username} (${u.role})`);
  }
  await mongoose.connection.close();
}

main().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});

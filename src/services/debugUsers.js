// Debug script to check user data in MongoDB
// Save this as debugUsers.js and run with Node

const { MongoClient } = require('mongodb');

// Replace with your actual MongoDB connection string
const uri = "mongodb://localhost:27017/yourDatabaseName";

async function main() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db();
    const usersCollection = db.collection('users');

    // 1. Check if the admin user exists (adjust email as needed)
    const email = "admin@company1.com";
    const adminUser = await usersCollection.findOne({
      email: { $regex: `^${email}$`, $options: 'i' },
    });

    console.log("Admin user found?", !!adminUser);
    if (adminUser) {
      console.log("Admin details:", {
        id: adminUser._id,
        email: adminUser.email,
        companyCode: adminUser.companyCode,
        role: adminUser.role,
      });
    } else {
      console.log("No user found with email:", email);

      // List all users for debugging
      console.log("\nListing all users:");
      const allUsers = await usersCollection.find({}).limit(10).toArray();
      allUsers.forEach((user ) => {
        console.log(
          `- ${user.email || 'no email'} (Company: ${
            user.companyCode || 'no company'
          }, ID: ${user._id})`
        );
      });
    }

    // Check company code matching
    const companyCode = "LcowIAVo";
    const usersWithCompany = await usersCollection
      .find({
        companyCode: { $regex: `^${companyCode}$`, $options: 'i' },
      })
      .toArray();

    console.log(
      `\nFound ${usersWithCompany.length} users with company code: ${companyCode}`
    );
    usersWithCompany.forEach((user) => {
      console.log(
        `- ${user.email || 'no email'} (Company: ${user.companyCode})`
      );
    });
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.close();
  }
}

main().catch(console.error);

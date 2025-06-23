// Cleanup script to remove all MongoDB databases except protected ones
const { MongoClient } = require('mongodb');
require('dotenv').config();

// Get connection string from environment or use default
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://simarjotsingh5244:NUMotMgntP7AcNrQ@cluster0.nen0dzs.mongodb.net/';

// List of protected databases that should NOT be deleted
const PROTECTED_DBS = ['auth_db', 'admin', 'local'];

async function cleanupDatabases() {
  console.log('Starting MongoDB cleanup...');
  
  // Create a new MongoClient
  const client = new MongoClient(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  try {
    // Connect to the MongoDB server
    await client.connect();
    console.log('Connected to MongoDB server');

    // Get list of all databases
    const dbList = await client.db().admin().listDatabases();
    const databasesToDelete = dbList.databases.filter(db => !PROTECTED_DBS.includes(db.name));

    // Print databases to be deleted
    console.log(`Found ${dbList.databases.length} total databases`);
    console.log(`Protecting: ${PROTECTED_DBS.join(', ')}`);
    console.log(`Will delete ${databasesToDelete.length} databases: ${databasesToDelete.map(db => db.name).join(', ')}`);

    // Confirm deletion
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const confirmation = await new Promise(resolve => {
      readline.question('Are you sure you want to proceed with deletion? (yes/no): ', answer => {
        readline.close();
        resolve(answer.toLowerCase() === 'yes');
      });
    });

    if (!confirmation) {
      console.log('Operation cancelled. No databases were deleted.');
      return;
    }

    // Delete each non-protected database
    console.log('Starting deletion process...');
    for (const db of databasesToDelete) {
      console.log(`Dropping database: ${db.name}...`);
      await client.db(db.name).dropDatabase();
      console.log(`Successfully dropped ${db.name}`);
    }

    console.log('Cleanup complete!');

  } catch (error) {
    console.error('Error during cleanup process:', error);
  } finally {
    // Close the connection
    await client.close();
    console.log('Disconnected from MongoDB server');
  }
}

// Run the cleanup function
cleanupDatabases(); 
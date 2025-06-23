# MongoDB Cleanup Script

This script safely removes all MongoDB databases from your cluster except for the protected ones.

## Protected Databases (will NOT be deleted)
- auth_db
- admin
- local

## Requirements
- Node.js
- MongoDB connection

## Installation
Make sure you have the required dependencies:

```bash
npm install mongodb dotenv
```

## Usage
1. Make sure your MongoDB connection URI is either:
   - Set in your environment as `MONGODB_URI`
   - Or the default in the script is correct

2. Run the script:
```bash
node cleanup_mongodb.js
```

3. The script will:
   - Connect to your MongoDB cluster
   - List all databases
   - Show which will be deleted
   - Ask for confirmation before deleting
   - Delete all non-protected databases
   - Report the results

## Safety Features
- Shows a preview of which databases will be deleted
- Requires explicit confirmation before deleting anything
- Will never delete the protected databases (auth_db, admin, local) 
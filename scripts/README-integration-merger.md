# Integration Data Merger

This set of tools enables merging data from the `integrations` collection into the `users` collection, matching records by email address.

## Background

When users upload CSV files or connect ERP software in the dashboard/employees section, the data is extracted and stored in the `integrations` collection. These scripts allow you to merge this data into the `users` collection, ensuring that employee data is consolidated while maintaining company-specific isolation.

## Available Tools

1. **REST API Endpoint** - `/api/users/merge-integrations`
2. **Command Line Script** - `scripts/merge-integrations.js`
3. **Scheduled Merger** - `scripts/schedule-integration-merge.js`

## REST API Endpoint

### Usage

The API endpoint requires admin privileges to use:

```
POST /api/users/merge-integrations
```

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Request Body:**
```json
{
  "dryRun": false,              // Optional: Set to true to simulate without changes
  "emails": ["user@example.com"], // Optional: Array of specific emails to process
  "updateExistingFields": false // Optional: Update fields even if they exist
}
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 50,
    "matched": 45,
    "updated": 42,
    "errors": 0,
    "skipped": 8
  },
  "message": "Successfully merged integration data for 42 users"
}
```

## Command Line Script

### Installation

Ensure you have the necessary dependencies:

```bash
npm install mongodb dotenv
```

### Usage

```bash
node scripts/merge-integrations.js --company=COMPANY_CODE [options]
```

**Required Arguments:**
- `--company=CODE` - Company code to specify which database to use

**Optional Arguments:**
- `--dry-run` - Only simulate the merge without making changes
- `--update-existing` - Update fields even if they already exist in the user document
- `--email=EMAIL` - Process only the specified email (can be used multiple times)

**Examples:**
```bash
# Merge all integration data for company 'abc123'
node scripts/merge-integrations.js --company=abc123

# Test what would happen without making changes
node scripts/merge-integrations.js --company=abc123 --dry-run

# Process only a specific user
node scripts/merge-integrations.js --company=abc123 --email=user@example.com

# Update fields even if they already exist
node scripts/merge-integrations.js --company=abc123 --update-existing
```

## Scheduled Merger

### Installation

Ensure you have the necessary dependencies:

```bash
npm install mongodb dotenv node-cron
```

### Configuration

Edit the `scripts/schedule-integration-merge.js` file to configure:

1. The companies to process (add company codes to the `COMPANIES` array)
2. The schedule (default: daily at 2:00 AM)
3. Whether to update existing fields (default: false)

Or use environment variables:
- `MERGE_SCHEDULE` - Cron expression for the schedule
- `UPDATE_EXISTING_FIELDS` - Set to 'true' to update existing fields
- `RUN_ON_STARTUP` - Set to 'true' to run immediately on startup

### Usage

```bash
# Start the scheduler
node scripts/schedule-integration-merge.js
```

The script will continue running until stopped manually (Ctrl+C).

For production environments, consider using a process manager like PM2:

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start scripts/schedule-integration-merge.js --name integration-merger

# Make it start on system boot
pm2 startup
pm2 save
```

## Data Handling Details

### Field Merging Strategy

By default, the merger will only add new fields to user records and won't overwrite existing fields. This preserves any manually entered or important data in the user records.

If you want to update existing fields, use the `--update-existing` option or set `updateExistingFields: true` in the API call.

### Fields Not Merged

The following fields from integration records are not merged into user records:
- `_id` - MongoDB internal ID
- `email` - Already used for matching
- `uploader` - Administrative metadata
- `uploadedAt` - Administrative metadata
- `status` - Administrative metadata
- `type` - Administrative metadata

### Company Isolation

All operations are performed within company-specific databases (`company_COMPANYCODE`), ensuring that data never crosses company boundaries.

## Troubleshooting

### Logs

Check logs for detailed information about each merge operation, including:
- Number of records processed
- Number of users matched
- Number of users updated
- Any errors encountered

### Common Issues

1. **No Records Found**: Ensure the integration records have an `email` field.

2. **No Users Updated**: This could be normal if:
   - The users already have all the integration data
   - The integration records don't have any fields to merge
   - You're using the default setting not to update existing fields

3. **Connection Errors**: Verify that your MongoDB connection string is correct. 
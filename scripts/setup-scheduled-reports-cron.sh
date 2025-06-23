#!/bin/bash

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$DIR/.."

# Make the cron script executable
chmod +x "$PROJECT_DIR/scripts/run-scheduled-reports-cron.sh"

# Create a temporary file for the crontab
TEMP_CRONTAB=$(mktemp)

# Export current crontab
crontab -l > "$TEMP_CRONTAB" 2>/dev/null || echo "# New crontab" > "$TEMP_CRONTAB"

# Check if the cron job already exists
if grep -q "run-scheduled-reports-cron.sh" "$TEMP_CRONTAB"; then
  echo "Scheduled reports cron job already exists."
else
  # Add the cron job to run every minute
  echo "* * * * * $PROJECT_DIR/scripts/run-scheduled-reports-cron.sh" >> "$TEMP_CRONTAB"
  
  # Install the new crontab
  crontab "$TEMP_CRONTAB"
  
  echo "Scheduled reports cron job has been added to run every minute."
fi

# Clean up
rm "$TEMP_CRONTAB"

echo "To check if the cron job is running, use: crontab -l"
echo "To force execute all scheduled reports now, run: node scripts/run-scheduled-reports.js --force" 
#!/bin/bash

# Change to the project root directory
cd "$(dirname "$0")/.."

# Load environment variables
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
elif [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Set the log file
LOG_FILE="logs/scheduled-reports-cron.log"

# Ensure logs directory exists
mkdir -p logs

# Log start time
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting scheduled reports cron job" >> $LOG_FILE

# Run the scheduled reports script
node scripts/scheduled-reports-cron.js >> $LOG_FILE 2>&1

# Log end time and exit status
EXIT_CODE=$?
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Scheduled reports cron job completed with exit code $EXIT_CODE" >> $LOG_FILE

# Set up a cron job to run this script every minute
if [ "$1" == "--setup-cron" ]; then
  # Create a temporary crontab file
  TEMP_CRONTAB=$(mktemp)
  
  # Export current crontab
  crontab -l > "$TEMP_CRONTAB" 2>/dev/null
  
  # Check if the cron job already exists
  if ! grep -q "scripts/run-scheduled-reports.sh" "$TEMP_CRONTAB"; then
    # Add the new cron job
    echo "* * * * * cd $(pwd) && ./scripts/run-scheduled-reports.sh" >> "$TEMP_CRONTAB"
    
    # Install the new crontab
    crontab "$TEMP_CRONTAB"
    echo "Cron job installed to run every minute"
  else
    echo "Cron job already exists"
  fi
  
  # Clean up
  rm "$TEMP_CRONTAB"
fi

exit $EXIT_CODE 
#!/bin/bash

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Go to the project root directory
cd "$DIR/.."

# Set up log file
LOG_DIR="./logs"
mkdir -p $LOG_DIR
LOG_FILE="$LOG_DIR/scheduled-reports-$(date +%Y-%m-%d).log"

# Check if the NextJS server is running
echo "$(date): Checking if NextJS server is running..." >> $LOG_FILE
SERVER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health || echo "000")

if [ "$SERVER_STATUS" != "200" ]; then
  echo "$(date): NextJS server is not running. Skipping scheduled reports check." >> $LOG_FILE
  exit 0
fi

# Run the scheduled reports script
echo "$(date): NextJS server is running. Running scheduled reports check..." >> $LOG_FILE
node scripts/run-scheduled-reports.js >> $LOG_FILE 2>&1

# Exit with the status of the node script
exit $? 
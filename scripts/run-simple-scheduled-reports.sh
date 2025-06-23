#!/bin/bash

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Go to the project root directory
cd "$DIR/.."

# Set up log file
LOG_DIR="./logs"
mkdir -p $LOG_DIR
LOG_FILE="$LOG_DIR/scheduled-reports-$(date +%Y-%m-%d).log"

# Run the scheduled reports script
echo "$(date): Running scheduled reports" >> $LOG_FILE
node scripts/simple-scheduled-reports.js >> $LOG_FILE 2>&1

exit $? 
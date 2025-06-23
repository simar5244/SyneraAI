#!/bin/bash

# Script to start the scheduled reports daemon and keep it running

# Change to the project directory
cd "$(dirname "$0")/.."

# Create logs directory if it doesn't exist
mkdir -p logs

# Log file for the daemon process
LOG_FILE="logs/scheduled-reports-daemon.log"

# Check if the process is already running
PID_FILE="logs/scheduled-reports.pid"
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if ps -p $PID > /dev/null; then
    echo "Scheduled reports daemon is already running with PID $PID"
    exit 0
  else
    echo "Removing stale PID file"
    rm "$PID_FILE"
  fi
fi

# Start the daemon process
echo "Starting scheduled reports daemon..."
nohup node scripts/scheduled-reports-daemon.js >> "$LOG_FILE" 2>&1 &

# Save the PID
PID=$!
echo $PID > "$PID_FILE"
echo "Scheduled reports daemon started with PID $PID"
echo "Logs are being written to $LOG_FILE" 
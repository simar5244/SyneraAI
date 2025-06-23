#!/bin/bash

# Script to stop the scheduled reports daemon

# Change to the project directory
cd "$(dirname "$0")/.."

# PID file location
PID_FILE="logs/scheduled-reports.pid"

# Check if the PID file exists
if [ ! -f "$PID_FILE" ]; then
  echo "Scheduled reports daemon is not running (no PID file found)"
  exit 0
fi

# Read the PID
PID=$(cat "$PID_FILE")

# Check if the process is running
if ! ps -p $PID > /dev/null; then
  echo "Process with PID $PID is not running"
  rm "$PID_FILE"
  exit 0
fi

# Kill the process
echo "Stopping scheduled reports daemon with PID $PID..."
kill $PID

# Wait for the process to terminate
for i in {1..10}; do
  if ! ps -p $PID > /dev/null; then
    break
  fi
  echo "Waiting for process to terminate..."
  sleep 1
done

# Check if the process is still running
if ps -p $PID > /dev/null; then
  echo "Process did not terminate gracefully, sending SIGKILL..."
  kill -9 $PID
  sleep 1
fi

# Remove the PID file
rm "$PID_FILE"
echo "Scheduled reports daemon stopped" 
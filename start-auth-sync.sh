#!/bin/bash

# This script starts the auth sync process in the background and logs output

echo "Starting auth sync process..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Kill any existing auth sync process
pkill -f "node ./scripts/auth-sync.js" || true

# Start auth sync process and log output
node ./scripts/auth-sync.js > logs/auth-sync.log 2>&1 &

# Save PID to file for later reference
echo $! > .auth-sync.pid

echo "Auth sync process started. Check logs/auth-sync.log for details."
echo "To stop the process, run: kill \$(cat .auth-sync.pid)" 
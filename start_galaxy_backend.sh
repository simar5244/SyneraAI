#!/bin/bash

# Start MongoDB (if not already running)
echo "Checking if MongoDB is running..."
if ! pgrep -x "mongod" > /dev/null; then
    echo "Starting MongoDB..."
    mongod --dbpath ./data/db &
    sleep 3  # Give MongoDB time to start
else
    echo "MongoDB is already running."
fi

# Create mock directories if they don't exist
mkdir -p ./data/db

# Ensure Python dependencies are installed
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Start the Galaxy backend server with mock data loading
echo "Starting Galaxy backend server with mock data..."
python run_galaxy_backend.py --load-mock-data

# Note: To start without loading mock data, run:
# python run_galaxy_backend.py 
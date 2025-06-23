#!/bin/bash

# Install required Python packages
echo "Installing required Python packages..."
pip install pandas sentence-transformers scikit-learn pymongo python-dotenv schedule requests

# Install required Node.js packages if needed
if [ ! -d "node_modules/node-cron" ]; then
  echo "Installing Node.js dependencies..."
  npm install node-cron dotenv
fi

# Ensure environment variables are properly set
if [ -z "$GEMINI_API_KEY" ]; then
  echo "Warning: GEMINI_API_KEY environment variable is not set."
  echo "The successor identification may not work properly."
fi

if [ -z "$GEMINI_MODEL" ]; then
  echo "Setting default Gemini model to gemini-2.0-flash-001"
  export GEMINI_MODEL="gemini-2.0-flash-001"
fi

# Kill any existing successor processes
echo "Stopping any existing successor processes..."
pkill -f "python3 ./successor_identification.py" || true
pkill -f "node successor_cron.js" || true

# Start the successor identification service in watch mode
echo "Starting successor identification in watch mode..."
python3 ./successor_identification.py --watch --npm >> successor_identification.log 2>&1 &

echo "Successor identification service started in watch mode."
echo "Service will process database changes in real-time."
echo "Check successor_identification.log for details."
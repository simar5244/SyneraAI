#!/bin/bash

# Install required Python packages
echo "Installing required Python packages..."
pip install pandas sentence-transformers scikit-learn pymongo python-dotenv faiss-cpu requests

# Install required Node.js packages if needed
if [ ! -d "node_modules/node-cron" ]; then
  echo "Installing Node.js dependencies..."
  npm install node-cron dotenv
fi

# Ensure environment variables are properly set
if [ -z "$GEMINI_API_KEY" ]; then
  echo "Warning: GEMINI_API_KEY environment variable is not set."
  echo "The attrition analyzer may not work properly."
fi

if [ -z "$GEMINI_MODEL" ]; then
  echo "Setting default Gemini model to gemini-2.0-flash-001"
  export GEMINI_MODEL="gemini-2.0-flash-001"
fi

# Kill any existing attrition analyzer processes
echo "Stopping any existing attrition processes..."
pkill -f "python3 ./attrition_score.py" || true

# Start the attrition analyzer service in watch mode
echo "Starting attrition analyzer in watch mode..."
python3 ./attrition_score.py --watch --npm >> attrition_analyzer.log 2>&1 &

echo "Attrition analyzer service started in watch mode."
echo "Service will process database changes in real-time."
echo "Check attrition_analyzer.log for details." 
#!/bin/bash

# Activate Python virtual environment if it exists
if [ -d ".venv" ]; then
  source .venv/bin/activate
  echo "Activated Python virtual environment"
else
  echo "No virtual environment found at .venv"
fi

# Check if the required Python modules are installed
python3 -c "import pymongo, sentence_transformers, dotenv" &>/dev/null

if [ $? -ne 0 ]; then
  echo "Installing required Python modules..."
  pip install pymongo python-dotenv sentence-transformers scikit-learn numpy
fi

# Run the successor identification script
echo "Running successor identification and duty redistribution system"
echo "Command arguments: $@"

# Check if arguments were provided
if [ $# -eq 0 ]; then
  # No arguments, show help
  echo "Usage:"
  echo "  $0 --incumbent EMAIL --successors EMAIL1,EMAIL2,... [--update-db]"
  echo ""
  echo "Options:"
  echo "  --incumbent EMAIL    Email of the employee to be removed"
  echo "  --successors EMAILS  Comma-separated list of successor emails"
  echo "  --update-db          Update the database with the redistributed duties"
  echo ""
  echo "Example:"
  echo "  $0 --incumbent john@company.com --successors jane@company.com,bob@company.com"
  exit 1
fi

# Check if successor_duty_redistributor.py exists
if [ ! -f "successor_duty_redistributor.py" ]; then
  echo "Error: successor_duty_redistributor.py not found!"
  exit 1
fi

# Run the script with all arguments passed through
echo "Executing: python3 successor_duty_redistributor.py $@"
python3 successor_duty_redistributor.py "$@"

# Check for execution errors
if [ $? -ne 0 ]; then
  echo "Error running duty redistribution script"
  exit 1
fi

echo "Duty redistribution complete"
exit 0 
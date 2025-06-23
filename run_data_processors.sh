#!/bin/bash

# Run data processors in sequence
# This script runs the data processors once in the correct order

echo "-------------- DATA PROCESSOR SEQUENCE START --------------"
echo "$(date): Running data processors in sequence"

# 1. MongoDB Merger - run once
echo "1. Running MongoDB Merger..."
python3 mongodb_merger.py
echo "MongoDB Merger completed."

# 2. Employee Utilization Analyzer - run once
echo "2. Running Employee Utilization Analyzer..."
python3 employee_utilization_analyzer.py
echo "Employee Utilization Analyzer completed."

# 3. Attrition Score - run once
echo "3. Running Attrition Score Analyzer..."
python3 attrition_score.py
echo "Attrition Score Analyzer completed."

# 4. Successor Identification - run once with refresh
echo "4. Running Successor Identification..."
python3 successor_identification.py --refresh --batch-size 10
echo "Successor Identification completed."

echo "-------------- DATA PROCESSOR SEQUENCE COMPLETE --------------"
echo "$(date): All data processors have completed"
echo ""
echo "Note: The successor script is scheduled to run every 24 hours via successor_cron.js"
echo "The other scripts will update automatically when database changes occur." 
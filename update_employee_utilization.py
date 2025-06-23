#!/usr/bin/env python3
import sys
import argparse
import logging
import os
import traceback
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Load environment variables
load_dotenv('.env.local', override=True)
load_dotenv()

# MongoDB connection settings
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("MONGODB_DATABASE") or os.getenv("MONGODB_DB_NAME") or "org_sim_db"
OUTPUT_COLLECTION = "merged_output"

def connect_db():
    """Connect to MongoDB"""
    try:
        logging.info(f"Connecting to MongoDB at {MONGO_URI.replace('user:.*@', '***:***@')}...")
        client = MongoClient(MONGO_URI)
        # The ismaster command is cheap and does not require auth.
        client.admin.command('ismaster')
        db = client[DB_NAME]
        logging.info("MongoDB connection successful.")
        return client, db
    except ConnectionFailure as e:
        logging.error(f"MongoDB connection failed: {e}")
        return None, None
    except Exception as e:
        logging.error(f"An error occurred during DB connection: {e}")
        return None, None

def process_employee(email):
    """Process a single employee by email"""
    # First check if the employee exists
    client, db = connect_db()
    if db is None:
        logging.error("Failed to connect to database")
        return False
    
    # Check if employee exists
    employee = db[OUTPUT_COLLECTION].find_one({"email": email})
    if not employee:
        logging.error(f"Employee with email {email} not found")
        return False
    
    logging.info(f"Found employee: {employee.get('firstName')} {employee.get('lastName')} ({email})")
    
    try:
        logging.info(f"Manually processing utilization for {email}")
        
        # Get current duties
        job_responsibilities = employee.get('jobResponsibilities', [])
        logging.info(f"Employee has {len(job_responsibilities)} job responsibilities")
        
        # Calculate total intensity and hours
        total_intensity = 0
        total_hours = 0
        
        for duty in job_responsibilities:
            intensity = duty.get('intensity', 0.5)
            hours = duty.get('hours', intensity * 10)
            total_intensity += intensity
            total_hours += hours
        
        # Calculate basic utilization score (40 hours = 1.0 utilization)
        utilization_score = min(1.5, total_hours / 40)
        
        # Update employee record with new utilization score
        result = db[OUTPUT_COLLECTION].update_one(
            {"email": email},
            {"$set": {
                "utilization": {
                    "score": utilization_score,
                    "category": get_utilization_category(utilization_score),
                    "lastUpdated": uts_now()
                }
            }}
        )
        
        logging.info(f"Updated utilization for {email}: {utilization_score:.2f}")
        logging.info(f"Database update result: {result.modified_count} document(s) modified")
        
        return True
    except Exception as e:
        logging.error(f"Error processing employee {email}: {e}")
        traceback.print_exc()
        return False
    finally:
        if client:
            client.close()

def get_utilization_category(score):
    """Get utilization category based on score"""
    if score > 1.3: return "critical"
    if score > 1.2: return "very-high"
    if score > 1.1: return "high"
    if score > 1.0: return "above-optimal"
    if score > 0.9: return "optimal"
    if score > 0.7: return "moderate"
    if score > 0.5: return "low"
    if score > 0.3: return "very-low"
    return "minimal"

def uts_now():
    """Get current timestamp"""
    import datetime
    return datetime.datetime.utcnow().isoformat()

def main():
    parser = argparse.ArgumentParser(description='Update Employee Utilization')
    parser.add_argument('--email', required=True, help='Employee email to process')
    args = parser.parse_args()
    
    if not args.email:
        logging.error("Email parameter is required")
        return 1
    
    success = process_employee(args.email)
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main()) 
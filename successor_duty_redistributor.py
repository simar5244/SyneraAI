#!/usr/bin/env python3
import argparse
import logging
import os
import json
import math
import numpy as np
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Any, Tuple, Optional
import time
from datetime import datetime

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logging.info("Duty Redistribution System starting up...")

# --- Configuration ---
# Load environment variables
load_dotenv('.env.local', override=True)
load_dotenv()

# MongoDB connection settings
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
logging.info(f"MongoDB URI loaded: {MONGO_URI.replace('user:.*@', '***:***@')}")
DB_NAME = os.getenv("MONGODB_DATABASE") or os.getenv("MONGODB_DB_NAME") or "org_sim_db"
logging.info(f"Using database: {DB_NAME}")
OUTPUT_COLLECTION = "merged_output"
USERS_COLLECTION = "users"

# Global variables
client = None
db = None
model = None

# --- MongoDB Connection ---
def connect_db():
    """Connect to MongoDB"""
    global client, db
    try:
        if client is None:
            logging.info(f"Connecting to MongoDB at {MONGO_URI}...")
            client = MongoClient(MONGO_URI)
            # The ismaster command is cheap and does not require auth.
            client.admin.command('ismaster')
            db = client[DB_NAME]
            logging.info("MongoDB connection successful.")
    except ConnectionFailure as e:
        logging.error(f"MongoDB connection failed: {e}")
        client = None
        db = None
    except Exception as e:
        logging.error(f"An error occurred during DB connection: {e}")
        client = None
        db = None

def load_model():
    """Load sentence transformer model"""
    global model
    try:
        logging.info("Loading sentence transformer model...")
        start_time = time.time()
        # Use a lightweight model for efficiency
        model = SentenceTransformer('all-MiniLM-L6-v2')
        logging.info(f"Model loaded in {time.time() - start_time:.2f} seconds")
    except Exception as e:
        logging.error(f"Error loading model: {e}")
        model = None

# --- Data Retrieval Functions ---
def get_employee(email: str) -> Optional[Dict[str, Any]]:
    """
    Get employee data by email
    
    Args:
        email: Employee email
        
    Returns:
        Employee document or None if not found
    """
    if db is None:
        logging.error("Database connection not available")
        return None
    
    # Search in merged_output collection
    employee = db[OUTPUT_COLLECTION].find_one({"email": email})
    
    # If not found, try users collection
    if not employee:
        employee = db[USERS_COLLECTION].find_one({"email": email})
    
    if employee:
        logging.info(f"Found employee: {employee.get('email')}")
        return employee
    
    logging.info(f"No employee found for email: {email}")
    return None

def get_employee_duties(email: str) -> List[Dict[str, Any]]:
    """
    Get employee duties by email
    
    Args:
        email: Employee email
        
    Returns:
        List of duty objects
    """
    employee = get_employee(email)
    if not employee:
        return []
    
    # Extract duties from employee data
    duties = employee.get("jobResponsibilities", []) or employee.get("jobDuties", [])
    
    if not duties:
        duties = []
        job_intensity = employee.get("job_intensity_analysis", {})
        if job_intensity and "duties" in job_intensity:
            duties = job_intensity["duties"]
    
    # Ensure duties have consistent structure
    formatted_duties = []
    for i, duty in enumerate(duties):
        if isinstance(duty, dict):
            # Add ID if missing
            duty_obj = {
                "id": duty.get("id", f"duty-{i}"),
                "duty": duty.get("duty", duty.get("description", "")),
                "intensity": float(duty.get("intensity", 0.5)),
                "hours": float(duty.get("hours", 4.0))
            }
            formatted_duties.append(duty_obj)
        elif isinstance(duty, str):
            # Convert string duty to object
            duty_obj = {
                "id": f"duty-{i}",
                "duty": duty,
                "intensity": 0.5,  # Default intensity
                "hours": 4.0       # Default hours
            }
            formatted_duties.append(duty_obj)
    
    return formatted_duties

def get_successor_candidates(incumbent_email: str, successor_emails: List[str]) -> List[Dict[str, Any]]:
    """
    Get details for specified successor candidates
    
    Args:
        incumbent_email: Email of incumbent employee
        successor_emails: List of successor email addresses
        
    Returns:
        List of successor details
    """
    if db is None:
        logging.error("Database connection not available")
        return []
    
    successors = []
    
    for email in successor_emails:
        # Get successor data
        successor = get_employee(email)
        if successor:
            successors.append(successor)
    
    logging.info(f"Found {len(successors)} successor candidates for {incumbent_email}")
    return successors

# --- Duty Redistribution Functions ---
def calculate_utilization_factor(successor: Dict[str, Any]) -> float:
    """
    Calculate utilization factor for a successor
    Lower utilization = higher availability = higher factor
    
    Args:
        successor: Successor employee data
        
    Returns:
        Utilization factor (0-1 scale)
    """
    # Get utilization data from various possible fields
    utilization = successor.get("utilizationAssessment", {})
    utilization_score = utilization.get("utilization_score", 0.5)
    
    # Also check other possible field names
    if not utilization_score:
        utilization_score = successor.get("utilization_score", 0.5)
    
    # Invert score so lower utilization = higher availability
    # Cap at 0.9 maximum value to avoid 0 availability
    return max(0.1, 1.0 - min(0.9, utilization_score))

def calculate_skill_overlap(duty: Dict[str, Any], successor: Dict[str, Any]) -> float:
    """
    Calculate skill overlap between duty and successor skills
    
    Args:
        duty: Duty to be redistributed
        successor: Potential successor
        
    Returns:
        Overlap score (0-1 scale)
    """
    if model is None:
        logging.error("Sentence transformer model not loaded")
        return 0.5  # Default moderate overlap
    
    try:
        # Get duty description
        duty_text = duty["duty"]
        
        # Get successor skills and responsibilities
        successor_skills = successor.get("toolsProficient", [])
        successor_duties = successor.get("jobResponsibilities", []) or successor.get("jobDuties", [])
        
        # Extract text from successor skills
        skill_texts = []
        if isinstance(successor_skills, list):
            for skill in successor_skills:
                if isinstance(skill, str):
                    skill_texts.append(skill)
                elif isinstance(skill, dict) and skill.get("name"):
                    skill_texts.append(skill["name"])
        elif isinstance(successor_skills, str):
            skill_texts = [s.strip() for s in successor_skills.split(',')]
        
        # Extract text from successor duties
        duty_texts = []
        for succ_duty in successor_duties:
            if isinstance(succ_duty, str):
                duty_texts.append(succ_duty)
            elif isinstance(succ_duty, dict):
                duty_desc = succ_duty.get("duty", succ_duty.get("description", ""))
                if duty_desc:
                    duty_texts.append(duty_desc)
        
        # If no texts found, return low overlap
        if not skill_texts and not duty_texts:
            return 0.2
        
        # Create combined successor text profile
        successor_text = " ".join(skill_texts + duty_texts)
        
        # Use sentence transformer to calculate semantic similarity
        duty_embedding = model.encode([duty_text])[0]
        successor_embedding = model.encode([successor_text])[0]
        
        # Calculate cosine similarity
        similarity = cosine_similarity([duty_embedding], [successor_embedding])[0][0]
        
        # Normalize to 0-1 scale
        return float(min(1.0, max(0.0, similarity)))
    
    except Exception as e:
        logging.error(f"Error calculating skill overlap: {e}")
        return 0.3  # Default on error

def redistribute_duties(
    incumbent_email: str,
    successor_emails: List[str]
) -> Dict[str, Any]:
    """
    Redistribute duties from incumbent to successors
    
    Args:
        incumbent_email: Email of incumbent employee
        successor_emails: List of successor email addresses
        
    Returns:
        Dictionary with redistribution details
    """
    # Get incumbent and their duties
    incumbent = get_employee(incumbent_email)
    if not incumbent:
        return {"error": "Incumbent employee not found"}
    
    duties = get_employee_duties(incumbent_email)
    if not duties:
        return {"error": "No duties found for incumbent"}
    
    # Get successor details
    successors = get_successor_candidates(incumbent_email, successor_emails)
    if not successors:
        return {"error": "No successors found"}
    
    # Map for storing assigned duties
    duty_assignments = []
    successor_duty_map = {successor["email"]: [] for successor in successors}
    
    # For each duty, find the best successor
    for duty in duties:
        best_successor = None
        best_score = -1
        
        for successor in successors:
            # Calculate utilization factor (higher = more available)
            utilization_factor = calculate_utilization_factor(successor)
            
            # Calculate skill overlap factor
            overlap_factor = calculate_skill_overlap(duty, successor)
            
            # Calculate final score (weighted average)
            # We weight overlap higher because skill match is more important
            score = (utilization_factor * 0.3) + (overlap_factor * 0.7)
            
            # Keep track of best successor
            if score > best_score:
                best_score = score
                best_successor = successor
        
        # Assign duty to best successor
        if best_successor:
            successor_email = best_successor["email"]
            assignment = {
                "dutyId": duty["id"],
                "duty": duty,
                "successorEmail": successor_email,
                "successorName": f"{best_successor.get('firstName', '')} {best_successor.get('lastName', '')}".strip(),
                "score": best_score,
                "utilizationScore": calculate_utilization_factor(best_successor),
                "overlapScore": calculate_skill_overlap(duty, best_successor)
            }
            
            duty_assignments.append(assignment)
            successor_duty_map[successor_email].append(duty)
    
    # Create assignment summary for each successor
    successor_assignments = []
    for successor in successors:
        email = successor["email"]
        assigned_duties = successor_duty_map[email]
        
        # Calculate total hours and average intensity
        total_hours = sum(duty.get("hours", 4.0) for duty in assigned_duties)
        avg_intensity = sum(duty.get("intensity", 0.5) for duty in assigned_duties) / len(assigned_duties) if assigned_duties else 0
        
        # Add to successor assignments
        successor_assignments.append({
            "email": email,
            "name": f"{successor.get('firstName', '')} {successor.get('lastName', '')}".strip(),
            "duties": assigned_duties,
            "totalHours": total_hours,
            "averageIntensity": avg_intensity,
            "dutyCount": len(assigned_duties)
        })
    
    # Sort assignments by duty count (descending)
    successor_assignments.sort(key=lambda x: x["dutyCount"], reverse=True)
    
    return {
        "incumbentEmail": incumbent_email,
        "incumbentName": f"{incumbent.get('firstName', '')} {incumbent.get('lastName', '')}".strip(),
        "dutyAssignments": duty_assignments,
        "successorAssignments": successor_assignments,
        "totalDuties": len(duties),
        "redistributedDuties": len(duty_assignments)
    }

def update_employee_duties(email: str, duties: List[Dict[str, Any]]) -> bool:
    """
    Update employee duties in database
    
    Args:
        email: Employee email
        duties: New duties list
        
    Returns:
        True if successful, False otherwise
    """
    if db is None:
        logging.error("Database connection not available")
        return False
    
    try:
        # Update merged_output collection
        result = db[OUTPUT_COLLECTION].update_one(
            {"email": email},
            {"$set": {"jobResponsibilities": duties}}
        )
        
        # Also update users collection
        users_result = db[USERS_COLLECTION].update_one(
            {"email": email},
            {"$set": {"jobResponsibilities": duties}}
        )
        
        return result.modified_count > 0 or users_result.modified_count > 0
    
    except Exception as e:
        logging.error(f"Error updating employee duties: {e}")
        return False

def execute_redistribution(
    incumbent_email: str,
    successor_emails: List[str],
    update_database: bool = False
) -> Dict[str, Any]:
    """
    Execute redistribution and optionally update database
    
    Args:
        incumbent_email: Email of incumbent employee
        successor_emails: List of successor email addresses
        update_database: Whether to update the database with new duties
        
    Returns:
        Dictionary with redistribution details
    """
    # Run redistribution algorithm
    redistribution_result = redistribute_duties(incumbent_email, successor_emails)
    
    if "error" in redistribution_result:
        return redistribution_result
    
    # Update database if requested
    if update_database:
        # Get successor assignments
        successor_assignments = redistribution_result["successorAssignments"]
        
        # Update each successor's duties
        update_results = {}
        for assignment in successor_assignments:
            email = assignment["email"]
            duties = assignment["duties"]
            
            # Get current duties
            current_duties = get_employee_duties(email)
            
            # Merge existing and new duties
            merged_duties = current_duties + duties
            
            # Update database
            success = update_employee_duties(email, merged_duties)
            update_results[email] = success
        
        # Add update results to redistribution details
        redistribution_result["databaseUpdates"] = update_results
        
        # Remove incumbent's duties if all updates successful
        if all(update_results.values()):
            # Remove duties from incumbent
            update_employee_duties(incumbent_email, [])
    
    return redistribution_result

def main():
    """Main function for running the module"""
    parser = argparse.ArgumentParser(description='Duty Redistribution Tool')
    parser.add_argument('--incumbent', type=str, required=True, help='Email of incumbent employee to be replaced')
    parser.add_argument('--successors', type=str, required=True, help='Comma-separated list of successor emails')
    parser.add_argument('--update-db', action='store_true', help='Update the database with redistributed duties')
    parser.add_argument('--output', type=str, help='Path to output JSON file (optional)')
    
    args = parser.parse_args()
    
    # Connect to database
    connect_db()
    
    # Load model
    load_model()
    
    # Parse successor emails
    successor_emails = [email.strip() for email in args.successors.split(',')]
    
    # Execute redistribution
    result = execute_redistribution(args.incumbent, successor_emails, args.update_db)
    
    # Output results
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(result, f, indent=2)
    else:
        print(json.dumps(result, indent=2))
    
    return 0

if __name__ == "__main__":
    main() 
#!/usr/bin/env python3
import logging
import os
import json
import math
import numpy as np
try:
    import pandas as pd
except ModuleNotFoundError:
    import subprocess, sys
    logging.info("pandas not found; installing via pip...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pandas"])
    import pandas as pd
import re
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
from typing import List, Dict, Any, Tuple, Optional
import time
from datetime import datetime, timedelta

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logging.info("Successor Identification System starting up...")

# --- Configuration ---
# Load environment variables
load_dotenv('.env.local', override=True)
load_dotenv()

# MongoDB connection settings
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
# If MONGO_URI contains org_sim_db, remove it to avoid copyright issues
if "org_sim_db" in MONGO_URI:
    # Remove the specific database from connection string
    MONGO_URI = MONGO_URI.split("/org_sim_db")[0] + "/"
    if "?" in MONGO_URI:
        MONGO_URI = MONGO_URI.split("?")[0] + "/"

logging.info(f"MongoDB URI loaded: {MONGO_URI.replace('user:.*@', '***:***@')}")
USERS_COLLECTION = "users"

# --- Parameter Weights ---
# These weights determine the importance of each factor in the successor score
# Enhanced with mathematical modeling for better successor identification
SUCCESSOR_FACTOR_WEIGHTS = {
    "stability_index": 0.25,           # Weight for attrition risk (inverted) - increased importance
    "project_complexity": 0.15,        # Weight for project complexity exposure
    "cognitive_load": 0.15,           # Weight for cognitive load adaptability - slightly reduced
    "promotion_velocity": 0.15,        # Weight for career growth momentum
    "competency_similarity": 0.30      # Weight for skill/competency overlap - most important factor
}

# Minimum threshold for competency similarity to be considered a viable successor
MIN_COMPETENCY_SIMILARITY = 0.35

# --- Constants and Parameters ---
# Project complexity assessment parameters
PROJECT_COMPLEXITY_FACTORS = {
    "budget_weight": 0.3,               # Weight for project budget
    "team_size_weight": 0.2,            # Weight for team size
    "criticality_weight": 0.3,          # Weight for business criticality
    "tech_stack_weight": 0.2,           # Weight for technical complexity
    
    # Budget thresholds in dollars
    "budget_thresholds": {
        "low": 10000,
        "medium": 100000,
        "high": 500000,
        "very_high": 1000000
    },
    
    # Team size thresholds
    "team_size_thresholds": {
        "small": 3,
        "medium": 8,
        "large": 15,
        "very_large": 25
    }
}

# Growth velocity assessment parameters
GROWTH_VELOCITY_FACTORS = {
    "promotion_weight": 0.6,            # Weight for promotion history
    "skill_acquisition_weight": 0.4,    # Weight for new skill acquisition
    
    # Time normalization factors (in months)
    "expected_promotion_interval": 24,  # Expected time between promotions
    "baseline_tenure": 6                # Minimum tenure to assess growth
}

# Cognitive load adaptability parameters
COGNITIVE_LOAD_FACTORS = {
    "intensity_weight": 0.5,            # Weight for job intensity
    "multitasking_weight": 0.3,         # Weight for project juggling ability
    "complexity_handling_weight": 0.2   # Weight for complexity of tasks handled
}

# --- MongoDB Connection ---
client = None
active_dbs = {}  # Dictionary to store active database connections
model = None

def connect_db():
    """Connect to MongoDB and identify all available company databases"""
    global client, active_dbs
    max_retries = 3
    retry_count = 0
    retry_delay = 5  # seconds
    
    while retry_count < max_retries:
        try:
            if client is None:
                logging.info(f"Connecting to MongoDB at {MONGO_URI}... (attempt {retry_count + 1}/{max_retries})")
                
                # Add options to help with DNS resolution timeouts
                client_options = {
                    "serverSelectionTimeoutMS": 30000,  # 30 seconds
                    "connectTimeoutMS": 30000,
                    "socketTimeoutMS": 45000,
                    "retryWrites": True,
                    "retryReads": True
                }
                
                client = MongoClient(MONGO_URI, **client_options)
                
                # Test connection - this will raise exception if connection fails
                client.admin.command('ismaster')
                logging.info("MongoDB connection successful.")
                
                # Get list of all databases
                refresh_database_list()
                
                # If we got here, connection was successful
                return
                
        except ConnectionFailure as e:
            retry_count += 1
            logging.warning(f"MongoDB connection attempt {retry_count} failed: {e}")
            if retry_count < max_retries:
                logging.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                logging.error(f"MongoDB connection failed after {max_retries} attempts: {e}")
                client = None
                active_dbs = {}
        except Exception as e:
            retry_count += 1
            logging.error(f"An error occurred during DB connection: {e}")
            if retry_count < max_retries:
                logging.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                logging.error(f"Failed to connect after {max_retries} attempts")
                client = None
                active_dbs = {}

def refresh_database_list():
    """Get the list of all databases and update active_dbs dictionary"""
    global client, active_dbs
    
    if not client:
        logging.error("Cannot refresh database list: MongoDB client is not connected")
        return
        
    try:
        # Get list of all database names
        db_list = client.list_database_names()
        
        # Filter out system databases and auth_db
        db_list = [db_name for db_name in db_list 
                   if db_name not in ['admin', 'local', 'config', 'auth', 'auth_db']]
        
        logging.info(f"Found {len(db_list)} databases: {', '.join(db_list)}")
        
        # Update active_dbs dictionary
        for db_name in db_list:
            if db_name not in active_dbs:
                db = client[db_name]
                # Check if the required collections exist
                collections = db.list_collection_names()
                # For each database, we'll process entries as long as it has a users collection
                if USERS_COLLECTION in collections:
                    active_dbs[db_name] = db
                    # Ensure indexes for faster lookups
                    db[USERS_COLLECTION].create_index("email", unique=True)
                    logging.info(f"Added database {db_name} to active databases")
                else:
                    logging.info(f"Skipping database {db_name}: No {USERS_COLLECTION} collection")
        
        logging.info(f"Active databases for processing: {len(active_dbs)}")
    except Exception as e:
        logging.error(f"Error refreshing database list: {e}")

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

# --- Search and Data Retrieval Functions ---
def find_employee(search_term: str, db_name: str = None) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Find an employee by email only for 100% match accuracy
    
    Args:
        search_term: Email to search for
        db_name: Optional database name to search in (if known)
        
    Returns:
        Tuple of (employee document or None if not found, database name where found)
    """
    global active_dbs
    
    if not active_dbs:
        logging.error("No active databases available")
        return None, None
    
    if not search_term or not isinstance(search_term, str):
        logging.error("Invalid search term provided")
        return None, None
        
    search_term = search_term.strip().lower()
    
    # Only search by exact email match for 100% accuracy
    if '@' in search_term and '.' in search_term.split('@')[1]:
        query = {"email": search_term}
        
        # If db_name is specified, only check that database
        dbs_to_check = {db_name: active_dbs[db_name]} if db_name and db_name in active_dbs else active_dbs
        
        for current_db_name, db in dbs_to_check.items():
            # Search in users collection
            employee = db[USERS_COLLECTION].find_one(query)
        
        if employee:
                logging.info(f"Found employee: {employee.get('email')} in database {current_db_name}")
                return employee, current_db_name
    
    logging.info(f"No employee found for email: {search_term}")
    return None, None

def get_all_potential_successors(exclude_email: str = None, db_name: str = None) -> List[Dict[str, Any]]:
    """
    Get all employees who could potentially be successors within the same database/company
    
    Args:
        exclude_email: Email of employee to exclude (the one being replaced)
        db_name: Database name to search in (must be specified for multi-tenancy)
        
    Returns:
        List of employee documents
    """
    global active_dbs
    
    if not active_dbs:
        logging.error("No active databases available")
        return []
    
    if not db_name or db_name not in active_dbs:
        logging.error(f"Invalid database name: {db_name}")
        return []
    
    db = active_dbs[db_name]
    
    # Get all employees from users collection
    query = {}
    if exclude_email:
        query["email"] = {"$ne": exclude_email}
    
    # We want only employees who have the necessary data points
    # At minimum, they should have job duties and tools data
    query["$and"] = [
        {"$or": [{"jobDuties": {"$exists": True}}, {"jobResponsibilities": {"$exists": True}}]},
        {"toolsProficient": {"$exists": True}}
    ]
    
    # Project only the fields we need
    projection = {
        "email": 1,
        "firstName": 1,
        "lastName": 1,
        "fullName": 1,
        "jobTitle": 1,
        "role": 1,
        "jobDuties": 1,
        "jobResponsibilities": 1,
        "toolsProficient": 1,
        "projects": 1,
        "timeWithCompany": 1,
        "timeInCurrentRole": 1,
        "timeWithCompanyMonths": 1, 
        "timeInCurrentRoleMonths": 1,
        "utilizationAssessment": 1,
        "attritionAssessment": 1,
        "job_intensity_analysis": 1,
        "salaryHistory": 1,
        "performanceReviews": 1,
        "careeerProgression": 1, # Typo in the field name is preserved
        "careerPath": 1
    }
    
    cursor = db[USERS_COLLECTION].find(query, projection)
    employees = list(cursor)
    
    logging.info(f"Found {len(employees)} potential successor candidates in {db_name}.{USERS_COLLECTION}")
    return employees

def parse_time_expression(time_str: str) -> Dict[str, Any]:
    """
    Parse time expressions like "3 years 4 months" or "6 months" into numerical values
    Returns dict with total_months, years, and months
    """
    if not time_str or not isinstance(time_str, str):
        return {"total_months": 0, "years": 0, "months": 0}
    
    time_str = time_str.lower().strip()
    
    # Initialize values
    years = 0
    months = 0
    
    # Extract years
    year_match = re.search(r'(\d+)\s*(?:year|years|yr|yrs)', time_str)
    if year_match:
        years = int(year_match.group(1))
    
    # Extract months
    month_match = re.search(r'(\d+)\s*(?:month|months|mo|mos)', time_str)
    if month_match:
        months = int(month_match.group(1))
    
    # Calculate total months
    total_months = (years * 12) + months
    
    return {
        "total_months": total_months,
        "years": years,
        "months": months
    }

def get_normalized_time_values(employee: Dict[str, Any]) -> Tuple[int, int]:
    """
    Get normalized time with company and time in role values in months
    
    Args:
        employee: Employee document
        
    Returns:
        Tuple of (time_with_company_months, time_in_role_months)
    """
    # Get time with company
    company_months = 0
    time_with_company = employee.get("timeWithCompany", "")
    if time_with_company:
        if isinstance(time_with_company, str):
            parsed_time = parse_time_expression(time_with_company)
            company_months = parsed_time["total_months"]
        elif isinstance(time_with_company, int):
            company_months = time_with_company
        elif isinstance(time_with_company, dict) and "total_months" in time_with_company:
            company_months = time_with_company["total_months"]
    
    # Also check for the numeric field
    company_months_numeric = employee.get("timeWithCompanyMonths", 0)
    if company_months_numeric > 0:
        company_months = company_months_numeric
    
    # Get time in current role
    role_months = 0
    time_in_role = employee.get("timeInCurrentRole", "")
    if time_in_role:
        if isinstance(time_in_role, str):
            parsed_time = parse_time_expression(time_in_role)
            role_months = parsed_time["total_months"]
        elif isinstance(time_in_role, int):
            role_months = time_in_role
        elif isinstance(time_in_role, dict) and "total_months" in time_in_role:
            role_months = time_in_role["total_months"]
    
    # Also check for the numeric field
    role_months_numeric = employee.get("timeInCurrentRoleMonths", 0)
    if role_months_numeric > 0:
        role_months = role_months_numeric
    
    return company_months, role_months 

# --- Successor Factor Calculation Functions ---
def calculate_stability_index(employee: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate stability index based on attrition risk assessment
    
    Args:
        employee: Employee document
        
    Returns:
        Dictionary with stability score and explanation
    """
    # Get attrition assessment
    attrition_assessment = employee.get("attritionAssessment", {})
    
    if not attrition_assessment:
        # If no attrition assessment, assume moderate risk
        return {
            "stability_score": 0.5,
            "confidence": 0.3,
            "explanation": "No attrition assessment data available"
        }
    
    # Extract attrition score
    attrition_score = attrition_assessment.get("attrition_score", 0.5)
    
    # Primary risk factors
    primary_risk_factors = attrition_assessment.get("primary_risk_factors", [])
    
    # Calculate stability index (inverse of attrition risk)
    # We use a sigmoid transformation to emphasize differences around the middle
    raw_stability = 1.0 - attrition_score
    
    # Apply sigmoid function to accentuate differences in the middle range
    # Formula: 1 / (1 + e^(-10*(x-0.5)))
    sigmoid_stability = 1.0 / (1.0 + math.exp(-10 * (raw_stability - 0.5)))
    
    # Normalize to 0-1 scale
    normalized_stability = sigmoid_stability
    
    # Determine confidence level based on attrition assessment data quality
    confidence = attrition_assessment.get("confidence_score", 0.5)
    if not confidence:
        # Estimate confidence based on available data
        if "factor_scores" in attrition_assessment and len(attrition_assessment["factor_scores"]) >= 6:
            confidence = 0.8
        elif "factor_scores" in attrition_assessment:
            confidence = 0.6
        else:
            confidence = 0.4
    
    # Generate explanation
    if normalized_stability >= 0.8:
        explanation = "Very high stability - low attrition risk"
    elif normalized_stability >= 0.6:
        explanation = "Good stability - below average attrition risk"
    elif normalized_stability >= 0.4:
        explanation = "Moderate stability - average attrition risk"
    elif normalized_stability >= 0.2:
        explanation = "Below average stability - elevated attrition risk"
    else:
        explanation = "Low stability - high attrition risk"
    
    # Add primary risk factors to explanation if available
    if primary_risk_factors:
        top_factor = primary_risk_factors[0]
        factor_name = top_factor.get("factor", "unknown")
        factor_explanation = top_factor.get("explanation", "")
        
        if factor_explanation:
            explanation += f". Primary concern: {factor_explanation}"
    
    return {
        "stability_score": normalized_stability,
        "raw_stability": raw_stability,
        "confidence": confidence,
        "explanation": explanation
    }

def calculate_competency_similarity(
    incumbent: Dict[str, Any],
    candidate: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Calculate similarity between incumbent and candidate competencies
    Enhanced with advanced mathematical modeling for better successor matching
    
    Args:
        incumbent: Incumbent employee document
        candidate: Candidate employee document
        
    Returns:
        Dictionary with similarity score and explanation
    """
    if model is None:
        logging.error("Sentence transformer model not loaded")
        return {
            "similarity_score": 0.0,
            "confidence": 0.0,
            "explanation": "Model not loaded for competency analysis"
        }
    
    # --- Extract skill indicators ---
    # 1. Tools proficiency with importance weighting
    incumbent_tools = incumbent.get("toolsProficient", [])
    candidate_tools = candidate.get("toolsProficient", [])
    
    # Convert to lists if strings
    if isinstance(incumbent_tools, str):
        incumbent_tools = [t.strip().lower() for t in incumbent_tools.split(',')]
    elif isinstance(incumbent_tools, list):
        incumbent_tools = [t.strip().lower() if isinstance(t, str) else t.get('name', '').lower() 
                          for t in incumbent_tools if t]
    
    if isinstance(candidate_tools, str):
        candidate_tools = [t.strip().lower() for t in candidate_tools.split(',')]
    elif isinstance(candidate_tools, list):
        candidate_tools = [t.strip().lower() if isinstance(t, str) else t.get('name', '').lower() 
                          for t in candidate_tools if t]
    
    # 2. Job duties/responsibilities with importance weighting
    incumbent_duties = incumbent.get("jobDuties", []) or incumbent.get("jobResponsibilities", [])
    candidate_duties = candidate.get("jobDuties", []) or candidate.get("jobResponsibilities", [])
    
    # Extract duty descriptions and hours (for weighting)
    incumbent_duty_texts = []
    incumbent_duty_weights = []
    
    if incumbent_duties:
        for duty in incumbent_duties:
            if isinstance(duty, dict):
                duty_text = duty.get("duty", "") or duty.get("description", "")
                # Get hours as weight (default to 1.0 if not available)
                duty_hours = float(duty.get("hours", 1.0)) if duty.get("hours") is not None else 1.0
                if duty_text:
                    incumbent_duty_texts.append(duty_text)
                    incumbent_duty_weights.append(duty_hours)
            elif isinstance(duty, str):
                incumbent_duty_texts.append(duty)
                incumbent_duty_weights.append(1.0)  # Default weight
    
    # Normalize incumbent duty weights
    if incumbent_duty_weights:
        total_weight = sum(incumbent_duty_weights)
        if total_weight > 0:
            incumbent_duty_weights = [w/total_weight for w in incumbent_duty_weights]
        else:
            incumbent_duty_weights = [1.0/len(incumbent_duty_weights)] * len(incumbent_duty_weights)
    
    candidate_duty_texts = []
    if candidate_duties:
        for duty in candidate_duties:
            if isinstance(duty, dict):
                duty_text = duty.get("duty", "") or duty.get("description", "")
                if duty_text:
                    candidate_duty_texts.append(duty_text)
            elif isinstance(duty, str):
                candidate_duty_texts.append(duty)
    
    # 3. Project technologies with recency weighting
    incumbent_project_techs = []
    incumbent_project_weights = []
    
    if "projects" in incumbent:
        projects = incumbent.get("projects", [])
        # Sort projects by date if available (most recent first)
        sorted_projects = sorted(projects, 
                                key=lambda p: p.get("end_date", "2099-12-31") 
                                if isinstance(p, dict) else "2099-12-31", 
                                reverse=True)
        
        for i, project in enumerate(sorted_projects):
            if isinstance(project, dict):
                tech_stack = project.get("tech_stack", [])
                if tech_stack:
                    # Apply recency weight - more recent projects have higher weight
                    recency_weight = 1.0 / (1.0 + (0.2 * i))  # Decay factor
                    
                    if isinstance(tech_stack, list):
                        incumbent_project_techs.extend([t.lower() if isinstance(t, str) else str(t).lower() 
                                                     for t in tech_stack if t])
                        incumbent_project_weights.extend([recency_weight] * len(tech_stack))
                    elif isinstance(tech_stack, str):
                        techs = [t.strip().lower() for t in tech_stack.split(',') if t.strip()]
                        incumbent_project_techs.extend(techs)
                        incumbent_project_weights.extend([recency_weight] * len(techs))
    
    candidate_project_techs = []
    if "projects" in candidate:
        for project in candidate.get("projects", []):
            if isinstance(project, dict):
                tech_stack = project.get("tech_stack", [])
                if tech_stack:
                    if isinstance(tech_stack, list):
                        candidate_project_techs.extend([t.lower() if isinstance(t, str) else str(t).lower() 
                                                     for t in tech_stack if t])
                    elif isinstance(tech_stack, str):
                        candidate_project_techs.extend([t.strip().lower() for t in tech_stack.split(',') if t.strip()])
    
    # --- Calculate similarity scores with advanced mathematical modeling ---
    # 1. Tools similarity using weighted Jaccard similarity
    tools_similarity = 0.0
    if incumbent_tools and candidate_tools:
        # Create sets for comparison
        incumbent_tool_set = set(incumbent_tools)
        candidate_tool_set = set(candidate_tools)
        
        # Calculate intersection and union
        shared_tools = incumbent_tool_set.intersection(candidate_tool_set)
        all_tools = incumbent_tool_set.union(candidate_tool_set)
        
        # Apply Jaccard similarity with importance weighting
        if all_tools:
            # Base Jaccard similarity
            tools_similarity = len(shared_tools) / len(all_tools)
            
            # Apply sigmoid transformation to emphasize higher similarities
            # Sigmoid: 1/(1+e^(-10*(x-0.5)))
            tools_similarity = 1.0 / (1.0 + math.exp(-10 * (tools_similarity - 0.5)))
    
    # 2. Job duties similarity using weighted sentence transformers
    duties_similarity = 0.0
    if incumbent_duty_texts and candidate_duty_texts:
        # Get embeddings for all duty texts
        incumbent_duty_embeddings = model.encode(incumbent_duty_texts)
        candidate_duty_embeddings = model.encode(candidate_duty_texts)
        
        # Calculate cosine similarity between each pair
        similarity_matrix = cosine_similarity(incumbent_duty_embeddings, candidate_duty_embeddings)
        
        # Get the weighted average of the best match for each incumbent duty
        best_matches = np.max(similarity_matrix, axis=1)
        
        # Apply weights to best matches
        if len(best_matches) == len(incumbent_duty_weights):
            duties_similarity = float(np.sum(best_matches * np.array(incumbent_duty_weights)))
        else:
            duties_similarity = float(np.mean(best_matches))
    
    # 3. Project tech similarity using weighted overlap
    project_tech_similarity = 0.0
    if incumbent_project_techs and candidate_project_techs:
        # Create weighted frequency dictionaries
        incumbent_tech_freq = {}
        for tech, weight in zip(incumbent_project_techs, incumbent_project_weights) if incumbent_project_weights else [(t, 1.0) for t in incumbent_project_techs]:
            incumbent_tech_freq[tech] = incumbent_tech_freq.get(tech, 0) + weight
            
        candidate_tech_freq = {}
        for tech in candidate_project_techs:
            candidate_tech_freq[tech] = candidate_tech_freq.get(tech, 0) + 1.0
        
        # Calculate weighted similarity
        shared_weight = 0.0
        for tech, weight in incumbent_tech_freq.items():
            if tech in candidate_tech_freq:
                shared_weight += min(weight, candidate_tech_freq[tech])
                
        total_weight = sum(incumbent_tech_freq.values())
        if total_weight > 0:
            project_tech_similarity = shared_weight / total_weight
    
    # Weight the different similarity scores with optimized weights
    # Tools and duties are most critical for succession planning
    weighted_similarity = (
        (0.45 * tools_similarity) +       # Increased weight for tools
        (0.40 * duties_similarity) +      # High weight for duties
        (0.15 * project_tech_similarity)  # Reduced weight for project tech
    )
    
    # Apply a double sigmoid transformation to create clear separation between good and poor matches
    # Formula: 1 / (1 + e^(-12*(x-0.5)))
    normalized_similarity = 1.0 / (1.0 + math.exp(-12 * (weighted_similarity - 0.5)))
    
    # Determine confidence level based on data quality
    confidence = 0.5
    if len(incumbent_tools) >= 3 and len(candidate_tools) >= 3:
        confidence += 0.2
    if len(incumbent_duty_texts) >= 2 and len(candidate_duty_texts) >= 2:
        confidence += 0.2
    if len(incumbent_project_techs) >= 3 and len(candidate_project_techs) >= 3:
        confidence += 0.1
    
    # Generate explanation
    shared_tools_list = list(set(incumbent_tools) & set(candidate_tools))
    shared_tools_str = ", ".join(shared_tools_list[:5])
    if len(shared_tools_list) > 5:
        shared_tools_str += f", and {len(shared_tools_list) - 5} more"
    
    if normalized_similarity >= 0.85:
        explanation = f"Exceptional competency match. Shared tools include: {shared_tools_str}"
    elif normalized_similarity >= 0.7:
        explanation = f"Very strong competency similarity. Key shared tools: {shared_tools_str}"
    elif normalized_similarity >= 0.5:
        explanation = f"Good skill overlap. Some shared tools: {shared_tools_str}"
    elif normalized_similarity >= 0.3:
        explanation = "Limited skill overlap, but some transferable competencies"
    else:
        explanation = "Minimal competency overlap, significant skill gaps exist"
    
    return {
        "similarity_score": normalized_similarity,
        "raw_similarity": weighted_similarity,
        "tools_similarity": tools_similarity,
        "duties_similarity": duties_similarity,
        "tech_similarity": project_tech_similarity,
        "shared_tools": shared_tools_list,
        "confidence": confidence,
        "explanation": explanation
    }

def calculate_project_complexity_exposure(employee: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate project complexity exposure score
    
    Args:
        employee: Employee document
        
    Returns:
        Dictionary with complexity score and explanation
    """
    projects = employee.get("projects", [])
    
    if not projects:
        return {
            "complexity_score": 0.3,  # Default to below average
            "confidence": 0.2,
            "explanation": "No project data available"
        }
    
    # Extract complexity indicators from projects
    active_projects = []
    for project in projects:
        if not isinstance(project, dict):
            continue
            
        # Check if project is active
        status = project.get("project_status", "").lower()
        if status in ["active", "in progress", "ongoing"]:
            active_projects.append(project)
    
    # If no active projects, use all projects but with reduced weight
    target_projects = active_projects if active_projects else projects
    
    # Calculate complexity for each project
    project_complexities = []
    for project in target_projects:
        # 1. Budget complexity (logarithmic scale)
        budget = project.get("budget", 0)
        if isinstance(budget, str):
            # Try to extract numeric value from string like "$100,000"
            budget_str = re.sub(r'[^\d.]', '', budget)
            budget = float(budget_str) if budget_str else 0
        
        # Apply logarithmic scaling to budget
        # log10(budget) / log10(1 million) gives a score between 0-1
        if budget > 0:
            budget_score = min(1.0, math.log10(budget) / math.log10(PROJECT_COMPLEXITY_FACTORS["budget_thresholds"]["very_high"]))
        else:
            budget_score = 0.0
        
        # 2. Team size complexity
        team_size = project.get("team_size", 0)
        if team_size > 0:
            # Scale team size between 0-1
            if team_size >= PROJECT_COMPLEXITY_FACTORS["team_size_thresholds"]["very_large"]:
                team_size_score = 1.0
            elif team_size >= PROJECT_COMPLEXITY_FACTORS["team_size_thresholds"]["large"]:
                team_size_score = 0.75
            elif team_size >= PROJECT_COMPLEXITY_FACTORS["team_size_thresholds"]["medium"]:
                team_size_score = 0.5
            elif team_size >= PROJECT_COMPLEXITY_FACTORS["team_size_thresholds"]["small"]:
                team_size_score = 0.25
            else:
                team_size_score = 0.1
        else:
            team_size_score = 0.0
        
        # 3. Project criticality
        priority = project.get("priority", "").lower()
        if priority in ["critical", "highest", "urgent"]:
            criticality_score = 1.0
        elif priority in ["high", "important"]:
            criticality_score = 0.75
        elif priority in ["medium", "normal"]:
            criticality_score = 0.5
        elif priority in ["low"]:
            criticality_score = 0.25
        else:
            criticality_score = 0.5  # Default to medium if not specified
        
        # 4. Technical complexity based on tech stack
        tech_stack = project.get("tech_stack", [])
        if isinstance(tech_stack, str):
            tech_stack = [t.strip() for t in tech_stack.split(',')]
        
        tech_complexity_score = min(1.0, len(tech_stack) / 10)  # Scale based on number of technologies
        
        # 5. Role in project
        user_contribution = project.get("user_contribution", {})
        role_in_project = ""
        if isinstance(user_contribution, dict):
            role_in_project = user_contribution.get("role_in_project", "").lower()
        
        # Apply role multiplier
        role_multiplier = 1.0
        if role_in_project in ["lead", "project lead", "manager", "team lead"]:
            role_multiplier = 1.5
        elif role_in_project in ["architect", "tech lead", "technical lead"]:
            role_multiplier = 1.3
        elif role_in_project in ["senior", "senior developer"]:
            role_multiplier = 1.2
        
        # Calculate weighted project complexity
        project_complexity = (
            (PROJECT_COMPLEXITY_FACTORS["budget_weight"] * budget_score) +
            (PROJECT_COMPLEXITY_FACTORS["team_size_weight"] * team_size_score) +
            (PROJECT_COMPLEXITY_FACTORS["criticality_weight"] * criticality_score) +
            (PROJECT_COMPLEXITY_FACTORS["tech_stack_weight"] * tech_complexity_score)
        ) * role_multiplier
        
        project_complexities.append({
            "project_name": project.get("project_name", "Unnamed project"),
            "complexity_score": project_complexity,
            "budget_score": budget_score,
            "team_size_score": team_size_score,
            "criticality_score": criticality_score,
            "tech_complexity_score": tech_complexity_score,
            "role_multiplier": role_multiplier
        })
    
    # Calculate overall complexity score
    # We use the ELO rating system approach: highest complexity has most weight,
    # but we also consider breadth with diminishing returns
    if project_complexities:
        # Sort by complexity score in descending order
        project_complexities.sort(key=lambda x: x["complexity_score"], reverse=True)
        
        # Highest complexity project gets full weight
        highest_complexity = project_complexities[0]["complexity_score"]
        
        # Apply logarithmic scaling for additional projects
        # Formula: highest_score + log_base(1 + additional_projects) * scaling_factor
        # This ensures that having more complex projects helps, but with diminishing returns
        log_base = 2
        scaling_factor = 0.2
        additional_projects_factor = math.log(1 + len(project_complexities) - 1, log_base) * scaling_factor
        
        # Cap the additional factor to ensure it doesn't exceed 1.0 when combined with highest_complexity
        max_additional = min(additional_projects_factor, 1.0 - highest_complexity)
        
        # Final score combines highest complexity with the additional projects factor
        overall_complexity = min(1.0, highest_complexity + max_additional)
    else:
        overall_complexity = 0.0
    
    # Generate explanation
    if len(project_complexities) > 0:
        top_project = project_complexities[0]
        project_name = top_project["project_name"]
        
        if overall_complexity >= 0.8:
            explanation = f"Very high project complexity exposure. Most complex: {project_name}"
        elif overall_complexity >= 0.6:
            explanation = f"High project complexity. Key project: {project_name}"
        elif overall_complexity >= 0.4:
            explanation = f"Moderate project complexity. Notable project: {project_name}"
        else:
            explanation = f"Lower project complexity. Primary project: {project_name}"
        
        if len(project_complexities) > 1:
            explanation += f" plus {len(project_complexities) - 1} other projects"
    else:
        explanation = "No project complexity data available"
    
    # Calculate confidence based on data quality
    confidence = min(0.9, 0.3 + (0.1 * len(project_complexities)))
    
    return {
        "complexity_score": overall_complexity,
        "project_count": len(project_complexities),
        "project_details": project_complexities[:3],  # Only include top 3 for brevity
        "confidence": confidence,
        "explanation": explanation
    }

def calculate_cognitive_load_adaptability(employee: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate cognitive load adaptability score
    
    Args:
        employee: Employee document
        
    Returns:
        Dictionary with adaptability score and explanation
    """
    # Get job intensity analysis
    job_intensity = employee.get("job_intensity_analysis", {})
    
    # Get utilization assessment
    utilization = employee.get("utilizationAssessment", {})
    
    # Default values if data missing
    intensity_score = 0.5
    multitasking_score = 0.5
    complexity_handling_score = 0.5
    
    # --- 1. Job intensity component ---
    if job_intensity:
        # Extract weighted intensity measure
        weighted_intensity = job_intensity.get("weighted_intensity", 0.5)
        adjusted_intensity = job_intensity.get("adjusted_intensity", weighted_intensity)
        
        # Use the adjusted intensity which accounts for workload factor
        intensity_score = adjusted_intensity
        
        # Adjust intensity to adaptability: 
        # High intensity doesn't always mean high adaptability
        # We want to find the sweet spot - too low means unchallenged,
        # too high means potentially overwhelmed
        #
        # Optimal intensity is around 0.7 for adaptability
        optimal_intensity = 0.7
        
        # Apply a Gaussian-like function centered at optimal_intensity
        # Formula: exp(-0.5 * ((x - optimal) / width)^2)
        width = 0.3
        intensity_adaptability = math.exp(-0.5 * ((intensity_score - optimal_intensity) / width) ** 2)
    else:
        intensity_adaptability = 0.5  # Default if no data
    
    # --- 2. Multitasking ability component ---
    projects = employee.get("projects", [])
    active_project_count = 0
    
    if projects:
        # Count active projects
        for project in projects:
            if isinstance(project, dict):
                status = project.get("project_status", "").lower()
                if status in ["active", "in progress", "ongoing"]:
                    active_project_count += 1
        
        # Calculate multitasking score based on active projects
        # Use logarithmic scaling: log_base(1 + active_count) / log_base(1 + max_optimal)
        # This creates a score that rises quickly for first few projects then levels off
        log_base = 2
        max_optimal_projects = 5  # Considered excellent multitasking
        
        multitasking_score = min(1.0, math.log(1 + active_project_count, log_base) / 
                               math.log(1 + max_optimal_projects, log_base))
    
    # --- 3. Complexity handling component ---
    if utilization:
        # Check responsibility breadth analysis
        responsibility_analysis = utilization.get("responsibility_breadth_analysis", {})
        
        if responsibility_analysis:
            # Extract complexity handling indicators
            
            # Check if handling responsibilities above level
            breadth_gap = responsibility_analysis.get("breadth_gap", 0)
            
            # Get role distribution
            role_distribution = responsibility_analysis.get("role_distribution", {})
            
            # Calculate complexity handling score
            if breadth_gap > 0.2:
                # Significantly above expected level - strong indicator
                complexity_base = 0.8
            elif breadth_gap > 0.1:
                # Moderately above expected level
                complexity_base = 0.7
            elif breadth_gap > 0:
                # Slightly above expected level
                complexity_base = 0.6
            elif breadth_gap > -0.1:
                # At expected level
                complexity_base = 0.5
            else:
                # Below expected level
                complexity_base = 0.4
            
            # Adjust based on specific indicators
            # Technical leadership and management responsibilities correlate with complexity handling
            tech_leadership = role_distribution.get("technical_leadership", 0)
            management = role_distribution.get("management", 0)
            
            # Technical leadership is a stronger indicator of complexity handling
            leadership_adjustment = (tech_leadership * 0.3) + (management * 0.2)
            
            # Combine base and adjustment
            complexity_handling_score = min(1.0, complexity_base + leadership_adjustment)
        else:
            # If no responsibility analysis, use project complexity as a proxy
            project_complexity = calculate_project_complexity_exposure(employee)
            complexity_handling_score = project_complexity.get("complexity_score", 0.5)
    
    # --- Combine all components into final score ---
    cognitive_load_adaptability = (
        (COGNITIVE_LOAD_FACTORS["intensity_weight"] * intensity_adaptability) +
        (COGNITIVE_LOAD_FACTORS["multitasking_weight"] * multitasking_score) +
        (COGNITIVE_LOAD_FACTORS["complexity_handling_weight"] * complexity_handling_score)
    )
    
    # Generate explanation
    if cognitive_load_adaptability >= 0.8:
        explanation = "Excellent ability to handle complex cognitive demands"
    elif cognitive_load_adaptability >= 0.6:
        explanation = "Good cognitive load adaptability"
    elif cognitive_load_adaptability >= 0.4:
        explanation = "Moderate cognitive adaptability"
    else:
        explanation = "Limited evidence of handling complex cognitive loads"
    
    # Add details to explanation
    if active_project_count > 0:
        explanation += f", managing {active_project_count} active projects"
    
    # Calculate confidence
    confidence = 0.3  # Base confidence
    if job_intensity:
        confidence += 0.2
    if projects:
        confidence += 0.2
    if utilization and "responsibility_breadth_analysis" in utilization:
        confidence += 0.2
    
    return {
        "adaptability_score": cognitive_load_adaptability,
        "intensity_component": intensity_adaptability,
        "multitasking_component": multitasking_score,
        "complexity_handling_component": complexity_handling_score,
        "active_projects": active_project_count,
        "confidence": confidence,
        "explanation": explanation
    } 

def calculate_promotion_velocity(employee: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate promotion velocity (growth momentum) score
    
    Args:
        employee: Employee document
        
    Returns:
        Dictionary with velocity score and explanation
    """
    # Extract career progression data
    career_progression = employee.get("careeerProgression", [])  # Note: field has typo in DB
    if not career_progression:
        career_progression = employee.get("careerPath", [])
    
    # Get current time values
    company_months, role_months = get_normalized_time_values(employee)
    
    # Default values
    promotion_frequency = 0.0
    skill_acquisition_rate = 0.0
    velocity_score = 0.0
    
    # --- 1. Promotion Frequency Component ---
    if career_progression and isinstance(career_progression, list) and len(career_progression) > 1:
        # Sort career progression by date if available
        try:
            sorted_progression = sorted(
                career_progression, 
                key=lambda x: x.get("date", "0000-00-00"),
                reverse=False
            )
            
            # Calculate average time between promotions
            promotion_count = len(sorted_progression) - 1  # Transitions, not positions
            first_date = sorted_progression[0].get("date", "")
            last_date = sorted_progression[-1].get("date", "")
            
            if first_date and last_date and promotion_count > 0:
                try:
                    # Parse dates
                    first_datetime = datetime.strptime(first_date, "%Y-%m-%d")
                    last_datetime = datetime.strptime(last_date, "%Y-%m-%d")
                    
                    # Calculate months between first and last position
                    total_months = ((last_datetime.year - first_datetime.year) * 12 + 
                                   last_datetime.month - first_datetime.month)
                    
                    # Calculate average months per promotion
                    avg_months_per_promotion = total_months / promotion_count
                    
                    # Calculate promotion frequency (ideal is one promotion every 24 months)
                    # Higher is better, but we cap at 2x the expected rate
                    expected_interval = GROWTH_VELOCITY_FACTORS["expected_promotion_interval"]
                    promotion_frequency = min(2.0, expected_interval / max(1, avg_months_per_promotion))
                except Exception as e:
                    logging.error(f"Error calculating promotion dates: {e}")
                    promotion_frequency = 0.5  # Default on error
            else:
                # Calculate based on company tenure and promotion count
                if company_months > 0 and promotion_count > 0:
                    avg_months_per_promotion = company_months / promotion_count
                    expected_interval = GROWTH_VELOCITY_FACTORS["expected_promotion_interval"]
                    promotion_frequency = min(2.0, expected_interval / max(1, avg_months_per_promotion))
        except Exception as e:
            logging.error(f"Error processing career progression: {e}")
            promotion_frequency = 0.5  # Default on error
    else:
        # If no career progression data, estimate based on role and company tenure
        baseline_tenure = GROWTH_VELOCITY_FACTORS["baseline_tenure"]
        
        if company_months > baseline_tenure and role_months > 0:
            # Candidate has been at company for a while but relatively new in role
            # This suggests a recent promotion
            if role_months < 12 and company_months > 24:
                promotion_frequency = 0.7  # Recently promoted
            elif role_months < 18 and company_months > 36:
                promotion_frequency = 0.6  # Promoted within 18 months
            else:
                # Estimate based on ratio of role tenure to company tenure
                # Lower ratio suggests more promotions
                ratio = role_months / max(1, company_months)
                if ratio < 0.3:
                    promotion_frequency = 0.8  # Multiple promotions likely
                elif ratio < 0.5:
                    promotion_frequency = 0.6  # Some promotions likely
                else:
                    promotion_frequency = 0.4  # Fewer promotions
        else:
            # Not enough tenure to assess
            promotion_frequency = 0.5  # Default to average
    
    # --- 2. Skill Acquisition Rate Component ---
    # Check for growth in tools and responsibilities
    tools_proficient = employee.get("toolsProficient", [])
    if isinstance(tools_proficient, str):
        tools_proficient = [t.strip() for t in tools_proficient.split(',')]
    
    tool_count = len(tools_proficient) if tools_proficient else 0
    
    # Calculate skill acquisition rate
    if company_months > 0 and tool_count > 0:
        # Tools per year of tenure, normalized to 0-1 scale
        # Assumes 8 tools in 2 years (4 per year) is excellent acquisition rate
        tools_per_year = (tool_count * 12) / max(1, company_months)
        skill_acquisition_rate = min(1.0, tools_per_year / 4)
    else:
        skill_acquisition_rate = 0.5  # Default to average
    
    # --- Combine components into final velocity score ---
    velocity_score = (
        (GROWTH_VELOCITY_FACTORS["promotion_weight"] * promotion_frequency) +
        (GROWTH_VELOCITY_FACTORS["skill_acquisition_weight"] * skill_acquisition_rate)
    )
    
    # Normalize to 0-1 scale
    velocity_score = min(1.0, velocity_score)
    
    # Generate explanation
    if velocity_score >= 0.8:
        explanation = "Exceptional growth momentum"
    elif velocity_score >= 0.6:
        explanation = "Strong growth trajectory"
    elif velocity_score >= 0.4:
        explanation = "Moderate career progression"
    else:
        explanation = "Limited evidence of career acceleration"
    
    # Add details to explanation
    if tool_count > 0:
        explanation += f", mastered {tool_count} tools"
    if promotion_frequency > 0.7:
        explanation += ", history of rapid advancement"
    
    # Calculate confidence
    confidence = 0.3  # Base confidence
    if career_progression and len(career_progression) > 1:
        confidence += 0.3
    if tools_proficient:
        confidence += 0.2
    if company_months > 24:  # More than 2 years of data
        confidence += 0.1
    
    return {
        "velocity_score": velocity_score,
        "promotion_component": promotion_frequency,
        "skill_acquisition_component": skill_acquisition_rate,
        "tool_count": tool_count,
        "company_tenure_months": company_months,
        "role_tenure_months": role_months,
        "confidence": confidence,
        "explanation": explanation
    }

def calculate_successor_score(
    incumbent: Dict[str, Any],
    candidate: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Calculate comprehensive successor score based on all factors
    
    Args:
        incumbent: The employee being replaced
        candidate: Potential successor candidate
        
    Returns:
        Dictionary with successor score and detailed analysis
    """
    logging.info(f"Calculating successor score for {candidate.get('email')} as potential successor to {incumbent.get('email')}")
    
    # Calculate all factor scores
    stability = calculate_stability_index(candidate)
    competency = calculate_competency_similarity(incumbent, candidate)
    project_complexity = calculate_project_complexity_exposure(candidate)
    cognitive_load = calculate_cognitive_load_adaptability(candidate)
    promotion_velocity = calculate_promotion_velocity(candidate)
    
    # Extract scores
    stability_score = stability.get("stability_score", 0.5)
    competency_score = competency.get("similarity_score", 0.0)
    complexity_score = project_complexity.get("complexity_score", 0.5)
    cognitive_score = cognitive_load.get("adaptability_score", 0.5)
    velocity_score = promotion_velocity.get("velocity_score", 0.5)
    
    # Check if candidate meets minimum competency threshold
    if competency_score < MIN_COMPETENCY_SIMILARITY:
        # Too little competency overlap to be viable
        viability = "non_viable"
        viability_explanation = f"Insufficient competency overlap ({competency_score:.2f} < {MIN_COMPETENCY_SIMILARITY})"
        
        # Calculate a reduced successor score that emphasizes the competency gap
        successor_score = competency_score * 0.7  # Heavily penalize for insufficient overlap
    else:
        # Calculate weighted successor score
        successor_score = (
            (SUCCESSOR_FACTOR_WEIGHTS["stability_index"] * stability_score) +
            (SUCCESSOR_FACTOR_WEIGHTS["competency_similarity"] * competency_score) +
            (SUCCESSOR_FACTOR_WEIGHTS["project_complexity"] * complexity_score) +
            (SUCCESSOR_FACTOR_WEIGHTS["cognitive_load"] * cognitive_score) +
            (SUCCESSOR_FACTOR_WEIGHTS["promotion_velocity"] * velocity_score)
        )
        
        # Determine viability
        if successor_score >= 0.7:
            viability = "excellent"
            viability_explanation = "Strong match across key successor dimensions"
        elif successor_score >= 0.55:
            viability = "good"
            viability_explanation = "Good potential with development in some areas"
        elif successor_score >= 0.4:
            viability = "possible"
            viability_explanation = "Possible successor with development needs"
        else:
            viability = "weak"
            viability_explanation = "Limited successor potential at this time"
    
    # Identify strengths and development areas
    strengths = []
    development_areas = []
    
    # Stability index
    if stability_score >= 0.7:
        strengths.append({"factor": "stability", "score": stability_score, "description": "Strong retention potential"})
    elif stability_score <= 0.4:
        development_areas.append({"factor": "stability", "score": stability_score, "description": "Retention risk"})
    
    # Competency similarity
    if competency_score >= 0.7:
        strengths.append({"factor": "competency", "score": competency_score, "description": "Strong skill overlap"})
    elif competency_score <= 0.4:
        development_areas.append({"factor": "competency", "score": competency_score, "description": "Limited skill overlap"})
    
    # Project complexity
    if complexity_score >= 0.7:
        strengths.append({"factor": "complexity", "score": complexity_score, "description": "Strong project complexity exposure"})
    elif complexity_score <= 0.4:
        development_areas.append({"factor": "complexity", "score": complexity_score, "description": "Limited exposure to complex projects"})
    
    # Cognitive load
    if cognitive_score >= 0.7:
        strengths.append({"factor": "cognitive", "score": cognitive_score, "description": "Strong cognitive adaptability"})
    elif cognitive_score <= 0.4:
        development_areas.append({"factor": "cognitive", "score": cognitive_score, "description": "Limited evidence of cognitive adaptability"})
    
    # Promotion velocity
    if velocity_score >= 0.7:
        strengths.append({"factor": "velocity", "score": velocity_score, "description": "Strong growth momentum"})
    elif velocity_score <= 0.4:
        development_areas.append({"factor": "velocity", "score": velocity_score, "description": "Limited growth trajectory"})
    
    # Sort strengths and development areas by score (descending for strengths, ascending for development)
    strengths.sort(key=lambda x: x["score"], reverse=True)
    development_areas.sort(key=lambda x: x["score"])
    
    # Calculate overall confidence score (weighted average of individual confidences)
    confidence_weights = {
        "stability": 0.2,
        "competency": 0.3,
        "complexity": 0.15,
        "cognitive": 0.2,
        "velocity": 0.15
    }
    
    confidence_scores = {
        "stability": stability.get("confidence", 0.5),
        "competency": competency.get("confidence", 0.5),
        "complexity": project_complexity.get("confidence", 0.5),
        "cognitive": cognitive_load.get("confidence", 0.5),
        "velocity": promotion_velocity.get("confidence", 0.5)
    }
    
    confidence_score = sum(confidence_weights[factor] * confidence_scores[factor] for factor in confidence_weights)
    
    # Generate summary explanation
    candidate_name = candidate.get("fullName", "") or f"{candidate.get('firstName', '')} {candidate.get('lastName', '')}"
    
    summary = f"{candidate_name} is a {viability} successor candidate ({successor_score:.2f} score). "
    
    if strengths:
        summary += f"Strengths: {strengths[0]['description']}"
        if len(strengths) > 1:
            summary += f" and {strengths[1]['description'].lower()}"
        summary += ". "
    
    if development_areas:
        summary += f"Development needed: {development_areas[0]['description']}"
        if len(development_areas) > 1:
            summary += f" and {development_areas[0]['description'].lower()}"
    
    # Compile results
    result = {
        "candidate_email": candidate.get("email"),
        "candidate_name": candidate_name,
        "incumbent_email": incumbent.get("email"),
        "incumbent_name": incumbent.get("fullName", "") or f"{incumbent.get('firstName', '')} {incumbent.get('lastName', '')}",
        "successor_score": successor_score,
        "viability": viability,
        "viability_explanation": viability_explanation,
        "summary": summary,
        "confidence_score": confidence_score,
        "factor_scores": {
            "stability_index": stability_score,
            "competency_similarity": competency_score,
            "project_complexity": complexity_score,
            "cognitive_load": cognitive_score,
            "promotion_velocity": velocity_score
        },
        "factor_details": {
            "stability_index": stability,
            "competency_similarity": competency,
            "project_complexity": project_complexity,
            "cognitive_load": cognitive_load,
            "promotion_velocity": promotion_velocity
        },
        "strengths": strengths[:3],  # Top 3 strengths
        "development_areas": development_areas[:3]  # Top 3 development areas
    }
    
    return result 

def find_successor_candidates(incumbent: Dict[str, Any], db_name: str = None, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Find and rank successor candidates for a given incumbent
    
    Args:
        incumbent: Employee document of the person being replaced
        db_name: Database name where the incumbent is located
        limit: Maximum number of candidates to return
        
    Returns:
        List of successor candidates with scores, ranked by successor score
    """
    # Get all potential successors, excluding the incumbent
    incumbent_email = incumbent.get("email")
    if not incumbent_email:
        logging.error("Incumbent email not found")
        return []
    
    if not db_name:
        logging.error("Database name must be provided to find successor candidates")
        return []
    
    logging.info(f"Finding successor candidates for {incumbent_email} in database {db_name}")
    
    # Debug incumbent data quality
    incumbent_duties = incumbent.get("jobDuties") or incumbent.get("jobResponsibilities")
    incumbent_tools = incumbent.get("toolsProficient")
    
    if not incumbent_duties:
        logging.warning(f"Incumbent {incumbent_email} has no job duties/responsibilities")
    else:
        logging.info(f"Incumbent {incumbent_email} has {len(incumbent_duties) if isinstance(incumbent_duties, list) else 'some'} job duties")
        
    if not incumbent_tools:
        logging.warning(f"Incumbent {incumbent_email} has no tools proficiency data")
    else:
        logging.info(f"Incumbent {incumbent_email} has tools proficiency data: {incumbent_tools[:100] if isinstance(incumbent_tools, str) else len(incumbent_tools) if isinstance(incumbent_tools, list) else 'available'}")
    
    # Get all potential candidates from the same database
    candidates = get_all_potential_successors(exclude_email=incumbent_email, db_name=db_name)
    if not candidates:
        logging.warning(f"No potential successor candidates found in {db_name}")
        return []
    
    logging.info(f"Found {len(candidates)} potential candidates in {db_name}")
    
    # Calculate successor scores for each candidate
    successor_results = []
    processed_count = 0
    error_count = 0
    
    for candidate in candidates:
        try:
            candidate_email = candidate.get("email", "unknown")
            logging.info(f"Calculating successor score for candidate: {candidate_email}")
            
            successor_score = calculate_successor_score(incumbent, candidate)
            successor_results.append(successor_score)
            processed_count += 1
            
            if processed_count % 5 == 0:
                logging.info(f"Processed {processed_count}/{len(candidates)} candidates")
                
        except Exception as e:
            error_count += 1
            logging.error(f"Error calculating successor score for {candidate.get('email', 'unknown')}: {str(e)}")
            # Log the exception traceback for better debugging
            import traceback
            logging.error(traceback.format_exc())
    
    # Sort by successor score (descending)
    successor_results.sort(key=lambda x: x["successor_score"], reverse=True)
    
    logging.info(f"Completed successor analysis: {len(successor_results)} valid candidates found, {error_count} errors")
    
    # Return top candidates
    return successor_results[:limit]

def process_single_document(email: str, db_name: str = None) -> Optional[Dict[str, Any]]:
    """
    Process successor analysis for a single document by email
    
    Args:
        email: Email of the employee to analyze
        db_name: Optional database name to search in
    
    Returns:
        Successor analysis result or None if processing failed
    """
    global active_dbs
    
    if not active_dbs:
        logging.error("No active databases available")
        return None
    
    # Find the employee
    incumbent, found_db_name = find_employee(email, db_name)
    
    if not incumbent:
        logging.warning(f"Employee not found for email: {email}")
        return None
    
    # If found but db_name wasn't specified, use the found database
    if not db_name:
        db_name = found_db_name
    
    if not db_name or db_name not in active_dbs:
        logging.error("Valid database name not available")
        return None
    
    db = active_dbs[db_name]
    
    try:
        # Find successor candidates for this employee in the same database
        successor_results = find_successor_candidates(incumbent, db_name, limit=5)
        
        # Extract structured data for MongoDB storage
        incumbent_name = incumbent.get("fullName", "") 
        if not incumbent_name:
            incumbent_name = f"{incumbent.get('firstName', '')} {incumbent.get('lastName', '')}"
        incumbent_title = incumbent.get("jobTitle", "")
        
        # Create structured document for MongoDB
        successor_analysis = {
            "timestamp": datetime.now().isoformat(),
            "incumbent": {
                "name": incumbent_name,
                "email": incumbent.get("email", ""),
                "position": incumbent_title
            },
            "candidate_count": len(successor_results),
            "successor_candidates": successor_results
        }
        
        # For backward compatibility, also generate the JSON string
        successor_json_str = generate_json_report(successor_results, incumbent)
        
        # Update in users collection with structured document
        db[USERS_COLLECTION].update_one(
            {"email": email}, 
            {"$set": {
                "successorAnalysisData": successor_analysis,
                "successorAnalysis": successor_json_str  # Keep this for backward compatibility
            }}
        )
        
        logging.info(f"Processed successor analysis for {email} in {db_name}")
        return successor_analysis
    
    except Exception as e:
        logging.error(f"Error processing successor analysis for {email} in {db_name}: {e}")
        return None

def watch_database_changes(db_name, db):
    """Watch for changes in a single database"""
    logging.info(f"Starting change stream on {db_name}.{USERS_COLLECTION}...")
    
    try:
        # Watch for any changes in the users collection
        # Only watch for changes that would affect successor analysis
        pipeline = [
            {"$match": {
                "$and": [
                    {"operationType": {"$in": ["insert", "update", "replace"]}},
                    # Skip our own updates to successorAnalysisData to avoid infinite loops
                    {"updateDescription.updatedFields.successorAnalysisData": {"$exists": False}},
                    {"updateDescription.updatedFields.successorAnalysis": {"$exists": False}},
                    # Watch for changes in fields that affect successor analysis
                    {"$or": [
                        {"updateDescription.updatedFields.jobDuties": {"$exists": True}},
                        {"updateDescription.updatedFields.jobResponsibilities": {"$exists": True}},
                        {"updateDescription.updatedFields.toolsProficient": {"$exists": True}},
                        {"updateDescription.updatedFields.projects": {"$exists": True}},
                        {"fullDocument.jobDuties": {"$exists": True}},
                        {"fullDocument.jobResponsibilities": {"$exists": True}},
                        {"fullDocument.toolsProficient": {"$exists": True}},
                        {"fullDocument.projects": {"$exists": True}},
                        {"operationType": "insert"}  # Always process new documents
                    ]}
                ]
            }}
        ]
        
        with db[USERS_COLLECTION].watch(
            pipeline=pipeline, 
            full_document='updateLookup'
        ) as stream:
            for change in stream:
                try:
                    operation_type = change.get("operationType")
                    document = change.get("fullDocument")
                    
                    if not document:
                        logging.warning(f"Change event without full document in {db_name}")
                        continue
                        
                    email = document.get("email")
                    if not email:
                        logging.warning(f"Document without email in {db_name}: {document.get('_id')}")
                        continue
                    
                    # Check if the change was to successorAnalysis fields
                    if operation_type == "update":
                        updated_fields = change.get("updateDescription", {}).get("updatedFields", {})
                        if "successorAnalysisData" in updated_fields or "successorAnalysis" in updated_fields:
                            logging.info(f"Skipping our own update for {email} in {db_name}")
                            continue
                    
                    # Check if we have the necessary fields to perform successor analysis
                    has_job_duties = "jobDuties" in document or "jobResponsibilities" in document
                    has_tools = "toolsProficient" in document
                    
                    if not has_job_duties or not has_tools:
                        logging.info(f"Skipping successor update for {email}: missing required fields")
                        continue
                    
                    logging.info(
                        f"Processing successor update for {email} in {db_name} (operation: {operation_type})"
                    )
                    
                    # Process only this specific document
                    process_single_document(email, db_name)
                    
                except Exception as e:
                    logging.error(
                        f"Error handling change event in {db_name}: {e}"
                    )
                    # Include more details for debugging
                    import traceback
                    logging.error(traceback.format_exc())
    
    except Exception as e:
        logging.error(f"Error setting up change stream for {db_name}: {e}")
        # Try to reconnect after a delay
        time.sleep(10)
        
        # Reconnect just for this database
        try:
            if client:
                db = client[db_name]
                active_dbs[db_name] = db
                watch_database_changes(db_name, db)
        except Exception as reconnect_error:
            logging.error(f"Failed to reconnect to {db_name}: {reconnect_error}")

def watch_for_changes():
    """Start watching for changes across all databases"""
    global active_dbs
    
    if not active_dbs:
        logging.warning("No active databases available for change streams")
        return
    
    import threading
    
    # Create a thread for each database
    for db_name, db in active_dbs.items():
        thread = threading.Thread(
            target=watch_database_changes,
            args=(db_name, db),
            daemon=True
        )
        thread.start()
        logging.info(f"Started change stream thread for {db_name}")

def refresh_successor_analysis(batch_size=10):
    """
    Refresh successor analysis for all employees across all databases
    
    Args:
        batch_size: Number of employees to process in each batch
    """
    global active_dbs
    
    if not active_dbs:
        logging.warning("No active databases available. Connecting to database...")
        connect_db()
        if not active_dbs:
            logging.error("Database connection failed. Cannot refresh successor analysis.")
            return 0
    
    # Load model if not loaded
    if model is None:
        logging.warning("Model not loaded. Loading now...")
        load_model()
        if model is None:
            logging.error("Model loading failed. Cannot refresh successor analysis.")
            return 0
    
    # First refresh the database list to ensure we have the latest databases
    refresh_database_list()
    logging.info(f"Refreshing successor analyses for employees in {len(active_dbs)} databases")
    
    # Keep track of total employees processed
    total_processed = 0
    
    # Process each active database
    for db_name, db in active_dbs.items():
        logging.info(f"Processing successor analysis in {db_name} database...")
        
        # Get all employees from users collection
        users_cursor = db[USERS_COLLECTION].find({})
        user_count = db[USERS_COLLECTION].count_documents({})
        logging.info(f"Found {user_count} users in database {db_name}")
        
        processed_count = 0
        skipped_count = 0
        error_count = 0
        
        for doc in users_cursor:
            try:
                email = doc.get("email")
                if not email:
                    logging.warning(f"Skipping user without email: {doc.get('_id')}")
                    skipped_count += 1
                    continue
                
                # Check data integrity for successor analysis
                has_job_duties = "jobDuties" in doc or "jobResponsibilities" in doc
                has_tools = "toolsProficient" in doc
                
                if not has_job_duties or not has_tools:
                    logging.warning(f"Skipping {email}: Missing required data fields. " +
                                  f"Has job duties: {has_job_duties}, Has tools: {has_tools}")
                    skipped_count += 1
                    continue
                
                logging.info(f"Processing successor analysis for {email} in {db_name}")
                
                # Process successor analysis
                successor_json = process_single_document(email, db_name)
                if successor_json:
                    processed_count += 1
                    # Parse JSON to get candidate count
                    try:
                        successor_data = json.loads(successor_json) if isinstance(successor_json, str) else successor_json
                        candidate_count = successor_data.get("candidate_count", 0)
                        logging.info(f"Added {candidate_count} successor candidates for {email}")
                    except:
                        logging.info(f"Processed successor analysis for {email} (details unavailable)")
                else:
                    logging.warning(f"Failed to process successor analysis for {email}")
                    error_count += 1
                
                # Log progress
                if (processed_count + skipped_count + error_count) % batch_size == 0:
                    logging.info(f"Progress: Processed {processed_count} employees, " +
                               f"skipped {skipped_count}, errors {error_count} in {db_name}")
                    
            except Exception as e:
                logging.error(f"Error processing document {doc.get('email', 'unknown')} in {db_name}: {str(e)}")
                error_count += 1
        
        total_processed += processed_count
        logging.info(f"Completed processing {processed_count} employees in {db_name} " +
                   f"(skipped: {skipped_count}, errors: {error_count})")
    
    logging.info(f"Total employees processed across all databases: {total_processed}")
    return total_processed

def generate_json_report(successor_results: List[Dict[str, Any]], incumbent: Dict[str, Any]) -> str:
    """
    Generate a JSON report for successor analysis
    
    Args:
        successor_results: List of successor results from find_successor_candidates
        incumbent: The employee being replaced
        
    Returns:
        JSON string with the report
    """
    incumbent_name = incumbent.get("fullName", "") or f"{incumbent.get('firstName', '')} {incumbent.get('lastName', '')}"
    incumbent_title = incumbent.get("jobTitle", "")
    
    report = {
        "timestamp": datetime.now().isoformat(),
        "incumbent": {
            "name": incumbent_name,
            "email": incumbent.get("email", ""),
            "position": incumbent_title
        },
        "candidate_count": len(successor_results),
        "successor_candidates": successor_results
    }
    
    return json.dumps(report, indent=2)

def main():
    """Main function for running the module"""
    global active_dbs, model
    
    # Parse command-line arguments
    import argparse
    parser = argparse.ArgumentParser(description='Successor Identification Tool')
    parser.add_argument('--email', help='Email of employee to analyze')
    parser.add_argument('--db', help='Database name to process (optional)')
    parser.add_argument('--refresh', action='store_true', help='Refresh all successor analyses')
    parser.add_argument('--watch', action='store_true', help='Watch for changes in all databases')
    parser.add_argument('--batch-size', type=int, default=10, help='Batch size for processing in refresh mode')
    parser.add_argument('--npm', action='store_true', help='Flag to indicate running from npm script')
    
    args = parser.parse_args()
    
    # Connect to the database
    connect_db()
    
    # Load models
    load_model()
    
    # Set default behavior based on how the script is started
    is_npm_run = args.npm or any(arg in sys.argv[0] for arg in ['npm', 'node'])
    
    if args.refresh:
        # Run full refresh across all databases
        processed = refresh_successor_analysis(batch_size=args.batch_size)
        print(f"Refreshed successor analysis for {processed} employees across all databases")
    
    elif args.email:
        # Process a single employee by email
        db_name = args.db
        incumbent, found_db_name = find_employee(args.email, db_name)
        
        if incumbent:
            db_name = found_db_name if not db_name else db_name
            successor_results = find_successor_candidates(incumbent, db_name)
            
            if 'print_successor_report' in globals():
                print_successor_report(successor_results, incumbent)
            else:
                print(f"Found {len(successor_results)} successor candidates for {args.email}")
            
            # Generate and store structured data
            successor_analysis = process_single_document(args.email, db_name)
            
            if successor_analysis:
                print(f"Saved successor analysis for {args.email} in database {db_name}")
            else:
                print(f"Failed to save successor analysis for {args.email}")
        else:
            print(f"No employee found with email: {args.email}")
    else:
        # Default behavior is to watch for changes (especially when started with npm)
        print("Starting successor identification service in watch mode...")
        
        # Always start watching for changes across all databases
        print("Watching for changes in all databases...")
        watch_for_changes()
        
        # Also run an initial refresh if requested or if started with npm
        if args.watch or is_npm_run:
            print("Running initial light refresh...")
            try:
                # Use a smaller batch size for the initial refresh when running with npm
                batch_size = 5 if is_npm_run else args.batch_size
                processed = refresh_successor_analysis(batch_size=batch_size)
                print(f"Refreshed successor analysis for {processed} employees across all databases")
            except Exception as e:
                print(f"Error during initial refresh: {e}")
        
        # Keep the main thread alive
        try:
            print("Successor identification service is now active and watching for changes.")
            print("Press Ctrl+C to exit.")
            while True:
                time.sleep(3600)  # Sleep for an hour
        except KeyboardInterrupt:
            print("Received keyboard interrupt, shutting down...")
        
    return 0

if __name__ == "__main__":
    import sys
    # Check if being run from npm
    is_npm_run = any(arg in ' '.join(sys.argv) for arg in ['npm', 'node'])
    if is_npm_run and '--npm' not in sys.argv:
        sys.argv.append('--npm')
    main()
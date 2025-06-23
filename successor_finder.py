"""
import logging
import os
import json
import math
import numpy as np
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
logging.info("Successor Finder starting up...")

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

# --- Constants and Parameters ---
# Weights for different successor factors (sum = 1.0)
SUCCESSOR_FACTOR_WEIGHTS = {
    "stability_index": 0.20,        # Attrition risk (inverse)
    "project_complexity": 0.20,     # Experience with complex projects
    "cognitive_adaptability": 0.20, # Ability to handle complex tasks
    "promotion_velocity": 0.15,     # Historical growth rate
    "competency_similarity": 0.25   # Skill overlap with incumbent
}

# Minimum thresholds for successor consideration
MIN_STABILITY_SCORE = 0.5           # Minimum stability (1 - attrition_risk)
MIN_EXPERIENCE_MONTHS = 12          # Minimum experience in company
MIN_SIMILARITY_SCORE = 0.4          # Minimum skill similarity
MAX_CANDIDATES = 5                  # Maximum number of candidates to return

# --- Global Variables ---
client = None
active_dbs = {}                     # Dictionary to store active database connections
model = None
tfidf_vectorizer = None

# --- MongoDB Connection ---
def connect_db():
    """Connect to MongoDB and identify all available company databases"""
    global client, active_dbs
    try:
        if client is None:
            logging.info(f"Connecting to MongoDB at {MONGO_URI}...")
            client = MongoClient(MONGO_URI)
            # The ismaster command is cheap and does not require auth.
            client.admin.command('ismaster')
            logging.info("MongoDB connection successful.")
            
            # Get list of all databases
            refresh_database_list()
    except ConnectionFailure as e:
        logging.error(f"MongoDB connection failed: {e}")
        client = None
        active_dbs = {}
    except Exception as e:
        logging.error(f"An error occurred during DB connection: {e}")
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

def load_models():
    """Load required models for successor analysis"""
    global model, tfidf_vectorizer
    try:
        logging.info("Loading sentence transformer model...")
        start_time = time.time()
        # Use a lightweight model for efficiency
        model = SentenceTransformer('all-MiniLM-L6-v2')
        logging.info(f"Model loaded in {time.time() - start_time:.2f} seconds")
        
        # Initialize TF-IDF vectorizer for text features
        tfidf_vectorizer = TfidfVectorizer(
            lowercase=True,
            stop_words='english',
            ngram_range=(1, 2),
            max_features=5000
        )
        logging.info("TF-IDF vectorizer initialized")
    except Exception as e:
        logging.error(f"Error loading models: {e}")
        model = None

# --- Helper Functions ---
def search_employee(query: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Search for an employee by name or email across all databases
    
    Args:
        query: Search query (email or name)
    
    Returns:
        Tuple of (employee document or None if not found, database name where found)
    """
    global active_dbs
    
    if not active_dbs:
        logging.error("No active databases available")
        return None, None
        
    # Parse query for name or email
    query = query.strip().lower()
    email_pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    
    try:
        # Search through all databases
        for db_name, db in active_dbs.items():
            if re.match(email_pattern, query):
                # Search by email (exact match)
                logging.info(f"Searching for employee by email: {query} in {db_name}")
                employee = db[USERS_COLLECTION].find_one({"email": query})
            else:
                # Search by name (partial match)
                logging.info(f"Searching for employee by name: {query} in {db_name}")
                # Use regex for case-insensitive partial name match
                name_regex = re.compile(f".*{re.escape(query)}.*", re.IGNORECASE)
                
                employee = db[USERS_COLLECTION].find_one({
                    "$or": [
                        {"name": name_regex},
                        {"firstName": name_regex},
                        {"lastName": name_regex},
                        {"fullName": name_regex}
                    ]
                })
            
            if employee:
                logging.info(f"Found employee: {employee.get('name', employee.get('fullName', 'Unknown'))} ({employee.get('email', 'No email')}) in database {db_name}")
                return employee, db_name
        
        logging.warning(f"No employee found for query: {query} in any database")
        return None, None
            
    except Exception as e:
        logging.error(f"Error searching for employee: {e}")
        return None, None

def get_all_potential_successors(exclude_email: str = None, db_name: str = None) -> List[Dict[str, Any]]:
    """
    Get all potential successor candidates from a specific database
    
    Args:
        exclude_email: Email of employee to exclude
        db_name: Database name to search in (required)
    
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
    
    # Build the query
    query = {}
    if exclude_email:
        query["email"] = {"$ne": exclude_email}
    
    # Add criteria for potential successors
    query["$and"] = [
        {"$or": [
            {"jobDuties": {"$exists": True}}, 
            {"jobResponsibilities": {"$exists": True}}
        ]},
        {"toolsProficient": {"$exists": True}},
        # Employees should have some minimal experience
        {"$or": [
            {"timeWithCompanyMonths": {"$gte": MIN_EXPERIENCE_MONTHS}},
            {"timeWithCompany": {"$exists": True}}
        ]}
    ]
    
    projection = {
        "email": 1,
        "name": 1,
        "firstName": 1,
        "lastName": 1,
        "fullName": 1,
        "jobTitle": 1,
        "jobDuties": 1,
        "jobResponsibilities": 1,
        "toolsProficient": 1,
        "projects": 1,
        "timeWithCompany": 1,
        "timeInCurrentRole": 1,
        "timeWithCompanyMonths": 1,
        "attritionAssessment": 1,
        "utilizationAssessment": 1
    }
    
    cursor = db[USERS_COLLECTION].find(query, projection)
    employees = list(cursor)
    
    logging.info(f"Found {len(employees)} potential successor candidates in {db_name}.{USERS_COLLECTION}")
    return employees

def calculate_stability_index(employee: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate stability index based on attrition risk assessment
    Higher stability = lower flight risk = better successor candidate
    """
    # Default values if no attrition assessment available
    default_stability = 0.5  # Medium stability assumed
    
    # Get attrition assessment if available
    attrition_assessment = employee.get("attritionAssessment", {})
    
    if not attrition_assessment:
        logging.warning(f"No attrition assessment found for {employee.get('email', 'Unknown')}")
        return {
            "stability_score": default_stability,
            "risk_level": "unknown",
            "primary_risk_factors": [],
            "confidence": 0.3,
            "explanation": "No attrition data available, using default stability value"
        }
    
    # Extract attrition score (0-1 scale, higher = higher attrition risk)
    attrition_score = attrition_assessment.get("attrition_score", 0.5)
    risk_level = attrition_assessment.get("attrition_risk", "medium")
    
    # Convert attrition risk to stability (inverse relationship)
    # 0 attrition = 1.0 stability, 1.0 attrition = 0 stability
    stability_score = 1.0 - attrition_score
    
    # Apply logarithmic adjustment to emphasize high-stability candidates
    # This gives more weight to stability differences in the high range
    # log(1+x) / log(2) scales from 0 to 1 with diminishing returns
    adjusted_stability = math.log(1 + stability_score) / math.log(2)
    
    # Adjust final score based on confidence in assessment
    confidence = attrition_assessment.get("confidence_score", 0.7)
    if not confidence:
        confidence = 0.7  # Default confidence if missing
    
    # Extract primary risk factors
    primary_risk_factors = attrition_assessment.get("primary_risk_factors", [])
    
    # Generate explanation
    if stability_score > 0.8:
        explanation = "High stability candidate with low attrition risk"
    elif stability_score > 0.6:
        explanation = "Moderately stable candidate with acceptable attrition risk"
    elif stability_score > 0.4:
        explanation = "Average stability with some attrition risk factors"
    else:
        explanation = "Higher flight risk may reduce successor suitability"
    
    return {
        "stability_score": stability_score,
        "adjusted_stability": adjusted_stability,
        "risk_level": risk_level,
        "primary_risk_factors": primary_risk_factors,
        "confidence": confidence,
        "explanation": explanation
    }

def calculate_project_complexity_exposure(employee: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate project complexity exposure based on:
    1. Project budget responsibility
    2. Project criticality/priority
    3. Project scale and scope
    4. Leadership roles in projects
    
    Higher score = more exposure to complex, critical projects
    """
    projects = employee.get("projects", [])
    
    if not projects:
        logging.warning(f"No projects found for {employee.get('email', 'Unknown')}")
        return {
            "complexity_exposure_score": 0.3,
            "project_count": 0,
            "avg_complexity": 0,
            "max_budget_exposure": 0,
            "leadership_ratio": 0,
            "critical_project_count": 0,
            "explanation": "No project data available"
        }
    
    # Initialize metrics
    total_projects = len(projects)
    total_complexity = 0
    max_budget = 0
    leadership_count = 0
    critical_projects = 0
    
    # Analyze each project
    for project in projects:
        if not isinstance(project, dict):
            continue
            
        # Extract project metrics
        budget = float(project.get("budget", 0))
        priority = project.get("priority", "").lower()
        status = project.get("project_status", "").lower()
        
        # Extract user's role in the project
        user_contribution = project.get("user_contribution", {})
        role_in_project = user_contribution.get("role_in_project", "").lower()
        responsibility_level = user_contribution.get("responsibility_level", 0.5)
        
        # Calculate complexity factors
        # 1. Budget factor (logarithmic scaling to handle wide range of budgets)
        if budget > 0:
            budget_factor = min(1.0, math.log(1 + budget/10000) / math.log(1 + 1000000/10000))
            max_budget = max(max_budget, budget)
        else:
            budget_factor = 0.2  # Default if no budget data
            
        # 2. Priority factor
        if priority in ["critical", "high"]:
            priority_factor = 1.0
            critical_projects += 1
        elif priority in ["medium", "normal"]:
            priority_factor = 0.6
        else:
            priority_factor = 0.3
            
        # 3. Leadership factor
        is_leadership_role = any(leader_term in role_in_project for leader_term in 
                               ["lead", "manager", "director", "head", "architect", "principal"])
        if is_leadership_role:
            leadership_factor = 1.0
            leadership_count += 1
        else:
            leadership_factor = 0.5
            
        # 4. Status factor (active projects weighted higher)
        if status in ["active", "in progress", "ongoing"]:
            status_factor = 1.0
        else:
            status_factor = 0.5
            
        # 5. Responsibility level factor
        responsibility_factor = responsibility_level
        
        # Calculate composite complexity for this project
        project_complexity = (
            (budget_factor * 0.25) +
            (priority_factor * 0.25) +
            (leadership_factor * 0.20) +
            (status_factor * 0.10) +
            (responsibility_factor * 0.20)
        )
        
        total_complexity += project_complexity
    
    # Calculate aggregate metrics
    avg_complexity = total_complexity / total_projects if total_projects > 0 else 0
    leadership_ratio = leadership_count / total_projects if total_projects > 0 else 0
    critical_ratio = critical_projects / total_projects if total_projects > 0 else 0
    
    # Apply non-linear scaling for project count
    # More projects = more exposure, but with diminishing returns
    project_count_factor = min(1.0, math.log(1 + total_projects) / math.log(1 + 10))
    
    # Final complexity exposure score (0-1 scale)
    complexity_exposure_score = (
        (avg_complexity * 0.5) +
        (project_count_factor * 0.3) +
        (leadership_ratio * 0.2)
    )
    
    # Generate explanation
    if complexity_exposure_score > 0.8:
        explanation = "Extensive experience with high-complexity, critical projects"
    elif complexity_exposure_score > 0.6:
        explanation = "Strong project complexity exposure with leadership experience"
    elif complexity_exposure_score > 0.4:
        explanation = "Moderate project complexity exposure"
    else:
        explanation = "Limited exposure to complex or critical projects"
    
    return {
        "complexity_exposure_score": complexity_exposure_score,
        "project_count": total_projects,
        "avg_complexity": avg_complexity,
        "max_budget_exposure": max_budget,
        "leadership_ratio": leadership_ratio,
        "critical_project_count": critical_projects,
        "explanation": explanation
    }

def calculate_cognitive_adaptability(employee: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate cognitive load adaptability based on:
    1. Task intensity from job duties
    2. Skill complexity from tools used
    3. Work context complexity from utilization assessment
    
    Higher score = better ability to handle cognitively demanding tasks
    """
    # Extract relevant data
    job_duties = employee.get("jobDuties", []) or employee.get("jobResponsibilities", [])
    tools_proficient = employee.get("toolsProficient", [])
    job_intensity_analysis = employee.get("job_intensity_analysis", {})
    utilization_assessment = employee.get("utilizationAssessment", {})
    
    if not job_duties and not job_intensity_analysis:
        logging.warning(f"No job duties or intensity data found for {employee.get('email', 'Unknown')}")
        return {
            "cognitive_adaptability_score": 0.5,
            "avg_task_intensity": 0,
            "skill_complexity": 0,
            "context_adaptability": 0,
            "explanation": "Limited data on cognitive demands"
        }
    
    # 1. Calculate average task intensity
    avg_intensity = 0
    if job_intensity_analysis:
        # Use pre-calculated intensity if available
        avg_intensity = job_intensity_analysis.get("weighted_intensity", 0.5)
    elif job_duties:
        # Simple calculation based on duty count if intensity not available
        avg_intensity = min(0.8, 0.3 + (len(job_duties) * 0.05))
    
    # 2. Calculate tool/skill complexity
    skill_complexity = 0
    if tools_proficient:
        if isinstance(tools_proficient, list):
            # More complex tools indicate higher cognitive adaptability
            # Use logarithmic scaling to handle wide range of tool counts
            skill_complexity = min(0.9, math.log(1 + len(tools_proficient)) / math.log(1 + 20))
        else:
            # Handle case where tools is a string
            tools_list = [t.strip() for t in tools_proficient.split(',') if t.strip()]
            skill_complexity = min(0.9, math.log(1 + len(tools_list)) / math.log(1 + 20))
    
    # 3. Extract utilization data if available
    context_adaptability = 0.5  # Default value
    if utilization_assessment:
        # Higher utilization (up to optimal) suggests adaptability
        util_score = utilization_assessment.get("utilization_score", 0.5)
        # Optimal utilization is around 0.7-0.8, higher may indicate overwhelm
        if util_score <= 0.8:
            context_adaptability = util_score
        else:
            # Penalize over-utilization slightly, still valuing high capacity
            context_adaptability = 0.8 - ((util_score - 0.8) * 0.5)
    
    # Calculate cognitive adaptability score with customized weights
    # Emphasize demonstrated intensity handling and skill complexity
    cognitive_adaptability_score = (
        (avg_intensity * 0.4) +
        (skill_complexity * 0.4) +
        (context_adaptability * 0.2)
    )
    
    # Apply sigmoid normalization to create better distribution
    # Formula: 1 / (1 + e^(-5 * (x - 0.5)))
    normalized_score = 1 / (1 + math.exp(-5 * (cognitive_adaptability_score - 0.5)))
    
    # Generate explanation
    if normalized_score > 0.8:
        explanation = "Exceptional capacity for handling complex cognitive demands"
    elif normalized_score > 0.6:
        explanation = "Strong cognitive adaptability with proven handling of intensive tasks"
    elif normalized_score > 0.4:
        explanation = "Moderate cognitive adaptability"
    else:
        explanation = "May need development in handling complex cognitive tasks"
    
    return {
        "cognitive_adaptability_score": normalized_score,
        "avg_task_intensity": avg_intensity,
        "skill_complexity": skill_complexity,
        "context_adaptability": context_adaptability,
        "explanation": explanation
    }

def calculate_promotion_velocity(employee: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate promotion velocity based on:
    1. Career progression rate
    2. Tenure in current vs. previous roles
    3. Skill acquisition rate
    
    Higher score = faster historical growth trajectory
    """
    # Extract relevant data
    time_with_company = employee.get("timeWithCompanyMonths", 0)
    if time_with_company == 0:
        time_str = employee.get("timeWithCompany", "")
        if time_str and isinstance(time_str, str):
            # Try to parse time expression like "3 years 4 months"
            years_match = re.search(r'(\d+)\s*(?:year|years|yr|yrs)', time_str.lower())
            months_match = re.search(r'(\d+)\s*(?:month|months|mo|mos)', time_str.lower())
            
            years = int(years_match.group(1)) if years_match else 0
            months = int(months_match.group(1)) if months_match else 0
            
            time_with_company = (years * 12) + months
    
    time_in_role = employee.get("timeInCurrentRoleMonths", 0)
    if time_in_role == 0:
        role_time_str = employee.get("timeInCurrentRole", "")
        if role_time_str and isinstance(role_time_str, str):
            # Parse current role time
            years_match = re.search(r'(\d+)\s*(?:year|years|yr|yrs)', role_time_str.lower())
            months_match = re.search(r'(\d+)\s*(?:month|months|mo|mos)', role_time_str.lower())
            
            years = int(years_match.group(1)) if years_match else 0
            months = int(months_match.group(1)) if months_match else 0
            
            time_in_role = (years * 12) + months
    
    # Get career history if available
    career_progression = employee.get("careerProgression", [])
    
    if time_with_company == 0:
        logging.warning(f"No tenure data found for {employee.get('email', 'Unknown')}")
        return {
            "promotion_velocity_score": 0.5,
            "time_with_company_months": 0,
            "time_in_role_months": 0,
            "role_change_frequency": 0,
            "explanation": "Insufficient career progression data"
        }
    
    # 1. Calculate role change frequency
    role_changes = 0
    if career_progression and isinstance(career_progression, list) and len(career_progression) > 1:
        role_changes = len(career_progression) - 1
    
    # If no career progression data but we know time in company and role
    if role_changes == 0 and time_with_company > time_in_role:
        # Estimate at least one role change
        role_changes = max(1, int((time_with_company - time_in_role) / 24))
    
    # Calculate role change frequency (changes per year)
    if time_with_company > 0:
        role_change_frequency = (role_changes * 12) / time_with_company
    else:
        role_change_frequency = 0
    
    # 2. Calculate time ratio (time in current role vs. company)
    # Lower ratio means faster movement
    if time_with_company > 0 and time_in_role > 0:
        time_ratio = time_in_role / time_with_company
    else:
        time_ratio = 1.0  # Default if missing data
    
    # 3. Apply non-linear transformation for experience value
    # More experience is good, but with diminishing returns
    experience_factor = min(1.0, math.log(1 + time_with_company/12) / math.log(1 + 10))
    
    # Calculate promotion velocity score
    # Balance between frequency of changes and stability in current role
    if role_change_frequency > 0:
        # Higher frequency = higher score, but not if too rapid (indicates instability)
        frequency_score = min(1.0, role_change_frequency / 0.5)  # Optimal = 1 change every 2 years
    else:
        frequency_score = 0.2  # No changes = low velocity
    
    # Ideal time ratio is around 0.3-0.5 (spent 30-50% of time in current role)
    if time_ratio <= 0.5:
        ratio_score = 1.0 - time_ratio  # Lower ratio = higher score
    else:
        # Penalize very long time in current role relative to total time
        ratio_score = max(0.2, 1.0 - time_ratio)
    
    # Combine scores with weights and apply experience factor
    raw_velocity_score = (frequency_score * 0.6) + (ratio_score * 0.4)
    promotion_velocity_score = raw_velocity_score * experience_factor
    
    # Generate explanation
    if promotion_velocity_score > 0.8:
        explanation = "Exceptional growth trajectory with ideal promotion pacing"
    elif promotion_velocity_score > 0.6:
        explanation = "Strong growth momentum with consistent progression"
    elif promotion_velocity_score > 0.4:
        explanation = "Moderate career velocity"
    else:
        explanation = "Limited demonstrated career progression velocity"
    
    return {
        "promotion_velocity_score": promotion_velocity_score,
        "time_with_company_months": time_with_company,
        "time_in_role_months": time_in_role,
        "role_change_frequency": role_change_frequency,
        "explanation": explanation
    }

def calculate_competency_similarity(incumbent: Dict[str, Any], candidate: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate competency similarity between incumbent and potential successor based on:
    1. Tool/technology overlap
    2. Project domain similarity
    3. Job responsibility similarity
    
    Higher score = more similar competency profile
    """
    if model is None:
        logging.error("Sentence transformer model not loaded")
        return {
            "competency_similarity_score": 0.5,
            "tool_similarity": 0.5,
            "project_similarity": 0.5,
            "responsibility_similarity": 0.5,
            "explanation": "Model not available for proper similarity calculation"
        }
    
    # Extract relevant data
    incumbent_tools = incumbent.get("toolsProficient", [])
    candidate_tools = candidate.get("toolsProficient", [])
    
    incumbent_projects = incumbent.get("projects", [])
    candidate_projects = candidate.get("projects", [])
    
    incumbent_duties = incumbent.get("jobDuties", []) or incumbent.get("jobResponsibilities", [])
    candidate_duties = candidate.get("jobDuties", []) or candidate.get("jobResponsibilities", [])
    
    # 1. Calculate tool similarity
    tool_similarity = 0.5  # Default similarity
    
    if incumbent_tools and candidate_tools:
        # Convert to lists if strings
        if isinstance(incumbent_tools, str):
            incumbent_tools = [t.strip() for t in incumbent_tools.split(',') if t.strip()]
        if isinstance(candidate_tools, str):
            candidate_tools = [t.strip() for t in candidate_tools.split(',') if t.strip()]
        
        if incumbent_tools and candidate_tools:
            # Calculate Jaccard similarity for tools
            incumbent_set = set(str(t).lower() for t in incumbent_tools)
            candidate_set = set(str(t).lower() for t in candidate_tools)
            
            if incumbent_set and candidate_set:
                intersection = len(incumbent_set.intersection(candidate_set))
                union = len(incumbent_set.union(candidate_set))
                tool_similarity = intersection / union if union > 0 else 0
    
    # 2. Calculate project domain similarity
    project_similarity = 0.5  # Default similarity
    
    if incumbent_projects and candidate_projects:
        # Extract project domains and tech stacks
        incumbent_domains = []
        incumbent_techs = []
        
        for project in incumbent_projects:
            if isinstance(project, dict):
                domain = project.get("project_domain", "")
                if domain:
                    incumbent_domains.append(domain)
                
                tech_stack = project.get("tech_stack", [])
                if tech_stack and isinstance(tech_stack, list):
                    incumbent_techs.extend(tech_stack)
        
        candidate_domains = []
        candidate_techs = []
        
        for project in candidate_projects:
            if isinstance(project, dict):
                domain = project.get("project_domain", "")
                if domain:
                    candidate_domains.append(domain)
                
                tech_stack = project.get("tech_stack", [])
                if tech_stack and isinstance(tech_stack, list):
                    candidate_techs.extend(tech_stack)
        
        # Calculate domain similarity using embeddings
        if incumbent_domains and candidate_domains:
            incumbent_domain_text = " ".join(incumbent_domains)
            candidate_domain_text = " ".join(candidate_domains)
            
            incumbent_embedding = model.encode([incumbent_domain_text])[0]
            candidate_embedding = model.encode([candidate_domain_text])[0]
            
            domain_sim = cosine_similarity([incumbent_embedding], [candidate_embedding])[0][0]
            domain_sim = max(0, min(1, float(domain_sim)))  # Ensure in 0-1 range
        else:
            domain_sim = 0.3  # Default if no domains
            
        # Calculate tech stack similarity
        if incumbent_techs and candidate_techs:
            incumbent_tech_set = set(str(t).lower() for t in incumbent_techs)
            candidate_tech_set = set(str(t).lower() for t in candidate_techs)
            
            intersection = len(incumbent_tech_set.intersection(candidate_tech_set))
            union = len(incumbent_tech_set.union(candidate_tech_set))
            tech_sim = intersection / union if union > 0 else 0
        else:
            tech_sim = 0.3  # Default if no tech stacks
            
        # Combine domain and tech similarity
        project_similarity = (domain_sim * 0.6) + (tech_sim * 0.4)
    
    # 3. Calculate job duty similarity
    responsibility_similarity = 0.5  # Default similarity
    
    if incumbent_duties and candidate_duties:
        # Extract text from duties
        incumbent_duty_texts = []
        for duty in incumbent_duties:
            if isinstance(duty, dict):
                duty_text = duty.get("duty", "") or duty.get("description", "")
                if duty_text:
                    incumbent_duty_texts.append(duty_text)
            elif isinstance(duty, str):
                incumbent_duty_texts.append(duty)
        
        candidate_duty_texts = []
        for duty in candidate_duties:
            if isinstance(duty, dict):
                duty_text = duty.get("duty", "") or duty.get("description", "")
                if duty_text:
                    candidate_duty_texts.append(duty_text)
            elif isinstance(duty, str):
                candidate_duty_texts.append(duty)
        
        if incumbent_duty_texts and candidate_duty_texts:
            # Calculate similarity using embeddings
            incumbent_duty_text = " ".join(incumbent_duty_texts)
            candidate_duty_text = " ".join(candidate_duty_texts)
            
            incumbent_embedding = model.encode([incumbent_duty_text])[0]
            candidate_embedding = model.encode([candidate_duty_text])[0]
            
            responsibility_similarity = cosine_similarity([incumbent_embedding], [candidate_embedding])[0][0]
            responsibility_similarity = max(0, min(1, float(responsibility_similarity)))  # Ensure in 0-1 range
    
    # Calculate overall competency similarity score
    competency_similarity_score = (
        (tool_similarity * 0.3) +
        (project_similarity * 0.3) +
        (responsibility_similarity * 0.4)
    )
    
    # Generate explanation
    if competency_similarity_score > 0.8:
        explanation = "Exceptional competency match across tools, projects, and responsibilities"
    elif competency_similarity_score > 0.6:
        explanation = "Strong competency alignment with good skill transferability"
    elif competency_similarity_score > 0.4:
        explanation = "Moderate competency similarity with some skill gaps"
    else:
        explanation = "Limited competency overlap, significant skill development needed"
    
    return {
        "competency_similarity_score": competency_similarity_score,
        "tool_similarity": tool_similarity,
        "project_similarity": project_similarity,
        "responsibility_similarity": responsibility_similarity,
        "explanation": explanation
    }

def find_successor_candidates(incumbent: Dict[str, Any], db_name: str, limit: int = MAX_CANDIDATES) -> List[Dict[str, Any]]:
    """
    Find and rank successor candidates for an incumbent employee within the same database
    
    Args:
        incumbent: The employee being replaced
        db_name: The database name where the incumbent is located
        limit: Maximum number of candidates to return
    
    Returns:
        List of ranked successor candidates
    """
    if not incumbent or not db_name:
        logging.error("Invalid incumbent or database name")
        return []
    
    incumbent_email = incumbent.get("email")
    if not incumbent_email:
        logging.error("Incumbent email not found")
        return []
    
    logging.info(f"Finding successor candidates for {incumbent_email} in database {db_name}")
    
    # Get all potential successors from the same database
    candidates = get_all_potential_successors(exclude_email=incumbent_email, db_name=db_name)
    if not candidates:
        logging.warning(f"No potential successor candidates found in {db_name}")
        return []
    
    # Calculate successor scores for each candidate
    successor_results = []
    for candidate in candidates:
        try:
            # Calculate individual factors
            stability = calculate_stability_index(candidate)
            complexity = calculate_project_complexity_exposure(candidate)
            cognitive = calculate_cognitive_adaptability(candidate)
            velocity = calculate_promotion_velocity(candidate)
            competency = calculate_competency_similarity(incumbent, candidate)
            
            # Extract scores
            stability_score = stability.get("stability_score", 0.5)
            complexity_score = complexity.get("complexity_exposure_score", 0.5)
            cognitive_score = cognitive.get("cognitive_adaptability_score", 0.5)
            velocity_score = velocity.get("promotion_velocity_score", 0.5)
            competency_score = competency.get("competency_similarity_score", 0.3)
            
            # Calculate weighted successor score
            successor_score = (
                (SUCCESSOR_FACTOR_WEIGHTS["stability_index"] * stability_score) +
                (SUCCESSOR_FACTOR_WEIGHTS["project_complexity"] * complexity_score) +
                (SUCCESSOR_FACTOR_WEIGHTS["cognitive_adaptability"] * cognitive_score) +
                (SUCCESSOR_FACTOR_WEIGHTS["promotion_velocity"] * velocity_score) +
                (SUCCESSOR_FACTOR_WEIGHTS["competency_similarity"] * competency_score)
            )
            
            # Check if candidate meets minimum competency threshold
            is_viable = competency_score >= MIN_SIMILARITY_SCORE and stability_score >= MIN_STABILITY_SCORE
            viability = "viable" if is_viable else "non_viable"
            viability_reason = ""
            
            if not is_viable:
                if competency_score < MIN_SIMILARITY_SCORE:
                    viability_reason = f"Insufficient skill overlap ({competency_score:.2f} < {MIN_SIMILARITY_SCORE})"
                elif stability_score < MIN_STABILITY_SCORE:
                    viability_reason = f"High attrition risk ({stability_score:.2f} < {MIN_STABILITY_SCORE})"
            
            # Generate candidate name
            candidate_name = candidate.get("fullName", "") or f"{candidate.get('firstName', '')} {candidate.get('lastName', '')}"
            
            # Add to results
            successor_results.append({
                "candidate_email": candidate.get("email"),
                "candidate_name": candidate_name,
                "candidate_jobTitle": candidate.get("jobTitle", ""),
                "successor_score": successor_score,
                "is_viable": is_viable,
                "viability": viability,
                "viability_reason": viability_reason,
                "factor_scores": {
                    "stability_score": stability_score,
                    "complexity_score": complexity_score,
                    "cognitive_score": cognitive_score,
                    "velocity_score": velocity_score,
                    "competency_score": competency_score
                },
                "factor_details": {
                    "stability": stability,
                    "complexity": complexity,
                    "cognitive": cognitive,
                    "velocity": velocity,
                    "competency": competency
                }
            })
        except Exception as e:
            logging.error(f"Error calculating successor score for {candidate.get('email', 'Unknown')}: {e}")
    
    # Sort by successor score (descending)
    successor_results.sort(key=lambda x: x["successor_score"], reverse=True)
    
    # Return top candidates
    return successor_results[:limit]

def process_successor_analysis(email: str = None, db_name: str = None) -> Dict[str, Any]:
    """
    Process successor analysis for a specific employee
    
    Args:
        email: Email of employee to analyze
        db_name: Optional database name if known
    
    Returns:
        Analysis results
    """
    # Connect to DB if not already connected
    if not active_dbs:
        connect_db()
    
    # Load models if not already loaded
    if model is None:
        load_models()
    
    # Find the employee
    employee, found_db_name = search_employee(email)
    if not employee:
        return {"error": f"Employee not found: {email}"}
    
    # Use found database name if db_name wasn't specified
    if not db_name:
        db_name = found_db_name
    
    # Find successor candidates
    successors = find_successor_candidates(employee, db_name)
    
    # Generate result summary
    summary = {
        "incumbent": {
            "email": employee.get("email"),
            "name": employee.get("fullName", "") or f"{employee.get('firstName', '')} {employee.get('lastName', '')}",
            "jobTitle": employee.get("jobTitle", "")
        },
        "database": db_name,
        "timestamp": datetime.now().isoformat(),
        "candidate_count": len(successors),
        "viable_count": sum(1 for s in successors if s.get("is_viable", False)),
        "successors": successors
    }
    
    # Store the analysis in the database
    try:
        if db_name in active_dbs:
            db = active_dbs[db_name]
            
            # Update in users collection
            db[USERS_COLLECTION].update_one(
                {"email": email},
                {"$set": {
                    "successorAnalysis": json.dumps(summary),
                    "successorCandidates": successors
                }}
            )
            
            logging.info(f"Successor analysis stored for {email} in {db_name}")
    except Exception as e:
        logging.error(f"Error storing successor analysis: {e}")
    
    return summary

def refresh_all_successor_analyses(batch_size: int = 10) -> Dict[str, Any]:
    """
    Refresh successor analyses for all employees across all databases
    
    Args:
        batch_size: Number of employees to process in each batch
    
    Returns:
        Summary of processing results
    """
    global active_dbs
    
    # Connect to DB if not already connected
    if not active_dbs:
        connect_db()
        if not active_dbs:
            return {"error": "Failed to connect to databases"}
    
    # Load models if not already loaded
    if model is None:
        load_models()
        if model is None:
            return {"error": "Failed to load models"}
    
    # Refresh database list to ensure we have the latest
    refresh_database_list()
    logging.info(f"Refreshing successor analyses for employees in {len(active_dbs)} databases")
    
    results = {
        "total_processed": 0,
        "databases": {}
    }
    
    # Process each database
    for db_name, db in active_dbs.items():
        logging.info(f"Processing {db_name} database...")
        db_results = {
            "processed": 0,
            "errors": 0
        }
        
        # Get all employees
        users_cursor = db[USERS_COLLECTION].find({})
        user_count = db[USERS_COLLECTION].count_documents({})
        logging.info(f"Found {user_count} users in database {db_name}")
        
        # Process each employee
        for user in users_cursor:
            try:
                email = user.get("email")
                if not email:
                    logging.warning(f"Skipping user without email: {user.get('_id')}")
                    continue
                
                logging.info(f"Processing successor analysis for {email} in {db_name}")
                
                # Check data integrity for successor analysis
                has_job_duties = "jobDuties" in user or "jobResponsibilities" in user
                has_tools = "toolsProficient" in user
                
                if not has_job_duties or not has_tools:
                    logging.warning(f"Skipping {email}: Missing required data fields. " +
                                  f"Has job duties: {has_job_duties}, Has tools: {has_tools}")
                    continue
                
                # Process the successor analysis
                result = process_successor_analysis(email, db_name)
                if "error" in result:
                    logging.warning(f"Error processing {email}: {result['error']}")
                    db_results["errors"] += 1
                else:
                    db_results["processed"] += 1
                    logging.info(f"Successfully processed successor analysis for {email} with " +
                               f"{result['candidate_count']} candidates ({result['viable_count']} viable)")
                
                # Log progress
                if (db_results["processed"] + db_results["errors"]) % batch_size == 0:
                    logging.info(f"Progress: Processed {db_results['processed']} employees " +
                               f"({db_results['errors']} errors) in {db_name}")
                    
            except Exception as e:
                logging.error(f"Error processing {user.get('email', 'unknown')}: {str(e)}")
                db_results["errors"] += 1
        
        results["databases"][db_name] = db_results
        results["total_processed"] += db_results["processed"]
        
        logging.info(f"Completed processing {db_results['processed']} employees " +
                   f"({db_results['errors']} errors) in {db_name}")
    
    return results

def main():
    """Main function for running the successor finder tool"""
    import argparse
    parser = argparse.ArgumentParser(description="Successor Finder Tool")
    parser.add_argument("--email", help="Email of employee to analyze")
    parser.add_argument("--db", help="Optional database name to search in")
    parser.add_argument("--refresh-all", action="store_true", help="Refresh all successor analyses")
    parser.add_argument("--batch-size", type=int, default=10, help="Batch size for processing")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    
    args = parser.parse_args()
    
    # Set logging level based on verbose flag
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
        logging.info("Verbose logging enabled")
    
    # Connect to database
    connect_db()
    if not active_dbs:
        logging.error("Failed to connect to any databases. Exiting.")
        return 1
    
    logging.info(f"Connected to {len(active_dbs)} databases: {', '.join(active_dbs.keys())}")
    
    # Load models
    load_models()
    if model is None:
        logging.error("Failed to load required models. Exiting.")
        return 1
    
    if args.refresh_all or (not args.email):
        # Refresh all analyses by default if no specific option is provided
        logging.info("Processing successor analysis for all employees across all databases...")
        results = refresh_all_successor_analyses(args.batch_size)
        print(f"Refreshed successor analyses for {results['total_processed']} employees across {len(results['databases'])} databases")
        
        # Print per-database results for clarity
        for db_name, stats in results['databases'].items():
            print(f"  - {db_name}: {stats['processed']} processed, {stats['errors']} errors")
            
    elif args.email:
        # Process single employee
        print(f"Processing successor analysis for {args.email}...")
        results = process_successor_analysis(args.email, args.db)
        
        if "error" in results:
            print(f"Error: {results['error']}")
            return 1
        
        print("\n=== SUCCESSOR ANALYSIS RESULTS ===")
        print(f"Incumbent: {results['incumbent']['name']} ({results['incumbent']['jobTitle']})")
        print(f"Database: {results['database']}")
        print(f"Found {results['candidate_count']} potential successors ({results['viable_count']} viable)")
        
        for i, successor in enumerate(results["successors"][:5], 1):
            viability = "✅ VIABLE" if successor["is_viable"] else "❌ NON-VIABLE"
            print(f"\n{i}. {successor['candidate_name']} - Score: {successor['successor_score']:.2f} - {viability}")
            print(f"   Position: {successor['candidate_jobTitle']}")
            
            print("   Factor Scores:")
            for factor, score in successor["factor_scores"].items():
                print(f"      - {factor}: {score:.2f}")
            
            if not successor["is_viable"]:
                print(f"   Reason: {successor['viability_reason']}")
    
    return 0 
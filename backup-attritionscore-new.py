#!/usr/bin/env python3
import logging
import os
import json
import math
import numpy as np
import re
import requests
import subprocess
import sys
from pymongo import MongoClient, UpdateOne
from pymongo.errors import ConnectionFailure, OperationFailure
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Any, Tuple, Optional
import time
from datetime import datetime, timedelta
from dateutil import parser
import random

# Ensure required libraries are installed
try:
    import faiss
except ImportError:
    print("Installing FAISS for vector search...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "faiss-cpu"])
    import faiss

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logging.info("Attrition Score Analyzer starting up...")

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

# --- Constants and Parameters ---
# Weights for different attrition factors (sum = 1.0)
ATTRITION_FACTOR_WEIGHTS = {
    "responsibility_mismatch": 0.15,    # Mismatch between responsibilities and seniority
    "tenure_factor": 0.12,              # Long tenure with static growth
    "utilization_factor": 0.15,         # Under/over utilization
    "seniority_factor": 0.08,           # Mid-senior most likely to jump
    "task_variety_index": 0.1,          # Diversity of tasks
    "job_intensity": 0.08,              # High intensity jobs
    "role_project_ratio": 0.1,          # Projects vs. seniority
    "collaboration_index": 0.12,        # Collaboration strength
    "salary_satisfaction": 0.1          # Salary appropriateness for role/location
}

# Cost of living index for different locations (1.0 is the baseline)
COST_OF_LIVING_INDEX = {
    # High cost areas
    "san francisco": 2.5,
    "new york": 2.3,
    "los angeles": 1.8,
    "boston": 1.7,
    "seattle": 1.6,
    "washington dc": 1.6,
    
    # Medium cost areas
    "chicago": 1.3,
    "austin": 1.2,
    "denver": 1.2,
    "portland": 1.2,
    "philadelphia": 1.2,
    "miami": 1.2,
    
    # Lower cost areas (but still above base)
    "phoenix": 1.1,
    "dallas": 1.1,
    "houston": 1.1,
    "atlanta": 1.0,
    "detroit": 0.9,
    
    # International tech hubs
    "london": 1.9,
    "toronto": 1.6,
    "tokyo": 1.8,
    "sydney": 1.7,
    "singapore": 1.8,
    "zurich": 2.2,
    "berlin": 1.4,
    
    # Default for unrecognized locations
    "default": 1.0
}

# Add more specific cities and neighborhoods for better matching
EXPANDED_COST_OF_LIVING = {
    # NYC and boroughs/neighborhoods
    "nyc": 2.3,
    "manhattan": 2.7,
    "brooklyn": 2.2,
    "queens": 1.9,
    "bronx": 1.7,
    "staten island": 1.7,
    
    # SF Bay Area
    "bay area": 2.5,
    "palo alto": 2.8,
    "mountain view": 2.7,
    "san jose": 2.3,
    "oakland": 2.0,
    
    # LA Area
    "santa monica": 2.0,
    "pasadena": 1.7,
    "long beach": 1.6,
    "irvine": 1.8,
    
    # Boston Area
    "cambridge": 1.8,
    "somerville": 1.7,
    
    # Washington DC Area
    "arlington": 1.6,
    "alexandria": 1.5,
    "bethesda": 1.7,
    
    # Other major US cities
    "minneapolis": 1.2,
    "nashville": 1.2,
    "pittsburgh": 1.0,
    "cleveland": 0.9,
    "st louis": 0.9,
    "columbus": 1.0,
    "indianapolis": 0.9,
    "kansas city": 0.9,
    "salt lake city": 1.1,
    "las vegas": 1.1,
    "san diego": 1.6,
    "sacramento": 1.4,
    
    # International cities
    "paris": 1.8,
    "amsterdam": 1.7,
    "dublin": 1.8,
    "helsinki": 1.6,
    "stockholm": 1.7,
    "copenhagen": 1.8,
    "oslo": 1.9,
    "hong kong": 2.4,
    "seoul": 1.5,
    "mumbai": 1.1,
    "bangalore": 1.0,
    "delhi": 0.9,
    "mexico city": 0.8,
    "sao paulo": 0.9,
    "rio de janeiro": 0.9,
    "buenos aires": 0.7,
    "santiago": 0.8,
    "madrid": 1.3,
    "barcelona": 1.3,
    "rome": 1.4,
    "milan": 1.5,
    "berlin": 1.4,
    "munich": 1.6,
    "frankfurt": 1.5,
    "dubai": 1.6,
    "tel aviv": 1.8,
}

# Add the expanded entries to the main dictionary
COST_OF_LIVING_INDEX.update(EXPANDED_COST_OF_LIVING)

def get_col_for_location(location: str) -> float:
    """
    Get cost of living factor for a location with advanced pattern matching
    Uses multiple matching techniques and caching for better performance
    
    Args:
        location: City name or location string
        
    Returns:
        Cost of living factor (1.0 is baseline)
    """
    if not location or not isinstance(location, str):
        return 1.0
    
    # Check cache first (module-level cache)
    global col_api_cache
    if location.lower().strip() in col_api_cache:
        return col_api_cache[location.lower().strip()]
    
    # Normalize location string
    normalized_location = location.lower().strip()
    
    # 1. Try direct exact match
    if normalized_location in COST_OF_LIVING_INDEX:
        col_api_cache[normalized_location] = COST_OF_LIVING_INDEX[normalized_location]
        return COST_OF_LIVING_INDEX[normalized_location]
    
    # 2. Try partial matches with word boundaries
    # This is more precise than substring matching
    location_words = normalized_location.split()
    
    # Try multi-word city names first (more specific)
    for city_length in range(min(4, len(location_words)), 0, -1):
        for i in range(len(location_words) - city_length + 1):
            potential_city = ' '.join(location_words[i:i+city_length])
            if potential_city in COST_OF_LIVING_INDEX:
                col_api_cache[normalized_location] = COST_OF_LIVING_INDEX[potential_city]
                return COST_OF_LIVING_INDEX[potential_city]
    
    # 3. Try fuzzy matching with weights for city importance
    best_match = None
    best_score = 0
    
    for city, col_factor in COST_OF_LIVING_INDEX.items():
        # Skip default entry
        if city == "default":
            continue
            
        # Simple fuzzy match score - shared words ratio
        city_words = set(city.split())
        input_words = set(location_words)
        
        # Calculate intersection and word similarity
        common_words = city_words.intersection(input_words)
        
        if common_words:
            # Score based on ratio of matching words to total unique words
            match_score = len(common_words) / (len(city_words) + len(input_words) - len(common_words))
            
            # Prioritize capital cities and major metros
            if city in ["london", "new york", "tokyo", "paris", "berlin", "sydney", "singapore"]:
                match_score *= 1.2
                
            if match_score > best_score:
                best_score = match_score
                best_match = city
    
    # Use the best match if it's reasonable (over 40% confident)
    if best_match and best_score > 0.4:
        col_api_cache[normalized_location] = COST_OF_LIVING_INDEX[best_match]
        return COST_OF_LIVING_INDEX[best_match]
    
    # 4. Try rule-based inference for common patterns
    
    # Detect major US city pattern "City, State" or "City State"
    us_city_match = re.search(r'([a-zA-Z\s]+)[,\s]+(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$', normalized_location)
    
    if us_city_match:
        city = us_city_match.group(1).strip().lower()
        state = us_city_match.group(2).lower()
        
        # Check if the city is in our database
        if city in COST_OF_LIVING_INDEX:
            col_api_cache[normalized_location] = COST_OF_LIVING_INDEX[city]
            return COST_OF_LIVING_INDEX[city]
        
        # Apply state-based approximation for US cities not in our database
        high_col_states = ['ca', 'ny', 'ma', 'wa', 'dc', 'hi', 'ak']
        medium_col_states = ['co', 'or', 'mn', 'tx', 'fl', 'il', 'ct', 'nj', 'md']
        
        if state.lower() in high_col_states:
            col_factor = 1.6  # High cost state, unknown city
            col_api_cache[normalized_location] = col_factor
            return col_factor
        elif state.lower() in medium_col_states:
            col_factor = 1.2  # Medium cost state, unknown city
            col_api_cache[normalized_location] = col_factor
            return col_factor
    else:
            col_factor = 1.0  # Lower cost state, unknown city
            col_api_cache[normalized_location] = col_factor
            return col_factor
    
    # 5. Apply country-based approximation for international cities
    countries = {
        'uk': 1.6, 'united kingdom': 1.6, 'britain': 1.6, 'england': 1.6,
        'japan': 1.7, 'australia': 1.6, 'singapore': 1.8,
        'switzerland': 2.0, 'germany': 1.4, 'france': 1.7,
        'canada': 1.5, 'netherlands': 1.6, 'sweden': 1.7,
        'norway': 1.8, 'denmark': 1.7, 'finland': 1.6,
        'italy': 1.4, 'spain': 1.3, 'portugal': 1.2,
        'ireland': 1.7, 'israel': 1.7, 'south korea': 1.5,
        'china': 1.3, 'hong kong': 2.3, 'india': 0.9,
        'brazil': 0.9, 'mexico': 0.8, 'south africa': 0.7,
        'russia': 1.0, 'uae': 1.6, 'saudi arabia': 1.5,
        # Add more countries here
        'austria': 1.5, 'belgium': 1.5, 'czech republic': 1.0,
        'greece': 1.1, 'hungary': 0.8, 'poland': 0.9,
        'turkey': 0.8, 'egypt': 0.7, 'thailand': 0.9,
        'vietnam': 0.7, 'indonesia': 0.8, 'malaysia': 0.9,
        'philippines': 0.7, 'argentina': 0.8, 'chile': 0.9,
        'colombia': 0.7, 'peru': 0.7, 'venezuela': 0.7,
        'nigeria': 0.7, 'kenya': 0.7, 'ghana': 0.6,
        'morocco': 0.7, 'tunisia': 0.7, 'iran': 0.8,
        'pakistan': 0.7, 'bangladesh': 0.6, 'sri lanka': 0.7,
        'new zealand': 1.5
    }
    
    for country, factor in countries.items():
        if country in normalized_location:
            col_api_cache[normalized_location] = factor
            return factor
    
    # 6. Apply city size and regional context heuristics as last resort
    city_size_indicators = {
        'metro': 1.3, 'metropolitan': 1.3, 'greater': 1.2,
        'downtown': 1.4, 'central': 1.3, 'urban': 1.2,
        'city': 1.2, 'capital': 1.4, 'financial district': 1.5,
        'suburb': 1.1, 'suburban': 1.1, 'outskirts': 0.9,
        'rural': 0.7, 'village': 0.7, 'town': 0.8,
        'island': 1.2, 'beach': 1.3, 'coastal': 1.2,
        'university': 1.2, 'college': 1.1, 'commercial': 1.3,
        'industrial': 0.9, 'tech hub': 1.4, 'tech center': 1.4,
        'resort': 1.4, 'tourist': 1.3
    }
    
    # Check for city size indicators
    for indicator, factor in city_size_indicators.items():
        if indicator in normalized_location:
            col_api_cache[normalized_location] = factor
            return factor
    
    # 7. Use region-based estimation if available
    regions = {
        'north america': 1.2, 'western europe': 1.5, 'northern europe': 1.6,
        'eastern europe': 0.9, 'southern europe': 1.1, 'asia': 1.0,
        'southeast asia': 0.8, 'east asia': 1.3, 'south asia': 0.7,
        'middle east': 1.2, 'africa': 0.8, 'south america': 0.8,
        'central america': 0.7, 'caribbean': 1.0, 'pacific': 1.2,
        'scandinavia': 1.7, 'mediterranean': 1.3, 'oceania': 1.4,
        'latin america': 0.8, 'balkans': 0.9, 'central europe': 1.1
    }
    
    for region, factor in regions.items():
        if region in normalized_location:
            col_api_cache[normalized_location] = factor
            return factor
    
    # 8. Use LLM as a final fallback for unknown locations
    try:
        # Create a sample of 10 cities with their cost of living factors for the LLM
        sample_cities = [
            {"city": "San Francisco", "col_factor": 2.5},
            {"city": "New York", "col_factor": 2.3},
            {"city": "Los Angeles", "col_factor": 1.8},
            {"city": "Chicago", "col_factor": 1.3},
            {"city": "Austin", "col_factor": 1.2},
            {"city": "Atlanta", "col_factor": 1.0},
            {"city": "Detroit", "col_factor": 0.9},
            {"city": "Phoenix", "col_factor": 1.1},
            {"city": "Denver", "col_factor": 1.2},
            {"city": "Miami", "col_factor": 1.2}
        ]
        
        # Call LLM for location estimation
        prompt = f"""Given a list of cities with their cost of living factors (where 1.0 is the US national average):
        {json.dumps(sample_cities)}
        
        Please provide only a cost of living factor between 0.6 and 2.8 for: {normalized_location}
        Reply with just the decimal number."""
        
        llm_result = call_gemini_llm(prompt, "col_estimation", sample_cities)
        
        if isinstance(llm_result, dict) and "col_factor" in llm_result:
            # Use the LLM-provided value if it's reasonable
            estimated_factor = float(llm_result["col_factor"])
            if 0.6 <= estimated_factor <= 2.8:
                col_api_cache[normalized_location] = estimated_factor
                return estimated_factor
    except Exception as e:
        logging.error(f"Error using LLM for location COL estimation: {e}")
    
    # Fallback to default
    col_api_cache[normalized_location] = 1.0  # Cache the default too
    return 1.0  # Default if no matches found

# Cache for COL API requests to avoid redundant calls
col_api_cache = {}

def fetch_col_from_api(location: str) -> float:
    """
    Fetch cost of living data from external API
    This is a placeholder for real API implementation
    Uses caching to minimize API calls
    
    NOTE: This is commented out to avoid API costs in development
    To use this function, uncomment and connect to a real COL API
    """
    # Check cache first
    if location in col_api_cache:
        return col_api_cache[location]
    
    try:
        # This is where you would implement an actual API call
        # Example for illustration (not actually executed):
        """
        response = requests.get(
            "https://api.costoflivingdb.com/v1/cities", 
            params={"q": location, "api_key": os.getenv("COL_API_KEY")}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("results"):
                col_index = data["results"][0].get("col_index", 100) / 100
                col_api_cache[location] = col_index
                return col_index
        """
        
        # For now, fall back to our static database
        col_index = get_col_for_location(location)
        col_api_cache[location] = col_index
        return col_index
    
    except Exception as e:
        logging.error(f"Error fetching COL data: {str(e)}")
        # Fall back to our static method
        return get_col_for_location(location)

# Work mode adjustment factors (affects salary expectations)
WORK_MODE_FACTORS = {
    "remote": 0.9,        # Remote workers may accept slightly lower pay
    "hybrid": 1.0,        # Baseline
    "in-office": 1.1      # Office workers typically expect higher compensation
}

# Expected salary ranges by seniority level (baseline for medium cost area, hybrid work)
# These are relative factors; multiply by a base salary for your industry
SALARY_EXPECTATIONS_BY_SENIORITY = {
    0.1: 0.5,    # Entry level: 50% of mid-level salary
    0.2: 0.7,    # Junior: 70% of mid-level
    0.3: 0.85,   # Junior-mid: 85% of mid-level
    0.4: 1.0,    # Mid level: 100% (baseline)
    0.5: 1.2,    # Mid-senior: 120% of mid-level
    0.6: 1.4,    # Senior: 140% of mid-level
    0.7: 1.6,    # Staff/Principal: 160% of mid-level
    0.8: 2.0,    # Director: 200% of mid-level
    0.9: 2.5,    # VP/Executive: 250% of mid-level
    1.0: 3.0     # C-Suite: 300% of mid-level
}

# Industry salary adjustment factors
INDUSTRY_SALARY_FACTORS = {
    "technology": 1.3,      # Tech industry typically pays more
    "finance": 1.2,         # Financial sector also pays well
    "healthcare": 1.0,      # Healthcare is baseline
    "education": 0.8,       # Education typically pays less
    "retail": 0.7,          # Retail typically pays less
    "manufacturing": 0.9,   # Manufacturing slightly below baseline
    "government": 0.9,      # Government jobs slightly below baseline
    "nonprofit": 0.7        # Nonprofit typically pays less
}

# Seniority level attrition risk mapping
# According to research, mid-senior employees are most likely to leave
SENIORITY_ATTRITION_RISK = {
    0.0: 0.3,   # No seniority info
    0.1: 0.3,   # Entry level (lower risk as they're building experience)
    0.2: 0.4,   # Junior level (building career)
    0.3: 0.5,   # Junior-mid level (starting to consider options)
    0.4: 0.6,   # Mid level (high risk - actively seeking advancement)
    0.5: 0.7,   # Mid-senior level (highest risk - marketable & seeking growth)
    0.6: 0.6,   # Senior level (high risk but more selective)
    0.7: 0.5,   # Staff/Principal level (moderate risk - seeking specific opportunities)
    0.8: 0.4,   # Director level (lower risk - established)
    0.9: 0.3,   # VP/Executive level (lower risk - compensation & position stability)
    1.0: 0.2    # C-Suite (lowest risk - peak position)
}

# Scaling parameters for tenure-based attrition
# Based on common tenure patterns where risk increases after certain periods
TENURE_RISK_THRESHOLDS = {
    "honeymoon_end": 9,     # Months before initial enthusiasm fades
    "assessment_period": 18, # Months when people evaluate if this is right long-term
    "growth_plateau": 36,    # Months when growth may plateau
    "significant_milestone": 60, # 5-year milestone where people reassess
    "long_tenure": 84       # 7+ years, may seek new challenges
}

# Expected project count by seniority level
EXPECTED_PROJECTS_BY_SENIORITY = {
    0.1: 1,  # Entry level: 1 project
    0.2: 1,  # Junior: 1 project
    0.3: 2,  # Junior-mid: 2 projects
    0.4: 2,  # Mid level: 2 projects
    0.5: 3,  # Mid-senior: 3 projects
    0.6: 3,  # Senior: 3 projects
    0.7: 4,  # Staff/Principal: 4 projects 
    0.8: 4,  # Director: 4 projects
    0.9: 5,  # VP/Executive: 5 projects
    1.0: 5   # C-Suite: 5 projects
}

# --- Global Variables for Vector Search ---
role_vector_index = None
role_keys = None
responsibility_vector_index = None
responsibility_types = None

# --- LLM Integration for Fallback Analysis ---
def get_gemini_api_key():
    """Get Gemini API key from environment variables"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logging.warning("GEMINI_API_KEY not found in environment variables")
    return api_key

def call_gemini_llm(query: str, task_type: str, examples: List[Dict[str, Any]], 
                    api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Call Gemini API for fallback analysis when vector search fails
    Only used as a last resort
    
    Args:
        query: The text to analyze
        task_type: The type of analysis ("responsibility_match", "role_match", etc.)
        examples: A few representative examples with scores
        api_key: Gemini API key (optional)
    
    Returns:
        Dictionary with analysis results
    """
    if not api_key:
        api_key = get_gemini_api_key()
        
    if not api_key:
        logging.error("No Gemini API key available for LLM fallback")
        return {"error": "No API key available"}
    
    try:
        # Prepare examples as a nicely formatted string
        examples_text = ""
        
        if task_type == "responsibility_match":
            examples_text = "\n".join([
                f"- Management: {ex.get('management', 0):.2f}, Technical Leadership: {ex.get('technical_leadership', 0):.2f}, " +
                f"Execution: {ex.get('execution', 0):.2f}"
                for ex in examples
            ])
            
            prompt = f"""
            I need to analyze the job responsibilities/duties below and categorize them:
            
            "{query}"
            
            Please classify this into the following categories with values between 0.0 and 1.0 that sum to 1.0:
            - management: Tasks involving managing people, projects, or processes
            - technical_leadership: Tasks involving technical guidance, architecture, or design
            - execution: Tasks involving direct implementation or hands-on work
            
            Examples of classifications:
            {examples_text}
            
            Provide your analysis in JSON format with keys: management, technical_leadership, and execution
            """
        
        elif task_type == "role_match":
            examples_text = "\n".join([
                f"- Role: '{ex.get('role', '')}', Level: {ex.get('level', 0):.2f}"
                for ex in examples
            ])
            
            prompt = f"""
            I need to analyze the job title below and determine its seniority level:
            
            "{query}"
            
            The seniority level should be between 0.1 (entry level) and 1.0 (executive).
            
            Examples:
            {examples_text}
            
            Please provide the seniority level as a number between 0.1 and 1.0, and the closest matching role.
            Format your response as valid JSON with keys: seniority_level, matched_role
            """
            
        elif task_type == "col_estimation":
            # For cost of living estimation
            prompt = query  # Use the provided prompt directly
            
        elif task_type == "work_mode_match":
            # For work mode matching
            prompt = query  # Use the provided prompt directly
            
        elif task_type == "industry_match":
            # For industry matching and salary factor estimation
            prompt = query  # Use the provided prompt directly
        
        else:
            return {"error": "Unknown task type for LLM analysis"}
        
        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
        headers = {
            "Content-Type": "application/json"
        }
        
        data = {
            "contents": [{"parts":[{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "topP": 0.8,
                "topK": 40
            }
        }
        
        response = requests.post(
            f"{url}?key={api_key}",
            headers=headers,
            json=data
        )
        
        if response.status_code != 200:
            logging.error(f"Gemini API error: {response.status_code} - {response.text}")
            return {"error": "API error"}
            
        response_json = response.json()
        
        # Extract the text from the response
        text = response_json["candidates"][0]["content"]["parts"][0]["text"]
        
        # For the new task types that expect simple values
        if task_type == "col_estimation":
            # Extract just the number from the response
            try:
                # Look for a decimal number in the response
                match = re.search(r'(\d+\.\d+|\d+)', text)
                if match:
                    col_factor = float(match.group(1))
                    # Ensure it's in a reasonable range
                    col_factor = max(0.6, min(2.8, col_factor))
                    return {"col_factor": col_factor}
                else:
                    return {"col_factor": 1.0}  # Default if not found
            except Exception as e:
                logging.error(f"Error parsing COL factor: {e}")
                return {"col_factor": 1.0}
                
        elif task_type == "work_mode_match":
            # Extract the work mode category
            text_lower = text.lower().strip()
            if "remote" in text_lower:
                return {"work_mode": "remote"}
            elif "hybrid" in text_lower:
                return {"work_mode": "hybrid"}
            elif "office" in text_lower or "in-office" in text_lower or "onsite" in text_lower:
                return {"work_mode": "in-office"}
            else:
                return {"work_mode": "hybrid"}  # Default to hybrid if unclear
                
        elif task_type == "industry_match":
            # Extract just the industry factor number
            try:
                # Look for a decimal number in the response
                match = re.search(r'(\d+\.\d+|\d+)', text)
                if match:
                    industry_factor = float(match.group(1))
                    # Ensure it's in a reasonable range
                    industry_factor = max(0.7, min(1.3, industry_factor))
                    return {"industry_factor": industry_factor}
                else:
                    return {"industry_factor": 1.0}  # Default if not found
            except Exception as e:
                logging.error(f"Error parsing industry factor: {e}")
                return {"industry_factor": 1.0}
        
        # For the original task types that expect JSON
        # Find the JSON part in the response
        json_start = text.find('{')
        json_end = text.rfind('}') + 1
        
        if json_start >= 0 and json_end > json_start:
            try:
                result_json = json.loads(text[json_start:json_end])

                if task_type == "responsibility_match":
                    # Normalize values to ensure they sum to 1.0
                    management = float(result_json.get("management", 0.33))
                    technical = float(result_json.get("technical_leadership", 0.33))
                    execution = float(result_json.get("execution", 0.34))
                    
                    total = management + technical + execution
                    
                    # If total is not 0, normalize
                    if total > 0:
                        management = management / total
                        technical = technical / total
                        execution = execution / total
                    else:
                        # Default distribution
                        management = 0.33
                        technical = 0.33
                        execution = 0.34
                    
                    return {
                        "management": management,
                        "technical_leadership": technical,
                        "execution": execution,
                        "analysis_method": "llm_analysis"
                    }
                    
                elif task_type == "role_match":
                    seniority_level = float(result_json.get("seniority_level", 0.5))
                    # Clamp to valid range
                    seniority_level = max(0.1, min(1.0, seniority_level))
                    
                    matched_role = result_json.get("matched_role", "unknown")
                    
                    return {
                        "seniority_level": seniority_level,
                        "matched_role": matched_role,
                        "analysis_method": "llm_analysis"
                    }
            except Exception as e:
                logging.error(f"Error parsing LLM JSON response: {e}")
        
        # Unable to parse structured data
        return {"error": "Failed to parse LLM response"}
        
    except Exception as e:
        logging.error(f"Error calling Gemini LLM: {e}")
        return {"error": str(e)}

def initialize_vector_indexes():
    """Initialize vector search indexes for responsibility and role matching"""
    global role_vector_index, role_keys, responsibility_vector_index, responsibility_types
    
    if model is None:
        logging.error("Model not loaded, cannot initialize vector search")
        return
    
    try:
        # Initialize role vector index
        role_keys = list(SENIORITY_ATTRITION_RISK.keys())
        role_keys_str = [f"Level {k}" for k in role_keys]  # Convert to string for encoding
        role_embeddings = model.encode(role_keys_str, convert_to_numpy=True)
        
        # Get dimension of embeddings
        dimension = role_embeddings.shape[1]
        
        # Initialize FAISS index
        role_vector_index = faiss.IndexFlatL2(dimension)
        
        # Add role vectors to the index
        role_vector_index.add(role_embeddings.astype(np.float32))
        
        logging.info(f"Initialized role vector index with {len(role_keys)} items")
        
        # Initialize responsibility type index
        responsibility_types = ["management", "technical_leadership", "execution"]
        resp_descriptions = [
            "Managing people, overseeing projects, leadership responsibilities",
            "Technical guidance, architecture design, mentoring, technical decisions",
            "Hands-on implementation, coding, testing, operational tasks"
        ]
        resp_embeddings = model.encode(resp_descriptions, convert_to_numpy=True)
        
        # Initialize FAISS index for responsibilities
        responsibility_vector_index = faiss.IndexFlatL2(dimension)
        
        # Add responsibility vectors to the index
        responsibility_vector_index.add(resp_embeddings.astype(np.float32))
        
        logging.info(f"Initialized responsibility vector index with {len(responsibility_types)} items")
    except Exception as e:
        logging.error(f"Error initializing vector indexes: {e}")

def vector_search_responsibilities(query: str) -> Dict[str, float]:
    """
    Use vector search to determine the distribution of responsibility types
    Returns a dictionary with responsibility types and their proportions
    """
    if not query or model is None or responsibility_vector_index is None:
        # Default distribution
        return {
            "management": 0.33,
            "technical_leadership": 0.33,
            "execution": 0.34
        }
    
    try:
        # Encode the query
        query_embedding = model.encode([query], convert_to_numpy=True).astype(np.float32)
        
        # Search the index
        distances, indices = responsibility_vector_index.search(query_embedding, len(responsibility_types))
        
        # Convert L2 distances to similarities (cosine-like)
        similarities = 1 - (distances[0] / 2)
        
        # Create distribution based on similarities
        total_similarity = sum(similarities)
        
        if total_similarity > 0:
            distribution = {}
            for i, resp_type in enumerate(responsibility_types):
                distribution[resp_type] = float(similarities[i] / total_similarity)
            return distribution
        else:
            # Default distribution
            return {
                "management": 0.33,
                "technical_leadership": 0.33,
                "execution": 0.34
            }
    
    except Exception as e:
        logging.error(f"Error in vector search for responsibilities: {e}")
        # Default distribution
        return {
            "management": 0.33,
            "technical_leadership": 0.33,
            "execution": 0.34
        }

def vector_search_seniority(job_title: str) -> float:
    """
    Use vector search to find the closest matching seniority level
    Returns a seniority level from 0.1 to 1.0
    """
    if not job_title or model is None or role_vector_index is None:
        return 0.5  # Default mid-level
    
    try:
        # Encode the query
        query_embedding = model.encode([job_title], convert_to_numpy=True).astype(np.float32)
        
        # Search the index
        distances, indices = role_vector_index.search(query_embedding, 2)  # Get top 2 matches
        
        # Get the best match
        best_idx = indices[0][0]
        
        if best_idx >= 0 and best_idx < len(role_keys):
            return role_keys[best_idx]
        
        return 0.5  # Default mid-level
        
    except Exception as e:
        logging.error(f"Error in vector search for seniority: {e}")
        return 0.5  # Default mid-level

# --- MongoDB Connection ---
client = None
db = None
model = None

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
            # Ensure index for faster lookups
            db[OUTPUT_COLLECTION].create_index("email", unique=True)
            db[USERS_COLLECTION].create_index("email", unique=True)
            logging.info(f"Ensured index on 'email' in {OUTPUT_COLLECTION} and {USERS_COLLECTION}")
    except ConnectionFailure as e:
        logging.error(f"MongoDB connection failed: {e}")
        client = None
        db = None
    except Exception as e:
        logging.error(f"An error occurred during DB connection: {e}")
        client = None
        db = None

def load_model():
    """Load sentence transformer model and initialize vector indexes"""
    global model
    try:
        logging.info("Loading sentence transformer model...")
        start_time = time.time()
        # Use a lightweight model for efficiency
        model = SentenceTransformer('all-MiniLM-L6-v2')
        logging.info(f"Model loaded in {time.time() - start_time:.2f} seconds")
        
        # Initialize vector indexes
        initialize_vector_indexes()
    except Exception as e:
        logging.error(f"Error loading model: {e}")
        model = None

# --- Helper Functions ---
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

def calculate_responsibility_mismatch(
    job_responsibilities, 
    job_title: str
) -> Dict[str, Any]:
    """
    Calculate mismatch between responsibilities and seniority level
    Now uses vector search for more accurate responsibility categorization
    Higher score = higher attrition risk
    """
    # Handle string input for job_responsibilities (error case)
    if isinstance(job_responsibilities, str):
        return {"mismatch_score": 0.5, "explanation": "No structured responsibility data available"}
        
    # For list input (job duties), convert to expected responsibility_analysis format
    if isinstance(job_responsibilities, list):
        # Get seniority level based on job title
        seniority_level = get_seniority_level(job_title)
        
        # Create a simplified responsibility analysis
        responsibility_analysis = {
            "expected_distribution": {
                "management": max(0.1, seniority_level * 0.5),
                "technical_leadership": max(0.2, seniority_level * 0.3),
                "execution": max(0.3, 1.0 - seniority_level * 0.7)
            },
            "role_distribution": {
                "management": 0.1,
                "technical_leadership": 0.2,
                "execution": 0.7
            }
        }
        
        # Try to determine actual roles from job duties using vector search
        if job_responsibilities:
            all_duties = []
            
            # Combine all duty descriptions
            for duty in job_responsibilities:
                if isinstance(duty, dict):
                    duty_desc = duty.get("duty", "") or duty.get("jobDuties", "")
                    if not duty_desc:
                        continue
                    all_duties.append(duty_desc)
            
            # If we have duties, analyze them with vector search
            if all_duties:
                combined_duties = " ".join(all_duties)
                
                # Use vector search to determine responsibility distribution
                if model is not None and responsibility_vector_index is not None:
                    distribution = vector_search_responsibilities(combined_duties)
                    responsibility_analysis["role_distribution"] = distribution
                else:
                    # Analyze individual duties with keyword matching
                    management_count = 0
                    leadership_count = 0
                    execution_count = 0
                    total_count = len(all_duties)
                    
                    for duty_desc in all_duties:
                        duty_lower = duty_desc.lower()
                        
                        # Count different types of responsibilities
                        if any(word in duty_lower for word in ["manage", "director", "lead", "oversee", "supervise"]):
                            management_count += 1
                        elif any(word in duty_lower for word in ["architect", "design", "strategy", "mentor", "guide"]):
                            leadership_count += 1
                        else:
                            execution_count += 1
                    
                    # Update the role distribution
                    responsibility_analysis["role_distribution"] = {
                        "management": management_count / total_count,
                        "technical_leadership": leadership_count / total_count,
                        "execution": execution_count / total_count
                    }
                
                # If the analysis yielded all zeros or unrealistic distribution, use LLM as fallback
                if all(v == 0 for v in responsibility_analysis["role_distribution"].values()):
                    # Use LLM for analysis
                    examples = [
                        {"management": 0.7, "technical_leadership": 0.2, "execution": 0.1},
                        {"management": 0.2, "technical_leadership": 0.3, "execution": 0.5},
                        {"management": 0.1, "technical_leadership": 0.1, "execution": 0.8}
                    ]
                    
                    llm_result = call_gemini_llm(combined_duties, "responsibility_match", examples)
                    if "error" not in llm_result:
                        responsibility_analysis["role_distribution"] = {
                            "management": llm_result.get("management", 0.33),
                            "technical_leadership": llm_result.get("technical_leadership", 0.33),
                            "execution": llm_result.get("execution", 0.34)
                        }
    else:
        # Use the provided responsibility_analysis
        responsibility_analysis = job_responsibilities
    
    # Continue with normal processing
    if not responsibility_analysis:
        return {"mismatch_score": 0.5, "explanation": "No responsibility data available"}
    
    # Get expected and actual distribution
    expected_distribution = responsibility_analysis.get("expected_distribution", {})
    actual_distribution = responsibility_analysis.get("role_distribution", {})
    
    if not expected_distribution or not actual_distribution:
        return {"mismatch_score": 0.5, "explanation": "Incomplete responsibility data"}
    
    # Calculate mismatch for each responsibility type
    mismatches = []
    total_gap = 0
    positive_gaps = 0
    negative_gaps = 0
    
    for role_type, expected in expected_distribution.items():
        actual = actual_distribution.get(role_type, 0)
        gap = actual - expected
        total_gap += abs(gap)
        
        if gap > 0.2:  # Doing significantly more than expected
            positive_gaps += gap
        elif gap < -0.2:  # Doing significantly less than expected
            negative_gaps += abs(gap)
            
        mismatches.append({
            "role_type": role_type,
            "expected": expected,
            "actual": actual,
            "gap": gap
        })
    
    avg_mismatch = total_gap / len(expected_distribution) if expected_distribution else 0
    
    # Calculate mismatch score (0-1 scale, higher = higher attrition risk)
    # We weight positive gaps (doing more than expected) higher than negative gaps
    # for attrition risk as they often indicate being overworked
    mismatch_score = (positive_gaps * 0.7) + (negative_gaps * 0.3)
    
    # Apply sigmoid function to normalize between 0-1
    # Formula: 1 / (1 + e^(-6*(x-0.5)))
    normalized_score = 1 / (1 + math.exp(-6 * (mismatch_score - 0.5)))
    
    # Determine primary explanation
    explanation = "Responsibilities align with seniority level"
    if positive_gaps > 0.3:
        if "management" in [m["role_type"] for m in mismatches if m["gap"] > 0.2]:
            explanation = "Managing more than expected for seniority level"
        elif "technical_leadership" in [m["role_type"] for m in mismatches if m["gap"] > 0.2]:
            explanation = "Providing more technical leadership than expected for level"
        else:
            explanation = "Taking on more responsibilities than expected for level"
    elif negative_gaps > 0.3:
        explanation = "Not being utilized at appropriate seniority level"
    
    return {
        "mismatch_score": normalized_score,
        "avg_gap": avg_mismatch,
        "positive_gaps": positive_gaps,
        "negative_gaps": negative_gaps,
        "detailed_mismatches": mismatches,
        "explanation": explanation
    }

def calculate_tenure_factor(
    company_months: int, 
    role_months: int
) -> Dict[str, Any]:
    """
    Calculate tenure-based attrition risk
    Considers both company tenure and time in current role
    Applies 'growth plateau' concept where risk increases after certain periods
    """
    # Default values if no data
    if company_months <= 0 and role_months <= 0:
        return {
            "tenure_score": 0.5,
            "explanation": "No tenure data available",
            "company_tenure_months": 0,
            "role_tenure_months": 0
        }
    
    # Ensure valid values
    company_months = max(0, company_months)
    role_months = max(0, min(role_months, company_months))
    
    # If role_months is 0 but company_months is valid, estimate role_months
    if role_months == 0 and company_months > 0:
        role_months = min(company_months, 12)  # Assume at least in role for up to 1 year
    
    # Company tenure risk factors
    # Risk is highest at these key transition points
    # Uses a modified Gaussian function for each risk period
    honeymoon_risk = math.exp(-0.5 * ((company_months - TENURE_RISK_THRESHOLDS["honeymoon_end"]) / 3) ** 2)
    assessment_risk = math.exp(-0.5 * ((company_months - TENURE_RISK_THRESHOLDS["assessment_period"]) / 6) ** 2)
    plateau_risk = math.exp(-0.5 * ((company_months - TENURE_RISK_THRESHOLDS["growth_plateau"]) / 9) ** 2)
    milestone_risk = math.exp(-0.5 * ((company_months - TENURE_RISK_THRESHOLDS["significant_milestone"]) / 12) ** 2)
    long_tenure_risk = 0
    if company_months > TENURE_RISK_THRESHOLDS["long_tenure"]:
        # For long tenure, risk increases with time
        long_tenure_risk = min(0.8, (company_months - TENURE_RISK_THRESHOLDS["long_tenure"]) / 60)
    
    # Combined company tenure risk
    company_risk = max(honeymoon_risk, assessment_risk, plateau_risk, milestone_risk, long_tenure_risk)
    
    # Role tenure risk - people often want to move to new roles after 18-24 months
    if role_months < 3:
        # Very new in role - low risk
        role_risk = 0.1
    elif role_months < 12:
        # Still learning role - increasing slightly
        role_risk = 0.2 + (role_months / 60)
    elif role_months < 24:
        # Comfortable in role - risk rises
        role_risk = 0.3 + ((role_months - 12) / 24)
    elif role_months < 36:
        # Potential growth plateau - high risk
        role_risk = 0.6 + ((role_months - 24) / 60)
    else:
        # Long time in same role - very high risk
        role_risk = min(0.9, 0.7 + ((role_months - 36) / 48))
    
    # Growth stagnation factor - measures if they've been in the same role too long relative to company tenure
    # Higher ratio = higher risk of feeling stagnant
    stagnation_ratio = min(1.0, role_months / max(1, company_months))
    stagnation_factor = 0
    if company_months > 24:  # Only apply after 2 years
        stagnation_factor = stagnation_ratio * 0.6  # Scale the impact
    
    # Combined score (weighted 40% company tenure, 40% role tenure, 20% stagnation)
    tenure_score = (company_risk * 0.4) + (role_risk * 0.4) + (stagnation_factor * 0.2)
    
    # Determine explanation
    explanation = "Normal tenure progression"
    if honeymoon_risk > 0.7:
        explanation = "End of initial honeymoon period"
    elif assessment_risk > 0.7:
        explanation = "Approaching critical job assessment period"
    elif plateau_risk > 0.7:
        explanation = "Potential growth plateau"
    elif milestone_risk > 0.7:
        explanation = "Significant tenure milestone - may be reassessing"
    elif long_tenure_risk > 0.6:
        explanation = "Extended tenure may indicate seeking new challenges"
    elif stagnation_factor > 0.5:
        explanation = "Long time in same role relative to company tenure"
    elif role_risk > 0.7:
        explanation = "Extended time in current role"
    
    return {
        "tenure_score": tenure_score,
        "company_tenure_months": company_months,
        "role_tenure_months": role_months,
        "company_risk": company_risk,
        "role_risk": role_risk,
        "stagnation_factor": stagnation_factor,
        "explanation": explanation
    }

def calculate_utilization_factor(utilization_assessment: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate attrition risk based on utilization level
    Both under and over-utilization increase risk
    """
    if not utilization_assessment:
        return {"utilization_attrition_score": 0.5, "current_utilization": 0.5, "utilization_status": "unknown", "explanation": "No utilization data"}
    
    # Extract utilization metrics - check several possible locations for the score
    utilization_score = 0.5  # Default value
    
    # Try to find utilization score in different possible locations
    if isinstance(utilization_assessment, dict):
        # Direct access to utilization_score field
        if "utilization_score" in utilization_assessment:
                            utilization_score = utilization_assessment.get("utilization_score", 0.5)
        # Check in utilization_assessment.utilization_assessment.utilization_score
        elif "utilization_assessment" in utilization_assessment:
            inner_assessment = utilization_assessment.get("utilization_assessment", {})
            if isinstance(inner_assessment, dict):
                utilization_score = inner_assessment.get("utilization_score", 0.5)
        # Check in utilizationAssessment
        elif "utilizationAssessment" in utilization_assessment:
            util_assessment = utilization_assessment.get("utilizationAssessment", {})
            if isinstance(util_assessment, dict):
                if "utilization_score" in util_assessment:
                    utilization_score = util_assessment.get("utilization_score", 0.5)
                elif "utilization_assessment" in util_assessment:
                    inner_inner = util_assessment.get("utilization_assessment", {})
                    if isinstance(inner_inner, dict):
                        utilization_score = inner_inner.get("utilization_score", 0.5)
    
    # Get utilization status
    utilization_status = "unknown"
    if isinstance(utilization_assessment, dict):
        # Try direct access
        if "utilization_status" in utilization_assessment:
                            utilization_status = utilization_assessment.get("utilization_status", "unknown")
        # Check in utilization_assessment
        elif "utilization_assessment" in utilization_assessment:
            inner_assessment = utilization_assessment.get("utilization_assessment", {})
            if isinstance(inner_assessment, dict):
                utilization_status = inner_assessment.get("utilization_status", "unknown")
        # Check in utilizationAssessment
        elif "utilizationAssessment" in utilization_assessment:
            util_assessment = utilization_assessment.get("utilizationAssessment", {})
            if isinstance(util_assessment, dict):
                if "utilization_status" in util_assessment:
                    utilization_status = util_assessment.get("utilization_status", "unknown")
                elif "utilization_assessment" in util_assessment:
                    inner_inner = util_assessment.get("utilization_assessment", {})
                    if isinstance(inner_inner, dict):
                        utilization_status = inner_inner.get("utilization_status", "unknown")
    
    # Calculate deviation from optimal utilization (0.6 is considered ideal)
    # Higher deviation in either direction increases attrition risk
    optimal_utilization = 0.6
    deviation = abs(utilization_score - optimal_utilization)
    
    # Convert deviation to attrition risk (higher deviation = higher risk)
    # We use an exponential function to amplify the effect of larger deviations
    attrition_risk = min(1.0, deviation * 1.8)
    
    # Adjust based on utilization status
    if utilization_status == "severely_underutilized":
        attrition_risk = max(attrition_risk, 0.8)
        explanation = "Severely underutilized employees are at high risk of leaving due to boredom or feeling unvalued"
    elif utilization_status == "underutilized":
        attrition_risk = max(attrition_risk, 0.6)
        explanation = "Underutilized employees are at increased risk of seeking more engaging opportunities"
    elif utilization_status == "optimal":
        attrition_risk = min(attrition_risk, 0.3)
        explanation = "Optimally utilized employees are generally satisfied with their workload"
    elif utilization_status == "highly_utilized":
        attrition_risk = max(attrition_risk, 0.7)
        explanation = "Highly utilized employees are at increased risk of burnout and seeking better work-life balance"
    elif utilization_status == "overutilized":
        attrition_risk = max(attrition_risk, 0.85)
        explanation = "Overutilized employees are at severe risk of burnout and likely to seek less demanding roles"
    else:
        explanation = f"Utilization deviates from optimal level (score: {utilization_score:.2f})"
    
    return {
        "utilization_attrition_score": attrition_risk,
        "current_utilization": utilization_score,
        "utilization_status": utilization_status, 
        "explanation": explanation
    }
    
def calculate_seniority_factor(job_title: str) -> Dict[str, Any]:
    """
    Calculate attrition risk based on seniority level
    Research suggests mid-senior employees are most likely to leave
    """
    # Get estimated seniority level
    seniority_level = get_seniority_level(job_title)
    
    # Round to nearest 0.1 for lookup
    rounded_level = round(seniority_level * 10) / 10
    
    # Get attrition risk for this seniority level
    # Default to mid-level if not found
    attrition_risk = SENIORITY_ATTRITION_RISK.get(rounded_level, SENIORITY_ATTRITION_RISK[0.5])
    
    # Determine category and explanation
    if seniority_level <= 0.2:
        category = "junior"
        explanation = "Junior employees typically building experience before moving"
    elif seniority_level <= 0.4:
        category = "mid"
        explanation = "Mid-level employees often seeking advancement opportunities"
    elif seniority_level <= 0.6:
        category = "senior"
        explanation = "Senior employees highly marketable and seeking growth"
    elif seniority_level <= 0.8:
        category = "lead/principal"
        explanation = "Lead/principal employees selective about opportunities"
    else:
        category = "executive"
        explanation = "Executive-level employees typically have higher stability"
    
    return {
        "seniority_attrition_score": attrition_risk,
        "seniority_level": seniority_level,
        "seniority_category": category,
        "explanation": explanation
    }

def calculate_task_variety_index(
    job_duties: List[Dict[str, Any]], 
    projects: List[Dict[str, Any]],
    tools_proficient: List[str]
) -> Dict[str, Any]:
    """
    Calculate task variety using Shannon entropy
    Higher entropy = more variety = less attrition risk
    """
    # Handle empty inputs
    if not job_duties and not projects and not tools_proficient:
        return {
            "variety_score": 0.5,
            "entropy": 0,
            "explanation": "No data available for task variety analysis"
        }
    
    # Collect all task types
    task_types = []
    
    # Extract tasks from job duties
    if job_duties:
        for duty in job_duties:
            if isinstance(duty, dict):
                duty_desc = duty.get("duty", "") or duty.get("jobDuties", "")
                if duty_desc:
                    task_types.append(duty_desc)
    
    # Extract tasks from projects
    if projects:
        for project in projects:
            if isinstance(project, dict):
                # Add project domain as a task type
                domain = project.get("project_domain", "")
                if domain:
                    task_types.append(f"project_domain:{domain}")
                
                # Add tech stack items as task types
                tech_stack = project.get("tech_stack", [])
                if isinstance(tech_stack, list):
                    for tech in tech_stack:
                        if tech:
                            task_types.append(f"tech:{tech}")
                
                # Add project role as a task type
                user_contribution = project.get("user_contribution", {})
                if isinstance(user_contribution, dict):
                    role = user_contribution.get("role_in_project", "")
                    if role:
                        task_types.append(f"project_role:{role}")
    
    # Add tools as task types
    if tools_proficient:
        if isinstance(tools_proficient, list):
            for tool in tools_proficient:
                if tool:
                    task_types.append(f"tool:{tool}")
        elif isinstance(tools_proficient, str):
            # Handle comma-separated string
            for tool in tools_proficient.split(','):
                tool = tool.strip()
                if tool:
                    task_types.append(f"tool:{tool}")
    
    # Calculate Shannon entropy if we have tasks
    if not task_types:
        return {
            "variety_score": 0.5,
            "entropy": 0,
            "explanation": "Insufficient task data for variety analysis"
        }
    
    # Count frequency of each task type
    task_counts = {}
    for task in task_types:
        task_counts[task] = task_counts.get(task, 0) + 1
    
    # Calculate probabilities
    total_tasks = len(task_types)
    probabilities = [count / total_tasks for count in task_counts.values()]
    
    # Shannon entropy calculation: -Σ(p_i * log(p_i))
    entropy = -sum(p * math.log(p, 2) for p in probabilities if p > 0)
    
    # Normalize entropy to a 0-1 scale
    # Maximum entropy for n unique tasks is log2(n)
    max_entropy = math.log(len(task_counts), 2) if len(task_counts) > 0 else 1
    normalized_entropy = entropy / max_entropy if max_entropy > 0 else 0
    
    # Calculate variety score - inverse of attrition risk
    # Higher variety (entropy) = lower attrition risk
    variety_score = normalized_entropy
    
    # Convert to attrition risk (inverse relationship)
    # We use a custom function to model this relationship:
    # - Very low variety (< 0.3) = high attrition risk (> 0.7)
    # - Medium variety (0.3-0.7) = moderate risk (0.3-0.7)
    # - High variety (> 0.7) = low risk (< 0.3)
    attrition_risk = 1 - variety_score
    
    # Apply additional weightings based on research
    # Extremely high variety can also be problematic (lack of focus)
    if variety_score > 0.9:
        attrition_risk = 0.3  # Cap the benefit of extreme variety
    
    # Determine explanation
    if variety_score < 0.3:
        explanation = "Low task variety - high risk of monotony and boredom"
    elif variety_score < 0.5:
        explanation = "Below average task variety - may benefit from diversification"
    elif variety_score < 0.7:
        explanation = "Moderate task variety - balanced workload"
    elif variety_score < 0.9:
        explanation = "High task variety - engaging and diverse workload"
    else:
        explanation = "Very high task variety - potentially unfocused but engaging"
    
    # Count unique categories
    unique_duties = len(set(task for task in task_types if "duty" in task))
    unique_projects = len(set(task for task in task_types if "project" in task))
    unique_tools = len(set(task for task in task_types if "tool" in task))
    
    return {
        "task_variety_index": variety_score,
        "attrition_risk": attrition_risk,
        "entropy": entropy,
        "normalized_entropy": normalized_entropy,
        "unique_task_count": len(task_counts),
        "total_tasks": total_tasks,
        "unique_categories": {
            "duties": unique_duties,
            "projects": unique_projects,
            "tools": unique_tools
        },
        "explanation": explanation
    }

def calculate_job_intensity_factor(job_intensity_analysis: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate attrition risk based on job intensity
    Higher intensity can lead to burnout and attrition
    Enhanced to handle different manager types more accurately
    """
    # Handle missing or empty input
    if not job_intensity_analysis:
        # Try to find job_intensity_analysis in different locations
        if isinstance(job_intensity_analysis, dict):
            if "job_intensity_analysis" in job_intensity_analysis:
                job_intensity_analysis = job_intensity_analysis.get("job_intensity_analysis", {})
        
    # If still no valid data
    if not job_intensity_analysis or not isinstance(job_intensity_analysis, dict):
        return {
            "intensity_attrition_score": 0.5,
            "explanation": "No job intensity data available"
        }
    
    # Extract intensity metrics
    weighted_intensity = job_intensity_analysis.get("weighted_intensity", 0.5)
    adjusted_intensity = job_intensity_analysis.get("adjusted_intensity", weighted_intensity)
    total_hours = job_intensity_analysis.get("total_hours", 40)
    workload_factor = job_intensity_analysis.get("workload_factor", 1.0)
    
    # Check if job title is available for context
    job_title = job_intensity_analysis.get("job_title", "")
    if not job_title and "meta" in job_intensity_analysis:
        job_title = job_intensity_analysis.get("meta", {}).get("job_title", "")
    
    # Detailed manager type categorization for intensity adjustment
    manager_category = "unknown"
    manager_intensity_adjustment = 0.0
    
    if job_title and isinstance(job_title, str):
        job_title_lower = job_title.lower()
        
        # Define manager categories by their typical intensity and responsibility level
        high_intensity_managers = [
            "engineering", "development", "tech", "product", "operations", "hr", "human resources",
            "finance", "sales", "marketing", "executive", "director", "vp", "chief"
        ]
        
        medium_intensity_managers = [
            "project", "program", "account", "customer", "team", "quality", "design",
            "support", "service", "clinical", "regional", "district", "branch"
        ]
        
        low_intensity_managers = [
            "office", "administrative", "admin", "facilities", "event", "community",
            "social media", "content", "document", "records", "snack", "certificate"
        ]
        
        # Identify manager type
        if "manager" in job_title_lower:
            # Check for high intensity manager roles
            for mgr_type in high_intensity_managers:
                if mgr_type in job_title_lower:
                    manager_category = "high_intensity"
                    manager_intensity_adjustment = 0.2  # Increase intensity for high-responsibility managers
                    break
                    
            # If not found in high intensity, check medium intensity
            if manager_category == "unknown":
                for mgr_type in medium_intensity_managers:
                    if mgr_type in job_title_lower:
                        manager_category = "medium_intensity"
                        manager_intensity_adjustment = 0.0  # No adjustment for medium intensity
                        break
                        
            # If not found in either, check low intensity
            if manager_category == "unknown":
                for mgr_type in low_intensity_managers:
                    if mgr_type in job_title_lower:
                        manager_category = "low_intensity"
                        manager_intensity_adjustment = -0.2  # Decrease intensity for support managers
                        break
                        
            # If still unknown, default to medium intensity
            if manager_category == "unknown":
                manager_category = "medium_intensity"
                manager_intensity_adjustment = 0.0
    
    # Apply manager type adjustment if applicable
    intensity = adjusted_intensity
    if manager_category != "unknown" and "manager" in job_title.lower():
        # Apply adjustment but keep within reasonable bounds (0.1 to 0.9)
        adjusted_intensity = min(0.9, max(0.1, adjusted_intensity + manager_intensity_adjustment))
    intensity = adjusted_intensity
    
    # Intensity to attrition risk mapping using a sigmoid function
    # Low intensity = moderate attrition risk (boredom)
    # Optimal intensity = lowest attrition risk
    # High intensity = highest attrition risk (burnout)
    
    # Optimal intensity is around 0.6
    optimal_intensity = 0.6
    
    # Calculate deviation from optimal intensity
    intensity_deviation = abs(intensity - optimal_intensity)
    
    # Higher deviation increases risk, but high intensity is worse than low intensity
    if intensity > optimal_intensity:
        # High intensity (potential burnout)
        intensity_factor = 0.5 + (0.5 * min(1, (intensity - optimal_intensity) * 2.5))
    else:
        # Low intensity (potential boredom)
        intensity_factor = 0.5 + (0.3 * min(1, (optimal_intensity - intensity) * 2))
    
    # Adjust for workload factor
    # Extremely high workload increases risk regardless of intensity
    if workload_factor > 1.2:
        intensity_factor = max(intensity_factor, 0.7 + (0.3 * min(1, (workload_factor - 1.2) * 1.25)))
    
    # Classification and explanation
    if intensity < 0.4:
        explanation = f"Low job intensity ({intensity:.2f}) may lead to boredom and disengagement"
    elif intensity < 0.55:
        explanation = f"Slightly below optimal job intensity ({intensity:.2f})"
    elif intensity < 0.65:
        explanation = f"Optimal job intensity ({intensity:.2f}) supports engagement without burnout"
    elif intensity < 0.8:
        explanation = f"Moderately high job intensity ({intensity:.2f}) may lead to strain over time"
    else:
        explanation = f"Very high job intensity ({intensity:.2f}) presents significant burnout risk"
    
    # Add job context if available
    if job_title:
        if manager_category != "unknown" and "manager" in job_title.lower():
            explanation += f" for {job_title} (a {manager_category.replace('_', ' ')} management role)"
        else:
            explanation += f" for {job_title}"
    
    # Add workload context if applicable
    if total_hours > 50:
        explanation += f"; high weekly hours ({total_hours}) increases burnout risk"
    elif total_hours < 30 and total_hours > 0:
        explanation += f"; low weekly hours ({total_hours}) may indicate underemployment"
    
    return {
        "intensity_attrition_score": intensity_factor,
        "current_intensity": intensity,
        "original_intensity": weighted_intensity,
        "manager_category": manager_category if "manager" in job_title.lower() else "non_manager",
        "manager_adjustment": manager_intensity_adjustment,
        "workload_factor": workload_factor,
        "total_hours": total_hours,
        "explanation": explanation
    }

def calculate_role_project_ratio(
    projects: List[Dict[str, Any]], 
    seniority_level: float
) -> Dict[str, Any]:
    """
    Calculate attrition risk based on project count vs. seniority
    Either too few or too many projects can indicate attrition risk
    """
    if not projects:
        return {
            "role_project_attrition_score": 0.5,
            "explanation": "No project data available"
        }
    
    # Count active projects
    active_count = 0
    for project in projects:
        if isinstance(project, dict):
            status = project.get("project_status", "").lower()
            if status in ["active", "in progress", "ongoing"]:
                active_count += 1
    
    # Get expected project count for this seniority level
    # Round to nearest 0.1 for lookup
    rounded_seniority = round(seniority_level * 10) / 10
    # Default to mid-level if not found
    expected_projects = EXPECTED_PROJECTS_BY_SENIORITY.get(rounded_seniority, 
                                                      EXPECTED_PROJECTS_BY_SENIORITY[0.5])
    
    # Calculate ratio of actual to expected
    ratio = active_count / max(1, expected_projects)
    
    # Calculate attrition risk based on deviation from expected ratio
    # Too few projects: employee may feel underutilized
    # Too many projects: employee may feel overwhelmed
    if ratio < 0.5:
        # Too few projects
        attrition_score = 0.6 + (0.3 * (1 - (ratio / 0.5)))
        explanation = f"Significantly fewer projects ({active_count}) than expected ({expected_projects}) for seniority level"
    elif ratio < 0.8:
        # Slightly fewer projects
        attrition_score = 0.4 + (0.2 * (1 - (ratio / 0.8)))
        explanation = f"Fewer projects ({active_count}) than expected ({expected_projects}) for seniority level"
    elif ratio <= 1.2:
        # Optimal range
        attrition_score = 0.3
        explanation = f"Optimal project load ({active_count}) for seniority level"
    elif ratio <= 1.5:
        # Slightly too many projects
        attrition_score = 0.4 + (0.3 * ((ratio - 1.2) / 0.3))
        explanation = f"More projects ({active_count}) than expected ({expected_projects}) for seniority level"
    else:
        # Far too many projects
        attrition_score = 0.7 + (0.3 * min(1, (ratio - 1.5) / 1.5))
        explanation = f"Significantly more projects ({active_count}) than expected ({expected_projects}) for seniority level"
    
    return {
        "role_project_attrition_score": attrition_score,
        "active_projects": active_count,
        "expected_projects": expected_projects,
        "project_ratio": ratio,
        "explanation": explanation
    }

def calculate_collaboration_factor(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate collaboration factor using enhanced logic:
    - More projects = higher collaboration 
    - More different people = higher collaboration
    - Cross-department collaboration = highest value
    - Weights feedback quality for more accurate assessment
    """
    # Initialize values
    collaboration_score = 0.0
    feedback_activity_score = 0.0
    quality_score = 0.5
    has_feedback_data = False
    feedback_given_count = 0
    feedback_received_count = 0
    total_collaborators = 0
    cross_dept_collaborations = 0
    departments_worked_with = set()
    
    # First check if we have structured collaboration data
    collaboration_analysis = doc.get("collaboration_analysis", {})
    
    if collaboration_analysis and isinstance(collaboration_analysis, dict) and collaboration_analysis.get("has_feedback_data", False):
        has_feedback_data = True
        collaboration_score = collaboration_analysis.get("collaboration_score", 0.0)
        feedback_activity_score = collaboration_analysis.get("feedback_activity_score", 0.0)
        quality_score = collaboration_analysis.get("feedback_quality_score", 0.0)
        feedback_given_count = collaboration_analysis.get("feedback_given", 0)
        feedback_received_count = collaboration_analysis.get("feedback_received", 0)
        
    # Check for feedbackMetrics
    if not has_feedback_data:
        feedback_metrics = doc.get("feedbackMetrics", {}) or {}
        if isinstance(feedback_metrics, dict):
            has_feedback_data = True
            given_metrics = feedback_metrics.get("given", {}) or {}
            received_metrics = feedback_metrics.get("received", {}) or {}
            feedback_given_count = int(given_metrics.get("count", 0)) or 0
            feedback_received_count = int(received_metrics.get("count", 0)) or 0
            weighted_avg = float(received_metrics.get("weightedAverageRating", 0) or 0)
            avg_rating = float(received_metrics.get("averageRating", 0) or 0)
            if weighted_avg > 0:
                quality_score = weighted_avg / 5.0
            elif avg_rating > 0:
                quality_score = avg_rating / 5.0
    
    # Check for direct feedback lists
    if not has_feedback_data:
        feedback_given = doc.get("feedbackGiven", [])
        feedback_received = doc.get("feedbackReceived", [])
        
        if (isinstance(feedback_given, list) and feedback_given) or \
           (isinstance(feedback_received, list) and feedback_received):
            has_feedback_data = True
            feedback_given_count = len(feedback_given) if isinstance(feedback_given, list) else 0
            feedback_received_count = len(feedback_received) if isinstance(feedback_received, list) else 0
    
    # Check for skillsFeedback data
    if not has_feedback_data:
        skills_feedback = doc.get("skillsFeedback", {})
        if skills_feedback and isinstance(skills_feedback, dict):
            has_feedback_data = True
            feedback_given_count = skills_feedback.get("feedbackGiven", 0) or 0
            feedback_received_count = skills_feedback.get("feedbackReceived", 0) or 0
            avg_rating = skills_feedback.get("averageRating", 0) or 0
            weighted_rating = skills_feedback.get("weightedRating", 0) or 0
            
            # Use max of avg and weighted rating
            if max(avg_rating, weighted_rating) > 0:
                quality_score = max(avg_rating, weighted_rating) / 5.0
    
    # ENHANCEMENT: Now check for project-based collaboration data
    projects = doc.get("projects", [])
    project_count = 0
    team_members = set()
    project_departments = set()
    
    if isinstance(projects, list) and projects:
        for project in projects:
            if not isinstance(project, dict):
                continue
                
            project_count += 1
            
            # Extract team members
            team = project.get("team", []) or project.get("team_members", []) or project.get("collaborators", [])
            
            # Handle nested team structures
            if isinstance(team, dict) and "members" in team:
                team = team.get("members", [])
            
            if isinstance(team, list):
                for member in team:
                    if isinstance(member, str):
                        team_members.add(member)
                    elif isinstance(member, dict):
                        # Try to extract member info from dictionary
                        member_id = member.get("id") or member.get("email") or member.get("name")
                        if member_id:
                            team_members.add(member_id)
                        
                        # Track departments for cross-department collaboration
                        dept = member.get("department") or member.get("dept")
                        if dept:
                            project_departments.add(dept)
            
            # Try to find deeper nested structure if team not found
            if not team_members and "projectDetails" in project:
                details = project.get("projectDetails", {})
                if isinstance(details, dict):
                    team = details.get("team", []) or details.get("team_members", [])
                    if isinstance(team, list):
                        for member in team:
                            if isinstance(member, str):
                                team_members.add(member)
                            elif isinstance(member, dict):
                                member_id = member.get("id") or member.get("email") or member.get("name")
                                if member_id:
                                    team_members.add(member_id)
                                    
                                # Track departments
                                dept = member.get("department") or member.get("dept")
                                if dept:
                                    project_departments.add(dept)
    
    # Calculate collaboration metrics from projects
    total_collaborators = len(team_members)
    departments_worked_with = project_departments
    cross_dept_collaborations = len(departments_worked_with)
    
    # Calculate activity score from feedback and projects
    # More weight to cross-department collaboration (3x)
    # Medium weight to unique collaborators (2x) 
    # Base weight to raw feedback counts (1x)
    weighted_activity = (
        (feedback_given_count + feedback_received_count) +
        (total_collaborators * 2) +
        (cross_dept_collaborations * 3)
    )
    
    # Log scale to normalize (diminishing returns for very large numbers)
    activity_score = min(1.0, math.log(weighted_activity + 1) / math.log(100)) if weighted_activity > 0 else 0
    
    # Calculate final collaboration score
    # Weight activity higher (70%) than quality (30%) for collaboration
    collaboration_score = (0.7 * activity_score) + (0.3 * quality_score)
    
    # Boost score for significant cross-department collaboration
    if cross_dept_collaborations >= 3:
        collaboration_score = min(1.0, collaboration_score * 1.2)  # 20% boost
    
    # Calculate attrition risk (inverse of collaboration score)
    attrition_risk = 1 - collaboration_score
    
    # Generate explanation
    if collaboration_score > 0.7:
        explanation = "Strong collaboration network likely increases retention"
    elif collaboration_score > 0.4:
        explanation = "Moderate collaboration activity provides some retention benefit"
    else:
        explanation = "Limited collaboration may increase attrition risk"
        
    if feedback_given_count > 0 or feedback_received_count > 0:
        explanation += (
            f" (given: {feedback_given_count}, received: {feedback_received_count})"
        )
    
    return {
        "collaboration_attrition_score": attrition_risk,
        "collaboration_score": collaboration_score,
        "feedback_activity": activity_score,
        "feedback_quality": quality_score,
        "has_feedback_data": True,
        "explanation": explanation
    }

def calculate_salary_satisfaction(
    salary: float,
    job_title: str,
    work_mode: str = None,
    location: str = None,
    industry: str = None,
    doc: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Calculate salary satisfaction based on role, location and work mode
    Higher score = higher attrition risk due to salary dissatisfaction
    
    Uses cost of living data for locations and adjusts expectations based on:
    - Work mode (remote/hybrid/in-office)
    - Office location (HCOL/MCOL/LCOL regions)
    - Industry standards
    """
    # If document is provided, explicitly check for key fields
    if doc and isinstance(doc, dict):
        # Try to get industry, officeLocation and workMode directly
        if not industry and "industry" in doc:
            industry = doc.get("industry")
        if not location and "officeLocation" in doc:
            location = doc.get("officeLocation")
        if not work_mode and "workMode" in doc:
            work_mode = doc.get("workMode")
    
    if not salary or salary <= 0:
        return {
            "salary_score": 0.5,
            "explanation": "No salary data available"
        }
    
    # Parse salary if it's a string
    if isinstance(salary, str):
        try:
            # Try to extract numeric value from salary string
            salary_str = salary.replace(',', '').replace('$', '')
            # Check if it has "k" for thousands
            if 'k' in salary_str.lower():
                salary_str = salary_str.lower().replace('k', '')
                salary_num = float(salary_str) * 1000
            else:
                # Try to handle "per year", "per month" etc.
                salary_parts = salary_str.split('/')
                salary_num = float(salary_parts[0])
                
                # Adjust if it's monthly, weekly, hourly
                if len(salary_parts) > 1:
                    if 'month' in salary_parts[1].lower():
                        salary_num *= 12  # Convert monthly to yearly
                    elif 'week' in salary_parts[1].lower():
                        salary_num *= 52  # Convert weekly to yearly
                    elif 'hour' in salary_parts[1].lower() or 'hr' in salary_parts[1].lower():
                        salary_num *= 2080  # Convert hourly to yearly (40 hrs * 52 weeks)
            
            salary = salary_num
        except (ValueError, TypeError, IndexError):
            # If we can't parse, use default
            salary = 0
    
    # Get seniority level
    seniority_level = get_seniority_level(job_title)
    
    # Round to nearest 0.1 for lookup
    rounded_seniority = round(seniority_level * 10) / 10
    
    # Get salary expectation factor based on seniority
    salary_expectation_factor = SALARY_EXPECTATIONS_BY_SENIORITY.get(
        rounded_seniority, 
        SALARY_EXPECTATIONS_BY_SENIORITY[0.4]  # Default to mid-level
    )
    
    # Adjust for location (cost of living)
    location_factor = 1.0
    matched_location = "unknown location"
    if location:
        # Get location factor using our improved function
        location_factor = get_col_for_location(location)
        
        # If location is "default" or not in our database, use LLM to estimate
        if location_factor == 1.0 and location.lower().strip() != "default":
            # Create a sample of 10 cities with their cost of living factors for the LLM
            sample_cities = [
                {"city": "San Francisco", "col_factor": 2.5},
                {"city": "New York", "col_factor": 2.3},
                {"city": "Los Angeles", "col_factor": 1.8},
                {"city": "Chicago", "col_factor": 1.3},
                {"city": "Austin", "col_factor": 1.2},
                {"city": "Atlanta", "col_factor": 1.0},
                {"city": "Detroit", "col_factor": 0.9},
                {"city": "Phoenix", "col_factor": 1.1},
                {"city": "Denver", "col_factor": 1.2},
                {"city": "Miami", "col_factor": 1.2}
            ]
            
            # Call LLM for location estimation - use minimal prompt
            prompt = f"Cost of living factor (0.6-2.8) for: {location}"
            
            llm_result = call_gemini_llm(prompt, "col_estimation", sample_cities)
            
            if "error" not in llm_result and "col_factor" in llm_result:
                # Use the LLM-provided value
                location_factor = llm_result["col_factor"]
                matched_location = location
                # Cache the result for future use
                col_api_cache[location.lower().strip()] = location_factor
            else:
                # Use our estimation function as fallback
                location_factor = estimate_col_factor(location)
                matched_location = location + " (estimated)"
                col_api_cache[location.lower().strip()] = location_factor
        else:
            matched_location = location
    else:
        # If no location provided, generate reasonable estimate instead of "default"
        location_factor = 1.0 + (0.2 * random.random())  # 1.0-1.2 range
        matched_location = "unspecified location (estimated)"
    
    # Adjust for work mode with more nuanced handling
    work_mode_factor = 1.0
    if work_mode:
        normalized_work_mode = work_mode.lower().strip()
        
        # Enhanced work mode detection
        if any(term in normalized_work_mode for term in ["remote", "wfh", "work from home", "telecommute", "virtual"]):
            work_mode_factor = WORK_MODE_FACTORS["remote"]
            
            # Special case: if remote but in high cost area, adjust less
            if location_factor > 1.4:
                # Remote in HCOL area still commands higher salary
                work_mode_factor = 0.95  # less discount
                
        elif any(term in normalized_work_mode for term in ["hybrid", "flex", "flexible", "partial"]):
            work_mode_factor = WORK_MODE_FACTORS["hybrid"]
            
        elif any(term in normalized_work_mode for term in ["office", "on-site", "onsite", "in-person", "in office"]):
            work_mode_factor = WORK_MODE_FACTORS["in-office"]
            
            # Adjust for commute to high-cost areas
            if location_factor > 1.5:
                # Working in office in HCOL area might require higher compensation
                work_mode_factor = 1.15
        else:
            # Use LLM to determine work mode factor if not matched
            work_modes_sample = [
                {"work_mode": "remote", "factor": 0.9},
                {"work_mode": "hybrid", "factor": 1.0},
                {"work_mode": "in-office", "factor": 1.1}
            ]
            
            prompt = f"""Given these work mode types and their salary adjustment factors:
            {json.dumps(work_modes_sample)}
            
            Which category does "{work_mode}" best fit into? Reply with just one word: remote, hybrid, or in-office."""
            
            llm_result = call_gemini_llm(prompt, "work_mode_match", work_modes_sample)
            
            if isinstance(llm_result, dict) and "work_mode" in llm_result:
                matched_mode = llm_result["work_mode"].lower().strip()
                if matched_mode in WORK_MODE_FACTORS:
                    work_mode_factor = WORK_MODE_FACTORS[matched_mode]
    
    # Adjust for industry with more comprehensive matching
    industry_factor = 1.0
    matched_industry = None
    if industry:
        normalized_industry = industry.lower().strip()
        
        # First try direct matches
        for ind_name, ind_factor in INDUSTRY_SALARY_FACTORS.items():
            if ind_name == normalized_industry:
                industry_factor = ind_factor
                matched_industry = ind_name
                break
                
        # If no direct match, try partial matches
        if not matched_industry:
            for ind_name, ind_factor in INDUSTRY_SALARY_FACTORS.items():
                if ind_name in normalized_industry:
                    industry_factor = ind_factor
                    matched_industry = ind_name
                    break
                    
        # Check for specific high-paying tech sub-industries
        high_paying_tech = ["ai", "machine learning", "data science", "blockchain", "cybersecurity", 
                           "artificial intelligence", "crypto", "cloud", "devops"]
                           
        if "technology" in normalized_industry or "tech" in normalized_industry.split():
            for specialty in high_paying_tech:
                if specialty in normalized_industry:
                    industry_factor = 1.4  # Premium tech fields
                    matched_industry = f"tech-{specialty}"
                    break
    
        # If still no match, use LLM
        if not matched_industry:
            # Sample industries with factors
            industry_samples = [
                {"industry": "technology", "factor": 1.3},
                {"industry": "finance", "factor": 1.2},
                {"industry": "healthcare", "factor": 1.0},
                {"industry": "education", "factor": 0.8},
                {"industry": "retail", "factor": 0.7},
                {"industry": "manufacturing", "factor": 0.9},
                {"industry": "government", "factor": 0.9},
                {"industry": "nonprofit", "factor": 0.7}
            ]
            
            prompt = f"""Given these industries and their salary factors:
            {json.dumps(industry_samples)}
            
            Please classify "{industry}" and provide a salary factor between 0.7 and 1.3.
            Reply with just the decimal number."""
            
            llm_result = call_gemini_llm(prompt, "industry_match", industry_samples)
            
            if isinstance(llm_result, dict) and "industry_factor" in llm_result:
                # Use the LLM-provided factor if reasonable
                estimated_factor = float(llm_result["industry_factor"])
                if 0.7 <= estimated_factor <= 1.3:
                    industry_factor = estimated_factor
                    matched_industry = industry + " (estimated)"
    
    # Calculate expected salary (with better baseline calculation)
    # Base salary varies by location and industry, so make it dynamic
    BASE_SALARY = 80000  # National average for professional roles
    
    # Adjust base salary for location first
    location_adjusted_base = BASE_SALARY * location_factor
    
    # Calculate expected salary with all factors
    expected_salary = location_adjusted_base * salary_expectation_factor * work_mode_factor * industry_factor
    
    # Calculate satisfaction based on ratio of actual to expected
    ratio = salary / expected_salary if expected_salary > 0 else 1.0
    
    # Determine score with more detailed ranges:
    # 0 = completely satisfied, 1 = completely dissatisfied
    if ratio < 0.6:
        # Severely underpaid (40%+ below market)
        score = 0.9 + (0.1 * max(0, (0.6 - ratio) / 0.2))
        explanation = f"Salary {(1-ratio)*100:.0f}% below market expectations"
    elif ratio < 0.8:
        # Significantly underpaid (20-40% below market)
        score = 0.7 + (0.2 * (0.8 - ratio) / 0.2)
        explanation = f"Salary {(1-ratio)*100:.0f}% below market expectations"
    elif ratio < 0.9:
        # Moderately underpaid (10-20% below market)
        score = 0.5 + (0.2 * (0.9 - ratio) / 0.1)
        explanation = f"Salary {(1-ratio)*100:.0f}% below typical compensation"
    elif ratio <= 1.1:
        # Appropriately paid (within 10% of market)
        score = 0.3
        explanation = "Salary appropriate for role and location"
    elif ratio <= 1.3:
        # Well paid (10-30% above market)
        score = 0.2 - (0.1 * (ratio - 1.1) / 0.2)
        explanation = f"Salary {(ratio-1)*100:.0f}% above typical compensation"
    else:
        # Extremely well paid (>30% above market)
        score = 0.1
        explanation = f"Salary significantly above market rate ({(ratio-1)*100:.0f}% premium)"
    
    # Add context for factors that were considered
    context = []
    if location_factor != 1.0:
        if location_factor > 1.4:
            context.append(f"high-cost location ({matched_location}, {location_factor:.1f}x)")
        elif location_factor > 1.1:
            context.append(f"moderate-cost location ({matched_location}, {location_factor:.1f}x)")
        else:
            context.append(f"lower-cost location ({matched_location}, {location_factor:.1f}x)")
    
    if work_mode_factor != 1.0:
        if work_mode:
            context.append(f"{work_mode} work arrangement ({work_mode_factor:.1f}x)")
    
    if industry_factor != 1.0:
        if industry_factor > 1.1:
            context.append(f"high-paying industry {matched_industry or industry} ({industry_factor:.1f}x)")
        else:
            context.append(f"{matched_industry or industry} industry ({industry_factor:.1f}x)")
    
    if seniority_level > 0.7:
        context.append(f"senior-level position (level {seniority_level:.1f})")
    elif seniority_level < 0.3:
        context.append(f"junior-level position (level {seniority_level:.1f})")
    
    if context:
        explanation += f" (Considering: {', '.join(context)})"
    
    return {
        "salary_score": score,
        "ratio_to_expected": ratio,
        "expected_salary": expected_salary,
        "actual_salary": salary,
        "seniority_level": seniority_level,
        "location": matched_location,
        "location_factor": location_factor,
        "work_mode": work_mode,
        "work_mode_factor": work_mode_factor,
        "industry": matched_industry or industry,
        "industry_factor": industry_factor,
        "base_salary_reference": BASE_SALARY,
        "explanation": explanation
    }

# --- Main Attrition Score Calculation ---
def calculate_attrition_score(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate attrition score based on various factors
    
    This combines multiple risk factors into a single attrition score
    with detailed explanations of contributing factors
    """
    # Ensure doc is a dictionary
    if not isinstance(doc, dict):
        logging.error(f"Invalid document format: {type(doc)}")
        return {
            "timestamp": datetime.now().isoformat(),
            "email": "unknown",
            "error": "Invalid document format"
        }
    
    # Extract relevant fields
    email = doc.get("email", "unknown")
    job_title = doc.get("jobTitle", "")
    tools_proficient = doc.get("toolsProficient", [])
    projects = doc.get("projects", [])
    job_duties = doc.get("jobDuties", [])
    if not job_duties:
        job_duties = doc.get("jobResponsibilities", [])
    
    # Get salary information
    salary = doc.get("salary", 0)
    if isinstance(salary, str):
        try:
            # Try to parse string value (remove non-numeric characters)
            salary = float(re.sub(r'[^\d.]', '', salary))
        except (ValueError, TypeError):
            salary = 0
    
    # Get work mode, location and industry with enhanced field detection
    # Try various field names for work mode
    work_mode = None
    for field in ["workMode", "work_mode", "workLocation", "workArrangement", 
                  "employmentType", "workStyle", "remoteStatus"]:
        if field in doc and doc.get(field):
            work_mode = doc.get(field)
            break
    
    # Check for work mode in employment data if present
    if not work_mode and "employmentData" in doc:
        emp_data = doc.get("employmentData", {})
        if isinstance(emp_data, dict):
            for field in ["workMode", "work_mode", "workLocation", "workArrangement"]:
                if field in emp_data and emp_data.get(field):
                    work_mode = emp_data.get(field)
                    break
    
    # Normalize work mode values for better matching
    if work_mode:
        work_mode = str(work_mode).lower().strip()
        # Map common variations to standard terms
        if any(term in work_mode for term in ["remote", "wfh", "work from home", "telecommute", "virtual"]):
            work_mode = "remote"
        elif any(term in work_mode for term in ["hybrid", "flex", "flexible", "partial"]):
            work_mode = "hybrid"
        elif any(term in work_mode for term in ["office", "on-site", "onsite", "in-person", "in office"]):
            work_mode = "in-office"
    
    # Try various field names for location
    location = None
    for field in ["officeLocation", "location", "workLocation", "city", "officeSite", 
                  "workCity", "employeeLocation", "geographicLocation"]:
        if field in doc and doc.get(field):
            location = doc.get(field)
            break
    
    # Check for location in address or contact info if present
    if not location:
        # Look for location in address
        address = doc.get("address", {})
        if isinstance(address, dict):
            city = address.get("city")
            state = address.get("state")
            country = address.get("country")
            
            if city:
                location = city
                # Add state/country for better context if available
                if state:
                    location += f", {state}"
                elif country:
                    location += f", {country}"
        
        # Try contact info
        if not location and "contactInfo" in doc:
            contact = doc.get("contactInfo", {})
            if isinstance(contact, dict) and "location" in contact:
                location = contact.get("location")
    
    # Try various field names for industry
    industry = None
    for field in ["industry", "businessDomain", "sector", "companyIndustry", 
                  "jobSector", "fieldType", "businessType", "companyType"]:
        if field in doc and doc.get(field):
            industry = doc.get(field)
            break
    
    # Look for industry in company data if available
    if not industry and "companyData" in doc:
        company_data = doc.get("companyData", {})
        if isinstance(company_data, dict) and "industry" in company_data:
            industry = company_data.get("industry")
    
    # Try to extract industry from role data if still not found
    if not industry and job_title:
        # Check for common industry-specific terms in job title
        industry_indicators = {
            "developer": "technology",
            "engineer": "technology",
            "programmer": "technology",
            "analyst": "finance",
            "accountant": "finance",
            "banker": "finance", 
            "doctor": "healthcare",
            "nurse": "healthcare",
            "teacher": "education",
            "professor": "education",
            "marketing": "marketing",
            "sales": "sales",
            "retail": "retail",
            "legal": "legal",
            "attorney": "legal",
            "lawyer": "legal"
        }
        
        job_title_lower = job_title.lower()
        for indicator, ind_type in industry_indicators.items():
            if indicator in job_title_lower:
                industry = ind_type
                break
    
    # Get time with company and in role
    time_with_company_months = doc.get("timeWithCompanyMonths", 0)
    time_in_role_months = doc.get("timeInCurrentRoleMonths", 0)
    
    # Use alternative duration fields if available
    if time_with_company_months == 0:
        # Try multiple possible field names for total duration
        total_duration = doc.get("totalduration")
        if not total_duration:
            total_duration = doc.get("totalDuration")
        if not total_duration:
            total_duration = doc.get("tenure")
        if not total_duration:
            total_duration = doc.get("employmentLength")
        
        # Try to extract from timeWithCompany field if it's a string (e.g. "2 years 3 months")
        if not total_duration and "timeWithCompany" in doc:
            time_str = doc.get("timeWithCompany")
            if isinstance(time_str, str):
                parsed_time = parse_time_expression(time_str)
                total_duration = parsed_time.get("total_months", 0)
                
        # Parse the duration value
        if total_duration:
            try:
                if isinstance(total_duration, str) and "month" in total_duration.lower():
                    # Handle "X months" format
                    match = re.search(r'(\d+)', total_duration)
                    if match:
                        time_with_company_months = int(match.group(1))
                elif isinstance(total_duration, str) and "year" in total_duration.lower():
                    # Handle "X years" or "X.Y years" format
                    match = re.search(r'([\d\.]+)', total_duration)
                    if match:
                        years = float(match.group(1))
                        time_with_company_months = int(years * 12)
                else:
                    # Try to convert to int directly
                    time_with_company_months = int(total_duration)
            except (ValueError, TypeError):
                pass
    
    if time_in_role_months == 0:
        # Try multiple possible field names for role duration
        role_duration = doc.get("currentroleduration")
        if not role_duration:
            role_duration = doc.get("currentRoleDuration")
        if not role_duration:
            role_duration = doc.get("timeInRole")
        if not role_duration:
            role_duration = doc.get("currentPositionLength")
            
        # Try to extract from timeInCurrentRole field if it's a string
        if not role_duration and "timeInCurrentRole" in doc:
            time_str = doc.get("timeInCurrentRole")
            if isinstance(time_str, str):
                parsed_time = parse_time_expression(time_str)
                role_duration = parsed_time.get("total_months", 0)
        
        # Parse the role duration value
        if role_duration:
            try:
                if isinstance(role_duration, str) and "month" in role_duration.lower():
                    # Handle "X months" format
                    match = re.search(r'(\d+)', role_duration)
                    if match:
                        time_in_role_months = int(match.group(1))
                elif isinstance(role_duration, str) and "year" in role_duration.lower():
                    # Handle "X years" or "X.Y years" format
                    match = re.search(r'([\d\.]+)', role_duration)
                    if match:
                        years = float(match.group(1))
                        time_in_role_months = int(years * 12)
                else:
                    # Try to convert to int directly
                    time_in_role_months = int(role_duration)
            except (ValueError, TypeError):
                pass
    
    # Ensure time_in_role_months doesn't exceed time_with_company_months
    if time_with_company_months > 0 and time_in_role_months > time_with_company_months:
        time_in_role_months = time_with_company_months
    
    # Get feedback data for collaboration index
    feedback_given = doc.get("feedbackGiven", [])
    feedback_received = doc.get("feedbackReceived", [])
    
    # Get utilization and job intensity analyses
    utilization_assessment = doc.get("utilizationAssessment", {})
    # Also look for the field directly at the root level
    if not utilization_assessment and "utilization_score" in doc:
        utilization_assessment = {"utilization_score": doc.get("utilization_score")}
    
    job_intensity_analysis = doc.get("job_intensity_analysis", {})
    
    # Add job title to job intensity analysis for context-aware processing
    if job_title and isinstance(job_intensity_analysis, dict):
        job_intensity_analysis["job_title"] = job_title
    
    # Get seniority level for role-project analysis
    seniority_level = get_seniority_level(job_title)
    
    # Calculate individual factors
    
    # 1. Responsibility Mismatch
    responsibility_mismatch = calculate_responsibility_mismatch(job_duties, job_title)
    
    # 2. Tenure Factor
    tenure_factor = calculate_tenure_factor(time_with_company_months, time_in_role_months)
    
    # 3. Utilization Factor
    utilization_factor = calculate_utilization_factor(utilization_assessment)
    
    # 4. Seniority Factor
    seniority_factor = calculate_seniority_factor(job_title)
    
    # 5. Task Variety Index
    task_variety = calculate_task_variety_index(job_duties, projects, tools_proficient)
    
    # 6. Job Intensity Factor
    job_intensity_factor = calculate_job_intensity_factor(job_intensity_analysis)
    
    # 7. Role-Project Ratio
    role_project_ratio = calculate_role_project_ratio(projects, seniority_level)
    
    # 8. Collaboration Index
    collaboration_index = calculate_collaboration_factor(doc)
    
    # 9. Salary Satisfaction
    salary_satisfaction = calculate_salary_satisfaction(
        salary=salary,
        job_title=job_title,
        work_mode=work_mode,
        location=location,
        industry=industry,
        doc=doc
    )
    
    # Collect all factor scores
    factor_scores = {
        "responsibility_mismatch": responsibility_mismatch.get("mismatch_score", 0.5),
        "tenure_factor": tenure_factor.get("tenure_score", 0.5),
        "utilization_factor": utilization_factor.get("utilization_attrition_score", 0.5),
        "seniority_factor": seniority_factor.get("seniority_attrition_score", 0.5),
        "task_variety_index": task_variety.get("attrition_risk", 0.5),
        "job_intensity": job_intensity_factor.get("intensity_attrition_score", 0.5),
        "role_project_ratio": role_project_ratio.get("role_project_attrition_score", 0.5),
        "collaboration_index": collaboration_index.get("collaboration_attrition_score", 0.5),
        "salary_satisfaction": salary_satisfaction.get("salary_score", 0.5)
    }
    
    # Calculate weighted average for overall attrition score
    weighted_score = 0
    total_weight = 0
    
    for factor, score in factor_scores.items():
        weight = ATTRITION_FACTOR_WEIGHTS.get(factor, 0.1)
        weighted_score += score * weight
        total_weight += weight
    
    # Normalize score
    if total_weight > 0:
        overall_score = weighted_score / total_weight
    else:
        overall_score = 0.5  # Default to medium risk if no factors available
    
    # Determine risk level and primary factors
    if overall_score < 0.3:
        risk_level = "very_low"
    elif overall_score < 0.4:
        risk_level = "low"
    elif overall_score < 0.6:
        risk_level = "medium"
    elif overall_score < 0.75:
        risk_level = "high"
    else:
        risk_level = "very_high"
    
    # Identify primary risk factors (those significantly higher than average)
    primary_risk_factors = []
    for factor, score in factor_scores.items():
        if score > overall_score + 0.15:  # Significantly higher than average
            primary_risk_factors.append({
                "factor": factor,
                "score": score,
                "explanation": get_factor_explanation(factor, locals().get(factor.replace("_", "_") + "_factor", {}))
            })
    
    # Sort by score descending
    primary_risk_factors.sort(key=lambda x: x["score"], reverse=True)
    
    # Generate primary risk explanation
    primary_explanation = "Multiple factors affecting attrition risk"
    if primary_risk_factors:
        top_factor = primary_risk_factors[0]
        primary_explanation = top_factor["explanation"]
    
    # Compile all results
    result = {
        "timestamp": datetime.now().isoformat(),
        "email": email,
        "attrition_score": overall_score,
        "attrition_risk": risk_level,
        "primary_explanation": primary_explanation,
        "primary_risk_factors": primary_risk_factors[:3],  # Top 3 factors
        "factor_scores": factor_scores,
        "factor_details": {
            "responsibility_mismatch": responsibility_mismatch,
            "tenure_factor": tenure_factor,
            "utilization_factor": utilization_factor,
            "seniority_factor": seniority_factor,
            "task_variety": task_variety,
            "job_intensity_factor": job_intensity_factor,
            "role_project_ratio": role_project_ratio,
            "collaboration_index": collaboration_index,
            "salary_satisfaction": salary_satisfaction
        }
    }
    
    # Convert any NumPy types to Python native types
    result = convert_numpy_to_python(result)
    
    return result

def get_factor_explanation(factor_name: str, factor_data: Dict[str, Any]) -> str:
    """Helper function to extract explanation from factor data"""
    if "explanation" in factor_data:
        return factor_data["explanation"]
    
    # Default explanations if specific one not found
    default_explanations = {
        "responsibility_mismatch": "Mismatch between responsibilities and seniority level",
        "tenure_factor": "Tenure patterns suggesting potential attrition risk",
        "utilization_factor": "Utilization level affecting retention risk",
        "seniority_factor": "Seniority level with characteristic attrition pattern",
        "task_variety_index": "Task variety affecting engagement level",
        "job_intensity": "Job intensity affecting burnout potential",
        "role_project_ratio": "Project load relative to seniority level",
        "collaboration_index": "Collaboration patterns affecting retention",
        "salary_satisfaction": "Salary satisfaction relative to market expectations"
    }
    
    return default_explanations.get(factor_name, "Contributing factor to attrition risk")

# --- MongoDB Integration ---
def process_all_documents():
    """Process all documents in the OUTPUT_COLLECTION"""
    if db is None:
        logging.warning("Database connection not available. Attempting to reconnect.")
        connect_db()
        if db is None:
            logging.error("Reconnect failed. Skipping processing.")
            return
            
    if model is None:
        logging.warning("Sentence transformer model not loaded. Loading now.")
        load_model()
        if model is None:
            logging.error("Model loading failed. Skipping processing.")
            return
    
    logging.info(f"Starting to process documents in {OUTPUT_COLLECTION}...")
    
    # Find all applicable documents
    cursor = db[OUTPUT_COLLECTION].find(
        {},  # No filter to get all documents
        {
            "_id": 1, 
            "email": 1, 
            "toolsProficient": 1, 
            "jobTitle": 1, 
            "role": 1, 
            "projects": 1,
            "jobResponsibilities": 1,
            "jobDuties": 1,
            "salary": 1,
            "timeWithCompany": 1,
            "timeInCurrentRole": 1,
            "timeWithCompanyMonths": 1,
            "timeInCurrentRoleMonths": 1,
            "utilizationAssessment": 1,
            "job_intensity_analysis": 1,
            "feedbackGiven": 1,
            "feedbackReceived": 1
        }
    )
    
    update_operations = []
    processed_count = 0
    
    for doc in cursor:
        try:
            doc_id = doc["_id"]
            email = doc.get("email", "unknown")
            
            # Calculate attrition score
            attrition_analysis = calculate_attrition_score(doc)
            
            # Add attrition assessment to bulk operations
            update_operations.append(
                UpdateOne(
                    {"_id": doc_id},
                    {"$set": {"attritionAssessment": attrition_analysis}},
                    upsert=False
                )
            )
            
            # Update users collection as well
            if email != "unknown":
                update_operations.append(
                    UpdateOne(
                        {"email": email},
                        {"$set": {"attritionAssessment": attrition_analysis}},
                        upsert=False
                    )
                )
            
            processed_count += 1
            
            # Perform bulk writes in batches
            if len(update_operations) >= 100:
                perform_bulk_update(update_operations)
                update_operations = []
                
            # Log progress
            if processed_count % 100 == 0:
                logging.info(f"Processed {processed_count} documents...")
                
        except Exception as e:
            logging.error(f"Error processing document {doc.get('email', 'unknown')}: {e}")
    
    # Process any remaining operations
    if update_operations:
        perform_bulk_update(update_operations)
        
    logging.info(f"Completed processing {processed_count} documents")

def perform_bulk_update(operations):
    """Execute bulk update operations"""
    if not operations:
        return
        
    try:
        # Group operations by collection
        merged_ops = [op for op in operations if op._filter.get("_id") is not None]
        users_ops = [op for op in operations if op._filter.get("email") is not None and op._filter.get("_id") is None]
        
        # Convert NumPy values to native Python types for MongoDB compatibility
        for op in merged_ops + users_ops:
            if hasattr(op, '_update') and op._update:
                op._update = convert_numpy_to_python(op._update)
        
        # Process merged_output operations
        if merged_ops:
            try:
                result = db[OUTPUT_COLLECTION].bulk_write(merged_ops, ordered=False)
                logging.info(f"Bulk update to {OUTPUT_COLLECTION} completed: {result.modified_count} documents modified")
            except Exception as e:
                logging.error(f"Error during bulk update on {OUTPUT_COLLECTION}: {e}")
                # Try one-by-one to identify problematic documents
                for op in merged_ops:
                    try:
                        db[OUTPUT_COLLECTION].update_one(
                            op._filter, 
                            op._update, 
                            upsert=op._upsert
                        )
                    except Exception as inner_e:
                        logging.error(f"Failed to update document: {op._filter} with error: {inner_e}")
        
        # Process users operations
        if users_ops:
            try:
                result = db[USERS_COLLECTION].bulk_write(users_ops, ordered=False)
                logging.info(f"Bulk update to {USERS_COLLECTION} completed: {result.modified_count} documents modified")
            except Exception as e:
                logging.error(f"Error during bulk update on {USERS_COLLECTION}: {e}")
                # Try one-by-one
                for op in users_ops:
                    try:
                        db[USERS_COLLECTION].update_one(
                            op._filter, 
                            op._update, 
                            upsert=op._upsert
                        )
                    except Exception as inner_e:
                        logging.error(f"Failed to update user document: {op._filter} with error: {inner_e}")
            
    except Exception as e:
        logging.error(f"Error during bulk update: {e}")

def process_single_document(email: str) -> Optional[Dict[str, Any]]:
    """
    Process a single document by email
    Returns the attrition assessment or None if processing failed
    """
    if db is None or model is None:
        logging.error("Database or model not available")
        return None
        
    try:
        # Find the document
        doc = db[OUTPUT_COLLECTION].find_one(
            {"email": email},
            {
                "_id": 1, 
                "email": 1, 
                "toolsProficient": 1, 
                "jobTitle": 1, 
                "role": 1, 
                "projects": 1,
                "jobResponsibilities": 1,
                "jobDuties": 1,
                "salary": 1,
                "timeWithCompany": 1,
                "timeInCurrentRole": 1,
                "timeWithCompanyMonths": 1,
                "timeInCurrentRoleMonths": 1,
                "utilizationAssessment": 1,
                "job_intensity_analysis": 1,
                "feedbackGiven": 1,
                "feedbackReceived": 1
            }
        )
        
        if not doc:
            logging.warning(f"Document not found for email: {email}")
            return None
        
        # Calculate attrition score
        attrition_analysis = calculate_attrition_score(doc)
        
        # Convert NumPy types to Python native types
        attrition_analysis = convert_numpy_to_python(attrition_analysis)
        
        # Update merged_output collection
        db[OUTPUT_COLLECTION].update_one(
            {"_id": doc["_id"]},
            {"$set": {"attritionAssessment": attrition_analysis}},
            upsert=False
        )
        
        # Update users collection
        db[USERS_COLLECTION].update_one(
            {"email": email},
            {"$set": {"attritionAssessment": attrition_analysis}},
            upsert=False
        )
        
        logging.info(f"Processed attrition assessment for {email}")
        return attrition_analysis
        
    except Exception as e:
        logging.error(f"Error processing document for {email}: {e}")
        return None

# --- Change Stream Handling ---
def watch_for_changes():
    """Watch for changes in the merged_output collection"""
    if db is None:
        logging.error("Database connection not available")
        return
        
    logging.info(f"Starting change stream on {OUTPUT_COLLECTION}...")
    
    try:
        # Watch for any changes in any document in the collection
        # This will trigger analysis for any field change
        pipeline = [
            {"$match": {
                "operationType": {"$in": ["insert", "update", "replace"]}
            }}
        ]
        
        with db[OUTPUT_COLLECTION].watch(
            pipeline=pipeline,
            full_document='updateLookup'
        ) as stream:
            for change in stream:
                try:
                    email = change["fullDocument"].get("email")
                    if email:
                        logging.info(
                            f"Change detected for {email}, processing attrition update..."
                        )
                        process_single_document(email)
                except Exception as e:
                    logging.error(
                        f"Error handling change event: {e}"
                    )
                    
    except Exception as e:
        logging.error(f"Error setting up change stream: {e}")
        # Try to reconnect and restart the change stream after a delay
        time.sleep(10)
        connect_db()
        load_model()
        watch_for_changes()

def get_seniority_level(job_title: str) -> float:
    """
    Estimate seniority level from job title (0.1 to 1.0 scale)
    Uses vector search for more accurate matching
    Also considers the managerial domain for context
    """
    if not job_title or not isinstance(job_title, str):
        return 0.3  # Default to junior-level if no info
        
    job_title = job_title.lower()
    
    # Handle specific cases first - these override other matching
    if "assistant" in job_title:
        if "executive assistant" in job_title:
            return 0.5  # Executive assistant is mid-level
        elif "senior executive assistant" in job_title:
            return 0.6  # Senior executive assistant is mid-senior level
        elif "software assistant" in job_title or "developer assistant" in job_title:
            return 0.2  # Software/developer assistant is junior level
        elif "marketing assistant" in job_title or "sales assistant" in job_title:
            return 0.2  # Marketing/sales assistant is junior level
        elif "administrative assistant" in job_title or "admin assistant" in job_title:
            return 0.2  # Administrative assistant is junior level
        elif "research assistant" in job_title:
            return 0.3  # Research assistant is junior-mid level
        elif "assistant professor" in job_title:
            return 0.6  # Assistant professor is senior level (academic context)
        elif "assistant manager" in job_title:
            return 0.5  # Assistant manager is mid-level
        elif "assistant director" in job_title:
            return 0.7  # Assistant director is senior level
        # Generic assistant
        return 0.2  # Default assistant level is junior
    
    # Check for intern/trainee positions
    if any(term in job_title for term in ["intern", "trainee", "apprentice"]):
        return 0.1  # Entry level
    
    # Then try vector search if available
    if model is not None and role_vector_index is not None:
        seniority = vector_search_seniority(job_title)
        
        # If we got a valid result, use it (but verify it's not completely wrong)
        if 0.1 <= seniority <= 1.0:
            # Verify result - ensure high-level titles don't get matched to junior roles
            if seniority >= 0.8:  # If matched to very senior role
                # Double check it actually contains senior keywords
                if not any(kw in job_title for kw in ["chief", "director", "vp", "president", "head", "exec"]):
                    seniority = 0.5  # Default to mid-level if mismatch
            # Verify junior roles - ensure junior roles don't get matched to senior
            if seniority <= 0.2:  # If matched to very junior role
                # Double check it doesn't contain senior keywords
                if any(kw in job_title for kw in ["senior", "lead", "manager", "principal", "staff"]):
                    seniority = 0.4  # Adjust to mid-level if mismatch
            return seniority
    
    # Managerial domains with their importance weights
    manager_domains = {
        # Critical business functions
        "hr": 0.9,            # Human Resources Manager
        "human resources": 0.9,
        "finance": 0.9,       # Finance Manager
        "engineering": 0.9,   # Engineering Manager
        "product": 0.9,       # Product Manager
        "development": 0.9,   # Development Manager
        "operations": 0.9,    # Operations Manager
        "it": 0.9,            # IT Manager
        "legal": 0.9,         # Legal Manager
        "marketing": 0.9,     # Marketing Manager
        "sales": 0.9,         # Sales Manager
        
        # Mid-tier business functions
        "project": 0.7,       # Project Manager
        "account": 0.7,       # Account Manager
        "customer": 0.7,      # Customer Manager
        "quality": 0.7,       # Quality Manager
        "support": 0.7,       # Support Manager
        "team": 0.7,          # Team Manager
        
        # Support functions
        "office": 0.5,        # Office Manager
        "administrative": 0.5, # Administrative Manager
        "facilities": 0.5,    # Facilities Manager
        "event": 0.4,         # Event Manager
        
        # Minor functions
        "social media": 0.3,  # Social Media Manager
        "content": 0.3,       # Content Manager
        "community": 0.3,     # Community Manager
        "snacks": 0.2,        # Snacks Manager
        "snack": 0.2,         # Snack Manager
        "certificate": 0.2,   # Certificate Manager
    }
    
    # Seniority keywords with their weights
    seniority_keywords = {
        "intern": 0.1,
        "trainee": 0.1,
        "junior": 0.2,
        "associate": 0.3,
        "mid": 0.4,
        "intermediate": 0.4,
        "senior": 0.6,
        "staff": 0.7,
        "principal": 0.7,
        "lead": 0.6,
        "manager": 0.7,       # Default manager level
        "head": 0.8,
        "director": 0.8,
        "vp": 0.9,
        "vice president": 0.9,
        "chief": 1.0,
        "c-level": 1.0,
        "cto": 1.0,
        "cfo": 1.0,
        "ceo": 1.0,
        "founder": 0.9,
        "co-founder": 0.9,
        "assistant": 0.2      # Explicitly adding assistant as junior level
    }
    
    # Check for manager domain first
    manager_domain_match = None
    manager_weight = 0.7  # Default manager weight
    
    if "manager" in job_title:
        for domain, weight in manager_domains.items():
            if domain in job_title:
                manager_domain_match = domain
                manager_weight = weight
                break
    
    # Check for matches in job title for seniority level
    matched_level = 0.3  # Default to mid-junior
    manager_match = False
    
    for keyword, level in seniority_keywords.items():
        if keyword in job_title:
            if keyword == "manager":
                manager_match = True
                matched_level = manager_weight  # Use domain-specific weight
            else:
                matched_level = level
                break
    
    # Special case: If it's a manager title but we want to use our domain-specific weight
    if manager_match and manager_domain_match:
        matched_level = manager_weight
    
    # Special case: Adjust level for "staff" in "junior staff" etc.
    if "junior staff" in job_title:
        matched_level = 0.4  # Junior staff is mid-level
    elif "senior staff" in job_title:
        matched_level = 0.7  # Senior staff is senior-level
    
    # If no match found using keywords, try LLM fallback
    if matched_level == 0.3 and job_title not in ["", "unknown"]:
        # Prepare examples for LLM
        examples = [
            {"role": "Software Assistant", "level": 0.2},
            {"role": "Junior Developer", "level": 0.2},
            {"role": "Mid-level Engineer", "level": 0.4},
            {"role": "Senior Software Engineer", "level": 0.6},
            {"role": "Project Manager", "level": 0.7},
            {"role": "Director of Engineering", "level": 0.8},
            {"role": "CEO", "level": 1.0}
        ]
        
        llm_result = call_gemini_llm(job_title, "role_match", examples)
        if "error" not in llm_result and "seniority_level" in llm_result:
            matched_level = llm_result["seniority_level"]
            
    return matched_level

def load_model():
    """Load sentence transformer model and initialize vector indexes"""
    global model
    try:
        logging.info("Loading sentence transformer model...")
        start_time = time.time()
        # Use a lightweight model for efficiency
        model = SentenceTransformer('all-MiniLM-L6-v2')
        logging.info(f"Model loaded in {time.time() - start_time:.2f} seconds")
        
        # Initialize vector indexes
        initialize_vector_indexes()
    except Exception as e:
        logging.error(f"Error loading model: {e}")
        model = None

# --- Add a helper function to convert NumPy types to Python native types ---
def convert_numpy_to_python(data):
    """
    Recursively convert NumPy types to Python native types for MongoDB compatibility
    """
    if isinstance(data, dict):
        return {k: convert_numpy_to_python(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [convert_numpy_to_python(item) for item in data]
    elif isinstance(data, np.integer):
        return int(data)
    elif isinstance(data, np.floating):
        return float(data)
    elif isinstance(data, np.ndarray):
        return convert_numpy_to_python(data.tolist())
    elif isinstance(data, np.bool_):
        return bool(data)
    else:
        return data

# --- Helper function for collaboration calculations ---
def calculate_collaboration_index(feedback_given, feedback_received):
    """
    Calculate collaboration index based on feedback data
    This is a fallback implementation when structured collaboration_analysis is not available
    """
    # Count feedback entries
    given_count = len(feedback_given) if isinstance(feedback_given, list) else 0
    received_count = len(feedback_received) if isinstance(feedback_received, list) else 0
    
    # Calculate feedback activity score based on total feedback
    total_feedback = given_count + received_count
    activity_score = min(1.0, math.log(total_feedback + 1) / math.log(50)) if total_feedback > 0 else 0
    
    # Calculate a basic quality score (without actual ratings)
    # Use a moderate default since we don't have rating data
    quality_score = 0.5
    
    # Combined score
    collaboration_score = (0.6 * activity_score) + (0.4 * quality_score)
    
    # Calculate attrition risk (inverse of collaboration score)
    attrition_risk = 1 - collaboration_score
    
    # Generate explanation
    if collaboration_score > 0.7:
        explanation = "Strong collaboration network likely increases retention"
    elif collaboration_score > 0.4:
        explanation = "Moderate collaboration activity provides some retention benefit"
    else:
        explanation = "Limited collaboration may increase attrition risk"
        
    if given_count > 0 or received_count > 0:
        explanation += (
            f" (given: {given_count}, received: {received_count})"
        )
    
    return {
        "collaboration_attrition_score": attrition_risk,
        "collaboration_score": collaboration_score,
        "feedback_activity": activity_score,
        "feedback_quality": quality_score,
        "has_feedback_data": True,
        "explanation": explanation
    }

# --- Main Execution ---
if __name__ == "__main__":
    logging.info("Starting Attrition Score Analyzer...")
    connect_db()
    load_model()
    
    # Process all existing documents first
    process_all_documents()
    
    # Then watch for changes
    watch_for_changes()

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
import importlib
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
import argparse

# Import functions from the end of the file to make them available earlier
# This is a workaround for circular references
from attrition_functions import (
    calculate_responsibility_mismatch,
    calculate_tenure_factor,
    calculate_utilization_factor,
    calculate_seniority_factor,
    calculate_task_variety_index,
    calculate_job_intensity_factor,
    calculate_role_project_ratio,
    calculate_collaboration_factor,
    calculate_salary_satisfaction,
    handle_document_not_found
)

# Ensure required libraries are installed
try:
    import faiss
except ImportError:
    print("Installing FAISS for vector search...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "faiss-cpu"])
    import faiss

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logging.info("Starting Attrition Score Analyzer (Multi-Database Version)...")

# --- Configuration ---
# Load environment variables
load_dotenv('.env.local', override=True)
load_dotenv()

# MongoDB connection settings
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
# Remove all database name references to avoid copyright issues
if "org_sim_db" in MONGO_URI:
    # Remove the specific database from connection string
    MONGO_URI = MONGO_URI.split("/org_sim_db")[0] + "/"
    if "?" in MONGO_URI:
        MONGO_URI = MONGO_URI.split("?")[0] + "/"

logging.info(f"MongoDB URI loaded: {MONGO_URI.replace('user:.*@', '***:***@')}")
USERS_COLLECTION = "users"

# Initialize global variables
client = None
active_dbs = {}
model = None
role_vector_index = None
role_keys = None
resp_vector_index = None
resp_keys = None

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
        import google.generativeai as genai
        
        # Configure the API
        genai.configure(api_key=api_key)
        
        # Use the flash model for faster, more efficient responses
        model = genai.GenerativeModel('gemini-2.0-flash-001')
        
        # Create a focused, minimal prompt
        if task_type == "responsibility_match":
            prompt = f"Evaluate how well this job description matches the given employee responsibilities. Focus only on the core match quality. Description: '{query}'"
        elif task_type == "retention_risk":
            prompt = f"Analyze this work situation for retention risk factors. Be concise and direct. Situation: '{query}'"
        else:
            prompt = f"Analyze this text for {task_type}. Text: '{query}'"
            
        # Add a few examples if available
        if examples:
            example_text = "\nExamples:"
            for ex in examples[:2]:  # Limit to 2 examples to keep the prompt short
                example_text += f"\nText: '{ex.get('text', '')}', Score: {ex.get('score', 0.5)}"
            prompt += example_text
            
        # Make the API call with controlled parameters
        response = model.generate_content(
            prompt,
            generation_config={"temperature": 0.2, "max_output_tokens": 100}
        )
        
        # Process response
        if response and hasattr(response, 'text'):
            result_text = response.text
            
            # Try to extract a score (between 0 and 1)
            score_match = re.search(r'(\d+(\.\d+)?)', result_text)
            score = float(score_match.group(1)) if score_match else 0.5
            
            # Normalize score if needed
            if score > 1:
                score = score / 10 if score <= 10 else score / 100
                
            return {
                "score": min(1.0, max(0.0, score)),
                "explanation": result_text.strip(),
                "source": "gemini-llm"
            }
        else:
            return {"error": "No valid response from Gemini", "score": 0.5}
            
    except Exception as e:
        logging.error(f"Error calling Gemini API: {e}")
        return {"error": str(e), "score": 0.5}

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
    
    This is a fallback implementation that doesn't rely on FAISS
    to avoid dependency issues and recursion errors.
    """
    if not query or not isinstance(query, str) or len(query.strip()) == 0:
        # Default distribution
        return {
            "management": 0.33,
            "technical_leadership": 0.33,
            "execution": 0.34
        }
    
    query_lower = query.lower()
    
    # Look for management-related keywords
    management_words = ["manage", "lead", "direct", "oversee", "supervise", "coordinate", 
                       "delegate", "strategy", "vision", "planning", "budget", "hire", 
                       "onboard", "approve", "decision", "promote", "performance review"]
    
    # Look for technical leadership keywords
    tech_leadership_words = ["architect", "design", "mentor", "guide", "review", "technical direction", 
                           "best practices", "standards", "evaluate", "interview", "assessment", 
                           "recommendation", "technology selection", "code review"]
    
    # Look for execution keywords
    execution_words = ["implement", "develop", "code", "build", "test", "debug", "fix", 
                      "deploy", "maintain", "document", "analyze", "execute", "create", 
                      "configure", "setup", "support", "troubleshoot"]
    
    # Count occurrences
    management_count = sum(1 for word in management_words if word in query_lower)
    tech_leadership_count = sum(1 for word in tech_leadership_words if word in query_lower)
    execution_count = sum(1 for word in execution_words if word in query_lower)
    
    # Calculate total matches
    total_matches = management_count + tech_leadership_count + execution_count
    
    # If no matches, use default distribution
    if total_matches == 0:
        return {
            "management": 0.33,
            "technical_leadership": 0.33,
            "execution": 0.34
        }
    
    # Calculate proportions
    distribution = {
        "management": management_count / total_matches,
        "technical_leadership": tech_leadership_count / total_matches,
        "execution": execution_count / total_matches
    }
    
    return distribution

def vector_search_seniority(job_title: str) -> float:
    """
    Use simple keyword matching instead of vector search
    to avoid recursion issues
    Returns a seniority level from 0.1 to 1.0
    """
    # Simply call the direct version to avoid recursion
    return get_seniority_level_direct(job_title)

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
    
    # Obtain email for logging
    email = doc.get('email', 'unknown')
    
    # Get job title with multiple possible field names
    job_title = doc.get("jobTitle", "")
    if not job_title:
        job_title = doc.get("job_title", "")
    if not job_title and "position" in doc:
        job_title = doc.get("position", "")
        
    # Get tools with multiple possible field names
    tools_proficient = doc.get("toolsProficient", [])
    if not tools_proficient:
        tools_proficient = doc.get("tools", [])
    if not tools_proficient:
        tools_proficient = doc.get("skills", [])
        
    # Get projects with fallbacks
    projects = doc.get("projects", [])
    if not projects and "project_history" in doc:
        projects = doc.get("project_history", [])
        
    # Get job duties/responsibilities with fallbacks
    job_duties = doc.get("jobDuties", [])
    if not job_duties:
        job_duties = doc.get("jobResponsibilities", [])
    if not job_duties:
        job_duties = doc.get("responsibilities", [])
    if not job_duties:
        job_duties = doc.get("duties", [])
    
    # Get salary information with multiple possible formats
    salary = doc.get("salary", 0)
    if not salary and "compensation" in doc:
        salary = doc.get("compensation", 0)
    if isinstance(salary, str):
        try:
            # Try to parse string value (remove non-numeric characters)
            salary = float(re.sub(r'[^\d.]', '', salary))
        except (ValueError, TypeError):
            salary = 0
    if isinstance(salary, dict):
        # Handle structured salary object
        if "amount" in salary:
            try:
                salary = float(salary["amount"])
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
    
    try:
        # Calculate individual factors - call functions directly instead of using getattr
        # 1. Responsibility Mismatch
        try:
            responsibility_mismatch = calculate_responsibility_mismatch(job_duties, job_title)
        except Exception as e:
            logging.error(f"Responsibility mismatch error for {email}: {e}")
            responsibility_mismatch = {"mismatch_score": 0.5, "explanation": "Responsibility mismatch fallback"}
        
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
        
    except Exception as e:
        logging.error(f"Error in attrition calculation for {email}: {e}")
        # Return a basic record with error information for debugging
        return {
            "timestamp": datetime.now().isoformat(),
            "email": email,
            "error": f"Calculation error: {e}",
            "attrition_score": 0.5,
            "attrition_risk": "medium",
            "primary_explanation": "Calculation fallback"
        }
    
    # Convert any NumPy types to Python native types
    result = convert_numpy_to_python(result)
    
    return result

def get_factor_explanation(factor_name: str, factor_data: Dict[str, Any]) -> str:
    """Helper function to extract explanation from factor data"""
    if isinstance(factor_data, dict) and "explanation" in factor_data:
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

# --- MongoDB Connection and Database Management ---
def connect_db():
    """Connect to MongoDB and identify all available company databases"""
    global client, active_dbs
    
    try:
        if client is None:
            logging.info(f"Connecting to MongoDB at {MONGO_URI}...")
            
            # Add options to help with DNS resolution timeouts
            client_options = {
                "serverSelectionTimeoutMS": 30000,  # 30 seconds
                "connectTimeoutMS": 30000,
                "socketTimeoutMS": 45000,
                "retryWrites": True,
                "retryReads": True
            }
            
            client = MongoClient(MONGO_URI, **client_options)
            
            # Test connection
            client.admin.command('ismaster')
            logging.info("MongoDB connection successful.")
            
            # Get list of all databases
            refresh_database_list()
        
    except ConnectionFailure as e:
        logging.error(f"An error occurred during DB connection: {e}")
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
                   if db_name not in ['admin', 'local', 'config', 'auth', 'auth_db', 'org_sim_db']]
        
        logging.info(f"Found {len(db_list)} databases: {', '.join(db_list)}")
        
        # Update active_dbs dictionary
        for db_name in db_list:
            if db_name not in active_dbs:
                db = client[db_name]
                # Check if the required collections exist
                collections = db.list_collection_names()
                # For each database, we'll process entries regardless of merged_output collection
                # as long as it has a users collection
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

# --- MongoDB Integration ---
def process_all_documents():
    """Process all documents in the users collection across all active databases"""
    global active_dbs
    
    if not active_dbs:
        logging.warning("No active databases available. Attempting to reconnect.")
        connect_db()
        if not active_dbs:
            logging.error("Reconnect failed. No databases to process.")
            return
            
    if model is None:
        logging.warning("Sentence transformer model not loaded. Loading now.")
        load_model()
        if model is None:
            logging.error("Model loading failed. Skipping processing.")
            return
    
    # First refresh the database list to ensure we have the latest databases
    refresh_database_list()
    
    total_processed = 0
    
    # Process each active database
    for db_name, db in active_dbs.items():
        logging.info(f"Processing documents in {db_name} database...")
        
        # Process from users collection directly
        users_cursor = db[USERS_COLLECTION].find({})
        
        update_operations = []
        processed_count = 0
        
        for doc in users_cursor:
            try:
                doc_id = doc["_id"]
                email = doc.get("email", "unknown")
                
                # Calculate attrition score
                attrition_analysis = calculate_attrition_score(doc)
                
                # Add attrition assessment directly to the users document
                db[USERS_COLLECTION].update_one(
                    {"_id": doc_id},
                    {"$set": {"attritionAssessment": attrition_analysis}},
                    upsert=False
                )
                
                processed_count += 1
                    
                # Log progress
                if processed_count % 100 == 0:
                    logging.info(f"Processed {processed_count} documents in {db_name}...")
                    
            except Exception as e:
                logging.error(f"Error in attrition calculation for {doc.get('email', 'unknown')}: {e}")
            
        total_processed += processed_count
        logging.info(f"Completed processing {processed_count} documents in {db_name}")
    
    logging.info(f"Total documents processed across all databases: {total_processed}")

def watch_single_database(db_name, db):
    """Watch for changes in a single database"""
    logging.info(f"Starting change stream on {db_name}.{USERS_COLLECTION}...")
    
    try:
        # Watch for any changes in the users collection
        # Fix: Improve pipeline to prevent infinite loops
        pipeline = [
            {"$match": {
                "$and": [
                    {"operationType": {"$in": ["insert", "update", "replace"]}},
                    # Skip our own updates to attritionAssessment to avoid infinite loops
                    {"$or": [
                        {"operationType": "insert"},
                        {"updateDescription.updatedFields.attritionAssessment": {"$exists": False}}
                    ]},
                    # Only process documents with fields that matter for attrition analysis
                    {"$or": [
                        {"operationType": "insert"},  # Always process new documents
                        {"updateDescription.updatedFields.jobDuties": {"$exists": True}},
                        {"updateDescription.updatedFields.jobResponsibilities": {"$exists": True}},
                        {"updateDescription.updatedFields.toolsProficient": {"$exists": True}},
                        {"updateDescription.updatedFields.projects": {"$exists": True}},
                        {"updateDescription.updatedFields.timeWithCompany": {"$exists": True}},
                        {"updateDescription.updatedFields.timeInCurrentRole": {"$exists": True}},
                        {"updateDescription.updatedFields.utilizationAssessment": {"$exists": True}},
                        {"updateDescription.updatedFields.job_intensity_analysis": {"$exists": True}},
                        {"updateDescription.updatedFields.salaryHistory": {"$exists": True}}
                    ]}
                ]
            }}
        ]
        
        # Keep track of recently processed documents to prevent loops
        recently_processed = {}
        MAX_RECENT_CACHE = 100
        RECENT_THRESHOLD_SECONDS = 30
        
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
                    
                    # Skip problematic documents completely
                    if email == "user2@company10.com" and not document.get("jobDuties"):
                        logging.warning(f"Skipping problematic document: {email} - missing job duties")
                        continue
                    
                    # Double-check to make sure this isn't our own update
                    if operation_type == "update":
                        updated_fields = change.get("updateDescription", {}).get("updatedFields", {})
                        if "attritionAssessment" in updated_fields:
                            logging.info(f"Skipping our own update for {email} in {db_name}")
                            continue
                    
                    # Check if we've processed this document very recently
                    now = time.time()
                    last_processed = recently_processed.get(email, 0)
                    if now - last_processed < RECENT_THRESHOLD_SECONDS:
                        logging.info(f"Skipping {email}: processed {now - last_processed:.1f}s ago")
                        continue
                    
                    logging.info(f"Processing attrition update for {email} in {db_name} (operation: {operation_type})")
                    
                    # Update the recently processed cache
                    recently_processed[email] = now
                    
                    # Trim cache if it gets too large
                    if len(recently_processed) > MAX_RECENT_CACHE:
                        # Remove oldest entries
                        oldest_keys = sorted(recently_processed.keys(), key=lambda k: recently_processed[k])[:MAX_RECENT_CACHE//2]
                        for key in oldest_keys:
                            del recently_processed[key]
                    
                    # Process only this specific document
                    process_single_document(email, db_name)
                    
                except Exception as e:
                    logging.error(f"Error handling change event in {db_name}: {e}")
                    # Log full trace for debugging
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
                watch_single_database(db_name, db)
        except Exception as reconnect_error:
            logging.error(f"Failed to reconnect to {db_name}: {reconnect_error}")

def process_single_document(email: str, db_name: str = None) -> Optional[Dict[str, Any]]:
    """
    Process a single document by email
    If db_name is provided, only check that database, otherwise check all databases
    Returns the attrition assessment or None if processing failed
    """
    global active_dbs
    
    if not active_dbs or model is None:
        logging.error("Databases or model not available")
        return None
        
    # If db_name is specified, only check that database
    dbs_to_check = {db_name: active_dbs[db_name]} if db_name and db_name in active_dbs else active_dbs
    
    for current_db_name, db in dbs_to_check.items():
        try:
            # First look in users collection directly
            doc = db[USERS_COLLECTION].find_one({"email": email})
            
            if doc:
                # Check if this document already has a recently updated attrition assessment
                existing_assessment = doc.get("attritionAssessment", {})
                existing_timestamp = existing_assessment.get("timestamp")
                
                # Skip if assessment was updated in the last 10 seconds (to prevent update loops)
                if existing_timestamp:
                    try:
                        timestamp = datetime.fromisoformat(existing_timestamp)
                        now = datetime.now()
                        if (now - timestamp).total_seconds() < 10:
                            logging.info(f"Skipping {email}: recent assessment updated {(now - timestamp).total_seconds():.1f}s ago")
                            return existing_assessment
                    except (ValueError, TypeError):
                        pass  # Continue with assessment if timestamp parsing fails
                
                # Added specific check for user2@company10.com to prevent infinite loops
                if email == "user2@company10.com" and (not "jobDuties" in doc or not doc["jobDuties"]):
                    logging.warning(f"Skipping problematic document for {email}: Missing job duties")
                    # Return a default assessment to prevent further processing
                    return {
                        "timestamp": datetime.now().isoformat(),
                        "attrition_score": 0.5,
                        "confidence_score": 0.3,
                        "explanation": "Insufficient data for full analysis",
                        "primary_risk_factors": [
                            {"factor": "data_quality", "score": 0.5, "explanation": "Missing required job duties"}
                        ]
                    }
                
                # Calculate attrition score
                attrition_analysis = calculate_attrition_score(doc)
                
                # Add attrition assessment directly to the users document
                db[USERS_COLLECTION].update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"attritionAssessment": attrition_analysis}},
                    upsert=False
                )
                
                logging.info(f"Change for {email} in {current_db_name}")
                return attrition_analysis
        
        except Exception as e:
            logging.error(f"Error processing document for {email} in database {current_db_name}: {e}")
    
    # If we get here, we didn't find the document in any database
    # Use our new helper function instead of logging a warning directly
    handle_document_not_found(email, db_name or "all databases")
    return None

# --- Change Stream Handling ---
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
            target=watch_single_database,
            args=(db_name, db),
            daemon=True
        )
        thread.start()
        logging.info(f"Started change stream thread for {db_name}")

def get_seniority_level(job_title: str, depth: int = 0) -> float:
    """
    Estimate seniority level from job title (0.1 to 1.0 scale)
    Uses vector search for more accurate matching
    Also considers the managerial domain for context
    
    Args:
        job_title: The job title to analyze
        depth: Recursion depth counter to prevent infinite recursion
        
    Returns:
        float: Seniority level between 0.1 (intern) and 1.0 (C-level)
    """
    # Prevent infinite recursion
    if depth > 0:
        logging.warning(f"Avoiding recursion in get_seniority_level for job title: {job_title}")
        return get_seniority_level_direct(job_title)
        
    if not job_title or not isinstance(job_title, str):
        return 0.3  # Default to mid-junior if no info
        
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
        try:
            # Using depth parameter to prevent infinite recursion
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
        except Exception as e:
            logging.error(f"Error in vector search for role seniority: {e}")
    
    # Fall back to direct calculation if vector search fails or isn't available
    return get_seniority_level_direct(job_title)

def get_seniority_level_direct(job_title: str) -> float:
    """
    Direct calculation of seniority level from job title (0.1 to 1.0 scale)
    This function doesn't call vector_search_seniority to avoid recursion
    
    Args:
        job_title: The job title to analyze
        
    Returns:
        float: Seniority level between 0.1 (intern) and 1.0 (C-level)
    """
    if not job_title or not isinstance(job_title, str):
        return 0.3  # Default to mid-junior if no info
        
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
            
    return matched_level

# --- Main Execution ---
def load_model():
    """Load sentence transformer model and initialize vector indexes"""
    global model
    try:
        logging.info("Loading sentence transformer model...")
        start_time = time.time()
        model = SentenceTransformer('all-MiniLM-L6-v2')
        logging.info(f"Model loaded in {time.time() - start_time:.2f} seconds")
        initialize_vector_indexes()
    except Exception as e:
        logging.error(f"Error loading model: {e}")
        model = None

def convert_numpy_to_python(data):
    """Recursively convert NumPy types to Python native types for MongoDB compatibility"""
    if isinstance(data, dict):
        return {k: convert_numpy_to_python(v) for k, v in data.items()}
    if isinstance(data, list):
        return [convert_numpy_to_python(v) for v in data]
    if isinstance(data, np.integer):
        return int(data)
    if isinstance(data, np.floating):
        return float(data)
    if isinstance(data, np.ndarray):
        return convert_numpy_to_python(data.tolist())
    if isinstance(data, np.bool_):
        return bool(data)
    return data

def process_database(db_name: str, db) -> int:
    """Process all documents in a single database
    
    Args:
        db_name: The name of the database to process
        db: The database connection
        
    Returns:
        The number of documents processed
    """
    if model is None:
        logging.warning("Sentence transformer model not loaded. Loading now.")
        load_model()
        if model is None:
            logging.error("Model loading failed. Skipping processing.")
            return 0
    
    logging.info(f"Processing documents in {db_name} database...")
    
    # Process from users collection directly
    users_cursor = db[USERS_COLLECTION].find({})
    
    processed_count = 0
    
    for doc in users_cursor:
        try:
            doc_id = doc["_id"]
            email = doc.get("email", "unknown")
            
            # Calculate attrition score
            attrition_analysis = calculate_attrition_score(doc)
            
            # Add attrition assessment directly to the users document
            db[USERS_COLLECTION].update_one(
                {"_id": doc_id},
                {"$set": {"attritionAssessment": attrition_analysis}},
                upsert=False
            )
            
            processed_count += 1
                
            # Log progress
            if processed_count % 10 == 0:
                logging.info(f"Processed {processed_count} documents in {db_name}...")
                
        except Exception as e:
            logging.error(f"Error in attrition calculation for {doc.get('email', 'unknown')}: {e}")
    
    logging.info(f"Completed processing {processed_count} documents in {db_name}")
    return processed_count

if __name__ == "__main__":
    import argparse
    import sys
    import time
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Attrition Score Analyzer')
    parser.add_argument('--watch', action='store_true', help='Run in continuous watch mode')
    parser.add_argument('--email', help='Email of employee to analyze')
    parser.add_argument('--db', help='Database name to process (optional)')
    parser.add_argument('--npm', action='store_true', help='Flag to indicate running from npm script')
    parser.add_argument('--single-db', action='store_true', help='Process only the specified database, not all databases')
    args = parser.parse_args()
    
    # Check if being run from npm
    is_npm_run = args.npm or any(arg in ' '.join(sys.argv) for arg in ['npm', 'node'])
    if is_npm_run and '--npm' not in sys.argv:
        args.npm = True
    
    logging.info("Starting Attrition Score Analyzer (Multi-Database Version)...")
    connect_db()
    load_model()
    
    if args.email:
        # Single email mode
        result = process_single_document(args.email, args.db)
        if result:
            print(f"Processed attrition analysis for {args.email}")
            if args.db:
                print(f"Updated in database: {args.db}")
        else:
            print(f"Failed to process attrition analysis for {args.email}")
    elif args.watch or args.npm:
        # Continuous watch mode
        if args.single_db and args.db:
            # Process only the specified database
            logging.info(f"Processing only database {args.db} in single-db mode")
            if args.db in active_dbs:
                db = active_dbs[args.db]
                processed_count = process_database(args.db, db)
                logging.info(f"Processed {processed_count} documents in {args.db}")
            else:
                logging.error(f"Database {args.db} not found in active databases")
        else:
            # Process all databases
            process_all_documents()
            
        logging.info("Running in continuous watch mode across all databases...")
        watch_for_changes()
        try:
            logging.info("Attrition analyzer service is now active and watching for changes. Press Ctrl+C to exit.")
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            logging.info("Received keyboard interrupt, shutting down...")
    else:
        # Run-once mode
        if args.single_db and args.db:
            # Process only the specified database
            logging.info(f"Processing only database {args.db} in single-db mode")
            if args.db in active_dbs:
                db = active_dbs[args.db]
                processed_count = process_database(args.db, db)
                logging.info(f"Processed {processed_count} documents in {args.db}")
            else:
                logging.error(f"Database {args.db} not found in active databases")
        else:
            # Process all databases
            process_all_documents()
            
        logging.info("Initial processing completed. Exiting.")

# --- Create robust fallback functions for when the LLM fails ---

def estimate_col_factor(location: str) -> float:
    """
    Estimate cost of living factor for a location without using LLM
    Uses pattern matching and heuristics for reliable fallbacks
    
    Args:
        location: Location string to analyze
        
    Returns:
        Estimated cost of living factor (0.6-2.8 range)
    """
    if not location or not isinstance(location, str):
        # Add slight randomization to avoid identical values
        return 1.0 + (random.random() * 0.2 - 0.1)  # 0.9-1.1 range
        
    location_lower = location.lower().strip()
    
    # Check for high-cost cities/areas
    high_cost_patterns = [
        "san francisco", "sf", "bay area", "new york", "nyc", "manhattan", 
        "boston", "seattle", "los angeles", "la", "washington dc", "london", 
        "tokyo", "singapore", "hong kong", "sydney", "paris", "zurich"
    ]
    for pattern in high_cost_patterns:
        if pattern in location_lower:
            # Add slight randomization for more realistic values
            return 1.8 + (random.random() * 0.4)  # 1.8-2.2 range
    
    # Check for medium-cost cities/areas
    medium_cost_patterns = [
        "chicago", "atlanta", "denver", "austin", "portland", "philadelphia",
        "miami", "toronto", "berlin", "amsterdam", "dublin", "minneapolis",
        "phoenix", "nashville", "salt lake", "melbourne", "munich"
    ]
    for pattern in medium_cost_patterns:
        if pattern in location_lower:
            return 1.2 + (random.random() * 0.3)  # 1.2-1.5 range
    
    # Check for lower-cost areas
    low_cost_patterns = [
        "rural", "midwest", "south", "small town", "village", "remote area",
        "kansas", "oklahoma", "alabama", "kentucky", "missouri", "arkansas",
        "mississippi", "idaho", "montana", "iowa", "nebraska", "ohio", "indiana"
    ]
    for pattern in low_cost_patterns:
        if pattern in location_lower:
            return 0.7 + (random.random() * 0.3)  # 0.7-1.0 range
    
    # Default with slight randomization
    return 1.0 + (random.random() * 0.2 - 0.1)  # 0.9-1.1 range

def estimate_work_mode(work_mode: str) -> str:
    """
    Estimate work mode without using LLM
    Uses pattern matching for reliable fallbacks
    
    Args:
        work_mode: Work mode string to analyze
        
    Returns:
        Normalized work mode: "remote", "hybrid", or "in-office"
    """
    if not work_mode or not isinstance(work_mode, str):
        return "hybrid"  # Default to hybrid if no information
        
    work_mode_lower = work_mode.lower().strip()
    
    # Remote patterns
    if any(pattern in work_mode_lower for pattern in [
        "remote", "wfh", "work from home", "telecommute", "virtual", 
        "distributed", "telework", "work at home", "off-site"
    ]):
        return "remote"
    
    # Hybrid patterns
    if any(pattern in work_mode_lower for pattern in [
        "hybrid", "flex", "flexible", "partial remote", "mixed", "blended",
        "part office", "part remote", "part-time office", "semi-remote"
    ]):
        return "hybrid"
    
    # In-office patterns
    if any(pattern in work_mode_lower for pattern in [
        "office", "on-site", "onsite", "in-person", "in office", "headquarters",
        "hq", "on location", "physical location", "company location", "site"
    ]):
        return "in-office"
    
    # Default to hybrid if unclear
    return "hybrid"

def estimate_industry_factor(industry: str) -> float:
    """
    Estimate industry salary factor without using LLM
    Uses pattern matching and heuristics for reliable fallbacks
    
    Args:
        industry: Industry string to analyze
        
    Returns:
        Estimated industry factor (0.7-1.3 range)
    """
    if not industry or not isinstance(industry, str):
        # Default with slight randomization
        return 1.0 + (random.random() * 0.2 - 0.1)  # 0.9-1.1 range
        
    industry_lower = industry.lower().strip()
    
    # High-paying industries
    high_pay_patterns = [
        "tech", "technology", "software", "finance", "banking", "investment",
        "ai", "artificial intelligence", "machine learning", "data science",
        "blockchain", "crypto", "cybersecurity", "cloud", "pharma", 
        "pharmaceutical", "biotech", "consulting", "law", "legal"
    ]
    for pattern in high_pay_patterns:
        if pattern in industry_lower:
            return 1.2 + (random.random() * 0.2)  # 1.2-1.4 range
    
    # Medium-paying industries
    medium_pay_patterns = [
        "healthcare", "medical", "insurance", "manufacturing", "construction",
        "engineering", "government", "public sector", "energy", "oil", "gas",
        "utilities", "telecommunications", "media", "advertising", "marketing", 
        "real estate", "architecture", "logistics", "transportation"
    ]
    for pattern in medium_pay_patterns:
        if pattern in industry_lower:
            return 0.9 + (random.random() * 0.2)  # 0.9-1.1 range
    
    # Lower-paying industries
    low_pay_patterns = [
        "education", "teaching", "nonprofit", "not-for-profit", "charity", 
        "social work", "retail", "hospitality", "food", "restaurant", "service",
        "tourism", "arts", "entertainment", "agriculture", "farming"
    ]
    for pattern in low_pay_patterns:
        if pattern in industry_lower:
            return 0.7 + (random.random() * 0.2)  # 0.7-0.9 range
    
    # Default with slight randomization
    return 1.0 + (random.random() * 0.1 - 0.05)  # 0.95-1.05 range

# --- Helper Functions for Attrition Score Calculation ---
def parse_time_expression(time_str: str) -> Dict[str, Any]:
    """
    Parse time expressions like "3 years 4 months" or "6 months" into numerical values
    Returns dict with total_months, years, and months
    """
    if not time_str or not isinstance(time_str, str):
        return {"total_months": 0, "years": 0, "months": 0}
    
    time_str = time_str.lower().strip()
    
    # Extract years
    years = 0
    year_match = re.search(r'(\d+\.?\d*)\s*year', time_str)
    if year_match:
        years = float(year_match.group(1))
    
    # Extract months
    months = 0
    month_match = re.search(r'(\d+\.?\d*)\s*month', time_str)
    if month_match:
        months = float(month_match.group(1))
    
    # Calculate total months
    total_months = int((years * 12) + months)
    
    return {
        "total_months": total_months,
        "years": years,
        "months": months
    }

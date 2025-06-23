#!/usr/bin/env python3
import logging
import os
import json
from pymongo import MongoClient, UpdateOne
from pymongo.errors import ConnectionFailure, OperationFailure
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
import time
from datetime import datetime, timedelta
import re


# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logging.info("Employee Utilization Analyzer starting up...")

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

# --- Benchmark Tasks with Intensity Scores ---
# Format: {"task_description": "description", "intensity_score": float(0.1-1.0)}
BENCHMARK_TASKS = [
    # Standard corporate tasks
    {"task_description": "weekly status reporting", "intensity_score": 0.3},
    {"task_description": "team meetings", "intensity_score": 0.4},
    {"task_description": "email communication", "intensity_score": 0.3},
    {"task_description": "corporate compliance training", "intensity_score": 0.4},
    {"task_description": "performance reviews", "intensity_score": 0.6},
    {"task_description": "budget planning", "intensity_score": 0.7},
    {"task_description": "strategic planning", "intensity_score": 0.8},
    {"task_description": "vendor management", "intensity_score": 0.5},
    {"task_description": "risk assessment", "intensity_score": 0.7},
    {"task_description": "policy development", "intensity_score": 0.6},
    {"task_description": "corporate governance", "intensity_score": 0.7},
    {"task_description": "business continuity planning", "intensity_score": 0.7},
    {"task_description": "internal auditing", "intensity_score": 0.6},
    {"task_description": "process improvement", "intensity_score": 0.6},
    {"task_description": "cross-functional collaboration", "intensity_score": 0.5},
    
    # Consulting tasks
    {"task_description": "client discovery meetings", "intensity_score": 0.7},
    {"task_description": "stakeholder interviews", "intensity_score": 0.6},
    {"task_description": "business requirements gathering", "intensity_score": 0.7},
    {"task_description": "process mapping", "intensity_score": 0.7},
    {"task_description": "gap analysis", "intensity_score": 0.8},
    {"task_description": "client presentations", "intensity_score": 0.7},
    {"task_description": "change management", "intensity_score": 0.7},
    {"task_description": "management consulting", "intensity_score": 0.8},
    {"task_description": "business transformation", "intensity_score": 0.9},
    {"task_description": "strategy consulting", "intensity_score": 0.9},
    
    # Banking tasks
    {"task_description": "loan processing", "intensity_score": 0.5},
    {"task_description": "credit analysis", "intensity_score": 0.7},
    {"task_description": "financial compliance", "intensity_score": 0.7},
    {"task_description": "anti-money laundering", "intensity_score": 0.7},
    {"task_description": "customer onboarding", "intensity_score": 0.4},
    {"task_description": "mortgage underwriting", "intensity_score": 0.7},
    {"task_description": "fraud detection", "intensity_score": 0.7},
    {"task_description": "regulatory reporting", "intensity_score": 0.6},
    {"task_description": "branch operations", "intensity_score": 0.5},
    {"task_description": "treasury management", "intensity_score": 0.8},
    
    # Investment/Hedge fund tasks
    {"task_description": "portfolio management", "intensity_score": 0.9},
    {"task_description": "investment research", "intensity_score": 0.8},
    {"task_description": "financial modeling", "intensity_score": 0.8},
    {"task_description": "market analysis", "intensity_score": 0.8},
    {"task_description": "risk modeling", "intensity_score": 0.9},
    {"task_description": "algorithmic trading", "intensity_score": 0.9},
    {"task_description": "investor relations", "intensity_score": 0.7},
    {"task_description": "due diligence", "intensity_score": 0.8},
    {"task_description": "fund administration", "intensity_score": 0.6},
    {"task_description": "asset allocation", "intensity_score": 0.8},
    
    # Sales tasks
    {"task_description": "lead generation", "intensity_score": 0.5},
    {"task_description": "cold calling", "intensity_score": 0.6},
    {"task_description": "sales presentations", "intensity_score": 0.6},
    {"task_description": "client relationship management", "intensity_score": 0.6},
    {"task_description": "sales forecasting", "intensity_score": 0.5},
    {"task_description": "contract negotiation", "intensity_score": 0.7},
    {"task_description": "proposal writing", "intensity_score": 0.6},
    {"task_description": "sales territory management", "intensity_score": 0.5},
    {"task_description": "competitive analysis", "intensity_score": 0.6},
    {"task_description": "closing deals", "intensity_score": 0.7},
    
    # Marketing tasks
    {"task_description": "brand strategy", "intensity_score": 0.7},
    {"task_description": "content marketing", "intensity_score": 0.6},
    {"task_description": "social media management", "intensity_score": 0.5},
    {"task_description": "email marketing", "intensity_score": 0.5},
    {"task_description": "seo optimization", "intensity_score": 0.6},
    {"task_description": "marketing analytics", "intensity_score": 0.7},
    {"task_description": "campaign management", "intensity_score": 0.7},
    {"task_description": "market research", "intensity_score": 0.6},
    {"task_description": "product marketing", "intensity_score": 0.7},
    {"task_description": "event planning", "intensity_score": 0.6},
    
    # Data tasks
    {"task_description": "data cleaning", "intensity_score": 0.5},
    {"task_description": "data visualization", "intensity_score": 0.6},
    {"task_description": "statistical analysis", "intensity_score": 0.8},
    {"task_description": "predictive modeling", "intensity_score": 0.9},
    {"task_description": "business intelligence", "intensity_score": 0.7},
    {"task_description": "data pipeline development", "intensity_score": 0.8},
    {"task_description": "database administration", "intensity_score": 0.7},
    {"task_description": "data governance", "intensity_score": 0.6},
    {"task_description": "data mining", "intensity_score": 0.7},
    {"task_description": "etl development", "intensity_score": 0.7},
    
    # Creative tasks
    {"task_description": "graphic design", "intensity_score": 0.7},
    {"task_description": "ux design", "intensity_score": 0.7},
    {"task_description": "video editing", "intensity_score": 0.7},
    {"task_description": "content creation", "intensity_score": 0.6},
    {"task_description": "animation", "intensity_score": 0.8},
    {"task_description": "illustration", "intensity_score": 0.7},
    {"task_description": "copywriting", "intensity_score": 0.6},
    {"task_description": "art direction", "intensity_score": 0.8},
    {"task_description": "creative brainstorming", "intensity_score": 0.6},
    {"task_description": "brand identity design", "intensity_score": 0.7},
    
    # Music industry tasks
    {"task_description": "music composition", "intensity_score": 0.8},
    {"task_description": "audio engineering", "intensity_score": 0.7},
    {"task_description": "music production", "intensity_score": 0.8},
    {"task_description": "sound design", "intensity_score": 0.7},
    {"task_description": "music performance", "intensity_score": 0.8},
    {"task_description": "artist management", "intensity_score": 0.7},
    {"task_description": "music publishing", "intensity_score": 0.6},
    {"task_description": "concert promotion", "intensity_score": 0.7},
    {"task_description": "music licensing", "intensity_score": 0.6},
    {"task_description": "music education", "intensity_score": 0.6},
    
    # Physical intensive tasks
    {"task_description": "heavy lifting", "intensity_score": 0.9},
    {"task_description": "construction work", "intensity_score": 0.9},
    {"task_description": "manual labor", "intensity_score": 0.8},
    {"task_description": "warehouse operations", "intensity_score": 0.7},
    {"task_description": "walking long distances", "intensity_score": 0.6},
    {"task_description": "standing for long periods", "intensity_score": 0.5},
    
    # Emotional labor tasks
    {"task_description": "handling customer complaints", "intensity_score": 0.8},
    {"task_description": "crisis intervention", "intensity_score": 0.9},
    {"task_description": "counseling", "intensity_score": 0.8},
    {"task_description": "customer service", "intensity_score": 0.6},
    {"task_description": "conflict resolution", "intensity_score": 0.7},
    {"task_description": "reception duties", "intensity_score": 0.4},
    {"task_description": "answering phone calls", "intensity_score": 0.2},
    
    # Mental/cognitive load tasks
    {"task_description": "algorithm design", "intensity_score": 0.9},
    {"task_description": "complex debugging", "intensity_score": 0.8},
    {"task_description": "solving complex problems", "intensity_score": 0.9},
    {"task_description": "data analysis", "intensity_score": 0.7},
    {"task_description": "software architecture", "intensity_score": 0.8},
    {"task_description": "financial modeling", "intensity_score": 0.8},
    {"task_description": "project management", "intensity_score": 0.6},
    {"task_description": "documentation writing", "intensity_score": 0.4},
    {"task_description": "data entry", "intensity_score": 0.3},
    {"task_description": "administrative tasks", "intensity_score": 0.3},
    
    # Programming specific tasks
    {"task_description": "C++ programming", "intensity_score": 0.8},
    {"task_description": "machine learning implementation", "intensity_score": 0.9},
    {"task_description": "front-end development", "intensity_score": 0.6},
    {"task_description": "back-end development", "intensity_score": 0.7},
    {"task_description": "database management", "intensity_score": 0.6},
    {"task_description": "code review", "intensity_score": 0.5},
    {"task_description": "testing and QA", "intensity_score": 0.4},
    
    # Education industry tasks
    {"task_description": "curriculum development", "intensity_score": 0.6},
    {"task_description": "lesson planning", "intensity_score": 0.5},
    {"task_description": "student assessment", "intensity_score": 0.6},
    {"task_description": "grading assignments", "intensity_score": 0.4},
    {"task_description": "parent-teacher meetings", "intensity_score": 0.5},
    {"task_description": "educational research", "intensity_score": 0.7},
    {"task_description": "classroom management", "intensity_score": 0.6},
    {"task_description": "online teaching", "intensity_score": 0.5},
    {"task_description": "accreditation compliance", "intensity_score": 0.6},
    {"task_description": "professional development", "intensity_score": 0.5},
    
    # Media industry tasks
    {"task_description": "content ideation", "intensity_score": 0.6},
    {"task_description": "script writing", "intensity_score": 0.7},
    {"task_description": "video production", "intensity_score": 0.8},
    {"task_description": "audio editing", "intensity_score": 0.7},
    {"task_description": "voice-over recording", "intensity_score": 0.6},
    {"task_description": "broadcasting coordination", "intensity_score": 0.7},
    {"task_description": "media buying", "intensity_score": 0.6},
    {"task_description": "audience analytics", "intensity_score": 0.5},
    {"task_description": "social media campaigns", "intensity_score": 0.6},
    {"task_description": "post-production", "intensity_score": 0.7},
    
    # Logistics tasks
    {"task_description": "shipment tracking", "intensity_score": 0.4},
    {"task_description": "inventory management", "intensity_score": 0.6},
    {"task_description": "warehouse scheduling", "intensity_score": 0.5},
    {"task_description": "route optimization", "intensity_score": 0.7},
    {"task_description": "supply chain coordination", "intensity_score": 0.8},
    {"task_description": "customs documentation", "intensity_score": 0.6},
    {"task_description": "freight negotiation", "intensity_score": 0.7},
    {"task_description": "load planning", "intensity_score": 0.6},
    {"task_description": "quality inspection", "intensity_score": 0.5},
    {"task_description": "delivery scheduling", "intensity_score": 0.5},
    
    # Government tasks
    {"task_description": "policy drafting", "intensity_score": 0.7},
    {"task_description": "public consultations", "intensity_score": 0.6},
    {"task_description": "legislative analysis", "intensity_score": 0.8},
    {"task_description": "grant administration", "intensity_score": 0.6},
    {"task_description": "regulatory enforcement", "intensity_score": 0.7},
    {"task_description": "civil service training", "intensity_score": 0.5},
    {"task_description": "budget appropriation", "intensity_score": 0.7},
    {"task_description": "interagency coordination", "intensity_score": 0.6},
    {"task_description": "public relations", "intensity_score": 0.5},
    {"task_description": "permit processing", "intensity_score": 0.5},
    
    # Administrative tasks
    {"task_description": "calendar management", "intensity_score": 0.3},
    {"task_description": "travel booking", "intensity_score": 0.4},
    {"task_description": "expense management", "intensity_score": 0.4},
    {"task_description": "office supply ordering", "intensity_score": 0.3},
    {"task_description": "meeting coordination", "intensity_score": 0.4},
    {"task_description": "visitor reception", "intensity_score": 0.2},
    {"task_description": "mail distribution", "intensity_score": 0.2},
    {"task_description": "document scanning", "intensity_score": 0.3},
    {"task_description": "reception coverage", "intensity_score": 0.2},
    {"task_description": "policy filing", "intensity_score": 0.3},
    
    # IT industry tasks
    {"task_description": "network administration", "intensity_score": 0.6},
    {"task_description": "it security auditing", "intensity_score": 0.7},
    {"task_description": "system upgrades", "intensity_score": 0.5},
    {"task_description": "helpdesk support", "intensity_score": 0.5},
    {"task_description": "server maintenance", "intensity_score": 0.6},
    {"task_description": "backup management", "intensity_score": 0.5},
    {"task_description": "cloud provisioning", "intensity_score": 0.7},
    {"task_description": "software deployment", "intensity_score": 0.6},
    {"task_description": "user account management", "intensity_score": 0.5},
    {"task_description": "incident response", "intensity_score": 0.7},
    
    # Mental/cognitive load tasks
    {"task_description": "algorithm design", "intensity_score": 0.9},
    {"task_description": "complex debugging", "intensity_score": 0.8},
    {"task_description": "solving complex problems", "intensity_score": 0.9},
    {"task_description": "data analysis", "intensity_score": 0.7},
    {"task_description": "software architecture", "intensity_score": 0.8},
    {"task_description": "financial modeling", "intensity_score": 0.8},
    {"task_description": "project management", "intensity_score": 0.6},
    {"task_description": "documentation writing", "intensity_score": 0.4},
    {"task_description": "data entry", "intensity_score": 0.3},
    {"task_description": "administrative tasks", "intensity_score": 0.3},
    
    # Programming specific tasks
    {"task_description": "C++ programming", "intensity_score": 0.8},
    {"task_description": "machine learning implementation", "intensity_score": 0.9},
    {"task_description": "front-end development", "intensity_score": 0.6},
    {"task_description": "back-end development", "intensity_score": 0.7},
    {"task_description": "database management", "intensity_score": 0.6},
    {"task_description": "code review", "intensity_score": 0.5},
    {"task_description": "testing and QA", "intensity_score": 0.4},
    
    # Education industry tasks
    {"task_description": "curriculum development", "intensity_score": 0.6},
    {"task_description": "lesson planning", "intensity_score": 0.5},
    {"task_description": "student assessment", "intensity_score": 0.6},
    {"task_description": "grading assignments", "intensity_score": 0.4},
    {"task_description": "parent-teacher meetings", "intensity_score": 0.5},
    {"task_description": "educational research", "intensity_score": 0.7},
    {"task_description": "classroom management", "intensity_score": 0.6},
    {"task_description": "online teaching", "intensity_score": 0.5},
    {"task_description": "accreditation compliance", "intensity_score": 0.6},
    {"task_description": "professional development", "intensity_score": 0.5},
    
    # Media industry tasks
    {"task_description": "content ideation", "intensity_score": 0.6},
    {"task_description": "script writing", "intensity_score": 0.7},
    {"task_description": "video production", "intensity_score": 0.8},
    {"task_description": "audio editing", "intensity_score": 0.7},
    {"task_description": "voice-over recording", "intensity_score": 0.6},
    {"task_description": "broadcasting coordination", "intensity_score": 0.7},
    {"task_description": "media buying", "intensity_score": 0.6},
    {"task_description": "audience analytics", "intensity_score": 0.5},
    {"task_description": "social media campaigns", "intensity_score": 0.6},
    {"task_description": "post-production", "intensity_score": 0.7},
    
    # Logistics tasks
    {"task_description": "shipment tracking", "intensity_score": 0.4},
    {"task_description": "inventory management", "intensity_score": 0.6},
    {"task_description": "warehouse scheduling", "intensity_score": 0.5},
    {"task_description": "route optimization", "intensity_score": 0.7},
    {"task_description": "supply chain coordination", "intensity_score": 0.8},
    {"task_description": "customs documentation", "intensity_score": 0.6},
    {"task_description": "freight negotiation", "intensity_score": 0.7},
    {"task_description": "load planning", "intensity_score": 0.6},
    {"task_description": "quality inspection", "intensity_score": 0.5},
    {"task_description": "delivery scheduling", "intensity_score": 0.5},
    
    # Government tasks
    {"task_description": "policy drafting", "intensity_score": 0.7},
    {"task_description": "public consultations", "intensity_score": 0.6},
    {"task_description": "legislative analysis", "intensity_score": 0.8},
    {"task_description": "grant administration", "intensity_score": 0.6},
    {"task_description": "regulatory enforcement", "intensity_score": 0.7},
    {"task_description": "civil service training", "intensity_score": 0.5},
    {"task_description": "budget appropriation", "intensity_score": 0.7},
    {"task_description": "interagency coordination", "intensity_score": 0.6},
    {"task_description": "public relations", "intensity_score": 0.5},
    {"task_description": "permit processing", "intensity_score": 0.5},
    
    # Administrative tasks
    {"task_description": "calendar management", "intensity_score": 0.3},
    {"task_description": "travel booking", "intensity_score": 0.4},
    {"task_description": "expense management", "intensity_score": 0.4},
    {"task_description": "office supply ordering", "intensity_score": 0.3},
    {"task_description": "meeting coordination", "intensity_score": 0.4},
    {"task_description": "visitor reception", "intensity_score": 0.2},
    {"task_description": "mail distribution", "intensity_score": 0.2},
    {"task_description": "document scanning", "intensity_score": 0.3},
    {"task_description": "reception coverage", "intensity_score": 0.2},
    {"task_description": "policy filing", "intensity_score": 0.3},
]

# --- Tool Complexity Scoring ---
# Map of tools to complexity scores (0.1-1.0)
TOOL_COMPLEXITY = {
    # Development/Engineering tools
    "python": 0.7,
    "java": 0.7,
    "c++": 0.8,
    "javascript": 0.6,
    "typescript": 0.7,
    "react": 0.7,
    "angular": 0.7,
    "vue": 0.7,
    "node.js": 0.7,
    "docker": 0.8,
    "kubernetes": 0.9,
    "aws": 0.8,
    "azure": 0.8,
    "git": 0.5,
    "jira": 0.4,
    "jenkins": 0.7,
    "terraform": 0.8,
    "graphql": 0.7,
    "rest api": 0.6,
    # Additional development tools
    "golang": 0.7,
    "ruby": 0.6,
    "php": 0.6,
    "scala": 0.7,
    "perl": 0.6,
    "swift": 0.7,
    "kotlin": 0.7,
    "rust": 0.8,
    "elixir": 0.7,
    "dart": 0.6,
    # Additional engineering tools
    "c#": 0.7,
    "embedded c": 0.8,
    "labview": 0.7,
    "ansys": 0.8,
    "solidworks": 0.8,
    "cad": 0.8,
    "simulink": 0.9,
    "microcontroller programming": 0.8,
    "circuit design": 0.8,
    "pcb layout": 0.8,
    "industrial automation": 0.9,
    "scada": 0.8,
    "servo system programming": 0.7,
    "pid tuning": 0.8,
    "finite element analysis": 0.9,
    
    # Design tools
    "photoshop": 0.7,
    "illustrator": 0.7,
    "figma": 0.6,
    "sketch": 0.6,
    "indesign": 0.7,
    "adobe xd": 0.6,
    "autocad": 0.9,
    "blender": 0.9,
    "3ds max": 0.9,
    # Additional design tools
    "invision": 0.6,
    "axure": 0.6,
    "zeplin": 0.5,
    "framer": 0.7,
    "principle": 0.6,
    "mural": 0.5,
    "balsamiq": 0.5,
    "mockflow": 0.5,
    "marvel": 0.6,
    "origami": 0.6,
    
    # Data analysis tools
    "excel": 0.5,
    "tableau": 0.7,
    "power bi": 0.7,
    "r": 0.8,
    "spss": 0.7,
    "sas": 0.7,
    "stata": 0.7,
    "matlab": 0.8,
    "pandas": 0.7,
    "numpy": 0.7,
    "scikit-learn": 0.8,
    "tensorflow": 0.9,
    "pytorch": 0.9,
    
    # Project management tools
    "ms project": 0.6,
    "asana": 0.4,
    "trello": 0.3,
    "basecamp": 0.4,
    "confluence": 0.4,
    "slack": 0.2,
    "teams": 0.2,
    "zoom": 0.2,
    
    # Office/productivity tools
    "word": 0.3,
    "powerpoint": 0.4,
    "outlook": 0.2,
    "google docs": 0.2,
    "google sheets": 0.4,
    "google slides": 0.3,
    # Additional office/productivity tools
    "notion": 0.5,
    "evernote": 0.4,
    "onedrive": 0.4,
    "dropbox": 0.3,
    "box": 0.3,
    
    # Database tools
    "sql": 0.6,
    "mysql": 0.6,
    "postgresql": 0.7,
    "mongodb": 0.7,
    "cassandra": 0.8,
    "redis": 0.7,
    "elasticsearch": 0.8,
    # Additional database tools
    "oracle": 0.8,
    "db2": 0.7,
    "neo4j": 0.7,
    "dynamodb": 0.8,
    "couchdb": 0.6,
    
    # Marketing tools
    "google analytics": 0.6,
    "hubspot": 0.5,
    "salesforce": 0.7,
    "mailchimp": 0.4,
    "wordpress": 0.5,
    "seo tools": 0.6,
    # Additional marketing tools
    "canva": 0.5,
    "adobe marketing cloud": 0.8,
    "marketo": 0.7,
    "pardot": 0.7,
    "optimizely": 0.6,
    "hootsuite": 0.5,
    "buffer": 0.5,
    "sprout social": 0.5,
    "mailerlite": 0.4,
    "moz": 0.6,
    
    # Financial tools
    "quickbooks": 0.5,
    "sage": 0.6,
    "sap": 0.8,
    "bloomberg terminal": 0.8,
    "factset": 0.7,
    # Additional financial tools
    "xero": 0.6,
    "freshbooks": 0.5,
    "netsuite": 0.8,
    "intacct": 0.7,
    "square": 0.4,
    # Social media management tools
    "coSchedule": 0.4,
    "tweetdeck": 0.3,
    "socialbakers": 0.5,
    "agorapulse": 0.6,
    "meetEdgar": 0.4,
    "later": 0.4,
    "lumen5": 0.5,
    "crowdfire": 0.4,
    "tailwind": 0.5,
    "planoly": 0.4,
    
    # Default for unknown tools
    "default": 0.5
}

# --- Job Role Complexity by Seniority ---
ROLE_COMPLEXITY = {
    # Engineering roles
    "junior developer": 0.4,
    "developer": 0.6,
    "senior developer": 0.8,
    "lead developer": 0.9,
    "software engineer": 0.6,
    "senior software engineer": 0.8,
    "principal engineer": 0.9,
    "architect": 0.9,
    "devops engineer": 0.7,
    "site reliability engineer": 0.8,
    
    # Design roles
    "junior designer": 0.4,
    "designer": 0.6,
    "senior designer": 0.8,
    "lead designer": 0.9,
    "ux designer": 0.7,
    "ui designer": 0.6,
    
    # Data roles
    "data analyst": 0.6,
    "data scientist": 0.8,
    "machine learning engineer": 0.9,
    "business intelligence analyst": 0.6,
    
    # Management roles
    "team lead": 0.7,
    "manager": 0.8,
    "senior manager": 0.9,
    "director": 0.9,
    "vp": 0.9,
    "chief": 0.9,
    "cto": 0.9,
    "ceo": 0.9,
    "assistant manager": 0.7,
    "people manager": 0.8,
    "resource manager": 0.8,
    "operations manager": 0.8,
    "administrative manager": 0.7,
    "team manager": 0.8,
    "personnel coordinator": 0.7,
    "staff supervisor": 0.7,
    "group leader": 0.7,
    "department head": 0.9,
    "executive assistant manager": 0.8,
    
    # Project management
    "project coordinator": 0.5,
    "project manager": 0.7,
    "program manager": 0.8,
    "product owner": 0.7,
    "scrum master": 0.6,
    "product manager": 0.8,
    
    # Finance roles
    "financial analyst": 0.7,
    "accountant": 0.6,
    "senior accountant": 0.7,
    "controller": 0.8,
    "cfo": 0.9,
    "investment analyst": 0.8,
    "portfolio manager": 0.9,
    
    # Marketing roles
    "marketing coordinator": 0.5,
    "marketing specialist": 0.6,
    "marketing manager": 0.7,
    "brand manager": 0.8,
    "cmo": 0.9,
    
    # Sales roles
    "sales representative": 0.6,
    "account executive": 0.7,
    "sales manager": 0.8,
    "business development manager": 0.8,
    
    # HR roles
    "hr coordinator": 0.5,
    "hr specialist": 0.6,
    "hr manager": 0.7,
    "hr director": 0.9,
    
    # Creative roles
    "graphic designer": 0.6,
    "art director": 0.8,
    "creative director": 0.9,
    "content creator": 0.6,
    "copywriter": 0.6,
    
    # Additional executive roles
    "director of operations": 0.85,
    "assistant director": 0.7,
    "managing director": 0.9,
    "vice provost": 0.9,
    "provost": 0.9,
    "chancellor": 1.0,
    "president": 1.0,
    "vice president": 0.9,
    "assistant CEO": 0.8,
    "chief operating officer": 0.9,
    
    # Default for unknown roles
    "default": 0.5
}

# --- Project Status Weights ---
PROJECT_STATUS_WEIGHT = {
    "planning": 0.4,
    "in progress": 0.8,
    "active": 0.8,
    "on hold": 0.3,
    "completed": 0.1,
    "cancelled": 0.0,
    "default": 0.5
}

# --- Project Priority Weights ---
PROJECT_PRIORITY_WEIGHT = {
    "low": 0.3,
    "medium": 0.6,
    "high": 0.9,
    "critical": 1.0,
    "default": 0.5
}

# --- MongoDB Connection ---
client = None
db = None
model = None

def connect_db():
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
            logging.info(f"Ensured index on 'email' in {OUTPUT_COLLECTION}")
    except ConnectionFailure as e:
        logging.error(f"MongoDB connection failed: {e}")
        client = None
        db = None
    except Exception as e:
        logging.error(f"An error occurred during DB connection: {e}")
        client = None
        db = None

def load_model():
    global model
    try:
        logging.info("Loading sentence transformer model...")
        start_time = time.time()
        # Use a lightweight model for efficiency
        model = SentenceTransformer('all-MiniLM-L6-v2')
        logging.info(f"Model loaded in {time.time() - start_time:.2f} seconds")
        
        # Pre-compute embeddings for benchmark tasks
        logging.info("Pre-computing benchmark task embeddings...")
        benchmark_embeddings()
    except Exception as e:
        logging.error(f"Error loading model: {e}")
        model = None

# --- Embedding and Similarity ---
benchmark_descriptions = [task["task_description"] for task in BENCHMARK_TASKS]
benchmark_scores = [task["intensity_score"] for task in BENCHMARK_TASKS]
benchmark_embeddings_cache = None

def benchmark_embeddings():
    """Pre-compute and cache benchmark task embeddings"""
    global benchmark_embeddings_cache
    if model is not None and benchmark_embeddings_cache is None:
        benchmark_embeddings_cache = model.encode(benchmark_descriptions, convert_to_numpy=True)
        logging.info(f"Cached embeddings for {len(benchmark_descriptions)} benchmark tasks")

def preprocess_text(text: str) -> str:
    """Clean and standardize text for better embedding results"""
    if not text:
        return ""
    # Simple preprocessing: lowercase and strip extra whitespace
    return text.lower().strip()

def find_best_match(query: str, candidates: List[str]) -> Tuple[str, float]:
    """
    Find the best matching string from candidates based on semantic similarity
    Returns the best match and similarity score
    """
    if not query or not candidates or model is None:
        return "", 0.0
    
    query_embedding = model.encode([query], convert_to_numpy=True)
    candidate_embeddings = model.encode(candidates, convert_to_numpy=True)
    
    similarities = cosine_similarity(query_embedding, candidate_embeddings)[0]
    best_idx = np.argmax(similarities)
    
    return candidates[best_idx], float(similarities[best_idx])

def get_tool_complexity_score(tools_list: List[str]) -> Dict[str, Any]:
    """
    Calculate complexity score for a list of tools
    Returns a dict with overall score and details
    """
    # Handle empty or None input
    if not tools_list:
        return {
            "overall_score": 0.0,
            "tool_details": [],
            "avg_complexity": 0.0,
            "max_complexity": 0.0,
            "tool_count": 0
        }
    
    # Handle case where tools_proficient is a string (common in the data model)
    if isinstance(tools_list, str):
        # Convert comma-separated string to list
        tools_list = [tool.strip() for tool in tools_list.split(",") if tool.strip()]
    
    # If tools_list is still not a list or is empty after conversion
    if not isinstance(tools_list, list) or not tools_list:
        logging.warning(f"Invalid tools format after conversion: {type(tools_list)}")
        return {
            "overall_score": 0.0,
            "tool_details": [],
            "avg_complexity": 0.0,
            "max_complexity": 0.0,
            "tool_count": 0
        }
    
    tool_details = []
    total_complexity = 0.0
    max_complexity = 0.0
    
    for tool in tools_list:
        if not tool:  # Skip empty strings
            continue
            
        normalized_tool = preprocess_text(tool)
        # Try exact match first
        complexity = TOOL_COMPLEXITY.get(normalized_tool)
        
        # If no exact match, try fuzzy matching using the model
        if complexity is None and model is not None:
            best_match, best_score = find_best_match(normalized_tool, list(TOOL_COMPLEXITY.keys()))
            # Only use match if similarity is high enough
            if best_score > 0.8:
                complexity = TOOL_COMPLEXITY.get(best_match)
                logging.debug(f"Fuzzy matched '{normalized_tool}' to '{best_match}' with score {best_score}")
        
        # Use default if still no match
        if complexity is None:
            complexity = TOOL_COMPLEXITY["default"]
        
        tool_details.append({
            "tool": tool,
            "complexity": complexity
        })
        
        total_complexity += complexity
        max_complexity = max(max_complexity, complexity)
    
    # Protect against division by zero
    if len(tool_details) == 0:
        return {
            "overall_score": 0.0,
            "tool_details": [],
            "avg_complexity": 0.0,
            "max_complexity": 0.0,
            "tool_count": 0
        }
    
    avg_complexity = total_complexity / len(tool_details)
    
    # Calculate overall score, giving more weight to max complexity than average
    overall_score = (0.7 * max_complexity) + (0.3 * avg_complexity)
    
    return {
        "overall_score": overall_score,
        "tool_details": tool_details,
        "avg_complexity": avg_complexity,
        "max_complexity": max_complexity,
        "tool_count": len(tool_details)
    }

def get_role_complexity(job_title: str, role: str) -> Dict[str, Any]:
    """
    Calculate role complexity based on job title and role
    Returns a dict with complexity score and matched role
    """
    # Default values
    complexity = 0.5
    matched_role = "default"
    
    # Normalize input
    normalized_title = preprocess_text(job_title) if job_title else ""
    normalized_role = preprocess_text(role) if role else ""
    
    # Check job title first (direct match)
    if normalized_title and normalized_title in ROLE_COMPLEXITY:
        complexity = ROLE_COMPLEXITY[normalized_title]
        matched_role = normalized_title
    # Then check role (direct match)
    elif normalized_role and normalized_role in ROLE_COMPLEXITY:
        complexity = ROLE_COMPLEXITY[normalized_role]
        matched_role = normalized_role
    # Try fuzzy matching if no direct match
    elif model is not None:
        role_keys = list(ROLE_COMPLEXITY.keys())
        if normalized_title:
            best_match, best_score = find_best_match(normalized_title, role_keys)
            if best_score > 0.8:
                complexity = ROLE_COMPLEXITY[best_match]
                matched_role = best_match
        elif normalized_role:
            best_match, best_score = find_best_match(normalized_role, role_keys)
            if best_score > 0.8:
                complexity = ROLE_COMPLEXITY[best_match]
                matched_role = best_match
    
    return {
        "complexity": complexity,
        "matched_role": matched_role,
        "input_job_title": job_title,
        "input_role": role
    }

def calculate_project_load(projects: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate project load based on projects array with an improved mathematical model
    Considers project count, status, priority, deadline proximity, and role responsibility
    Uses logarithmic scaling for project count to prevent runaway scores
    Includes pressure_handling score based on deadline management and project complexity
    """
    if not projects:
        return {
            "project_count": 0,
            "active_project_count": 0,
            "average_priority": 0.0,
            "time_pressure_score": 0.0,
            "overlap_score": 0.0,
            "overall_load_score": 0.0,
            "pressure_handling_score": 0.0,
            "project_details": []
        }
    
    active_count = 0
    total_priority = 0.0
    project_details = []
    now = datetime.now()
    
    # Time pressure variables
    time_pressure_scores = []
    
    # Pressure handling variables
    critical_projects = 0
    high_priority_projects = 0
    medium_priority_projects = 0
    low_priority_projects = 0
    tight_deadline_projects = 0  # Projects due within 14 days
    complex_task_projects = 0    # Projects with high complexity tasks
    
    # Proximity importance - projects due within these days get higher weights
    critical_proximity = 7   # Within a week (highest pressure)
    high_proximity = 14      # Within two weeks
    medium_proximity = 30    # Within a month
    
    # Role importance factors - certain roles have more responsibility
    role_importance_factors = {
        "lead": 1.3,
        "manager": 1.4,
        "owner": 1.3,
        "architect": 1.3,
        "primary": 1.2,
        "coordinator": 1.2,
        "director": 1.5,
        "responsible": 1.2,
        "key": 1.2,
        "critical": 1.3,
        "default": 1.0
    }
    
    # Track project overlap for time periods
    timeline_segments = {}  # Maps time periods to active project count
    
    # Process each project
    for project in projects:
        # Extract basic project info
        project_id = project.get("project_id", "unknown")
        project_title = project.get("project_title", "Untitled Project")
        status = preprocess_text(project.get("project_status", ""))
        priority = preprocess_text(project.get("project_priority", ""))
        
        # Extract user's role in the project
        user_contribution = project.get("user_contribution", {})
        role_in_project = preprocess_text(user_contribution.get("role_in_project", ""))
        
        # Track project hours (explicitly mentioned or estimated)
        hours_per_week = user_contribution.get("hours_per_week", 0)
        if hours_per_week == 0:
            # Estimate based on role and priority if not specified
            if "lead" in role_in_project or "manager" in role_in_project:
                hours_per_week = 8  # Default for leadership roles
            elif "critical" in priority or "high" in priority:
                hours_per_week = 6  # Default for high priority projects
            else:
                hours_per_week = 4  # Default for standard projects
        
        # Determine role importance factor
        role_factor = role_importance_factors["default"]
        for role_key, factor in role_importance_factors.items():
            if role_key in role_in_project:
                role_factor = factor
                break
        
        # Get status weight (default 0.5 if not found)
        status_weight = PROJECT_STATUS_WEIGHT.get(status, PROJECT_STATUS_WEIGHT["default"])
        
        # Get priority weight (default 0.5 if not found)
        priority_weight = PROJECT_PRIORITY_WEIGHT.get(priority, PROJECT_PRIORITY_WEIGHT["default"])
        
        # Count active projects with adjusted definition of "active"
        if status_weight >= 0.5:  # Consider as active if status weight is significant
            active_count += 1
        
        # Add to total priority
        total_priority += priority_weight
        
        # Track projects by priority for pressure handling calculation
        if "critical" in priority:
            critical_projects += 1
        elif "high" in priority:
            high_priority_projects += 1
        elif "medium" in priority:
            medium_priority_projects += 1
        else:
            low_priority_projects += 1
        
        # Process dates for time pressure analysis
        start_date_str = project.get("project_start_date")
        end_date_str = project.get("project_end_date")
        start_date = None
        end_date = None
        
        # Parse dates if available
        try:
            if start_date_str:
                if isinstance(start_date_str, str):
                    start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                elif isinstance(start_date_str, datetime):
                    start_date = start_date_str
            if end_date_str:
                if isinstance(end_date_str, str):
                    end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                elif isinstance(end_date_str, datetime):
                    end_date = end_date_str
        except (ValueError, TypeError) as e:
            logging.debug(f"Error parsing dates for project {project_id}: {e}")
        
        # Calculate days remaining if end date exists
        days_remaining = None
        if end_date and end_date > now:
            days_remaining = (end_date - now).days
        
        # Calculate time pressure with exponential decay as deadline approaches
        time_pressure = 0.0
        if days_remaining is not None:
            if days_remaining <= 0:
                # Overdue projects get maximum pressure
                time_pressure = 1.0
            elif days_remaining <= critical_proximity:
                # Critical proximity: 7 days or less (exponential increase)
                time_pressure = 0.7 + (0.3 * (1 - (days_remaining / critical_proximity)))
            elif days_remaining <= high_proximity:
                # High proximity: 14 days or less
                time_pressure = 0.5 + (0.2 * (1 - ((days_remaining - critical_proximity) / (high_proximity - critical_proximity))))
                tight_deadline_projects += 1  # Track tight deadline projects
            elif days_remaining <= medium_proximity:
                # Medium proximity: 30 days or less
                time_pressure = 0.3 + (0.2 * (1 - ((days_remaining - high_proximity) / (medium_proximity - high_proximity))))
            else:
                # Low proximity: more than 30 days
                time_pressure = 0.3 * np.exp(-0.02 * (days_remaining - medium_proximity))
        
        # Adjust time pressure by priority and status
        adjusted_time_pressure = time_pressure * priority_weight * status_weight * role_factor
        
        if adjusted_time_pressure > 0:
            time_pressure_scores.append(adjusted_time_pressure)
        
        # Track project timeline for overlap analysis
        if start_date and end_date and status_weight >= 0.5:
            current_date = start_date
            while current_date <= end_date:
                week_key = current_date.strftime("%Y-%W")  # Year and week number
                if week_key in timeline_segments:
                    timeline_segments[week_key] += 1
                else:
                    timeline_segments[week_key] = 1
                
                # Move to next week
                current_date += timedelta(days=7)
        
        # Build project detail record
        project_detail = {
            "project_id": project_id,
            "project_title": project_title,
            "status": status,
            "status_weight": status_weight,
            "priority": priority,
            "priority_weight": priority_weight,
            "role": role_in_project,
            "role_factor": role_factor
        }
        
        if days_remaining is not None:
            project_detail["days_remaining"] = days_remaining
            project_detail["time_pressure"] = time_pressure
            project_detail["adjusted_time_pressure"] = adjusted_time_pressure
        
        project_details.append(project_detail)
    
    # Calculate average priority
    avg_priority = total_priority / len(projects) if projects else 0.0
    
    # Calculate time pressure score using combination of max and average
    # This puts more weight on high-pressure projects but considers all projects
    max_time_pressure = max(time_pressure_scores) if time_pressure_scores else 0.0
    avg_time_pressure = sum(time_pressure_scores) / len(time_pressure_scores) if time_pressure_scores else 0.0
    time_pressure_score = (0.7 * max_time_pressure) + (0.3 * avg_time_pressure)
    
    # Calculate overlap score using the maximum concurrent projects and logarithmic scaling
    max_concurrent = max(timeline_segments.values()) if timeline_segments else 0
    # Logarithmic scaling prevents extreme values for many concurrent projects
    # Formula: min(1.0, 0.3*ln(x+1)+0.4) where x is max_concurrent
    overlap_score = min(1.0, 0.3 * np.log(max_concurrent + 1) + 0.4) if max_concurrent > 1 else 0.0
    
    # Calculate project count factor with logarithmic scaling
    # Formula: min(1.0, 0.3*ln(x+1)+0.2) where x is active_count
    project_count_factor = min(1.0, 0.3 * np.log(active_count + 1) + 0.2)
    
    # Calculate overall load score with weighted components
    # 30% time pressure, 25% project count, 25% overlap, 20% average priority
    overall_load_score = (0.30 * time_pressure_score) + (0.25 * project_count_factor) + \
                         (0.25 * overlap_score) + (0.20 * avg_priority)
    
    # Ensure overall score is between 0 and 1
    overall_load_score = max(0.0, min(1.0, overall_load_score))
    
    # Return comprehensive analysis
    return {
        "project_count": len(projects),
        "active_project_count": active_count,
        "average_priority": avg_priority,
        "time_pressure_score": time_pressure_score,
        "project_count_factor": project_count_factor,
        "overlap_score": overlap_score,
        "max_concurrent_projects": max_concurrent,
        "overall_load_score": overall_load_score,
        "project_details": project_details
    }

def calculate_responsibility_breadth(projects: List[Dict[str, Any]], role: str, job_title: str) -> Dict[str, Any]:
    """
    Calculate responsibility breadth based on role, job title, and project roles
    Enhanced to detect role overlaps and compare against seniority expectations
    Returns detailed analysis of responsibility distribution and overlaps
    """
    normalized_role = preprocess_text(role) if role else ""
    normalized_title = preprocess_text(job_title) if job_title else ""
    
    # Check for management indicators in role/title
    management_keywords = ["manager", "director", "lead", "chief", "head", "vp", "president", "officer", "supervisor"]
    is_management_role = any(keyword in normalized_role or keyword in normalized_title for keyword in management_keywords)
    
    # Determine expected seniority level
    seniority_keywords = {
        "junior": 0.3,
        "associate": 0.4,
        "entry": 0.3,
        "mid": 0.5,
        "intermediate": 0.5,
        "senior": 0.7,
        "staff": 0.7,
        "principal": 0.9,
        "lead": 0.8,
        "head": 0.9,
        "chief": 1.0,
        "vp": 0.9,
        "executive": 0.9,
        "director": 0.9,
        "manager": 0.8,
        "supervisor": 0.7
    }
    
    # Extract seniority level from job title
    seniority_level = 0.5  # Default mid-level
    for keyword, level in seniority_keywords.items():
        if keyword in normalized_title:
            seniority_level = level
            break
    
    # Get expected responsibilities based on seniority
    expected_responsibility_distribution = {}
    if seniority_level <= 0.4:  # Junior
        expected_responsibility_distribution = {
            "execution": 0.8,
            "technical_leadership": 0.1,
            "mentoring": 0.0,
            "management": 0.1
        }
    elif seniority_level <= 0.6:  # Mid-level
        expected_responsibility_distribution = {
            "execution": 0.6,
            "technical_leadership": 0.2,
            "mentoring": 0.1,
            "management": 0.1
        }
    elif seniority_level <= 0.8:  # Senior
        expected_responsibility_distribution = {
            "execution": 0.4,
            "technical_leadership": 0.3,
            "mentoring": 0.2,
            "management": 0.1
        }
    else:  # Lead/Principal/Management
        expected_responsibility_distribution = {
            "execution": 0.2,
            "technical_leadership": 0.3,
            "mentoring": 0.2,
            "management": 0.3
        }
    
    # Initialize counters for different responsibility types
    management_count = 0
    mentoring_count = 0
    technical_lead_count = 0
    execution_count = 0
    
    # Dictionary to track role overlaps
    role_types = set()
    domain_overlaps = {}
    responsibility_overlaps = []
    
    # Count project roles by type
    if projects:
        for project in projects:
            user_contribution = project.get("user_contribution", {})
            role_in_project = preprocess_text(user_contribution.get("role_in_project", ""))
            
            # Count role by type
            role_classified = False
            
            # Check for management roles
            if any(keyword in role_in_project for keyword in ["manager", "director", "lead", "chief", "head"]):
                management_count += 1
                role_types.add("management")
                role_classified = True
            
            # Check for mentoring roles
            if any(keyword in role_in_project for keyword in ["mentor", "coach", "train", "supervise"]):
                mentoring_count += 1
                role_types.add("mentoring")
                role_classified = True
            
            # Check for technical leadership
            if any(keyword in role_in_project for keyword in ["architect", "principal", "senior", "tech lead", "expert", "specialist"]):
                technical_lead_count += 1
                role_types.add("technical_leadership")
                role_classified = True
            
            # Otherwise count as execution
            if not role_classified:
                execution_count += 1
                role_types.add("execution")
            
            # Track domain overlaps
            project_domain = project.get("project_domain", "")
            tech_stack = project.get("tech_stack", [])
            
            if project_domain:
                if project_domain in domain_overlaps:
                    domain_overlaps[project_domain] += 1
                else:
                    domain_overlaps[project_domain] = 1
            
            if isinstance(tech_stack, list):
                for tech in tech_stack:
                    if tech in domain_overlaps:
                        domain_overlaps[tech] += 1
                    else:
                        domain_overlaps[tech] = 1
    
    # Calculate percentages
    total_roles = max(1, management_count + mentoring_count + technical_lead_count + execution_count)
    management_pct = management_count / total_roles
    mentoring_pct = mentoring_count / total_roles
    technical_lead_pct = technical_lead_count / total_roles
    execution_pct = execution_count / total_roles
    
    # Detect significant role overlaps
    actual_role_distribution = {
        "management": management_pct,
        "mentoring": mentoring_pct,
        "technical_leadership": technical_lead_pct,
        "execution": execution_pct
    }
    
    # Check for overlapping responsibilities (performing multiple roles)
    if len(role_types) > 2:  # More than 2 different types of roles
        responsibility_overlaps.append("Multiple role types (management, technical, execution)")
    
    # Check for domain overlaps (working across multiple domains)
    multiple_domain_count = sum(1 for count in domain_overlaps.values() if count > 1)
    if multiple_domain_count > 1:
        responsibility_overlaps.append(f"Working across {multiple_domain_count} overlapping domains")
    
    # Compare against expected distribution based on seniority
    distribution_gaps = {}
    for role_type, expected_pct in expected_responsibility_distribution.items():
        actual_pct = actual_role_distribution.get(role_type, 0.0)
        gap = actual_pct - expected_pct
        distribution_gaps[role_type] = gap
        
        # Flag significant deviations
        if gap > 0.2:
            responsibility_overlaps.append(f"Overloaded with {role_type} responsibilities (+{gap:.2f})")
    
    # Calculate overutilization due to role mismatch
    role_mismatch_score = 0.0
    positive_gaps = [gap for gap in distribution_gaps.values() if gap > 0]
    if positive_gaps:
        role_mismatch_score = sum(positive_gaps) / len(positive_gaps)
    
    # Calculate breadth score
    # Higher weights for management and mentoring roles
    breadth_score = (management_pct * 1.0) + (mentoring_pct * 0.8) + (technical_lead_pct * 0.6) + (execution_pct * 0.3)
    
    # Adjust score based on formal role
    if is_management_role:
        breadth_score = max(breadth_score, 0.7)  # Ensure minimum breadth for management roles
    
    # Look for multiple technical domains in projects
    unique_domains = set()
    for project in projects if projects else []:
        tech_stack = project.get("tech_stack", [])
        if isinstance(tech_stack, list):
            unique_domains.update(tech_stack)
    
    # Adjust breadth score based on technical domain variety
    domain_variety_score = min(1.0, len(unique_domains) / 5.0)  # Normalize to max of 1.0
    breadth_score = (breadth_score * 0.7) + (domain_variety_score * 0.3)
    
    # Expected score based on role complexity
    role_complexity_info = get_role_complexity(job_title, role)
    expected_breadth = role_complexity_info["complexity"]
    
    # Calculate gap between actual and expected
    breadth_gap = breadth_score - expected_breadth
    
    # Calculate overlap factor (higher when doing many different roles)
    overlap_factor = min(1.0, len(role_types) / 3.0)
    
    # Determine if employee is overutilized due to role overlaps
    is_overutilized = len(responsibility_overlaps) >= 2 or role_mismatch_score > 0.3 or breadth_gap > 0.2
    
    return {
        "breadth_score": breadth_score,
        "expected_breadth": expected_breadth,
        "breadth_gap": breadth_gap,
        "is_management_role": is_management_role,
        "seniority_level": seniority_level,
        "role_distribution": {
            "management": management_pct,
            "mentoring": mentoring_pct,
            "technical_leadership": technical_lead_pct,
            "execution": execution_pct
        },
        "expected_distribution": expected_responsibility_distribution,
        "distribution_gaps": distribution_gaps,
        "domain_variety": {
            "unique_domains": len(unique_domains),
            "domains": list(unique_domains) if len(unique_domains) <= 10 else list(unique_domains)[:10]
        },
        "role_overlaps": {
            "overlap_count": len(role_types),
            "overlap_factor": overlap_factor,
            "role_types": list(role_types),
            "domain_overlaps": {k: v for k, v in domain_overlaps.items() if v > 1},
            "responsibility_overlaps": responsibility_overlaps,
            "is_overutilized": is_overutilized,
            "role_mismatch_score": role_mismatch_score
        }
    }

def calculate_utilization_score(
    tools_analysis: Dict[str, Any],
    role_analysis: Dict[str, Any],
    project_analysis: Dict[str, Any],
    responsibility_analysis: Dict[str, Any],
    job_intensity_analysis: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Calculate overall utilization score based on all dimensions with improved mathematical model
    Now incorporates pressure_handling score and enhanced role overlap detection
    Returns detailed utilization assessment with multiple dimensional scores
    """
    # Extract key scores from each dimension
    tool_complexity = tools_analysis.get("overall_score", 0.5)
    role_complexity = role_analysis.get("complexity", 0.5)
    project_load = project_analysis.get("overall_load_score", 0.5)
    pressure_handling = project_analysis.get("pressure_handling_score", 0.5)
    breadth_score = responsibility_analysis.get("breadth_score", 0.5)
    breadth_gap = responsibility_analysis.get("breadth_gap", 0.0)
    
    # Get role overlap information
    role_overlaps = responsibility_analysis.get("role_overlaps", {})
    is_overutilized_by_roles = role_overlaps.get("is_overutilized", False)
    overlap_factor = role_overlaps.get("overlap_factor", 0.0)
    role_mismatch_score = role_overlaps.get("role_mismatch_score", 0.0)
    
    # Include job intensity if available
    job_intensity = 0.0
    workload_factor = 1.0  # Default factor (neutral) if no job intensity data
    
    if job_intensity_analysis:
        # Use adjusted intensity if available, otherwise use weighted intensity
        if "adjusted_intensity" in job_intensity_analysis:
            job_intensity = job_intensity_analysis.get("adjusted_intensity", 0.0)
        else:
            job_intensity = job_intensity_analysis.get("weighted_intensity", 0.0)
        
        # Get workload factor which accounts for total hours worked
        workload_factor = job_intensity_analysis.get("workload_factor", 1.0)
    
    # Calculate raw utilization score with pressure handling component
    # Formula: (0.15 * tool complexity) + (0.2 * project load) + (0.1 * pressure handling) + 
    #          (0.2 * breadth score) + (0.15 * role complexity) + (0.2 * job intensity)
    raw_utilization = (0.15 * tool_complexity) + \
                      (0.2 * project_load) + \
                      (0.1 * pressure_handling) + \
                      (0.2 * breadth_score) + \
                      (0.15 * role_complexity)
    
    # Add job intensity component if available
    if job_intensity_analysis:
        raw_utilization += (0.2 * job_intensity)
    else:
        # Redistribute weights if no job intensity
        raw_utilization = (0.15 * tool_complexity) + \
                          (0.25 * project_load) + \
                          (0.1 * pressure_handling) + \
                          (0.3 * breadth_score) + \
                          (0.2 * role_complexity)
    
    # Apply workload factor to the raw score
    # This accounts for total hours worked (part-time vs full-time vs overtime)
    workload_adjusted_utilization = raw_utilization * workload_factor
    
    # Role overlap adjustment
    # If employee has significant role overlaps, increase utilization score
    role_overlap_adjustment = 0.0
    if is_overutilized_by_roles:
        role_overlap_adjustment = overlap_factor * role_mismatch_score * 0.3
    
    # Adjust for breadth gap
    # Positive gap means doing more than expected for role
    breadth_adjustment = breadth_gap * 0.2
    
    # Calculate final adjusted score
    adjusted_utilization = workload_adjusted_utilization + role_overlap_adjustment + breadth_adjustment
    
    # Ensure score is between 0-1
    final_utilization = max(0.0, min(1.0, adjusted_utilization))
    
    # Determine utilization status with more detailed categories
    if final_utilization < 0.3:
        status = "severely_underutilized"
    elif final_utilization < 0.45:
        status = "underutilized"
    elif final_utilization < 0.75:
        status = "optimal"
    elif final_utilization < 0.9:
        status = "highly_utilized"
    else:
        status = "overutilized"
    
    # Override status if clearly overutilized by role overlaps
    if is_overutilized_by_roles and role_overlaps.get("responsibility_overlaps", []):
        if final_utilization >= 0.7:  # Already somewhat high
            status = "overutilized"
        else:  # Otherwise mark as highly utilized
            status = "highly_utilized"
    
    # Calculate confidence score based on data completeness
    confidence_factors = []
    
    # Tool data confidence
    if tools_analysis.get("tool_count", 0) > 2:
        confidence_factors.append(1.0)
    elif tools_analysis.get("tool_count", 0) > 0:
        confidence_factors.append(0.7)
    else:
        confidence_factors.append(0.3)  # Low confidence if no tools data
    
    # Role data confidence
    if role_analysis.get("matched_role") != "default":
        confidence_factors.append(1.0)
    else:
        confidence_factors.append(0.5)  # Medium confidence if role not matched
    
    # Project data confidence
    if project_analysis.get("project_count", 0) > 2:
        confidence_factors.append(1.0)
    elif project_analysis.get("project_count", 0) > 0:
        confidence_factors.append(0.7)
    else:
        confidence_factors.append(0.4)  # Low-medium confidence if no projects
    
    # Job duties confidence
    if job_intensity_analysis and job_intensity_analysis.get("total_hours", 0) >= 35:
        confidence_factors.append(1.0)  # High confidence with nearly full workweek
    elif job_intensity_analysis and job_intensity_analysis.get("total_hours", 0) > 0:
        # Scale confidence based on hours reported (more hours = more confidence)
        hours_confidence = min(1.0, job_intensity_analysis.get("total_hours", 0) / 40)
        confidence_factors.append(0.5 + (0.5 * hours_confidence))
    elif job_intensity_analysis:
        confidence_factors.append(0.5)  # Medium confidence if job intensity exists but no hours
    else:
        confidence_factors.append(0.3)  # Low confidence if no job intensity data
    
    confidence_score = sum(confidence_factors) / len(confidence_factors)
    
    # Calculate dimensional breakdown for explaining utilization
    dimensional_factors = {
        "tool_complexity": tool_complexity,
        "project_load": project_load,
        "pressure_handling": pressure_handling, 
        "responsibility_breadth": breadth_score,
        "role_complexity": role_complexity
    }
    
    if job_intensity_analysis:
        dimensional_factors["job_intensity"] = job_intensity
    
    return {
        "utilization_score": final_utilization,
        "utilization_status": status,
        "confidence_score": confidence_score,
        "raw_score": raw_utilization,
        "workload_factor": workload_factor,
        "workload_adjusted_score": workload_adjusted_utilization,
        "breadth_adjustment": breadth_adjustment,
        "role_overlap_adjustment": role_overlap_adjustment,
        "dimensional_breakdown": dimensional_factors,
        "role_overlap_analysis": {
            "is_overutilized_by_roles": is_overutilized_by_roles,
            "overlap_factor": overlap_factor,
            "role_mismatch_score": role_mismatch_score,
            "responsibility_overlaps": role_overlaps.get("responsibility_overlaps", [])
        },
        "includes_job_intensity": job_intensity_analysis is not None
    }

def get_task_intensity(duty_description: str) -> Dict[str, Any]:
    """
    Calculate intensity score for a given duty description with improved accuracy
    Handles compound tasks (e.g., "calls and emails") by splitting and analyzing separately
    Returns a dict with original task, matched tasks, similarity scores, and intensity score
    """
    if model is None or benchmark_embeddings_cache is None:
        logging.error("Model or benchmark embeddings not available")
        return {
            "original_task": duty_description,
            "matched_task": "unknown",
            "similarity": 0.0,
            "intensity_score": 0.5  # Default score
        }
    
    # Preprocess the duty description
    processed_description = preprocess_text(duty_description)
    if not processed_description:
        return {
            "original_task": duty_description,
            "matched_task": "empty description",
            "similarity": 0.0,
            "intensity_score": 0.1  # Minimal score for empty descriptions
        }
    
    # Check if this is a compound task by looking for conjunctions and separators
    conjunctions = [" and ", " & ", ", ", "; "]
    is_compound = any(conj in processed_description for conj in conjunctions)
    
    # If it's not compound, process normally
    if not is_compound:
        duty_embedding = model.encode([processed_description], convert_to_numpy=True)
        similarities = cosine_similarity(duty_embedding, benchmark_embeddings_cache)[0]
        max_sim_idx = np.argmax(similarities)
        max_similarity = similarities[max_sim_idx]
        matched_task = benchmark_descriptions[max_sim_idx]
        intensity_score = benchmark_scores[max_sim_idx]
        
        # Only accept match if similarity is above threshold
        if max_similarity < 0.6:
            # If similarity is too low, try to match individual words
            word_matches = []
            for word in processed_description.split():
                if len(word) > 3:  # Only consider meaningful words
                    word_embedding = model.encode([word], convert_to_numpy=True)
                    word_similarities = cosine_similarity(word_embedding, benchmark_embeddings_cache)[0]
                    word_max_idx = np.argmax(word_similarities)
                    if word_similarities[word_max_idx] > 0.7:
                        word_matches.append({
                            "word": word,
                            "matched_task": benchmark_descriptions[word_max_idx],
                            "similarity": float(word_similarities[word_max_idx]),
                            "intensity_score": benchmark_scores[word_max_idx]
                        })
            
            # If we found word matches, use their average
            if word_matches:
                avg_intensity = sum(match["intensity_score"] for match in word_matches) / len(word_matches)
                return {
                    "original_task": duty_description,
                    "matched_task": matched_task,
                    "similarity": max_similarity,
                    "intensity_score": avg_intensity,
                    "word_matches": word_matches,
                    "analysis_method": "word_matching"
                }
        
        return {
            "original_task": duty_description,
            "matched_task": matched_task,
            "similarity": float(max_similarity),
            "intensity_score": intensity_score,
            "analysis_method": "direct_match"
        }
    
    # For compound tasks, split and analyze each component
    else:
        sub_tasks = []
        
        # Try different splitting strategies
        for conj in conjunctions:
            if conj in processed_description:
                sub_task_descriptions = processed_description.split(conj)
                # Process each sub-task
                for sub_desc in sub_task_descriptions:
                    if sub_desc.strip():  # Skip empty strings
                        sub_task_result = get_task_intensity(sub_desc.strip())
                        sub_tasks.append(sub_task_result)
                
                # If we found sub-tasks, calculate weighted average of intensity scores
                # Weight by similarity score to prioritize more confident matches
                if sub_tasks:
                    weights = [st["similarity"] for st in sub_tasks]
                    total_weight = sum(weights)
                    
                    # Protect against division by zero
                    if total_weight > 0:
                        weighted_intensity = sum(st["intensity_score"] * st["similarity"] for st in sub_tasks) / total_weight
                    else:
                        weighted_intensity = sum(st["intensity_score"] for st in sub_tasks) / len(sub_tasks)
                    
                    # Ensure we're using the highest intensity when appropriate
                    # For tasks that include high-intensity components
                    max_intensity = max(st["intensity_score"] for st in sub_tasks)
                    if max_intensity > 0.7:
                        # Bias toward the higher intensity tasks
                        weighted_intensity = (weighted_intensity + max_intensity) / 2
                    
                    return {
                        "original_task": duty_description,
                        "compound_task": True,
                        "sub_tasks": sub_tasks,
                        "intensity_score": weighted_intensity,
                        "analysis_method": "compound_task_analysis"
                    }
                
                # If we split but didn't find valid sub-tasks, break and fall back to normal analysis
                break
        
        # Fallback: analyze as a single task if splitting didn't work well
        duty_embedding = model.encode([processed_description], convert_to_numpy=True)
        similarities = cosine_similarity(duty_embedding, benchmark_embeddings_cache)[0]
        
        # Get top 3 matches instead of just the best one
        top_indices = similarities.argsort()[-3:][::-1]
        top_matches = []
        
        for idx in top_indices:
            top_matches.append({
                "matched_task": benchmark_descriptions[idx],
                "similarity": float(similarities[idx]),
                "intensity_score": benchmark_scores[idx]
            })
        
        # Calculate weighted average of top matches
        weighted_sum = sum(match["intensity_score"] * match["similarity"] for match in top_matches)
        total_similarity = sum(match["similarity"] for match in top_matches)
        
        # Protect against division by zero
        if total_similarity > 0:
            weighted_intensity = weighted_sum / total_similarity
        else:
            weighted_intensity = top_matches[0]["intensity_score"] if top_matches else 0.5
        
        return {
            "original_task": duty_description,
            "top_matches": top_matches,
            "intensity_score": weighted_intensity,
            "analysis_method": "multiple_match_analysis"
        }

def process_job_responsibilities(job_responsibilities: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Process a list of job responsibilities and calculate overall intensity
    Properly weighs duties by their hours and accounts for total weekly workload
    Returns a dict with detailed duty analysis and aggregated intensity metrics
    """
    # Handle empty or None input
    if not job_responsibilities:
        return {
            "overall_intensity": 0.0,
            "duties_analysis": [],
            "weighted_intensity": 0.0,
            "total_hours": 0,
            "workload_factor": 0.0
        }
    
    # Ensure job_responsibilities is a list
    if not isinstance(job_responsibilities, list):
        logging.warning(f"Invalid job_responsibilities format: {type(job_responsibilities)}")
        return {
            "overall_intensity": 0.0,
            "duties_analysis": [],
            "weighted_intensity": 0.0,
            "total_hours": 0,
            "workload_factor": 0.0
        }
    
    duties_analysis = []
    total_hours = 0
    weighted_intensity_sum = 0
    
    # Process each duty
    for duty in job_responsibilities:
        # Ensure duty is a dictionary
        if not isinstance(duty, dict):
            logging.warning(f"Invalid duty format: {type(duty)}")
            continue
            
        # Use jobDuties field if available instead of duty
        duty_description = duty.get("jobDuties", duty.get("duty", ""))
        
        # Try to get hours, with fallback types
        hours = 0
        try:
            hours_value = duty.get("hours", 0)
            if isinstance(hours_value, (int, float)):
                hours = hours_value
            elif isinstance(hours_value, str) and hours_value.strip():
                hours = float(hours_value.strip())
        except (ValueError, TypeError) as e:
            logging.warning(f"Error converting hours to number: {e}")
            hours = 0
        
        # Skip duties with no description
        if not duty_description:
            continue
            
        # If hours is zero but we have a description, assume 1 hour
        # This prevents valid tasks from being excluded just because hours wasn't specified
        if hours <= 0:
            hours = 1
            logging.debug(f"Assigned default 1 hour to duty: {duty_description}")
            
        try:
            intensity_data = get_task_intensity(duty_description)
            intensity_data["hours"] = hours
            duties_analysis.append(intensity_data)
            
            total_hours += hours
            weighted_intensity_sum += intensity_data["intensity_score"] * hours
        except Exception as e:
            logging.error(f"Error processing duty '{duty_description}': {e}")
            continue
    
    # Handle case with no valid duties
    if not duties_analysis:
        return {
            "overall_intensity": 0.0,
            "duties_analysis": [],
            "weighted_intensity": 0.0,
            "total_hours": 0,
            "workload_factor": 0.0
        }
    
    # Calculate weighted average intensity
    weighted_intensity = weighted_intensity_sum / total_hours if total_hours > 0 else 0
    
    # Calculate overall intensity (simple average if needed)
    overall_intensity = sum(d["intensity_score"] for d in duties_analysis) / len(duties_analysis) if duties_analysis else 0
    
    # Calculate workload factor (relative to 40-hour work week)
    # For hours < 40, apply diminishing factor; for hours > 40, apply increasing factor
    standard_work_week = 40
    if total_hours < standard_work_week:
        # Calculate workload factor using sigmoid function to create smooth transition
        # Formula: 2 / (1 + e^(-0.15*(x-20))) where x is total_hours
        # This gives values around:
        # 10hrs → 0.38, 20hrs → 0.5, 30hrs → 0.77, 40hrs → 1.0
        workload_factor = 2 / (1 + np.exp(-0.15 * (total_hours - 20)))
        if workload_factor > 1.0:
            workload_factor = 1.0
    else:
        # For hours > 40, increase factor up to a cap (prevent runaway values)
        # Formula: 1 + log(hours/40) gives a reasonable curve 
        # 40hrs → 1.0, 50hrs → 1.22, 60hrs → 1.4, 80hrs → 1.69
        workload_factor = 1.0 + np.log(total_hours / standard_work_week)
        if workload_factor > 2.0:
            workload_factor = 2.0
    
    # Return comprehensive analysis
    return {
        "overall_intensity": overall_intensity,
        "duties_analysis": duties_analysis,
        "weighted_intensity": weighted_intensity,
        "adjusted_intensity": weighted_intensity * workload_factor,
        "total_hours": total_hours,
        "workload_factor": workload_factor,
        "standard_work_week": standard_work_week
    }

def analyze_employee_utilization(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze employee utilization based on various factors
    Now properly handles jobDuties field and uses improved mathematical models
    Returns comprehensive analysis with scores and details
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
    tools_proficient = doc.get("toolsProficient", [])
    job_title = doc.get("jobTitle", "")
    role = doc.get("role", "")  # This is for permissions only
    projects = doc.get("projects", [])
    
    # Get job duties from either jobDuties or jobResponsibilities
    job_duties = doc.get("jobDuties", [])
    if not job_duties:
        job_duties = doc.get("jobResponsibilities", [])
    
    # Initialize analysis containers
    job_intensity_analysis = None
    tools_analysis = None
    role_analysis = None
    project_analysis = None
    responsibility_analysis = None
    utilization = None
    
    # Track errors
    component_errors = []
    
    # Analyze job responsibilities intensity (if available)
    if job_duties:
        try:
            job_intensity_analysis = process_job_responsibilities(job_duties)
        except Exception as e:
            error_msg = f"Error analyzing job duties: {str(e)}"
            logging.error(f"{error_msg} for {email}")
            component_errors.append(error_msg)
            job_intensity_analysis = {
                "overall_intensity": 0.0,
                "duties_analysis": [],
                "weighted_intensity": 0.0,
                "total_hours": 0,
                "workload_factor": 0.0,
                "error": error_msg
            }
    
    # Analyze tools proficiency
    try:
        tools_analysis = get_tool_complexity_score(tools_proficient)
    except Exception as e:
        error_msg = f"Error analyzing tools: {str(e)}"
        logging.error(f"{error_msg} for {email}")
        component_errors.append(error_msg)
        tools_analysis = {
            "overall_score": 0.0,
            "tool_details": [],
            "avg_complexity": 0.0,
            "max_complexity": 0.0,
            "tool_count": 0,
            "error": error_msg
        }
    
    # Analyze role complexity
    try:
        role_analysis = get_role_complexity(job_title, "")  # Ignore role field as it's for permissions
    except Exception as e:
        error_msg = f"Error analyzing role: {str(e)}"
        logging.error(f"{error_msg} for {email}")
        component_errors.append(error_msg)
        role_analysis = {
            "complexity": 0.5,
            "matched_role": "default",
            "input_job_title": job_title,
            "input_role": "",
            "error": error_msg
        }
    
    # Analyze project load
    try:
        project_analysis = calculate_project_load(projects)
    except Exception as e:
        error_msg = f"Error analyzing project load: {str(e)}"
        logging.error(f"{error_msg} for {email}")
        component_errors.append(error_msg)
        project_analysis = {
            "project_count": 0,
            "active_project_count": 0,
            "average_priority": 0.0,
            "time_pressure_score": 0.0,
            "overlap_score": 0.0,
            "overall_load_score": 0.0,
            "project_details": [],
            "error": error_msg
        }
    
    # Analyze responsibility breadth
    try:
        responsibility_analysis = calculate_responsibility_breadth(projects, "", job_title)  # Ignore role field as it's for permissions
    except Exception as e:
        error_msg = f"Error analyzing responsibility breadth: {str(e)}"
        logging.error(f"{error_msg} for {email}")
        component_errors.append(error_msg)
        responsibility_analysis = {
            "breadth_score": 0.5,
            "expected_breadth": 0.5,
            "breadth_gap": 0.0,
            "is_management_role": False,
            "role_distribution": {
                "management": 0.0,
                "mentoring": 0.0,
                "technical_leadership": 0.0,
                "execution": 1.0
            },
            "error": error_msg
        }
    
    # Calculate overall utilization score
    try:
        utilization = calculate_utilization_score(
            tools_analysis, 
            role_analysis,
            project_analysis,
            responsibility_analysis,
            job_intensity_analysis
        )
    except Exception as e:
        error_msg = f"Error calculating utilization score: {str(e)}"
        logging.error(f"{error_msg} for {email}")
        component_errors.append(error_msg)
        utilization = {
            "utilization_score": 0.5,
            "utilization_status": "unknown",
            "confidence_score": 0.1,
            "raw_score": 0.5,
            "workload_factor": 1.0,
            "workload_adjusted_score": 0.5,
            "breadth_adjustment": 0.0,
            "includes_job_intensity": job_intensity_analysis is not None,
            "error": error_msg
        }
    
    # Combine all analyses
    result = {
        "timestamp": datetime.now().isoformat(),
        "email": email,
        "tool_complexity_analysis": tools_analysis,
        "role_complexity_analysis": role_analysis,
        "project_load_analysis": project_analysis,
        "responsibility_breadth_analysis": responsibility_analysis,
        "utilization_assessment": utilization
    }
    
    # Include job intensity analysis if available
    if job_intensity_analysis:
        result["job_intensity_analysis"] = job_intensity_analysis
    
    # Add any errors encountered
    if component_errors:
        result["errors"] = component_errors
        result["error_count"] = len(component_errors)
    
    return result

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

def process_time_fields(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process time-related fields in the document
    Converts string time expressions to numerical values
    """
    updates = {}
    
    # Process timeWithCompany
    time_with_company = doc.get("timeWithCompany")
    if time_with_company and isinstance(time_with_company, str):
        parsed_time = parse_time_expression(time_with_company)
        updates["timeWithCompanyMonths"] = parsed_time["total_months"]
        updates["timeWithCompanyParsed"] = parsed_time
    
    # Process timeInCurrentRole
    time_in_role = doc.get("timeInCurrentRole")
    if time_in_role and isinstance(time_in_role, str):
        parsed_time = parse_time_expression(time_in_role)
        updates["timeInCurrentRoleMonths"] = parsed_time["total_months"]
        updates["timeInCurrentRoleParsed"] = parsed_time
    
    return updates

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
            "timeInCurrentRole": 1
        }
    )
    
    update_operations = []
    processed_count = 0
    
    for doc in cursor:
        try:
            doc_id = doc["_id"]
            email = doc.get("email", "unknown")
            
            # Process time-related fields
            time_updates = process_time_fields(doc)
            if time_updates:
                update_operations.append(
                    UpdateOne(
                        {"_id": doc_id},
                        {"$set": time_updates},
                        upsert=False
                    )
                )
            
            # Process both job_intensity_analysis and utilizationAssessment in one pass
            job_duties = doc.get("jobDuties", [])
            if not job_duties:
                job_duties = doc.get("jobResponsibilities", [])
            
            # Process job intensity if duties exist
            job_intensity_analysis = None
            if job_duties:
                job_intensity_analysis = process_job_responsibilities(job_duties)
                # Add job intensity analysis to bulk operations
                update_operations.append(
                    UpdateOne(
                        {"_id": doc_id},
                        {"$set": {"job_intensity_analysis": job_intensity_analysis}},
                        upsert=False
                    )
                )
            
            # Process employee utilization
            utilization_analysis = analyze_employee_utilization(doc)
            
            # Add utilization assessment to bulk operations
            update_operations.append(
                UpdateOne(
                    {"_id": doc_id},
                    {"$set": {"utilizationAssessment": utilization_analysis}},
                    upsert=False
                )
            )
            
            # Remove the deprecated jobDescriptionIntensity field if it exists
            update_operations.append(
                UpdateOne(
                    {"_id": doc_id},
                    {"$unset": {"jobDescriptionIntensity": ""}},
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
        result = db[OUTPUT_COLLECTION].bulk_write(operations, ordered=False)
        logging.info(f"Bulk update completed: {result.modified_count} documents modified")
    except Exception as e:
        logging.error(f"Error during bulk update: {e}")

def process_single_document(email: str) -> Optional[Dict[str, Any]]:
    """
    Process a single document by email
    Returns the utilization assessment or None if processing failed
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
                "timeInCurrentRole": 1
            }
        )
        
        if not doc:
            logging.warning(f"Document not found for email: {email}")
            return None
        
        update_operations = []
        
        # Process time-related fields
        time_updates = process_time_fields(doc)
        if time_updates:
            update_operations.append(
                UpdateOne(
                    {"_id": doc["_id"]},
                    {"$set": time_updates},
                    upsert=False
                )
            )
        
        # Process job intensity if duties exist
        job_duties = doc.get("jobDuties", [])
        if not job_duties:
            job_duties = doc.get("jobResponsibilities", [])
            
        job_intensity_analysis = None
        if job_duties:
            job_intensity_analysis = process_job_responsibilities(job_duties)
            # Add job intensity analysis to bulk operations
            update_operations.append(
                UpdateOne(
                    {"_id": doc["_id"]},
                    {"$set": {"job_intensity_analysis": job_intensity_analysis}},
                    upsert=False
                )
            )
            
        # Process employee utilization
        utilization_analysis = analyze_employee_utilization(doc)
        
        # Add utilization assessment to bulk operations
        update_operations.append(
            UpdateOne(
                {"_id": doc["_id"]},
                {"$set": {"utilizationAssessment": utilization_analysis}},
                upsert=False
            )
        )
        
        # Remove the deprecated jobDescriptionIntensity field if it exists
        update_operations.append(
            UpdateOne(
                {"_id": doc["_id"]},
                {"$unset": {"jobDescriptionIntensity": ""}},
                upsert=False
            )
        )
        
        # Perform bulk update
        if update_operations:
            perform_bulk_update(update_operations)
            
        logging.info(f"Processed document for {email}")
        return utilization_analysis
        
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
        # Watch for changes in relevant fields
        pipeline = [
            {"$match": {
                "operationType": {"$in": ["insert", "update"]},
                "$or": [
                    {"fullDocument.toolsProficient": {"$exists": True}},
                    {"fullDocument.jobTitle": {"$exists": True}},
                    {"fullDocument.role": {"$exists": True}},
                    {"fullDocument.projects": {"$exists": True}},
                    {"fullDocument.jobResponsibilities": {"$exists": True}},
                    {"fullDocument.jobDuties": {"$exists": True}},
                    {"fullDocument.salary": {"$exists": True}},
                    {"fullDocument.timeWithCompany": {"$exists": True}},
                    {"fullDocument.timeInCurrentRole": {"$exists": True}},
                    {"updateDescription.updatedFields.toolsProficient": {"$exists": True}},
                    {"updateDescription.updatedFields.jobTitle": {"$exists": True}},
                    {"updateDescription.updatedFields.role": {"$exists": True}},
                    {"updateDescription.updatedFields.projects": {"$exists": True}},
                    {"updateDescription.updatedFields.jobResponsibilities": {"$exists": True}},
                    {"updateDescription.updatedFields.jobDuties": {"$exists": True}},
                    {"updateDescription.updatedFields.salary": {"$exists": True}},
                    {"updateDescription.updatedFields.timeWithCompany": {"$exists": True}},
                    {"updateDescription.updatedFields.timeInCurrentRole": {"$exists": True}}
                ]
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
                        logging.info(f"Processing change for {email}")
                        process_single_document(email)
                except Exception as e:
                    logging.error(f"Error handling change event: {e}")
                    
    except Exception as e:
        logging.error(f"Error setting up change stream: {e}")

# --- Main Execution ---
if __name__ == "__main__":
    logging.info("Starting Employee Utilization Analyzer...")
    connect_db()
    load_model()
    
    # Process all existing documents first
    process_all_documents()
    
    # Then watch for changes
    watch_for_changes() 
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
import os
from dotenv import load_dotenv
import json
from bson import ObjectId
from typing import List, Dict, Any, Optional
from datetime import datetime

# Load environment variables
load_dotenv(".env.local")

# Get MongoDB connection string
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DB_NAME", "org_sim_db")

# Create a MongoDB client
client = MongoClient(MONGODB_URI)
db = client[DB_NAME]

# Create a Motor client for async operations
motor_client = AsyncIOMotorClient(MONGODB_URI)
motor_db = motor_client[DB_NAME]

# Collection names
USERS_COLLECTION = "users"
PROJECTS_COLLECTION = "projects"
USER_PROJECTS_COLLECTION = "user_projects"

# JSON serializer for ObjectId
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

# Helper function to convert MongoDB _id to string id
def doc_to_dict(doc):
    if doc is None:
        return None
    
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    
    return doc

# User collection functions
def get_user(user_id: str) -> dict:
    """Get user by ID"""
    if not user_id:
        return None
    
    try:
        user_id_obj = ObjectId(user_id)
    except:
        # If user_id is not a valid ObjectId, try as a regular id
        user = db[USERS_COLLECTION].find_one({"id": user_id})
        if user:
            return doc_to_dict(user)
        return None
    
    user = db[USERS_COLLECTION].find_one({"_id": user_id_obj})
    return doc_to_dict(user)

def get_users() -> List[dict]:
    """Get all users"""
    users = list(db[USERS_COLLECTION].find())
    return [doc_to_dict(user) for user in users]

def get_users_by_tier(tier: int) -> List[dict]:
    """Get users by tier"""
    users = list(db[USERS_COLLECTION].find({"tier": tier}))
    return [doc_to_dict(user) for user in users]

def get_user_by_manager(manager_id: str) -> List[dict]:
    """Get users reporting to a manager"""
    try:
        manager_id_obj = ObjectId(manager_id)
    except:
        users = list(db[USERS_COLLECTION].find({"manager_id": manager_id}))
        return [doc_to_dict(user) for user in users]
    
    users = list(db[USERS_COLLECTION].find({"manager_id": manager_id_obj}))
    return [doc_to_dict(user) for user in users]

def create_user(user_data: dict) -> str:
    """Create a new user"""
    if "id" in user_data:
        del user_data["id"]
    
    result = db[USERS_COLLECTION].insert_one(user_data)
    return str(result.inserted_id)

def update_user(user_id: str, user_data: dict) -> bool:
    """Update user data"""
    try:
        user_id_obj = ObjectId(user_id)
    except:
        result = db[USERS_COLLECTION].update_one(
            {"id": user_id},
            {"$set": user_data}
        )
        return result.modified_count > 0
    
    result = db[USERS_COLLECTION].update_one(
        {"_id": user_id_obj},
        {"$set": user_data}
    )
    return result.modified_count > 0

# Project collection functions
def get_project(project_id: str) -> dict:
    """Get project by ID"""
    try:
        project_id_obj = ObjectId(project_id)
    except:
        project = db[PROJECTS_COLLECTION].find_one({"id": project_id})
        if project:
            return doc_to_dict(project)
        return None
    
    project = db[PROJECTS_COLLECTION].find_one({"_id": project_id_obj})
    return doc_to_dict(project)

def get_projects() -> List[dict]:
    """Get all projects"""
    projects = list(db[PROJECTS_COLLECTION].find())
    return [doc_to_dict(project) for project in projects]

def create_project(project_data: dict) -> str:
    """Create a new project"""
    if "id" in project_data:
        del project_data["id"]
    
    result = db[PROJECTS_COLLECTION].insert_one(project_data)
    return str(result.inserted_id)

def update_project(project_id: str, project_data: dict) -> bool:
    """Update project data"""
    try:
        project_id_obj = ObjectId(project_id)
    except:
        result = db[PROJECTS_COLLECTION].update_one(
            {"id": project_id},
            {"$set": project_data}
        )
        return result.modified_count > 0
    
    result = db[PROJECTS_COLLECTION].update_one(
        {"_id": project_id_obj},
        {"$set": project_data}
    )
    return result.modified_count > 0

# User-Projects relationship functions
def get_user_projects(user_id: str) -> List[dict]:
    """Get projects for a user"""
    try:
        user_id_obj = ObjectId(user_id)
    except:
        relations = list(db[USER_PROJECTS_COLLECTION].find({"user_id": user_id}))
        project_ids = [relation["project_id"] for relation in relations]
        
        # Get projects by their IDs
        projects = []
        for project_id in project_ids:
            project = get_project(project_id)
            if project:
                projects.append(project)
        
        return projects
    
    relations = list(db[USER_PROJECTS_COLLECTION].find({"user_id": user_id_obj}))
    project_ids = [relation["project_id"] for relation in relations]
    
    # Get projects by their IDs
    projects = []
    for project_id in project_ids:
        project = get_project(project_id)
        if project:
            projects.append(project)
    
    return projects

def get_project_users(project_id: str) -> List[dict]:
    """Get users for a project"""
    try:
        project_id_obj = ObjectId(project_id)
    except:
        relations = list(db[USER_PROJECTS_COLLECTION].find({"project_id": project_id}))
        user_ids = [relation["user_id"] for relation in relations]
        
        # Get users by their IDs
        users = []
        for user_id in user_ids:
            user = get_user(user_id)
            if user:
                users.append(user)
        
        return users
    
    relations = list(db[USER_PROJECTS_COLLECTION].find({"project_id": project_id_obj}))
    user_ids = [relation["user_id"] for relation in relations]
    
    # Get users by their IDs
    users = []
    for user_id in user_ids:
        user = get_user(user_id)
        if user:
            users.append(user)
    
    return users

def add_user_to_project(user_id: str, project_id: str) -> bool:
    """Add user to project"""
    # Check if relation already exists
    existing = db[USER_PROJECTS_COLLECTION].find_one({
        "user_id": user_id,
        "project_id": project_id
    })
    
    if existing:
        return True
    
    # Create new relation
    result = db[USER_PROJECTS_COLLECTION].insert_one({
        "user_id": user_id,
        "project_id": project_id
    })
    
    return result.inserted_id is not None

def remove_user_from_project(user_id: str, project_id: str) -> bool:
    """Remove user from project"""
    result = db[USER_PROJECTS_COLLECTION].delete_one({
        "user_id": user_id,
        "project_id": project_id
    })
    
    return result.deleted_count > 0

# Initialize collections
def ensure_collections():
    """Ensure that all required collections exist"""
    collections = db.list_collection_names()
    
    if USERS_COLLECTION not in collections:
        db.create_collection(USERS_COLLECTION)
    
    if PROJECTS_COLLECTION not in collections:
        db.create_collection(PROJECTS_COLLECTION)
    
    if USER_PROJECTS_COLLECTION not in collections:
        db.create_collection(USER_PROJECTS_COLLECTION)

# Create indexes for better query performance
def create_indexes():
    """Create indexes for better query performance"""
    db[USERS_COLLECTION].create_index("manager_id")
    db[USERS_COLLECTION].create_index("tier")
    db[USERS_COLLECTION].create_index("email", unique=True)
    db[USER_PROJECTS_COLLECTION].create_index([("user_id", 1), ("project_id", 1)], unique=True)

# Initialize database
def init_db():
    """Initialize database collections and indexes"""
    ensure_collections()
    create_indexes()

# Export a DB session-like object for compatibility with the existing code
class MongoSession:
    def __init__(self):
        self.db = db
    
    def close(self):
        pass  # No need to close MongoDB sessions
    
    def query(self, model):
        if model.__name__ == "User":
            return UserQuery(self.db[USERS_COLLECTION])
        elif model.__name__ == "Project":
            return ProjectQuery(self.db[PROJECTS_COLLECTION])
        return None
    
    def commit(self):
        pass  # MongoDB commits automatically

class UserQuery:
    def __init__(self, collection):
        self.collection = collection
        self.filters = {}
    
    def filter(self, **kwargs):
        self.filters.update(kwargs)
        return self
    
    def all(self):
        users = list(self.collection.find(self.filters))
        return [doc_to_dict(user) for user in users]
    
    def first(self):
        user = self.collection.find_one(self.filters)
        return doc_to_dict(user)

class ProjectQuery:
    def __init__(self, collection):
        self.collection = collection
        self.filters = {}
    
    def filter(self, **kwargs):
        self.filters.update(kwargs)
        return self
    
    def all(self):
        projects = list(self.collection.find(self.filters))
        return [doc_to_dict(project) for project in projects]
    
    def first(self):
        project = self.collection.find_one(self.filters)
        return doc_to_dict(project)

def get_db():
    """Get a database session"""
    db_session = MongoSession()
    try:
        yield db_session
    finally:
        db_session.close()

# Initialize the database on module import
init_db() 
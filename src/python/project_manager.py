#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Project Manager Service
Handles project creation, updates, and AI analysis for Organization Galaxy
"""

import os
import sys
import json
import logging
import datetime
from typing import Dict, List, Any, Optional, Union
import pymongo
from pymongo import MongoClient
from bson import ObjectId
import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("project_manager")

# MongoDB connection
MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/orgvision")

class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime.datetime):
            return obj.isoformat()
        return super(JSONEncoder, self).default(obj)

class ProjectManager:
    """Service to manage projects and team assignments with AI assistance"""
    
    def __init__(self):
        """Initialize the project manager with MongoDB connection"""
        try:
            self.client = MongoClient(MONGODB_URI)
            self.db = self.client.get_database()
            logger.info("Connected to MongoDB")
            
            # Ensure indexes are created
            self.db.projects.create_index([("projectId", pymongo.ASCENDING)], unique=True)
            self.db.projects.create_index([("createdBy", pymongo.ASCENDING)])
            self.db.projects.create_index([("employeeContributions.userId", pymongo.ASCENDING)])
            
            # Initialize AI models
            self.skills_vectorizer = None
            self.load_ai_models()
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise
    
    def load_ai_models(self):
        """Load or initialize AI models for skill analysis"""
        try:
            # We'll use TF-IDF vectorization for skill similarity
            self.skills_vectorizer = TfidfVectorizer(analyzer='word', 
                                                     stop_words='english', 
                                                     min_df=0.01, 
                                                     max_df=0.95)
            
            # Load existing skills from employees to train the vectorizer
            employees = list(self.db.employees.find({}, {"skills": 1}))
            skills_documents = []
            
            for emp in employees:
                if "skills" in emp and emp["skills"]:
                    skills_documents.append(" ".join(emp["skills"]))
            
            if skills_documents:
                self.skills_vectorizer.fit(skills_documents)
                logger.info(f"AI model trained with {len(skills_documents)} skill documents")
            else:
                logger.warning("No skills data found for AI model training")
                
        except Exception as e:
            logger.error(f"Error loading AI models: {e}")
            # Continue without AI features if there's an error
            pass
    
    def create_project(self, project_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new project with assigned users and tasks
        
        Args:
            project_data: Dictionary containing project details
            
        Returns:
            Dictionary with created project details and AI insights
        """
        try:
            # Generate project ID if not provided
            if "projectId" not in project_data:
                project_data["projectId"] = f"PRJ-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}"
            
            # Convert string IDs to ObjectId where needed
            if "createdBy" in project_data and isinstance(project_data["createdBy"], str):
                project_data["createdBy"] = ObjectId(project_data["createdBy"])
                
            if "organizationId" in project_data and isinstance(project_data["organizationId"], str):
                project_data["organizationId"] = ObjectId(project_data["organizationId"])
            
            # Format employee contributions if provided
            if "assignedUsers" in project_data:
                # Process assigned users into the expected structure
                employee_contributions = []
                
                for user in project_data["assignedUsers"]:
                    # Map userId to ObjectId if provided
                    user_id = None
                    if user.get("userId") and user["userId"] != "null":
                        try:
                            user_id = ObjectId(user["userId"])
                        except:
                            logger.warning(f"Invalid userId format: {user['userId']}")
                    
                    # Get employee record or create placeholder
                    employee_id = user.get("employeeId", "pending")
                    
                    # Create the contribution record
                    contribution = {
                        "employeeId": employee_id,
                        "userId": user_id,
                        "role": user.get("role", "Contributor"),
                        "isTeamLead": user.get("isTeamLead", False),
                        "weeklyHours": []
                    }
                    
                    # Add weekly hours if provided
                    if "hours" in user and user["hours"]:
                        # Get the current week's start date (Sunday)
                        today = datetime.datetime.now()
                        start_of_week = today - datetime.timedelta(days=today.weekday())
                        
                        contribution["weeklyHours"].append({
                            "weekStartDate": start_of_week,
                            "hours": float(user["hours"]),
                            "reportedTech": user.get("technologies", [])
                        })
                    
                    employee_contributions.append(contribution)
                
                project_data["employeeContributions"] = employee_contributions
                del project_data["assignedUsers"]
            
            # Ensure timestamps
            now = datetime.datetime.now()
            project_data["createdAt"] = now
            project_data["updatedAt"] = now
            
            # Insert the project
            result = self.db.projects.insert_one(project_data)
            inserted_id = result.inserted_id
            
            # Get the inserted project
            created_project = self.db.projects.find_one({"_id": inserted_id})
            
            # Run AI analysis in the background
            self.analyze_project_skills(str(inserted_id))
            
            # Return the created project
            return json.loads(JSONEncoder().encode(created_project))
        
        except Exception as e:
            logger.error(f"Error creating project: {e}")
            raise
    
    def get_projects_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all projects for a specific user
        
        Args:
            user_id: The user ID as a string
            
        Returns:
            List of projects the user is part of
        """
        try:
            # Convert to ObjectId
            user_object_id = ObjectId(user_id)
            
            # Find projects where the user is either creator or contributor
            projects = list(self.db.projects.find({
                "$or": [
                    {"createdBy": user_object_id},
                    {"employeeContributions.userId": user_object_id}
                ]
            }).sort("updatedAt", pymongo.DESCENDING))
            
            # Convert to JSON serializable format
            return json.loads(JSONEncoder().encode(projects))
        
        except Exception as e:
            logger.error(f"Error fetching projects for user {user_id}: {e}")
            return []
    
    def analyze_project_skills(self, project_id: str) -> Dict[str, Any]:
        """
        Analyze skills and technologies used in a project using AI.
        Updates each user's profile with insights about their expertise.
        
        Args:
            project_id: The project ID to analyze
            
        Returns:
            Dictionary with analysis results
        """
        try:
            # Skip analysis if vectorizer not initialized
            if not self.skills_vectorizer:
                logger.warning("Skipping skill analysis - vectorizer not initialized")
                return {"success": False, "message": "Skill analysis not available"}
            
            # Get the project
            project = self.db.projects.find_one({"_id": ObjectId(project_id)})
            if not project:
                logger.warning(f"Project not found for analysis: {project_id}")
                return {"success": False, "message": "Project not found"}
            
            # Extract all technologies from the project
            project_techs = project.get("techStack", [])
            
            # Analyze each employee contribution
            for contribution in project.get("employeeContributions", []):
                user_id = contribution.get("userId")
                if not user_id:
                    continue
                
                # Get technologies used by this user
                user_techs = []
                for week in contribution.get("weeklyHours", []):
                    if "reportedTech" in week and week["reportedTech"]:
                        user_techs.extend(week["reportedTech"])
                
                # If no technologies, use project technologies
                if not user_techs:
                    user_techs = project_techs
                
                # Skip if still no technologies
                if not user_techs:
                    continue
                
                # Combine into a document for analysis
                user_tech_doc = " ".join(user_techs)
                
                # Get the user record
                user = self.db.users.find_one({"_id": user_id})
                if not user:
                    continue
                
                # Get current skills or initialize
                user_skills = user.get("skills", [])
                
                # Extract user's expertise level on technologies
                tech_scores = {}
                
                # If user has existing skills, calculate similarity
                if user_skills:
                    # Combine existing skills into a document
                    existing_skills_doc = " ".join(user_skills)
                    
                    # Vectorize both documents
                    try:
                        docs = [existing_skills_doc, user_tech_doc]
                        vectors = self.skills_vectorizer.transform(docs)
                        
                        # Calculate similarity between existing skills and project tech
                        similarity = cosine_similarity(vectors[0], vectors[1])[0][0]
                        
                        logger.info(f"User {user['email']} skill similarity: {similarity:.2f}")
                        
                        # Add a proficiency score for each technology
                        base_score = 0.5  # Start with moderate proficiency
                        if similarity > 0.7:
                            # Higher starting score if existing skills are very similar
                            base_score = 0.8
                        elif similarity > 0.4:
                            base_score = 0.7
                        
                        for tech in user_techs:
                            tech_scores[tech] = min(1.0, base_score + (0.1 * user_techs.count(tech)))
                    
                    except Exception as e:
                        logger.error(f"Error in skill similarity calculation: {e}")
                        # Fallback to simple scoring
                        for tech in user_techs:
                            tech_scores[tech] = 0.5
                else:
                    # If no existing skills, assign moderate proficiency
                    for tech in user_techs:
                        tech_scores[tech] = 0.5
                
                # Update user's skills and technology proficiency
                updates = {}
                
                # Add new technologies to skills array if not already present
                for tech in user_techs:
                    if tech not in user_skills:
                        user_skills.append(tech)
                
                updates["skills"] = user_skills
                
                # Create or update technology proficiency scores
                if "technologyProficiency" not in user:
                    updates["technologyProficiency"] = {}
                
                for tech, score in tech_scores.items():
                    # Combine with existing scores if available
                    if "technologyProficiency" in user and tech in user["technologyProficiency"]:
                        existing_score = float(user["technologyProficiency"][tech])
                        # Weighted average: 70% existing, 30% new score
                        updates["technologyProficiency." + tech] = 0.7 * existing_score + 0.3 * score
                    else:
                        updates["technologyProficiency." + tech] = score
                
                # Update the user record
                self.db.users.update_one(
                    {"_id": user_id},
                    {"$set": updates}
                )
                
                logger.info(f"Updated skill profile for user {user.get('email')}")
            
            return {"success": True, "message": "Skill analysis complete"}
        
        except Exception as e:
            logger.error(f"Error in project skill analysis: {e}")
            return {"success": False, "message": str(e)}
    
    def get_user_insights(self, user_id: str) -> Dict[str, Any]:
        """
        Get AI-generated insights about a user's skills and project history
        
        Args:
            user_id: User ID to analyze
            
        Returns:
            Dictionary with insights about the user
        """
        try:
            # Convert to ObjectId
            user_object_id = ObjectId(user_id)
            
            # Get the user record
            user = self.db.users.find_one({"_id": user_object_id})
            if not user:
                return {"success": False, "message": "User not found"}
            
            # Get projects the user has participated in
            projects = list(self.db.projects.find({
                "employeeContributions.userId": user_object_id
            }).sort("updatedAt", pymongo.DESCENDING))
            
            # Basic stats
            insights = {
                "totalProjects": len(projects),
                "topSkills": [],
                "totalHours": 0,
                "roleDistribution": {},
                "projectHistory": []
            }
            
            # Calculate total hours and collect roles
            for project in projects:
                # Find this user's contribution
                for contrib in project.get("employeeContributions", []):
                    if contrib.get("userId") == user_object_id:
                        # Add role to distribution
                        role = contrib.get("role", "Contributor")
                        insights["roleDistribution"][role] = insights["roleDistribution"].get(role, 0) + 1
                        
                        # Calculate total hours
                        for week in contrib.get("weeklyHours", []):
                            insights["totalHours"] += week.get("hours", 0)
                        
                        # Add to project history
                        insights["projectHistory"].append({
                            "projectId": project.get("projectId"),
                            "title": project.get("title"),
                            "role": role,
                            "technologies": project.get("techStack", [])
                        })
            
            # Get top skills based on proficiency scores
            if "technologyProficiency" in user:
                tech_scores = user["technologyProficiency"]
                sorted_skills = sorted(tech_scores.items(), key=lambda x: x[1], reverse=True)
                insights["topSkills"] = [skill for skill, score in sorted_skills[:5]]
            elif "skills" in user:
                insights["topSkills"] = user["skills"][:5] if len(user["skills"]) > 5 else user["skills"]
            
            return {"success": True, "insights": insights}
        
        except Exception as e:
            logger.error(f"Error generating user insights: {e}")
            return {"success": False, "message": str(e)}

# CLI interface for direct testing
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Project Management Service")
    parser.add_argument("action", choices=["create_project", "get_projects", "analyze_project", "get_insights"],
                        help="Action to perform")
    parser.add_argument("--data", help="JSON data for the action")
    parser.add_argument("--user_id", help="User ID for getting projects or insights")
    parser.add_argument("--project_id", help="Project ID for analysis")
    parser.add_argument("--output", help="Output file for results")
    
    args = parser.parse_args()
    
    # Initialize the project manager
    manager = ProjectManager()
    
    result = None
    if args.action == "create_project":
        if not args.data:
            print("Error: --data required for create_project")
            sys.exit(1)
        
        project_data = json.loads(args.data)
        result = manager.create_project(project_data)
    
    elif args.action == "get_projects":
        if not args.user_id:
            print("Error: --user_id required for get_projects")
            sys.exit(1)
        
        result = manager.get_projects_for_user(args.user_id)
    
    elif args.action == "analyze_project":
        if not args.project_id:
            print("Error: --project_id required for analyze_project")
            sys.exit(1)
        
        result = manager.analyze_project_skills(args.project_id)
    
    elif args.action == "get_insights":
        if not args.user_id:
            print("Error: --user_id required for get_insights")
            sys.exit(1)
        
        result = manager.get_user_insights(args.user_id)
    
    # Output results
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(result, f, indent=2)
    else:
        print(json.dumps(result, indent=2)) 
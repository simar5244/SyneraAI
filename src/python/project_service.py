#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Project Management Service

This module provides backend functionality for project management,
including CRUD operations and analytics capabilities.

For a military application, this includes:
- Secure database operations
- Audit logging
- Data validation
- Analytics for resource allocation and risk assessment
"""

import os
import json
import logging
import datetime
from typing import Dict, List, Any, Optional, Union, Tuple
import uuid
import hashlib
import pymongo
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from bson.objectid import ObjectId
import numpy as np
from pydantic import BaseModel, Field, validator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database connection with security measures
class DatabaseManager:
    def __init__(self, connection_string: Optional[str] = None):
        """Initialize the database connection with secure parameters."""
        try:
            # Get connection string from environment variable or use a default for development
            self.connection_string = connection_string or os.getenv(
                'MONGODB_URI', 
                'mongodb://localhost:27017'
            )
            
            # Secure connection settings
            self.client = MongoClient(
                self.connection_string,
                serverSelectionTimeoutMS=5000,
                ssl=True if not self.connection_string.startswith('mongodb://localhost') else False,
                tlsAllowInvalidCertificates=False,
                retryWrites=True,
                w='majority'  # Write concern for data integrity
            )
            
            # Verify connection
            self.client.admin.command('ping')
            logger.info("Connected to MongoDB successfully")
            
            # Select database
            self.db = self.client.organization_galaxy
            
            # Initialize collections with validation
            self._setup_collections()
            
        except ConnectionFailure as e:
            logger.error(f"Failed to connect to database: {e}")
            # Use a fallback storage mechanism for development
            self.client = None
            self.db = None
            
    def _setup_collections(self):
        """Set up database collections with schema validation."""
        # Only set up if we have a connection
        if not self.db:
            return
            
        # Projects collection
        if "projects" not in self.db.list_collection_names():
            self.db.create_collection("projects")
            
            # Create indexes for performance
            self.db.projects.create_index([("project_id", pymongo.ASCENDING)], unique=True)
            self.db.projects.create_index([("department", pymongo.ASCENDING)])
            self.db.projects.create_index([("status", pymongo.ASCENDING)])
            self.db.projects.create_index([("priority", pymongo.ASCENDING)])
            self.db.projects.create_index([("tech_stack", pymongo.ASCENDING)])
            
            logger.info("Projects collection and indexes created")
            
        # Audit log collection for security
        if "audit_logs" not in self.db.list_collection_names():
            self.db.create_collection("audit_logs")
            self.db.audit_logs.create_index([("timestamp", pymongo.DESCENDING)])
            self.db.audit_logs.create_index([("user_id", pymongo.ASCENDING)])
            self.db.audit_logs.create_index([("action", pymongo.ASCENDING)])
            logger.info("Audit logs collection and indexes created")
            
    def log_action(self, user_id: str, action: str, entity_type: str, 
                  entity_id: str, details: Dict[str, Any]) -> None:
        """Record an audit log entry for security and compliance."""
        if not self.db:
            logger.warning("Cannot log action: No database connection")
            return
            
        try:
            log_entry = {
                "user_id": user_id,
                "action": action,  # e.g., "create", "update", "delete", "view"
                "entity_type": entity_type,  # e.g., "project", "employee"
                "entity_id": entity_id,
                "timestamp": datetime.datetime.utcnow(),
                "ip_address": details.get("ip_address"),
                "details": details
            }
            
            self.db.audit_logs.insert_one(log_entry)
        except Exception as e:
            logger.error(f"Failed to log action: {e}")
    
    def close(self):
        """Safely close the database connection."""
        if self.client:
            self.client.close()
            logger.info("Database connection closed")


# Pydantic models for data validation
class EmployeeContribution(BaseModel):
    employee_id: str
    role: str
    hours_per_week: int
    start_date: datetime.datetime
    end_date: Optional[datetime.datetime] = None
    active: bool = True
    
    class Config:
        json_encoders = {
            datetime.datetime: lambda v: v.isoformat()
        }


class Project(BaseModel):
    project_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_title: str
    project_description: str
    tech_stack: List[str]
    start_date: datetime.datetime
    end_date: Optional[datetime.datetime] = None
    department: str
    status: str  # "Planning", "In Progress", "On Hold", "Completed", "Cancelled"
    priority: str  # "Low", "Medium", "High", "Critical"
    total_hours: int
    employee_contributions: List[EmployeeContribution]
    complexity_score: Optional[float] = None
    impact_score: Optional[float] = None
    risk_level: Optional[str] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    
    class Config:
        json_encoders = {
            datetime.datetime: lambda v: v.isoformat()
        }
    
    @validator('project_title')
    def title_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError('Project title cannot be empty')
        return v
    
    @validator('status')
    def status_must_be_valid(cls, v):
        valid_statuses = ["Planning", "In Progress", "On Hold", "Completed", "Cancelled"]
        if v not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v
    
    @validator('priority')
    def priority_must_be_valid(cls, v):
        valid_priorities = ["Low", "Medium", "High", "Critical"]
        if v not in valid_priorities:
            raise ValueError(f'Priority must be one of: {", ".join(valid_priorities)}')
        return v


class ProjectService:
    """Service for managing projects with security and analytics capabilities."""
    
    def __init__(self):
        """Initialize the project service with database connection."""
        self.db_manager = DatabaseManager()
        
        # Fallback storage for development/testing
        self._projects = []
        
    def _ensure_db_connection(self) -> bool:
        """Check if we have a valid database connection."""
        return self.db_manager.db is not None
    
    def create_project(self, project_data: Dict[str, Any], user_id: str, 
                      request_metadata: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Create a new project with validation and security controls.
        
        Args:
            project_data: Dictionary containing project details
            user_id: ID of user creating the project
            request_metadata: Additional request information (IP, user agent, etc.)
            
        Returns:
            Tuple of (success, message, project_data)
        """
        try:
            # Validate data using Pydantic model
            # Convert string dates to datetime objects if needed
            for date_field in ['start_date', 'end_date']:
                if date_field in project_data and isinstance(project_data[date_field], str):
                    try:
                        project_data[date_field] = datetime.datetime.fromisoformat(
                            project_data[date_field].replace('Z', '+00:00')
                        )
                    except ValueError:
                        pass
            
            # Handle employee contributions
            if 'employee_contributions' in project_data:
                for i, contrib in enumerate(project_data['employee_contributions']):
                    for date_field in ['start_date', 'end_date']:
                        if date_field in contrib and isinstance(contrib[date_field], str) and contrib[date_field]:
                            try:
                                project_data['employee_contributions'][i][date_field] = (
                                    datetime.datetime.fromisoformat(
                                        contrib[date_field].replace('Z', '+00:00')
                                    )
                                )
                            except ValueError:
                                pass
            
            # Create project model
            project = Project(**project_data)
            
            # Apply risk modeling
            self._apply_risk_modeling(project)
            
            # Save to database
            if self._ensure_db_connection():
                result = self.db_manager.db.projects.insert_one(project.dict())
                
                # Log the action
                self.db_manager.log_action(
                    user_id=user_id,
                    action="create",
                    entity_type="project",
                    entity_id=project.project_id,
                    details={
                        "ip_address": request_metadata.get("ip_address"),
                        "user_agent": request_metadata.get("user_agent"),
                        "project_title": project.project_title
                    }
                )
                
                return True, "Project created successfully", project.dict()
            else:
                # Fallback to memory storage for development
                self._projects.append(project.dict())
                logger.warning("Using in-memory storage for project creation")
                return True, "Project created in memory storage", project.dict()
                
        except ValueError as e:
            logger.error(f"Validation error creating project: {e}")
            return False, f"Validation error: {str(e)}", {}
        except Exception as e:
            logger.error(f"Error creating project: {e}")
            return False, f"Error creating project: {str(e)}", {}
    
    def get_projects(self, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Retrieve projects with optional filtering.
        
        Args:
            filters: Dictionary of filter criteria
            
        Returns:
            List of project dictionaries
        """
        filters = filters or {}
        
        try:
            if self._ensure_db_connection():
                # Build query from filters
                query = {}
                
                if 'status' in filters:
                    query['status'] = filters['status']
                
                if 'department' in filters:
                    query['department'] = filters['department']
                
                if 'priority' in filters:
                    query['priority'] = filters['priority']
                
                if 'tech_stack' in filters:
                    query['tech_stack'] = {"$in": filters['tech_stack']}
                
                # Date range filters
                if 'start_date_from' in filters:
                    query.setdefault('start_date', {})
                    query['start_date']['$gte'] = datetime.datetime.fromisoformat(
                        filters['start_date_from'].replace('Z', '+00:00')
                    )
                
                if 'start_date_to' in filters:
                    query.setdefault('start_date', {})
                    query['start_date']['$lte'] = datetime.datetime.fromisoformat(
                        filters['start_date_to'].replace('Z', '+00:00')
                    )
                
                # Get projects from database
                cursor = self.db_manager.db.projects.find(query)
                projects = list(cursor)
                
                # Convert ObjectId to string for serialization
                for project in projects:
                    if '_id' in project:
                        project['_id'] = str(project['_id'])
                
                return projects
            else:
                # Return in-memory projects with basic filtering
                result = self._projects
                
                if 'status' in filters:
                    result = [p for p in result if p['status'] == filters['status']]
                
                if 'department' in filters:
                    result = [p for p in result if p['department'] == filters['department']]
                
                return result
                
        except Exception as e:
            logger.error(f"Error retrieving projects: {e}")
            return []
    
    def get_project_by_id(self, project_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a specific project by ID.
        
        Args:
            project_id: Unique identifier for the project
            
        Returns:
            Project dictionary or None if not found
        """
        try:
            if self._ensure_db_connection():
                project = self.db_manager.db.projects.find_one({"project_id": project_id})
                
                if project:
                    # Convert ObjectId to string for serialization
                    if '_id' in project:
                        project['_id'] = str(project['_id'])
                    
                    return project
                return None
            else:
                # Search in-memory projects
                for project in self._projects:
                    if project['project_id'] == project_id:
                        return project
                return None
                
        except Exception as e:
            logger.error(f"Error retrieving project {project_id}: {e}")
            return None
    
    def update_project(self, project_id: str, update_data: Dict[str, Any], 
                      user_id: str, request_metadata: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Update an existing project.
        
        Args:
            project_id: ID of the project to update
            update_data: Dictionary of fields to update
            user_id: ID of user making the update
            request_metadata: Additional request information
            
        Returns:
            Tuple of (success, message)
        """
        try:
            # Get current project
            current_project = self.get_project_by_id(project_id)
            
            if not current_project:
                return False, f"Project with ID {project_id} not found"
            
            # Update the project data
            updated_project = {**current_project, **update_data}
            
            # Set update timestamp
            updated_project['updated_at'] = datetime.datetime.utcnow()
            
            # Validate with Pydantic model
            project = Project(**updated_project)
            
            # Apply risk modeling
            self._apply_risk_modeling(project)
            
            # Save to database
            if self._ensure_db_connection():
                result = self.db_manager.db.projects.update_one(
                    {"project_id": project_id},
                    {"$set": project.dict()}
                )
                
                # Log the action
                self.db_manager.log_action(
                    user_id=user_id,
                    action="update",
                    entity_type="project",
                    entity_id=project_id,
                    details={
                        "ip_address": request_metadata.get("ip_address"),
                        "user_agent": request_metadata.get("user_agent"),
                        "fields_updated": list(update_data.keys())
                    }
                )
                
                if result.modified_count == 0:
                    return False, "No changes were made to the project"
                
                return True, "Project updated successfully"
            else:
                # Update in-memory storage
                for i, proj in enumerate(self._projects):
                    if proj['project_id'] == project_id:
                        self._projects[i] = project.dict()
                        return True, "Project updated in memory storage"
                
                return False, "Project not found in memory storage"
                
        except ValueError as e:
            logger.error(f"Validation error updating project: {e}")
            return False, f"Validation error: {str(e)}"
        except Exception as e:
            logger.error(f"Error updating project {project_id}: {e}")
            return False, f"Error updating project: {str(e)}"
    
    def delete_project(self, project_id: str, user_id: str, 
                      request_metadata: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Delete a project.
        
        Args:
            project_id: ID of the project to delete
            user_id: ID of user performing the deletion
            request_metadata: Additional request information
            
        Returns:
            Tuple of (success, message)
        """
        try:
            # Check if project exists
            project = self.get_project_by_id(project_id)
            
            if not project:
                return False, f"Project with ID {project_id} not found"
            
            if self._ensure_db_connection():
                result = self.db_manager.db.projects.delete_one({"project_id": project_id})
                
                # Log the action
                self.db_manager.log_action(
                    user_id=user_id,
                    action="delete",
                    entity_type="project",
                    entity_id=project_id,
                    details={
                        "ip_address": request_metadata.get("ip_address"),
                        "user_agent": request_metadata.get("user_agent"),
                        "project_title": project.get("project_title")
                    }
                )
                
                if result.deleted_count == 0:
                    return False, f"Failed to delete project {project_id}"
                
                return True, "Project deleted successfully"
            else:
                # Delete from in-memory storage
                for i, proj in enumerate(self._projects):
                    if proj['project_id'] == project_id:
                        del self._projects[i]
                        return True, "Project deleted from memory storage"
                
                return False, "Project not found in memory storage"
                
        except Exception as e:
            logger.error(f"Error deleting project {project_id}: {e}")
            return False, f"Error deleting project: {str(e)}"
    
    def _apply_risk_modeling(self, project: Project) -> None:
        """
        Apply risk modeling and complexity scoring to a project.
        
        Args:
            project: Project model to update with risk assessments
        """
        # Only update if not already set by user
        if project.complexity_score is None:
            # Calculate complexity based on team size, duration, and tech stack
            team_size = len(project.employee_contributions)
            
            # Calculate duration in months
            start = project.start_date
            end = project.end_date or (datetime.datetime.utcnow() + datetime.timedelta(days=90))
            duration_days = (end - start).days
            duration_months = duration_days / 30
            
            # Tech stack complexity factor
            tech_complexity = min(len(project.tech_stack) * 5, 30)
            
            # Base complexity formula
            complexity = (
                (team_size * 10) + 
                (duration_months * 5) + 
                tech_complexity + 
                (project.total_hours / 100)
            )
            
            # Normalize to 0-100 scale
            project.complexity_score = min(round(complexity), 100)
        
        # Calculate impact score if not set
        if project.impact_score is None:
            # Factors for impact: priority, department, total hours
            priority_factor = {
                "Low": 25,
                "Medium": 50,
                "High": 75,
                "Critical": 100
            }.get(project.priority, 50)
            
            # Department criticality (this would be domain-specific in a real app)
            dept_factor = 65  # default medium-high importance
            
            # Scale based on total hours (proxy for resource investment)
            hours_factor = min(project.total_hours / 50, 100)
            
            # Calculate impact
            impact = (priority_factor * 0.5) + (dept_factor * 0.3) + (hours_factor * 0.2)
            project.impact_score = round(impact)
        
        # Determine risk level if not set
        if project.risk_level is None:
            # Combine complexity and impact
            risk_score = (project.complexity_score * 0.6) + (project.impact_score * 0.4)
            
            # Map to risk levels
            if risk_score >= 85:
                project.risk_level = "High"
            elif risk_score >= 60:
                project.risk_level = "Medium"
            else:
                project.risk_level = "Low"
    
    def get_project_analytics(self) -> Dict[str, Any]:
        """
        Generate analytics data for projects.
        
        Returns:
            Dictionary with analytics metrics
        """
        try:
            projects = self.get_projects()
            
            if not projects:
                return {"status": "No projects available for analysis"}
            
            # Basic analytics
            total_projects = len(projects)
            active_projects = len([p for p in projects if p['status'] == 'In Progress'])
            completed_projects = len([p for p in projects if p['status'] == 'Completed'])
            
            # Total resource allocation (person-hours)
            total_allocated_hours = sum(p['total_hours'] for p in projects)
            
            # Department distribution
            dept_distribution = {}
            for p in projects:
                dept = p['department']
                dept_distribution[dept] = dept_distribution.get(dept, 0) + 1
            
            # Risk distribution
            risk_distribution = {
                "High": len([p for p in projects if p.get('risk_level') == 'High']),
                "Medium": len([p for p in projects if p.get('risk_level') == 'Medium']),
                "Low": len([p for p in projects if p.get('risk_level') == 'Low'])
            }
            
            # Upcoming milestones (projects ending in next 30 days)
            now = datetime.datetime.utcnow()
            upcoming_end = now + datetime.timedelta(days=30)
            upcoming_milestones = [
                {
                    "project_id": p['project_id'],
                    "title": p['project_title'],
                    "end_date": p['end_date']
                }
                for p in projects 
                if p.get('end_date') and now <= p['end_date'] <= upcoming_end
            ]
            
            # Tech stack analysis
            tech_usage = {}
            for p in projects:
                for tech in p['tech_stack']:
                    tech_usage[tech] = tech_usage.get(tech, 0) + 1
            
            return {
                "total_projects": total_projects,
                "active_projects": active_projects,
                "completed_projects": completed_projects,
                "upcoming_milestones": upcoming_milestones,
                "total_allocated_hours": total_allocated_hours,
                "department_distribution": dept_distribution,
                "risk_distribution": risk_distribution,
                "tech_stack_distribution": tech_usage
            }
            
        except Exception as e:
            logger.error(f"Error generating project analytics: {e}")
            return {"error": str(e)}
    
    def close(self):
        """Close database connection when service is no longer needed."""
        if self.db_manager:
            self.db_manager.close() 
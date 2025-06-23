# Project Structure
'''
org_sim_ai/
├── main.py                  # FastAPI application entry point  
├── models.py                # Database models
├── schemas.py               # Pydantic schemas for request/response validation
├── services/
│   ├── __init__.py
│   ├── auth_service.py      # Authentication and authorization
│   ├── chart_service.py     # Organizational chart operations
│   ├── ai_suggester.py      # AI-powered suggestions using Gemini API
│   └── workload_service.py  # Workload and stress analysis
├── routers/
│   ├── __init__.py
│   ├── org_chart.py         # Org chart endpoints
│   ├── profile.py           # User profile endpoints
│   └── simulation.py        # Simulation endpoints
├── middleware/
│   ├── __init__.py
│   └── auth_middleware.py   # Role-based access control
├── database.py              # Database configuration
├── mock_data.py             # Test data generation
└── .env.local               # Environment variables (not in version control)
'''

# models.py
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, JSON, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

# Association tables for many-to-many relationships
user_projects = Table(
    "user_projects",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id")),
    Column("project_id", Integer, ForeignKey("projects.id"))
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    role = Column(String)
    tier = Column(Integer)  # 1=Top Management, 2=Middle Management, etc.
    avatar_url = Column(String)
    responsibilities = Column(JSON)  # List of responsibility descriptions
    skills = Column(JSON)  # List of skills (both self-declared and AI-inferred)
    start_date = Column(DateTime, default=datetime.now)
    workload_hours = Column(Float, default=40.0)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_top_management = Column(Boolean, default=False)
    
    # Relationships
    subordinates = relationship("User", backref="manager", remote_side=[id])
    projects = relationship("Project", secondary=user_projects, back_populates="team_members")

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String)
    start_date = Column(DateTime)
    end_date = Column(DateTime, nullable=True)
    estimated_hours = Column(Float)
    status = Column(String)  # "active", "completed", "planned"
    
    # Relationships
    team_members = relationship("User", secondary=user_projects, back_populates="projects")

# Add additional models for organization modeling
class OrganizationLayout(Base):
    __tablename__ = "organization_layouts"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    nodes = relationship("LayoutNode", back_populates="layout", cascade="all, delete-orphan")

class LayoutNode(Base):
    __tablename__ = "layout_nodes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    layout_id = Column(Integer, ForeignKey("organization_layouts.id"))
    x_position = Column(Float, default=0)
    y_position = Column(Float, default=0)
    current_workload = Column(Float, default=40.0)  # Current workload calculation
    
    # Relationships
    user = relationship("User")
    layout = relationship("OrganizationLayout", back_populates="nodes")
    outgoing_connections = relationship("NodeConnection", foreign_keys="NodeConnection.source_id", back_populates="source", cascade="all, delete-orphan")
    incoming_connections = relationship("NodeConnection", foreign_keys="NodeConnection.target_id", back_populates="target", cascade="all, delete-orphan")

class NodeConnection(Base):
    __tablename__ = "node_connections"
    
    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("layout_nodes.id"))
    target_id = Column(Integer, ForeignKey("layout_nodes.id"))
    connection_type = Column(String, default="reporting")  # reporting, delegation, temporary, etc.
    workload_impact = Column(Float, default=0.0)  # How much workload this connection adds
    
    # Relationships
    source = relationship("LayoutNode", foreign_keys=[source_id], back_populates="outgoing_connections")
    target = relationship("LayoutNode", foreign_keys=[target_id], back_populates="incoming_connections")

# database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv(".env.local")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./org_sim.db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# schemas.py
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

class ProjectBase(BaseModel):
    name: str
    description: str
    estimated_hours: float
    status: str

class ProjectCreate(ProjectBase):
    start_date: datetime
    end_date: Optional[datetime] = None

class Project(ProjectBase):
    id: int
    start_date: datetime
    end_date: Optional[datetime] = None

    class Config:
        orm_mode = True

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    tier: int
    avatar_url: Optional[str] = None

class UserCreate(UserBase):
    responsibilities: List[str] = []
    skills: List[str] = []
    is_top_management: bool = False
    manager_id: Optional[int] = None
    workload_hours: float = 40.0

class User(UserBase):
    id: int
    responsibilities: List[str]
    skills: List[str]
    start_date: datetime
    workload_hours: float
    manager_id: Optional[int] = None
    is_top_management: bool
    
    class Config:
        orm_mode = True

class UserWithProjects(User):
    projects: List[Project] = []
    
    class Config:
        orm_mode = True

class ChartNode(BaseModel):
    id: int
    name: str
    role: str
    tier: int
    avatar_url: Optional[str]
    workload_hours: float
    stress_level: float  # -1 to 1 scale (-1 = underworked, 0 = balanced, 1 = overworked)
    stress_intensity: str  # "none", "light-blue", "blue", "deep-blue", "light-orange", "orange", "deep-orange", "red"
    children: List["ChartNode"] = []
    
    class Config:
        orm_mode = True

# Needed for self-referencing models
ChartNode.update_forward_refs()

class OrgChart(BaseModel):
    root_nodes: List[ChartNode]
    stress_zones: Dict[str, List[int]]  # Maps stress levels to list of user IDs

class ResponsibilityUpdate(BaseModel):
    responsibilities: List[str]

class AIRecommendation(BaseModel):
    suggestion_type: str  # "move", "delete", "reorganize"
    target_user_id: int
    recommendations: List[Dict[str, Any]]  # Flexible structure for different suggestion types
    explanation: str

class SimulationRequest(BaseModel):
    operation: str  # "move", "delete"
    user_id: int
    target_manager_id: Optional[int] = None  # For move operations

# services/workload_service.py
from models import User, Project
from typing import Dict, List, Tuple
from sqlalchemy.orm import Session

class WorkloadService:
    @staticmethod
    def calculate_workload(user_id: int, db: Session) -> float:
        """Calculate total workload hours for a user based on projects and responsibilities"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return 0.0
            
        # Base hours from responsibilities
        responsibility_hours = len(user.responsibilities) * 2.5  # Estimate 2.5 hours per responsibility
        
        # Hours from projects
        project_hours = 0.0
        for project in user.projects:
            if project.status == "active":
                # Simplified calculation - in reality would be more complex
                project_hours += project.estimated_hours / len(project.team_members)
                
        return responsibility_hours + project_hours
    
    @staticmethod
    def calculate_stress_level(user_id: int, db: Session) -> Tuple[float, str]:
        """
        Calculate stress level for a user
        Returns:
            - stress_level: float (-1 to 1)
            - stress_intensity: category string for frontend visualization
        """
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return 0.0, "none"
            
        # Get role baseline (would be more sophisticated in production)
        role_baseline = 40.0  # Standard workweek
        
        # Calculate actual workload
        actual_workload = WorkloadService.calculate_workload(user_id, db)
        
        # Calculate difference from baseline
        hours_difference = actual_workload - role_baseline
        
        # Convert to a normalized stress level (-1 to 1 scale)
        if hours_difference == 0:
            return 0.0, "none"
        
        # Calculate stress intensity category
        if hours_difference > 0:
            # Overworked (positive stress)
            if hours_difference <= 4:
                return min(hours_difference / 20, 1.0), "none"
            elif hours_difference <= 9:
                return min(hours_difference / 20, 1.0), "light-orange"
            elif hours_difference <= 14:
                return min(hours_difference / 20, 1.0), "orange"
            elif hours_difference <= 19:
                return min(hours_difference / 20, 1.0), "deep-orange"
            else:
                return 1.0, "red"
        else:
            # Underworked (negative stress)
            hours_difference = abs(hours_difference)
            if hours_difference <= 4:
                return max(-hours_difference / 20, -1.0), "none"
            elif hours_difference <= 9:
                return max(-hours_difference / 20, -1.0), "light-blue"
            elif hours_difference <= 14:
                return max(-hours_difference / 20, -1.0), "blue"
            else:
                return -1.0, "deep-blue"
    
    @staticmethod
    def get_org_stress_zones(db: Session) -> Dict[str, List[int]]:
        """Get stress zones across the organization"""
        users = db.query(User).all()
        stress_zones = {
            "none": [],
            "light-blue": [],
            "blue": [],
            "deep-blue": [],
            "light-orange": [],
            "orange": [],
            "deep-orange": [],
            "red": []
        }
        
        for user in users:
            _, stress_intensity = WorkloadService.calculate_stress_level(user.id, db)
            stress_zones[stress_intensity].append(user.id)
            
        return stress_zones

# services/chart_service.py
from models import User
from schemas import ChartNode, OrgChart
from sqlalchemy.orm import Session
from typing import List, Dict
from services.workload_service import WorkloadService

class ChartService:
    @staticmethod
    def build_org_chart(db: Session) -> OrgChart:
        """Build full organizational chart structure"""
        # Find all top-level users (those without managers)
        root_users = db.query(User).filter(User.manager_id == None).all()
        
        # Build the tree structure
        root_nodes = [ChartService._build_node(user, db) for user in root_users]
        
        # Get stress zones
        stress_zones = WorkloadService.get_org_stress_zones(db)
        
        return OrgChart(root_nodes=root_nodes, stress_zones=stress_zones)
    
    @staticmethod
    def _build_node(user: User, db: Session) -> ChartNode:
        """Recursively build a node and its children for the org chart"""
        # Calculate stress level
        stress_level, stress_intensity = WorkloadService.calculate_stress_level(user.id, db)
        
        # Build children nodes
        children = [ChartService._build_node(subordinate, db) for subordinate in user.subordinates]
        
        return ChartNode(
            id=user.id,
            name=user.name,
            role=user.role,
            tier=user.tier,
            avatar_url=user.avatar_url,
            workload_hours=WorkloadService.calculate_workload(user.id, db),
            stress_level=stress_level,
            stress_intensity=stress_intensity,
            children=children
        )

# services/ai_suggester.py
import os
import json
from typing import Dict, List, Any, Optional
import requests
from sqlalchemy.orm import Session
from models import User
from services.chart_service import ChartService
from services.workload_service import WorkloadService

class AISuggester:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.api_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
    
    def suggest_placement(self, user_id: int, db: Session) -> Dict[str, Any]:
        """Generate AI suggestions for better placement of a user within the org chart"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"error": "User not found"}
        
        # Get current manager
        manager = db.query(User).filter(User.id == user.manager_id).first() if user.manager_id else None
        
        # Get skills and responsibilities
        skills = user.skills
        responsibilities = user.responsibilities
        
        # Get potential managers (all users above this user's tier)
        potential_managers = db.query(User).filter(User.tier < user.tier).all()
        
        # Get organization chart for context
        org_chart = ChartService.build_org_chart(db)
        
        # Prepare prompt for AI
        prompt = self._create_placement_prompt(
            user=user,
            current_manager=manager,
            skills=skills,
            responsibilities=responsibilities,
            potential_managers=[m for m in potential_managers if m.id != user.manager_id],
            org_chart=org_chart
        )
        
        # Call Gemini API
        response = self._call_gemini_api(prompt)
        
        # Process and return suggestions
        return self._process_placement_response(response, user_id)
    
    def simulate_deletion(self, user_id: int, db: Session) -> Dict[str, Any]:
        """Simulate deletion of a user and suggest workload redistribution"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"error": "User not found"}
        
        # Get team members (siblings and subordinates)
        siblings = []
        if user.manager_id:
            siblings = db.query(User).filter(
                User.manager_id == user.manager_id,
                User.id != user.id
            ).all()
        
        subordinates = user.subordinates
        
        # Calculate current workload
        workload = WorkloadService.calculate_workload(user_id, db)
        
        # Get projects
        projects = user.projects
        
        # Prepare prompt for AI
        prompt = self._create_deletion_prompt(
            user=user,
            workload=workload,
            siblings=siblings,
            subordinates=subordinates,
            projects=projects
        )
        
        # Call Gemini API
        response = self._call_gemini_api(prompt)
        
        # Process and return suggestions
        return self._process_deletion_response(response, user_id, db)
    
    def _create_placement_prompt(self, user, current_manager, skills, responsibilities, potential_managers, org_chart) -> str:
        """Create prompt for placement suggestions"""
        return f"""
        As an organizational AI advisor, analyze this employee's current position and suggest 1-3 better placements:
        
        EMPLOYEE INFORMATION:
        - ID: {user.id}
        - Name: {user.name}
        - Current Role: {user.role}
        - Tier: {user.tier}
        - Skills: {json.dumps(skills)}
        - Responsibilities: {json.dumps(responsibilities)}
        - Current workload hours: {user.workload_hours}
        
        CURRENT MANAGER:
        {json.dumps({
            "id": current_manager.id if current_manager else None,
            "name": current_manager.name if current_manager else None,
            "role": current_manager.role if current_manager else None,
            "tier": current_manager.tier if current_manager else None
        })}
        
        POTENTIAL MANAGERS (LIMITED SELECTION):
        {json.dumps([{
            "id": m.id,
            "name": m.name,
            "role": m.role,
            "tier": m.tier,
            "team_size": len(m.subordinates)
        } for m in potential_managers[:5]])}
        
        ORGANIZATIONAL CONTEXT:
        {json.dumps(org_chart.dict())}
        
        TASK:
        1. Suggest 1-3 alternative placements for this employee
        2. For each suggestion, provide:
           - Target manager ID
           - Pros of the move (list 2-3)
           - Cons of the move (list 1-2)
           - Brief explanation of why this would be a good fit
        3. Consider:
           - Skill alignment
           - Role appropriateness
           - Workload distribution
           - Career development potential
        
        FORMAT RESPONSE AS JSON:
        {
          "suggestions": [
            {
              "target_manager_id": 123,
              "pros": ["reason1", "reason2", "reason3"],
              "cons": ["con1", "con2"],
              "explanation": "explanation text"
            }
          ]
        }
        """
    
    def _create_deletion_prompt(self, user, workload, siblings, subordinates, projects) -> str:
        """Create prompt for deletion simulation"""
        return f"""
        As an organizational AI advisor, analyze how to redistribute this employee's workload if they leave:
        
        EMPLOYEE BEING REMOVED:
        - ID: {user.id}
        - Name: {user.name}
        - Role: {user.role}
        - Current workload: {workload} hours
        - Responsibilities: {json.dumps(user.responsibilities)}
        
        TEAM MEMBERS WHO COULD ABSORB WORKLOAD:
        Siblings (same manager):
        {json.dumps([{
            "id": s.id,
            "name": s.name,
            "role": s.role,
            "skills": s.skills,
            "current_workload": WorkloadService.calculate_workload(s.id, None)
        } for s in siblings])}
        
        Subordinates:
        {json.dumps([{
            "id": s.id,
            "name": s.name,
            "role": s.role,
            "skills": s.skills,
            "current_workload": WorkloadService.calculate_workload(s.id, None)
        } for s in subordinates])}
        
        Projects they're involved in:
        {json.dumps([{
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "estimated_hours": p.estimated_hours
        } for p in projects])}
        
        TASK:
        1. Create a redistribution plan for this employee's workload
        2. Identify which responsibilities should go to which team members
        3. Assess the impact on remaining team members' workload
        4. Identify any critical gaps that would need to be filled by a new hire
        
        FORMAT RESPONSE AS JSON:
        {
          "redistribution": [
            {
              "user_id": 123,
              "responsibilities": ["resp1", "resp2"],
              "projects": [project_id1, project_id2],
              "new_workload": 45.5,
              "impact_level": "high" // or "medium" or "low"
            }
          ],
          "critical_gaps": ["gap1", "gap2"],
          "need_replacement": true, // or false
          "replacement_justification": "explanation text"
        }
        """
    
    def _call_gemini_api(self, prompt: str) -> Dict[str, Any]:
        """Call Gemini API with the given prompt"""
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self.api_key
        }
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ]
        }
        
        response = requests.post(self.api_url, headers=headers, json=payload)
        
        if response.status_code == 200:
            return response.json()
        else:
            # In production, this would have better error handling
            return {"error": f"API Error: {response.status_code}"}
    
    def _process_placement_response(self, response: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        """Process and format the AI response for placement suggestions"""
        try:
            # Extract text from Gemini response
            content = response.get("candidates", [{}])[0].get("content", {})
            text = content.get("parts", [{}])[0].get("text", "")
            
            # Parse JSON from text response
            # Note: In production, this would have proper error handling and validation
            json_str = text.strip()
            # Find JSON content between possible markdown code blocks
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0].strip()
                
            data = json.loads(json_str)
            
            # Format for our API
            return {
                "suggestion_type": "move",
                "target_user_id": user_id,
                "recommendations": data.get("suggestions", []),
                "explanation": "AI-generated placement suggestions based on skills, responsibilities, and organizational structure."
            }
        except Exception as e:
            # In production, this would have better error handling and logging
            return {
                "suggestion_type": "move",
                "target_user_id": user_id,
                "recommendations": [],
                "explanation": f"Error processing AI response: {str(e)}"
            }
    
    def _process_deletion_response(self, response: Dict[str, Any], user_id: int, db: Session) -> Dict[str, Any]:
        """Process and format the AI response for deletion simulation"""
        try:
            # Extract text from Gemini response
            content = response.get("candidates", [{}])[0].get("content", {})
            text = content.get("parts", [{}])[0].get("text", "")
            
            # Parse JSON from text response
            # Note: In production, this would have proper error handling and validation
            json_str = text.strip()
            # Find JSON content between possible markdown code blocks
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0].strip()
                
            data = json.loads(json_str)
            
            # Calculate new stress levels after redistribution
            for redistribution in data.get("redistribution", []):
                user_id = redistribution.get("user_id")
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    new_workload = redistribution.get("new_workload")
                    current_baseline = 40.0  # Standard workweek
                    
                    # Calculate stress intensity based on new workload
                    hours_difference = new_workload - current_baseline
                    if hours_difference <= 4:
                        redistribution["new_stress_intensity"] = "none"
                    elif hours_difference <= 9:
                        redistribution["new_stress_intensity"] = "light-orange"
                    elif hours_difference <= 14:
                        redistribution["new_stress_intensity"] = "orange"
                    elif hours_difference <= 19:
                        redistribution["new_stress_intensity"] = "deep-orange"
                    else:
                        redistribution["new_stress_intensity"] = "red"
            
            # Format for our API
            return {
                "suggestion_type": "delete",
                "target_user_id": user_id,
                "recommendations": data,
                "explanation": "AI-generated workload redistribution plan if this employee leaves the organization."
            }
        except Exception as e:
            # In production, this would have better error handling and logging
            return {
                "suggestion_type": "delete",
                "target_user_id": user_id,
                "recommendations": {
                    "redistribution": [],
                    "critical_gaps": ["Unable to process redistribution due to error"],
                    "need_replacement": True,
                    "replacement_justification": "Error in analysis"
                },
                "explanation": f"Error processing AI response: {str(e)}"
            }

# services/auth_service.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from models import User
from database import get_db
from typing import Optional

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class AuthService:
    @staticmethod
    def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
        """
        Get current user from token
        In a real app, this would validate a JWT token
        For this demo, we'll use a simple token=user_id lookup
        """
        try:
            user_id = int(token)
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return user
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token format",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    @staticmethod
    def validate_top_management(current_user: User = Depends(get_current_user)):
        """Validate that current user is in top management"""
        if not current_user.is_top_management:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Top Management role required"
            )
        return current_user

# middleware/auth_middleware.py
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import jwt
from typing import Optional
import os

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Skip auth for login endpoint
        if request.url.path == "/token" or request.url.path == "/docs" or request.url.path.startswith("/openapi"):
            return await call_next(request)
        
        # Check if this is an OrgSim AI endpoint
        is_org_sim_endpoint = request.url.path.startswith("/api/org-sim")
        
        # Get authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid Authorization header"}
            )
        
        # Extract token
        token = auth_header.split(" ")[1]
        try:
            # In a real app, this would validate a JWT token
            # For this demo, we're using a simplified approach
            user_id = int(token)
            
            # If this is an OrgSim endpoint, check if user is top management
            if is_org_sim_endpoint:
                # In a real app, this would query the database
                # For this demo, we're using a simple check
                is_top_management = user_id in [1, 3]  # Top management user IDs
                if not is_top_management:
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "Access denied: Top Management role required"}
                    )
            
            # Continue with the request
            return await call_next(request)
        except (ValueError, jwt.PyJWTError):
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid token"}
            )

# routers/org_chart.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from database import get_db
from schemas import OrgChart, User as UserSchema
from services.chart_service import ChartService
from services.auth_service import AuthService
from services.ai_suggester import AISuggester

router = APIRouter(prefix="/api/org-sim", tags=["org-chart"])

@router.get("/chart", response_model=OrgChart)
def get_org_chart(
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(AuthService.validate_top_management)
):
    """Get full organizational chart with stress analysis (Top Management only)"""
    return ChartService.build_org_chart(db)

@router.get("/user/{user_id}/suggest-placement", response_model=Dict[str, Any])
def suggest_placement(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(AuthService.validate_top_management)
):
    """Get AI suggestions for better placement of user (Top Management only)"""
    ai_suggester = AISuggester()
    return ai_suggester.suggest_placement(user_id, db)

@router.get("/user/{user_id}/simulate-deletion", response_model=Dict[str, Any])
def simulate_deletion(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(AuthService.validate_top_management)
):
    """Simulate deletion of user and get workload redistribution plan (Top Management only)"""
    ai_suggester = AISuggester()
    return ai_suggester.simulate_deletion(user_id, db)

@router.post("/users/", response_model=User)
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(AuthService.validate_top_management)
):
    """Create a new user/role in the organization."""
    db_user = User(
        name=user.name,
        email=user.email,
        role=user.role,
        tier=user.tier,
        avatar_url=user.avatar_url,
        responsibilities=user.responsibilities,
        skills=user.skills,
        workload_hours=user.workload_hours,
        manager_id=user.manager_id,
        is_top_management=user.is_top_management
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Recalculate stress levels after adding a new user
    WorkloadService.calculate_workload(db_user.id, db)
    
    return db_user

@router.post("/layouts/", response_model=OrganizationLayout)
def create_layout(
    layout: OrganizationLayoutCreate,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(AuthService.validate_top_management)
):
    """Create a new organization layout for modeling"""
    db_layout = OrganizationLayout(
        name=layout.name,
        description=layout.description
    )
    db.add(db_layout)
    db.commit()
    db.refresh(db_layout)
    return db_layout

@router.get("/layouts/{layout_id}", response_model=OrganizationLayout)
def get_layout(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(AuthService.get_current_user)
):
    """Get a specific organization layout"""
    layout = db.query(OrganizationLayout).filter(OrganizationLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")
    return layout

@router.post("/layouts/{layout_id}/nodes/", response_model=LayoutNode)
def add_node_to_layout(
    layout_id: int,
    node: LayoutNodeCreate,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(AuthService.validate_top_management)
):
    """Add a user node to the layout"""
    # Check if layout exists
    layout = db.query(OrganizationLayout).filter(OrganizationLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")
    
    # Check if user exists
    user = db.query(User).filter(User.id == node.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create new node
    db_node = LayoutNode(
        user_id=node.user_id,
        layout_id=layout_id,
        x_position=node.x_position,
        y_position=node.y_position,
        current_workload=user.workload_hours # Initialize with user's workload hours
    )
    db.add(db_node)
    db.commit()
    db.refresh(db_node)
    return db_node

@router.post("/layouts/nodes/{node_id}/position", response_model=Dict[str, Any])
def update_node_position(
    node_id: int,
    position: PositionInfo,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(AuthService.get_current_user)
):
    """Update a node's position in the layout"""
    return WorkloadModelingService.update_node_position(node_id, position, db)

@router.post("/layouts/connections/simulate", response_model=WorkloadImpactAnalysis)
def simulate_connection(
    source_id: int,
    target_id: int,
    connection_type: str = "reporting",
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(AuthService.get_current_user)
):
    """Simulate the impact of adding a connection without saving it"""
    return WorkloadModelingService.simulate_connection_change(source_id, target_id, connection_type, db)

@router.post("/layouts/connections/", response_model=Dict[str, Any])
def create_connection(
    connection: NodeConnectionCreate,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(AuthService.validate_top_management)
):
    """Create a new connection between nodes"""
    return WorkloadModelingService.apply_connection(
        connection.source_id, 
        connection.target_id,
        connection.connection_type,
        db
    )

@router.delete("/layouts/connections/{connection_id}", response_model=Dict[str, Any])
def delete_connection(
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(AuthService.validate_top_management)
):
    """Delete a connection between nodes"""
    return WorkloadModelingService.remove_connection(connection_id, db)

@router.post("/layouts/{layout_id}/initialize", response_model=Dict[str, Any])
def initialize_layout_from_org(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(AuthService.validate_top_management)
):
    """Initialize a layout with all users from the current organization"""
    layout = db.query(OrganizationLayout).filter(OrganizationLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")
    
    # Get all users
    users = db.query(User).all()
    
    # Create a node for each user
    nodes_created = []
    for i, user in enumerate(users):
        # Simple circular layout
        angle = (i / len(users)) * 2 * 3.14159  # Radians
        radius = 300  # Distance from center
        
        # Position in circle, CEO in the middle
        x = radius * math.cos(angle) if user.tier > 1 else 0
        y = radius * math.sin(angle) if user.tier > 1 else 0
        
        # Adjust radius based on tier
        if user.tier > 1:
            x = x * (1 + (user.tier - 1) * 0.3)
            y = y * (1 + (user.tier - 1) * 0.3)
        
        # Create node
        db_node = LayoutNode(
            user_id=user.id,
            layout_id=layout_id,
            x_position=x,
            y_position=y,
            current_workload=user.workload_hours
        )
        db.add(db_node)
        nodes_created.append({
            "user_id": user.id,
            "name": user.name,
            "position": {"x": x, "y": y}
        })
    
    # Create connections based on manager relationships
    connections_created = []
    for user in users:
        if user.manager_id:
            # Find the node IDs
            source_node = db.query(LayoutNode).filter(
                LayoutNode.layout_id == layout_id,
                LayoutNode.user_id == user.id
            ).first()
            
            target_node = db.query(LayoutNode).filter(
                LayoutNode.layout_id == layout_id,
                LayoutNode.user_id == user.manager_id
            ).first()
            
            if source_node and target_node:
                # Calculate workload impact
                workload_impact = min(15, 5 + len(user.responsibilities))
                
                # Create connection
                db_connection = NodeConnection(
                    source_id=source_node.id,
                    target_id=target_node.id,
                    connection_type="reporting",
                    workload_impact=workload_impact
                )
                db.add(db_connection)
                connections_created.append({
                    "source": user.id,
                    "target": user.manager_id,
                    "type": "reporting"
                })
    
    db.commit()
    
    # Update workloads for all nodes
    nodes = db.query(LayoutNode).filter(LayoutNode.layout_id == layout_id).all()
    for node in nodes:
        node.current_workload = WorkloadModelingService.calculate_node_workload(node.id, db)
    
    db.commit()
    
    return {
        "layout_id": layout_id,
        "nodes_created": len(nodes_created),
        "connections_created": len(connections_created),
        "nodes": nodes_created,
        "connections": connections_created
    }

# routers/profile.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from database import get_db
from models import User
from schemas import ResponsibilityUpdate, User as UserSchema
from services.auth_service import AuthService
import google.generative-ai as genai
import os

router = APIRouter(prefix="/api/profile", tags=["profile"])

@router.get("/responsibilities", response_model=List[str])
def get_responsibilities(
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    """Get current user's responsibilities"""
    return current_user.responsibilities

@router.patch("/responsibilities", response_model=Dict[str, Any])
async def update_responsibilities(
    update: ResponsibilityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    """Update user's responsibilities and infer skills"""
    # Update responsibilities
    current_user.responsibilities = update.responsibilities
    
    # Infer skills using Gemini
    inferred_skills = await infer_skills_from_responsibilities(update.responsibilities)
    
    # Merge with existing skills (keeping unique)
    current_skills = set(current_user.skills if current_user.skills else [])
    new_skills = set(inferred_skills)
    all_skills = list(current_skills.union(new_skills))
    
    # Update user
    current_user.skills = all_skills
    db.commit()
    
    # Continuing from routers/profile.py
    async def infer_skills_from_responsibilities(responsibilities: List[str]) -> List[str]:
        """Use Gemini API to infer skills from responsibility descriptions"""
        try:
            # Configure Gemini API
            api_key = os.getenv("GEMINI_API_KEY")
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-pro')
            
            # Create prompt
            responsibilities_text = "\n".join([f"- {r}" for r in responsibilities])
            prompt = f"""
            Based on the following job responsibilities, identify 3-7 core professional skills this person likely possesses.
            Return ONLY a list of skills, with no explanations or additional text.
            
            RESPONSIBILITIES:
            {responsibilities_text}
            
            SKILLS (3-7 items):
            """
            
            # Generate response
            response = model.generate_content(prompt)
            
            # Process response (simple parsing, would be more robust in production)
            skills_text = response.text.strip()
            
            # Extract skills from response (assuming one skill per line, handling bulletpoints)
            skills = []
            for line in skills_text.split('\n'):
                line = line.strip()
                # Remove bullet points or numbers
                if line.startswith('- '):
                    line = line[2:].strip()
                elif line.startswith('* '):
                    line = line[2:].strip()
                elif len(line) > 2 and line[0].isdigit() and line[1] == '.':
                    line = line[2:].strip()
                
                if line and not line.lower().startswith(('skill', 'here')):
                    skills.append(line)
            
            # Limit to 7 skills
            return skills[:7]
        except Exception as e:
            # In production, this would have better error handling and logging
            print(f"Error inferring skills: {str(e)}")
            return []

# routers/simulation.py
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Dict, Any
from database import get_db
from models import User
from schemas import SimulationRequest
from services.auth_service import AuthService
from services.workload_service import WorkloadService
from services.chart_service import ChartService

router = APIRouter(prefix="/api/org-sim/simulations", tags=["simulations"])

@router.post("/", response_model=Dict[str, Any])
def simulate_organization_change(
    simulation: SimulationRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.validate_top_management)
):
    """Simulate organizational changes without committing them (Top Management only)"""
    if simulation.operation == "move":
        return simulate_move(simulation.user_id, simulation.target_manager_id, db)
    elif simulation.operation == "delete":
        return simulate_delete(simulation.user_id, db)
    else:
        raise HTTPException(status_code=400, detail="Invalid operation type")

def simulate_move(user_id: int, target_manager_id: int, db: Session) -> Dict[str, Any]:
    """Simulate moving a user to a new manager"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_manager = db.query(User).filter(User.id == target_manager_id).first()
    if not target_manager:
        raise HTTPException(status_code=404, detail="Target manager not found")
    
    # Check if target manager is in lower tier than user (invalid move)
    if target_manager.tier >= user.tier:
        raise HTTPException(status_code=400, detail="Invalid move: Manager must be in a higher tier")
    
    # Get current org state for comparison
    current_org = ChartService.build_org_chart(db)
    
    # Make a temporary copy of the user's manager_id
    original_manager_id = user.manager_id
    
    # Temporarily update the user's manager
    user.manager_id = target_manager_id
    
    # Get the new org state with the change
    new_org = ChartService.build_org_chart(db)
    
    # Revert the change
    user.manager_id = original_manager_id
    
    # Return the comparison
    return {
        "operation": "move",
        "user_id": user_id,
        "original_manager_id": original_manager_id,
        "new_manager_id": target_manager_id,
        "before": current_org,
        "after": new_org,
        "impact": {
            "affected_users": [user_id, target_manager_id, original_manager_id],
            "stress_changes": compare_stress_zones(current_org.stress_zones, new_org.stress_zones)
        }
    }

def simulate_delete(user_id: int, db: Session) -> Dict[str, Any]:
    """Simulate removing a user from the organization"""
    from services.ai_suggester import AISuggester
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get current org state
    current_org = ChartService.build_org_chart(db)
    
    # Get AI-suggested redistribution plan
    ai_suggester = AISuggester()
    redistribution = ai_suggester.simulate_deletion(user_id, db)
    
    # Calculate affected users
    affected_users = []
    
    # Manager would be affected
    if user.manager_id:
        affected_users.append(user.manager_id)
    
    # Subordinates would be affected
    for subordinate in user.subordinates:
        affected_users.append(subordinate.id)
    
    # Team members on shared projects would be affected
    for project in user.projects:
        for team_member in project.team_members:
            if team_member.id != user_id and team_member.id not in affected_users:
                affected_users.append(team_member.id)
    
    return {
        "operation": "delete",
        "user_id": user_id,
        "affected_users": affected_users,
        "current_org_state": current_org,
        "redistribution_plan": redistribution
    }

def compare_stress_zones(before: Dict[str, list], after: Dict[str, list]) -> Dict[str, Any]:
    """Compare stress zones before and after a change"""
    changes = {}
    
    # Check improvements (users moving to less stressed zones)
    improved = []
    for intensity in ["red", "deep-orange", "orange", "light-orange", "deep-blue", "blue", "light-blue"]:
        for user_id in before.get(intensity, []):
            # If user is in a better zone after the change
            found_in_after = False
            for better_intensity in get_better_intensities(intensity):
                if user_id in after.get(better_intensity, []):
                    improved.append({
                        "user_id": user_id,
                        "from": intensity,
                        "to": better_intensity
                    })
                    found_in_after = True
                    break
            
            # If not found in any better zone, check if still in same zone
            if not found_in_after and user_id in after.get(intensity, []):
                found_in_after = True
                
            # If not found at all, user was deleted or had another change
            
    # Check deteriorations (users moving to more stressed zones)
    deteriorated = []
    for intensity in ["none", "light-blue", "blue", "light-orange", "orange", "deep-orange"]:
        for user_id in before.get(intensity, []):
            # If user is in a worse zone after the change
            found_in_after = False
            for worse_intensity in get_worse_intensities(intensity):
                if user_id in after.get(worse_intensity, []):
                    deteriorated.append({
                        "user_id": user_id,
                        "from": intensity,
                        "to": worse_intensity
                    })
                    found_in_after = True
                    break
            
            # If not found in any worse zone, check if still in same zone
            if not found_in_after and user_id in after.get(intensity, []):
                found_in_after = True
    
    return {
        "improved": improved,
        "deteriorated": deteriorated
    }

def get_better_intensities(intensity: str) -> list:
    """Get stress intensities that are better than the given one"""
    ordered_intensities = [
        "red",
        "deep-orange",
        "orange", 
        "light-orange",
        "none",
        "light-blue",
        "blue",
        "deep-blue"
    ]
    
    try:
        current_index = ordered_intensities.index(intensity)
        # If red or deep-blue (extremes), any movement toward center is better
        if intensity in ["red", "deep-blue"]:
            return ordered_intensities[current_index+1:] if intensity == "red" else ordered_intensities[:current_index]
        # For others, moving toward "none" is better
        elif current_index < ordered_intensities.index("none"):
            return ordered_intensities[current_index+1:ordered_intensities.index("none")+1]
        else:
            return ordered_intensities[ordered_intensities.index("none"):current_index]
    except ValueError:
        return ["none"]  # Default to "none" if intensity not found

def get_worse_intensities(intensity: str) -> list:
    """Get stress intensities that are worse than the given one"""
    ordered_intensities = [
        "red",
        "deep-orange",
        "orange", 
        "light-orange",
        "none",
        "light-blue",
        "blue",
        "deep-blue"
    ]
    
    try:
        current_index = ordered_intensities.index(intensity)
        # Any movement away from "none" is worse
        if intensity == "none":
            return ordered_intensities[:current_index] + ordered_intensities[current_index+1:]
        # For others, moving away from "none" is worse
        elif current_index < ordered_intensities.index("none"):
            return ordered_intensities[:current_index]
        else:
            return ordered_intensities[current_index+1:]
    except ValueError:
        return []  # Empty list if intensity not found

# mock_data.py
from sqlalchemy.orm import Session
from models import User, Project
from datetime import datetime, timedelta
import random

def create_mock_data(db: Session):
    """Create mock data for testing"""
    # Clear existing data
    db.query(User).delete()
    db.query(Project).delete()
    
    # Create projects
    projects = [
        Project(
            name="ERP Migration",
            description="Upgrade enterprise resource planning system to latest version",
            start_date=datetime.now() - timedelta(days=30),
            end_date=datetime.now() + timedelta(days=60),
            estimated_hours=120.0,
            status="active"
        ),
        Project(
            name="Mobile App Development",
            description="Develop new mobile app for field employees",
            start_date=datetime.now() - timedelta(days=15),
            end_date=datetime.now() + timedelta(days=45),
            estimated_hours=80.0,
            status="active"
        ),
        Project(
            name="Cloud Infrastructure",
            description="Migrate on-premises servers to cloud",
            start_date=datetime.now() + timedelta(days=15),
            end_date=datetime.now() + timedelta(days=75),
            estimated_hours=160.0,
            status="planned"
        ),
        Project(
            name="Data Analytics Dashboard",
            description="Create business intelligence dashboard",
            start_date=datetime.now() - timedelta(days=60),
            end_date=datetime.now() - timedelta(days=15),
            estimated_hours=40.0,
            status="completed"
        )
    ]
    
    for project in projects:
        db.add(project)
    
    db.commit()
    
    # Create users
    users = []
    
    # Demo account 1: Top Management with data
    ceo = User(
        name="Alice Johnson",
        email="alice@example.com",
        role="CEO",
        tier=1,
        avatar_url="https://randomuser.me/api/portraits/women/1.jpg",
        responsibilities=["Strategic planning", "Executive leadership", "Board relations", "Company vision"],
        skills=["Leadership", "Strategic thinking", "Decision making", "Communication", "Negotiation"],
        start_date=datetime.now() - timedelta(days=365 * 3),
        workload_hours=50.0,
        is_top_management=True
    )
    users.append(ceo)
    
    # Demo account 2: Top Management without data
    cto = User(
        name="Bob Smith",
        email="bob@example.com",
        role="CTO",
        tier=1,
        avatar_url="https://randomuser.me/api/portraits/men/1.jpg",
        responsibilities=[],
        skills=[],
        start_date=datetime.now() - timedelta(days=365 * 2),
        workload_hours=45.0,
        is_top_management=True
    )
    users.append(cto)
    
    # Demo account 3: Employee (Tier 2) with data
    vp_eng = User(
        name="Carol Williams",
        email="carol@example.com",
        role="VP of Engineering",
        tier=2,
        avatar_url="https://randomuser.me/api/portraits/women/2.jpg",
        responsibilities=["Engineering management", "Product development", "Team leadership", "Tech strategy"],
        skills=["Software development", "Team management", "Agile methodologies", "System architecture"],
        start_date=datetime.now() - timedelta(days=365 * 1.5),
        workload_hours=55.0,
        is_top_management=False
    )
    users.append(vp_eng)
    
    # Demo account 4: Employee (Tier 2) without data
    vp_sales = User(
        name="Dave Brown",
        email="dave@example.com",
        role="VP of Sales",
        tier=2,
        avatar_url="https://randomuser.me/api/portraits/men/2.jpg",
        responsibilities=[],
        skills=[],
        start_date=datetime.now() - timedelta(days=365 * 1),
        workload_hours=48.0,
        is_top_management=False
    )
    users.append(vp_sales)
    
    # Add more employees
    dev_manager = User(
        name="Emma Davis",
        email="emma@example.com",
        role="Development Manager",
        tier=3,
        avatar_url="https://randomuser.me/api/portraits/women/3.jpg",
        responsibilities=["Team management", "Sprint planning", "Code reviews", "Developer mentoring"],
        skills=["JavaScript", "Python", "Team leadership", "Code architecture"],
        start_date=datetime.now() - timedelta(days=300),
        workload_hours=45.0,
        is_top_management=False
    )
    users.append(dev_manager)
    
    sales_manager = User(
        name="Frank Wilson",
        email="frank@example.com",
        role="Sales Manager",
        tier=3,
        avatar_url="https://randomuser.me/api/portraits/men/3.jpg",
        responsibilities=["Sales team leadership", "Territory management", "Pipeline development", "Customer relationships"],
        skills=["Negotiation", "CRM systems", "Sales strategy", "Client management"],
        start_date=datetime.now() - timedelta(days=250),
        workload_hours=42.0,
        is_top_management=False
    )
    users.append(sales_manager)
    
    # Some regular employees (Tier 4)
    for i in range(8):
        gender = "women" if i % 2 == 0 else "men"
        idx = 4 + i // 2
        
        # Overworked, normal, or underworked
        workload_type = i % 3
        if workload_type == 0:  # Overworked
            workload = random.uniform(55.0, 65.0)
        elif workload_type == 1:  # Normal
            workload = random.uniform(38.0, 42.0)
        else:  # Underworked
            workload = random.uniform(25.0, 35.0)
        
        role = "Developer" if i < 4 else "Sales Representative"
        
        employee = User(
            name=f"Employee {i+1}",
            email=f"employee{i+1}@example.com",
            role=role,
            tier=4,
            avatar_url=f"https://randomuser.me/api/portraits/{gender}/{idx}.jpg",
            responsibilities=[f"Responsibility {j+1}" for j in range(random.randint(2, 5))],
            skills=[f"Skill {j+1}" for j in range(random.randint(3, 6))],
            start_date=datetime.now() - timedelta(days=random.randint(30, 700)),
            workload_hours=workload,
            is_top_management=False
        )
        users.append(employee)
    
    # Set reporting relationships
    # CEO is the top
    cto.manager_id = ceo.id
    vp_eng.manager_id = cto.id
    vp_sales.manager_id = ceo.id
    dev_manager.manager_id = vp_eng.id
    sales_manager.manager_id = vp_sales.id
    
    # Assign developers to dev manager, sales reps to sales manager
    for i, employee in enumerate(users[6:]):
        if i < 4:  # First 4 are developers
            employee.manager_id = dev_manager.id
        else:  # Next 4 are sales reps
            employee.manager_id = sales_manager.id
    
    # Add users to database
    for user in users:
        db.add(user)
    
    db.commit()
    
    # Assign projects to users
    projects = db.query(Project).all()
    
    # ERP Migration - Assign to tech team
    projects[0].team_members.append(cto)
    projects[0].team_members.append(vp_eng)
    projects[0].team_members.append(dev_manager)
    for i in range(6, 8):  # Two developers
        projects[0].team_members.append(users[i])
    
    # Mobile App - Assign to dev team
    projects[1].team_members.append(vp_eng)
    projects[1].team_members.append(dev_manager)
    for i in range(6, 10):  # All developers
        projects[1].team_members.append(users[i])
    
    # Cloud Infrastructure - Tech leadership
    projects[2].team_members.append(cto)
    projects[2].team_members.append(vp_eng)
    projects[2].team_members.append(users[6])  # One developer
    
    # Data Analytics - Mixed team
    projects[3].team_members.append(ceo)
    projects[3].team_members.append(vp_sales)
    projects[3].team_members.append(dev_manager)
    projects[3].team_members.append(users[7])  # One developer
    projects[3].team_members.append(users[11])  # One sales rep
    
    db.commit()
    
    return {
        "top_management_with_data": ceo,
        "top_management_without_data": cto,
        "employee_with_data": vp_eng,
        "employee_without_data": vp_sales
    }

# main.py
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from middleware.auth_middleware import AuthMiddleware
from routers import org_chart, profile, simulation
from database import engine, Base, get_db
from sqlalchemy.orm import Session
import models
import mock_data
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(".env.local")

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="OrgSim AI Chart API",
    description="Backend API for AI-powered Organizational Simulator",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, this would be restricted
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add authentication middleware
app.add_middleware(AuthMiddleware)

# Include routers
app.include_router(org_chart.router)
app.include_router(profile.router)
app.include_router(simulation.router)

# For development only - simple token endpoint
@app.post("/token")
def get_token(username: str, password: str, db: Session = Depends(get_db)):
    """
    Simple token endpoint for development
    In production, this would use proper authentication
    """
    # Mock users
    mock_users = {
        "alice": {"id": 1, "role": "top_management"},  # Top Management with data
        "bob": {"id": 2, "role": "top_management"},    # Top Management without data
        "carol": {"id": 3, "role": "employee"},        # Employee with data
        "dave": {"id": 4, "role": "employee"}          # Employee without data
    }
    
    if username in mock_users and password == "password":
        return {
            "access_token": str(mock_users[username]["id"]),
            "token_type": "bearer",
            "user_role": mock_users[username]["role"]
        }
    return {"error": "Invalid credentials"}

# Create mock data on startup
@app.on_event("startup")
def create_initial_data():
    db = SessionLocal()
    try:
        # Check if we have data already
        if db.query(models.User).count() == 0:
            mock_data.create_mock_data(db)
    finally:
        db.close()

# Serve static files (if needed for frontend)
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_root():
    return {
        "message": "OrgSim AI Chart API is running",
        "documentation": "/docs",
        "status": "healthy"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
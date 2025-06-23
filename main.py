from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv
import uvicorn
from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any

# Load environment variables
load_dotenv(".env.local")

# Import the MongoDB adapter
import mongo_adapter

# Import adapted services
from services.auth_service import AuthService
from services.chart_service import ChartService
from services.workload_service import WorkloadService
from services.ai_suggester import AISuggester

# Create FastAPI app
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

# Routes for org-chart
@app.get("/api/org-sim/chart")
async def get_org_chart(current_user: dict = Depends(AuthService.validate_top_management)):
    """Get full organizational chart with stress analysis (Top Management only)"""
    chart_service = ChartService()
    return chart_service.build_org_chart()

@app.get("/api/org-sim/user/{user_id}/suggest-placement")
async def suggest_placement(
    user_id: str,
    current_user: dict = Depends(AuthService.validate_top_management)
):
    """Get AI suggestions for better placement of user (Top Management only)"""
    ai_suggester = AISuggester()
    return await ai_suggester.suggest_placement(user_id)

@app.get("/api/org-sim/user/{user_id}/simulate-deletion")
async def simulate_deletion(
    user_id: str,
    current_user: dict = Depends(AuthService.validate_top_management)
):
    """Simulate deletion of user and get workload redistribution plan (Top Management only)"""
    ai_suggester = AISuggester()
    return await ai_suggester.simulate_deletion(user_id)

# Profile routes
class ResponsibilityUpdate(BaseModel):
    responsibilities: List[str]

@app.get("/api/profile/responsibilities")
async def get_responsibilities(current_user: dict = Depends(AuthService.get_current_user)):
    """Get current user's responsibilities"""
    return current_user.get("responsibilities", [])

@app.patch("/api/profile/responsibilities")
async def update_responsibilities(
    update: ResponsibilityUpdate,
    current_user: dict = Depends(AuthService.get_current_user)
):
    """Update user's responsibilities and infer skills"""
    # Update responsibilities
    mongo_adapter.update_user(
        current_user["id"], 
        {"responsibilities": update.responsibilities}
    )
    
    # Infer skills using AI
    ai_suggester = AISuggester()
    inferred_skills = await ai_suggester.infer_skills_from_responsibilities(update.responsibilities)
    
    # Merge with existing skills (keeping unique)
    current_skills = set(current_user.get("skills", []))
    new_skills = set(inferred_skills)
    all_skills = list(current_skills.union(new_skills))
    
    # Update user skills
    mongo_adapter.update_user(current_user["id"], {"skills": all_skills})
    
    # Get updated user
    updated_user = mongo_adapter.get_user(current_user["id"])
    
    return {
        "responsibilities": updated_user.get("responsibilities", []),
        "skills": updated_user.get("skills", [])
    }

# Simulation routes
class SimulationRequest(BaseModel):
    operation: str  # "move", "delete"
    user_id: str
    target_manager_id: Optional[str] = None  # For move operations

@app.post("/api/org-sim/simulations/")
async def simulate_organization_change(
    simulation: SimulationRequest,
    current_user: dict = Depends(AuthService.validate_top_management)
):
    """Simulate organizational changes without committing them (Top Management only)"""
    if simulation.operation == "move":
        return await simulate_move(simulation.user_id, simulation.target_manager_id)
    elif simulation.operation == "delete":
        return await simulate_delete(simulation.user_id)
    else:
        raise HTTPException(status_code=400, detail="Invalid operation type")

async def simulate_move(user_id: str, target_manager_id: str) -> Dict[str, Any]:
    """Simulate moving a user to a new manager"""
    user = mongo_adapter.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_manager = mongo_adapter.get_user(target_manager_id)
    if not target_manager:
        raise HTTPException(status_code=404, detail="Target manager not found")
    
    # Check if target manager is in lower tier than user (invalid move)
    if target_manager["tier"] >= user["tier"]:
        raise HTTPException(status_code=400, detail="Invalid move: Manager must be in a higher tier")
    
    # Get current org state for comparison
    chart_service = ChartService()
    current_org = chart_service.build_org_chart()
    
    # Make a temporary copy of the user's manager_id
    original_manager_id = user.get("manager_id")
    
    # Temporarily update the user's manager
    mongo_adapter.update_user(user_id, {"manager_id": target_manager_id})
    
    # Get the new org state with the change
    new_org = chart_service.build_org_chart()
    
    # Revert the change
    mongo_adapter.update_user(user_id, {"manager_id": original_manager_id})
    
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
            "stress_changes": compare_stress_zones(current_org["stress_zones"], new_org["stress_zones"])
        }
    }

async def simulate_delete(user_id: str) -> Dict[str, Any]:
    """Simulate removing a user from the organization"""
    user = mongo_adapter.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get current org state
    chart_service = ChartService()
    current_org = chart_service.build_org_chart()
    
    # Get AI-suggested redistribution plan
    ai_suggester = AISuggester()
    redistribution = await ai_suggester.simulate_deletion(user_id)
    
    # Calculate affected users
    affected_users = []
    
    # Manager would be affected
    if user.get("manager_id"):
        affected_users.append(user["manager_id"])
    
    # Subordinates would be affected
    subordinates = mongo_adapter.get_user_by_manager(user["id"])
    for subordinate in subordinates:
        affected_users.append(subordinate["id"])
    
    # Team members on shared projects would be affected
    user_projects = mongo_adapter.get_user_projects(user["id"])
    for project in user_projects:
        project_users = mongo_adapter.get_project_users(project["id"])
        for team_member in project_users:
            if team_member["id"] != user_id and team_member["id"] not in affected_users:
                affected_users.append(team_member["id"])
    
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

# For development only - simple token endpoint
@app.post("/token")
async def get_token(username: str, password: str):
    """
    Simple token endpoint for development
    In production, this would use proper authentication
    """
    # Mock users
    mock_users = {
        "alice": {"id": "1", "role": "top_management"},  # Top Management with data
        "bob": {"id": "2", "role": "top_management"},    # Top Management without data
        "carol": {"id": "3", "role": "employee"},        # Employee with data
        "dave": {"id": "4", "role": "employee"}          # Employee without data
    }
    
    if username in mock_users and password == "password":
        return {
            "access_token": str(mock_users[username]["id"]),
            "token_type": "bearer",
            "user_role": mock_users[username]["role"]
        }
    return {"error": "Invalid credentials"}

# Serve static files (if needed for frontend)
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_root():
    return {
        "message": "OrgSim AI Chart API is running",
        "documentation": "/docs",
        "status": "healthy"
    }

# Create mock data function
def create_mock_data():
    """Create mock data for testing"""
    # Check if we have data already
    users = mongo_adapter.get_users()
    if len(users) > 0:
        return
    
    # Create projects
    projects = [
        {
            "name": "ERP Migration",
            "description": "Upgrade enterprise resource planning system to latest version",
            "start_date": datetime.now().isoformat(),
            "end_date": (datetime.now()).isoformat(),
            "estimated_hours": 120.0,
            "status": "active"
        },
        {
            "name": "Mobile App Development",
            "description": "Develop new mobile app for field employees",
            "start_date": datetime.now().isoformat(),
            "end_date": (datetime.now()).isoformat(),
            "estimated_hours": 80.0,
            "status": "active"
        },
        {
            "name": "Cloud Infrastructure",
            "description": "Migrate on-premises servers to cloud",
            "start_date": datetime.now().isoformat(),
            "end_date": (datetime.now()).isoformat(),
            "estimated_hours": 160.0,
            "status": "planned"
        },
        {
            "name": "Data Analytics Dashboard",
            "description": "Create business intelligence dashboard",
            "start_date": datetime.now().isoformat(),
            "end_date": (datetime.now()).isoformat(),
            "estimated_hours": 40.0,
            "status": "completed"
        }
    ]
    
    project_ids = []
    for project in projects:
        project_id = mongo_adapter.create_project(project)
        project_ids.append(project_id)
    
    # Create users
    users = []
    
    # Demo account 1: Top Management with data
    ceo = {
        "name": "Alice Johnson",
        "email": "alice@example.com",
        "role": "CEO",
        "tier": 1,
        "avatar_url": "https://randomuser.me/api/portraits/women/1.jpg",
        "responsibilities": ["Strategic planning", "Executive leadership", "Board relations", "Company vision"],
        "skills": ["Leadership", "Strategic thinking", "Decision making", "Communication", "Negotiation"],
        "start_date": datetime.now().isoformat(),
        "workload_hours": 50.0,
        "is_top_management": True
    }
    ceo_id = mongo_adapter.create_user(ceo)
    
    # Demo account 2: Top Management without data
    cto = {
        "name": "Bob Smith",
        "email": "bob@example.com",
        "role": "CTO",
        "tier": 1,
        "avatar_url": "https://randomuser.me/api/portraits/men/1.jpg",
        "responsibilities": [],
        "skills": [],
        "start_date": datetime.now().isoformat(),
        "workload_hours": 45.0,
        "is_top_management": True,
        "manager_id": ceo_id
    }
    cto_id = mongo_adapter.create_user(cto)
    
    # Demo account 3: Employee (Tier 2) with data
    vp_eng = {
        "name": "Carol Williams",
        "email": "carol@example.com",
        "role": "VP of Engineering",
        "tier": 2,
        "avatar_url": "https://randomuser.me/api/portraits/women/2.jpg",
        "responsibilities": ["Engineering management", "Product development", "Team leadership", "Tech strategy"],
        "skills": ["Software development", "Team management", "Agile methodologies", "System architecture"],
        "start_date": datetime.now().isoformat(),
        "workload_hours": 55.0,
        "is_top_management": False,
        "manager_id": cto_id
    }
    vp_eng_id = mongo_adapter.create_user(vp_eng)
    
    # Demo account 4: Employee (Tier 2) without data
    vp_sales = {
        "name": "Dave Brown",
        "email": "dave@example.com",
        "role": "VP of Sales",
        "tier": 2,
        "avatar_url": "https://randomuser.me/api/portraits/men/2.jpg",
        "responsibilities": [],
        "skills": [],
        "start_date": datetime.now().isoformat(),
        "workload_hours": 48.0,
        "is_top_management": False,
        "manager_id": ceo_id
    }
    vp_sales_id = mongo_adapter.create_user(vp_sales)
    
    # Add more employees
    dev_manager = {
        "name": "Emma Davis",
        "email": "emma@example.com",
        "role": "Development Manager",
        "tier": 3,
        "avatar_url": "https://randomuser.me/api/portraits/women/3.jpg",
        "responsibilities": ["Team management", "Sprint planning", "Code reviews", "Developer mentoring"],
        "skills": ["JavaScript", "Python", "Team leadership", "Code architecture"],
        "start_date": datetime.now().isoformat(),
        "workload_hours": 45.0,
        "is_top_management": False,
        "manager_id": vp_eng_id
    }
    dev_manager_id = mongo_adapter.create_user(dev_manager)
    
    sales_manager = {
        "name": "Frank Wilson",
        "email": "frank@example.com",
        "role": "Sales Manager",
        "tier": 3,
        "avatar_url": "https://randomuser.me/api/portraits/men/3.jpg",
        "responsibilities": ["Sales team leadership", "Territory management", "Pipeline development", "Customer relationships"],
        "skills": ["Negotiation", "CRM systems", "Sales strategy", "Client management"],
        "start_date": datetime.now().isoformat(),
        "workload_hours": 42.0,
        "is_top_management": False,
        "manager_id": vp_sales_id
    }
    sales_manager_id = mongo_adapter.create_user(sales_manager)
    
    # Some regular employees (Tier 4)
    employee_ids = []
    for i in range(8):
        gender = "women" if i % 2 == 0 else "men"
        idx = 4 + i // 2
        
        # Overworked, normal, or underworked
        workload_type = i % 3
        if workload_type == 0:  # Overworked
            workload = 60.0
        elif workload_type == 1:  # Normal
            workload = 40.0
        else:  # Underworked
            workload = 30.0
        
        role = "Developer" if i < 4 else "Sales Representative"
        manager_id = dev_manager_id if i < 4 else sales_manager_id
        
        employee = {
            "name": f"Employee {i+1}",
            "email": f"employee{i+1}@example.com",
            "role": role,
            "tier": 4,
            "avatar_url": f"https://randomuser.me/api/portraits/{gender}/{idx}.jpg",
            "responsibilities": [f"Responsibility {j+1}" for j in range(3)],
            "skills": [f"Skill {j+1}" for j in range(3)],
            "start_date": datetime.now().isoformat(),
            "workload_hours": workload,
            "is_top_management": False,
            "manager_id": manager_id
        }
        employee_id = mongo_adapter.create_user(employee)
        employee_ids.append(employee_id)
    
    # Assign projects to users
    # ERP Migration - Assign to tech team
    mongo_adapter.add_user_to_project(cto_id, project_ids[0])
    mongo_adapter.add_user_to_project(vp_eng_id, project_ids[0])
    mongo_adapter.add_user_to_project(dev_manager_id, project_ids[0])
    for i in range(2):  # Two developers
        mongo_adapter.add_user_to_project(employee_ids[i], project_ids[0])
    
    # Mobile App - Assign to dev team
    mongo_adapter.add_user_to_project(vp_eng_id, project_ids[1])
    mongo_adapter.add_user_to_project(dev_manager_id, project_ids[1])
    for i in range(4):  # All developers
        mongo_adapter.add_user_to_project(employee_ids[i], project_ids[1])
    
    # Cloud Infrastructure - Tech leadership
    mongo_adapter.add_user_to_project(cto_id, project_ids[2])
    mongo_adapter.add_user_to_project(vp_eng_id, project_ids[2])
    mongo_adapter.add_user_to_project(employee_ids[0], project_ids[2])  # One developer
    
    # Data Analytics - Mixed team
    mongo_adapter.add_user_to_project(ceo_id, project_ids[3])
    mongo_adapter.add_user_to_project(vp_sales_id, project_ids[3])
    mongo_adapter.add_user_to_project(dev_manager_id, project_ids[3])
    mongo_adapter.add_user_to_project(employee_ids[1], project_ids[3])  # One developer
    mongo_adapter.add_user_to_project(employee_ids[5], project_ids[3])  # One sales rep
    
    return {
        "top_management_with_data": ceo_id,
        "top_management_without_data": cto_id,
        "employee_with_data": vp_eng_id,
        "employee_without_data": vp_sales_id
    }

# Create mock data on startup
@app.on_event("startup")
async def startup_event():
    create_mock_data()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 
import os
import pandas as pd
from pymongo import MongoClient
from typing import List, Dict, Any

class GalaxyDataProvider:
    def __init__(self, mongodb_uri: str = None):
        # Use environment variable if no URI provided
        self.mongodb_uri = mongodb_uri or os.getenv('MONGODB_URI')
        if not self.mongodb_uri:
            raise ValueError("MongoDB URI not provided and not found in environment")
        
        self.client = MongoClient(self.mongodb_uri)
        self.db = self.client.organization_db

    def load_mock_data(self, org_file: str, collab_file: str) -> None:
        """Load mock data from CSV files into MongoDB"""
        # Read CSV files
        org_df = pd.read_csv(org_file)
        collab_df = pd.read_csv(collab_file)
        
        # Convert DataFrames to lists of dictionaries
        employees = org_df.to_dict('records')
        collaborations = collab_df.to_dict('records')
        
        # Clear existing collections
        self.db.employees.delete_many({})
        self.db.collaborations.delete_many({})
        
        # Insert new data
        if employees:
            self.db.employees.insert_many(employees)
        if collaborations:
            self.db.collaborations.insert_many(collaborations)

    def get_galaxy_data(self) -> Dict[str, Any]:
        """Get all data needed for galaxy visualization"""
        # Get all employees
        employees = list(self.db.employees.find({}, {'_id': 0}))
        
        # Get all collaborations
        collaborations = list(self.db.collaborations.find({}, {'_id': 0}))
        
        # Get unique departments
        departments = list(set(emp['department'] for emp in employees if 'department' in emp))
        
        # Create department nodes (suns)
        nodes = []
        for dept in departments:
            nodes.append({
                'id': f'dept_{dept}',
                'name': dept,
                'type': 'department',
                'size': 5.0,  # Larger size for departments
                'color': '#ffff00'  # Yellow for sun-like appearance
            })
        
        # Add employee nodes (planets)
        for emp in employees:
            nodes.append({
                'id': emp['id'],
                'name': emp['name'],
                'department': emp['department'],
                'role': emp.get('role', ''),
                'type': 'employee',
                'size': 2.0,  # Smaller size for employees
                'color': '#00ffff'  # Cyan for planet-like appearance
            })
        
        # Create links
        links = []
        
        # Department-Employee links
        for emp in employees:
            links.append({
                'source': f'dept_{emp["department"]}',
                'target': emp['id'],
                'type': 'hierarchy',
                'value': 1
            })
        
        # Collaboration links
        for collab in collaborations:
            links.append({
                'source': collab['employee1_id'],
                'target': collab['employee2_id'],
                'type': 'collaboration',
                'project': collab['project_name'],
                'value': 0.5
            })
        
        return {
            'nodes': nodes,
            'links': links
        }

    def get_employee_details(self, employee_id: str) -> Dict[str, Any]:
        """Get detailed information about an employee"""
        employee = self.db.employees.find_one({'id': employee_id}, {'_id': 0})
        if not employee:
            return None
        
        # Get collaborations for this employee
        collaborations = list(self.db.collaborations.find({
            '$or': [
                {'employee1_id': employee_id},
                {'employee2_id': employee_id}
            ]
        }, {'_id': 0}))
        
        # Add collaborations to employee details
        employee['collaborations'] = collaborations
        
        return employee

    def search_employees(self, query: str) -> List[Dict[str, Any]]:
        """Search employees by name"""
        return list(self.db.employees.find({
            'name': {'$regex': query, '$options': 'i'}
        }, {'_id': 0}))

    def filter_by_department(self, department: str) -> List[Dict[str, Any]]:
        """Filter employees by department"""
        return list(self.db.employees.find({
            'department': department
        }, {'_id': 0}))

# FastAPI endpoints
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize data provider
data_provider = GalaxyDataProvider()

@app.get("/api/galaxy/data")
async def get_galaxy_data():
    try:
        return data_provider.get_galaxy_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/galaxy/employee/{employee_id}")
async def get_employee_details(employee_id: str):
    try:
        employee = data_provider.get_employee_details(employee_id)
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        return employee
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/galaxy/search")
async def search_employees(q: str):
    try:
        return data_provider.search_employees(q)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/galaxy/department/{department}")
async def filter_by_department(department: str):
    try:
        return data_provider.filter_by_department(department)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/galaxy/load-mock-data")
async def load_mock_data(org_file: str, collab_file: str):
    try:
        data_provider.load_mock_data(org_file, collab_file)
        return {"message": "Mock data loaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 
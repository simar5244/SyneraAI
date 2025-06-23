import os
import sys
import dotenv
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, HTTPException, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from src.api.galaxy.data import GalaxyDataProvider, app as galaxy_app

# Load environment variables from .env file if it exists
dotenv.load_dotenv()

# Set default MongoDB URI if not provided
if not os.getenv("MONGODB_URI"):
    # For local development, use a MongoDB connection string
    os.environ["MONGODB_URI"] = "mongodb://localhost:27017/"
    print("Using default MongoDB URI: mongodb://localhost:27017/")

# Mount the galaxy app under the main app
app = FastAPI(title="Organization Galaxy API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the galaxy API
app.mount("/api/galaxy", galaxy_app)

# Initialize data provider directly for initial data loading
data_provider = GalaxyDataProvider()

@app.on_event("startup")
async def startup_db_client():
    """Load mock data on startup if requested"""
    try:
        # Check if mock data should be loaded
        if "--load-mock-data" in sys.argv:
            print("Loading mock data from CSV files...")
            org_file = "mock_organization_large.csv"
            collab_file = "mock_projects_collaborations.csv"
            
            # Validate file paths
            if not os.path.exists(org_file):
                print(f"Error: {org_file} not found")
                sys.exit(1)
            if not os.path.exists(collab_file):
                print(f"Error: {collab_file} not found")
                sys.exit(1)
                
            data_provider.load_mock_data(org_file, collab_file)
            print("Mock data loaded successfully!")
    except Exception as e:
        print(f"Error loading mock data: {str(e)}")
        sys.exit(1)

@app.get("/")
async def root():
    return {"message": "Organization Galaxy API is running"}

if __name__ == "__main__":
    import uvicorn
    
    # Print instructions
    print("\nOrganization Galaxy Backend")
    print("==========================")
    print("This server provides the backend API for the Organization Galaxy visualization.")
    print("The frontend should connect to http://localhost:8000/api/galaxy/data")
    print("\nAvailable endpoints:")
    print("  - GET /api/galaxy/data - Get all galaxy data")
    print("  - GET /api/galaxy/employee/{employee_id} - Get employee details")
    print("  - GET /api/galaxy/search?q={query} - Search employees by name")
    print("  - GET /api/galaxy/department/{department} - Filter employees by department")
    print("\nPress Ctrl+C to stop the server")
    
    uvicorn.run(app, host="0.0.0.0", port=8000) 
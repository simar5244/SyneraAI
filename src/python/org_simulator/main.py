from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict

from .database import engine, Base, get_db
from .auth import get_current_user, get_current_active_user
from .routes import layouts, roles, connections, simulations, analysis

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Organization Simulator API",
    description="API for simulating and analyzing organizational structures",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with prefixes
app.include_router(
    layouts.router, 
    prefix="/api/layouts", 
    tags=["Layouts"]
)

app.include_router(
    roles.router, 
    prefix="/api/roles", 
    tags=["Roles"]
)

app.include_router(
    connections.router, 
    prefix="/api/connections", 
    tags=["Connections"]
)

app.include_router(
    simulations.router, 
    prefix="/api/simulations", 
    tags=["Simulations"]
)

app.include_router(
    analysis.router, 
    prefix="/api/analysis", 
    tags=["Analysis"]
)

@app.get("/", tags=["Root"])
async def read_root() -> Dict[str, str]:
    """
    Root endpoint that returns API information
    """
    return {
        "message": "Welcome to the Organization Simulator API",
        "docs": "/docs",
        "version": "1.0.0"
    }

@app.get("/health", tags=["Health"])
async def health_check() -> Dict[str, str]:
    """
    Health check endpoint
    """
    return {"status": "healthy"}

@app.get("/api/me", tags=["User"])
async def get_current_user_info(current_user = Depends(get_current_active_user)):
    """
    Get current user information
    """
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum

# Enums
class ActionType(str, Enum):
    CREATE_ROLE = "create_role"
    DELETE_ROLE = "delete_role"
    CONNECT = "connect"
    DISCONNECT = "disconnect"
    MOVE = "move"

class HeatmapStatus(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"
    DEEP_RED = "deep_red"

# Base schemas
class RoleBase(BaseModel):
    title: str
    description: Optional[str] = None
    skills_required: List[str] = Field(default_factory=list)
    responsibilities: List[str] = Field(default_factory=list)
    projects: List[str] = Field(default_factory=list)
    workload_hours: float = 40.0
    position_x: float = 0
    position_y: float = 0

class ConnectionBase(BaseModel):
    from_role_id: int
    to_role_id: int
    slot_used: int = Field(..., ge=1, le=3)  # Must be 1, 2, or 3
    
    @validator('slot_used')
    def validate_slot(cls, v):
        if v not in [1, 2, 3]:
            raise ValueError('slot_used must be 1, 2, or 3')
        return v

class LayoutBase(BaseModel):
    name: str
    description: Optional[str] = None

# Create schemas
class RoleCreate(RoleBase):
    layout_id: int

class ConnectionCreate(ConnectionBase):
    layout_id: int

class LayoutCreate(LayoutBase):
    pass

# Update schemas
class RoleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    skills_required: Optional[List[str]] = None
    responsibilities: Optional[List[str]] = None
    projects: Optional[List[str]] = None
    workload_hours: Optional[float] = None
    intensity_factor: Optional[float] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None

class ConnectionUpdate(BaseModel):
    slot_used: Optional[int] = Field(None, ge=1, le=3)
    
    @validator('slot_used')
    def validate_slot(cls, v):
        if v is not None and v not in [1, 2, 3]:
            raise ValueError('slot_used must be 1, 2, or 3')
        return v

class LayoutUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

# Response schemas
class RoleResponse(RoleBase):
    id: int
    layout_id: int
    intensity_factor: float
    created_at: datetime
    updated_at: Optional[datetime] = None
    heatmap_status: HeatmapStatus
    total_workload: float
    
    class Config:
        orm_mode = True

class ConnectionResponse(ConnectionBase):
    id: int
    layout_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True

class LayoutResponse(LayoutBase):
    id: int
    created_by: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True

class LayoutDetailResponse(LayoutResponse):
    roles: List[RoleResponse] = []
    connections: List[ConnectionResponse] = []
    
    class Config:
        orm_mode = True

# Canvas schemas
class CanvasState(BaseModel):
    layout: LayoutResponse
    roles: List[RoleResponse]
    connections: List[ConnectionResponse]

class RolePosition(BaseModel):
    x: float
    y: float

class RoleMoveRequest(BaseModel):
    position: RolePosition

# Simulation schemas
class SimulationChange(BaseModel):
    action_type: ActionType
    role_id: Optional[int] = None
    from_role_id: Optional[int] = None
    to_role_id: Optional[int] = None
    slot_used: Optional[int] = None
    new_position: Optional[RolePosition] = None

class SimulationRequest(BaseModel):
    layout_id: int
    changes: List[SimulationChange]

class SimulationResult(BaseModel):
    layout_id: int
    roles: List[RoleResponse]
    connections: List[ConnectionResponse]
    pros: List[str]
    cons: List[str]
    workload_impact: Dict[int, float]  # role_id -> workload change

# Action log schemas
class ActionLogResponse(BaseModel):
    id: int
    layout_id: int
    action_type: ActionType
    action_data: Dict[str, Any]
    performed_by: int
    created_at: datetime
    
    class Config:
        orm_mode = True 
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union, Literal
from datetime import datetime


class PositionInfo(BaseModel):
    """Position information for a node in the layout"""
    x: float = Field(default=0.0, description="X-coordinate of the node")
    y: float = Field(default=0.0, description="Y-coordinate of the node")


# Organization Layout Schemas
class OrganizationLayoutBase(BaseModel):
    """Base schema for organization layout"""
    name: str = Field(..., description="Name of the organization layout")
    description: Optional[str] = Field(None, description="Description of the layout")
    is_active: bool = Field(True, description="Whether the layout is currently active")


class OrganizationLayoutCreate(OrganizationLayoutBase):
    """Schema for creating a new organization layout"""
    pass


class OrganizationLayout(OrganizationLayoutBase):
    """Schema for organization layout response"""
    id: int = Field(..., description="Unique identifier for the layout")
    created_at: datetime = Field(..., description="Timestamp when the layout was created")
    updated_at: datetime = Field(..., description="Timestamp when the layout was last updated")

    class Config:
        orm_mode = True


# Layout Node Schemas
class LayoutNodeBase(BaseModel):
    """Base schema for layout node"""
    user_id: int = Field(..., description="User ID assigned to this node")
    position: PositionInfo = Field(default_factory=PositionInfo, description="Position coordinates of the node")
    current_workload: float = Field(default=40.0, description="Current workload in hours per week")
    node_metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict, 
        description="Additional metadata for the node (job title, department, etc.)"
    )


class LayoutNodeCreate(LayoutNodeBase):
    """Schema for creating a new layout node"""
    layout_id: int = Field(..., description="ID of the layout this node belongs to")


class LayoutNode(LayoutNodeBase):
    """Schema for layout node response"""
    id: int = Field(..., description="Unique identifier for the node")
    layout_id: int = Field(..., description="ID of the layout this node belongs to")

    class Config:
        orm_mode = True


# Node Connection Schemas
class NodeConnectionBase(BaseModel):
    """Base schema for node connection"""
    source_id: int = Field(..., description="ID of the source node")
    target_id: int = Field(..., description="ID of the target node")
    connection_type: str = Field(
        default="reporting", 
        description="Type of connection between nodes (reporting, delegation, collaboration)"
    )
    workload_impact: float = Field(
        default=0.0, 
        description="Impact of this connection on workload (in hours per week)"
    )
    connection_metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict, 
        description="Additional metadata for the connection"
    )

    @validator('connection_type')
    def validate_connection_type(cls, v):
        valid_types = ["reporting", "delegation", "collaboration"]
        if v not in valid_types:
            raise ValueError(f"Connection type must be one of: {', '.join(valid_types)}")
        return v


class NodeConnectionCreate(NodeConnectionBase):
    """Schema for creating a new node connection"""
    layout_id: int = Field(..., description="ID of the layout this connection belongs to")


class NodeConnection(NodeConnectionBase):
    """Schema for node connection response"""
    id: int = Field(..., description="Unique identifier for the connection")
    layout_id: int = Field(..., description="ID of the layout this connection belongs to")

    class Config:
        orm_mode = True


# Workload Impact Analysis Schema
class WorkloadChange(BaseModel):
    """Schema for workload change analysis"""
    node_id: int = Field(..., description="ID of the node affected by the change")
    user_id: int = Field(..., description="User ID of the affected node")
    current_workload: float = Field(..., description="Current workload before changes")
    new_workload: float = Field(..., description="New workload after changes")
    percent_change: float = Field(..., description="Percentage change in workload")
    impact_level: Literal["low", "moderate", "high"] = Field(
        ..., 
        description="Impact level based on percentage change"
    )


class WorkloadImpactAnalysis(BaseModel):
    """Schema for analyzing workload impact of organizational changes"""
    changes: List[WorkloadChange] = Field(..., description="List of workload changes")
    total_workload_before: float = Field(..., description="Total workload before changes")
    total_workload_after: float = Field(..., description="Total workload after changes")
    total_percent_change: float = Field(..., description="Overall percentage change in workload")
    pros: List[str] = Field(default_factory=list, description="Benefits of the changes")
    cons: List[str] = Field(default_factory=list, description="Drawbacks of the changes")


# Complete Organization Layout Schema (with nodes and connections)
class OrganizationLayoutFull(OrganizationLayout):
    """Full organization layout with nodes and connections"""
    nodes: List[LayoutNode] = Field(default_factory=list, description="Nodes in the layout")
    connections: List[NodeConnection] = Field(default_factory=list, description="Connections between nodes")

    class Config:
        orm_mode = True 
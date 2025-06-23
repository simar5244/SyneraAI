from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from .database import get_db
from .org_modeling_models import OrganizationLayout, LayoutNode, NodeConnection
from .org_modeling_schemas import (
    OrganizationLayoutCreate, OrganizationLayout as LayoutSchema, 
    OrganizationLayoutFull, LayoutNodeCreate, LayoutNode as NodeSchema,
    NodeConnectionCreate, NodeConnection as ConnectionSchema,
    WorkloadImpactAnalysis, WorkloadChange
)

router = APIRouter(prefix="/api/org-modeling", tags=["org-modeling"])


# Pydantic models for request/response validation
class OrganizationLayoutBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True

class OrganizationLayoutCreate(OrganizationLayoutBase):
    pass

class OrganizationLayoutResponse(OrganizationLayoutBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class LayoutNodeBase(BaseModel):
    layout_id: int
    user_id: Optional[int] = None
    position_x: float = 0
    position_y: float = 0
    current_workload: float = 0
    node_metadata: Optional[Dict[str, Any]] = None

class LayoutNodeCreate(LayoutNodeBase):
    pass

class LayoutNodeResponse(LayoutNodeBase):
    id: int

    class Config:
        orm_mode = True

class NodeConnectionBase(BaseModel):
    layout_id: int
    source_id: int
    target_id: int
    connection_type: str = "reports_to"
    workload_impact: float = 0
    connection_metadata: Optional[Dict[str, Any]] = None

class NodeConnectionCreate(NodeConnectionBase):
    pass

class NodeConnectionResponse(NodeConnectionBase):
    id: int

    class Config:
        orm_mode = True

class WorkloadAnalysisResponse(BaseModel):
    node_id: int
    before_workload: float
    after_workload: float
    workload_change: float
    pros: List[str]
    cons: List[str]


# Organization Layout endpoints
@router.post("/layouts", response_model=OrganizationLayoutResponse, status_code=status.HTTP_201_CREATED)
def create_organization_layout(layout: OrganizationLayoutCreate, db: Session = Depends(get_db)):
    """Create a new organization layout"""
    db_layout = OrganizationLayout(**layout.dict())
    db.add(db_layout)
    db.commit()
    db.refresh(db_layout)
    return db_layout

@router.get("/layouts", response_model=List[OrganizationLayoutResponse])
def get_organization_layouts(skip: int = 0, limit: int = 100, is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    """Get all organization layouts with optional filtering"""
    query = db.query(OrganizationLayout)
    if is_active is not None:
        query = query.filter(OrganizationLayout.is_active == is_active)
    return query.offset(skip).limit(limit).all()

@router.get("/layouts/{layout_id}", response_model=OrganizationLayoutResponse)
def get_organization_layout(layout_id: int, db: Session = Depends(get_db)):
    """Get a specific organization layout by ID"""
    db_layout = db.query(OrganizationLayout).filter(OrganizationLayout.id == layout_id).first()
    if not db_layout:
        raise HTTPException(status_code=404, detail="Organization layout not found")
    return db_layout

@router.put("/layouts/{layout_id}", response_model=OrganizationLayoutResponse)
def update_organization_layout(layout_id: int, layout: OrganizationLayoutCreate, db: Session = Depends(get_db)):
    """Update an existing organization layout"""
    db_layout = db.query(OrganizationLayout).filter(OrganizationLayout.id == layout_id).first()
    if not db_layout:
        raise HTTPException(status_code=404, detail="Organization layout not found")
    
    for key, value in layout.dict().items():
        setattr(db_layout, key, value)
    
    db.commit()
    db.refresh(db_layout)
    return db_layout

@router.delete("/layouts/{layout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization_layout(layout_id: int, db: Session = Depends(get_db)):
    """Delete an organization layout and its associated nodes and connections"""
    db_layout = db.query(OrganizationLayout).filter(OrganizationLayout.id == layout_id).first()
    if not db_layout:
        raise HTTPException(status_code=404, detail="Organization layout not found")
    
    db.delete(db_layout)
    db.commit()
    return None

# Layout Node endpoints
@router.post("/nodes", response_model=LayoutNodeResponse, status_code=status.HTTP_201_CREATED)
def create_layout_node(node: LayoutNodeCreate, db: Session = Depends(get_db)):
    """Create a new node in an organization layout"""
    # Verify layout exists
    layout = db.query(OrganizationLayout).filter(OrganizationLayout.id == node.layout_id).first()
    if not layout:
        raise HTTPException(status_code=404, detail="Organization layout not found")
    
    db_node = LayoutNode(**node.dict())
    db.add(db_node)
    db.commit()
    db.refresh(db_node)
    return db_node

@router.get("/layouts/{layout_id}/nodes", response_model=List[LayoutNodeResponse])
def get_layout_nodes(layout_id: int, db: Session = Depends(get_db)):
    """Get all nodes for a specific layout"""
    # Verify layout exists
    layout = db.query(OrganizationLayout).filter(OrganizationLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(status_code=404, detail="Organization layout not found")
    
    return db.query(LayoutNode).filter(LayoutNode.layout_id == layout_id).all()

@router.put("/nodes/{node_id}", response_model=LayoutNodeResponse)
def update_layout_node(node_id: int, node: LayoutNodeCreate, db: Session = Depends(get_db)):
    """Update an existing node"""
    db_node = db.query(LayoutNode).filter(LayoutNode.id == node_id).first()
    if not db_node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    for key, value in node.dict().items():
        setattr(db_node, key, value)
    
    db.commit()
    db.refresh(db_node)
    return db_node

@router.delete("/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_layout_node(node_id: int, db: Session = Depends(get_db)):
    """Delete a node from the organization layout"""
    db_node = db.query(LayoutNode).filter(LayoutNode.id == node_id).first()
    if not db_node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    db.delete(db_node)
    db.commit()
    return None

# Node Connection endpoints
@router.post("/connections", response_model=NodeConnectionResponse, status_code=status.HTTP_201_CREATED)
def create_node_connection(connection: NodeConnectionCreate, db: Session = Depends(get_db)):
    """Create a new connection between nodes"""
    # Verify layout exists
    layout = db.query(OrganizationLayout).filter(OrganizationLayout.id == connection.layout_id).first()
    if not layout:
        raise HTTPException(status_code=404, detail="Organization layout not found")
    
    # Verify source and target nodes exist
    source_node = db.query(LayoutNode).filter(LayoutNode.id == connection.source_id).first()
    if not source_node:
        raise HTTPException(status_code=404, detail="Source node not found")
    
    target_node = db.query(LayoutNode).filter(LayoutNode.id == connection.target_id).first()
    if not target_node:
        raise HTTPException(status_code=404, detail="Target node not found")
    
    db_connection = NodeConnection(**connection.dict())
    db.add(db_connection)
    db.commit()
    db.refresh(db_connection)
    return db_connection

@router.get("/layouts/{layout_id}/connections", response_model=List[NodeConnectionResponse])
def get_layout_connections(layout_id: int, db: Session = Depends(get_db)):
    """Get all connections for a specific layout"""
    # Verify layout exists
    layout = db.query(OrganizationLayout).filter(OrganizationLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(status_code=404, detail="Organization layout not found")
    
    return db.query(NodeConnection).filter(NodeConnection.layout_id == layout_id).all()

@router.put("/connections/{connection_id}", response_model=NodeConnectionResponse)
def update_node_connection(connection_id: int, connection: NodeConnectionCreate, db: Session = Depends(get_db)):
    """Update an existing connection"""
    db_connection = db.query(NodeConnection).filter(NodeConnection.id == connection_id).first()
    if not db_connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    for key, value in connection.dict().items():
        setattr(db_connection, key, value)
    
    db.commit()
    db.refresh(db_connection)
    return db_connection

@router.delete("/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_node_connection(connection_id: int, db: Session = Depends(get_db)):
    """Delete a connection between nodes"""
    db_connection = db.query(NodeConnection).filter(NodeConnection.id == connection_id).first()
    if not db_connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    db.delete(db_connection)
    db.commit()
    return None

# Workload Analysis endpoint
@router.get("/layouts/{layout_id}/workload-analysis", response_model=List[WorkloadAnalysisResponse])
def analyze_layout_workload(layout_id: int, db: Session = Depends(get_db)):
    """Analyze workload impact for all nodes in a layout"""
    # Verify layout exists
    layout = db.query(OrganizationLayout).filter(OrganizationLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(status_code=404, detail="Organization layout not found")
    
    # Get all nodes and connections for this layout
    nodes = db.query(LayoutNode).filter(LayoutNode.layout_id == layout_id).all()
    connections = db.query(NodeConnection).filter(NodeConnection.layout_id == layout_id).all()
    
    # Calculate workload impact for each node
    result = []
    for node in nodes:
        # Get incoming connections (reports to this node)
        incoming = [c for c in connections if c.target_id == node.id]
        
        # Get outgoing connections (this node reports to)
        outgoing = [c for c in connections if c.source_id == node.id]
        
        # Calculate total workload based on connections
        before_workload = node.current_workload
        
        # Simple workload calculation: 
        # - Each direct report adds workload (incoming connections)
        # - Each manager slightly reduces workload (outgoing connections)
        workload_change = sum(c.workload_impact for c in incoming) - (len(outgoing) * 2 if len(outgoing) > 0 else 0)
        after_workload = before_workload + workload_change
        
        # Generate pros and cons based on analysis
        pros = []
        cons = []
        
        if workload_change > 0:
            if workload_change > 10:
                cons.append("Significant increase in workload may lead to burnout")
            else:
                pros.append("Moderate increase in responsibilities can lead to growth")
        else:
            if workload_change < -10:
                pros.append("Significant reduction in workload may improve focus")
            else:
                pros.append("Slight reduction in workload may improve work-life balance")
        
        if len(incoming) > 5:
            cons.append(f"Managing {len(incoming)} direct reports may be challenging")
        elif 3 <= len(incoming) <= 5:
            pros.append(f"Optimal span of control with {len(incoming)} direct reports")
        
        result.append(
            WorkloadAnalysisResponse(
                node_id=node.id,
                before_workload=before_workload,
                after_workload=after_workload,
                workload_change=workload_change,
                pros=pros,
                cons=cons
            )
        )
    
    return result 
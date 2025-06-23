from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import math

from database import get_db
from org_modeling_schemas import (
    OrganizationLayoutCreate, 
    OrganizationLayout,
    LayoutNodeCreate,
    LayoutNode,
    NodeConnectionCreate,
    NodeConnection,
    PositionInfo,
    WorkloadImpactAnalysis
)
from org_modeling_models import OrganizationLayout as DBOrganizationLayout
from org_modeling_models import LayoutNode as DBLayoutNode
from org_modeling_models import NodeConnection as DBNodeConnection
from user_models import User
from workload_modeling_service import WorkloadModelingService

router = APIRouter(prefix="/api/org-modeling", tags=["organization-modeling"])

@router.post("/layouts", response_model=OrganizationLayout)
def create_layout(layout: OrganizationLayoutCreate, db: Session = Depends(get_db)):
    """Create a new organization layout"""
    db_layout = DBOrganizationLayout(
        name=layout.name,
        description=layout.description,
        is_active=True
    )
    db.add(db_layout)
    db.commit()
    db.refresh(db_layout)
    return db_layout

@router.get("/layouts/{layout_id}", response_model=OrganizationLayout)
def get_layout(layout_id: int, db: Session = Depends(get_db)):
    """Get a specific layout by ID"""
    layout = db.query(DBOrganizationLayout).filter(DBOrganizationLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")
    return layout

@router.post("/layouts/{layout_id}/nodes", response_model=LayoutNode)
def add_node_to_layout(
    layout_id: int, 
    node: LayoutNodeCreate, 
    db: Session = Depends(get_db)
):
    """Add a user node to a layout"""
    # Check if layout exists
    layout = db.query(DBOrganizationLayout).filter(DBOrganizationLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")
    
    # Check if user exists
    user = db.query(User).filter(User.id == node.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create new node
    db_node = DBLayoutNode(
        layout_id=layout_id,
        user_id=node.user_id,
        x_position=node.position.x if node.position else 0,
        y_position=node.position.y if node.position else 0,
        current_workload=user.workload_hours  # Initial workload based on user's hours
    )
    db.add(db_node)
    db.commit()
    db.refresh(db_node)
    return db_node

@router.post("/layouts/{layout_id}/nodes/{node_id}/position")
def update_node_position(
    layout_id: int,
    node_id: int,
    position: PositionInfo,
    db: Session = Depends(get_db)
):
    """Update a node's position in the layout"""
    # Verify the node exists and belongs to the layout
    node = db.query(DBLayoutNode).filter(
        DBLayoutNode.id == node_id,
        DBLayoutNode.layout_id == layout_id
    ).first()
    
    if not node:
        raise HTTPException(status_code=404, detail="Node not found in this layout")
    
    # Update the position using the service
    try:
        result = WorkloadModelingService.update_node_position(node_id, position, db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/layouts/{layout_id}/simulate-connection", response_model=WorkloadImpactAnalysis)
def simulate_connection(
    layout_id: int,
    source_id: int,
    target_id: int,
    connection_type: str,
    db: Session = Depends(get_db)
):
    """Simulate the impact of adding a connection without saving it"""
    # Verify the nodes exist and belong to the layout
    source_node = db.query(DBLayoutNode).filter(
        DBLayoutNode.id == source_id,
        DBLayoutNode.layout_id == layout_id
    ).first()
    
    target_node = db.query(DBLayoutNode).filter(
        DBLayoutNode.id == target_id,
        DBLayoutNode.layout_id == layout_id
    ).first()
    
    if not source_node or not target_node:
        raise HTTPException(status_code=404, detail="Source or target node not found in this layout")
    
    # Validate connection type
    if connection_type not in ["reporting", "delegation", "collaboration"]:
        raise HTTPException(status_code=400, detail="Invalid connection type")
    
    # Simulate the connection
    try:
        impact = WorkloadModelingService.simulate_connection_change(
            source_id, target_id, connection_type, db
        )
        return impact
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/layouts/{layout_id}/connections")
def create_connection(
    layout_id: int,
    connection: NodeConnectionCreate,
    db: Session = Depends(get_db)
):
    """Create a new connection between nodes"""
    # Verify the nodes exist and belong to the layout
    source_node = db.query(DBLayoutNode).filter(
        DBLayoutNode.id == connection.source_id,
        DBLayoutNode.layout_id == layout_id
    ).first()
    
    target_node = db.query(DBLayoutNode).filter(
        DBLayoutNode.id == connection.target_id,
        DBLayoutNode.layout_id == layout_id
    ).first()
    
    if not source_node or not target_node:
        raise HTTPException(status_code=404, detail="Source or target node not found in this layout")
    
    # Validate connection type
    if connection.connection_type not in ["reporting", "delegation", "collaboration"]:
        raise HTTPException(status_code=400, detail="Invalid connection type")
    
    # Create or update the connection
    try:
        result = WorkloadModelingService.apply_connection(
            connection.source_id, 
            connection.target_id, 
            connection.connection_type,
            db
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/layouts/{layout_id}/connections/{connection_id}")
def delete_connection(
    layout_id: int,
    connection_id: int,
    db: Session = Depends(get_db)
):
    """Remove a connection between nodes"""
    # Verify the connection exists
    connection = db.query(DBNodeConnection).filter(DBNodeConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Verify the source and target nodes belong to the layout
    source_node = db.query(DBLayoutNode).filter(
        DBLayoutNode.id == connection.source_id,
        DBLayoutNode.layout_id == layout_id
    ).first()
    
    target_node = db.query(DBLayoutNode).filter(
        DBLayoutNode.id == connection.target_id,
        DBLayoutNode.layout_id == layout_id
    ).first()
    
    if not source_node or not target_node:
        raise HTTPException(status_code=404, detail="Connection nodes not found in this layout")
    
    # Remove the connection
    try:
        result = WorkloadModelingService.remove_connection(connection_id, db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/layouts/{layout_id}/initialize-from-org")
def initialize_layout_from_org(
    layout_id: int,
    db: Session = Depends(get_db)
):
    """Initialize a layout with all users from the current organization"""
    # Check if layout exists
    layout = db.query(DBOrganizationLayout).filter(DBOrganizationLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")
    
    # Get all users
    users = db.query(User).all()
    if not users:
        raise HTTPException(status_code=404, detail="No users found in the organization")
    
    # Create nodes for all users in a circular layout
    nodes = []
    user_count = len(users)
    radius = max(200, user_count * 30)  # Adjust radius based on number of users
    
    # Group users by tier/level
    user_tiers = {}
    for user in users:
        tier = getattr(user, 'tier', 0) or 0  # Default to tier 0 if not set
        if tier not in user_tiers:
            user_tiers[tier] = []
        user_tiers[tier].append(user)
    
    # Create nodes in concentric circles based on tier
    tier_keys = sorted(user_tiers.keys())
    for tier_idx, tier in enumerate(tier_keys):
        tier_users = user_tiers[tier]
        tier_user_count = len(tier_users)
        tier_radius = radius - (tier_idx * 100)  # Outer tiers have larger radius
        
        for i, user in enumerate(tier_users):
            angle = (2 * math.pi * i) / tier_user_count
            x_pos = 500 + tier_radius * math.cos(angle)  # Center at x=500
            y_pos = 400 + tier_radius * math.sin(angle)  # Center at y=400
            
            # Create node
            db_node = DBLayoutNode(
                layout_id=layout_id,
                user_id=user.id,
                x_position=x_pos,
                y_position=y_pos,
                current_workload=user.workload_hours
            )
            db.add(db_node)
            db.flush()  # Flush to get the ID without committing
            nodes.append(db_node)
    
    # Create connections based on manager relationships
    connections = []
    for node in nodes:
        user = db.query(User).filter(User.id == node.user_id).first()
        if user.manager_id:
            # Find the node for the manager
            manager_node = next((n for n in nodes if n.user_id == user.manager_id), None)
            if manager_node:
                # Create reporting connection
                conn = DBNodeConnection(
                    source_id=node.id,
                    target_id=manager_node.id,
                    connection_type="reporting",
                    workload_impact=min(15, 5 + node.id % 10)  # Simple formula for demo
                )
                db.add(conn)
                connections.append(conn)
    
    db.commit()
    
    # Calculate workloads for all nodes
    for node in nodes:
        node.current_workload = WorkloadModelingService.calculate_node_workload(node.id, db)
    
    db.commit()
    
    return {
        "layout_id": layout_id,
        "nodes_created": len(nodes),
        "connections_created": len(connections)
    } 
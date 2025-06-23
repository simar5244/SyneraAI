from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime

from ..database import get_db
from ..models.models import Layout, Role, Connection, ActionLog
from ..schemas.schemas import (
    ConnectionCreate,
    ConnectionResponse,
    ConnectionUpdate,
    ActionType
)
from ..auth import get_current_user, User
from ..utils.workload import build_org_graph, check_cycle, calculate_workload, calculate_hierarchy_depth

router = APIRouter()

@router.post("/{layout_id}/connections", response_model=ConnectionResponse)
async def create_connection(
    layout_id: int,
    connection: ConnectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new connection between roles in an organization layout.
    Checks for cycles in the reporting structure and verifies both roles exist in the layout.
    """
    # Check if layout exists
    layout = db.query(Layout).filter(Layout.id == layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with id {layout_id} not found"
        )
    
    # Check permission
    is_top_mgmt = current_user.role in ["eco", "top_mgmt", "admin"]
    is_owner = layout.created_by == current_user.id
    
    if not (is_top_mgmt or is_owner):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to add connections to this layout"
        )
    
    # Check if source role exists
    source_role = db.query(Role).filter(
        Role.id == connection.source_id,
        Role.layout_id == layout_id
    ).first()
    
    if not source_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source role with id {connection.source_id} not found in layout {layout_id}"
        )
    
    # Check if target role exists
    target_role = db.query(Role).filter(
        Role.id == connection.target_id,
        Role.layout_id == layout_id
    ).first()
    
    if not target_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target role with id {connection.target_id} not found in layout {layout_id}"
        )
    
    # Check if connection already exists
    existing_connection = db.query(Connection).filter(
        Connection.source_id == connection.source_id,
        Connection.target_id == connection.target_id
    ).first()
    
    if existing_connection:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Connection from {connection.source_id} to {connection.target_id} already exists"
        )
    
    # Check for cycles in the reporting structure
    G = build_org_graph(db, layout_id)
    
    # Add the new edge temporarily to check
    G.add_edge(connection.source_id, connection.target_id)
    
    if check_cycle(G):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This connection would create a cycle in the reporting structure"
        )
    
    # Create the connection
    db_connection = Connection(
        source_id=connection.source_id,
        target_id=connection.target_id,
        layout_id=layout_id,
        connection_type=connection.connection_type,
        weight=connection.weight or 1.0,
        metadata=connection.metadata or {},
        created_by=current_user.id,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    db.add(db_connection)
    db.commit()
    db.refresh(db_connection)
    
    # Log the action
    action_log = ActionLog(
        layout_id=layout_id,
        action_type=ActionType.CREATE_CONNECTION,
        action_data={
            "connection_id": db_connection.id,
            "source_id": db_connection.source_id,
            "target_id": db_connection.target_id,
            "connection_type": db_connection.connection_type,
            "weight": db_connection.weight
        },
        performed_by=current_user.id
    )
    
    db.add(action_log)
    db.commit()
    
    return db_connection

@router.get("/{layout_id}/connections", response_model=List[ConnectionResponse])
async def get_connections(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all connections in an organization layout.
    """
    # Check if layout exists
    layout = db.query(Layout).filter(Layout.id == layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with id {layout_id} not found"
        )
    
    # Check permission
    is_top_mgmt = current_user.role in ["eco", "top_mgmt", "admin"]
    is_owner = layout.created_by == current_user.id
    
    if not (is_top_mgmt or is_owner):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view connections in this layout"
        )
    
    # Get connections
    connections = db.query(Connection).filter(Connection.layout_id == layout_id).all()
    
    return connections

@router.get("/{layout_id}/connections/{connection_id}", response_model=ConnectionResponse)
async def get_connection(
    layout_id: int,
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific connection in an organization layout.
    """
    # Check if layout exists
    layout = db.query(Layout).filter(Layout.id == layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with id {layout_id} not found"
        )
    
    # Check permission
    is_top_mgmt = current_user.role in ["eco", "top_mgmt", "admin"]
    is_owner = layout.created_by == current_user.id
    
    if not (is_top_mgmt or is_owner):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this connection"
        )
    
    # Get the connection
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.layout_id == layout_id
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection with id {connection_id} not found in layout {layout_id}"
        )
    
    return connection

@router.put("/{layout_id}/connections/{connection_id}", response_model=ConnectionResponse)
async def update_connection(
    layout_id: int,
    connection_id: int,
    connection_update: ConnectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a connection in an organization layout.
    Only the weight, type and metadata can be updated, not the source/target roles.
    """
    # Check if layout exists
    layout = db.query(Layout).filter(Layout.id == layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with id {layout_id} not found"
        )
    
    # Check permission
    is_top_mgmt = current_user.role in ["eco", "top_mgmt", "admin"]
    is_owner = layout.created_by == current_user.id
    
    if not (is_top_mgmt or is_owner):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update connections in this layout"
        )
    
    # Get the connection
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.layout_id == layout_id
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection with id {connection_id} not found in layout {layout_id}"
        )
    
    # Save old data for logging
    old_data = {
        "connection_type": connection.connection_type,
        "weight": connection.weight,
        "metadata": connection.metadata
    }
    
    # Update connection
    if connection_update.connection_type is not None:
        connection.connection_type = connection_update.connection_type
    
    if connection_update.weight is not None:
        connection.weight = connection_update.weight
    
    if connection_update.metadata is not None:
        # Merge metadata rather than replace
        if connection.metadata:
            connection.metadata.update(connection_update.metadata)
        else:
            connection.metadata = connection_update.metadata
    
    connection.updated_at = datetime.now()
    
    db.commit()
    db.refresh(connection)
    
    # Log the action
    action_log = ActionLog(
        layout_id=layout_id,
        action_type=ActionType.UPDATE_CONNECTION,
        action_data={
            "connection_id": connection_id,
            "old_data": old_data,
            "new_data": {
                "connection_type": connection.connection_type,
                "weight": connection.weight,
                "metadata": connection.metadata
            }
        },
        performed_by=current_user.id
    )
    
    db.add(action_log)
    db.commit()
    
    return connection

@router.delete("/{layout_id}/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    layout_id: int,
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a connection from an organization layout.
    """
    # Check if layout exists
    layout = db.query(Layout).filter(Layout.id == layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with id {layout_id} not found"
        )
    
    # Check permission
    is_top_mgmt = current_user.role in ["eco", "top_mgmt", "admin"]
    is_owner = layout.created_by == current_user.id
    
    if not (is_top_mgmt or is_owner):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete connections from this layout"
        )
    
    # Get the connection
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.layout_id == layout_id
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection with id {connection_id} not found in layout {layout_id}"
        )
    
    # Store connection data for logging
    connection_data = {
        "connection_id": connection_id,
        "source_id": connection.source_id,
        "target_id": connection.target_id,
        "connection_type": connection.connection_type,
        "weight": connection.weight,
        "metadata": connection.metadata
    }
    
    # Delete the connection
    db.delete(connection)
    
    # Log the action
    action_log = ActionLog(
        layout_id=layout_id,
        action_type=ActionType.DELETE_CONNECTION,
        action_data=connection_data,
        performed_by=current_user.id
    )
    
    db.add(action_log)
    db.commit()
    
    return

@router.get("/{layout_id}/roles/{role_id}/connections", response_model=Dict[str, Any])
async def get_role_connections(
    layout_id: int,
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all connections for a specific role, both incoming and outgoing.
    """
    # Check if layout exists
    layout = db.query(Layout).filter(Layout.id == layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with id {layout_id} not found"
        )
    
    # Check if role exists
    role = db.query(Role).filter(
        Role.id == role_id,
        Role.layout_id == layout_id
    ).first()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with id {role_id} not found in layout {layout_id}"
        )
    
    # Check permission
    is_top_mgmt = current_user.role in ["eco", "top_mgmt", "admin"]
    is_owner = layout.created_by == current_user.id
    
    if not (is_top_mgmt or is_owner):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view connections in this layout"
        )
    
    # Get outgoing connections
    outgoing_connections = db.query(Connection).filter(
        Connection.source_id == role_id,
        Connection.layout_id == layout_id
    ).all()
    
    # Get incoming connections
    incoming_connections = db.query(Connection).filter(
        Connection.target_id == role_id,
        Connection.layout_id == layout_id
    ).all()
    
    # Create a result containing both sets
    result = {
        "role_id": role_id,
        "role_name": role.name,
        "incoming_connections": incoming_connections,
        "outgoing_connections": outgoing_connections,
        "total_incoming": len(incoming_connections),
        "total_outgoing": len(outgoing_connections)
    }
    
    return result

@router.post("/{layout_id}/bulk-connections", response_model=Dict[str, Any])
async def create_bulk_connections(
    layout_id: int,
    connections: List[ConnectionCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create multiple connections at once.
    Useful for initializing a layout with many connections.
    """
    # Check if layout exists
    layout = db.query(Layout).filter(Layout.id == layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with id {layout_id} not found"
        )
    
    # Check permission
    is_top_mgmt = current_user.role in ["eco", "top_mgmt", "admin"]
    is_owner = layout.created_by == current_user.id
    
    if not (is_top_mgmt or is_owner):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to add connections to this layout"
        )
    
    # Build the organization graph to check for cycles
    G = build_org_graph(db, layout_id)
    
    created_connections = []
    skipped_connections = []
    
    # Process each connection
    for connection_data in connections:
        # Check if source and target roles exist
        source_exists = db.query(Role).filter(
            Role.id == connection_data.source_id,
            Role.layout_id == layout_id
        ).first() is not None
        
        target_exists = db.query(Role).filter(
            Role.id == connection_data.target_id,
            Role.layout_id == layout_id
        ).first() is not None
        
        # Check if connection already exists
        exists = db.query(Connection).filter(
            Connection.source_id == connection_data.source_id,
            Connection.target_id == connection_data.target_id,
            Connection.layout_id == layout_id
        ).first() is not None
        
        if not source_exists or not target_exists or exists:
            skipped_connections.append({
                "source_id": connection_data.source_id,
                "target_id": connection_data.target_id,
                "reason": "Invalid roles or connection already exists"
            })
            continue
        
        # Check for cycles
        G.add_edge(connection_data.source_id, connection_data.target_id)
        
        if check_cycle(G):
            # Remove the edge if it creates a cycle
            G.remove_edge(connection_data.source_id, connection_data.target_id)
            skipped_connections.append({
                "source_id": connection_data.source_id,
                "target_id": connection_data.target_id,
                "reason": "Would create a cycle"
            })
            continue
        
        # Create the connection
        db_connection = Connection(
            source_id=connection_data.source_id,
            target_id=connection_data.target_id,
            layout_id=layout_id,
            connection_type=connection_data.connection_type,
            weight=connection_data.weight or 1.0,
            metadata=connection_data.metadata or {},
            created_by=current_user.id,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        db.add(db_connection)
        created_connections.append(db_connection)
    
    db.commit()
    
    # Refresh the created connections to get their IDs
    for connection in created_connections:
        db.refresh(connection)
    
    # Log the action
    action_log = ActionLog(
        layout_id=layout_id,
        action_type=ActionType.BULK_CREATE_CONNECTIONS,
        action_data={
            "created_count": len(created_connections),
            "skipped_count": len(skipped_connections),
            "connections": [
                {
                    "id": conn.id,
                    "source_id": conn.source_id,
                    "target_id": conn.target_id
                }
                for conn in created_connections
            ],
            "skipped": skipped_connections
        },
        performed_by=current_user.id
    )
    
    db.add(action_log)
    db.commit()
    
    return {
        "success": True,
        "created_count": len(created_connections),
        "skipped_count": len(skipped_connections),
        "created_connections": created_connections,
        "skipped_connections": skipped_connections
    } 
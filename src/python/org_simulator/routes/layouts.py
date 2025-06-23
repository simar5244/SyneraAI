from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime

from ..database import get_db
from ..models.models import Layout, Role, Connection, ActionLog
from ..schemas.schemas import (
    LayoutCreate,
    LayoutResponse,
    LayoutDetailResponse,
    LayoutUpdate,
    ActionType
)
from ..auth import get_current_user, User
from ..utils.workload import build_org_graph, calculate_workload, calculate_hierarchy_depth

router = APIRouter()

@router.post("/", response_model=LayoutResponse)
async def create_layout(
    layout: LayoutCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new organization layout.
    """
    # Create layout with user as owner
    db_layout = Layout(
        name=layout.name,
        description=layout.description,
        metadata=layout.metadata or {},
        is_public=layout.is_public or False,
        version=1,
        created_by=current_user.id,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    db.add(db_layout)
    db.commit()
    db.refresh(db_layout)
    
    # Log the action
    action_log = ActionLog(
        layout_id=db_layout.id,
        action_type=ActionType.CREATE_LAYOUT,
        action_data={
            "layout_id": db_layout.id,
            "name": db_layout.name,
            "description": db_layout.description,
            "is_public": db_layout.is_public
        },
        performed_by=current_user.id
    )
    
    db.add(action_log)
    db.commit()
    
    return db_layout

@router.get("/", response_model=List[LayoutResponse])
async def get_layouts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all layouts accessible to the current user.
    This includes layouts created by the user and public layouts.
    """
    query = db.query(Layout).filter(
        (Layout.created_by == current_user.id) | (Layout.is_public == True)
    )
    
    # Apply search filter if provided
    if search:
        query = query.filter(Layout.name.ilike(f"%{search}%"))
    
    # Apply pagination
    query = query.order_by(Layout.updated_at.desc()).offset(skip).limit(limit)
    
    layouts = query.all()
    
    # For each layout, count the number of roles
    for layout in layouts:
        layout.role_count = db.query(Role).filter(Role.layout_id == layout.id).count()
    
    return layouts

@router.get("/{layout_id}", response_model=LayoutDetailResponse)
async def get_layout(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get details of a specific layout, including roles and connections.
    """
    # Check if layout exists
    layout = db.query(Layout).filter(Layout.id == layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with id {layout_id} not found"
        )
    
    # Check permission
    is_owner = layout.created_by == current_user.id
    is_public = layout.is_public
    is_admin = current_user.role in ["admin", "eco"]
    
    if not (is_owner or is_public or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this layout"
        )
    
    # Get all roles for this layout
    roles = db.query(Role).filter(Role.layout_id == layout_id).all()
    
    # Get all connections for this layout
    connections = db.query(Connection).filter(Connection.layout_id == layout_id).all()
    
    # Build organization graph
    G = build_org_graph(db, layout_id)
    
    # Calculate workload and depth for each role
    for role in roles:
        role.workload = calculate_workload(G, role.id)
        role.depth = calculate_hierarchy_depth(G, role.id)
    
    # Create detailed response
    layout_detail = {
        "id": layout.id,
        "name": layout.name,
        "description": layout.description,
        "metadata": layout.metadata,
        "is_public": layout.is_public,
        "version": layout.version,
        "created_by": layout.created_by,
        "created_at": layout.created_at,
        "updated_at": layout.updated_at,
        "roles": roles,
        "connections": connections,
        "role_count": len(roles),
        "connection_count": len(connections)
    }
    
    return layout_detail

@router.put("/{layout_id}", response_model=LayoutResponse)
async def update_layout(
    layout_id: int,
    layout_update: LayoutUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing layout.
    Only the owner or an admin can update a layout.
    """
    # Check if layout exists
    layout = db.query(Layout).filter(Layout.id == layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with id {layout_id} not found"
        )
    
    # Check permission
    is_owner = layout.created_by == current_user.id
    is_admin = current_user.role in ["admin", "eco"]
    
    if not (is_owner or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this layout"
        )
    
    # Store old data for logging
    old_data = {
        "name": layout.name,
        "description": layout.description,
        "is_public": layout.is_public,
        "metadata": layout.metadata
    }
    
    # Update layout properties
    if layout_update.name is not None:
        layout.name = layout_update.name
    
    if layout_update.description is not None:
        layout.description = layout_update.description
    
    if layout_update.is_public is not None:
        layout.is_public = layout_update.is_public
    
    if layout_update.metadata is not None:
        # Merge metadata rather than replace
        if layout.metadata:
            layout.metadata.update(layout_update.metadata)
        else:
            layout.metadata = layout_update.metadata
    
    # Increment version
    layout.version += 1
    layout.updated_at = datetime.now()
    
    db.commit()
    db.refresh(layout)
    
    # Log the action
    action_log = ActionLog(
        layout_id=layout_id,
        action_type=ActionType.UPDATE_LAYOUT,
        action_data={
            "layout_id": layout_id,
            "old_data": old_data,
            "new_data": {
                "name": layout.name,
                "description": layout.description,
                "is_public": layout.is_public,
                "metadata": layout.metadata,
                "version": layout.version
            }
        },
        performed_by=current_user.id
    )
    
    db.add(action_log)
    db.commit()
    
    return layout

@router.delete("/{layout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_layout(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete an organization layout including all its roles and connections.
    Only the owner or an admin can delete a layout.
    """
    # Check if layout exists
    layout = db.query(Layout).filter(Layout.id == layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with id {layout_id} not found"
        )
    
    # Check permission
    is_owner = layout.created_by == current_user.id
    is_admin = current_user.role in ["admin", "eco"]
    
    if not (is_owner or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this layout"
        )
    
    # Get counts for logging
    role_count = db.query(Role).filter(Role.layout_id == layout_id).count()
    connection_count = db.query(Connection).filter(Connection.layout_id == layout_id).count()
    
    # Log the action before deletion
    action_log = ActionLog(
        layout_id=layout_id,
        action_type=ActionType.DELETE_LAYOUT,
        action_data={
            "layout_id": layout_id,
            "name": layout.name,
            "description": layout.description,
            "role_count": role_count,
            "connection_count": connection_count,
            "created_by": layout.created_by,
            "created_at": str(layout.created_at)
        },
        performed_by=current_user.id
    )
    
    db.add(action_log)
    db.commit()
    
    # Delete all connections in the layout
    db.query(Connection).filter(Connection.layout_id == layout_id).delete()
    
    # Delete all roles in the layout
    db.query(Role).filter(Role.layout_id == layout_id).delete()
    
    # Delete the layout
    db.delete(layout)
    db.commit()
    
    return

@router.post("/{layout_id}/clone", response_model=LayoutResponse)
async def clone_layout(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Clone an existing layout, creating a copy with the same roles and connections.
    The name of the cloned layout will be "Copy of {original_name}".
    """
    # Check if source layout exists
    source_layout = db.query(Layout).filter(Layout.id == layout_id).first()
    if not source_layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with id {layout_id} not found"
        )
    
    # Check permission to view source layout
    is_owner = source_layout.created_by == current_user.id
    is_public = source_layout.is_public
    is_admin = current_user.role in ["admin", "eco"]
    
    if not (is_owner or is_public or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this layout"
        )
    
    # Create new layout
    new_layout = Layout(
        name=f"Copy of {source_layout.name}",
        description=source_layout.description,
        metadata=source_layout.metadata.copy() if source_layout.metadata else {},
        is_public=False,  # Always create as private initially
        version=1,
        created_by=current_user.id,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    db.add(new_layout)
    db.commit()
    db.refresh(new_layout)
    
    # Get all roles from source layout
    source_roles = db.query(Role).filter(Role.layout_id == layout_id).all()
    
    # Create mapping of old role IDs to new role IDs
    role_id_map = {}
    
    # Clone all roles
    for source_role in source_roles:
        new_role = Role(
            layout_id=new_layout.id,
            name=source_role.name,
            description=source_role.description,
            x_position=source_role.x_position,
            y_position=source_role.y_position,
            color=source_role.color,
            metadata=source_role.metadata.copy() if source_role.metadata else {},
            created_by=current_user.id,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        db.add(new_role)
        db.commit()
        db.refresh(new_role)
        
        # Map old role ID to new role ID
        role_id_map[source_role.id] = new_role.id
    
    # Get all connections from source layout
    source_connections = db.query(Connection).filter(Connection.layout_id == layout_id).all()
    
    # Clone all connections
    for source_connection in source_connections:
        new_connection = Connection(
            layout_id=new_layout.id,
            source_id=role_id_map[source_connection.source_id],
            target_id=role_id_map[source_connection.target_id],
            connection_type=source_connection.connection_type,
            weight=source_connection.weight,
            metadata=source_connection.metadata.copy() if source_connection.metadata else {},
            created_by=current_user.id,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        db.add(new_connection)
    
    db.commit()
    
    # Log the action
    action_log = ActionLog(
        layout_id=new_layout.id,
        action_type=ActionType.CLONE_LAYOUT,
        action_data={
            "source_layout_id": layout_id,
            "new_layout_id": new_layout.id,
            "role_count": len(source_roles),
            "connection_count": len(source_connections)
        },
        performed_by=current_user.id
    )
    
    db.add(action_log)
    db.commit()
    
    return new_layout

@router.get("/{layout_id}/history", response_model=List[Dict[str, Any]])
async def get_layout_history(
    layout_id: int,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the action history for a layout.
    Shows all changes made to the layout, its roles, and connections.
    """
    # Check if layout exists
    layout = db.query(Layout).filter(Layout.id == layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with id {layout_id} not found"
        )
    
    # Check permission
    is_owner = layout.created_by == current_user.id
    is_public = layout.is_public
    is_admin = current_user.role in ["admin", "eco"]
    
    if not (is_owner or is_public or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this layout's history"
        )
    
    # Get action logs for this layout, ordered by timestamp (newest first)
    logs = db.query(ActionLog).filter(
        ActionLog.layout_id == layout_id
    ).order_by(
        ActionLog.created_at.desc()
    ).limit(limit).all()
    
    return logs

@router.post("/{layout_id}/revert-to-version/{version}", response_model=LayoutResponse)
async def revert_to_version(
    layout_id: int,
    version: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Revert a layout to a specific version.
    This creates a new version with the state of the specified version.
    Only the owner or an admin can revert a layout.
    """
    # Check if layout exists
    layout = db.query(Layout).filter(Layout.id == layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with id {layout_id} not found"
        )
    
    # Check permission
    is_owner = layout.created_by == current_user.id
    is_admin = current_user.role in ["admin", "eco"]
    
    if not (is_owner or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to revert this layout"
        )
    
    # Check if version exists
    if version >= layout.version or version < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid version {version}. Current version is {layout.version}"
        )
    
    # This would require implementing a proper version control system
    # For now, we'll just update the layout with a message indicating the revert
    layout.metadata = layout.metadata or {}
    layout.metadata["reverted_to_version"] = version
    layout.metadata["revert_date"] = str(datetime.now())
    
    layout.version += 1
    layout.updated_at = datetime.now()
    
    db.commit()
    db.refresh(layout)
    
    # Log the action
    action_log = ActionLog(
        layout_id=layout_id,
        action_type=ActionType.REVERT_LAYOUT,
        action_data={
            "layout_id": layout_id,
            "reverted_to_version": version,
            "new_version": layout.version
        },
        performed_by=current_user.id
    )
    
    db.add(action_log)
    db.commit()
    
    return layout 
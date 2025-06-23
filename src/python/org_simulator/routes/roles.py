from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime

from ..database import get_db
from ..models.models import Layout, Role, Connection, ActionLog
from ..schemas.schemas import (
    RoleCreate,
    RoleResponse,
    RoleUpdate,
    RoleDetailResponse,
    ActionType
)
from ..auth import get_current_user, get_top_management_user, User
from ..utils.workload import build_org_graph, calculate_workload, calculate_hierarchy_depth

router = APIRouter()

@router.post("/{layout_id}/roles", response_model=RoleResponse)
async def create_role(
    layout_id: int,
    role: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new role in an organization layout.
    Users can only add roles to their own layouts unless they are admin/top management.
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
            detail="You don't have permission to add roles to this layout"
        )
    
    # Create new role
    db_role = Role(
        layout_id=layout_id,
        name=role.name,
        description=role.description,
        position_x=role.position_x,
        position_y=role.position_y,
        color=role.color or "#4287f5",  # Default blue color
        metadata=role.metadata or {},
        created_by=current_user.id,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    
    # Log the action
    action_log = ActionLog(
        layout_id=layout_id,
        action_type=ActionType.CREATE_ROLE,
        action_data={
            "role_id": db_role.id,
            "name": db_role.name,
            "description": db_role.description,
            "position": {"x": db_role.position_x, "y": db_role.position_y}
        },
        performed_by=current_user.id
    )
    
    db.add(action_log)
    db.commit()
    
    return db_role

@router.get("/{layout_id}/roles", response_model=List[RoleResponse])
async def get_roles(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all roles in an organization layout.
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
            detail="You don't have permission to view roles in this layout"
        )
    
    # Get roles
    roles = db.query(Role).filter(Role.layout_id == layout_id).all()
    
    # If needed, calculate workload for each role
    if roles:
        G = build_org_graph(db, layout_id)
        for role in roles:
            role.workload = calculate_workload(G, role.id)
            role.hierarchy_depth = calculate_hierarchy_depth(G, role.id)
    
    return roles

@router.get("/{layout_id}/roles/{role_id}", response_model=RoleDetailResponse)
async def get_role(
    layout_id: int,
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific role in an organization layout.
    Includes detailed information about connections and workload.
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
            detail="You don't have permission to view this role"
        )
    
    # Get the role
    role = db.query(Role).filter(
        Role.id == role_id,
        Role.layout_id == layout_id
    ).first()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with id {role_id} not found in layout {layout_id}"
        )
    
    # Get connections for this role
    incoming_connections = db.query(Connection).filter(
        Connection.target_id == role_id
    ).all()
    
    outgoing_connections = db.query(Connection).filter(
        Connection.source_id == role_id
    ).all()
    
    # Calculate workload and hierarchy depth
    G = build_org_graph(db, layout_id)
    workload = calculate_workload(G, role_id)
    hierarchy_depth = calculate_hierarchy_depth(G, role_id)
    
    # Get manager (if any)
    manager = None
    manager_connections = incoming_connections
    if manager_connections:
        manager_id = manager_connections[0].source_id
        manager = db.query(Role).filter(Role.id == manager_id).first()
    
    # Get direct reports
    direct_reports = []
    for conn in outgoing_connections:
        report = db.query(Role).filter(Role.id == conn.target_id).first()
        if report:
            direct_reports.append(report)
    
    # Create response
    result = {
        "id": role.id,
        "layout_id": role.layout_id,
        "name": role.name,
        "description": role.description,
        "position_x": role.position_x,
        "position_y": role.position_y,
        "color": role.color,
        "metadata": role.metadata,
        "created_by": role.created_by,
        "created_at": role.created_at,
        "updated_at": role.updated_at,
        "workload": workload,
        "hierarchy_depth": hierarchy_depth,
        "manager": manager,
        "direct_reports": direct_reports,
        "incoming_connections": incoming_connections,
        "outgoing_connections": outgoing_connections
    }
    
    return result

@router.put("/{layout_id}/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    layout_id: int,
    role_id: int,
    role_update: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a role in an organization layout.
    Users can only update roles in their own layouts unless they are admin/top management.
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
            detail="You don't have permission to update roles in this layout"
        )
    
    # Get the role
    role = db.query(Role).filter(
        Role.id == role_id,
        Role.layout_id == layout_id
    ).first()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with id {role_id} not found in layout {layout_id}"
        )
    
    # Save old data for logging
    old_data = {
        "name": role.name,
        "description": role.description,
        "position": {"x": role.position_x, "y": role.position_y},
        "color": role.color,
        "metadata": role.metadata
    }
    
    # Update role fields
    if role_update.name is not None:
        role.name = role_update.name
    
    if role_update.description is not None:
        role.description = role_update.description
    
    if role_update.position_x is not None:
        role.position_x = role_update.position_x
    
    if role_update.position_y is not None:
        role.position_y = role_update.position_y
    
    if role_update.color is not None:
        role.color = role_update.color
    
    if role_update.metadata is not None:
        # Merge metadata rather than replace
        if role.metadata:
            role.metadata.update(role_update.metadata)
        else:
            role.metadata = role_update.metadata
    
    role.updated_at = datetime.now()
    
    db.commit()
    db.refresh(role)
    
    # Log the action
    action_log = ActionLog(
        layout_id=layout_id,
        action_type=ActionType.UPDATE_ROLE,
        action_data={
            "role_id": role_id,
            "old_data": old_data,
            "new_data": {
                "name": role.name,
                "description": role.description,
                "position": {"x": role.position_x, "y": role.position_y},
                "color": role.color,
                "metadata": role.metadata
            }
        },
        performed_by=current_user.id
    )
    
    db.add(action_log)
    db.commit()
    
    return role

@router.delete("/{layout_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    layout_id: int,
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a role from an organization layout.
    Users can only delete roles from their own layouts unless they are admin/top management.
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
            detail="You don't have permission to delete roles from this layout"
        )
    
    # Get the role
    role = db.query(Role).filter(
        Role.id == role_id,
        Role.layout_id == layout_id
    ).first()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with id {role_id} not found in layout {layout_id}"
        )
    
    # Before deleting, log the action
    action_log = ActionLog(
        layout_id=layout_id,
        action_type=ActionType.DELETE_ROLE,
        action_data={
            "role_id": role_id,
            "name": role.name,
            "description": role.description,
            "position": {"x": role.position_x, "y": role.position_y}
        },
        performed_by=current_user.id
    )
    
    db.add(action_log)
    db.commit()
    
    # Delete all connections involving this role
    db.query(Connection).filter(
        (Connection.source_id == role_id) | (Connection.target_id == role_id)
    ).delete(synchronize_session=False)
    
    # Delete the role
    db.delete(role)
    db.commit()
    
    return

@router.patch("/{layout_id}/roles/{role_id}/position", response_model=RoleResponse)
async def update_role_position(
    layout_id: int,
    role_id: int,
    position: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update only the position of a role.
    Optimized for frequent position updates during drag operations.
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
            detail="You don't have permission to update roles in this layout"
        )
    
    # Get the role
    role = db.query(Role).filter(
        Role.id == role_id,
        Role.layout_id == layout_id
    ).first()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with id {role_id} not found in layout {layout_id}"
        )
    
    # Validate position data
    if "x" not in position or "y" not in position:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Position must include 'x' and 'y' coordinates"
        )
    
    # Save old position for logging
    old_position = {"x": role.position_x, "y": role.position_y}
    
    # Update position
    role.position_x = position["x"]
    role.position_y = position["y"]
    role.updated_at = datetime.now()
    
    db.commit()
    db.refresh(role)
    
    # Log the action (minimized for frequent position updates)
    action_log = ActionLog(
        layout_id=layout_id,
        action_type=ActionType.UPDATE_ROLE_POSITION,
        action_data={
            "role_id": role_id,
            "old_position": old_position,
            "new_position": {"x": role.position_x, "y": role.position_y}
        },
        performed_by=current_user.id
    )
    
    db.add(action_log)
    db.commit()
    
    return role

@router.patch("/{layout_id}/roles/batch-position", response_model=Dict[str, Any])
async def update_roles_batch_position(
    layout_id: int,
    positions: Dict[str, Dict[str, float]],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update positions of multiple roles in a single request.
    Optimized for saving layout state after multiple drag operations.
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
            detail="You don't have permission to update roles in this layout"
        )
    
    updated_roles = []
    
    # Process each role position update
    for role_id_str, position in positions.items():
        try:
            role_id = int(role_id_str)
            
            # Get the role
            role = db.query(Role).filter(
                Role.id == role_id,
                Role.layout_id == layout_id
            ).first()
            
            if role and "x" in position and "y" in position:
                # Update position
                role.position_x = position["x"]
                role.position_y = position["y"]
                role.updated_at = datetime.now()
                updated_roles.append(role_id)
        except (ValueError, TypeError):
            # Skip invalid role IDs
            continue
    
    db.commit()
    
    # Log the batch update
    action_log = ActionLog(
        layout_id=layout_id,
        action_type=ActionType.BATCH_UPDATE_POSITIONS,
        action_data={
            "updated_roles": updated_roles,
            "count": len(updated_roles)
        },
        performed_by=current_user.id
    )
    
    db.add(action_log)
    db.commit()
    
    return {
        "success": True,
        "updated_count": len(updated_roles),
        "updated_roles": updated_roles
    } 
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
import networkx as nx

from ..database import get_db
from ..models.models import Layout, Role, Connection, SimulationHistory, ActionLog
from ..schemas.schemas import (
    SimulationRequest,
    SimulationResponse,
    SimulationApplyRequest,
    ActionType
)
from ..auth import get_current_user, User
from ..utils.workload import build_org_graph, calculate_workload, calculate_hierarchy_depth, check_cycle

router = APIRouter()

@router.post("/run", response_model=SimulationResponse)
async def run_simulation(
    simulation: SimulationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Run a simulation on an organization layout to predict the impact of changes.
    Can simulate adding/removing roles, changing reporting lines, etc.
    """
    # Check if layout exists
    layout = db.query(Layout).filter(Layout.id == simulation.layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with id {simulation.layout_id} not found"
        )
    
    # Check permission
    is_owner = layout.created_by == current_user.id
    is_public = layout.is_public
    is_admin = current_user.role in ["admin", "eco"]
    
    if not (is_owner or is_public or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to run simulations on this layout"
        )
    
    # Build the current organization graph
    current_graph = build_org_graph(db, simulation.layout_id)
    
    # Create a copy of the graph for simulation
    simulated_graph = current_graph.copy()
    
    # Track changes
    added_roles = []
    removed_roles = []
    added_connections = []
    removed_connections = []
    
    # Apply requested changes
    
    # 1. Add new roles
    for role_add in simulation.add_roles:
        # Generate a temporary ID for the new role (negative to avoid conflicts)
        temp_role_id = -len(added_roles) - 1
        
        # Add node to graph
        simulated_graph.add_node(temp_role_id, name=role_add.name)
        
        # Track added role
        added_roles.append({
            "temp_id": temp_role_id,
            "name": role_add.name,
            "description": role_add.description,
            "metadata": role_add.metadata
        })
    
    # 2. Remove roles
    for role_id in simulation.remove_roles:
        # Check if role exists
        if not db.query(Role).filter(
            Role.id == role_id,
            Role.layout_id == simulation.layout_id
        ).first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role with id {role_id} not found in layout {simulation.layout_id}"
            )
        
        # Remove node from graph
        if role_id in simulated_graph:
            simulated_graph.remove_node(role_id)
            
            # Track removed role
            removed_roles.append(role_id)
    
    # 3. Add connections
    for conn_add in simulation.add_connections:
        source_id = conn_add.source_id
        target_id = conn_add.target_id
        
        # Check if source and target exist in the graph
        if source_id not in simulated_graph:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Source role with id {source_id} not found in the simulated organization"
            )
        
        if target_id not in simulated_graph:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target role with id {target_id} not found in the simulated organization"
            )
        
        # Check if adding this connection would create a cycle
        simulated_graph.add_edge(source_id, target_id)
        if check_cycle(simulated_graph):
            # Remove the edge and raise an error
            simulated_graph.remove_edge(source_id, target_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Adding this connection would create a cycle in the reporting structure"
            )
        
        # Track added connection
        added_connections.append({
            "source_id": source_id,
            "target_id": target_id,
            "connection_type": conn_add.connection_type,
            "weight": conn_add.weight
        })
    
    # 4. Remove connections
    for conn_remove in simulation.remove_connections:
        if simulated_graph.has_edge(conn_remove.source_id, conn_remove.target_id):
            simulated_graph.remove_edge(conn_remove.source_id, conn_remove.target_id)
            
            # Track removed connection
            removed_connections.append({
                "source_id": conn_remove.source_id,
                "target_id": conn_remove.target_id
            })
    
    # Calculate metrics for current state
    current_metrics = {
        "role_count": current_graph.number_of_nodes(),
        "connection_count": current_graph.number_of_edges(),
        "workloads": {
            node: calculate_workload(current_graph, node)
            for node in current_graph.nodes()
        },
        "depths": {
            node: calculate_hierarchy_depth(current_graph, node)
            for node in current_graph.nodes()
        }
    }
    
    # Calculate metrics for simulated state
    simulated_metrics = {
        "role_count": simulated_graph.number_of_nodes(),
        "connection_count": simulated_graph.number_of_edges(),
        "workloads": {
            node: calculate_workload(simulated_graph, node)
            for node in simulated_graph.nodes()
        },
        "depths": {
            node: calculate_hierarchy_depth(simulated_graph, node)
            for node in simulated_graph.nodes()
        }
    }
    
    # Calculate impact on roles
    role_impact = {}
    
    # For roles that exist in both graphs, compare workload and depth
    for node in set(current_graph.nodes()) & set(simulated_graph.nodes()):
        current_workload = current_metrics["workloads"].get(node, 0)
        simulated_workload = simulated_metrics["workloads"].get(node, 0)
        workload_change = simulated_workload - current_workload
        
        current_depth = current_metrics["depths"].get(node, 0)
        simulated_depth = simulated_metrics["depths"].get(node, 0)
        depth_change = simulated_depth - current_depth
        
        # Get number of direct reports
        current_reports = len(list(current_graph.successors(node))) if node in current_graph else 0
        simulated_reports = len(list(simulated_graph.successors(node))) if node in simulated_graph else 0
        span_change = simulated_reports - current_reports
        
        role_impact[node] = {
            "workload_before": current_workload,
            "workload_after": simulated_workload,
            "workload_change": workload_change,
            "workload_change_percent": (workload_change / current_workload * 100) if current_workload else 0,
            "depth_before": current_depth,
            "depth_after": simulated_depth,
            "depth_change": depth_change,
            "span_before": current_reports,
            "span_after": simulated_reports,
            "span_change": span_change
        }
    
    # Store simulation in history
    sim_history = SimulationHistory(
        layout_id=simulation.layout_id,
        simulation_type=simulation.simulation_type,
        simulation_name=simulation.simulation_name,
        simulation_description=simulation.simulation_description,
        changes={
            "added_roles": added_roles,
            "removed_roles": removed_roles,
            "added_connections": added_connections,
            "removed_connections": removed_connections
        },
        results={
            "current_metrics": current_metrics,
            "simulated_metrics": simulated_metrics,
            "role_impact": role_impact
        },
        created_by=current_user.id,
        created_at=datetime.now()
    )
    
    db.add(sim_history)
    db.commit()
    db.refresh(sim_history)
    
    # Prepare response
    return {
        "simulation_id": sim_history.id,
        "layout_id": simulation.layout_id,
        "simulation_type": simulation.simulation_type,
        "simulation_name": simulation.simulation_name,
        "changes": {
            "added_roles": added_roles,
            "removed_roles": removed_roles,
            "added_connections": added_connections,
            "removed_connections": removed_connections
        },
        "metrics": {
            "role_count_before": current_metrics["role_count"],
            "role_count_after": simulated_metrics["role_count"],
            "connection_count_before": current_metrics["connection_count"],
            "connection_count_after": simulated_metrics["connection_count"]
        },
        "role_impact": role_impact,
        "created_at": sim_history.created_at
    }

@router.post("/apply/{simulation_id}", response_model=Dict[str, Any])
async def apply_simulation(
    simulation_id: int,
    request: SimulationApplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Apply a simulation to the actual layout.
    This creates actual roles and connections based on a previously run simulation.
    """
    # Check if simulation exists
    simulation = db.query(SimulationHistory).filter(SimulationHistory.id == simulation_id).first()
    if not simulation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Simulation with id {simulation_id} not found"
        )
    
    # Check if layout exists
    layout = db.query(Layout).filter(Layout.id == simulation.layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with id {simulation.layout_id} not found"
        )
    
    # Check permission
    is_owner = layout.created_by == current_user.id
    is_admin = current_user.role in ["admin", "eco"]
    
    if not (is_owner or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to modify this layout"
        )
    
    # Get changes from simulation
    changes = simulation.changes
    
    # Map of temporary IDs to actual role IDs
    temp_id_map = {}
    
    # Track applied changes
    applied_changes = {
        "added_roles": [],
        "removed_roles": [],
        "added_connections": [],
        "removed_connections": []
    }
    
    # 1. Add roles
    for role_data in changes.get("added_roles", []):
        # Create new role
        new_role = Role(
            layout_id=layout.id,
            name=role_data["name"],
            description=role_data.get("description", ""),
            x_position=request.position_defaults.get("x", 0),
            y_position=request.position_defaults.get("y", 0),
            color=request.color_defaults.get(role_data["name"], "#cccccc"),
            metadata=role_data.get("metadata", {}),
            created_by=current_user.id,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        db.add(new_role)
        db.commit()
        db.refresh(new_role)
        
        # Map temporary ID to actual ID
        temp_id_map[role_data["temp_id"]] = new_role.id
        
        # Track applied change
        applied_changes["added_roles"].append({
            "id": new_role.id,
            "name": new_role.name,
            "temp_id": role_data["temp_id"]
        })
    
    # 2. Remove roles
    for role_id in changes.get("removed_roles", []):
        role = db.query(Role).filter(
            Role.id == role_id,
            Role.layout_id == layout.id
        ).first()
        
        if role:
            # Delete role
            db.delete(role)
            applied_changes["removed_roles"].append(role_id)
    
    db.commit()
    
    # 3. Add connections
    for conn_data in changes.get("added_connections", []):
        # Map temporary IDs to actual IDs if needed
        source_id = temp_id_map.get(conn_data["source_id"], conn_data["source_id"])
        target_id = temp_id_map.get(conn_data["target_id"], conn_data["target_id"])
        
        # Create new connection
        new_conn = Connection(
            layout_id=layout.id,
            source_id=source_id,
            target_id=target_id,
            connection_type=conn_data.get("connection_type", "reports_to"),
            weight=conn_data.get("weight", 1.0),
            created_by=current_user.id,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        db.add(new_conn)
        db.commit()
        db.refresh(new_conn)
        
        # Track applied change
        applied_changes["added_connections"].append({
            "id": new_conn.id,
            "source_id": source_id,
            "target_id": target_id
        })
    
    # 4. Remove connections
    for conn_data in changes.get("removed_connections", []):
        source_id = conn_data["source_id"]
        target_id = conn_data["target_id"]
        
        conn = db.query(Connection).filter(
            Connection.source_id == source_id,
            Connection.target_id == target_id,
            Connection.layout_id == layout.id
        ).first()
        
        if conn:
            # Delete connection
            db.delete(conn)
            applied_changes["removed_connections"].append({
                "source_id": source_id,
                "target_id": target_id
            })
    
    db.commit()
    
    # Update layout version
    layout.version += 1
    layout.updated_at = datetime.now()
    db.commit()
    
    # Log the action
    action_log = ActionLog(
        layout_id=layout.id,
        action_type=ActionType.APPLY_SIMULATION,
        action_data={
            "simulation_id": simulation_id,
            "simulation_name": simulation.simulation_name,
            "applied_changes": applied_changes
        },
        performed_by=current_user.id
    )
    
    db.add(action_log)
    db.commit()
    
    return {
        "success": True,
        "layout_id": layout.id,
        "layout_version": layout.version,
        "simulation_id": simulation_id,
        "applied_changes": applied_changes
    }

@router.get("/history/{layout_id}", response_model=List[Dict[str, Any]])
async def get_simulation_history(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all simulations run for a specific layout.
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
            detail="You don't have permission to view simulations for this layout"
        )
    
    # Get all simulations for this layout
    simulations = db.query(SimulationHistory).filter(
        SimulationHistory.layout_id == layout_id
    ).order_by(
        SimulationHistory.created_at.desc()
    ).all()
    
    return simulations

@router.get("/{simulation_id}", response_model=Dict[str, Any])
async def get_simulation_details(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed results of a specific simulation.
    """
    # Check if simulation exists
    simulation = db.query(SimulationHistory).filter(SimulationHistory.id == simulation_id).first()
    if not simulation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Simulation with id {simulation_id} not found"
        )
    
    # Check if layout exists
    layout = db.query(Layout).filter(Layout.id == simulation.layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with id {simulation.layout_id} not found"
        )
    
    # Check permission
    is_owner = layout.created_by == current_user.id
    is_public = layout.is_public
    is_admin = current_user.role in ["admin", "eco"]
    
    if not (is_owner or is_public or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this simulation"
        )
    
    # Get role names for impact reporting
    role_names = {
        role.id: role.name
        for role in db.query(Role).filter(Role.layout_id == simulation.layout_id).all()
    }
    
    # Add names to role_impact
    result = {
        "id": simulation.id,
        "layout_id": simulation.layout_id,
        "simulation_type": simulation.simulation_type,
        "simulation_name": simulation.simulation_name,
        "simulation_description": simulation.simulation_description,
        "changes": simulation.changes,
        "results": simulation.results,
        "created_by": simulation.created_by,
        "created_at": simulation.created_at
    }
    
    # If we have role impact results, enhance them with names
    if "role_impact" in simulation.results:
        named_impact = {}
        for role_id, impact in simulation.results["role_impact"].items():
            role_id_int = int(role_id)  # Convert from string key to int
            role_name = role_names.get(role_id_int, f"Role {role_id_int}")
            named_impact[role_id] = {
                **impact,
                "role_name": role_name
            }
        
        result["results"]["role_impact_with_names"] = named_impact
    
    return result 
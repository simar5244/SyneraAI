from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.future import select
from sqlalchemy import func, and_, or_
from pydantic import BaseModel, Field
import networkx as nx
from datetime import datetime

from db_setup import get_db
from org_modeling_models import OrganizationLayout, LayoutNode, NodeConnection, SimulationHistory
from org_workload_service import OrgWorkloadService

router = APIRouter(
    prefix="/api/org-simulation",
    tags=["Organization Simulation"],
)

# Pydantic models for request/response validation
class NodePosition(BaseModel):
    x: float
    y: float

class NodeMetadata(BaseModel):
    name: str
    role: Optional[str] = None
    department: Optional[str] = None
    skill_level: Optional[int] = Field(None, ge=1, le=10)
    workload_capacity: Optional[float] = Field(None, ge=0)
    current_workload: Optional[float] = Field(None, ge=0)

class NodeCreate(BaseModel):
    node_type: str
    position: NodePosition
    metadata: NodeMetadata

class NodeUpdate(BaseModel):
    node_type: Optional[str] = None
    position: Optional[NodePosition] = None
    metadata: Optional[Dict[str, Any]] = None

class ConnectionCreate(BaseModel):
    source_id: int
    target_id: int
    connection_type: str = "reports_to"
    workload_impact: float = 10.0

class SimulationChange(BaseModel):
    add_nodes: Optional[List[NodeCreate]] = []
    update_nodes: Optional[List[Dict[str, Any]]] = []
    remove_nodes: Optional[List[int]] = []
    add_connections: Optional[List[ConnectionCreate]] = []
    remove_connections: Optional[List[int]] = []

class SimulationRequest(BaseModel):
    layout_id: int
    changes: SimulationChange
    name: Optional[str] = None
    description: Optional[str] = None

# Helper functions
def calculate_workload(graph, node_id):
    """Calculate workload for a node based on incoming connections and reports"""
    if node_id not in graph:
        return 0
    
    direct_reports = list(graph.predecessors(node_id))
    workload = 0
    
    # Base workload from direct reports
    workload += len(direct_reports) * 10
    
    # Add workload from indirect reports (recursive)
    for report_id in direct_reports:
        # Add a fraction of each report's workload
        report_workload = calculate_workload(graph, report_id)
        workload += report_workload * 0.3
    
    return workload

def calculate_depth(graph, node_id, visited=None):
    """Calculate the maximum depth of hierarchy below this node"""
    if visited is None:
        visited = set()
    
    if node_id in visited:
        return 0  # Avoid cycles
    
    visited.add(node_id)
    
    if node_id not in graph:
        return 0
    
    direct_reports = list(graph.predecessors(node_id))
    if not direct_reports:
        return 0
    
    max_depth = 0
    for report_id in direct_reports:
        depth = calculate_depth(graph, report_id, visited.copy())
        max_depth = max(max_depth, depth)
    
    return max_depth + 1

def check_for_cycle(graph, source_id, target_id):
    """Check if adding an edge would create a cycle"""
    # Add the edge temporarily
    graph.add_edge(target_id, source_id)
    
    try:
        # Check for cycles
        cycles = list(nx.simple_cycles(graph))
        has_cycle = len(cycles) > 0
    except:
        has_cycle = False
    
    # Remove the temporary edge
    graph.remove_edge(target_id, source_id)
    
    return has_cycle

# API Endpoints
@router.post("/layouts/", status_code=status.HTTP_201_CREATED)
async def create_layout(
    name: str, 
    description: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Create a new organization layout"""
    new_layout = OrganizationLayout(
        name=name,
        description=description
    )
    db.add(new_layout)
    db.commit()
    db.refresh(new_layout)
    
    return {
        "id": new_layout.id,
        "name": new_layout.name,
        "description": new_layout.description,
        "created_at": new_layout.created_at,
        "message": "Organization layout created successfully"
    }

@router.get("/layouts/{layout_id}")
async def get_layout(
    layout_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific organization layout with all nodes and connections"""
    layout = db.query(OrganizationLayout).filter(OrganizationLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with ID {layout_id} not found"
        )
    
    nodes = db.query(LayoutNode).filter(LayoutNode.layout_id == layout_id).all()
    connections = db.query(NodeConnection).filter(NodeConnection.layout_id == layout_id).all()
    
    # Build a graph for workload calculation
    G = nx.DiGraph()
    
    for node in nodes:
        G.add_node(node.id)
    
    for conn in connections:
        # Add edge from target to source (manager to report)
        G.add_edge(conn.target_id, conn.source_id, weight=conn.workload_impact)
    
    # Calculate workload and depth for each node
    node_data = []
    for node in nodes:
        workload = calculate_workload(G, node.id)
        depth = calculate_depth(G, node.id)
        
        node_data.append({
            "id": node.id,
            "type": node.node_type,
            "position": {
                "x": node.position_x,
                "y": node.position_y
            },
            "metadata": node.node_metadata,
            "workload": workload,
            "hierarchy_depth": depth
        })
    
    connection_data = [{
        "id": conn.id,
        "source_id": conn.source_id,
        "target_id": conn.target_id,
        "type": conn.connection_type,
        "workload_impact": conn.workload_impact
    } for conn in connections]
    
    return {
        "id": layout.id,
        "name": layout.name,
        "description": layout.description,
        "created_at": layout.created_at,
        "updated_at": layout.updated_at,
        "nodes": node_data,
        "connections": connection_data
    }

@router.post("/layouts/{layout_id}/nodes/", status_code=status.HTTP_201_CREATED)
async def add_node(
    layout_id: int,
    node: NodeCreate,
    db: Session = Depends(get_db)
):
    """Add a new node to an organization layout"""
    # Check if layout exists
    layout = db.query(OrganizationLayout).filter(OrganizationLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with ID {layout_id} not found"
        )
    
    # Create new node
    new_node = LayoutNode(
        layout_id=layout_id,
        node_type=node.node_type,
        position_x=node.position.x,
        position_y=node.position.y,
        node_metadata=node.metadata.dict()
    )
    
    db.add(new_node)
    db.commit()
    db.refresh(new_node)
    
    return {
        "id": new_node.id,
        "layout_id": new_node.layout_id,
        "node_type": new_node.node_type,
        "position": {
            "x": new_node.position_x,
            "y": new_node.position_y
        },
        "metadata": new_node.node_metadata,
        "message": "Node added successfully"
    }

@router.put("/layouts/{layout_id}/nodes/{node_id}")
async def update_node(
    layout_id: int,
    node_id: int,
    node_update: NodeUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing node in an organization layout"""
    # Check if node exists and belongs to the specified layout
    db_node = db.query(LayoutNode).filter(
        LayoutNode.id == node_id,
        LayoutNode.layout_id == layout_id
    ).first()
    
    if not db_node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node with ID {node_id} not found in layout {layout_id}"
        )
    
    # Update node fields
    if node_update.node_type is not None:
        db_node.node_type = node_update.node_type
    
    if node_update.position is not None:
        db_node.position_x = node_update.position.x
        db_node.position_y = node_update.position.y
    
    if node_update.metadata is not None:
        # Merge new metadata with existing
        current_metadata = db_node.node_metadata or {}
        current_metadata.update(node_update.metadata)
        db_node.node_metadata = current_metadata
    
    db.commit()
    db.refresh(db_node)
    
    return {
        "id": db_node.id,
        "layout_id": db_node.layout_id,
        "node_type": db_node.node_type,
        "position": {
            "x": db_node.position_x,
            "y": db_node.position_y
        },
        "metadata": db_node.node_metadata,
        "message": "Node updated successfully"
    }

@router.post("/layouts/{layout_id}/connections/", status_code=status.HTTP_201_CREATED)
async def add_connection(
    layout_id: int,
    connection: ConnectionCreate,
    db: Session = Depends(get_db)
):
    """Add a new connection between nodes in an organization layout"""
    # Check if layout exists
    layout = db.query(OrganizationLayout).filter(OrganizationLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with ID {layout_id} not found"
        )
    
    # Check if both nodes exist
    source_node = db.query(LayoutNode).filter(
        LayoutNode.id == connection.source_id,
        LayoutNode.layout_id == layout_id
    ).first()
    
    target_node = db.query(LayoutNode).filter(
        LayoutNode.id == connection.target_id,
        LayoutNode.layout_id == layout_id
    ).first()
    
    if not source_node or not target_node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source or target node not found in this layout"
        )
    
    # Check if connection already exists
    existing_connection = db.query(NodeConnection).filter(
        NodeConnection.layout_id == layout_id,
        NodeConnection.source_id == connection.source_id,
        NodeConnection.target_id == connection.target_id
    ).first()
    
    if existing_connection:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connection already exists between these nodes"
        )
    
    # Check for cycles if this is a hierarchical relationship
    if connection.connection_type == "reports_to":
        # Get all existing connections to build a graph
        all_connections = db.query(NodeConnection).filter(
            NodeConnection.layout_id == layout_id,
            NodeConnection.connection_type == "reports_to"
        ).all()
        
        # Build directed graph
        G = nx.DiGraph()
        for conn in all_connections:
            # Add edge from target (manager) to source (report)
            G.add_edge(conn.target_id, conn.source_id)
        
        # Check if adding this connection would create a cycle
        if check_for_cycle(G, connection.source_id, connection.target_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Adding this connection would create a cycle in the hierarchy"
            )
    
    # Create new connection
    new_connection = NodeConnection(
        layout_id=layout_id,
        source_id=connection.source_id,
        target_id=connection.target_id,
        connection_type=connection.connection_type,
        workload_impact=connection.workload_impact
    )
    
    db.add(new_connection)
    db.commit()
    db.refresh(new_connection)
    
    return {
        "id": new_connection.id,
        "layout_id": new_connection.layout_id,
        "source_id": new_connection.source_id,
        "target_id": new_connection.target_id,
        "connection_type": new_connection.connection_type,
        "workload_impact": new_connection.workload_impact,
        "message": "Connection added successfully"
    }

@router.delete("/layouts/{layout_id}/connections/{connection_id}")
async def delete_connection(
    layout_id: int,
    connection_id: int,
    db: Session = Depends(get_db)
):
    """Delete a connection from an organization layout"""
    # Check if connection exists and belongs to the specified layout
    connection = db.query(NodeConnection).filter(
        NodeConnection.id == connection_id,
        NodeConnection.layout_id == layout_id
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection with ID {connection_id} not found in layout {layout_id}"
        )
    
    db.delete(connection)
    db.commit()
    
    return {
        "message": "Connection deleted successfully"
    }

@router.post("/simulate/")
async def simulate_changes(
    simulation: SimulationRequest,
    db: Session = Depends(get_db)
):
    """Simulate changes to an organization layout and predict workload impact"""
    # Check if layout exists
    layout = db.query(OrganizationLayout).filter(OrganizationLayout.id == simulation.layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with ID {simulation.layout_id} not found"
        )
    
    # Get current state of the layout
    current_nodes = db.query(LayoutNode).filter(LayoutNode.layout_id == simulation.layout_id).all()
    current_connections = db.query(NodeConnection).filter(NodeConnection.layout_id == simulation.layout_id).all()
    
    # Build current directed graph for workload calculation
    current_graph = nx.DiGraph()
    
    for node in current_nodes:
        current_graph.add_node(node.id, metadata=node.node_metadata)
    
    for conn in current_connections:
        # Add edge from target (manager) to source (report)
        current_graph.add_edge(conn.target_id, conn.source_id, weight=conn.workload_impact)
    
    # Calculate current workload for each node
    current_workloads = {
        node.id: calculate_workload(current_graph, node.id)
        for node in current_nodes
    }
    
    # Apply simulated changes to create a new graph
    simulated_graph = current_graph.copy()
    
    # Process node removals
    if simulation.changes.remove_nodes:
        for node_id in simulation.changes.remove_nodes:
            if node_id in simulated_graph:
                simulated_graph.remove_node(node_id)
    
    # Process connection removals
    if simulation.changes.remove_connections:
        for conn_id in simulation.changes.remove_connections:
            # Find the connection
            conn = next((c for c in current_connections if c.id == conn_id), None)
            if conn:
                if simulated_graph.has_edge(conn.target_id, conn.source_id):
                    simulated_graph.remove_edge(conn.target_id, conn.source_id)
    
    # Process new nodes (assigning temporary ids)
    temp_id_counter = -1
    temp_to_real_id_map = {}
    
    if simulation.changes.add_nodes:
        for new_node in simulation.changes.add_nodes:
            simulated_graph.add_node(temp_id_counter, metadata=new_node.metadata.dict())
            temp_to_real_id_map[temp_id_counter] = temp_id_counter
            temp_id_counter -= 1
    
    # Process new connections
    if simulation.changes.add_connections:
        for new_conn in simulation.changes.add_connections:
            source_id = new_conn.source_id if new_conn.source_id > 0 else temp_to_real_id_map.get(new_conn.source_id)
            target_id = new_conn.target_id if new_conn.target_id > 0 else temp_to_real_id_map.get(new_conn.target_id)
            
            if source_id is not None and target_id is not None:
                # Check for cycles
                if check_for_cycle(simulated_graph, source_id, target_id):
                    continue  # Skip this connection as it would create a cycle
                
                simulated_graph.add_edge(target_id, source_id, weight=new_conn.workload_impact)
    
    # Process node updates
    if simulation.changes.update_nodes:
        for update in simulation.changes.update_nodes:
            node_id = update.get('id')
            if node_id and node_id in simulated_graph:
                # Update metadata if provided
                if 'metadata' in update:
                    current_metadata = simulated_graph.nodes[node_id].get('metadata', {})
                    if current_metadata:
                        current_metadata.update(update['metadata'])
                        simulated_graph.nodes[node_id]['metadata'] = current_metadata
    
    # Calculate new workload for each node
    simulated_workloads = {}
    for node_id in simulated_graph.nodes():
        if node_id > 0:  # Only include real nodes
            simulated_workloads[node_id] = calculate_workload(simulated_graph, node_id)
    
    # Calculate workload changes
    workload_changes = {}
    for node_id in simulated_workloads:
        if node_id in current_workloads:
            change = simulated_workloads[node_id] - current_workloads[node_id]
            workload_changes[node_id] = {
                "before": current_workloads[node_id],
                "after": simulated_workloads[node_id],
                "change": change,
                "percent_change": (change / current_workloads[node_id] * 100) if current_workloads[node_id] > 0 else float('inf')
            }
    
    # Store simulation results
    simulation_record = SimulationHistory(
        layout_id=simulation.layout_id,
        name=simulation.name or f"Simulation {datetime.now().isoformat()}",
        description=simulation.description,
        simulation_data=simulation.changes.dict(),
        results={
            "workload_changes": workload_changes,
            "simulated_workloads": simulated_workloads
        }
    )
    
    db.add(simulation_record)
    db.commit()
    db.refresh(simulation_record)
    
    return {
        "simulation_id": simulation_record.id,
        "layout_id": simulation.layout_id,
        "workload_changes": workload_changes,
        "message": "Simulation completed successfully"
    }

@router.post("/apply-simulation/")
async def apply_simulation(
    simulation_id: int,
    db: Session = Depends(get_db)
):
    """Apply simulated changes to an organization layout"""
    # Check if simulation exists
    simulation = db.query(SimulationHistory).filter(SimulationHistory.id == simulation_id).first()
    if not simulation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Simulation with ID {simulation_id} not found"
        )
    
    if simulation.applied:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This simulation has already been applied"
        )
    
    layout_id = simulation.layout_id
    changes = SimulationChange.parse_obj(simulation.simulation_data)
    
    # Apply changes to the actual layout
    # 1. Remove nodes
    if changes.remove_nodes:
        for node_id in changes.remove_nodes:
            node = db.query(LayoutNode).filter(
                LayoutNode.id == node_id,
                LayoutNode.layout_id == layout_id
            ).first()
            
            if node:
                db.delete(node)
    
    # 2. Remove connections
    if changes.remove_connections:
        for conn_id in changes.remove_connections:
            conn = db.query(NodeConnection).filter(
                NodeConnection.id == conn_id,
                NodeConnection.layout_id == layout_id
            ).first()
            
            if conn:
                db.delete(conn)
    
    # 3. Add new nodes
    new_node_ids = {}
    if changes.add_nodes:
        for i, node_data in enumerate(changes.add_nodes):
            new_node = LayoutNode(
                layout_id=layout_id,
                node_type=node_data.node_type,
                position_x=node_data.position.x,
                position_y=node_data.position.y,
                node_metadata=node_data.metadata.dict()
            )
            
            db.add(new_node)
            db.flush()  # Assign ID without committing transaction
            
            # Map temporary IDs to new real IDs
            new_node_ids[-(i+1)] = new_node.id
    
    # 4. Add new connections
    if changes.add_connections:
        for conn_data in changes.add_connections:
            # Map IDs if needed
            source_id = conn_data.source_id
            if source_id < 0 and source_id in new_node_ids:
                source_id = new_node_ids[source_id]
                
            target_id = conn_data.target_id
            if target_id < 0 and target_id in new_node_ids:
                target_id = new_node_ids[target_id]
            
            # Create new connection
            new_conn = NodeConnection(
                layout_id=layout_id,
                source_id=source_id,
                target_id=target_id,
                connection_type=conn_data.connection_type,
                workload_impact=conn_data.workload_impact
            )
            
            db.add(new_conn)
    
    # 5. Update nodes
    if changes.update_nodes:
        for update in changes.update_nodes:
            node_id = update.get('id')
            if node_id:
                node = db.query(LayoutNode).filter(
                    LayoutNode.id == node_id,
                    LayoutNode.layout_id == layout_id
                ).first()
                
                if node:
                    # Update node fields
                    if 'node_type' in update:
                        node.node_type = update['node_type']
                    
                    if 'position' in update:
                        position = update['position']
                        if 'x' in position:
                            node.position_x = position['x']
                        if 'y' in position:
                            node.position_y = position['y']
                    
                    if 'metadata' in update:
                        current_metadata = node.node_metadata or {}
                        current_metadata.update(update['metadata'])
                        node.node_metadata = current_metadata
    
    # Mark simulation as applied
    simulation.applied = True
    
    # Update layout's updated_at timestamp
    layout = db.query(OrganizationLayout).filter(OrganizationLayout.id == layout_id).first()
    if layout:
        layout.updated_at = func.now()
    
    db.commit()
    
    return {
        "simulation_id": simulation_id,
        "layout_id": layout_id,
        "message": "Simulation applied successfully"
    }

@router.get("/layouts/{layout_id}/optimize-suggestions")
async def get_optimization_suggestions(
    layout_id: int,
    db: Session = Depends(get_db)
):
    """Get suggestions for optimizing an organization layout"""
    # Check if layout exists
    layout = db.query(OrganizationLayout).filter(OrganizationLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with ID {layout_id} not found"
        )
    
    # Get current state of the layout
    nodes = db.query(LayoutNode).filter(LayoutNode.layout_id == layout_id).all()
    connections = db.query(NodeConnection).filter(NodeConnection.layout_id == layout_id).all()
    
    # Build directed graph for analysis
    G = nx.DiGraph()
    
    node_data = {}
    for node in nodes:
        G.add_node(node.id)
        node_data[node.id] = {
            "type": node.node_type,
            "metadata": node.node_metadata or {}
        }
    
    for conn in connections:
        # Edge from target (manager) to source (report)
        G.add_edge(conn.target_id, conn.source_id, id=conn.id, weight=conn.workload_impact)
    
    # Calculate workload for each node
    workloads = {
        node_id: calculate_workload(G, node_id)
        for node_id in G.nodes()
    }
    
    suggestions = []
    
    # Find overloaded managers (nodes with many outgoing edges)
    for node_id in G.nodes():
        workload = workloads.get(node_id, 0)
        direct_reports = list(G.successors(node_id))
        
        # Suggestion for overloaded managers
        if len(direct_reports) > 7 and workload > 100:
            # Find potential team leads among direct reports
            potential_leads = []
            for report_id in direct_reports:
                report_metadata = node_data.get(report_id, {}).get("metadata", {})
                skill_level = report_metadata.get("skill_level", 0)
                
                if skill_level and skill_level >= 7:
                    potential_leads.append({
                        "id": report_id,
                        "name": report_metadata.get("name", f"Node {report_id}"),
                        "skill_level": skill_level
                    })
            
            if potential_leads:
                suggestion = {
                    "type": "redistribute_workload",
                    "node_id": node_id,
                    "node_name": node_data.get(node_id, {}).get("metadata", {}).get("name", f"Node {node_id}"),
                    "current_workload": workload,
                    "direct_reports_count": len(direct_reports),
                    "potential_team_leads": potential_leads,
                    "recommendation": "Consider promoting one or more team members to team lead positions to reduce management overhead."
                }
                suggestions.append(suggestion)
    
    # Find bottlenecks (nodes with high workload that many others depend on)
    betweenness = nx.betweenness_centrality(G)
    for node_id, score in betweenness.items():
        if score > 0.3 and workloads.get(node_id, 0) > 80:
            suggestion = {
                "type": "bottleneck",
                "node_id": node_id,
                "node_name": node_data.get(node_id, {}).get("metadata", {}).get("name", f"Node {node_id}"),
                "current_workload": workloads.get(node_id, 0),
                "centrality_score": score,
                "recommendation": "This role is a critical bottleneck. Consider redistributing responsibilities or adding support staff."
            }
            suggestions.append(suggestion)
    
    # Look for hierarchy depth issues
    for node_id in G.nodes():
        depth = calculate_depth(G, node_id)
        if depth > 5:
            suggestion = {
                "type": "deep_hierarchy",
                "node_id": node_id,
                "node_name": node_data.get(node_id, {}).get("metadata", {}).get("name", f"Node {node_id}"),
                "hierarchy_depth": depth,
                "recommendation": "This org branch has a very deep hierarchy. Consider flattening by consolidating middle management layers."
            }
            suggestions.append(suggestion)
    
    return {
        "layout_id": layout_id,
        "suggestions": suggestions
    } 
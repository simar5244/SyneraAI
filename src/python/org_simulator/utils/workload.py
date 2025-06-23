import networkx as nx
from typing import List, Dict, Set, Any, Tuple
from sqlalchemy.orm import Session
from ..models.models import Role, Connection

def build_org_graph(db: Session, layout_id: int) -> nx.DiGraph:
    """
    Build a directed graph representing the organizational structure.
    
    Args:
        db: Database session
        layout_id: ID of the layout
        
    Returns:
        nx.DiGraph: Directed graph of the organization
    """
    # Get all roles and connections for this layout
    roles = db.query(Role).filter(Role.layout_id == layout_id).all()
    connections = db.query(Connection).filter(Connection.layout_id == layout_id).all()
    
    # Create a directed graph
    G = nx.DiGraph()
    
    # Add nodes (roles)
    for role in roles:
        G.add_node(
            role.id, 
            title=role.title,
            workload_hours=role.workload_hours,
            intensity_factor=role.intensity_factor,
            total_workload=role.get_total_workload()
        )
    
    # Add edges (connections)
    for conn in connections:
        G.add_edge(conn.from_role_id, conn.to_role_id, slot=conn.slot_used)
    
    return G

def check_for_cycles(db: Session, layout_id: int, from_role_id: int, to_role_id: int) -> bool:
    """
    Check if adding a connection would create a cycle in the organizational structure.
    
    Args:
        db: Database session
        layout_id: ID of the layout
        from_role_id: ID of the source role
        to_role_id: ID of the target role
        
    Returns:
        bool: True if adding the connection would create a cycle
    """
    # Build the graph
    G = build_org_graph(db, layout_id)
    
    # Temporarily add the new edge
    G.add_edge(from_role_id, to_role_id)
    
    # Check for cycles
    try:
        nx.find_cycle(G, source=from_role_id)
        return True  # Cycle found
    except nx.NetworkXNoCycle:
        return False  # No cycle found

def calculate_depth(G: nx.DiGraph, node_id: int) -> int:
    """
    Calculate the depth of a node in the organizational hierarchy.
    
    Args:
        G: Directed graph of the organization
        node_id: ID of the node (role)
        
    Returns:
        int: Depth of the node (0 for top-level nodes)
    """
    # Find all nodes with no incoming edges (top-level nodes)
    top_nodes = [n for n, d in G.in_degree() if d == 0]
    
    # If the node is a top-level node
    if node_id in top_nodes:
        return 0
    
    # For other nodes, find the longest path from a top-level node
    max_depth = 0
    for top_node in top_nodes:
        try:
            # Try to find a path from top node to this node
            path = nx.shortest_path(G, top_node, node_id)
            max_depth = max(max_depth, len(path) - 1)
        except nx.NetworkXNoPath:
            continue
    
    return max_depth

def get_descendants(G: nx.DiGraph, node_id: int) -> Set[int]:
    """
    Get all descendants of a node in the organizational hierarchy.
    
    Args:
        G: Directed graph of the organization
        node_id: ID of the node (role)
        
    Returns:
        Set[int]: Set of descendant node IDs
    """
    try:
        # Get all descendants (nodes reachable from this node)
        descendants = set(nx.descendants(G, node_id))
        return descendants
    except nx.NetworkXError:
        return set()

def get_ancestors(G: nx.DiGraph, node_id: int) -> Set[int]:
    """
    Get all ancestors of a node in the organizational hierarchy.
    
    Args:
        G: Directed graph of the organization
        node_id: ID of the node (role)
        
    Returns:
        Set[int]: Set of ancestor node IDs
    """
    try:
        # Get all ancestors (nodes that can reach this node)
        ancestors = set(nx.ancestors(G, node_id))
        return ancestors
    except nx.NetworkXError:
        return set()

def calculate_workload_impact(db: Session, 
                             layout_id: int, 
                             action_type: str, 
                             role_id: int = None,
                             from_role_id: int = None, 
                             to_role_id: int = None) -> Dict[int, float]:
    """
    Calculate the workload impact of an organizational change.
    
    Args:
        db: Database session
        layout_id: ID of the layout
        action_type: Type of action (create_role, delete_role, connect, disconnect)
        role_id: ID of the role being affected (for create_role, delete_role, move)
        from_role_id: ID of the source role (for connect, disconnect)
        to_role_id: ID of the target role (for connect, disconnect)
        
    Returns:
        Dict[int, float]: Dictionary mapping role IDs to workload change
    """
    # Build the graph
    G = build_org_graph(db, layout_id)
    
    impact = {}
    
    if action_type == "create_role":
        # New role has no immediate impact on others
        impact[role_id] = 0.0
        
    elif action_type == "delete_role":
        # Get the role's connections
        role = db.query(Role).filter(Role.id == role_id).first()
        if not role:
            return impact
            
        # Get descendants (direct reports)
        descendants = get_descendants(G, role_id)
        
        # Get ancestors (managers)
        ancestors = get_ancestors(G, role_id)
        
        # Workload increases for managers who will now manage the role's direct reports
        for ancestor_id in ancestors:
            impact[ancestor_id] = 5.0  # Increased workload for taking on more responsibility
        
        # Workload may change for direct reports who will now report to a different manager
        for desc_id in descendants:
            impact[desc_id] = 2.0  # Slight increase due to transition
            
    elif action_type == "connect":
        if from_role_id is None or to_role_id is None:
            return impact
            
        # The manager (to_role_id) takes on more responsibility
        manager = db.query(Role).filter(Role.id == to_role_id).first()
        if manager:
            # More direct reports = more workload
            outgoing_count = len([c for c in G.out_edges(to_role_id)])
            # Workload impact is higher for first few direct reports, then diminishes
            if outgoing_count == 0:
                impact[to_role_id] = 10.0  # First direct report has biggest impact
            elif outgoing_count < 3:
                impact[to_role_id] = 5.0   # Additional reports have less impact
            else:
                impact[to_role_id] = 2.0   # Diminishing returns
        
        # The direct report (from_role_id) might have different workload
        direct_report = db.query(Role).filter(Role.id == from_role_id).first()
        if direct_report:
            # Initially neutral impact
            impact[from_role_id] = 0.0
            
    elif action_type == "disconnect":
        if from_role_id is None or to_role_id is None:
            return impact
            
        # The manager (to_role_id) has less responsibility
        manager = db.query(Role).filter(Role.id == to_role_id).first()
        if manager:
            impact[to_role_id] = -5.0  # Reduced workload
        
        # The direct report (from_role_id) might have different workload
        direct_report = db.query(Role).filter(Role.id == from_role_id).first()
        if direct_report:
            impact[from_role_id] = 5.0  # Increased workload (more self-management)
    
    return impact

def slots_available(db: Session, role_id: int) -> List[int]:
    """
    Check which slots are available for a role.
    
    Args:
        db: Database session
        role_id: ID of the role
        
    Returns:
        List[int]: List of available slot numbers (1, 2, 3)
    """
    # Get connections where this role is the source
    connections = db.query(Connection).filter(Connection.from_role_id == role_id).all()
    
    # Get used slots
    used_slots = [c.slot_used for c in connections]
    
    # Return available slots
    return [slot for slot in [1, 2, 3] if slot not in used_slots] 
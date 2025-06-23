from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_
from .org_modeling_models import OrganizationLayout, LayoutNode, NodeConnection

class OrgWorkloadService:
    """Service for simulating and analyzing organization workload"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_node_hierarchy(self, layout_id: int) -> Dict[int, List[int]]:
        """
        Build a hierarchy map of who reports to whom
        Returns a dict where keys are manager node IDs and values are lists of direct report node IDs
        """
        connections = self.db.query(NodeConnection).filter(
            and_(
                NodeConnection.layout_id == layout_id,
                NodeConnection.connection_type == "reports_to"
            )
        ).all()
        
        hierarchy = {}
        for conn in connections:
            # Target is the manager, source is the direct report
            if conn.target_id not in hierarchy:
                hierarchy[conn.target_id] = []
            hierarchy[conn.target_id].append(conn.source_id)
        
        return hierarchy
    
    def calculate_node_workload(self, node_id: int, layout_id: int) -> float:
        """
        Calculate the workload for a specific node based on direct reports.
        
        Args:
            node_id: The ID of the node to calculate workload for
            layout_id: The ID of the organization layout
            
        Returns:
            Calculated workload value
        """
        # Base workload - everyone has some work
        base_workload = 40.0
        
        # Get direct reports
        direct_reports = self.db.query(NodeConnection).filter(
            and_(
                NodeConnection.layout_id == layout_id,
                NodeConnection.target_id == node_id,
                NodeConnection.connection_type == "reports_to"
            )
        ).count()
        
        # Simple workload calculation - could be made more sophisticated
        # Each direct report adds to workload, with diminishing returns
        workload_from_reports = 0
        for i in range(direct_reports):
            # First few reports add more workload than later ones
            # This reflects span of control considerations
            if i < 3:
                workload_from_reports += 10
            elif i < 6:
                workload_from_reports += 8
            elif i < 10:
                workload_from_reports += 6
            else:
                workload_from_reports += 5
        
        # Custom workload impacts from connections
        connection_impacts = self.db.query(NodeConnection).filter(
            and_(
                NodeConnection.layout_id == layout_id,
                NodeConnection.target_id == node_id
            )
        ).all()
        
        additional_workload = sum(conn.workload_impact for conn in connection_impacts)
        
        return base_workload + workload_from_reports + additional_workload
    
    def simulate_org_change(self, layout_id: int, changes: List[Dict[str, Any]]) -> Dict[int, Dict[str, float]]:
        """
        Simulate organizational changes and predict workload impacts.
        
        Args:
            layout_id: The ID of the organization layout
            changes: List of changes to simulate (add/remove connections)
                Each change is a dict with keys:
                - action: "add" or "remove"
                - source_id: Node ID that reports to another
                - target_id: Node ID that is reported to
                
        Returns:
            Dictionary mapping node IDs to their before/after workload values
        """
        # Get current hierarchy and calculate current workloads
        nodes = self.db.query(LayoutNode).filter(LayoutNode.layout_id == layout_id).all()
        node_ids = [node.id for node in nodes]
        
        current_workloads = {}
        for node_id in node_ids:
            current_workloads[node_id] = self.calculate_node_workload(node_id, layout_id)
        
        # Apply changes temporarily in memory
        temp_connections = self.db.query(NodeConnection).filter(
            and_(
                NodeConnection.layout_id == layout_id,
                NodeConnection.connection_type == "reports_to"
            )
        ).all()
        
        # Create a set of connection tuples for easier manipulation
        conn_set = {(conn.source_id, conn.target_id) for conn in temp_connections}
        
        # Apply changes
        for change in changes:
            if change["action"] == "add":
                conn_set.add((change["source_id"], change["target_id"]))
            elif change["action"] == "remove":
                if (change["source_id"], change["target_id"]) in conn_set:
                    conn_set.remove((change["source_id"], change["target_id"]))
        
        # Calculate new workloads based on simulated changes
        # This is a simplified version - in a real implementation, we'd 
        # need to account for more complex workload calculations
        new_workloads = {}
        
        # Create a temporary hierarchy
        temp_hierarchy = {}
        for source, target in conn_set:
            if target not in temp_hierarchy:
                temp_hierarchy[target] = []
            temp_hierarchy[target].append(source)
        
        # Calculate new workloads
        for node_id in node_ids:
            # Base workload
            workload = 40.0
            
            # Add workload from direct reports
            direct_reports = len(temp_hierarchy.get(node_id, []))
            
            workload_from_reports = 0
            for i in range(direct_reports):
                if i < 3:
                    workload_from_reports += 10
                elif i < 6:
                    workload_from_reports += 8
                elif i < 10:
                    workload_from_reports += 6
                else:
                    workload_from_reports += 5
            
            new_workloads[node_id] = workload + workload_from_reports
        
        # Return comparison of workloads
        result = {}
        for node_id in node_ids:
            result[node_id] = {
                "before": current_workloads.get(node_id, 0),
                "after": new_workloads.get(node_id, 0),
                "change": new_workloads.get(node_id, 0) - current_workloads.get(node_id, 0)
            }
            
        return result
    
    def save_simulation(self, layout_id: int, changes: List[Dict[str, Any]]) -> bool:
        """
        Apply simulated changes to the actual organization layout.
        
        Args:
            layout_id: The ID of the organization layout
            changes: List of changes to apply (add/remove connections)
            
        Returns:
            Boolean indicating success
        """
        try:
            for change in changes:
                if change["action"] == "add":
                    # Check if connection already exists
                    existing = self.db.query(NodeConnection).filter(
                        and_(
                            NodeConnection.layout_id == layout_id,
                            NodeConnection.source_id == change["source_id"],
                            NodeConnection.target_id == change["target_id"],
                            NodeConnection.connection_type == "reports_to"
                        )
                    ).first()
                    
                    if not existing:
                        new_conn = NodeConnection(
                            layout_id=layout_id,
                            source_id=change["source_id"],
                            target_id=change["target_id"],
                            connection_type="reports_to",
                            workload_impact=change.get("workload_impact", 10.0)
                        )
                        self.db.add(new_conn)
                
                elif change["action"] == "remove":
                    self.db.query(NodeConnection).filter(
                        and_(
                            NodeConnection.layout_id == layout_id,
                            NodeConnection.source_id == change["source_id"],
                            NodeConnection.target_id == change["target_id"],
                            NodeConnection.connection_type == "reports_to"
                        )
                    ).delete()
            
            self.db.commit()
            return True
        
        except Exception as e:
            self.db.rollback()
            print(f"Error saving simulation: {e}")
            return False
    
    def get_node_depth(self, layout_id: int) -> Dict[int, int]:
        """
        Calculate the depth of each node in the organizational hierarchy
        Returns a dict where keys are node IDs and values are their depth (0 for root nodes)
        """
        connections = self.db.query(NodeConnection).filter(
            NodeConnection.layout_id == layout_id,
            NodeConnection.connection_type == "reports_to"
        ).all()
        
        # First, identify all nodes that are direct reports (sources)
        direct_reports = set(conn.source_id for conn in connections)
        
        # Find root nodes (all nodes that are targets but not sources)
        all_managers = set(conn.target_id for conn in connections)
        root_nodes = all_managers - direct_reports
        
        # Build an adjacency list for the hierarchy
        # Key: manager_id, Value: list of direct reports
        hierarchy = {}
        for conn in connections:
            if conn.target_id not in hierarchy:
                hierarchy[conn.target_id] = []
            hierarchy[conn.target_id].append(conn.source_id)
        
        # Breadth-first search to assign depth to each node
        depths = {node_id: 0 for node_id in root_nodes}
        queue = [(node_id, 0) for node_id in root_nodes]
        
        while queue:
            node_id, depth = queue.pop(0)
            
            # Process direct reports of this node
            for direct_report in hierarchy.get(node_id, []):
                if direct_report not in depths:
                    depths[direct_report] = depth + 1
                    queue.append((direct_report, depth + 1))
        
        return depths
    
    def detect_cycles(self, layout_id: int) -> List[List[int]]:
        """
        Detect cycles in the organizational hierarchy
        Returns a list of cycles, where each cycle is a list of node IDs
        """
        connections = self.db.query(NodeConnection).filter(
            NodeConnection.layout_id == layout_id,
            NodeConnection.connection_type == "reports_to"
        ).all()
        
        # Build directed graph for cycle detection
        graph = {}
        for conn in connections:
            if conn.source_id not in graph:
                graph[conn.source_id] = []
            graph[conn.source_id].append(conn.target_id)
            
            # Ensure all nodes are in the graph
            if conn.target_id not in graph:
                graph[conn.target_id] = []
        
        # Implementation of cycle detection using DFS
        cycles = []
        visited = set()
        rec_stack = set()
        
        def dfs_cycle(node, path):
            if node in rec_stack:
                # Found a cycle
                cycle_start = path.index(node)
                cycles.append(path[cycle_start:])
                return True
            
            if node in visited:
                return False
            
            visited.add(node)
            rec_stack.add(node)
            path.append(node)
            
            for neighbor in graph.get(node, []):
                if dfs_cycle(neighbor, path.copy()):
                    return True
            
            rec_stack.remove(node)
            return False
        
        # Run DFS from each node
        for node in graph:
            if node not in visited:
                dfs_cycle(node, [])
        
        return cycles
    
    def suggest_optimal_organization(self, layout_id: int) -> Dict[str, Any]:
        """
        Suggest optimal organization changes based on span of control and workload
        Returns suggestions for improving the organization structure
        """
        # Get current hierarchy and workloads
        hierarchy = self.get_node_hierarchy(layout_id)
        nodes = self.db.query(LayoutNode).filter(LayoutNode.layout_id == layout_id).all()
        
        node_workloads = {}
        for node in nodes:
            node_workloads[node.id] = self.calculate_node_workload(node.id, layout_id)
        
        suggestions = {
            "overloaded_managers": [],
            "underutilized_managers": [],
            "restructuring_suggestions": []
        }
        
        # Find overloaded and underutilized managers
        for node_id, direct_reports in hierarchy.items():
            workload = node_workloads.get(node_id, 40)
            num_reports = len(direct_reports)
            
            # Analyze span of control
            if num_reports > 7:
                # Overloaded manager - suggest splitting reports
                manager_node = next((n for n in nodes if n.id == node_id), None)
                manager_name = manager_node.node_metadata.get("name", f"Node {node_id}") if manager_node and manager_node.node_metadata else f"Node {node_id}"
                
                # Group direct reports for redistribution
                suggestions["overloaded_managers"].append({
                    "node_id": node_id,
                    "name": manager_name,
                    "num_reports": num_reports,
                    "workload": workload,
                    "suggestion": "Consider adding a layer of middle management to reduce span of control",
                    "potential_groups": self._suggest_groupings(direct_reports, nodes)
                })
            
            elif num_reports <= 2 and node_id not in [n.id for n in nodes if n.id not in sum([reps for _, reps in hierarchy.items()], [])]:
                # Underutilized manager - not a leaf node but has few reports
                manager_node = next((n for n in nodes if n.id == node_id), None)
                manager_name = manager_node.node_metadata.get("name", f"Node {node_id}") if manager_node and manager_node.node_metadata else f"Node {node_id}"
                
                suggestions["underutilized_managers"].append({
                    "node_id": node_id,
                    "name": manager_name,
                    "num_reports": num_reports,
                    "workload": workload,
                    "suggestion": "Consider consolidating with another manager role or expanding responsibilities"
                })
        
        # Analyze overall structure
        depth_map = self.get_node_depth(layout_id)
        max_depth = max(depth_map.values()) if depth_map else 0
        
        # Check for cycles (should never happen in a proper org chart)
        cycles = self.detect_cycles(layout_id)
        if cycles:
            suggestions["restructuring_suggestions"].append({
                "issue": "Circular reporting structure detected",
                "suggestion": "Resolve circular reporting relationships",
                "cycles": cycles
            })
        
        # Check organization depth
        if max_depth > 5:
            suggestions["restructuring_suggestions"].append({
                "issue": "Organization too deep",
                "suggestion": "Consider flattening the organization to reduce bureaucracy",
                "current_depth": max_depth
            })
        elif max_depth < 2 and len(nodes) > 10:
            suggestions["restructuring_suggestions"].append({
                "issue": "Organization too flat for its size",
                "suggestion": "Consider adding middle management to improve coordination",
                "current_depth": max_depth
            })
        
        return suggestions
    
    def _suggest_groupings(self, node_ids: List[int], nodes: List[LayoutNode]) -> List[Dict[str, Any]]:
        """Helper method to suggest potential groupings for direct reports"""
        # This is a simplified implementation - a real one would use metadata
        # to group similar roles or analyze existing structures
        
        if len(node_ids) <= 5:
            return []
            
        # Get metadata for these nodes
        node_metadata = {}
        for node in nodes:
            if node.id in node_ids and node.node_metadata:
                node_metadata[node.id] = node.node_metadata
        
        # Simple grouping by department if available
        departments = {}
        for node_id in node_ids:
            meta = node_metadata.get(node_id, {})
            dept = meta.get("department", "Unknown")
            
            if dept not in departments:
                departments[dept] = []
            departments[dept].append(node_id)
        
        # Create grouping suggestions
        suggestions = []
        for dept, dept_nodes in departments.items():
            if len(dept_nodes) > 2:
                suggestions.append({
                    "group_name": dept,
                    "node_ids": dept_nodes,
                    "suggestion": f"Create a dedicated manager for the {dept} group"
                })
        
        # If no department groupings are meaningful, suggest balanced groups
        if not suggestions and len(node_ids) > 8:
            # Create balanced groups of 4-6 direct reports
            group_size = 5
            num_groups = (len(node_ids) + group_size - 1) // group_size
            
            for i in range(num_groups):
                start_idx = i * group_size
                end_idx = min((i + 1) * group_size, len(node_ids))
                
                suggestions.append({
                    "group_name": f"Group {i+1}",
                    "node_ids": node_ids[start_idx:end_idx],
                    "suggestion": f"Create a new middle manager for this group of {end_idx - start_idx} employees"
                })
        
        return suggestions 
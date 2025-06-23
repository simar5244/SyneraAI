from typing import Dict, Any, List, Set
from sqlalchemy.orm import Session
from org_modeling_models import LayoutNode, NodeConnection
from org_modeling_schemas import PositionInfo, WorkloadImpactAnalysis

class WorkloadModelingService:
    @staticmethod
    def calculate_node_workload(node_id: int, db: Session) -> float:
        """Calculate the workload for a single node based on connections"""
        node = db.query(LayoutNode).filter(LayoutNode.id == node_id).first()
        if not node:
            return 40.0  # Default workload
        
        # Base workload from user's hours
        base_workload = node.user.workload_hours
        
        # Add impact from incoming connections (people reporting to this node)
        reporting_impact = sum(conn.workload_impact for conn in node.incoming_connections)
        
        # Subtract impact from outgoing connections (delegated work)
        delegation_impact = sum(
            conn.workload_impact 
            for conn in node.outgoing_connections 
            if conn.connection_type == "delegation"
        )
        
        # Calculate final workload (constrained between 0-100%)
        final_workload = min(100, max(0, base_workload + reporting_impact - delegation_impact))
        
        return final_workload
    
    @staticmethod
    def simulate_connection_change(
        source_id: int, 
        target_id: int, 
        connection_type: str,
        db: Session
    ) -> WorkloadImpactAnalysis:
        """Simulate the impact of adding or changing a connection"""
        source_node = db.query(LayoutNode).filter(LayoutNode.id == source_id).first()
        target_node = db.query(LayoutNode).filter(LayoutNode.id == target_id).first()
        
        if not source_node or not target_node:
            raise ValueError("Source or target node not found")
        
        # Store original workloads
        original_source_workload = source_node.current_workload
        original_target_workload = target_node.current_workload
        
        # Calculate workload impact based on connection type
        if connection_type == "reporting":
            # When someone reports to you, your workload increases
            workload_impact = min(15, target_node.user.workload_hours * 0.1)
            
            # Simulate adding this connection
            new_target_workload = min(100, original_target_workload + workload_impact)
            
            # The source node's workload might decrease slightly from having a manager
            new_source_workload = max(0, original_source_workload - 5)
        elif connection_type == "delegation":
            # When you delegate to someone, their workload increases, yours decreases
            workload_impact = min(20, source_node.user.workload_hours * 0.15)
            
            # Simulate adding this connection
            new_target_workload = min(100, original_target_workload + workload_impact)
            new_source_workload = max(0, original_source_workload - workload_impact * 0.8)
        else:
            # For other connection types
            workload_impact = 5
            new_target_workload = original_target_workload  # No change by default
            new_source_workload = original_source_workload  # No change by default
        
        # Generate pros and cons
        pros = []
        cons = []
        
        # For reporting relationships
        if connection_type == "reporting":
            if new_target_workload > 85:
                cons.append(f"{target_node.user.name}'s workload will exceed 85% which may lead to burnout")
            
            # Check for skill overlap between source and target
            source_skills = set(source_node.user.skills)
            target_skills = set(target_node.user.skills)
            skill_overlap = len(source_skills.intersection(target_skills))
            
            if skill_overlap > 0:
                pros.append(f"Good skill alignment with {skill_overlap} shared skills")
            else:
                cons.append("No common skills between manager and direct report")
                
            # Check spans of control
            report_count = db.query(NodeConnection).filter(
                NodeConnection.target_id == target_id,
                NodeConnection.connection_type == "reporting"
            ).count()
            
            if report_count > 7:
                cons.append(f"{target_node.user.name} will have more than 7 direct reports, which may be too many")
            elif report_count < 2:
                pros.append(f"Helps {target_node.user.name} build management experience")
        
        # For delegation
        if connection_type == "delegation":
            if new_target_workload > 85:
                cons.append(f"Delegating this work will overload {target_node.user.name}")
            else:
                pros.append(f"Reduces {source_node.user.name}'s workload by {round(original_source_workload - new_source_workload)}%")
        
        # Connected node impacts
        connected_nodes = [
            {
                "id": source_node.user_id,
                "name": source_node.user.name,
                "previous_workload": original_source_workload,
                "new_workload": new_source_workload,
                "change": new_source_workload - original_source_workload
            },
            {
                "id": target_node.user_id,
                "name": target_node.user.name,
                "previous_workload": original_target_workload,
                "new_workload": new_target_workload,
                "change": new_target_workload - original_target_workload
            }
        ]
        
        return WorkloadImpactAnalysis(
            node_id=source_id,
            previous_workload=original_source_workload,
            updated_workload=new_source_workload,
            connected_nodes=connected_nodes,
            pros=pros,
            cons=cons
        )
    
    @staticmethod
    def apply_connection(
        source_id: int, 
        target_id: int, 
        connection_type: str,
        db: Session
    ) -> Dict[str, Any]:
        """Apply a new connection and update all affected workloads"""
        # Check if connection already exists
        existing_conn = db.query(NodeConnection).filter(
            NodeConnection.source_id == source_id,
            NodeConnection.target_id == target_id
        ).first()
        
        if existing_conn:
            # Update existing connection
            existing_conn.connection_type = connection_type
            workload_impact = min(15, 5 + source_id % 10)  # Simple formula for demo
            existing_conn.workload_impact = workload_impact
        else:
            # Create new connection
            workload_impact = min(15, 5 + source_id % 10)  # Simple formula for demo
            new_conn = NodeConnection(
                source_id=source_id,
                target_id=target_id,
                connection_type=connection_type,
                workload_impact=workload_impact
            )
            db.add(new_conn)
        
        # Update node workloads
        source_node = db.query(LayoutNode).filter(LayoutNode.id == source_id).first()
        target_node = db.query(LayoutNode).filter(LayoutNode.id == target_id).first()
        
        if source_node:
            source_node.current_workload = WorkloadModelingService.calculate_node_workload(source_id, db)
        
        if target_node:
            target_node.current_workload = WorkloadModelingService.calculate_node_workload(target_id, db)
        
        db.commit()
        
        # Get all affected nodes for response
        affected_nodes = {}
        if source_node:
            affected_nodes[source_id] = {
                "id": source_id,
                "user_id": source_node.user_id,
                "name": source_node.user.name,
                "workload": source_node.current_workload
            }
        
        if target_node:
            affected_nodes[target_id] = {
                "id": target_id,
                "user_id": target_node.user_id,
                "name": target_node.user.name,
                "workload": target_node.current_workload
            }
        
        return {
            "connection_id": existing_conn.id if existing_conn else db.query(NodeConnection).filter(
                NodeConnection.source_id == source_id,
                NodeConnection.target_id == target_id
            ).first().id,
            "affected_nodes": list(affected_nodes.values())
        }
    
    @staticmethod
    def remove_connection(connection_id: int, db: Session) -> Dict[str, Any]:
        """Remove a connection and update all affected workloads"""
        connection = db.query(NodeConnection).filter(NodeConnection.id == connection_id).first()
        if not connection:
            raise ValueError("Connection not found")
        
        source_id = connection.source_id
        target_id = connection.target_id
        
        # Delete the connection
        db.delete(connection)
        
        # Get the affected nodes before committing the delete
        source_node = db.query(LayoutNode).filter(LayoutNode.id == source_id).first()
        target_node = db.query(LayoutNode).filter(LayoutNode.id == target_id).first()
        
        # Commit the deletion
        db.commit()
        
        # Update node workloads
        affected_nodes = {}
        
        if source_node:
            source_node.current_workload = WorkloadModelingService.calculate_node_workload(source_id, db)
            db.commit()
            affected_nodes[source_id] = {
                "id": source_id,
                "user_id": source_node.user_id,
                "name": source_node.user.name,
                "workload": source_node.current_workload
            }
        
        if target_node:
            target_node.current_workload = WorkloadModelingService.calculate_node_workload(target_id, db)
            db.commit()
            affected_nodes[target_id] = {
                "id": target_id,
                "user_id": target_node.user_id,
                "name": target_node.user.name,
                "workload": target_node.current_workload
            }
        
        return {
            "removed_connection_id": connection_id,
            "affected_nodes": list(affected_nodes.values())
        }
    
    @staticmethod
    def update_node_position(node_id: int, position: PositionInfo, db: Session) -> Dict[str, Any]:
        """Update a node's position in the layout"""
        node = db.query(LayoutNode).filter(LayoutNode.id == node_id).first()
        if not node:
            raise ValueError("Node not found")
        
        node.x_position = position.x
        node.y_position = position.y
        db.commit()
        
        return {
            "node_id": node_id,
            "position": {
                "x": position.x,
                "y": position.y
            }
        } 
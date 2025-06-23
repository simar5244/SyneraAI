import mongo_adapter
from typing import List, Dict, Any
from services.workload_service import WorkloadService

class ChartService:
    def build_org_chart(self) -> Dict[str, Any]:
        """Build full organizational chart structure"""
        # Find all top-level users (those without managers)
        root_users = [user for user in mongo_adapter.get_users() if not user.get("manager_id")]
        
        # Build the tree structure
        root_nodes = [self._build_node(user) for user in root_users]
        
        # Get stress zones
        workload_service = WorkloadService()
        stress_zones = workload_service.get_org_stress_zones()
        
        return {
            "root_nodes": root_nodes,
            "stress_zones": stress_zones
        }
    
    def _build_node(self, user: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively build a node and its children for the org chart"""
        # Calculate stress level
        workload_service = WorkloadService()
        stress_level, stress_intensity = workload_service.calculate_stress_level(user["id"])
        
        # Get subordinates
        subordinates = mongo_adapter.get_user_by_manager(user["id"])
        
        # Build children nodes
        children = [self._build_node(subordinate) for subordinate in subordinates]
        
        # Calculate workload
        workload_hours = workload_service.calculate_workload(user["id"])
        
        return {
            "id": user["id"],
            "name": user.get("name", ""),
            "role": user.get("role", ""),
            "tier": user.get("tier", 0),
            "avatar_url": user.get("avatar_url", None),
            "workload_hours": workload_hours,
            "stress_level": stress_level,
            "stress_intensity": stress_intensity,
            "children": children
        } 
import mongo_adapter
from typing import Dict, List, Tuple, Any

class WorkloadService:
    def calculate_workload(self, user_id: str) -> float:
        """Calculate total workload hours for a user based on projects and responsibilities"""
        user = mongo_adapter.get_user(user_id)
        if not user:
            return 0.0
            
        # Base hours from responsibilities
        responsibility_hours = len(user.get("responsibilities", [])) * 2.5  # Estimate 2.5 hours per responsibility
        
        # Hours from projects
        project_hours = 0.0
        user_projects = mongo_adapter.get_user_projects(user_id)
        
        for project in user_projects:
            if project.get("status") == "active":
                # Get number of team members
                project_members = mongo_adapter.get_project_users(project["id"])
                team_size = len(project_members) or 1  # Avoid division by zero
                
                # Simplified calculation - in reality would be more complex
                project_hours += project.get("estimated_hours", 0.0) / team_size
                
        return responsibility_hours + project_hours
    
    def calculate_stress_level(self, user_id: str) -> Tuple[float, str]:
        """
        Calculate stress level for a user
        Returns:
            - stress_level: float (-1 to 1)
            - stress_intensity: category string for frontend visualization
        """
        user = mongo_adapter.get_user(user_id)
        if not user:
            return 0.0, "none"
            
        # Get role baseline (would be more sophisticated in production)
        role_baseline = 40.0  # Standard workweek
        
        # Calculate actual workload
        actual_workload = self.calculate_workload(user_id)
        
        # Calculate difference from baseline
        hours_difference = actual_workload - role_baseline
        
        # Convert to a normalized stress level (-1 to 1 scale)
        if hours_difference == 0:
            return 0.0, "none"
        
        # Calculate stress intensity category
        if hours_difference > 0:
            # Overworked (positive stress)
            if hours_difference <= 4:
                return min(hours_difference / 20, 1.0), "none"
            elif hours_difference <= 9:
                return min(hours_difference / 20, 1.0), "light-orange"
            elif hours_difference <= 14:
                return min(hours_difference / 20, 1.0), "orange"
            elif hours_difference <= 19:
                return min(hours_difference / 20, 1.0), "deep-orange"
            else:
                return 1.0, "red"
        else:
            # Underworked (negative stress)
            hours_difference = abs(hours_difference)
            if hours_difference <= 4:
                return max(-hours_difference / 20, -1.0), "none"
            elif hours_difference <= 9:
                return max(-hours_difference / 20, -1.0), "light-blue"
            elif hours_difference <= 14:
                return max(-hours_difference / 20, -1.0), "blue"
            else:
                return -1.0, "deep-blue"
    
    def get_org_stress_zones(self) -> Dict[str, List[str]]:
        """Get stress zones across the organization"""
        users = mongo_adapter.get_users()
        stress_zones = {
            "none": [],
            "light-blue": [],
            "blue": [],
            "deep-blue": [],
            "light-orange": [],
            "orange": [],
            "deep-orange": [],
            "red": []
        }
        
        for user in users:
            _, stress_intensity = self.calculate_stress_level(user["id"])
            stress_zones[stress_intensity].append(user["id"])
            
        return stress_zones 
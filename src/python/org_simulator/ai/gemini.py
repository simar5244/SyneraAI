import os
import google.generativeai as genai
from typing import List, Dict, Any, Optional, Tuple
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

# Configure the Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

class GeminiAI:
    """Interface for Google's Gemini AI API."""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize the Gemini AI interface."""
        if api_key:
            genai.configure(api_key=api_key)
        elif not GEMINI_API_KEY:
            raise ValueError("No Gemini API key provided")
        
        # Configure the model
        self.model = genai.GenerativeModel('gemini-pro')
        
    async def calculate_intensity_factor(self, 
                                   project_complexity: str,
                                   task_urgency: str,
                                   people_involved: int,
                                   revenue_impact: str,
                                   seniority_level: str) -> float:
        """
        Calculate an intensity factor for workload based on inputs.
        
        Args:
            project_complexity: "simple", "medium", or "complex"
            task_urgency: "low", "medium", or "critical"
            people_involved: Number of people involved
            revenue_impact: Impact on revenue (e.g., "low", "medium", "high")
            seniority_level: Seniority level of the role (e.g., "junior", "mid", "senior")
            
        Returns:
            float: Intensity factor (0.1 to 2.0, with 1.0 being normal intensity)
        """
        prompt = f"""
        Based on the following job factors, calculate an intensity factor between 0.1 and 2.0,
        where 1.0 represents normal intensity, <1.0 is lighter than normal, and >1.0 is heavier than normal.
        
        Job Factors:
        - Project complexity: {project_complexity}
        - Task urgency: {task_urgency}
        - Number of people involved: {people_involved}
        - Impact on revenue: {revenue_impact}
        - Role seniority level: {seniority_level}
        
        Return ONLY a number between 0.1 and 2.0, with no explanation or additional text.
        """
        
        try:
            response = self.model.generate_content(prompt)
            # Extract just the number from the response
            intensity_factor = float(response.text.strip())
            # Ensure the value is within bounds
            intensity_factor = max(0.1, min(2.0, intensity_factor))
            return intensity_factor
        except Exception as e:
            print(f"Error calculating intensity factor: {e}")
            # Return default intensity factor if there's an error
            return 1.0
            
    async def generate_pros_cons(self, 
                          action_type: str,
                          role_data: Dict[str, Any],
                          connections_data: List[Dict[str, Any]] = None,
                          org_structure: Dict[str, Any] = None) -> Tuple[List[str], List[str]]:
        """
        Generate pros and cons for an organizational change.
        
        Args:
            action_type: Type of action (create_role, delete_role, connect, disconnect)
            role_data: Data about the role being modified
            connections_data: Data about the connections being modified
            org_structure: Overall organization structure
            
        Returns:
            Tuple containing lists of pros and cons
        """
        # Format the data for the prompt
        role_json = json.dumps(role_data, indent=2)
        connections_json = json.dumps(connections_data, indent=2) if connections_data else "None"
        
        prompt = f"""
        I need to analyze the pros and cons of the following organizational change:
        
        Action Type: {action_type}
        
        Role Details:
        {role_json}
        
        Connection Details:
        {connections_json}
        
        Based on this information, generate exactly 3 pros and 3 cons of making this change.
        Format your response as a JSON object with two arrays: "pros" and "cons".
        Keep each point concise and focused on organizational impact.
        """
        
        try:
            response = self.model.generate_content(prompt)
            # Parse the JSON response
            result = json.loads(response.text)
            pros = result.get("pros", [])
            cons = result.get("cons", [])
            
            # Ensure we have exactly 3 pros and 3 cons
            while len(pros) < 3:
                pros.append("Potential improvement in organizational structure")
            while len(cons) < 3:
                cons.append("May require adjustment period")
                
            return pros[:3], cons[:3]
        except Exception as e:
            print(f"Error generating pros and cons: {e}")
            # Return default pros and cons if there's an error
            default_pros = [
                "May improve organizational efficiency",
                "Could better distribute workload",
                "Potential for improved role clarity"
            ]
            default_cons = [
                "May require adjustment period",
                "Could temporarily impact productivity",
                "Potential for communication challenges"
            ]
            return default_pros, default_cons 
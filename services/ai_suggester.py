import os
import json
from typing import Dict, List, Any, Optional
import requests
from dotenv import load_dotenv
import mongo_adapter
from services.chart_service import ChartService
from services.workload_service import WorkloadService

# Load environment variables
load_dotenv(".env.local")

class AISuggester:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.api_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
    
    async def suggest_placement(self, user_id: str) -> Dict[str, Any]:
        """Generate AI suggestions for better placement of a user within the org chart"""
        user = mongo_adapter.get_user(user_id)
        if not user:
            return {"error": "User not found"}
        
        # Get current manager
        manager = mongo_adapter.get_user(user.get("manager_id")) if user.get("manager_id") else None
        
        # Get skills and responsibilities
        skills = user.get("skills", [])
        responsibilities = user.get("responsibilities", [])
        
        # Get potential managers (all users above this user's tier)
        potential_managers = []
        for potential_manager in mongo_adapter.get_users():
            if potential_manager.get("tier", 0) < user.get("tier", 0) and potential_manager["id"] != user.get("manager_id"):
                potential_managers.append(potential_manager)
        
        # Get organization chart for context
        chart_service = ChartService()
        org_chart = chart_service.build_org_chart()
        
        # Prepare prompt for AI
        prompt = self._create_placement_prompt(
            user=user,
            current_manager=manager,
            skills=skills,
            responsibilities=responsibilities,
            potential_managers=potential_managers[:5],  # Limit to 5 for clarity
            org_chart=org_chart
        )
        
        # Call Gemini API
        response = await self._call_gemini_api(prompt)
        
        # Process and return suggestions
        return self._process_placement_response(response, user_id)
    
    async def simulate_deletion(self, user_id: str) -> Dict[str, Any]:
        """Simulate deletion of a user and suggest workload redistribution"""
        user = mongo_adapter.get_user(user_id)
        if not user:
            return {"error": "User not found"}
        
        # Get team members (siblings and subordinates)
        siblings = []
        if user.get("manager_id"):
            siblings = mongo_adapter.get_user_by_manager(user.get("manager_id"))
            # Remove the user from siblings
            siblings = [s for s in siblings if s["id"] != user_id]
        
        # Get subordinates
        subordinates = mongo_adapter.get_user_by_manager(user_id)
        
        # Calculate current workload
        workload_service = WorkloadService()
        workload = workload_service.calculate_workload(user_id)
        
        # Get projects
        projects = mongo_adapter.get_user_projects(user_id)
        
        # Prepare prompt for AI
        prompt = self._create_deletion_prompt(
            user=user,
            workload=workload,
            siblings=siblings,
            subordinates=subordinates,
            projects=projects
        )
        
        # Call Gemini API
        response = await self._call_gemini_api(prompt)
        
        # Process and return suggestions
        return self._process_deletion_response(response, user_id)
    
    async def infer_skills_from_responsibilities(self, responsibilities: List[str]) -> List[str]:
        """Use Gemini API to infer skills from responsibility descriptions"""
        if not responsibilities:
            return []
            
        # Create prompt
        responsibilities_text = "\n".join([f"- {r}" for r in responsibilities])
        prompt = f"""
        Based on the following job responsibilities, identify 3-7 core professional skills this person likely possesses.
        Return ONLY a list of skills, with no explanations or additional text.
        
        RESPONSIBILITIES:
        {responsibilities_text}
        
        SKILLS (3-7 items):
        """
        
        # Call Gemini API
        response = await self._call_gemini_api(prompt)
        
        # Process response (simple parsing, would be more robust in production)
        skills_text = self._extract_text_from_response(response)
        
        # Extract skills from response (assuming one skill per line, handling bulletpoints)
        skills = []
        for line in skills_text.split('\n'):
            line = line.strip()
            # Remove bullet points or numbers
            if line.startswith('- '):
                line = line[2:].strip()
            elif line.startswith('* '):
                line = line[2:].strip()
            elif len(line) > 2 and line[0].isdigit() and line[1] == '.':
                line = line[2:].strip()
            
            if line and not line.lower().startswith(('skill', 'here')):
                skills.append(line)
        
        # Limit to 7 skills
        return skills[:7]
    
    def _create_placement_prompt(self, user, current_manager, skills, responsibilities, potential_managers, org_chart) -> str:
        """Create prompt for placement suggestions"""
        return f"""
        As an organizational AI advisor, analyze this employee's current position and suggest 1-3 better placements:
        
        EMPLOYEE INFORMATION:
        - ID: {user["id"]}
        - Name: {user.get("name", "")}
        - Current Role: {user.get("role", "")}
        - Tier: {user.get("tier", 0)}
        - Skills: {json.dumps(skills)}
        - Responsibilities: {json.dumps(responsibilities)}
        - Current workload hours: {user.get("workload_hours", 0)}
        
        CURRENT MANAGER:
        {json.dumps({
            "id": current_manager["id"] if current_manager else None,
            "name": current_manager.get("name", "") if current_manager else None,
            "role": current_manager.get("role", "") if current_manager else None,
            "tier": current_manager.get("tier", 0) if current_manager else None
        })}
        
        POTENTIAL MANAGERS (LIMITED SELECTION):
        {json.dumps([{
            "id": m["id"],
            "name": m.get("name", ""),
            "role": m.get("role", ""),
            "tier": m.get("tier", 0),
            "team_size": len(mongo_adapter.get_user_by_manager(m["id"]))
        } for m in potential_managers])}
        
        ORGANIZATIONAL CONTEXT:
        {json.dumps(org_chart)}
        
        TASK:
        1. Suggest 1-3 alternative placements for this employee
        2. For each suggestion, provide:
           - Target manager ID
           - Pros of the move (list 2-3)
           - Cons of the move (list 1-2)
           - Brief explanation of why this would be a good fit
        3. Consider:
           - Skill alignment
           - Role appropriateness
           - Workload distribution
           - Career development potential
        
        FORMAT RESPONSE AS JSON:
        {
          "suggestions": [
            {
              "target_manager_id": "123",
              "pros": ["reason1", "reason2", "reason3"],
              "cons": ["con1", "con2"],
              "explanation": "explanation text"
            }
          ]
        }
        """
    
    def _create_deletion_prompt(self, user, workload, siblings, subordinates, projects) -> str:
        """Create prompt for deletion simulation"""
        workload_service = WorkloadService()
        
        return f"""
        As an organizational AI advisor, analyze how to redistribute this employee's workload if they leave:
        
        EMPLOYEE BEING REMOVED:
        - ID: {user["id"]}
        - Name: {user.get("name", "")}
        - Role: {user.get("role", "")}
        - Current workload: {workload} hours
        - Responsibilities: {json.dumps(user.get("responsibilities", []))}
        
        TEAM MEMBERS WHO COULD ABSORB WORKLOAD:
        Siblings (same manager):
        {json.dumps([{
            "id": s["id"],
            "name": s.get("name", ""),
            "role": s.get("role", ""),
            "skills": s.get("skills", []),
            "current_workload": workload_service.calculate_workload(s["id"])
        } for s in siblings])}
        
        Subordinates:
        {json.dumps([{
            "id": s["id"],
            "name": s.get("name", ""),
            "role": s.get("role", ""),
            "skills": s.get("skills", []),
            "current_workload": workload_service.calculate_workload(s["id"])
        } for s in subordinates])}
        
        Projects they're involved in:
        {json.dumps([{
            "id": p["id"],
            "name": p.get("name", ""),
            "description": p.get("description", ""),
            "estimated_hours": p.get("estimated_hours", 0)
        } for p in projects])}
        
        TASK:
        1. Create a redistribution plan for this employee's workload
        2. Identify which responsibilities should go to which team members
        3. Assess the impact on remaining team members' workload
        4. Identify any critical gaps that would need to be filled by a new hire
        
        FORMAT RESPONSE AS JSON:
        {
          "redistribution": [
            {
              "user_id": "123",
              "responsibilities": ["resp1", "resp2"],
              "projects": ["project_id1", "project_id2"],
              "new_workload": 45.5,
              "impact_level": "high" // or "medium" or "low"
            }
          ],
          "critical_gaps": ["gap1", "gap2"],
          "need_replacement": true, // or false
          "replacement_justification": "explanation text"
        }
        """
    
    async def _call_gemini_api(self, prompt: str) -> Dict[str, Any]:
        """Call Gemini API with the given prompt"""
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self.api_key
        }
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ]
        }
        
        response = requests.post(self.api_url, headers=headers, json=payload)
        
        if response.status_code == 200:
            return response.json()
        else:
            # In production, this would have better error handling
            return {"error": f"API Error: {response.status_code}"}
    
    def _process_placement_response(self, response: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Process and format the AI response for placement suggestions"""
        try:
            # Extract text from response
            text = self._extract_text_from_response(response)
            
            # Parse JSON from text response
            json_str = self._extract_json_from_text(text)
            data = json.loads(json_str)
            
            # Format for our API
            return {
                "suggestion_type": "move",
                "target_user_id": user_id,
                "recommendations": data.get("suggestions", []),
                "explanation": "AI-generated placement suggestions based on skills, responsibilities, and organizational structure."
            }
        except Exception as e:
            # In production, this would have better error handling and logging
            return {
                "suggestion_type": "move",
                "target_user_id": user_id,
                "recommendations": [],
                "explanation": f"Error processing AI response: {str(e)}"
            }
    
    def _process_deletion_response(self, response: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Process and format the AI response for deletion simulation"""
        try:
            # Extract text from response
            text = self._extract_text_from_response(response)
            
            # Parse JSON from text response
            json_str = self._extract_json_from_text(text)
            data = json.loads(json_str)
            
            # Calculate new stress levels after redistribution
            workload_service = WorkloadService()
            for redistribution in data.get("redistribution", []):
                user_id = redistribution.get("user_id")
                user = mongo_adapter.get_user(user_id)
                if user:
                    new_workload = redistribution.get("new_workload")
                    current_baseline = 40.0  # Standard workweek
                    
                    # Calculate stress intensity based on new workload
                    hours_difference = new_workload - current_baseline
                    if hours_difference <= 4:
                        redistribution["new_stress_intensity"] = "none"
                    elif hours_difference <= 9:
                        redistribution["new_stress_intensity"] = "light-orange"
                    elif hours_difference <= 14:
                        redistribution["new_stress_intensity"] = "orange"
                    elif hours_difference <= 19:
                        redistribution["new_stress_intensity"] = "deep-orange"
                    else:
                        redistribution["new_stress_intensity"] = "red"
            
            # Format for our API
            return {
                "suggestion_type": "delete",
                "target_user_id": user_id,
                "recommendations": data,
                "explanation": "AI-generated workload redistribution plan if this employee leaves the organization."
            }
        except Exception as e:
            # In production, this would have better error handling and logging
            return {
                "suggestion_type": "delete",
                "target_user_id": user_id,
                "recommendations": {
                    "redistribution": [],
                    "critical_gaps": ["Unable to process redistribution due to error"],
                    "need_replacement": True,
                    "replacement_justification": "Error in analysis"
                },
                "explanation": f"Error processing AI response: {str(e)}"
            }
    
    def _extract_text_from_response(self, response: Dict[str, Any]) -> str:
        """Extract text from Gemini API response"""
        if "error" in response:
            return ""
            
        try:
            content = response.get("candidates", [{}])[0].get("content", {})
            text = content.get("parts", [{}])[0].get("text", "")
            return text.strip()
        except:
            return ""
    
    def _extract_json_from_text(self, text: str) -> str:
        """Extract JSON content from text, which might contain markdown code blocks"""
        json_str = text.strip()
        
        # Find JSON content between possible markdown code blocks
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0].strip()
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0].strip()
        
        return json_str 
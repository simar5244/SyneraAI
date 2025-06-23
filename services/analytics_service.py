import logging
import networkx as nx
import numpy as np
from datetime import datetime, timedelta
from models.employee import Employee
from models.project import Project
from services.project_service import get_employee_weekly_workload

def build_org_graph():
    """
    Build a directed graph representing the organizational structure
    based on manager-employee relationships
    
    Returns:
        NetworkX DiGraph representing the org structure
    """
    G = nx.DiGraph()
    
    # Get all active employees
    employees = Employee.objects(active=True)
    
    # Add nodes for each employee
    for employee in employees:
        G.add_node(employee.employee_id, 
                  name=employee.name,
                  job_title=employee.job_title,
                  department=employee.department,
                  seniority_level=employee.seniority_level,
                  org_level=employee.org_level)
    
    # Add edges based on manager relationship
    for employee in employees:
        if employee.manager_id and employee.manager_id in G:
            # Edge from manager to employee
            G.add_edge(employee.manager_id, employee.employee_id, relationship='manages')
    
    return G

def build_project_graph():
    """
    Build an undirected graph representing employee relationships
    through project collaborations
    
    Returns:
        NetworkX Graph representing project collaborations
    """
    G = nx.Graph()
    
    # Get all active employees
    employees = Employee.objects(active=True)
    
    # Add nodes for each employee
    for employee in employees:
        G.add_node(employee.employee_id, 
                  name=employee.name,
                  job_title=employee.job_title,
                  department=employee.department)
    
    # Get all active projects
    projects = Project.objects(status__in=['Active', 'Planning'])
    
    # Add edges based on project collaboration
    for project in projects:
        # Get all active contributors
        contributors = [contrib.employee_id for contrib in project.employee_contributions 
                       if contrib.active]
        
        # Create edges between all pairs of contributors
        for i in range(len(contributors)):
            for j in range(i+1, len(contributors)):
                if contributors[i] in G and contributors[j] in G:
                    # Check if edge already exists
                    if G.has_edge(contributors[i], contributors[j]):
                        # Increment weight for existing collaboration
                        G[contributors[i]][contributors[j]]['weight'] += 1
                        G[contributors[i]][contributors[j]]['projects'].append(project.project_id)
                    else:
                        # Create new edge
                        G.add_edge(contributors[i], contributors[j], 
                                  weight=1, 
                                  projects=[project.project_id])
    
    return G

def calculate_centrality_scores():
    """
    Calculate centrality scores for all employees based on:
    - Their position in the org chart (PageRank)
    - Their collaboration network (Degree and Betweenness)
    - Their project leadership roles
    
    Returns:
        Dictionary mapping employee_id to centrality score
    """
    # Build org structure graph
    org_graph = build_org_graph()
    
    # Calculate PageRank - importance based on org structure
    pagerank_scores = nx.pagerank(org_graph, alpha=0.85)
    
    # Build project collaboration graph
    project_graph = build_project_graph()
    
    # Calculate degree centrality - directly connected collaborators
    degree_scores = nx.degree_centrality(project_graph)
    
    # Calculate betweenness centrality - bridging between teams
    betweenness_scores = nx.betweenness_centrality(project_graph)
    
    # Get project leadership data
    leadership_scores = {}
    employees = Employee.objects(active=True)
    
    for employee in employees:
        # Initialize score
        leadership_scores[employee.employee_id] = 0
        
        # Find projects where this employee is a team lead
        projects = Project.objects(
            __raw__={
                'employee_contributions.employee_id': employee.employee_id,
                'employee_contributions.role': 'Team Lead',
                'status': {'$in': ['Active', 'Planning']}
            }
        )
        
        # Add leadership bonus based on number and complexity of projects led
        for project in projects:
            leadership_scores[employee.employee_id] += (0.1 * project.complexity_score)
    
    # Combine scores - Normalize and weight each component
    combined_scores = {}
    all_employees = set(list(pagerank_scores.keys()) + 
                        list(degree_scores.keys()) + 
                        list(betweenness_scores.keys()) + 
                        list(leadership_scores.keys()))
    
    for employee_id in all_employees:
        org_influence = pagerank_scores.get(employee_id, 0)
        collab_direct = degree_scores.get(employee_id, 0)
        collab_bridge = betweenness_scores.get(employee_id, 0)
        leadership = leadership_scores.get(employee_id, 0)
        
        # Weighted combination - adjust weights based on your organization's values
        combined_scores[employee_id] = (
            (org_influence * 0.4) +
            (collab_direct * 0.2) +
            (collab_bridge * 0.3) +
            (leadership * 0.1)
        )
    
    # Normalize to 0-1 range
    if combined_scores:
        max_score = max(combined_scores.values())
        if max_score > 0:
            for employee_id in combined_scores:
                combined_scores[employee_id] /= max_score
    
    return combined_scores

def identify_critical_employees(centrality_scores, department=None, limit=10):
    """
    Identify critical employees based on centrality scores and other factors
    
    Args:
        centrality_scores: Dictionary of employee centrality scores
        department: Optional filter by department
        limit: Maximum number of employees to return
        
    Returns:
        List of critical employees with their scores and metadata
    """
    # Get all active employees, filtered by department if specified
    query = {'active': True}
    if department:
        query['department'] = department
        
    employees = Employee.objects(**query)
    
    critical_list = []
    for employee in employees:
        if employee.employee_id in centrality_scores:
            # Get projects this employee is involved in
            projects = Project.objects(
                __raw__={
                    'employee_contributions.employee_id': employee.employee_id,
                    'employee_contributions.active': True,
                    'status': {'$in': ['Active', 'Planning']}
                }
            )
            
            project_data = []
            for project in projects:
                for contrib in project.employee_contributions:
                    if contrib.employee_id == employee.employee_id and contrib.active:
                        project_data.append({
                            'project_id': project.project_id,
                            'project_title': project.project_title,
                            'role': contrib.role,
                            'weekly_hours': contrib.weekly_hours
                        })
            
            # Count direct reports
            direct_reports = Employee.objects(manager_id=employee.employee_id, active=True).count()
            
            critical_list.append({
                'employee': employee.to_dict(),
                'centrality_score': centrality_scores[employee.employee_id],
                'direct_reports': direct_reports,
                'projects': project_data,
                'total_projects': len(project_data)
            })
    
    # Sort by centrality score
    critical_list.sort(key=lambda x: x['centrality_score'], reverse=True)
    
    # Return top N
    return critical_list[:limit]

def calculate_team_overlap():
    """
    Calculate overlap between departments based on skills and project collaborations
    
    Returns:
        Dictionary with department overlap data
    """
    # Get all departments
    departments = Employee.objects().distinct('department')
    
    overlap_data = {}
    
    # Calculate skill overlap between departments
    for i, dept1 in enumerate(departments):
        overlap_data[dept1] = {}
        
        # Get skills in department 1
        dept1_employees = Employee.objects(department=dept1, active=True)
        dept1_skills = set()
        for emp in dept1_employees:
            dept1_skills.update(emp.skills)
        
        for j, dept2 in enumerate(departments):
            if i == j:  # Skip self comparison
                continue
                
            # Get skills in department 2
            dept2_employees = Employee.objects(department=dept2, active=True)
            dept2_skills = set()
            for emp in dept2_employees:
                dept2_skills.update(emp.skills)
            
            # Calculate skill overlap
            if dept1_skills and dept2_skills:
                common_skills = dept1_skills.intersection(dept2_skills)
                unique_skills = dept1_skills.union(dept2_skills)
                skill_overlap = len(common_skills) / len(unique_skills) if unique_skills else 0
            else:
                skill_overlap = 0
                common_skills = set()
            
            # Get project collaboration between depts
            proj_collab = 0
            shared_projects = set()
            
            # Find projects with members from both departments
            projects = Project.objects(status__in=['Active', 'Planning'])
            for project in projects:
                dept1_members = [contrib.employee_id for contrib in project.employee_contributions
                               if contrib.active and 
                               Employee.objects(employee_id=contrib.employee_id, department=dept1).first()]
                
                dept2_members = [contrib.employee_id for contrib in project.employee_contributions
                               if contrib.active and 
                               Employee.objects(employee_id=contrib.employee_id, department=dept2).first()]
                
                if dept1_members and dept2_members:
                    shared_projects.add(project.project_id)
                    proj_collab += 1
            
            # Calculate overall overlap score (combination of skill and project overlap)
            overall_score = (skill_overlap * 0.6) + (min(proj_collab / 5.0, 1.0) * 0.4)
            
            overlap_data[dept1][dept2] = {
                'skill_overlap': skill_overlap,
                'project_collaboration': proj_collab,
                'overall_score': overall_score,
                'common_skills': list(common_skills),
                'shared_projects': list(shared_projects)
            }
    
    return overlap_data

def calculate_attrition_risk():
    """
    Calculate attrition risk score for all employees based on:
    - Overwork (consistent high hours)
    - Tenure without promotion
    - Manager relationship (centrality diff between manager and employee)
    - Project diversity
    
    Returns:
        Dictionary mapping employee_id to attrition risk score (0-1)
    """
    # Get centrality scores for org positioning
    centrality_scores = calculate_centrality_scores()
    
    # Track attrition risk for each employee
    attrition_risks = {}
    
    # Get all active employees
    employees = Employee.objects(active=True)
    
    for employee in employees:
        # Initialize risk score
        risk_score = 0.0
        
        # Factor 1: Overwork
        weekly_hours = get_employee_weekly_workload(employee.employee_id)
        if weekly_hours > 50:
            risk_score += 0.4  # High risk from overwork
        elif weekly_hours > 40:
            risk_score += 0.2  # Moderate risk
        
        # Factor 2: Tenure without promotion
        if employee.last_promotion_date and employee.hire_date:
            months_since_promotion = (datetime.utcnow() - employee.last_promotion_date).days / 30
            tenure_months = (datetime.utcnow() - employee.hire_date).days / 30
            
            # If more than 2 years without promotion and significant tenure
            if months_since_promotion > 24 and tenure_months > 18:
                risk_score += 0.3
            elif months_since_promotion > 18 and tenure_months > 12:
                risk_score += 0.2
            elif months_since_promotion > 12 and tenure_months > 9:
                risk_score += 0.1
        
        # Factor 3: Manager relationship (using centrality differential)
        if employee.manager_id and employee.manager_id in centrality_scores:
            manager_centrality = centrality_scores[employee.manager_id]
            employee_centrality = centrality_scores.get(employee.employee_id, 0)
            
            # If employee has higher centrality than manager, potential frustration
            if employee_centrality > manager_centrality * 1.2:
                risk_score += 0.2
        
        # Factor 4: Project diversity - lack of diverse projects may indicate stagnation
        projects = Project.objects(
            __raw__={
                'employee_contributions.employee_id': employee.employee_id,
                'employee_contributions.active': True,
                'status': {'$in': ['Active', 'Planning']}
            }
        )
        
        if len(projects) == 0:
            risk_score += 0.3  # Not assigned to any projects
        elif len(projects) == 1:
            risk_score += 0.1  # Single project focus
        
        # Cap at 1.0 maximum
        attrition_risks[employee.employee_id] = min(risk_score, 1.0)
    
    return attrition_risks 
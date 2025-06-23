import logging
from datetime import datetime, timedelta
from models.employee import Employee
from models.project import Project

def calculate_project_complexity(project):
    """
    Calculate project complexity based on:
    - Tech stack diversity
    - Project duration
    - Number of contributors
    - Priority level
    """
    # Base complexity
    complexity = 1.0
    
    # Tech stack diversity (more tech = more complex)
    if project.tech_stack:
        complexity += min(len(project.tech_stack) * 0.2, 2.0)
    
    # Project duration (longer = more complex)
    if project.start_date and project.end_date:
        duration_days = (project.end_date - project.start_date).days
        # Add up to 2.0 for projects over 6 months
        complexity += min(duration_days / 180.0, 2.0)
    
    # Number of contributors
    contributor_count = project.active_contributors_count()
    # More people = more complex (up to a point)
    complexity += min(contributor_count * 0.15, 1.5)
    
    # Priority factor
    priority_factor = {
        'Low': 0.5,
        'Medium': 1.0,
        'High': 1.5,
        'Critical': 2.0
    }
    complexity *= priority_factor.get(project.priority, 1.0)
    
    # Cap at 10
    return min(complexity, 10.0)

def get_employee_weekly_workload(employee_id, date_range=None):
    """
    Calculate total weekly hours an employee is allocated across all active projects
    """
    if date_range is None:
        # Default to current week
        today = datetime.utcnow()
        start_of_week = today - timedelta(days=today.weekday())
        end_of_week = start_of_week + timedelta(days=6)
        date_range = (start_of_week, end_of_week)
    
    total_hours = 0.0
    
    # Find all active projects where employee is contributing
    projects = Project.objects(
        __raw__={
            'employee_contributions.employee_id': employee_id,
            'employee_contributions.active': True,
            'status': {'$in': ['Planning', 'Active']}
        }
    )
    
    for project in projects:
        for contrib in project.employee_contributions:
            if contrib.employee_id == employee_id and contrib.active:
                total_hours += contrib.weekly_hours
    
    return total_hours

def find_underutilized_employees(department, required_skills=None, max_weekly_hours=30.0):
    """
    Find employees who are not fully utilized and have capacity to take on more work
    
    Args:
        department: Department to search within
        required_skills: List of skills to match against employee skills
        max_weekly_hours: Maximum number of weekly hours to consider an employee underutilized
        
    Returns:
        List of employee objects with their current weekly hours
    """
    # Get all active employees in the department
    employees = Employee.objects(department=department, active=True)
    
    result = []
    for employee in employees:
        # Calculate current workload
        weekly_hours = get_employee_weekly_workload(employee.employee_id)
        
        # Check if underutilized
        if weekly_hours < max_weekly_hours:
            # Check for skill match if required
            if required_skills:
                # Calculate skill match percentage
                matching_skills = [skill for skill in required_skills if skill in employee.skills]
                skill_match_pct = len(matching_skills) / len(required_skills) if required_skills else 0
                
                # Only include if they have at least some matching skills
                if skill_match_pct > 0:
                    result.append({
                        'employee': employee.to_dict(),
                        'current_weekly_hours': weekly_hours,
                        'available_hours': max_weekly_hours - weekly_hours,
                        'skill_match_percentage': skill_match_pct,
                        'matching_skills': matching_skills
                    })
            else:
                # No skill requirement, just include based on hours
                result.append({
                    'employee': employee.to_dict(),
                    'current_weekly_hours': weekly_hours,
                    'available_hours': max_weekly_hours - weekly_hours
                })
    
    # Sort by available hours (most available first)
    result.sort(key=lambda x: x['available_hours'], reverse=True)
    
    return result

def find_overworked_employees(threshold_hours=40.0, consecutive_weeks=2):
    """
    Find employees who are overworked based on hours logged
    
    Args:
        threshold_hours: Hours threshold to consider overworked
        consecutive_weeks: Number of consecutive weeks over threshold
        
    Returns:
        List of overworked employees with their projects and hours
    """
    # Get all active employees
    employees = Employee.objects(active=True)
    
    overworked = []
    for employee in employees:
        # Calculate current workload
        weekly_hours = get_employee_weekly_workload(employee.employee_id)
        
        if weekly_hours > threshold_hours:
            # Get all projects this employee is working on
            projects = Project.objects(
                __raw__={
                    'employee_contributions.employee_id': employee.employee_id,
                    'employee_contributions.active': True,
                    'status': {'$in': ['Planning', 'Active']}
                }
            )
            
            project_data = []
            for project in projects:
                for contrib in project.employee_contributions:
                    if contrib.employee_id == employee.employee_id and contrib.active:
                        project_data.append({
                            'project_id': project.project_id,
                            'project_title': project.project_title,
                            'weekly_hours': contrib.weekly_hours,
                            'role': contrib.role,
                            'status': project.status,
                            'priority': project.priority
                        })
            
            overworked.append({
                'employee': employee.to_dict(),
                'total_weekly_hours': weekly_hours,
                'excess_hours': weekly_hours - threshold_hours,
                'projects': project_data
            })
    
    # Sort by excess hours (most overworked first)
    overworked.sort(key=lambda x: x['excess_hours'], reverse=True)
    
    return overworked

def suggest_replacements(employee_id, project_id=None):
    """
    Suggest potential replacements for an overworked employee
    
    Args:
        employee_id: ID of employee to replace
        project_id: Optional specific project to find replacement for
        
    Returns:
        List of potential replacements sorted by suitability
    """
    employee = Employee.objects(employee_id=employee_id, active=True).first()
    if not employee:
        return []
    
    # Get employee's skills and department
    department = employee.department
    skills = employee.skills
    
    # Get project details if specified
    if project_id:
        project = Project.objects(project_id=project_id).first()
        if project:
            # Find the employee's role and tech for this specific project
            for contrib in project.employee_contributions:
                if contrib.employee_id == employee_id:
                    project_role = contrib.role
                    project_tech = contrib.reported_tech
                    break
            else:
                # Employee not found on this project
                return []
    else:
        # No specific project, use employee's general skills
        project_tech = skills
        project_role = None
    
    # Find potential replacements in the same department who aren't overworked
    replacements = find_underutilized_employees(
        department=department,
        required_skills=project_tech,
        max_weekly_hours=35.0  # Leave some buffer
    )
    
    # Further filter by seniority level (prefer similar or lower level, not higher)
    for replacement in replacements:
        emp = Employee.objects(employee_id=replacement['employee']['employee_id']).first()
        
        # Score based on:
        # 1. Skill match (already calculated)
        # 2. Seniority level (prefer same or one level below)
        # 3. Available hours
        
        seniority_levels = ['Junior', 'Mid', 'Senior', 'Lead']
        employee_level_idx = seniority_levels.index(employee.seniority_level) if employee.seniority_level in seniority_levels else -1
        replacement_level_idx = seniority_levels.index(emp.seniority_level) if emp.seniority_level in seniority_levels else -1
        
        # Calculate seniority match (1.0 = perfect match, lower is worse)
        if replacement_level_idx == employee_level_idx:
            seniority_match = 1.0  # Same level, perfect match
        elif replacement_level_idx == employee_level_idx - 1:
            seniority_match = 0.8  # One level below, very good
        elif replacement_level_idx < employee_level_idx:
            seniority_match = 0.6  # More than one level below, acceptable
        else:
            seniority_match = 0.3  # Higher level, not preferred
            
        # Calculate overall suitability score
        skill_match = replacement.get('skill_match_percentage', 0.5)
        available_hours_factor = min(replacement['available_hours'] / 20.0, 1.0)  # Normalize by 20 hours
        
        suitability = (skill_match * 0.5) + (seniority_match * 0.3) + (available_hours_factor * 0.2)
        replacement['suitability_score'] = suitability
        replacement['seniority_match'] = seniority_match
    
    # Sort by suitability score
    replacements.sort(key=lambda x: x['suitability_score'], reverse=True)
    
    return replacements 
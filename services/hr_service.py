import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from models.employee import Employee
from models.project import Project
from services.analytics_service import (
    calculate_centrality_scores,
    calculate_attrition_risk
)
from services.project_service import get_employee_weekly_workload

def calculate_promotion_candidates(
    department: Optional[str] = None,
    min_score: float = 0.7,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Calculate promotion candidates based on:
    - Project leadership
    - Centrality in org/project networks
    - Tenure and time since last promotion
    - Workload and contributions
    
    Args:
        department: Optional filter by department
        min_score: Minimum promotion score threshold
        limit: Maximum number of candidates to return
        
    Returns:
        List of promotion candidates with scores and supporting data
    """
    # Get centrality scores
    centrality_scores = calculate_centrality_scores()
    
    # Get attrition risk (to prioritize at-risk employees)
    attrition_risks = calculate_attrition_risk()
    
    # Build query
    query = {'active': True}
    if department:
        query['department'] = department
    
    # Get eligible employees
    employees = Employee.objects(**query)
    
    candidates = []
    for employee in employees:
        # Initialize base score
        promotion_score = 0.0
        
        # Skip if newly promoted (less than 6 months)
        if employee.last_promotion_date:
            months_since_promotion = (datetime.utcnow() - employee.last_promotion_date).days / 30
            if months_since_promotion < 6:
                continue
            
            # Time since last promotion factor (increases score for employees not promoted recently)
            # Max bonus of 0.2 for employees not promoted in 2+ years
            promotion_score += min(months_since_promotion / 120, 0.2)
        
        # Factor 1: Centrality in organization (40%)
        if employee.employee_id in centrality_scores:
            promotion_score += centrality_scores[employee.employee_id] * 0.4
        
        # Factor 2: Project leadership
        # Find projects where employee is a team lead
        leadership_projects = Project.objects(
            __raw__={
                'employee_contributions.employee_id': employee.employee_id,
                'employee_contributions.role': 'Team Lead',
                'status': {'$in': ['Active', 'Completed']}
            }
        )
        
        # Award up to 0.25 based on leadership roles
        leadership_score = min(len(leadership_projects) * 0.05, 0.25)
        promotion_score += leadership_score
        
        # Factor 3: Workload and contributions
        weekly_hours = get_employee_weekly_workload(employee.employee_id)
        workload_score = 0.0
        
        # Award points for solid workload, but not for overwork
        if 30 <= weekly_hours <= 45:
            workload_score = (weekly_hours - 30) / 60  # Linear scale from 0 to 0.25
        elif weekly_hours > 45:
            workload_score = 0.25  # Cap at 0.25 for overworked employees
            
        promotion_score += workload_score
        
        # Factor 4: Attrition risk (consider promoting employees at risk of leaving)
        if employee.employee_id in attrition_risks:
            risk_score = attrition_risks[employee.employee_id]
            # Award up to 0.1 based on attrition risk
            promotion_score += risk_score * 0.1
        
        # Only include if score is above threshold
        if promotion_score >= min_score:
            # Get projects this employee is involved in
            all_projects = Project.objects(
                __raw__={
                    'employee_contributions.employee_id': employee.employee_id,
                    'employee_contributions.active': True
                }
            )
            
            project_list = []
            for project in all_projects:
                for contrib in project.employee_contributions:
                    if contrib.employee_id == employee.employee_id:
                        project_list.append({
                            'project_id': project.project_id,
                            'project_title': project.project_title,
                            'role': contrib.role,
                            'weekly_hours': contrib.weekly_hours
                        })
            
            # Calculate months in current role
            tenure_in_role = 0
            if employee.last_promotion_date:
                tenure_in_role = (datetime.utcnow() - employee.last_promotion_date).days / 30
            elif employee.hire_date:
                tenure_in_role = (datetime.utcnow() - employee.hire_date).days / 30
            
            candidates.append({
                'employee': employee.to_dict(),
                'promotion_score': promotion_score,
                'centrality_score': centrality_scores.get(employee.employee_id, 0),
                'leadership_score': leadership_score,
                'workload_score': workload_score,
                'attrition_risk': attrition_risks.get(employee.employee_id, 0),
                'leadership_projects': len(leadership_projects),
                'weekly_hours': weekly_hours,
                'tenure_in_role': tenure_in_role,
                'projects': project_list
            })
    
    # Sort by promotion score (descending)
    candidates.sort(key=lambda x: x['promotion_score'], reverse=True)
    
    # Return top N
    return candidates[:limit]

def calculate_raise_candidates(
    department: Optional[str] = None,
    min_score: float = 0.7,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Calculate raise candidates based on:
    - Domain knowledge rarity
    - Consistent utilization
    - Time since last raise
    - Value contribution
    
    Args:
        department: Optional filter by department
        min_score: Minimum raise score threshold
        limit: Maximum number of candidates to return
        
    Returns:
        List of raise candidates with scores and supporting data
    """
    # Get centrality scores (for value contribution assessment)
    centrality_scores = calculate_centrality_scores()
    
    # Get attrition risk (to prioritize at-risk employees)
    attrition_risks = calculate_attrition_risk()
    
    # Calculate value tokens
    value_tokens = calculate_value_tokens(department=department)
    
    # Map value tokens by employee_id for easier lookup
    value_map = {item['employee']['employee_id']: item['value_tokens'] for item in value_tokens}
    
    # Build query
    query = {'active': True}
    if department:
        query['department'] = department
    
    # Get eligible employees
    employees = Employee.objects(**query)
    
    # Calculate skill rarity across organization
    skill_frequency = {}
    for employee in employees:
        for skill in employee.skills:
            if skill not in skill_frequency:
                skill_frequency[skill] = 0
            skill_frequency[skill] += 1
    
    candidates = []
    for employee in employees:
        # Initialize base score
        raise_score = 0.0
        
        # Skip if recently given raise (less than a year)
        # This would need additional data tracking when raises were given
        # For now, we'll use last_promotion_date as a proxy
        if employee.last_promotion_date:
            months_since_raise = (datetime.utcnow() - employee.last_promotion_date).days / 30
            if months_since_raise < 12:
                continue
            
            # Time since last raise factor
            raise_score += min(months_since_raise / 48, 0.15)  # Up to 0.15 for 4+ years
        
        # Factor 1: Skill rarity (30%)
        rare_skills = []
        skill_rarity_score = 0.0
        
        for skill in employee.skills:
            if skill in skill_frequency and skill_frequency[skill] <= 3:  # Consider skills with <= 3 people as rare
                rare_skills.append(skill)
                # More points for rarer skills
                skill_rarity_score += (1.0 / max(skill_frequency[skill], 1)) * 0.1
        
        # Cap skill rarity at 0.3
        skill_rarity_score = min(skill_rarity_score, 0.3)
        raise_score += skill_rarity_score
        
        # Factor 2: Consistent utilization (20%)
        weekly_hours = get_employee_weekly_workload(employee.employee_id)
        utilization_score = 0.0
        
        # Award points for good utilization (not under or over utilized)
        if 35 <= weekly_hours <= 45:
            utilization_score = 0.2  # Optimal range
        elif 25 <= weekly_hours < 35 or 45 < weekly_hours <= 50:
            utilization_score = 0.1  # Suboptimal but acceptable
            
        raise_score += utilization_score
        
        # Factor 3: Value contribution (35%)
        value_score = 0.0
        
        # From centrality
        if employee.employee_id in centrality_scores:
            value_score += centrality_scores[employee.employee_id] * 0.15
            
        # From value tokens
        if employee.employee_id in value_map:
            # Normalize against max value
            max_value = max(value_map.values()) if value_map else 1
            normalized_value = value_map[employee.employee_id] / max_value if max_value > 0 else 0
            value_score += normalized_value * 0.2
            
        raise_score += value_score
        
        # Factor 4: Attrition risk (15%)
        risk_score = 0.0
        if employee.employee_id in attrition_risks:
            risk_score = attrition_risks[employee.employee_id] * 0.15
            
        raise_score += risk_score
        
        # Only include if score is above threshold
        if raise_score >= min_score:
            # Get projects this employee is involved in
            projects = Project.objects(
                __raw__={
                    'employee_contributions.employee_id': employee.employee_id,
                    'employee_contributions.active': True
                }
            )
            
            project_list = []
            for project in projects:
                for contrib in project.employee_contributions:
                    if contrib.employee_id == employee.employee_id:
                        project_list.append({
                            'project_id': project.project_id,
                            'project_title': project.project_title,
                            'role': contrib.role,
                            'weekly_hours': contrib.weekly_hours
                        })
            
            candidates.append({
                'employee': employee.to_dict(),
                'raise_score': raise_score,
                'skill_rarity_score': skill_rarity_score,
                'utilization_score': utilization_score,
                'value_score': value_score,
                'attrition_risk_score': risk_score,
                'weekly_hours': weekly_hours,
                'rare_skills': rare_skills,
                'value_tokens': value_map.get(employee.employee_id, 0),
                'projects': project_list
            })
    
    # Sort by raise score (descending)
    candidates.sort(key=lambda x: x['raise_score'], reverse=True)
    
    # Return top N
    return candidates[:limit]

def calculate_termination_candidates(
    department: Optional[str] = None,
    min_score: float = 0.6,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Calculate termination candidates based on:
    - Consistent underutilization
    - Lack of project contributions
    - Skills mismatch with organizational needs
    
    Args:
        department: Optional filter by department
        min_score: Minimum termination score threshold
        limit: Maximum number of candidates to return
        
    Returns:
        List of termination candidates with scores and supporting data
    """
    # Build query
    query = {'active': True}
    if department:
        query['department'] = department
    
    # Get employees
    employees = Employee.objects(**query)
    
    # Get org-wide skills to measure relevance
    org_skills = {}
    for employee in employees:
        for skill in employee.skills:
            if skill not in org_skills:
                org_skills[skill] = 0
            org_skills[skill] += 1
    
    # Calculate skill relevance (skills used in active projects)
    project_skills = set()
    active_projects = Project.objects(status__in=['Active', 'Planning'])
    for project in active_projects:
        project_skills.update([tech.lower() for tech in project.tech_stack])
        
        # Also include tech reported by contributors
        for contrib in project.employee_contributions:
            if contrib.active and contrib.reported_tech:
                project_skills.update([tech.lower() for tech in contrib.reported_tech])
    
    candidates = []
    for employee in employees:
        # Initialize base score
        termination_score = 0.0
        
        # Factor 1: Underutilization (40%)
        weekly_hours = get_employee_weekly_workload(employee.employee_id)
        underutilization_score = 0.0
        
        # Award points for severe underutilization
        if weekly_hours < 10:
            underutilization_score = 0.4  # Severely underutilized
        elif weekly_hours < 20:
            underutilization_score = 0.3  # Significantly underutilized
        elif weekly_hours < 30:
            underutilization_score = 0.2  # Moderately underutilized
            
        termination_score += underutilization_score
        
        # Factor 2: Project contribution history (30%)
        # Find all projects in the last 3 months
        three_months_ago = datetime.utcnow() - timedelta(days=90)
        recent_projects = Project.objects(
            __raw__={
                'employee_contributions.employee_id': employee.employee_id,
                'status': {'$in': ['Active', 'Completed']},
                'updated_at': {'$gte': three_months_ago}
            }
        )
        
        contribution_score = 0.0
        if len(recent_projects) == 0:
            contribution_score = 0.3  # No recent project contributions
        elif len(recent_projects) == 1 and weekly_hours < 20:
            contribution_score = 0.2  # Single project with low hours
            
        termination_score += contribution_score
        
        # Factor 3: Skills relevance to organization (30%)
        relevance_score = 0.0
        
        # Check if employee's skills are relevant to current projects
        employee_skills = [skill.lower() for skill in employee.skills]
        matching_project_skills = [skill for skill in employee_skills if skill in project_skills]
        
        if not employee_skills:
            relevance_score = 0.15  # No skills listed
        elif not matching_project_skills:
            relevance_score = 0.3  # No skills match current projects
        elif len(matching_project_skills) / len(employee_skills) < 0.3:
            relevance_score = 0.2  # Few skills match current projects
            
        termination_score += relevance_score
        
        # Only include if score is above threshold
        if termination_score >= min_score:
            # Get active and recent projects
            active_projects = Project.objects(
                __raw__={
                    'employee_contributions.employee_id': employee.employee_id,
                    'employee_contributions.active': True
                }
            )
            
            candidates.append({
                'employee': employee.to_dict(),
                'termination_score': termination_score,
                'underutilization_score': underutilization_score,
                'contribution_score': contribution_score,
                'relevance_score': relevance_score,
                'weekly_hours': weekly_hours,
                'recent_project_count': len(recent_projects),
                'active_project_count': len(active_projects),
                'matching_skills': matching_project_skills,
                'total_skills': len(employee_skills)
            })
    
    # Sort by termination score (descending)
    candidates.sort(key=lambda x: x['termination_score'], reverse=True)
    
    # Return top N
    return candidates[:limit]

def calculate_value_tokens(
    department: Optional[str] = None,
    recalculate: bool = False
) -> List[Dict[str, Any]]:
    """
    Calculate value tokens for employees based on:
    - Project contributions and impact
    - Centrality in organization
    - Span of control
    - Rare skills
    
    Args:
        department: Optional filter by department
        recalculate: Force recalculation even if cached
        
    Returns:
        List of employees with their value token allocations
    """
    # Get centrality scores for org influence
    centrality_scores = calculate_centrality_scores()
    
    # Build query
    query = {'active': True}
    if department:
        query['department'] = department
    
    # Get employees
    employees = Employee.objects(**query)
    
    # Get org-wide skills to measure rarity
    skill_frequency = {}
    for employee in employees:
        for skill in employee.skills:
            if skill not in skill_frequency:
                skill_frequency[skill] = 0
            skill_frequency[skill] += 1
    
    result = []
    for employee in employees:
        # Start with base value tokens (everyone gets at least 1)
        value_tokens = 1
        
        # Component 1: Project contributions (up to 5 tokens)
        # Find all active projects with this employee
        employee_projects = Project.objects(
            __raw__={
                'employee_contributions.employee_id': employee.employee_id,
                'employee_contributions.active': True,
                'status': {'$in': ['Active', 'Planning']}
            }
        )
        
        # Award tokens based on role and project complexity
        project_tokens = 0
        for project in employee_projects:
            for contrib in project.employee_contributions:
                if contrib.employee_id == employee.employee_id and contrib.active:
                    # Award more for leadership roles
                    role_multiplier = 1.0
                    if contrib.role == 'Team Lead':
                        role_multiplier = 1.5
                    
                    # Consider project complexity
                    project_tokens += (project.complexity_score / 10.0) * role_multiplier
        
        # Cap project contribution tokens at 5
        project_tokens = min(project_tokens, 5)
        value_tokens += project_tokens
        
        # Component 2: Centrality/influence (up to 3 tokens)
        influence_tokens = 0
        if employee.employee_id in centrality_scores:
            influence_tokens = centrality_scores[employee.employee_id] * 3
        value_tokens += influence_tokens
        
        # Component 3: Span of control (up to 2 tokens)
        # Count direct reports
        direct_reports = Employee.objects(manager_id=employee.employee_id, active=True).count()
        
        # Award 0.5 tokens per direct report, up to 2
        span_tokens = min(direct_reports * 0.5, 2)
        value_tokens += span_tokens
        
        # Component 4: Rare skills (up to 2 tokens)
        rare_skill_tokens = 0
        
        for skill in employee.skills:
            if skill in skill_frequency and skill_frequency[skill] <= 3:  # Rare skill (3 or fewer people)
                # More tokens for rarer skills
                rare_skill_tokens += (1.0 / max(skill_frequency[skill], 1)) * 0.5
        
        # Cap rare skill tokens at 2
        rare_skill_tokens = min(rare_skill_tokens, 2)
        value_tokens += rare_skill_tokens
        
        # Store the current value token calculation
        if recalculate:
            employee.value_tokens = int(value_tokens)
            employee.save()
        
        # Add to result
        result.append({
            'employee': employee.to_dict(),
            'value_tokens': int(value_tokens),
            'project_tokens': round(project_tokens, 1),
            'influence_tokens': round(influence_tokens, 1),
            'span_tokens': round(span_tokens, 1),
            'rare_skill_tokens': round(rare_skill_tokens, 1),
            'projects_count': len(employee_projects),
            'direct_reports': direct_reports
        })
    
    return result 
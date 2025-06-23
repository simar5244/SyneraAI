from flask import Blueprint, request, jsonify
import logging
from datetime import datetime, timedelta
from models.employee import Employee
from models.project import Project
from services.project_service import (
    find_underutilized_employees,
    find_overworked_employees,
    get_employee_weekly_workload
)
from services.analytics_service import (
    calculate_centrality_scores,
    identify_critical_employees,
    calculate_team_overlap,
    calculate_attrition_risk
)

analytics_blueprint = Blueprint('analytics', __name__)

@analytics_blueprint.route('/workload', methods=['GET'])
def get_workload_analysis():
    """Get workload analytics for employees"""
    try:
        # Parse thresholds from query parameters
        overworked_threshold = float(request.args.get('overworked_threshold', 40.0))
        underutilized_threshold = float(request.args.get('underutilized_threshold', 20.0))
        
        # Get department filter if provided
        department = request.args.get('department')
        
        # Find overworked employees
        overworked = find_overworked_employees(threshold_hours=overworked_threshold)
        
        # Find underutilized employees
        underutilized = []
        if department:
            underutilized = find_underutilized_employees(
                department=department,
                max_weekly_hours=underutilized_threshold
            )
        else:
            # If no department specified, search across all departments
            departments = Employee.objects().distinct('department')
            for dept in departments:
                dept_underutilized = find_underutilized_employees(
                    department=dept,
                    max_weekly_hours=underutilized_threshold
                )
                underutilized.extend(dept_underutilized)
        
        # Calculate aggregate statistics
        total_employees = Employee.objects(active=True).count()
        overworked_count = len(overworked)
        underutilized_count = len(underutilized)
        balanced_count = total_employees - overworked_count - underutilized_count
        
        # Department workload distribution
        department_workload = {}
        departments = Employee.objects().distinct('department')
        for dept in departments:
            dept_employees = Employee.objects(department=dept, active=True)
            dept_workload = 0.0
            dept_employee_count = 0
            
            for employee in dept_employees:
                dept_employee_count += 1
                dept_workload += get_employee_weekly_workload(employee.employee_id)
            
            if dept_employee_count > 0:
                department_workload[dept] = {
                    'employee_count': dept_employee_count,
                    'total_weekly_hours': dept_workload,
                    'avg_weekly_hours_per_employee': dept_workload / dept_employee_count
                }
        
        return jsonify({
            'success': True,
            'summary': {
                'total_employees': total_employees,
                'overworked_count': overworked_count,
                'underutilized_count': underutilized_count,
                'balanced_count': balanced_count,
                'overworked_percentage': (overworked_count / total_employees) * 100 if total_employees > 0 else 0,
                'underutilized_percentage': (underutilized_count / total_employees) * 100 if total_employees > 0 else 0
            },
            'department_workload': department_workload,
            'overworked_employees': overworked[:20],  # Limit to top 20
            'underutilized_employees': underutilized[:20]  # Limit to top 20
        }), 200
    except Exception as e:
        logging.error(f"Error generating workload analysis: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to generate workload analysis: {str(e)}"
        }), 500

@analytics_blueprint.route('/critical-employees', methods=['GET'])
def get_critical_employees():
    """Get critical employees based on centrality analysis"""
    try:
        # Get parameters
        limit = int(request.args.get('limit', 10))
        department = request.args.get('department')
        
        # Calculate centrality scores for all employees
        centrality_scores = calculate_centrality_scores()
        
        # Identify critical employees
        critical_employees = identify_critical_employees(
            centrality_scores=centrality_scores,
            department=department,
            limit=limit
        )
        
        return jsonify({
            'success': True,
            'count': len(critical_employees),
            'data': critical_employees
        }), 200
    except Exception as e:
        logging.error(f"Error identifying critical employees: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to identify critical employees: {str(e)}"
        }), 500

@analytics_blueprint.route('/succession-planning', methods=['GET'])
def get_succession_planning():
    """Get succession planning recommendations for key employees"""
    try:
        # Get parameters
        employee_id = request.args.get('employee_id')
        department = request.args.get('department')
        
        # If employee_id is provided, find succession candidates for that employee
        if employee_id:
            employee = Employee.objects(employee_id=employee_id).first()
            if not employee:
                return jsonify({
                    'success': False,
                    'message': f"Employee with ID {employee_id} not found"
                }), 404
                
            # Calculate centrality scores
            centrality_scores = calculate_centrality_scores()
            
            # Calculate attrition risk
            attrition_risks = calculate_attrition_risk()
            
            # Get employee's department and role data
            employees_dept = employee.department
            employees_skills = employee.skills
            employees_role = employee.job_title
            
            # Find suitable succession candidates
            candidates = []
            potential_successors = Employee.objects(
                department=employees_dept,
                active=True,
                employee_id__ne=employee_id  # Exclude the target employee
            )
            
            for candidate in potential_successors:
                # Calculate skill overlap
                skill_overlap = [skill for skill in employees_skills if skill in candidate.skills]
                skill_match_pct = len(skill_overlap) / len(employees_skills) if employees_skills else 0
                
                # Only consider candidates with reasonable skill match
                if skill_match_pct >= 0.5:  # At least 50% skill match
                    candidates.append({
                        'employee': candidate.to_dict(),
                        'centrality_score': centrality_scores.get(candidate.employee_id, 0),
                        'attrition_risk': attrition_risks.get(candidate.employee_id, 0),
                        'skill_match_percentage': skill_match_pct,
                        'matching_skills': skill_overlap,
                        'missing_skills': [skill for skill in employees_skills if skill not in candidate.skills]
                    })
            
            # Sort by a combination of centrality and skill match
            for candidate in candidates:
                candidate['succession_score'] = (candidate['centrality_score'] * 0.4 + 
                                               candidate['skill_match_percentage'] * 0.6 - 
                                               candidate['attrition_risk'] * 0.2)
                
            candidates.sort(key=lambda x: x['succession_score'], reverse=True)
            
            return jsonify({
                'success': True,
                'employee': employee.to_dict(),
                'centrality_score': centrality_scores.get(employee.employee_id, 0),
                'attrition_risk': attrition_risks.get(employee.employee_id, 0),
                'succession_candidates': candidates[:10]  # Limit to top 10
            }), 200
        
        # Otherwise, return key employees who need succession planning
        else:
            # Get all employees in department if specified
            if department:
                query = {'department': department, 'active': True}
            else:
                query = {'active': True}
                
            # Calculate centrality for all employees
            centrality_scores = calculate_centrality_scores()
            
            # Calculate attrition risk
            attrition_risks = calculate_attrition_risk()
            
            # Combine scores to find critical employees needing succession planning
            employees = Employee.objects(**query)
            
            critical_employees = []
            for employee in employees:
                centrality = centrality_scores.get(employee.employee_id, 0)
                attrition = attrition_risks.get(employee.employee_id, 0)
                
                # Prioritize based on both high centrality and high attrition risk
                priority_score = (centrality * 0.7) + (attrition * 0.3)
                
                if priority_score > 0.5:  # Threshold for including in succession planning
                    critical_employees.append({
                        'employee': employee.to_dict(),
                        'centrality_score': centrality,
                        'attrition_risk': attrition,
                        'priority_score': priority_score
                    })
            
            # Sort by priority score
            critical_employees.sort(key=lambda x: x['priority_score'], reverse=True)
            
            return jsonify({
                'success': True,
                'count': len(critical_employees),
                'data': critical_employees[:20]  # Limit to top 20
            }), 200
    except Exception as e:
        logging.error(f"Error generating succession planning: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to generate succession planning: {str(e)}"
        }), 500

@analytics_blueprint.route('/executive-report', methods=['GET'])
def get_executive_report():
    """Get monthly executive intelligence report"""
    try:
        # Get parameters
        month = request.args.get('month')
        year = request.args.get('year')
        
        # Default to current month if not specified
        if not month or not year:
            today = datetime.utcnow()
            month = today.month
            year = today.year
        else:
            month = int(month)
            year = int(year)
            
        # Calculate start and end dates for the month
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = datetime(year, month + 1, 1) - timedelta(days=1)
            
        # Get workload analysis
        overworked = find_overworked_employees(threshold_hours=40.0)
        underutilized = []
        
        # Get all departments and find underutilized employees
        departments = Employee.objects().distinct('department')
        for dept in departments:
            dept_underutilized = find_underutilized_employees(
                department=dept,
                max_weekly_hours=20.0
            )
            underutilized.extend(dept_underutilized)
            
        # Get department overlap analysis
        team_overlap = calculate_team_overlap()
        
        # Get succession planning for critical employees
        centrality_scores = calculate_centrality_scores()
        attrition_risks = calculate_attrition_risk()
        
        # Find top employees by centrality
        employees = Employee.objects(active=True)
        critical_employees = []
        
        for employee in employees:
            centrality = centrality_scores.get(employee.employee_id, 0)
            attrition = attrition_risks.get(employee.employee_id, 0)
            
            if centrality > 0.7:  # High centrality threshold
                critical_employees.append({
                    'employee': employee.to_dict(),
                    'centrality_score': centrality,
                    'attrition_risk': attrition
                })
                
        critical_employees.sort(key=lambda x: x['centrality_score'], reverse=True)
        
        # Get project statistics for the month
        active_projects = Project.objects(
            start_date__lte=end_date,
            status__in=['Active', 'Planning']
        )
        
        completed_projects = Project.objects(
            end_date__gte=start_date,
            end_date__lte=end_date,
            status='Completed'
        )
        
        new_projects = Project.objects(
            start_date__gte=start_date,
            start_date__lte=end_date
        )
        
        # Compile the complete report
        report = {
            'report_period': {
                'month': month,
                'year': year,
                'start_date': start_date,
                'end_date': end_date
            },
            'workforce_overview': {
                'total_employees': Employee.objects(active=True).count(),
                'overworked_employees': {
                    'count': len(overworked),
                    'data': overworked[:10]  # Limit to top 10
                },
                'underutilized_employees': {
                    'count': len(underutilized),
                    'data': underutilized[:10]  # Limit to top 10
                }
            },
            'project_stats': {
                'active_projects': len(active_projects),
                'completed_projects': len(completed_projects),
                'new_projects': len(new_projects)
            },
            'critical_employees': {
                'count': len(critical_employees),
                'data': critical_employees[:10]  # Limit to top 10
            },
            'team_overlap': team_overlap
        }
        
        return jsonify({
            'success': True,
            'report': report
        }), 200
    except Exception as e:
        logging.error(f"Error generating executive report: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to generate executive report: {str(e)}"
        }), 500 
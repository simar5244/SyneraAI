from flask import Blueprint, request, jsonify
import logging
from datetime import datetime, timedelta
from models.employee import Employee
from models.project import Project
from services.analytics_service import (
    calculate_centrality_scores,
    calculate_attrition_risk
)
from services.project_service import (
    get_employee_weekly_workload,
    find_overworked_employees
)
from services.hr_service import (
    calculate_promotion_candidates,
    calculate_raise_candidates,
    calculate_termination_candidates,
    calculate_value_tokens
)

hr_blueprint = Blueprint('hr', __name__)

@hr_blueprint.route('/promotion-recommendations', methods=['GET'])
def get_promotion_recommendations():
    """Get promotion recommendations for employees"""
    try:
        # Parse query parameters
        department = request.args.get('department')
        limit = int(request.args.get('limit', 10))
        min_score = float(request.args.get('min_score', 0.7))
        
        # Get promotion candidates
        candidates = calculate_promotion_candidates(
            department=department,
            min_score=min_score,
            limit=limit
        )
        
        return jsonify({
            'success': True,
            'count': len(candidates),
            'data': candidates
        }), 200
    except Exception as e:
        logging.error(f"Error getting promotion recommendations: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to get promotion recommendations: {str(e)}"
        }), 500

@hr_blueprint.route('/raise-recommendations', methods=['GET'])
def get_raise_recommendations():
    """Get raise recommendations for employees"""
    try:
        # Parse query parameters
        department = request.args.get('department')
        limit = int(request.args.get('limit', 10))
        min_score = float(request.args.get('min_score', 0.7))
        
        # Get raise candidates
        candidates = calculate_raise_candidates(
            department=department,
            min_score=min_score,
            limit=limit
        )
        
        return jsonify({
            'success': True,
            'count': len(candidates),
            'data': candidates
        }), 200
    except Exception as e:
        logging.error(f"Error getting raise recommendations: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to get raise recommendations: {str(e)}"
        }), 500

@hr_blueprint.route('/termination-recommendations', methods=['GET'])
def get_termination_recommendations():
    """Get termination recommendations for employees"""
    try:
        # Parse query parameters
        department = request.args.get('department')
        limit = int(request.args.get('limit', 10))
        min_score = float(request.args.get('min_score', 0.6))
        
        # Get termination candidates
        candidates = calculate_termination_candidates(
            department=department,
            min_score=min_score,
            limit=limit
        )
        
        return jsonify({
            'success': True,
            'count': len(candidates),
            'data': candidates
        }), 200
    except Exception as e:
        logging.error(f"Error getting termination recommendations: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to get termination recommendations: {str(e)}"
        }), 500

@hr_blueprint.route('/value-tokens', methods=['GET'])
def get_value_tokens():
    """Get value token distribution for employees"""
    try:
        # Parse query parameters
        department = request.args.get('department')
        limit = int(request.args.get('limit', 20))
        
        # Calculate value tokens
        value_distribution = calculate_value_tokens(
            department=department,
            recalculate=True
        )
        
        # Sort by value tokens (descending)
        sorted_distribution = sorted(
            value_distribution,
            key=lambda x: x['value_tokens'],
            reverse=True
        )
        
        # Limit results
        limited_distribution = sorted_distribution[:limit]
        
        # Calculate totals
        total_tokens = sum(item['value_tokens'] for item in value_distribution)
        dept_totals = {}
        
        if not department:
            # Calculate department totals
            for item in value_distribution:
                emp_dept = item['employee']['department']
                if emp_dept not in dept_totals:
                    dept_totals[emp_dept] = 0
                dept_totals[emp_dept] += item['value_tokens']
        
        return jsonify({
            'success': True,
            'count': len(limited_distribution),
            'total_value_tokens': total_tokens,
            'department_totals': dept_totals,
            'data': limited_distribution
        }), 200
    except Exception as e:
        logging.error(f"Error calculating value tokens: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to calculate value tokens: {str(e)}"
        }), 500

@hr_blueprint.route('/employee-risk', methods=['GET'])
def get_employee_risk():
    """Get attrition risk for employees"""
    try:
        # Parse query parameters
        department = request.args.get('department')
        risk_threshold = float(request.args.get('risk_threshold', 0.7))
        limit = int(request.args.get('limit', 20))
        
        # Calculate attrition risk
        attrition_risks = calculate_attrition_risk()
        
        # Filter employees
        query = {'active': True}
        if department:
            query['department'] = department
            
        employees = Employee.objects(**query)
        
        # Build detailed risk profiles
        risk_profiles = []
        for employee in employees:
            if employee.employee_id in attrition_risks:
                risk_score = attrition_risks[employee.employee_id]
                
                # Only include employees with risk above threshold
                if risk_score >= risk_threshold:
                    # Get workload
                    weekly_hours = get_employee_weekly_workload(employee.employee_id)
                    
                    # Get project involvement
                    projects = Project.objects(
                        __raw__={
                            'employee_contributions.employee_id': employee.employee_id,
                            'employee_contributions.active': True
                        }
                    )
                    
                    # Calculate months since last promotion
                    months_since_promotion = 0
                    if employee.last_promotion_date:
                        months_since_promotion = (datetime.utcnow() - employee.last_promotion_date).days / 30
                    
                    risk_profiles.append({
                        'employee': employee.to_dict(),
                        'risk_score': risk_score,
                        'weekly_hours': weekly_hours,
                        'project_count': len(projects),
                        'months_since_promotion': months_since_promotion
                    })
        
        # Sort by risk score (descending)
        risk_profiles.sort(key=lambda x: x['risk_score'], reverse=True)
        
        # Limit results
        limited_profiles = risk_profiles[:limit]
        
        return jsonify({
            'success': True,
            'count': len(limited_profiles),
            'data': limited_profiles
        }), 200
    except Exception as e:
        logging.error(f"Error calculating employee risk: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to calculate employee risk: {str(e)}"
        }), 500 
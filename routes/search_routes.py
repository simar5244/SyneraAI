from flask import Blueprint, request, jsonify
import logging
from models.employee import Employee
from models.project import Project
from services.search_service import (
    process_natural_language_query,
    search_employees,
    search_projects
)

search_blueprint = Blueprint('search', __name__)

@search_blueprint.route('/employees', methods=['GET'])
def search_employees_route():
    """Search employees based on various criteria"""
    try:
        # Parse query parameters
        query = request.args.get('query')
        department = request.args.get('department')
        skills = request.args.get('skills')
        
        if skills:
            skills = skills.split(',')
        
        # Process natural language query if provided
        if query:
            search_terms = process_natural_language_query(query)
            results = search_employees(
                search_terms=search_terms,
                department=department,
                skills=skills
            )
        else:
            # Direct criteria search
            results = search_employees(
                department=department,
                skills=skills
            )
        
        return jsonify({
            'success': True,
            'count': len(results),
            'data': results
        }), 200
    except Exception as e:
        logging.error(f"Error searching employees: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to search employees: {str(e)}"
        }), 500

@search_blueprint.route('/projects', methods=['GET'])
def search_projects_route():
    """Search projects based on various criteria"""
    try:
        # Parse query parameters
        query = request.args.get('query')
        tech_stack = request.args.get('tech_stack')
        department = request.args.get('department')
        status = request.args.get('status')
        
        if tech_stack:
            tech_stack = tech_stack.split(',')
        
        # Process natural language query if provided
        if query:
            search_terms = process_natural_language_query(query)
            results = search_projects(
                search_terms=search_terms,
                tech_stack=tech_stack,
                department=department,
                status=status
            )
        else:
            # Direct criteria search
            results = search_projects(
                tech_stack=tech_stack,
                department=department,
                status=status
            )
        
        return jsonify({
            'success': True,
            'count': len(results),
            'data': results
        }), 200
    except Exception as e:
        logging.error(f"Error searching projects: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to search projects: {str(e)}"
        }), 500

@search_blueprint.route('/orgqa', methods=['POST'])
def org_qa():
    """OrgGPT: Natural language search and QA system for the organization"""
    try:
        data = request.get_json()
        query = data.get('query')
        
        if not query:
            return jsonify({
                'success': False,
                'message': 'Query parameter is required'
            }), 400
        
        # Parse query and perform search
        search_terms = process_natural_language_query(query)
        
        # Determine if this is an employee or project search
        if any(term in query.lower() for term in ['employee', 'worker', 'staff', 'person', 'people', 'who']):
            # Employee-focused search
            results = search_employees(search_terms=search_terms)
            search_type = 'employees'
        elif any(term in query.lower() for term in ['project', 'work', 'task', 'initiative', 'what']):
            # Project-focused search
            results = search_projects(search_terms=search_terms)
            search_type = 'projects'
        else:
            # Try both
            employee_results = search_employees(search_terms=search_terms)
            project_results = search_projects(search_terms=search_terms)
            
            # Return the type with more results
            if len(employee_results) >= len(project_results):
                results = employee_results
                search_type = 'employees'
            else:
                results = project_results
                search_type = 'projects'
        
        return jsonify({
            'success': True,
            'query': query,
            'search_type': search_type,
            'count': len(results),
            'data': results
        }), 200
    except Exception as e:
        logging.error(f"Error processing natural language query: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to process query: {str(e)}"
        }), 500 
from flask import Blueprint, request, jsonify
from models.project import Project, EmployeeContribution
from models.employee import Employee
from datetime import datetime
import logging
from services.project_service import calculate_project_complexity

project_blueprint = Blueprint('projects', __name__)

@project_blueprint.route('/', methods=['GET'])
def get_projects():
    """Get all projects with optional filtering"""
    try:
        # Parse query parameters
        department = request.args.get('department')
        status = request.args.get('status')
        employee_id = request.args.get('employee_id')  # Get projects for specific employee
        start_date_from = request.args.get('start_date_from')
        start_date_to = request.args.get('start_date_to')
        
        # Build the query
        query = {}
        if department:
            query['department'] = department
        if status:
            query['status'] = status
        if start_date_from:
            try:
                query['start_date__gte'] = datetime.fromisoformat(start_date_from)
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': 'Invalid start_date_from format. Use ISO format (YYYY-MM-DD)'
                }), 400
        if start_date_to:
            try:
                query['start_date__lte'] = datetime.fromisoformat(start_date_to)
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': 'Invalid start_date_to format. Use ISO format (YYYY-MM-DD)'
                }), 400
        
        # Handle employee filter (requires more complex query)
        if employee_id:
            projects = Project.objects(__raw__={'employee_contributions.employee_id': employee_id})
        else:
            projects = Project.objects(**query)
            
        return jsonify({
            'success': True,
            'count': len(projects),
            'data': [project.to_dict() for project in projects]
        }), 200
    except Exception as e:
        logging.error(f"Error retrieving projects: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to retrieve projects: {str(e)}"
        }), 500

@project_blueprint.route('/<project_id>', methods=['GET'])
def get_project(project_id):
    """Get a single project by ID"""
    try:
        project = Project.objects(project_id=project_id).first()
        if not project:
            return jsonify({
                'success': False,
                'message': f"Project with ID {project_id} not found"
            }), 404
            
        return jsonify({
            'success': True,
            'data': project.to_dict()
        }), 200
    except Exception as e:
        logging.error(f"Error retrieving project {project_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to retrieve project: {str(e)}"
        }), 500

@project_blueprint.route('/', methods=['POST'])
def create_project():
    """Create a new project"""
    try:
        data = request.get_json()
        
        # Check if project already exists
        existing = Project.objects(project_id=data.get('project_id')).first()
        if existing:
            return jsonify({
                'success': False,
                'message': f"Project with ID {data.get('project_id')} already exists"
            }), 409
        
        # Validate start/end dates
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        if start_date:
            try:
                start_date = datetime.fromisoformat(start_date) if isinstance(start_date, str) else start_date
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': 'Invalid start_date format. Use ISO format (YYYY-MM-DD)'
                }), 400
                
        if end_date:
            try:
                end_date = datetime.fromisoformat(end_date) if isinstance(end_date, str) else end_date
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': 'Invalid end_date format. Use ISO format (YYYY-MM-DD)'
                }), 400
        
        # Process employee contributions
        employee_contributions = []
        if 'employee_contributions' in data:
            for contrib in data['employee_contributions']:
                # Verify employee exists
                employee = Employee.objects(employee_id=contrib.get('employee_id')).first()
                if not employee:
                    return jsonify({
                        'success': False,
                        'message': f"Employee with ID {contrib.get('employee_id')} not found"
                    }), 404
                
                contribution = EmployeeContribution(
                    employee_id=contrib.get('employee_id'),
                    role=contrib.get('role', 'Contributor'),
                    weekly_hours=contrib.get('weekly_hours', 0.0),
                    reported_tech=contrib.get('reported_tech', []),
                    start_date=contrib.get('start_date') or datetime.utcnow(),
                    active=contrib.get('active', True)
                )
                employee_contributions.append(contribution)
        
        # Create new project
        new_project = Project(
            project_id=data.get('project_id'),
            project_title=data.get('project_title'),
            project_description=data.get('project_description'),
            tech_stack=data.get('tech_stack', []),
            start_date=start_date or datetime.utcnow(),
            end_date=end_date,
            department=data.get('department'),
            status=data.get('status', 'Planning'),
            priority=data.get('priority', 'Medium'),
            employee_contributions=employee_contributions
        )
        
        # Calculate complexity score
        new_project.complexity_score = calculate_project_complexity(new_project)
        
        # Save project
        new_project.save()
        
        return jsonify({
            'success': True,
            'message': 'Project created successfully',
            'data': new_project.to_dict()
        }), 201
    except Exception as e:
        logging.error(f"Error creating project: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to create project: {str(e)}"
        }), 500

@project_blueprint.route('/<project_id>', methods=['PUT'])
def update_project(project_id):
    """Update an existing project"""
    try:
        data = request.get_json()
        project = Project.objects(project_id=project_id).first()
        
        if not project:
            return jsonify({
                'success': False,
                'message': f"Project with ID {project_id} not found"
            }), 404
        
        # Update basic fields
        if 'project_title' in data:
            project.project_title = data['project_title']
        if 'project_description' in data:
            project.project_description = data['project_description']
        if 'tech_stack' in data:
            project.tech_stack = data['tech_stack']
        if 'status' in data:
            project.status = data['status']
        if 'priority' in data:
            project.priority = data['priority']
        if 'department' in data:
            project.department = data['department']
            
        # Handle date updates
        if 'start_date' in data:
            try:
                project.start_date = datetime.fromisoformat(data['start_date']) if isinstance(data['start_date'], str) else data['start_date']
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': 'Invalid start_date format. Use ISO format (YYYY-MM-DD)'
                }), 400
                
        if 'end_date' in data:
            try:
                if data['end_date'] is None:
                    project.end_date = None
                else:
                    project.end_date = datetime.fromisoformat(data['end_date']) if isinstance(data['end_date'], str) else data['end_date']
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': 'Invalid end_date format. Use ISO format (YYYY-MM-DD)'
                }), 400
        
        # Always update the timestamp
        project.updated_at = datetime.utcnow()
        
        # Recalculate complexity after updates
        project.complexity_score = calculate_project_complexity(project)
        
        project.save()
        
        return jsonify({
            'success': True,
            'message': 'Project updated successfully',
            'data': project.to_dict()
        }), 200
    except Exception as e:
        logging.error(f"Error updating project {project_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to update project: {str(e)}"
        }), 500

@project_blueprint.route('/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete a project"""
    try:
        project = Project.objects(project_id=project_id).first()
        
        if not project:
            return jsonify({
                'success': False,
                'message': f"Project with ID {project_id} not found"
            }), 404
        
        # Permanently delete
        project.delete()
        
        return jsonify({
            'success': True,
            'message': 'Project deleted successfully'
        }), 200
    except Exception as e:
        logging.error(f"Error deleting project {project_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to delete project: {str(e)}"
        }), 500

@project_blueprint.route('/<project_id>/contributions', methods=['POST'])
def add_contribution(project_id):
    """Add employee contribution to a project"""
    try:
        data = request.get_json()
        project = Project.objects(project_id=project_id).first()
        
        if not project:
            return jsonify({
                'success': False,
                'message': f"Project with ID {project_id} not found"
            }), 404
        
        # Verify employee exists
        employee_id = data.get('employee_id')
        employee = Employee.objects(employee_id=employee_id).first()
        if not employee:
            return jsonify({
                'success': False,
                'message': f"Employee with ID {employee_id} not found"
            }), 404
            
        # Check if employee is already contributing
        for contrib in project.employee_contributions:
            if contrib.employee_id == employee_id:
                return jsonify({
                    'success': False,
                    'message': f"Employee with ID {employee_id} is already contributing to this project"
                }), 409
        
        # Create contribution
        contribution = EmployeeContribution(
            employee_id=employee_id,
            role=data.get('role', 'Contributor'),
            weekly_hours=data.get('weekly_hours', 0.0),
            reported_tech=data.get('reported_tech', []),
            start_date=data.get('start_date') or datetime.utcnow(),
            active=True
        )
        
        # Add to project
        project.employee_contributions.append(contribution)
        project.updated_at = datetime.utcnow()
        project.save()
        
        return jsonify({
            'success': True,
            'message': 'Contribution added successfully',
            'data': project.to_dict()
        }), 200
    except Exception as e:
        logging.error(f"Error adding contribution to project {project_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to add contribution: {str(e)}"
        }), 500

@project_blueprint.route('/<project_id>/contributions/<employee_id>', methods=['PUT'])
def update_contribution(project_id, employee_id):
    """Update employee contribution to a project"""
    try:
        data = request.get_json()
        project = Project.objects(project_id=project_id).first()
        
        if not project:
            return jsonify({
                'success': False,
                'message': f"Project with ID {project_id} not found"
            }), 404
        
        # Find employee contribution
        for i, contrib in enumerate(project.employee_contributions):
            if contrib.employee_id == employee_id:
                # Update contribution fields
                if 'role' in data:
                    project.employee_contributions[i].role = data['role']
                if 'weekly_hours' in data:
                    project.employee_contributions[i].weekly_hours = data['weekly_hours']
                if 'reported_tech' in data:
                    project.employee_contributions[i].reported_tech = data['reported_tech']
                if 'active' in data:
                    project.employee_contributions[i].active = data['active']
                if 'end_date' in data and data['active'] is False:
                    project.employee_contributions[i].end_date = data.get('end_date') or datetime.utcnow()
                
                project.updated_at = datetime.utcnow()
                project.save()
                
                return jsonify({
                    'success': True,
                    'message': 'Contribution updated successfully',
                    'data': project.to_dict()
                }), 200
        
        return jsonify({
            'success': False,
            'message': f"Employee with ID {employee_id} is not contributing to this project"
        }), 404
    except Exception as e:
        logging.error(f"Error updating contribution for project {project_id}, employee {employee_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to update contribution: {str(e)}"
        }), 500 
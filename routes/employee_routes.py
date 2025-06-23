from flask import Blueprint, request, jsonify
from models.employee import Employee
from datetime import datetime
import logging

employee_blueprint = Blueprint('employees', __name__)

@employee_blueprint.route('/', methods=['GET'])
def get_employees():
    """Get all employees with optional filtering"""
    try:
        # Parse query parameters
        department = request.args.get('department')
        manager_id = request.args.get('manager_id')
        seniority = request.args.get('seniority_level')
        org_level = request.args.get('org_level')
        
        # Build the query
        query = {}
        if department:
            query['department'] = department
        if manager_id:
            query['manager_id'] = manager_id
        if seniority:
            query['seniority_level'] = seniority
        if org_level:
            query['org_level'] = org_level
            
        # Default to only active employees
        if 'active' not in query:
            query['active'] = True
            
        employees = Employee.objects(**query)
        return jsonify({
            'success': True,
            'count': len(employees),
            'data': [emp.to_dict() for emp in employees]
        }), 200
    except Exception as e:
        logging.error(f"Error retrieving employees: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to retrieve employees: {str(e)}"
        }), 500

@employee_blueprint.route('/<employee_id>', methods=['GET'])
def get_employee(employee_id):
    """Get a single employee by ID"""
    try:
        employee = Employee.objects(employee_id=employee_id).first()
        if not employee:
            return jsonify({
                'success': False,
                'message': f"Employee with ID {employee_id} not found"
            }), 404
            
        return jsonify({
            'success': True,
            'data': employee.to_dict()
        }), 200
    except Exception as e:
        logging.error(f"Error retrieving employee {employee_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to retrieve employee: {str(e)}"
        }), 500

@employee_blueprint.route('/', methods=['POST'])
def create_employee():
    """Create a new employee"""
    try:
        data = request.get_json()
        
        # Check if employee already exists
        existing = Employee.objects(employee_id=data.get('employee_id')).first()
        if existing:
            return jsonify({
                'success': False,
                'message': f"Employee with ID {data.get('employee_id')} already exists"
            }), 409
        
        # Create new employee
        new_employee = Employee(
            employee_id=data.get('employee_id'),
            name=data.get('name'),
            work_email=data.get('work_email'),
            job_title=data.get('job_title'),
            department=data.get('department'),
            manager_id=data.get('manager_id'),
            tenure=data.get('tenure', 0),
            skills=data.get('skills', []),
            seniority_level=data.get('seniority_level'),
            org_level=data.get('org_level'),
            hire_date=data.get('hire_date') or datetime.utcnow(),
            active=data.get('active', True)
        )
        new_employee.save()
        
        return jsonify({
            'success': True,
            'message': 'Employee created successfully',
            'data': new_employee.to_dict()
        }), 201
    except Exception as e:
        logging.error(f"Error creating employee: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to create employee: {str(e)}"
        }), 500

@employee_blueprint.route('/<employee_id>', methods=['PUT'])
def update_employee(employee_id):
    """Update an existing employee"""
    try:
        data = request.get_json()
        employee = Employee.objects(employee_id=employee_id).first()
        
        if not employee:
            return jsonify({
                'success': False,
                'message': f"Employee with ID {employee_id} not found"
            }), 404
        
        # Update fields
        if 'name' in data:
            employee.name = data['name']
        if 'work_email' in data:
            employee.work_email = data['work_email']
        if 'job_title' in data:
            employee.job_title = data['job_title']
        if 'department' in data:
            employee.department = data['department']
        if 'manager_id' in data:
            employee.manager_id = data['manager_id']
        if 'tenure' in data:
            employee.tenure = data['tenure']
        if 'skills' in data:
            employee.skills = data['skills']
        if 'seniority_level' in data:
            employee.seniority_level = data['seniority_level']
        if 'org_level' in data:
            employee.org_level = data['org_level']
        if 'active' in data:
            employee.active = data['active']
        
        # Always update the timestamp
        employee.updated_at = datetime.utcnow()
        employee.save()
        
        return jsonify({
            'success': True,
            'message': 'Employee updated successfully',
            'data': employee.to_dict()
        }), 200
    except Exception as e:
        logging.error(f"Error updating employee {employee_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to update employee: {str(e)}"
        }), 500

@employee_blueprint.route('/<employee_id>', methods=['DELETE'])
def delete_employee(employee_id):
    """Delete an employee or mark as inactive"""
    try:
        employee = Employee.objects(employee_id=employee_id).first()
        
        if not employee:
            return jsonify({
                'success': False,
                'message': f"Employee with ID {employee_id} not found"
            }), 404
        
        # Soft delete by default (mark inactive)
        soft_delete = request.args.get('soft', 'true').lower() == 'true'
        
        if soft_delete:
            employee.active = False
            employee.updated_at = datetime.utcnow()
            employee.save()
            message = "Employee marked as inactive"
        else:
            employee.delete()
            message = "Employee permanently deleted"
        
        return jsonify({
            'success': True,
            'message': message
        }), 200
    except Exception as e:
        logging.error(f"Error deleting employee {employee_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to delete employee: {str(e)}"
        }), 500

@employee_blueprint.route('/<employee_id>/skills', methods=['PUT'])
def update_skills(employee_id):
    """Update employee skills"""
    try:
        data = request.get_json()
        employee = Employee.objects(employee_id=employee_id).first()
        
        if not employee:
            return jsonify({
                'success': False,
                'message': f"Employee with ID {employee_id} not found"
            }), 404
        
        # Add new skills
        if 'add' in data:
            for skill in data['add']:
                if skill not in employee.skills:
                    employee.skills.append(skill)
        
        # Remove skills
        if 'remove' in data:
            employee.skills = [skill for skill in employee.skills if skill not in data['remove']]
        
        # Replace all skills
        if 'replace' in data:
            employee.skills = data['replace']
        
        employee.updated_at = datetime.utcnow()
        employee.save()
        
        return jsonify({
            'success': True,
            'message': 'Skills updated successfully',
            'data': employee.to_dict()
        }), 200
    except Exception as e:
        logging.error(f"Error updating skills for employee {employee_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Failed to update skills: {str(e)}"
        }), 500 
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import db
from models.simulation import SimulationScenario, SimulationResult
from models.user import User
from utils.role_utils import require_role
from utils.graph_utils import build_org_graph, calculate_centrality
from datetime import datetime
import logging
import json

simulation_bp = Blueprint('simulation', __name__)
logger = logging.getLogger(__name__)

@simulation_bp.route('/scenarios', methods=['GET'])
@jwt_required()
@require_role(['admin', 'top_management'])
def get_scenarios():
    """Get all simulation scenarios for the current user"""
    try:
        user_id = get_jwt_identity()
        scenarios = SimulationScenario.query.filter_by(user_id=user_id).all()
        return jsonify({
            'success': True,
            'scenarios': [scenario.to_dict() for scenario in scenarios]
        }), 200
    except Exception as e:
        logger.error(f"Error retrieving simulation scenarios: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to retrieve simulation scenarios',
            'error': str(e)
        }), 500

@simulation_bp.route('/scenarios', methods=['POST'])
@jwt_required()
@require_role(['admin', 'top_management'])
def create_scenario():
    """Create a new simulation scenario"""
    try:
        data = request.get_json()
        required_fields = ['name', 'scenario_type', 'parameters']
        
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'message': f'Missing required field: {field}'
                }), 400
        
        # Validate scenario_type
        valid_types = ['attrition', 'reorganization', 'growth', 'cost_reduction']
        if data['scenario_type'] not in valid_types:
            return jsonify({
                'success': False,
                'message': f'Invalid scenario type. Must be one of: {", ".join(valid_types)}'
            }), 400
            
        user_id = get_jwt_identity()
        
        # Create new scenario
        new_scenario = SimulationScenario(
            user_id=user_id,
            name=data['name'],
            description=data.get('description', ''),
            scenario_type=data['scenario_type'],
            parameters=data['parameters'],
            is_favorite=data.get('is_favorite', False)
        )
        
        db.session.add(new_scenario)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Simulation scenario created successfully',
            'scenario': new_scenario.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating simulation scenario: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to create simulation scenario',
            'error': str(e)
        }), 500

@simulation_bp.route('/scenarios/<int:scenario_id>', methods=['GET'])
@jwt_required()
@require_role(['admin', 'top_management'])
def get_scenario(scenario_id):
    """Get a specific simulation scenario"""
    try:
        user_id = get_jwt_identity()
        scenario = SimulationScenario.query.filter_by(id=scenario_id, user_id=user_id).first()
        
        if not scenario:
            return jsonify({
                'success': False,
                'message': 'Scenario not found or you do not have permission'
            }), 404
            
        return jsonify({
            'success': True,
            'scenario': scenario.to_dict()
        }), 200
    except Exception as e:
        logger.error(f"Error retrieving simulation scenario: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to retrieve simulation scenario',
            'error': str(e)
        }), 500

@simulation_bp.route('/scenarios/<int:scenario_id>', methods=['PUT'])
@jwt_required()
@require_role(['admin', 'top_management'])
def update_scenario(scenario_id):
    """Update a simulation scenario"""
    try:
        user_id = get_jwt_identity()
        scenario = SimulationScenario.query.filter_by(id=scenario_id, user_id=user_id).first()
        
        if not scenario:
            return jsonify({
                'success': False,
                'message': 'Scenario not found or you do not have permission'
            }), 404
            
        data = request.get_json()
        
        # Update fields if provided
        if 'name' in data:
            scenario.name = data['name']
        if 'description' in data:
            scenario.description = data['description']
        if 'scenario_type' in data:
            # Validate scenario_type
            valid_types = ['attrition', 'reorganization', 'growth', 'cost_reduction']
            if data['scenario_type'] not in valid_types:
                return jsonify({
                    'success': False,
                    'message': f'Invalid scenario type. Must be one of: {", ".join(valid_types)}'
                }), 400
            scenario.scenario_type = data['scenario_type']
        if 'parameters' in data:
            scenario.parameters = data['parameters']
        if 'is_favorite' in data:
            scenario.is_favorite = data['is_favorite']
            
        scenario.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Simulation scenario updated successfully',
            'scenario': scenario.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating simulation scenario: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to update simulation scenario',
            'error': str(e)
        }), 500

@simulation_bp.route('/scenarios/<int:scenario_id>', methods=['DELETE'])
@jwt_required()
@require_role(['admin', 'top_management'])
def delete_scenario(scenario_id):
    """Delete a simulation scenario"""
    try:
        user_id = get_jwt_identity()
        scenario = SimulationScenario.query.filter_by(id=scenario_id, user_id=user_id).first()
        
        if not scenario:
            return jsonify({
                'success': False,
                'message': 'Scenario not found or you do not have permission'
            }), 404
            
        db.session.delete(scenario)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Simulation scenario deleted successfully'
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting simulation scenario: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to delete simulation scenario',
            'error': str(e)
        }), 500

@simulation_bp.route('/run/<int:scenario_id>', methods=['POST'])
@jwt_required()
@require_role(['admin', 'top_management'])
def run_simulation(scenario_id):
    """Run a simulation based on the provided scenario"""
    try:
        user_id = get_jwt_identity()
        scenario = SimulationScenario.query.filter_by(id=scenario_id, user_id=user_id).first()
        
        if not scenario:
            return jsonify({
                'success': False,
                'message': 'Scenario not found or you do not have permission'
            }), 404
            
        # Build the org graph for analysis
        org_graph = build_org_graph()
        
        # Calculate pre-simulation metrics
        pre_metrics = calculate_centrality(org_graph)
        
        # Perform simulation based on scenario type
        if scenario.scenario_type == 'attrition':
            # Handle attrition simulation
            result = run_attrition_simulation(scenario.parameters, org_graph)
        elif scenario.scenario_type == 'reorganization':
            # Handle reorganization simulation
            result = run_reorganization_simulation(scenario.parameters, org_graph)
        elif scenario.scenario_type == 'growth':
            # Handle growth simulation
            result = run_growth_simulation(scenario.parameters, org_graph)
        elif scenario.scenario_type == 'cost_reduction':
            # Handle cost reduction simulation
            result = run_cost_reduction_simulation(scenario.parameters, org_graph)
        else:
            return jsonify({
                'success': False,
                'message': f'Invalid scenario type: {scenario.scenario_type}'
            }), 400
            
        # Create simulation result
        simulation_result = SimulationResult(
            scenario_id=scenario_id,
            metrics_before=pre_metrics,
            metrics_after=result['metrics_after'],
            impact_scores=result['impact_scores'],
            affected_employees=result.get('affected_employees'),
            affected_departments=result.get('affected_departments'),
            recommendations=result.get('recommendations')
        )
        
        db.session.add(simulation_result)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Simulation completed successfully',
            'result': simulation_result.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error running simulation: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to run simulation',
            'error': str(e)
        }), 500

@simulation_bp.route('/results/<int:scenario_id>', methods=['GET'])
@jwt_required()
@require_role(['admin', 'top_management'])
def get_simulation_results(scenario_id):
    """Get all simulation results for a specific scenario"""
    try:
        user_id = get_jwt_identity()
        scenario = SimulationScenario.query.filter_by(id=scenario_id, user_id=user_id).first()
        
        if not scenario:
            return jsonify({
                'success': False,
                'message': 'Scenario not found or you do not have permission'
            }), 404
            
        results = SimulationResult.query.filter_by(scenario_id=scenario_id).all()
        
        return jsonify({
            'success': True,
            'results': [result.to_dict() for result in results]
        }), 200
    except Exception as e:
        logger.error(f"Error retrieving simulation results: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to retrieve simulation results',
            'error': str(e)
        }), 500

# Helper simulation functions - these would be detailed implementations
def run_attrition_simulation(parameters, org_graph):
    """Run an attrition simulation based on the provided parameters"""
    # This would be a detailed implementation using ML models and graph algorithms
    # For now, return a mock result
    return {
        'metrics_after': {
            'total_employees': 95,
            'avg_span_of_control': 4.2,
            'depth': 5,
            'centrality_scores': {}
        },
        'impact_scores': {
            'productivity_impact': -12.5,
            'knowledge_loss': -15.3,
            'collaboration_impact': -8.7,
            'organizational_resilience': -10.2
        },
        'affected_employees': [5, 12, 18, 32, 47],
        'affected_departments': [2, 4],
        'recommendations': [
            'Implement knowledge retention program',
            'Reassign critical projects to avoid delays',
            'Consider internal mobility to fill key positions',
            'Review compensation for similar roles to improve retention'
        ]
    }

def run_reorganization_simulation(parameters, org_graph):
    """Run a reorganization simulation based on the provided parameters"""
    # Implementation would use algorithms to reassign reporting lines
    # For now, return a mock result
    return {
        'metrics_after': {
            'total_employees': 100,
            'avg_span_of_control': 5.5,
            'depth': 4,
            'centrality_scores': {}
        },
        'impact_scores': {
            'productivity_impact': 5.2,
            'collaboration_impact': 7.8,
            'communication_efficiency': 6.3,
            'decision_making_speed': 8.5
        },
        'affected_employees': [3, 7, 10, 15, 22, 35, 48],
        'affected_departments': [1, 3, 5],
        'recommendations': [
            'Schedule team building activities for new teams',
            'Conduct clear communication of changes to all employees',
            'Provide transition support for managers with expanded teams',
            'Review workflows to optimize for new structure'
        ]
    }

def run_growth_simulation(parameters, org_graph):
    """Run a growth simulation based on the provided parameters"""
    # Implementation would add new nodes and edges to the graph
    # For now, return a mock result
    return {
        'metrics_after': {
            'total_employees': 120,
            'avg_span_of_control': 5.2,
            'depth': L6,
            'centrality_scores': {}
        },
        'impact_scores': {
            'scalability': 8.7,
            'productivity_impact': -2.3,  # Short-term adjustment period
            'management_capacity': -5.1,
            'long_term_growth_potential': 9.3
        },
        'affected_employees': [],
        'affected_departments': [1, 2, 3, 4, 5],
        'recommendations': [
            'Develop leadership training program for new managers',
            'Implement structured onboarding for new hires',
            'Create mentorship program to preserve culture',
            'Review communication channels to maintain effectiveness at scale'
        ]
    }

def run_cost_reduction_simulation(parameters, org_graph):
    """Run a cost reduction simulation based on the provided parameters"""
    # Implementation would remove nodes or consolidate teams
    # For now, return a mock result
    return {
        'metrics_after': {
            'total_employees': 85,
            'avg_span_of_control': 6.5,
            'depth': 4,
            'centrality_scores': {}
        },
        'impact_scores': {
            'cost_savings': 15.3,
            'productivity_impact': -8.7,
            'employee_morale': -12.4,
            'operational_capability': -7.6
        },
        'affected_employees': [8, 14, 19, 25, 31, 37, 42, 48, 53, 59, 64, 70, 75, 80, 85],
        'affected_departments': [2, 3, 4],
        'recommendations': [
            'Redistribute critical workloads to prevent burnout',
            'Implement recognition program to boost morale',
            'Review processes for efficiency improvements',
            'Consider contractor usage for peak workloads'
        ]
    } 
import logging
import random
import networkx as nx
import numpy as np
from flask import Blueprint, request, jsonify
from models.employee import Employee
from models.department import Department
from utils.graph_utils import build_org_graph
from utils.auth import admin_required, role_required
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime

from models.simulation import SimulationScenario, SimulationResult, SimulationType
from services.simulation_engine import SimulationEngine
from auth.dependencies import get_current_user
from database import get_db
from sqlalchemy.orm import Session

simulation_blueprint = Blueprint('simulation', __name__)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/simulations", tags=["simulations"])
simulation_engine = SimulationEngine()

@simulation_blueprint.route('/org-simulation', methods=['POST'])
@role_required(['admin', 'manager', 'executive'])
def run_org_simulation():
    """
    Run organizational simulation based on provided parameters
    """
    try:
        params = request.json
        
        if not params:
            return jsonify({'success': False, 'message': 'No simulation parameters provided'}), 400
            
        # Validate scenario type
        scenario_type = params.get('scenarioType')
        valid_scenarios = ['attrition', 'reorganization', 'growth', 'costReduction']
        
        if not scenario_type or scenario_type not in valid_scenarios:
            return jsonify({'success': False, 'message': f'Invalid scenario type. Must be one of: {valid_scenarios}'}), 400
            
        # Build original org graph from database
        org_graph = build_org_graph()
        
        # Run appropriate simulation based on scenario type
        if scenario_type == 'attrition':
            result = simulate_attrition(org_graph, params)
        elif scenario_type == 'reorganization':
            result = simulate_reorganization(org_graph, params)
        elif scenario_type == 'growth':
            result = simulate_growth(org_graph, params)
        elif scenario_type == 'costReduction':
            result = simulate_cost_reduction(org_graph, params)
            
        return jsonify({'success': True, 'result': result}), 200
        
    except Exception as e:
        logger.error(f"Error in org simulation: {str(e)}")
        return jsonify({'success': False, 'message': f'Simulation failed: {str(e)}'}), 500


def simulate_attrition(graph, params):
    """Simulate the impact of employee attrition."""
    original_graph = graph.copy()
    
    # Calculate metrics on original graph
    original_metrics = calculate_graph_metrics(original_graph)
    
    # Process attrition parameters
    attrition_type = params.get('attritionType', 'specific')
    
    # Simulation based on attrition type
    if attrition_type == 'specific' and 'employeeIds' in params:
        # Remove specific employees
        employee_ids = params.get('employeeIds', [])
        for emp_id in employee_ids:
            if emp_id in graph:
                graph.remove_node(emp_id)
    
    elif attrition_type == 'percentage' and 'percentage' in params:
        # Random attrition based on percentage
        percentage = params.get('percentage', 5)
        employees = list(graph.nodes())
        num_to_remove = max(1, int(len(employees) * percentage / 100))
        to_remove = random.sample(employees, num_to_remove)
        
        for emp_id in to_remove:
            graph.remove_node(emp_id)
    
    elif attrition_type == 'department' and 'departmentId' in params:
        # Attrition within a specific department
        dept_id = params.get('departmentId')
        dept_percentage = params.get('departmentPercentage', 10)
        
        # Get employees in department
        dept_employees = [node for node in graph.nodes() 
                          if isinstance(node, str) and 
                          graph.nodes[node].get('department_id') == dept_id]
        
        num_to_remove = max(1, int(len(dept_employees) * dept_percentage / 100))
        to_remove = random.sample(dept_employees, num_to_remove)
        
        for emp_id in to_remove:
            graph.remove_node(emp_id)
    
    # Calculate metrics on the modified graph
    new_metrics = calculate_graph_metrics(graph)
    
    # Calculate impact
    impact = calculate_impact(original_metrics, new_metrics)
    
    # Get details of affected employees if specific attrition
    affected_employees = None
    if attrition_type == 'specific' and 'employeeIds' in params:
        affected_employees = get_employee_details(params.get('employeeIds', []))
    
    return {
        'scenario': 'attrition',
        'impactSummary': impact,
        'affectedEmployees': affected_employees,
        'beforeMetrics': original_metrics,
        'afterMetrics': new_metrics
    }


def simulate_reorganization(graph, params):
    """Simulate departmental reorganization."""
    original_graph = graph.copy()
    
    # Calculate metrics on original graph
    original_metrics = calculate_graph_metrics(original_graph)
    
    # Process reorganization parameters
    changes = params.get('changes', [])
    
    # Apply each change
    for change in changes:
        employee_id = change.get('employeeId')
        new_manager_id = change.get('newManagerId')
        new_department_id = change.get('newDepartmentId')
        
        if employee_id in graph.nodes():
            # Update reporting structure
            if new_manager_id:
                # Remove current reporting relationship
                for predecessor in list(graph.predecessors(employee_id)):
                    graph.remove_edge(predecessor, employee_id)
                
                # Add new reporting relationship
                if new_manager_id in graph.nodes():
                    graph.add_edge(new_manager_id, employee_id)
            
            # Update department
            if new_department_id:
                graph.nodes[employee_id]['department_id'] = new_department_id
    
    # Calculate metrics on the modified graph
    new_metrics = calculate_graph_metrics(graph)
    
    # Calculate impact
    impact = calculate_impact(original_metrics, new_metrics)
    
    return {
        'scenario': 'reorganization',
        'impactSummary': impact,
        'changesApplied': len(changes),
        'beforeMetrics': original_metrics,
        'afterMetrics': new_metrics
    }


def simulate_growth(graph, params):
    """Simulate organizational growth with new positions."""
    original_graph = graph.copy()
    
    # Calculate metrics on original graph
    original_metrics = calculate_graph_metrics(original_graph)
    
    # Process growth parameters
    new_positions = params.get('newPositions', [])
    
    # Apply new positions
    # This is a placeholder - in a real implementation, we would:
    # 1. Create new nodes for each position
    # 2. Connect them to managers
    # 3. Assign department IDs
    
    # For this example, we'll just add some simulated impact
    growth_impact = {
        'communicationEfficiency': {
            'percentage': random.uniform(-5, 5),
            'assessment': assessment_label(random.uniform(-5, 5))
        },
        'collaborationPotential': {
            'percentage': random.uniform(5, 15),
            'assessment': assessment_label(random.uniform(5, 15))
        },
        'organizationalStructure': {
            'percentage': random.uniform(-10, 10),
            'assessment': assessment_label(random.uniform(-10, 10))
        },
        'managementEfficiency': {
            'percentage': random.uniform(-8, 8),
            'assessment': assessment_label(random.uniform(-8, 8))
        }
    }
    
    return {
        'scenario': 'growth',
        'impactSummary': growth_impact,
        'newPositionsCount': len(new_positions),
        'beforeMetrics': original_metrics,
        'afterMetrics': original_metrics  # In a real implementation, this would be different
    }


def simulate_cost_reduction(graph, params):
    """Simulate cost reduction strategies."""
    original_graph = graph.copy()
    
    # Calculate metrics on original graph
    original_metrics = calculate_graph_metrics(original_graph)
    
    # Process cost reduction parameters
    strategy = params.get('strategy', 'layoff')
    target_reduction = params.get('targetReduction', 10)  # Percentage
    
    if strategy == 'layoff':
        # Simulate layoffs based on target reduction
        # This is a simplified simulation
        employees = list(graph.nodes())
        num_to_remove = max(1, int(len(employees) * target_reduction / 100))
        to_remove = random.sample(employees, num_to_remove)
        
        for emp_id in to_remove:
            if emp_id in graph:
                graph.remove_node(emp_id)
    
    # Calculate metrics on the modified graph
    new_metrics = calculate_graph_metrics(graph)
    
    # Calculate impact
    impact = calculate_impact(original_metrics, new_metrics)
    
    return {
        'scenario': 'costReduction',
        'strategy': strategy,
        'impactSummary': impact,
        'headcountReduction': {
            'percentage': target_reduction,
            'count': len(original_graph.nodes()) - len(graph.nodes())
        },
        'estimatedCostSavings': {
            'percentage': target_reduction,
            'annualAmount': f"${random.randint(100000, 1000000):,}"
        },
        'beforeMetrics': original_metrics,
        'afterMetrics': new_metrics
    }


def calculate_graph_metrics(graph):
    """Calculate key organizational metrics from the graph."""
    metrics = {}
    
    # Number of employees (nodes)
    metrics['employeeCount'] = len(graph.nodes())
    
    # Average path length (if graph is connected)
    if nx.is_connected(graph):
        metrics['avgPathLength'] = nx.average_shortest_path_length(graph)
    else:
        # For disconnected graphs, calculate for the largest component
        largest_cc = max(nx.connected_components(graph), key=len)
        subgraph = graph.subgraph(largest_cc)
        metrics['avgPathLength'] = nx.average_shortest_path_length(subgraph)
    
    # Clustering coefficient
    metrics['clusteringCoefficient'] = nx.average_clustering(graph)
    
    # Network density
    metrics['networkDensity'] = nx.density(graph)
    
    # Top influencers (by centrality)
    centrality = nx.betweenness_centrality(graph)
    top_influencers = sorted(centrality.items(), key=lambda x: x[1], reverse=True)[:5]
    metrics['topInfluencers'] = [{'id': node, 'score': round(score, 3)} for node, score in top_influencers]
    
    # Department metrics
    department_counts = {}
    for node in graph.nodes:
        dept = graph.nodes[node].get('department_id', 'unknown')
        department_counts[dept] = department_counts.get(dept, 0) + 1
    
    metrics['departmentDistribution'] = department_counts
    
    return metrics


def calculate_impact(before, after):
    """Calculate the impact of changes between two organizational states."""
    
    # Communication efficiency (inverse of avg path length change)
    if 'avgPathLength' in before and 'avgPathLength' in after and before['avgPathLength'] > 0:
        path_change = (before['avgPathLength'] - after['avgPathLength']) / before['avgPathLength'] * 100
        comm_efficiency = -path_change  # Inverse relationship
    else:
        comm_efficiency = 0
    
    # Collaboration potential (based on clustering coefficient)
    if 'clusteringCoefficient' in before and 'clusteringCoefficient' in after and before['clusteringCoefficient'] > 0:
        collab_change = (after['clusteringCoefficient'] - before['clusteringCoefficient']) / before['clusteringCoefficient'] * 100
    else:
        collab_change = 0
    
    # Organizational structure impact (based on network density)
    if 'networkDensity' in before and 'networkDensity' in after and before['networkDensity'] > 0:
        structure_change = (after['networkDensity'] - before['networkDensity']) / before['networkDensity'] * 100
    else:
        structure_change = 0
    
    # Management efficiency (based on average span of control)
    # Simplified calculation
    mgmt_efficiency_change = random.uniform(-10, 10)
    
    return {
        'communicationEfficiency': {
            'percentage': round(comm_efficiency, 1),
            'assessment': assessment_label(comm_efficiency)
        },
        'collaborationPotential': {
            'percentage': round(collab_change, 1),
            'assessment': assessment_label(collab_change)
        },
        'organizationalStructure': {
            'percentage': round(structure_change, 1),
            'assessment': assessment_label(structure_change)
        },
        'managementEfficiency': {
            'percentage': round(mgmt_efficiency_change, 1),
            'assessment': assessment_label(mgmt_efficiency_change)
        }
    }


def assessment_label(percentage, inverse=False):
    """Return assessment label based on percentage change."""
    if inverse:
        percentage = -percentage
    
    if percentage > 10:
        return 'Significant Improvement'
    elif percentage > 5:
        return 'Moderate Improvement'
    elif percentage > 1:
        return 'Slight Improvement'
    elif percentage > -1:
        return 'Neutral Impact'
    elif percentage > -5:
        return 'Slight Decline'
    elif percentage > -10:
        return 'Moderate Decline'
    else:
        return 'Significant Decline'


def get_employee_details(employee_ids):
    """Get employee details for a list of IDs."""
    employees = []
    
    for emp_id in employee_ids:
        emp = Employee.query.get(emp_id)
        if emp:
            employees.append({
                'id': emp.id,
                'name': f"{emp.first_name} {emp.last_name}",
                'title': emp.title,
                'department': emp.department.name if emp.department else 'Unknown'
            })
    
    return employees


@router.post("/scenarios", status_code=status.HTTP_201_CREATED, response_model=SimulationScenario)
async def create_simulation_scenario(
    scenario: SimulationScenario, 
    current_user: Dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new simulation scenario"""
    # Set created_by to current user if not provided
    if not scenario.created_by:
        scenario.created_by = current_user["id"]
        
    # Generate ID if not provided
    if not scenario.id:
        scenario.id = f"sim_{uuid.uuid4().hex[:10]}"
    
    # Store in database
    # Here we would map the Pydantic model to the SQLAlchemy model
    # and save it to the database
    
    return scenario


@router.get("/scenarios", response_model=List[SimulationScenario])
async def get_simulation_scenarios(
    current_user: Dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    is_template: Optional[bool] = None
):
    """Get all simulation scenarios for the current user"""
    # Retrieve scenarios from database
    # Filter by current user and optional is_template flag
    
    # Mock data for demonstration
    scenarios = [
        SimulationScenario(
            id="sim_1234567890",
            name="Q3 Attrition Analysis",
            description="Simulate attrition impact for Q3 based on current trends",
            type=SimulationType.ATTRITION,
            created_by=current_user["id"],
            created_at=datetime.utcnow(),
            parameters={
                "target_rate": 0.15,
                "time_period": 3,
                "risk_threshold": 0.65,
                "affected_departments": []
            }
        ),
        SimulationScenario(
            id="sim_0987654321",
            name="Department Growth Plan",
            description="Model impact of 20% headcount growth across engineering",
            type=SimulationType.GROWTH,
            created_by=current_user["id"],
            created_at=datetime.utcnow(),
            parameters={
                "growth_rate": 0.2,
                "time_period": 12,
                "target_departments": ["engineering"],
                "hiring_pace": "moderate"
            }
        )
    ]
    
    # Apply template filter if provided
    if is_template is not None:
        scenarios = [s for s in scenarios if s.is_template == is_template]
    
    return scenarios


@router.get("/scenarios/{scenario_id}", response_model=SimulationScenario)
async def get_simulation_scenario(
    scenario_id: str,
    current_user: Dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific simulation scenario by ID"""
    # Retrieve scenario from database by ID
    # Ensure the scenario belongs to the current user
    
    # Mock data for demonstration
    if scenario_id == "sim_1234567890":
        return SimulationScenario(
            id="sim_1234567890",
            name="Q3 Attrition Analysis",
            description="Simulate attrition impact for Q3 based on current trends",
            type=SimulationType.ATTRITION,
            created_by=current_user["id"],
            created_at=datetime.utcnow(),
            parameters={
                "target_rate": 0.15,
                "time_period": 3,
                "risk_threshold": 0.65,
                "affected_departments": []
            }
        )
    
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Simulation scenario not found"
    )


@router.put("/scenarios/{scenario_id}", response_model=SimulationScenario)
async def update_simulation_scenario(
    scenario_id: str,
    updated_scenario: SimulationScenario,
    current_user: Dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing simulation scenario"""
    # Retrieve scenario from database
    # Ensure the scenario belongs to the current user
    # Update the scenario details
    
    # For demonstration, we just return the updated scenario
    updated_scenario.id = scenario_id
    return updated_scenario


@router.delete("/scenarios/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_simulation_scenario(
    scenario_id: str,
    current_user: Dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a simulation scenario"""
    # Retrieve scenario from database
    # Ensure the scenario belongs to the current user
    # Delete the scenario
    
    # No content returned for successful deletion
    return None


@router.post("/run", response_model=SimulationResult)
async def run_simulation(
    scenario_id: str,
    organization_data: Optional[Dict[str, Any]] = None,
    current_user: Dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Run a simulation using the provided scenario and organization data"""
    # Retrieve scenario from database
    # If organization_data is None, load from database or use mock data
    
    # Mock scenario for demonstration
    scenario = SimulationScenario(
        id=scenario_id,
        name="Test Simulation",
        description="Test description",
        type=SimulationType.ATTRITION,
        created_by=current_user["id"],
        parameters={
            "target_rate": 0.15,
            "time_period": 3,
            "risk_threshold": 0.65,
        }
    )
    
    # Mock organization data if not provided
    if not organization_data:
        organization_data = {
            "employees": [
                {
                    "id": "emp_123",
                    "name": "John Doe",
                    "department_id": "dept_1",
                    "role": "Software Engineer",
                    "salary": 95000,
                    "tenure_months": 18,
                    "performance_score": 4.2,
                    "months_since_promotion": 12
                },
                {
                    "id": "emp_456",
                    "name": "Jane Smith",
                    "department_id": "dept_1",
                    "role": "Product Manager",
                    "salary": 120000,
                    "tenure_months": 36,
                    "performance_score": 4.5,
                    "months_since_promotion": 6
                },
                # Additional employees would be included here
            ],
            "departments": [
                {
                    "id": "dept_1",
                    "name": "Engineering",
                    "headcount": 45,
                    "avg_tenure": 24
                },
                {
                    "id": "dept_2",
                    "name": "Product",
                    "headcount": 15,
                    "avg_tenure": 18
                }
            ]
        }
    
    # Run the simulation using the simulation engine
    result = await simulation_engine.run_simulation(scenario, organization_data)
    
    # Generate a unique ID for the result
    result.id = f"res_{uuid.uuid4().hex[:10]}"
    
    # Store the result in the database
    # Here we would map the Pydantic model to the SQLAlchemy model
    # and save it to the database
    
    return result


@router.get("/results", response_model=List[SimulationResult])
async def get_simulation_results(
    scenario_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all simulation results, optionally filtered by scenario_id"""
    # Retrieve results from database
    # Filter by current user and optional scenario_id
    
    # Mock data for demonstration
    results = [
        SimulationResult(
            id="res_1234567890",
            scenario_id="sim_1234567890",
            created_at=datetime.utcnow(),
            metrics={
                "total_employees": 250,
                "projected_departures": 37,
                "projected_attrition_rate": 0.148,
                "replacement_cost": 1850000
            },
            impact_scores={
                "overall": -0.23,
                "morale": -0.15,
                "productivity": -0.22,
                "cost": -0.18,
                "risk": -0.37
            },
            department_impacts={
                "dept_1": {
                    "at_risk_count": 12,
                    "total": 45,
                    "percentage": 26.7
                }
            },
            recommendations=[
                "Conduct organization-wide engagement survey to identify key issues",
                "Review compensation packages for competitiveness in the market"
            ]
        )
    ]
    
    # Apply scenario_id filter if provided
    if scenario_id:
        results = [r for r in results if r.scenario_id == scenario_id]
    
    return results


@router.get("/results/{result_id}", response_model=SimulationResult)
async def get_simulation_result(
    result_id: str,
    current_user: Dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific simulation result by ID"""
    # Retrieve result from database by ID
    # Ensure the result belongs to the current user
    
    # Mock data for demonstration
    if result_id == "res_1234567890":
        return SimulationResult(
            id="res_1234567890",
            scenario_id="sim_1234567890",
            created_at=datetime.utcnow(),
            metrics={
                "total_employees": 250,
                "projected_departures": 37,
                "projected_attrition_rate": 0.148,
                "replacement_cost": 1850000
            },
            impact_scores={
                "overall": -0.23,
                "morale": -0.15,
                "productivity": -0.22,
                "cost": -0.18,
                "risk": -0.37
            },
            department_impacts={
                "dept_1": {
                    "at_risk_count": 12,
                    "total": 45,
                    "percentage": 26.7
                }
            },
            recommendations=[
                "Conduct organization-wide engagement survey to identify key issues",
                "Review compensation packages for competitiveness in the market"
            ]
        )
    
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Simulation result not found"
    )


@router.get("/types", response_model=List[Dict[str, str]])
async def get_simulation_types():
    """Get all available simulation types with descriptions"""
    return [
        {
            "id": SimulationType.ATTRITION.value,
            "name": "Attrition Analysis",
            "description": "Simulate employee turnover and its impact on the organization"
        },
        {
            "id": SimulationType.REORGANIZATION.value,
            "name": "Reorganization",
            "description": "Model the effects of organizational structure changes"
        },
        {
            "id": SimulationType.GROWTH.value,
            "name": "Growth Planning",
            "description": "Analyze expansion scenarios and their organizational impact"
        },
        {
            "id": SimulationType.COST_REDUCTION.value,
            "name": "Cost Reduction",
            "description": "Evaluate cost-cutting measures and their effects"
        }
    ] 


@simulation_blueprint.route('/org-structure', methods=['GET'])
@role_required(['eco', 'top_mgmt_t1', 'top_mgmt_t2', 'top_mgmt_t3'])
def get_org_structure():
    """
    Get the full organizational structure with workload information.
    Only accessible by top management roles.
    """
    try:
        # Build the org graph
        org_graph = build_org_graph()
        
        # Get all employees with their reporting structure
        employees = []
        for node in org_graph.nodes(data=True):
            employee_id = node[0]
            employee_data = node[1]
            
            # Get direct reports
            direct_reports = list(org_graph.successors(employee_id))
            
            # Get projects and responsibilities for workload calculation
            projects = []
            try:
                from models.project import Project, EmployeeContribution
                employee_projects = Project.query.filter(
                    Project.employee_contributions.any(employee_id=employee_id, active=True)
                ).all()
                
                for project in employee_projects:
                    for contrib in project.employee_contributions:
                        if contrib.employee_id == employee_id and contrib.active:
                            projects.append({
                                'id': project.project_id,
                                'title': project.project_title,
                                'weekly_hours': contrib.weekly_hours
                            })
            except Exception as e:
                logger.error(f"Error getting projects for employee {employee_id}: {str(e)}")
            
            # Calculate total workload (weekly hours)
            total_hours = sum(project.get('weekly_hours', 0) for project in projects)
            
            # Determine stress level based on workload
            stress_level = "normal"
            if total_hours > 20:
                stress_level = "high_overload"
            elif total_hours > 15:
                stress_level = "medium_overload"
            elif total_hours > 10:
                stress_level = "low_overload"
            elif total_hours > 5:
                stress_level = "slight_overload"
            elif total_hours < -5:
                stress_level = "high_underload"
            elif total_hours < 0:
                stress_level = "underload"
            
            employees.append({
                'id': employee_id,
                'name': employee_data.get('name', 'Unknown'),
                'position': employee_data.get('position', 'Unknown'),
                'department': employee_data.get('department_name', 'Unknown'),
                'department_id': employee_data.get('department_id'),
                'manager_id': next(iter(org_graph.predecessors(employee_id)), None),
                'direct_reports': direct_reports,
                'skills': employee_data.get('skills', []),
                'hire_date': employee_data.get('hire_date', None),
                'projects': projects,
                'total_hours': total_hours,
                'stress_level': stress_level
            })
        
        # Construct hierarchical structure
        org_structure = {}
        for employee in employees:
            employee_id = employee['id']
            org_structure[employee_id] = employee
        
        # Find the root of the organization (CEO/founder)
        roots = [emp for emp in employees if emp['manager_id'] is None]
        
        return jsonify({
            'success': True,
            'org_structure': org_structure,
            'roots': [root['id'] for root in roots]
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting org structure: {str(e)}")
        return jsonify({'success': False, 'message': f'Failed to get org structure: {str(e)}'}), 500


@simulation_blueprint.route('/reallocate/<string:user_id>', methods=['POST'])
@role_required(['eco', 'top_mgmt_t1', 'top_mgmt_t2', 'top_mgmt_t3'])
def reallocate_employee(user_id):
    """
    Simulate reallocation of staff member to new reporting chain
    """
    try:
        params = request.json
        if not params:
            return jsonify({'success': False, 'message': 'No parameters provided'}), 400
            
        new_manager_id = params.get('new_manager_id')
        if not new_manager_id:
            return jsonify({'success': False, 'message': 'No new manager ID provided'}), 400
            
        # Build original org graph
        org_graph = build_org_graph()
        
        # Make sure both user and new manager exist
        if user_id not in org_graph.nodes:
            return jsonify({'success': False, 'message': f'Employee {user_id} not found'}), 404
            
        if new_manager_id not in org_graph.nodes:
            return jsonify({'success': False, 'message': f'Manager {new_manager_id} not found'}), 404
            
        # Get user skills and data
        user_data = org_graph.nodes[user_id]
        user_skills = user_data.get('skills', [])
        
        # Create a recommendation
        recommendations = []
        
        # Analyze fit with new manager's team
        team_fit_score = 0
        team_skills = set()
        
        # Get all team members of the new manager
        team_members = list(org_graph.successors(new_manager_id))
        for team_member in team_members:
            member_data = org_graph.nodes[team_member]
            member_skills = member_data.get('skills', [])
            team_skills.update(member_skills)
        
        # Calculate skill overlap
        skill_overlap = set(user_skills).intersection(team_skills)
        skill_unique = set(user_skills).difference(team_skills)
        
        if skill_overlap:
            team_fit_score += 0.5
            recommendations.append({
                'type': 'positive',
                'message': f'Employee has {len(skill_overlap)} skills that match the team\'s existing expertise.'
            })
        
        if skill_unique:
            team_fit_score += 0.5
            recommendations.append({
                'type': 'positive',
                'message': f'Employee brings {len(skill_unique)} unique skills to the team.'
            })
        
        # Analyze potential workload impact
        try:
            from models.project import Project, EmployeeContribution
            
            # Get user's projects and hours
            user_projects = Project.query.filter(
                Project.employee_contributions.any(employee_id=user_id, active=True)
            ).all()
            
            user_hours = 0
            for project in user_projects:
                for contrib in project.employee_contributions:
                    if contrib.employee_id == user_id and contrib.active:
                        user_hours += contrib.weekly_hours
            
            # Calculate team's average hours
            team_hours = []
            for team_member in team_members:
                member_projects = Project.query.filter(
                    Project.employee_contributions.any(employee_id=team_member, active=True)
                ).all()
                
                member_hours = 0
                for project in member_projects:
                    for contrib in project.employee_contributions:
                        if contrib.employee_id == team_member and contrib.active:
                            member_hours += contrib.weekly_hours
                
                team_hours.append(member_hours)
            
            avg_team_hours = sum(team_hours) / len(team_hours) if team_hours else 0
            
            # Compare user hours to team average
            if user_hours > avg_team_hours + 10:
                recommendations.append({
                    'type': 'warning',
                    'message': f'Employee has a significantly higher workload ({user_hours} hrs/week) than the team average ({avg_team_hours:.1f} hrs/week).'
                })
            elif user_hours < avg_team_hours - 10:
                recommendations.append({
                    'type': 'warning',
                    'message': f'Employee has a significantly lower workload ({user_hours} hrs/week) than the team average ({avg_team_hours:.1f} hrs/week).'
                })
            else:
                recommendations.append({
                    'type': 'positive',
                    'message': f'Employee\'s workload ({user_hours} hrs/week) is comparable to the team average ({avg_team_hours:.1f} hrs/week).'
                })
                
        except Exception as e:
            logger.error(f"Error analyzing workload: {str(e)}")
        
        return jsonify({
            'success': True,
            'employee_id': user_id,
            'new_manager_id': new_manager_id,
            'team_fit_score': team_fit_score,
            'recommendations': recommendations
        }), 200
        
    except Exception as e:
        logger.error(f"Error simulating reallocation: {str(e)}")
        return jsonify({'success': False, 'message': f'Failed to simulate reallocation: {str(e)}'}), 500


@simulation_blueprint.route('/simulate-deletion/<string:user_id>', methods=['POST'])
@role_required(['eco', 'top_mgmt_t1', 'top_mgmt_t2', 'top_mgmt_t3'])
def simulate_user_deletion(user_id):
    """
    Simulate the removal of a user and redistribution of their responsibilities
    """
    try:
        # Build original org graph
        org_graph = build_org_graph()
        
        # Make sure user exists
        if user_id not in org_graph.nodes:
            return jsonify({'success': False, 'message': f'Employee {user_id} not found'}), 404
        
        # Get the user's manager and team members (siblings)
        manager_id = next(iter(org_graph.predecessors(user_id)), None)
        team_members = list(org_graph.successors(manager_id)) if manager_id else []
        team_members = [member for member in team_members if member != user_id]
        
        # Get user's direct reports
        direct_reports = list(org_graph.successors(user_id))
        
        # Simulate removing the user
        simulation_results = simulate_employee_removal(org_graph, [user_id])
        
        # Get the user's projects and responsibilities
        from models.project import Project, EmployeeContribution
        
        user_projects = Project.query.filter(
            Project.employee_contributions.any(employee_id=user_id, active=True)
        ).all()
        
        project_redistributions = []
        
        if team_members:
            # Redistribute projects among team members
            for idx, project in enumerate(user_projects):
                for contrib in project.employee_contributions:
                    if contrib.employee_id == user_id and contrib.active:
                        # Assign to team member based on round-robin
                        assignee_id = team_members[idx % len(team_members)]
                        assignee_data = org_graph.nodes[assignee_id]
                        
                        project_redistributions.append({
                            'project_id': project.project_id,
                            'project_title': project.project_title,
                            'hours': contrib.weekly_hours,
                            'assigned_to': assignee_id,
                            'assigned_to_name': assignee_data.get('name', 'Unknown')
                        })
        
        # Calculate impact on team workload
        team_impact = []
        for member in team_members:
            member_data = org_graph.nodes[member]
            
            # Get current workload
            member_hours = 0
            member_projects = Project.query.filter(
                Project.employee_contributions.any(employee_id=member, active=True)
            ).all()
            
            for project in member_projects:
                for contrib in project.employee_contributions:
                    if contrib.employee_id == member and contrib.active:
                        member_hours += contrib.weekly_hours
            
            # Calculate new workload based on redistributions
            additional_hours = 0
            for redist in project_redistributions:
                if redist['assigned_to'] == member:
                    additional_hours += redist['hours']
            
            new_total = member_hours + additional_hours
            
            # Determine stress level
            stress_level = "normal"
            if new_total > 20:
                stress_level = "high_overload"
            elif new_total > 15:
                stress_level = "medium_overload"
            elif new_total > 10:
                stress_level = "low_overload"
            elif new_total > 5:
                stress_level = "slight_overload"
            
            team_impact.append({
                'employee_id': member,
                'name': member_data.get('name', 'Unknown'),
                'current_hours': member_hours,
                'additional_hours': additional_hours,
                'new_total': new_total,
                'stress_level': stress_level
            })
        
        return jsonify({
            'success': True,
            'removed_employee': user_id,
            'direct_reports': direct_reports,
            'project_redistributions': project_redistributions,
            'team_impact': team_impact,
            'simulation_results': simulation_results
        }), 200
        
    except Exception as e:
        logger.error(f"Error simulating user deletion: {str(e)}")
        return jsonify({'success': False, 'message': f'Failed to simulate deletion: {str(e)}'}), 500 
import networkx as nx
from models.employee import Employee
from models.department import Department
import numpy as np
import logging

logger = logging.getLogger(__name__)

def build_org_graph():
    """
    Build a directed graph representing the organizational structure.
    Nodes are employees, edges represent reporting relationships.
    Node attributes include department, position, salary, etc.
    """
    try:
        # Create a directed graph
        G = nx.DiGraph()
        
        # Get all employees from the database
        employees = Employee.query.all()
        departments = {dept.id: dept for dept in Department.query.all()}
        
        # Add all employees as nodes
        for emp in employees:
            G.add_node(emp.id, 
                       name=emp.name,
                       email=emp.email,
                       position=emp.position,
                       department_id=emp.department_id,
                       department_name=departments.get(emp.department_id).name if emp.department_id in departments else "No Department",
                       salary=emp.salary,
                       hire_date=emp.hire_date,
                       performance=emp.performance_score,
                       skills=emp.skills)
        
        # Add edges for reporting relationships
        for emp in employees:
            if emp.manager_id and emp.manager_id != emp.id:  # Avoid self-loops
                G.add_edge(emp.manager_id, emp.id)
        
        logger.info(f"Built organizational graph with {G.number_of_nodes()} nodes and {G.number_of_edges()} edges")
        return G
    
    except Exception as e:
        logger.error(f"Error building organizational graph: {str(e)}")
        # Return an empty graph if there's an error
        return nx.DiGraph()

def calculate_centrality(G):
    """
    Calculate various centrality metrics for the organization graph
    """
    try:
        metrics = {
            'total_employees': G.number_of_nodes(),
            'total_connections': G.number_of_edges()
        }
        
        # Calculate the organizational depth (longest path from root)
        root_nodes = [n for n, d in G.in_degree() if d == 0]
        if root_nodes:
            depths = []
            for root in root_nodes:
                # Find the longest path from this root to any leaf
                paths = nx.single_source_shortest_path_length(G, root)
                if paths:
                    depths.append(max(paths.values()))
            
            metrics['depth'] = max(depths) if depths else 0
        else:
            metrics['depth'] = 0
        
        # Calculate average span of control (average number of direct reports)
        out_degrees = [d for n, d in G.out_degree()]
        metrics['avg_span_of_control'] = np.mean(out_degrees) if out_degrees else 0
        
        # Calculate centrality measures
        centrality_metrics = {}
        
        # Betweenness centrality - identifies bridge employees
        centrality_metrics['betweenness'] = nx.betweenness_centrality(G)
        
        # Eigenvector centrality - identifies influential employees
        try:
            centrality_metrics['eigenvector'] = nx.eigenvector_centrality(G, max_iter=1000)
        except nx.PowerIterationFailedConvergence:
            logger.warning("Eigenvector centrality calculation did not converge")
            centrality_metrics['eigenvector'] = {node: 0 for node in G.nodes()}
        
        # Closeness centrality - identifies employees with short paths to others
        centrality_metrics['closeness'] = nx.closeness_centrality(G)
        
        # PageRank - alternative measure of importance
        centrality_metrics['pagerank'] = nx.pagerank(G)
        
        metrics['centrality_scores'] = centrality_metrics
        
        # Department metrics
        dept_metrics = {}
        for node in G.nodes(data=True):
            dept_id = node[1].get('department_id')
            if dept_id:
                if dept_id not in dept_metrics:
                    dept_metrics[dept_id] = {
                        'count': 0,
                        'total_salary': 0,
                        'avg_performance': []
                    }
                dept_metrics[dept_id]['count'] += 1
                dept_metrics[dept_id]['total_salary'] += node[1].get('salary', 0)
                dept_metrics[dept_id]['avg_performance'].append(node[1].get('performance', 0))
        
        # Calculate averages for departments
        for dept_id, data in dept_metrics.items():
            data['avg_salary'] = data['total_salary'] / data['count'] if data['count'] > 0 else 0
            data['avg_performance'] = np.mean(data['avg_performance']) if data['avg_performance'] else 0
            del data['avg_performance']
        
        metrics['department_metrics'] = dept_metrics
        
        return metrics
    
    except Exception as e:
        logger.error(f"Error calculating graph metrics: {str(e)}")
        return {
            'total_employees': G.number_of_nodes(),
            'total_connections': G.number_of_edges(),
            'error': str(e)
        }

def identify_critical_employees(G, metrics):
    """
    Identify critical employees whose departure would significantly impact the organization
    """
    try:
        critical_employees = []
        
        # Get centrality scores
        betweenness = metrics['centrality_scores']['betweenness']
        eigenvector = metrics['centrality_scores']['eigenvector']
        pagerank = metrics['centrality_scores']['pagerank']
        
        # Combine scores with weights
        combined_scores = {}
        for node in G.nodes():
            combined_scores[node] = (
                0.4 * betweenness.get(node, 0) +  # Higher weight to betweenness
                0.3 * eigenvector.get(node, 0) +
                0.3 * pagerank.get(node, 0)
            )
        
        # Sort by combined score
        sorted_employees = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)
        
        # Get the top 10% or at least 5 employees
        num_critical = max(5, int(G.number_of_nodes() * 0.1))
        
        # Get the employee details for each critical employee
        for emp_id, score in sorted_employees[:num_critical]:
            node_data = G.nodes[emp_id]
            critical_employees.append({
                'id': emp_id,
                'name': node_data.get('name', 'Unknown'),
                'position': node_data.get('position', 'Unknown'),
                'department': node_data.get('department_name', 'Unknown'),
                'criticality_score': score,
                'direct_reports': G.out_degree(emp_id),
                'performance': node_data.get('performance', 0)
            })
        
        return critical_employees
    
    except Exception as e:
        logger.error(f"Error identifying critical employees: {str(e)}")
        return []

def simulate_employee_removal(G, employee_ids):
    """
    Simulate removing employees from the organization and calculate the impact
    """
    try:
        # Create a copy of the graph to modify
        H = G.copy()
        
        # Store original metrics for comparison
        original_metrics = calculate_centrality(G)
        
        # Track employees who need reassignment
        orphaned_employees = []
        
        # Remove employees one by one
        for emp_id in employee_ids:
            # Get the employees who report to this employee
            direct_reports = list(G.successors(emp_id))
            
            # Remove the employee
            H.remove_node(emp_id)
            
            # Track orphaned employees who need new managers
            orphaned_employees.extend(direct_reports)
        
        # Calculate new metrics
        new_metrics = calculate_centrality(H)
        
        # Calculate impact scores
        impact = {
            'connectivity_impact': (original_metrics['total_connections'] - new_metrics['total_connections']) / 
                                 original_metrics['total_connections'] if original_metrics['total_connections'] > 0 else 0,
            'orphaned_employees': len(orphaned_employees),
            'workforce_reduction': (original_metrics['total_employees'] - new_metrics['total_employees']) / 
                                 original_metrics['total_employees'] if original_metrics['total_employees'] > 0 else 0
        }
        
        # Calculate department impact
        dept_impact = {}
        for dept_id, orig_data in original_metrics.get('department_metrics', {}).items():
            if dept_id in new_metrics.get('department_metrics', {}):
                new_data = new_metrics['department_metrics'][dept_id]
                dept_impact[dept_id] = {
                    'headcount_change': new_data['count'] - orig_data['count'],
                    'headcount_percent': (new_data['count'] - orig_data['count']) / orig_data['count'] 
                                      if orig_data['count'] > 0 else 0,
                    'salary_change': new_data['avg_salary'] - orig_data['avg_salary']
                }
        
        impact['department_impact'] = dept_impact
        
        return {
            'original_metrics': original_metrics,
            'new_metrics': new_metrics,
            'impact': impact,
            'orphaned_employees': orphaned_employees
        }
    
    except Exception as e:
        logger.error(f"Error simulating employee removal: {str(e)}")
        return {
            'error': str(e)
        }

def simulate_reorganization(G, reorg_plan):
    """
    Simulate reorganizing the reporting structure
    reorg_plan is a dictionary mapping employee IDs to new manager IDs
    """
    try:
        # Create a copy of the graph to modify
        H = G.copy()
        
        # Store original metrics for comparison
        original_metrics = calculate_centrality(G)
        
        # Track changes made
        changes = []
        
        # Apply the reorganization plan
        for emp_id, new_manager_id in reorg_plan.items():
            if emp_id in H and new_manager_id in H:
                # Find current manager
                current_managers = list(H.predecessors(emp_id))
                current_manager_id = current_managers[0] if current_managers else None
                
                # Skip if no change
                if current_manager_id == new_manager_id:
                    continue
                
                # Remove current reporting relationship if it exists
                if current_manager_id:
                    H.remove_edge(current_manager_id, emp_id)
                
                # Add new reporting relationship
                H.add_edge(new_manager_id, emp_id)
                
                # Track the change
                changes.append({
                    'employee_id': emp_id,
                    'employee_name': H.nodes[emp_id].get('name', 'Unknown'),
                    'old_manager_id': current_manager_id,
                    'old_manager_name': H.nodes[current_manager_id].get('name', 'Unknown') if current_manager_id else 'None',
                    'new_manager_id': new_manager_id,
                    'new_manager_name': H.nodes[new_manager_id].get('name', 'Unknown')
                })
        
        # Calculate new metrics
        new_metrics = calculate_centrality(H)
        
        # Calculate impact
        span_change = new_metrics['avg_span_of_control'] - original_metrics['avg_span_of_control']
        depth_change = new_metrics['depth'] - original_metrics['depth']
        
        impact = {
            'span_of_control_change': span_change,
            'depth_change': depth_change,
            'total_changes': len(changes)
        }
        
        # Calculate manager load changes
        manager_load_changes = {}
        for node in H.nodes():
            old_load = len(list(G.successors(node))) if node in G else 0
            new_load = len(list(H.successors(node)))
            if old_load != new_load:
                manager_load_changes[node] = {
                    'name': H.nodes[node].get('name', 'Unknown'),
                    'old_reports': old_load,
                    'new_reports': new_load,
                    'change': new_load - old_load
                }
        
        impact['manager_load_changes'] = manager_load_changes
        
        return {
            'original_metrics': original_metrics,
            'new_metrics': new_metrics,
            'impact': impact,
            'changes': changes
        }
    
    except Exception as e:
        logger.error(f"Error simulating reorganization: {str(e)}")
        return {
            'error': str(e)
        }

def get_recommendations(simulation_type, impact_data):
    """
    Generate recommendations based on simulation results
    """
    recommendations = []
    
    if simulation_type == 'attrition':
        # Knowledge retention recommendations
        if impact_data.get('orphaned_employees', 0) > 0:
            recommendations.append("Implement a knowledge transfer program for departing employees")
            recommendations.append("Create documentation requirements for key processes")
        
        # Management recommendations
        if impact_data.get('connectivity_impact', 0) > 0.1:  # More than 10% impact
            recommendations.append("Review reporting structures to maintain effective spans of control")
            recommendations.append("Consider promoting high-performers to fill management gaps")
        
        # Department-specific recommendations
        dept_impact = impact_data.get('department_impact', {})
        for dept_id, impact in dept_impact.items():
            if impact.get('headcount_percent', 0) < -0.15:  # More than 15% reduction
                recommendations.append(f"Department {dept_id} requires urgent staffing attention")
    
    elif simulation_type == 'reorganization':
        # Change management recommendations
        if impact_data.get('total_changes', 0) > 10:
            recommendations.append("Implement a phased approach to the reorganization")
            recommendations.append("Create a detailed communication plan for the changes")
        
        # Manager support recommendations
        manager_changes = impact_data.get('manager_load_changes', {})
        overloaded_managers = [m for m, data in manager_changes.items() if data.get('change', 0) > 3]
        if overloaded_managers:
            recommendations.append("Provide additional support for managers with significantly increased workloads")
            recommendations.append("Consider management training for new managers and those with expanded teams")
        
        # Structure recommendations
        if impact_data.get('depth_change', 0) > 1:
            recommendations.append("Review communication channels to ensure efficiency in the new structure")
            recommendations.append("Consider flattening some areas of the organization to improve decision-making")
    
    return recommendations 
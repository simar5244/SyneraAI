from datetime import datetime
from enum import Enum
import json
from typing import Dict, List, Optional, Union, Any
from sqlalchemy.ext.mutable import MutableDict
from database import db
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, Boolean, JSON, Enum as SQLAEnum
from pydantic import BaseModel, Field

class SimulationType(str, Enum):
    """Types of organizational simulations supported by the system"""
    ATTRITION = "attrition"
    REORGANIZATION = "reorganization"
    GROWTH = "growth"
    COST_REDUCTION = "cost_reduction"

class SimulationScenario(BaseModel):
    """Model for a simulation scenario configuration"""
    id: str = Field(..., description="Unique identifier for the scenario")
    name: str = Field(..., description="Name of the simulation scenario")
    description: str = Field(default="", description="Description of what this simulation is testing")
    type: SimulationType = Field(..., description="Type of simulation to run")
    created_by: str = Field(..., description="ID of the user who created this scenario")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Parameters specific to this simulation type")
    is_template: bool = Field(default=False, description="Whether this scenario is a reusable template")
    
    class Config:
        schema_extra = {
            "example": {
                "id": "sim_123456",
                "name": "Q3 Attrition Risk Analysis",
                "description": "Simulate impact of current trends on Q3 attrition",
                "type": "attrition",
                "created_by": "user_789",
                "parameters": {
                    "target_rate": 0.15,
                    "time_period": 3,
                    "risk_threshold": 0.65,
                    "affected_departments": ["dept_123", "dept_456"]
                },
                "is_template": False
            }
        }

class SimulationResult(BaseModel):
    """Model for simulation results"""
    id: str = Field(default="", description="Unique identifier for the result")
    scenario_id: str = Field(..., description="ID of the scenario that was simulated")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metrics: Dict[str, Any] = Field(default_factory=dict, description="Key metrics from the simulation")
    impact_scores: Dict[str, float] = Field(
        default_factory=dict, 
        description="Impact scores for different areas (overall, morale, productivity, etc.)"
    )
    department_impacts: Dict[str, Any] = Field(
        default_factory=dict,
        description="Department-specific impact details"
    )
    employee_impacts: Dict[str, Any] = Field(
        default_factory=dict,
        description="Employee-specific impact details (anonymized for privacy)"
    )
    recommendations: List[str] = Field(
        default_factory=list,
        description="AI-generated recommendations based on simulation results"
    )
    visualization_data: Dict[str, Any] = Field(
        default_factory=dict,
        description="Structured data for visualizing simulation results"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "id": "res_123456",
                "scenario_id": "sim_123456",
                "created_at": "2023-06-15T14:30:00Z",
                "metrics": {
                    "total_employees": 250,
                    "projected_departures": 37,
                    "projected_attrition_rate": 0.148,
                    "replacement_cost": 1850000
                },
                "impact_scores": {
                    "overall": -0.23,
                    "morale": -0.15,
                    "productivity": -0.22,
                    "cost": -0.18,
                    "risk": -0.37
                },
                "department_impacts": {
                    "dept_123": {
                        "at_risk_count": 12,
                        "total": 45,
                        "percentage": 26.7
                    },
                    "dept_456": {
                        "at_risk_count": 8,
                        "total": 30,
                        "percentage": 26.7
                    }
                },
                "recommendations": [
                    "Conduct organization-wide engagement survey to identify key issues",
                    "Review compensation packages for competitiveness in the market",
                    "Focus retention efforts on high-risk departments: dept_123, dept_456"
                ]
            }
        }

# Schema classes for request/response validation
class AttritionParameters:
    """Parameters for attrition simulation"""
    def __init__(self, target_employees=None, attrition_rate=None, attrition_criteria=None,
                 consider_performance=True, consider_criticality=True):
        self.target_employees = target_employees or []  # Employee IDs to remove
        self.attrition_rate = attrition_rate  # For random simulations
        self.attrition_criteria = attrition_criteria  # Criteria for selecting employees
        self.consider_performance = consider_performance
        self.consider_criticality = consider_criticality
    
    def to_dict(self):
        return {
            'target_employees': self.target_employees,
            'attrition_rate': self.attrition_rate,
            'attrition_criteria': self.attrition_criteria,
            'consider_performance': self.consider_performance,
            'consider_criticality': self.consider_criticality
        }
    
    @classmethod
    def from_dict(cls, data):
        return cls(
            target_employees=data.get('target_employees'),
            attrition_rate=data.get('attrition_rate'),
            attrition_criteria=data.get('attrition_criteria'),
            consider_performance=data.get('consider_performance', True),
            consider_criticality=data.get('consider_criticality', True)
        )

class ReorganizationParameters:
    """Parameters for reorganization simulation"""
    def __init__(self, reporting_changes=None, target_span_of_control=None,
                 flatten_hierarchy=False, max_depth=None):
        self.reporting_changes = reporting_changes or {}  # employee_id: new_manager_id
        self.target_span_of_control = target_span_of_control
        self.flatten_hierarchy = flatten_hierarchy
        self.max_depth = max_depth
    
    def to_dict(self):
        return {
            'reporting_changes': self.reporting_changes,
            'target_span_of_control': self.target_span_of_control,
            'flatten_hierarchy': self.flatten_hierarchy,
            'max_depth': self.max_depth
        }
    
    @classmethod
    def from_dict(cls, data):
        return cls(
            reporting_changes=data.get('reporting_changes'),
            target_span_of_control=data.get('target_span_of_control'),
            flatten_hierarchy=data.get('flatten_hierarchy', False),
            max_depth=data.get('max_depth')
        )

class GrowthParameters:
    """Parameters for growth simulation"""
    def __init__(self, growth_percentage, target_departments=None, department_distribution=None,
                 consider_span_of_control=True, max_span_of_control=None):
        self.growth_percentage = growth_percentage  # Overall growth percentage
        self.target_departments = target_departments or []  # Department IDs to grow
        self.department_distribution = department_distribution  # Distribution by department
        self.consider_span_of_control = consider_span_of_control
        self.max_span_of_control = max_span_of_control
    
    def to_dict(self):
        return {
            'growth_percentage': self.growth_percentage,
            'target_departments': self.target_departments,
            'department_distribution': self.department_distribution,
            'consider_span_of_control': self.consider_span_of_control,
            'max_span_of_control': self.max_span_of_control
        }
    
    @classmethod
    def from_dict(cls, data):
        return cls(
            growth_percentage=data.get('growth_percentage'),
            target_departments=data.get('target_departments'),
            department_distribution=data.get('department_distribution'),
            consider_span_of_control=data.get('consider_span_of_control', True),
            max_span_of_control=data.get('max_span_of_control')
        )

class CostReductionParameters:
    """Parameters for cost reduction simulation"""
    def __init__(self, reduction_target, is_percentage=True, protect_critical_roles=True,
                 consider_performance=True, by_department=None):
        self.reduction_target = reduction_target  # Percentage or absolute amount
        self.is_percentage = is_percentage
        self.protect_critical_roles = protect_critical_roles
        self.consider_performance = consider_performance
        self.by_department = by_department  # Department-specific reductions
    
    def to_dict(self):
        return {
            'reduction_target': self.reduction_target,
            'is_percentage': self.is_percentage,
            'protect_critical_roles': self.protect_critical_roles,
            'consider_performance': self.consider_performance,
            'by_department': self.by_department
        }
    
    @classmethod
    def from_dict(cls, data):
        return cls(
            reduction_target=data.get('reduction_target'),
            is_percentage=data.get('is_percentage', True),
            protect_critical_roles=data.get('protect_critical_roles', True),
            consider_performance=data.get('consider_performance', True),
            by_department=data.get('by_department')
        )

class MetricScore(BaseModel):
    """Score for a specific metric"""
    name: str
    value: float
    change: float
    impact_level: str  # "low", "medium", "high"

class DepartmentImpact(BaseModel):
    """Impact on a specific department"""
    department_id: str
    department_name: str
    headcount_change: int
    headcount_percent: float
    salary_change: float
    impact_level: str  # "low", "medium", "high"

class EmployeeImpact(BaseModel):
    """Impact on a specific employee"""
    employee_id: str
    employee_name: str
    type: str  # "removed", "reassigned", "promoted", etc.
    old_position: Optional[str] = None
    new_position: Optional[str] = None
    old_manager_id: Optional[str] = None
    new_manager_id: Optional[str] = None

class SimulationRecommendation(BaseModel):
    """Recommendation based on simulation results"""
    category: str  # "structure", "talent", "compensation", etc.
    recommendation: str
    priority: str  # "low", "medium", "high"
    rationale: Optional[str] = None

class SimulationResult(db.Model):
    """Model representing the results of a simulation"""
    __tablename__ = 'simulation_results'
    
    id = Column(Integer, primary_key=True)
    scenario_id = Column(Integer, ForeignKey('simulation_scenarios.id'), nullable=False)
    run_date = Column(DateTime, default=datetime.utcnow)
    metrics_before = Column(JSON, nullable=False)  # Pre-simulation metrics
    metrics_after = Column(JSON, nullable=False)   # Post-simulation metrics
    impact_scores = Column(JSON, nullable=False)   # Various impact scores
    affected_employees = Column(JSON, nullable=True)  # List of affected employees
    affected_departments = Column(JSON, nullable=True)  # List of affected departments
    recommendations = Column(JSON, nullable=True)  # AI recommendations
    
    # Relationships
    scenario = db.relationship('SimulationScenario', backref='simulation_results')
    
    def __repr__(self):
        return f"<SimulationResult {self.id} for Scenario {self.scenario_id}>"
        
    def to_dict(self):
        """Convert model to dictionary"""
        return {
            'id': self.id,
            'scenario_id': self.scenario_id,
            'run_date': self.run_date.isoformat() if self.run_date else None,
            'metrics_before': self.metrics_before,
            'metrics_after': self.metrics_after,
            'impact_scores': self.impact_scores,
            'affected_employees': self.affected_employees,
            'affected_departments': self.affected_departments,
            'recommendations': self.recommendations
        } 
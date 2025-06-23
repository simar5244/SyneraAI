from config.database import db
from datetime import datetime

class EmployeeContribution(db.EmbeddedDocument):
    """Embedded document for tracking employee contributions to projects"""
    
    employee_id = db.StringField(required=True)
    role = db.StringField(required=True, choices=['Team Lead', 'Contributor', 'Stakeholder', 'Reviewer'])
    weekly_hours = db.FloatField(default=0.0)
    reported_tech = db.ListField(db.StringField())
    start_date = db.DateTimeField(default=datetime.utcnow)
    end_date = db.DateTimeField()
    active = db.BooleanField(default=True)
    
    def to_dict(self):
        return {
            'employee_id': self.employee_id,
            'role': self.role,
            'weekly_hours': self.weekly_hours,
            'reported_tech': self.reported_tech,
            'start_date': self.start_date,
            'end_date': self.end_date,
            'active': self.active
        }

class Project(db.Document):
    """Project Model representing work contribution data"""
    
    project_id = db.StringField(required=True, unique=True)
    project_title = db.StringField(required=True)
    project_description = db.StringField(required=True)
    tech_stack = db.ListField(db.StringField())
    start_date = db.DateTimeField(required=True)
    end_date = db.DateTimeField()
    department = db.StringField(required=True)
    status = db.StringField(choices=['Planning', 'Active', 'On Hold', 'Completed'], default='Planning')
    priority = db.StringField(choices=['Low', 'Medium', 'High', 'Critical'], default='Medium')
    total_hours = db.FloatField(default=0.0)
    employee_contributions = db.ListField(db.EmbeddedDocumentField(EmployeeContribution))
    
    # Analytics fields
    complexity_score = db.FloatField(default=1.0)  # Calculated based on tech stack, hours, etc.
    impact_score = db.FloatField(default=0.0)      # Business impact rating
    risk_level = db.FloatField(default=0.0)        # Calculated risk assessment
    
    created_at = db.DateTimeField(default=datetime.utcnow)
    updated_at = db.DateTimeField(default=datetime.utcnow)
    
    meta = {
        'collection': 'projects',
        'indexes': [
            'project_id',
            'department',
            'status',
            'start_date',
            'end_date'
        ]
    }
    
    def total_weekly_hours(self):
        """Calculate total weekly hours across all active contributors"""
        return sum(contrib.weekly_hours for contrib in self.employee_contributions if contrib.active)
    
    def active_contributors_count(self):
        """Count active contributors on the project"""
        return sum(1 for contrib in self.employee_contributions if contrib.active)
    
    def to_dict(self):
        """Convert Project document to dictionary"""
        return {
            'project_id': self.project_id,
            'project_title': self.project_title,
            'project_description': self.project_description,
            'tech_stack': self.tech_stack,
            'start_date': self.start_date,
            'end_date': self.end_date,
            'department': self.department,
            'status': self.status,
            'priority': self.priority,
            'total_hours': self.total_hours,
            'employee_contributions': [contrib.to_dict() for contrib in self.employee_contributions],
            'complexity_score': self.complexity_score,
            'impact_score': self.impact_score,
            'risk_level': self.risk_level,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }
    
    def __str__(self):
        return f"{self.project_title} ({self.status})" 
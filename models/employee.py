from config.database import db
from datetime import datetime

class Employee(db.Document):
    """Employee Model representing organizational graph data from ERP systems"""
    
    employee_id = db.StringField(required=True, unique=True)
    name = db.StringField(required=True)
    work_email = db.EmailField(required=True, unique=True)
    job_title = db.StringField(required=True)
    department = db.StringField(required=True)
    manager_id = db.StringField()  # References another employee_id
    tenure = db.IntField(default=0)  # In months
    skills = db.ListField(db.StringField())
    seniority_level = db.StringField(choices=['Junior', 'Mid', 'Senior', 'Lead'])
    org_level = db.StringField(choices=['IC', 'Manager', 'Executive'])
    hire_date = db.DateTimeField()
    last_promotion_date = db.DateTimeField()
    active = db.BooleanField(default=True)
    created_at = db.DateTimeField(default=datetime.utcnow)
    updated_at = db.DateTimeField(default=datetime.utcnow)
    
    # Additional fields for analytics
    value_tokens = db.IntField(default=0)  # For internal economy tracking
    influence_score = db.FloatField(default=0.0)  # Calculated from centrality metrics
    attrition_risk = db.FloatField(default=0.0)  # Predicted risk of leaving
    
    meta = {
        'collection': 'employees',
        'indexes': [
            'employee_id', 
            'work_email',
            'department',
            'manager_id'
        ]
    }
    
    def to_dict(self):
        """Convert Employee document to dictionary"""
        return {
            'employee_id': self.employee_id,
            'name': self.name,
            'work_email': self.work_email,
            'job_title': self.job_title,
            'department': self.department,
            'manager_id': self.manager_id,
            'tenure': self.tenure,
            'skills': self.skills,
            'seniority_level': self.seniority_level,
            'org_level': self.org_level,
            'hire_date': self.hire_date,
            'active': self.active,
            'value_tokens': self.value_tokens,
            'influence_score': self.influence_score,
            'attrition_risk': self.attrition_risk
        }
        
    def __str__(self):
        return f"{self.name} ({self.job_title}, {self.department})" 
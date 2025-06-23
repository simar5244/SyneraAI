import logging
import re
from typing import List, Dict, Any, Optional
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from models.employee import Employee
from models.project import Project

# Initialize NLTK resources
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')
    
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')
    
try:
    nltk.data.find('corpora/wordnet')
except LookupError:
    nltk.download('wordnet')

def process_natural_language_query(query: str) -> Dict[str, Any]:
    """
    Process a natural language query into structured search parameters
    
    Args:
        query: The natural language query string
    
    Returns:
        Dictionary of search parameters extracted from the query
    """
    # Initialize search terms
    search_terms = {
        'keywords': [],
        'departments': [],
        'skills': [],
        'tech': [],
        'roles': [],
        'seniority_levels': ['Junior', 'Mid', 'Senior', 'Lead'],
        'time_filters': {},
        'relation_filters': {}
    }
    
    # Clean and tokenize the query
    query = query.lower()
    tokens = word_tokenize(query)
    
    # Remove stopwords
    stop_words = set(stopwords.words('english'))
    filtered_tokens = [word for word in tokens if word not in stop_words and word.isalnum()]
    
    # Lemmatize words
    lemmatizer = WordNetLemmatizer()
    lemmatized_tokens = [lemmatizer.lemmatize(word) for word in filtered_tokens]
    
    # Extract department references
    dept_patterns = ['department', 'dept', 'team', 'group', 'division']
    for i, token in enumerate(lemmatized_tokens):
        if token in dept_patterns and i > 0:
            search_terms['departments'].append(lemmatized_tokens[i-1])
    
    # Extract time references
    time_patterns = {
        'year': r'(\d+)\s*years?',
        'month': r'(\d+)\s*months?',
        'week': r'(\d+)\s*weeks?'
    }
    
    for time_unit, pattern in time_patterns.items():
        matches = re.findall(pattern, query)
        if matches:
            search_terms['time_filters'][time_unit] = int(matches[0])
    
    # Extract seniority levels
    seniority_patterns = ['junior', 'mid', 'senior', 'lead']
    for token in lemmatized_tokens:
        if token in seniority_patterns:
            search_terms['seniority_levels'] = [token.capitalize()]
    
    # Extract skills and tech stack
    tech_keywords = ['react', 'angular', 'vue', 'javascript', 'python', 'java', 'c++', 'php', 
                    'node', 'aws', 'azure', 'gcp', 'cloud', 'docker', 'kubernetes', 'ml', 
                    'ai', 'data science', 'analytics', 'frontend', 'backend', 'fullstack', 
                    'mobile', 'ios', 'android', 'devops', 'security']
    
    for token in lemmatized_tokens:
        if token in tech_keywords:
            search_terms['tech'].append(token)
            search_terms['skills'].append(token)
    
    # Extract role references
    role_patterns = ['manager', 'director', 'lead', 'engineer', 'developer', 'analyst', 
                    'designer', 'product', 'project', 'coordinator', 'specialist']
    
    for token in lemmatized_tokens:
        if token in role_patterns:
            search_terms['roles'].append(token)
    
    # Add remaining tokens as general keywords
    for token in lemmatized_tokens:
        if (token not in search_terms['departments'] and 
            token not in search_terms['tech'] and 
            token not in search_terms['roles'] and
            token not in seniority_patterns and
            token not in dept_patterns and
            token not in role_patterns):
            search_terms['keywords'].append(token)
    
    # Special handling for report relationships
    if 'reports to' in query or 'reporting to' in query:
        search_terms['relation_filters']['reports_to'] = True
    
    if 'manages' in query or 'managing' in query:
        search_terms['relation_filters']['manages'] = True
    
    return search_terms

def search_employees(
    search_terms: Optional[Dict[str, Any]] = None,
    department: Optional[str] = None,
    skills: Optional[List[str]] = None,
    job_title: Optional[str] = None,
    manager_id: Optional[str] = None,
    seniority_level: Optional[str] = None,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Search employees based on various criteria
    
    Args:
        search_terms: Dictionary of parsed search terms from natural language query
        department: Filter by department
        skills: Filter by skills (list)
        job_title: Filter by job title
        manager_id: Filter by manager
        seniority_level: Filter by seniority level
        limit: Maximum number of results
        
    Returns:
        List of matching employees
    """
    # Build MongoDB query
    query = {'active': True}
    
    # Add direct filters if provided
    if department:
        query['department'] = department
    
    if job_title:
        query['job_title'] = {'$regex': job_title, '$options': 'i'}  # Case-insensitive match
    
    if manager_id:
        query['manager_id'] = manager_id
        
    if seniority_level:
        query['seniority_level'] = seniority_level
    
    # Process search terms if provided
    if search_terms:
        # Department filter from search terms
        if search_terms.get('departments') and not department:
            dept_terms = '|'.join(search_terms['departments'])
            query['department'] = {'$regex': dept_terms, '$options': 'i'}
        
        # Role/job title filter from search terms
        if search_terms.get('roles') and not job_title:
            role_terms = '|'.join(search_terms['roles'])
            query['job_title'] = {'$regex': role_terms, '$options': 'i'}
            
        # Seniority level filter from search terms
        if search_terms.get('seniority_levels') and len(search_terms['seniority_levels']) < 4:
            query['seniority_level'] = {'$in': search_terms['seniority_levels']}
    
    # Find matching employees
    employees = Employee.objects(**query)
    
    # For skills filtering, we need post-processing since skills is a list field
    result = []
    for employee in employees:
        # Skip if no match on skills
        if skills:
            employee_skills = set(s.lower() for s in employee.skills)
            search_skills = set(s.lower() for s in skills)
            
            # Only include if employee has at least one of the requested skills
            if not employee_skills.intersection(search_skills):
                continue
                
        # Check search term skills if provided
        if search_terms and search_terms.get('skills'):
            employee_skills = set(s.lower() for s in employee.skills)
            search_term_skills = set(s.lower() for s in search_terms['skills'])
            
            # Only include if employee has at least one of the requested skills
            if not employee_skills.intersection(search_term_skills):
                continue
        
        # If we have keyword search, check name and job title
        if search_terms and search_terms.get('keywords'):
            # Check if any keyword matches name or job title
            name_job = (employee.name + ' ' + employee.job_title).lower()
            if not any(keyword in name_job for keyword in search_terms['keywords']):
                continue
        
        # Add to results
        result.append(employee.to_dict())
        
    # Limit results
    return result[:limit]

def search_projects(
    search_terms: Optional[Dict[str, Any]] = None,
    tech_stack: Optional[List[str]] = None,
    department: Optional[str] = None,
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Search projects based on various criteria
    
    Args:
        search_terms: Dictionary of parsed search terms from natural language query
        tech_stack: Filter by tech stack (list)
        department: Filter by department
        status: Filter by project status
        employee_id: Filter by employee contributing to project
        limit: Maximum number of results
        
    Returns:
        List of matching projects
    """
    # Build MongoDB query
    query = {}
    
    # Add direct filters if provided
    if department:
        query['department'] = department
        
    if status:
        query['status'] = status
    
    # Process search terms if provided
    if search_terms:
        # Department filter from search terms
        if search_terms.get('departments') and not department:
            dept_terms = '|'.join(search_terms['departments'])
            query['department'] = {'$regex': dept_terms, '$options': 'i'}
            
        # Status from keywords
        if search_terms.get('keywords'):
            status_keywords = {
                'active': 'Active',
                'completed': 'Completed',
                'planning': 'Planning',
                'hold': 'On Hold'
            }
            
            for keyword in search_terms['keywords']:
                if keyword in status_keywords and 'status' not in query:
                    query['status'] = status_keywords[keyword]
    
    # Handle employee contribution filter
    if employee_id:
        query['employee_contributions.employee_id'] = employee_id
    
    # Find matching projects
    projects = Project.objects(**query)
    
    # For tech stack filtering, we need post-processing since tech_stack is a list field
    result = []
    for project in projects:
        # Skip if no match on tech stack
        if tech_stack:
            project_tech = set(t.lower() for t in project.tech_stack)
            search_tech = set(t.lower() for t in tech_stack)
            
            # Only include if project has at least one of the requested technologies
            if not project_tech.intersection(search_tech):
                continue
                
        # Check search term tech if provided
        if search_terms and search_terms.get('tech'):
            project_tech = set(t.lower() for t in project.tech_stack)
            search_term_tech = set(t.lower() for t in search_terms['tech'])
            
            # Only include if project has at least one of the requested technologies
            if not project_tech.intersection(search_term_tech):
                continue
        
        # If we have keyword search, check title and description
        if search_terms and search_terms.get('keywords'):
            # Check if any keyword matches title or description
            title_desc = (project.project_title + ' ' + project.project_description).lower()
            if not any(keyword in title_desc for keyword in search_terms['keywords']):
                continue
        
        # Add to results
        result.append(project.to_dict())
        
    # Limit results
    return result[:limit] 
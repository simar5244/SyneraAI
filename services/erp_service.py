import logging
import requests
import json
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import ldap
import cx_Oracle
from config import get_config

class ERPConnector(ABC):
    """Abstract base class for ERP system connectors"""
    
    @abstractmethod
    def test_connection(self) -> bool:
        """Test the connection to the ERP system"""
        pass
    
    @abstractmethod
    def get_employees(self) -> List[Dict[str, Any]]:
        """Retrieve employee data from the ERP system"""
        pass
    
    @abstractmethod
    def get_org_structure(self) -> Dict[str, Any]:
        """Retrieve organizational structure from the ERP system"""
        pass

class SAPHRConnector(ERPConnector):
    """SAP HR Connector Implementation"""
    
    def __init__(self, url: str, username: str, password: str):
        self.url = url
        self.username = username
        self.password = password
        self.session = None
    
    def _get_session(self):
        """Create an authenticated session with SAP"""
        if not self.session:
            self.session = requests.Session()
            # Set up authentication (basic auth or other methods depending on SAP setup)
            self.session.auth = (self.username, self.password)
            # Set headers for JSON communication
            self.session.headers.update({
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            })
        return self.session
    
    def test_connection(self) -> bool:
        """Test connection to SAP HR"""
        try:
            session = self._get_session()
            # Test endpoint - adjust based on actual SAP API
            response = session.get(f"{self.url}/api/test")
            return response.status_code == 200
        except Exception as e:
            logging.error(f"SAP HR connection test failed: {str(e)}")
            return False
    
    def get_employees(self) -> List[Dict[str, Any]]:
        """Retrieve employee data from SAP HR"""
        try:
            session = self._get_session()
            # Example endpoint for employee data - adjust based on actual SAP API
            response = session.get(f"{self.url}/api/employees")
            
            if response.status_code == 200:
                employees_data = response.json()
                
                # Transform to standard format
                standardized_employees = []
                for emp in employees_data.get('employees', []):
                    standardized_employees.append({
                        'employee_id': emp.get('personnelNumber'),
                        'name': f"{emp.get('firstName')} {emp.get('lastName')}",
                        'work_email': emp.get('email'),
                        'job_title': emp.get('position'),
                        'department': emp.get('organizationalUnit'),
                        'manager_id': emp.get('managerId'),
                        'tenure': emp.get('tenureMonths', 0),
                        'skills': emp.get('skills', []),
                        'seniority_level': self._map_sap_level_to_standard(emp.get('employeeLevel')),
                        'org_level': self._map_sap_position_to_org_level(emp.get('position')),
                        'hire_date': emp.get('hireDate')
                    })
                
                return standardized_employees
            else:
                logging.error(f"Failed to retrieve employees from SAP HR: {response.status_code}")
                return []
        except Exception as e:
            logging.error(f"Error retrieving employees from SAP HR: {str(e)}")
            return []
    
    def get_org_structure(self) -> Dict[str, Any]:
        """Retrieve organizational structure from SAP HR"""
        try:
            session = self._get_session()
            # Example endpoint for org structure - adjust based on actual SAP API
            response = session.get(f"{self.url}/api/organization/structure")
            
            if response.status_code == 200:
                return response.json()
            else:
                logging.error(f"Failed to retrieve org structure from SAP HR: {response.status_code}")
                return {}
        except Exception as e:
            logging.error(f"Error retrieving org structure from SAP HR: {str(e)}")
            return {}
    
    def _map_sap_level_to_standard(self, sap_level: str) -> str:
        """Map SAP employee levels to standard seniority levels"""
        mapping = {
            'E1': 'Junior',
            'E2': 'Mid',
            'E3': 'Senior',
            'E4': 'Lead',
            'M1': 'Lead',
            'M2': 'Lead',
            'M3': 'Lead'
        }
        return mapping.get(sap_level, 'Mid')
    
    def _map_sap_position_to_org_level(self, position: str) -> str:
        """Map SAP position to organization level"""
        position_lower = position.lower() if position else ""
        
        if "manager" in position_lower or "director" in position_lower or "head" in position_lower:
            return "Manager"
        elif "vp" in position_lower or "vice president" in position_lower or "executive" in position_lower:
            return "Executive"
        else:
            return "IC"

class OracleConnector(ERPConnector):
    """Oracle HR Connector Implementation"""
    
    def __init__(self, connection_string: str, username: str, password: str):
        self.connection_string = connection_string
        self.username = username
        self.password = password
        self.connection = None
    
    def _get_connection(self):
        """Get an Oracle database connection"""
        if not self.connection:
            self.connection = cx_Oracle.connect(
                self.username,
                self.password,
                self.connection_string
            )
        return self.connection
    
    def test_connection(self) -> bool:
        """Test connection to Oracle HR"""
        try:
            connection = self._get_connection()
            cursor = connection.cursor()
            cursor.execute("SELECT 1 FROM DUAL")
            result = cursor.fetchone()
            cursor.close()
            return result and result[0] == 1
        except Exception as e:
            logging.error(f"Oracle HR connection test failed: {str(e)}")
            return False
    
    def get_employees(self) -> List[Dict[str, Any]]:
        """Retrieve employee data from Oracle HR"""
        try:
            connection = self._get_connection()
            cursor = connection.cursor()
            
            # Example query - adjust based on actual Oracle schema
            query = """
            SELECT e.employee_id, e.first_name, e.last_name, e.email, j.job_title,
                   d.department_name, e.manager_id, 
                   ROUND(MONTHS_BETWEEN(SYSDATE, e.hire_date), 0) as tenure,
                   e.hire_date
            FROM employees e
            JOIN jobs j ON e.job_id = j.job_id
            JOIN departments d ON e.department_id = d.department_id
            """
            
            cursor.execute(query)
            columns = [col[0].lower() for col in cursor.description]
            employees_data = []
            
            for row in cursor:
                employee = dict(zip(columns, row))
                
                # Transform to standard format
                standardized_employee = {
                    'employee_id': str(employee.get('employee_id')),
                    'name': f"{employee.get('first_name')} {employee.get('last_name')}",
                    'work_email': employee.get('email'),
                    'job_title': employee.get('job_title'),
                    'department': employee.get('department_name'),
                    'manager_id': str(employee.get('manager_id')) if employee.get('manager_id') else None,
                    'tenure': employee.get('tenure', 0),
                    'hire_date': employee.get('hire_date')
                }
                
                # Get skills and other extended info
                standardized_employee['skills'] = self._get_employee_skills(employee.get('employee_id'))
                standardized_employee['seniority_level'] = self._determine_seniority_level(employee.get('job_title'))
                standardized_employee['org_level'] = self._determine_org_level(employee.get('job_title'))
                
                employees_data.append(standardized_employee)
            
            cursor.close()
            return employees_data
        except Exception as e:
            logging.error(f"Error retrieving employees from Oracle HR: {str(e)}")
            return []
    
    def get_org_structure(self) -> Dict[str, Any]:
        """Retrieve organizational structure from Oracle HR"""
        try:
            # Build a hierarchical organization structure
            employees = self.get_employees()
            
            # Create a mapping of employees by ID
            employee_map = {emp['employee_id']: emp for emp in employees}
            
            # Track root nodes (employees with no manager)
            root_nodes = []
            
            # Add children lists to each employee
            for emp in employees:
                emp['children'] = []
            
            # Organize into hierarchy
            for emp in employees:
                manager_id = emp.get('manager_id')
                if manager_id and manager_id in employee_map:
                    # Add this employee as a child of their manager
                    employee_map[manager_id]['children'].append(emp)
                else:
                    # No manager or manager not in dataset, consider a root node
                    root_nodes.append(emp)
            
            return {
                'organization': {
                    'nodes': root_nodes
                }
            }
        except Exception as e:
            logging.error(f"Error building org structure from Oracle HR: {str(e)}")
            return {}
    
    def _get_employee_skills(self, employee_id) -> List[str]:
        """Get skills for an employee from Oracle HR"""
        try:
            connection = self._get_connection()
            cursor = connection.cursor()
            
            # Example query - adjust based on actual Oracle schema
            query = """
            SELECT s.skill_name
            FROM employee_skills es
            JOIN skills s ON es.skill_id = s.skill_id
            WHERE es.employee_id = :employee_id
            """
            
            cursor.execute(query, {'employee_id': employee_id})
            skills = [row[0] for row in cursor]
            cursor.close()
            return skills
        except Exception as e:
            logging.error(f"Error retrieving skills for employee {employee_id}: {str(e)}")
            return []
    
    def _determine_seniority_level(self, job_title: str) -> str:
        """Determine seniority level from job title"""
        job_title_lower = job_title.lower() if job_title else ""
        
        if "senior" in job_title_lower or "sr" in job_title_lower:
            return "Senior"
        elif "junior" in job_title_lower or "jr" in job_title_lower:
            return "Junior"
        elif "lead" in job_title_lower or "principal" in job_title_lower:
            return "Lead"
        else:
            return "Mid"
    
    def _determine_org_level(self, job_title: str) -> str:
        """Determine organizational level from job title"""
        job_title_lower = job_title.lower() if job_title else ""
        
        if "manager" in job_title_lower or "director" in job_title_lower:
            return "Manager"
        elif "vp" in job_title_lower or "vice president" in job_title_lower or "executive" in job_title_lower:
            return "Executive"
        else:
            return "IC"

class ActiveDirectoryConnector(ERPConnector):
    """Active Directory Connector Implementation"""
    
    def __init__(self, server: str, username: str, password: str, domain: str):
        self.server = server
        self.username = username
        self.password = password
        self.domain = domain
        self.connection = None
    
    def _get_connection(self):
        """Get an LDAP connection to Active Directory"""
        if not self.connection:
            ldap.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, ldap.OPT_X_TLS_NEVER)
            ldap.set_option(ldap.OPT_REFERRALS, 0)
            
            self.connection = ldap.initialize(f"ldap://{self.server}")
            self.connection.simple_bind_s(f"{self.domain}\\{self.username}", self.password)
        
        return self.connection
    
    def test_connection(self) -> bool:
        """Test connection to Active Directory"""
        try:
            connection = self._get_connection()
            # Simple search to test connection
            results = connection.search_s("DC=" + ",DC=".join(self.domain.split(".")), 
                                         ldap.SCOPE_SUBTREE, 
                                         "(objectClass=*)", 
                                         ["dc"], 
                                         limit=1)
            return bool(results)
        except Exception as e:
            logging.error(f"Active Directory connection test failed: {str(e)}")
            return False
    
    def get_employees(self) -> List[Dict[str, Any]]:
        """Retrieve employee data from Active Directory"""
        try:
            connection = self._get_connection()
            
            # LDAP filter for users
            ldap_filter = "(&(objectClass=user)(objectCategory=person))"
            
            # Attributes to retrieve
            attributes = [
                "sAMAccountName", "givenName", "sn", "mail", "title", 
                "department", "manager", "whenCreated", "distinguishedName"
            ]
            
            # Search base (adjust based on your AD structure)
            base_dn = "DC=" + ",DC=".join(self.domain.split("."))
            
            # Perform the search
            results = connection.search_s(base_dn, ldap.SCOPE_SUBTREE, ldap_filter, attributes)
            
            employees = []
            for dn, entry in results:
                # Skip if no email (likely not an active employee)
                if 'mail' not in entry:
                    continue
                
                # Extract manager's ID if present
                manager_id = None
                if 'manager' in entry:
                    manager_dn = entry['manager'][0].decode('utf-8')
                    # Lookup the manager's sAMAccountName
                    manager_results = connection.search_s(
                        manager_dn, ldap.SCOPE_BASE, "(objectClass=*)", ["sAMAccountName"]
                    )
                    if manager_results:
                        _, manager_entry = manager_results[0]
                        if 'sAMAccountName' in manager_entry:
                            manager_id = manager_entry['sAMAccountName'][0].decode('utf-8')
                
                # Calculate tenure in months from whenCreated
                tenure = 0
                if 'whenCreated' in entry:
                    # Parse AD date format and calculate months
                    # This is simplified; actual implementation would be more complex
                    pass
                
                employee = {
                    'employee_id': entry.get('sAMAccountName', [b''])[0].decode('utf-8'),
                    'name': f"{entry.get('givenName', [b''])[0].decode('utf-8')} {entry.get('sn', [b''])[0].decode('utf-8')}",
                    'work_email': entry.get('mail', [b''])[0].decode('utf-8'),
                    'job_title': entry.get('title', [b''])[0].decode('utf-8') if 'title' in entry else '',
                    'department': entry.get('department', [b''])[0].decode('utf-8') if 'department' in entry else '',
                    'manager_id': manager_id,
                    'tenure': tenure,
                    'skills': [],  # AD typically doesn't store skills
                    'seniority_level': self._determine_seniority_level(
                        entry.get('title', [b''])[0].decode('utf-8') if 'title' in entry else ''
                    ),
                    'org_level': self._determine_org_level(
                        entry.get('title', [b''])[0].decode('utf-8') if 'title' in entry else ''
                    )
                }
                
                employees.append(employee)
            
            return employees
        except Exception as e:
            logging.error(f"Error retrieving employees from Active Directory: {str(e)}")
            return []
    
    def get_org_structure(self) -> Dict[str, Any]:
        """Retrieve organizational structure from Active Directory"""
        try:
            # Similar approach to Oracle connector - build from employee data
            employees = self.get_employees()
            
            # Create a mapping of employees by ID
            employee_map = {emp['employee_id']: emp for emp in employees}
            
            # Track root nodes (employees with no manager)
            root_nodes = []
            
            # Add children lists to each employee
            for emp in employees:
                emp['children'] = []
            
            # Organize into hierarchy
            for emp in employees:
                manager_id = emp.get('manager_id')
                if manager_id and manager_id in employee_map:
                    # Add this employee as a child of their manager
                    employee_map[manager_id]['children'].append(emp)
                else:
                    # No manager or manager not in dataset, consider a root node
                    root_nodes.append(emp)
            
            return {
                'organization': {
                    'nodes': root_nodes
                }
            }
        except Exception as e:
            logging.error(f"Error building org structure from Active Directory: {str(e)}")
            return {}
    
    def _determine_seniority_level(self, job_title: str) -> str:
        """Determine seniority level from job title"""
        job_title_lower = job_title.lower() if job_title else ""
        
        if "senior" in job_title_lower or "sr" in job_title_lower:
            return "Senior"
        elif "junior" in job_title_lower or "jr" in job_title_lower:
            return "Junior"
        elif "lead" in job_title_lower or "principal" in job_title_lower:
            return "Lead"
        else:
            return "Mid"
    
    def _determine_org_level(self, job_title: str) -> str:
        """Determine organizational level from job title"""
        job_title_lower = job_title.lower() if job_title else ""
        
        if "manager" in job_title_lower or "director" in job_title_lower:
            return "Manager"
        elif "vp" in job_title_lower or "vice president" in job_title_lower or "executive" in job_title_lower:
            return "Executive"
        else:
            return "IC"

class ERPService:
    """Service for managing ERP connectors and retrieving data"""
    
    def __init__(self):
        self.config = get_config()
        self.connectors = {}
        self._initialize_connectors()
    
    def _initialize_connectors(self):
        """Initialize enabled ERP connectors based on configuration"""
        erp_config = self.config.ERP_INTEGRATIONS
        
        # Initialize SAP connector if enabled
        if erp_config['sap']['enabled']:
            try:
                self.connectors['sap'] = SAPHRConnector(
                    erp_config['sap']['url'],
                    erp_config['sap']['username'],
                    erp_config['sap']['password']
                )
                logging.info("SAP HR connector initialized")
            except Exception as e:
                logging.error(f"Failed to initialize SAP HR connector: {str(e)}")
        
        # Initialize Oracle connector if enabled
        if erp_config['oracle']['enabled']:
            try:
                self.connectors['oracle'] = OracleConnector(
                    erp_config['oracle']['connection_string'],
                    erp_config['oracle']['username'],
                    erp_config['oracle']['password']
                )
                logging.info("Oracle HR connector initialized")
            except Exception as e:
                logging.error(f"Failed to initialize Oracle HR connector: {str(e)}")
        
        # Initialize Active Directory connector if enabled
        if erp_config['active_directory']['enabled']:
            try:
                self.connectors['active_directory'] = ActiveDirectoryConnector(
                    erp_config['active_directory']['server'],
                    erp_config['active_directory']['username'],
                    erp_config['active_directory']['password'],
                    erp_config['active_directory']['domain']
                )
                logging.info("Active Directory connector initialized")
            except Exception as e:
                logging.error(f"Failed to initialize Active Directory connector: {str(e)}")
    
    def test_connections(self) -> Dict[str, bool]:
        """Test connections to all configured ERP systems"""
        results = {}
        for name, connector in self.connectors.items():
            try:
                results[name] = connector.test_connection()
            except Exception as e:
                logging.error(f"Error testing connection to {name}: {str(e)}")
                results[name] = False
        return results
    
    def get_employees_from_all_sources(self) -> List[Dict[str, Any]]:
        """Retrieve and combine employee data from all configured ERP systems"""
        all_employees = []
        employee_ids = set()  # Track unique IDs to avoid duplicates
        
        for name, connector in self.connectors.items():
            try:
                logging.info(f"Retrieving employees from {name}...")
                employees = connector.get_employees()
                
                # Add source field and deduplicate
                for emp in employees:
                    if emp['employee_id'] not in employee_ids:
                        emp['data_source'] = name
                        all_employees.append(emp)
                        employee_ids.add(emp['employee_id'])
                
                logging.info(f"Retrieved {len(employees)} employees from {name}")
            except Exception as e:
                logging.error(f"Error retrieving employees from {name}: {str(e)}")
        
        return all_employees
    
    def get_org_structure_from_primary_source(self) -> Dict[str, Any]:
        """Retrieve organizational structure from primary ERP system"""
        # Define priority order for sources
        priority_order = ['sap', 'oracle', 'active_directory']
        
        for source in priority_order:
            if source in self.connectors:
                try:
                    logging.info(f"Retrieving org structure from {source}...")
                    structure = self.connectors[source].get_org_structure()
                    if structure:
                        return structure
                except Exception as e:
                    logging.error(f"Error retrieving org structure from {source}: {str(e)}")
        
        # If no structure could be retrieved, build from employee data
        logging.info("Building org structure from combined employee data...")
        employees = self.get_employees_from_all_sources()
        
        # Create a mapping of employees by ID
        employee_map = {emp['employee_id']: emp for emp in employees}
        
        # Track root nodes (employees with no manager)
        root_nodes = []
        
        # Add children lists to each employee
        for emp in employees:
            emp['children'] = []
        
        # Organize into hierarchy
        for emp in employees:
            manager_id = emp.get('manager_id')
            if manager_id and manager_id in employee_map:
                # Add this employee as a child of their manager
                employee_map[manager_id]['children'].append(emp)
            else:
                # No manager or manager not in dataset, consider a root node
                root_nodes.append(emp)
        
        return {
            'organization': {
                'nodes': root_nodes
            }
        } 
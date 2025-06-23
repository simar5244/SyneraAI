import os
import sys
import logging
import json
import datetime
import argparse
from dotenv import load_dotenv
import pymongo
from pymongo.errors import ConnectionFailure, OperationFailure
import getpass

# For SAP HR integration
import pyrfc
from pyrfc import Connection as SAPConnection

# For PeopleSoft HR integration
import requests
import xml.etree.ElementTree as ET

# For Active Directory integration
import ldap3
from ldap3 import Server, Connection, ALL, NTLM, SUBTREE

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("hr_data_extraction.log"),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("HR Data Extraction")

class HRDataExtractor:
    def __init__(self):
        # Load environment variables from .env.local file
        load_dotenv(".env.local")
        self.mongo_uri = os.getenv("MONGODB_URI")
        
        if not self.mongo_uri:
            logger.error("MongoDB URI not found in .env.local file")
            sys.exit(1)
        
        # Initialize MongoDB connection
        try:
            self.mongo_client = pymongo.MongoClient(self.mongo_uri)
            self.mongo_client.admin.command('ping')  # Check connection
            self.db = self.mongo_client["hr_data"]
            logger.info("Connected to MongoDB successfully")
        except ConnectionFailure:
            logger.error("Failed to connect to MongoDB")
            sys.exit(1)
    
    def extract_all_data(self):
        """Extract data from all HR systems and store in MongoDB"""
        # Extract data from each system
        sap_data = self.extract_from_sap()
        peoplesoft_data = self.extract_from_peoplesoft()
        ad_data = self.extract_from_active_directory()
        
        # Store data in MongoDB
        self.store_data("sap_employees", sap_data)
        self.store_data("peoplesoft_employees", peoplesoft_data)
        self.store_data("ad_employees", ad_data)
        
        # Create a combined collection with unified schema
        self.create_unified_data(sap_data, peoplesoft_data, ad_data)
        
        logger.info("All data extracted and stored successfully")
    
    def extract_from_sap(self):
        """Extract employee data from SAP HR"""
        logger.info("Extracting data from SAP HR...")
        
        # Get SAP credentials
        print("\n=== SAP HR Connection ===")
        sap_ashost = input("SAP Application Server Host: ")
        sap_sysnr = input("SAP System Number: ")
        sap_client = input("SAP Client: ")
        sap_user = input("SAP Username: ")
        sap_passwd = getpass.getpass("SAP Password: ")
        
        try:
            # Connect to SAP
            conn = SAPConnection(
                ashost=sap_ashost,
                sysnr=sap_sysnr,
                client=sap_client,
                user=sap_user,
                passwd=sap_passwd
            )
            
            # Extract employee data using BAPI_EMPLOYEE_GETLIST
            employees_list = conn.call('BAPI_EMPLOYEE_GETLIST')
            
            if not employees_list or 'EMPLOYEE_LIST' not in employees_list:
                logger.warning("No employee data returned from SAP")
                return []
            
            # Get detailed information for each employee
            employees_data = []
            for emp in employees_list['EMPLOYEE_LIST']:
                emp_id = emp['PERNR']
                
                # Get detailed employee info
                emp_details = conn.call('BAPI_EMPLOYEE_GETDATA', 
                                       EMPLOYEE_ID=emp_id,
                                       RETURN_AUTHORITY_CHECK=True)
                
                # Get organizational data
                org_data = conn.call('BAPI_ORGUNITOPKEY_GETOUTLINE', 
                                   OBJID=emp_details['PERSONALDATA']['ORGEH'])
                
                # Combine employee data
                employee = {
                    'employee_id': emp_id,
                    'source_system': 'SAP',
                    'personal_data': emp_details['PERSONALDATA'],
                    'organizational_data': {
                        'unit': emp_details['PERSONALDATA']['ORGEH'],
                        'position': emp_details['PERSONALDATA']['PLANS'],
                        'hierarchy': org_data['HIERARCHY'] if 'HIERARCHY' in org_data else [],
                    },
                    'address_data': emp_details['ADDRESSDATA'] if 'ADDRESSDATA' in emp_details else {},
                    'communication_data': emp_details['COMMUNICATION'] if 'COMMUNICATION' in emp_details else {},
                    'extracted_date': datetime.datetime.now(),
                    # Add empty placeholders for future extensions
                    'skills': [],
                    'projects': [],
                    'certifications': [],
                    'training': [],
                    'performance': [],
                    'career_development': {},
                    'custom_attributes': {}
                }
                
                employees_data.append(employee)
            
            logger.info(f"Extracted {len(employees_data)} employees from SAP HR")
            return employees_data
            
        except Exception as e:
            logger.error(f"Error extracting data from SAP: {str(e)}")
            return []
    
    def extract_from_peoplesoft(self):
        """Extract employee data from PeopleSoft HR"""
        logger.info("Extracting data from PeopleSoft HR...")
        
        # Get PeopleSoft credentials
        print("\n=== PeopleSoft HR Connection ===")
        ps_url = input("PeopleSoft REST API URL: ")
        ps_user = input("PeopleSoft Username: ")
        ps_passwd = getpass.getpass("PeopleSoft Password: ")
        
        try:
            # Create session for authentication
            session = requests.Session()
            
            # Authenticate
            auth_response = session.post(
                f"{ps_url}/PeopleTools/Authentication",
                json={"username": ps_user, "password": ps_passwd},
                headers={"Content-Type": "application/json"},
                verify=True  # Set to False if using self-signed certificates
            )
            
            if auth_response.status_code != 200:
                logger.error(f"PeopleSoft authentication failed with status {auth_response.status_code}")
                return []
            
            # Extract employee data
            employees_data = []
            
            # Get all employees
            emp_response = session.get(
                f"{ps_url}/HCM/Workforce_Data/employees",
                params={"page_size": 1000}  # Adjust based on system limits
            )
            
            if emp_response.status_code != 200:
                logger.error(f"Failed to get PeopleSoft employees with status {emp_response.status_code}")
                return []
            
            emp_list = emp_response.json()
            
            # Process each employee
            for emp in emp_list.get('items', []):
                emp_id = emp.get('EMPLID')
                
                # Get detailed employee data
                emp_detail_resp = session.get(f"{ps_url}/HCM/Workforce_Data/employees/{emp_id}")
                if emp_detail_resp.status_code != 200:
                    logger.warning(f"Could not get details for employee {emp_id}")
                    continue
                
                emp_details = emp_detail_resp.json()
                
                # Get job and position data
                job_resp = session.get(f"{ps_url}/HCM/Workforce_Data/employees/{emp_id}/jobs")
                job_data = job_resp.json() if job_resp.status_code == 200 else {}
                
                # Get reporting structure
                reporting_resp = session.get(f"{ps_url}/HCM/Workforce_Data/employees/{emp_id}/reporting_structure")
                reporting_data = reporting_resp.json() if reporting_resp.status_code == 200 else {}
                
                # Combine all data
                employee = {
                    'employee_id': emp_id,
                    'source_system': 'PeopleSoft',
                    'personal_data': {
                        'first_name': emp_details.get('FIRST_NAME', ''),
                        'last_name': emp_details.get('LAST_NAME', ''),
                        'middle_name': emp_details.get('MIDDLE_NAME', ''),
                        'birthdate': emp_details.get('BIRTHDATE', ''),
                        'gender': emp_details.get('SEX', ''),
                        'marital_status': emp_details.get('MAR_STATUS', '')
                    },
                    'job_data': job_data.get('current_job', {}),
                    'organizational_data': {
                        'department': job_data.get('current_job', {}).get('DEPTID', ''),
                        'reporting_structure': reporting_data.get('reporting_chain', [])
                    },
                    'contact_data': emp_details.get('contact_info', {}),
                    'extracted_date': datetime.datetime.now(),
                    # Add empty placeholders for future extensions
                    'skills': [],
                    'projects': [],
                    'certifications': [],
                    'training': [],
                    'performance': [],
                    'career_development': {},
                    'custom_attributes': {}
                }
                
                employees_data.append(employee)
            
            logger.info(f"Extracted {len(employees_data)} employees from PeopleSoft HR")
            return employees_data
            
        except Exception as e:
            logger.error(f"Error extracting data from PeopleSoft: {str(e)}")
            return []
    
    def extract_from_active_directory(self):
        """Extract employee data from Microsoft Active Directory"""
        logger.info("Extracting data from Microsoft Active Directory...")
        
        # Get Active Directory credentials
        print("\n=== Active Directory Connection ===")
        ad_server = input("AD Server (e.g., ldap://domain.com): ")
        ad_domain = input("AD Domain (e.g., DOMAIN): ")
        ad_user = input("AD Username: ")
        ad_passwd = getpass.getpass("AD Password: ")
        ad_search_base = input("AD Search Base (e.g., DC=domain,DC=com): ")
        
        try:
            # Connect to Active Directory
            server = Server(ad_server, get_info=ALL)
            conn = Connection(
                server,
                user=f"{ad_domain}\\{ad_user}" if ad_domain else ad_user,
                password=ad_passwd,
                authentication=NTLM if ad_domain else None,
                auto_bind=True
            )
            
            # Search for all user accounts
            conn.search(
                search_base=ad_search_base,
                search_filter='(&(objectClass=user)(objectCategory=person))',
                search_scope=SUBTREE,
                attributes=[
                    'sAMAccountName', 'givenName', 'sn', 'mail', 'displayName',
                    'title', 'department', 'company', 'manager', 'telephoneNumber',
                    'mobile', 'physicalDeliveryOfficeName', 'streetAddress',
                    'l', 'st', 'postalCode', 'co', 'whenCreated', 'whenChanged',
                    'distinguishedName', 'memberOf'
                ]
            )
            
            employees_data = []
            
            # Process each user
            for entry in conn.entries:
                # Convert LDAP entry to dictionary
                user_dict = entry.entry_attributes_as_dict
                
                # Get manager information if exists
                manager_info = {}
                if 'manager' in user_dict and user_dict['manager']:
                    manager_dn = user_dict['manager'][0]
                    conn.search(
                        search_base=manager_dn,
                        search_filter='(objectClass=*)',
                        search_scope=SUBTREE,
                        attributes=['sAMAccountName', 'displayName', 'title']
                    )
                    if conn.entries:
                        manager_entry = conn.entries[0]
                        manager_info = {
                            'account_name': manager_entry.sAMAccountName.value,
                            'display_name': manager_entry.displayName.value,
                            'title': manager_entry.title.value if hasattr(manager_entry, 'title') else '',
                            'distinguished_name': manager_dn
                        }
                
                # Get group memberships
                groups = []
                if 'memberOf' in user_dict and user_dict['memberOf']:
                    for group_dn in user_dict['memberOf']:
                        conn.search(
                            search_base=group_dn,
                            search_filter='(objectClass=*)',
                            search_scope=SUBTREE,
                            attributes=['cn', 'description']
                        )
                        if conn.entries:
                            group_entry = conn.entries[0]
                            groups.append({
                                'name': group_entry.cn.value,
                                'description': group_entry.description.value if hasattr(group_entry, 'description') else '',
                                'distinguished_name': group_dn
                            })
                
                # Format user data
                employee = {
                    'employee_id': user_dict.get('sAMAccountName', [''])[0],
                    'source_system': 'Active Directory',
                    'personal_data': {
                        'first_name': user_dict.get('givenName', [''])[0],
                        'last_name': user_dict.get('sn', [''])[0],
                        'display_name': user_dict.get('displayName', [''])[0],
                        'email': user_dict.get('mail', [''])[0],
                    },
                    'job_data': {
                        'title': user_dict.get('title', [''])[0],
                        'department': user_dict.get('department', [''])[0],
                        'company': user_dict.get('company', [''])[0]
                    },
                    'organizational_data': {
                        'manager': manager_info,
                        'groups': groups
                    },
                    'contact_data': {
                        'phone': user_dict.get('telephoneNumber', [''])[0],
                        'mobile': user_dict.get('mobile', [''])[0],
                        'office': user_dict.get('physicalDeliveryOfficeName', [''])[0]
                    },
                    'address_data': {
                        'street': user_dict.get('streetAddress', [''])[0],
                        'city': user_dict.get('l', [''])[0], 
                        'state': user_dict.get('st', [''])[0],
                        'postal_code': user_dict.get('postalCode', [''])[0],
                        'country': user_dict.get('co', [''])[0]
                    },
                    'account_data': {
                        'distinguished_name': user_dict.get('distinguishedName', [''])[0],
                        'created_date': user_dict.get('whenCreated', [''])[0],
                        'modified_date': user_dict.get('whenChanged', [''])[0]
                    },
                    'extracted_date': datetime.datetime.now(),
                    # Add empty placeholders for future extensions
                    'skills': [],
                    'projects': [],
                    'certifications': [],
                    'training': [],
                    'performance': [],
                    'career_development': {},
                    'custom_attributes': {}
                }
                
                employees_data.append(employee)
            
            logger.info(f"Extracted {len(employees_data)} employees from Active Directory")
            return employees_data
            
        except Exception as e:
            logger.error(f"Error extracting data from Active Directory: {str(e)}")
            return []
    
    def store_data(self, collection_name, data):
        """Store data in MongoDB collection"""
        if not data:
            logger.warning(f"No data to store in {collection_name}")
            return
        
        try:
            # Create or get collection
            collection = self.db[collection_name]
            
            # Create a unique index on employee_id to ensure uniqueness
            # and enable efficient lookups and updates
            collection.create_index([("employee_id", pymongo.ASCENDING)], unique=True)
            
            # Instead of dropping and recreating, use upsert for each document
            for employee in data:
                collection.update_one(
                    {"employee_id": employee["employee_id"]},
                    {"$set": employee},
                    upsert=True
                )
            
            # Create additional indexes for faster retrieval
            collection.create_index("source_system")
            collection.create_index([("personal_data.email", pymongo.ASCENDING)])
            collection.create_index([("personal_data.last_name", pymongo.ASCENDING)])
            
            logger.info(f"Successfully stored/updated {len(data)} records in {collection_name}")
        except Exception as e:
            logger.error(f"Error storing data in MongoDB: {str(e)}")
    
    def create_unified_data(self, sap_data, peoplesoft_data, ad_data):
        """Create a unified employee data collection with consistent schema"""
        logger.info("Creating unified employee data collection...")
        
        unified_collection = self.db["unified_employees"]
        
        # Create a unique index on employee_id if it doesn't exist
        unified_collection.create_index([("employee_id", pymongo.ASCENDING)], unique=True)
        
        # Process SAP data
        for emp in sap_data:
            unified_emp = self._map_to_unified_schema(emp, "SAP")
            # Upsert to update existing or add new
            unified_collection.update_one(
                {"employee_id": unified_emp["employee_id"]},
                {"$set": unified_emp},
                upsert=True
            )
        
        # Process PeopleSoft data
        for emp in peoplesoft_data:
            unified_emp = self._map_to_unified_schema(emp, "PeopleSoft")
            unified_collection.update_one(
                {"employee_id": unified_emp["employee_id"]},
                {"$set": unified_emp},
                upsert=True
            )
        
        # Process Active Directory data
        for emp in ad_data:
            unified_emp = self._map_to_unified_schema(emp, "Active Directory")
            unified_collection.update_one(
                {"employee_id": unified_emp["employee_id"]},
                {"$set": unified_emp},
                upsert=True
            )
        
        # Create additional indexes for efficient querying
        unified_collection.create_index("source_system")
        unified_collection.create_index("email")
        unified_collection.create_index("department")
        unified_collection.create_index("manager_id")
        unified_collection.create_index([("skills.name", pymongo.ASCENDING)])
        unified_collection.create_index([("projects.name", pymongo.ASCENDING)])
        
        logger.info(f"Successfully created/updated unified collection")
    
    def _map_to_unified_schema(self, emp, source):
        """Map employee data to unified schema"""
        unified_emp = {
            "employee_id": emp["employee_id"],
            "source_system": source,
            "first_name": "",
            "last_name": "",
            "email": "",
            "position": "",
            "department": "",
            "manager_id": "",
            "manager_name": "",
            "location": "",
            "phone": "",
            "hire_date": "",
            # Extended attributes for future use
            "skills": emp.get("skills", []),
            "projects": emp.get("projects", []),
            "certifications": emp.get("certifications", []),
            "training": emp.get("training", []),
            "performance": emp.get("performance", []),
            "career_development": emp.get("career_development", {}),
            "custom_attributes": emp.get("custom_attributes", {}),
            # Store original data for reference
            "source_data": emp,
            "last_updated": datetime.datetime.now()
        }
        
        # Map fields based on source system
        if source == "SAP":
            personal = emp.get("personal_data", {})
            unified_emp.update({
                "first_name": personal.get("VORNA", ""),
                "last_name": personal.get("NACHN", ""),
                "position": personal.get("PLANS", ""),
                "department": personal.get("ORGEH", ""),
                "hire_date": personal.get("BEGDA", "")
            })
            
            comm_data = emp.get("communication_data", {})
            if comm_data:
                unified_emp["email"] = comm_data.get("EMAIL", "")
                unified_emp["phone"] = comm_data.get("TELPR", "")
                
            addr_data = emp.get("address_data", {})
            if addr_data:
                unified_emp["location"] = addr_data.get("ORT01", "")
                
        elif source == "PeopleSoft":
            personal = emp.get("personal_data", {})
            unified_emp.update({
                "first_name": personal.get("first_name", ""),
                "last_name": personal.get("last_name", ""),
            })
            
            job = emp.get("job_data", {})
            if job:
                unified_emp["position"] = job.get("POSITION_TITLE", "")
                unified_emp["hire_date"] = job.get("HIRE_DT", "")
            
            org = emp.get("organizational_data", {})
            if org:
                unified_emp["department"] = org.get("department", "")
                
                # Get manager from reporting structure
                reporting = org.get("reporting_structure", [])
                if reporting and len(reporting) > 0:
                    manager = reporting[0]  # Direct manager is usually first
                    unified_emp["manager_id"] = manager.get("EMPLID", "")
                    unified_emp["manager_name"] = f"{manager.get('FIRST_NAME', '')} {manager.get('LAST_NAME', '')}"
            
            contact = emp.get("contact_data", {})
            if contact:
                unified_emp["email"] = contact.get("EMAIL_ADDR", "")
                unified_emp["phone"] = contact.get("PHONE", "")
                unified_emp["location"] = contact.get("CITY", "")
            
        elif source == "Active Directory":
            personal = emp.get("personal_data", {})
            unified_emp.update({
                "first_name": personal.get("first_name", ""),
                "last_name": personal.get("last_name", ""),
                "email": personal.get("email", ""),
            })
            
            job = emp.get("job_data", {})
            if job:
                unified_emp["position"] = job.get("title", "")
                unified_emp["department"] = job.get("department", "")
            
            org = emp.get("organizational_data", {})
            if org and "manager" in org:
                manager = org.get("manager", {})
                unified_emp["manager_id"] = manager.get("account_name", "")
                unified_emp["manager_name"] = manager.get("display_name", "")
            
            contact = emp.get("contact_data", {})
            if contact:
                unified_emp["phone"] = contact.get("phone", "")
            
            address = emp.get("address_data", {})
            if address:
                city = address.get("city", "")
                state = address.get("state", "")
                unified_emp["location"] = f"{city}, {state}" if city and state else city or state
        
        return unified_emp

    def add_employee_skills(self, employee_id, skills):
        """Add skills to an employee record"""
        try:
            # Update in source-specific collection
            for collection in ["sap_employees", "peoplesoft_employees", "ad_employees"]:
                result = self.db[collection].update_one(
                    {"employee_id": employee_id},
                    {"$set": {"skills": skills}}
                )
                if result.modified_count > 0:
                    logger.info(f"Updated skills for employee {employee_id} in {collection}")
            
            # Update in unified collection
            result = self.db["unified_employees"].update_one(
                {"employee_id": employee_id},
                {"$set": {"skills": skills}}
            )
            
            if result.modified_count > 0:
                logger.info(f"Updated skills for employee {employee_id} in unified collection")
            else:
                logger.warning(f"No employee found with ID {employee_id} or no changes made")
                
        except Exception as e:
            logger.error(f"Error adding skills to employee {employee_id}: {str(e)}")
    
    def add_employee_projects(self, employee_id, projects):
        """Add projects to an employee record"""
        try:
            # Update in source-specific collection
            for collection in ["sap_employees", "peoplesoft_employees", "ad_employees"]:
                result = self.db[collection].update_one(
                    {"employee_id": employee_id},
                    {"$set": {"projects": projects}}
                )
                if result.modified_count > 0:
                    logger.info(f"Updated projects for employee {employee_id} in {collection}")
            
            # Update in unified collection
            result = self.db["unified_employees"].update_one(
                {"employee_id": employee_id},
                {"$set": {"projects": projects}}
            )
            
            if result.modified_count > 0:
                logger.info(f"Updated projects for employee {employee_id} in unified collection")
            else:
                logger.warning(f"No employee found with ID {employee_id} or no changes made")
                
        except Exception as e:
            logger.error(f"Error adding projects to employee {employee_id}: {str(e)}")
    
    def add_custom_employee_attribute(self, employee_id, attribute_name, attribute_value):
        """Add a custom attribute to an employee record"""
        try:
            # Update in source-specific collection
            attr_path = f"custom_attributes.{attribute_name}"
            
            for collection in ["sap_employees", "peoplesoft_employees", "ad_employees"]:
                result = self.db[collection].update_one(
                    {"employee_id": employee_id},
                    {"$set": {attr_path: attribute_value}}
                )
                if result.modified_count > 0:
                    logger.info(f"Updated {attribute_name} for employee {employee_id} in {collection}")
            
            # Update in unified collection
            result = self.db["unified_employees"].update_one(
                {"employee_id": employee_id},
                {"$set": {attr_path: attribute_value}}
            )
            
            if result.modified_count > 0:
                logger.info(f"Updated {attribute_name} for employee {employee_id} in unified collection")
            else:
                logger.warning(f"No employee found with ID {employee_id} or no changes made")
                
        except Exception as e:
            logger.error(f"Error adding {attribute_name} to employee {employee_id}: {str(e)}")
    
    def bulk_add_employee_attribute(self, attribute_name, data_dict):
        """
        Bulk add an attribute to multiple employees
        data_dict should be a dictionary with employee_id as key and attribute value as value
        """
        try:
            # Bulk update operations for each collection
            for collection_name in ["sap_employees", "peoplesoft_employees", "ad_employees", "unified_employees"]:
                collection = self.db[collection_name]
                
                bulk_operations = []
                for employee_id, attribute_value in data_dict.items():
                    # For standard attributes
                    if attribute_name in ["skills", "projects", "certifications", "training", "performance"]:
                        bulk_operations.append(
                            pymongo.UpdateOne(
                                {"employee_id": employee_id},
                                {"$set": {attribute_name: attribute_value}}
                            )
                        )
                    # For custom attributes
                    else:
                        bulk_operations.append(
                            pymongo.UpdateOne(
                                {"employee_id": employee_id},
                                {"$set": {f"custom_attributes.{attribute_name}": attribute_value}}
                            )
                        )
                
                if bulk_operations:
                    result = collection.bulk_write(bulk_operations)
                    logger.info(f"Bulk updated {attribute_name} for {result.modified_count} employees in {collection_name}")
                    
        except Exception as e:
            logger.error(f"Error in bulk update operation for {attribute_name}: {str(e)}")

    def get_employee_by_id(self, employee_id):
        """Get employee data by ID from unified collection"""
        try:
            employee = self.db["unified_employees"].find_one({"employee_id": employee_id})
            return employee
        except Exception as e:
            logger.error(f"Error retrieving employee {employee_id}: {str(e)}")
            return None
    
    def search_employees(self, query, limit=100):
        """Search employees based on query criteria"""
        try:
            result = self.db["unified_employees"].find(query).limit(limit)
            return list(result)
        except Exception as e:
            logger.error(f"Error searching employees: {str(e)}")
            return []
    
    def get_employees_by_skill(self, skill_name):
        """Find employees with a specific skill"""
        try:
            result = self.db["unified_employees"].find({"skills.name": skill_name})
            return list(result)
        except Exception as e:
            logger.error(f"Error finding employees with skill {skill_name}: {str(e)}")
            return []
    
    def get_employees_by_project(self, project_name):
        """Find employees who worked on a specific project"""
        try:
            result = self.db["unified_employees"].find({"projects.name": project_name})
            return list(result)
        except Exception as e:
            logger.error(f"Error finding employees for project {project_name}: {str(e)}")
            return []

def main():
    parser = argparse.ArgumentParser(description="Extract HR data from SAP, PeopleSoft, and Active Directory")
    parser.add_argument('--sap-only', action='store_true', help='Extract data from SAP HR only')
    parser.add_argument('--ps-only', action='store_true', help='Extract data from PeopleSoft only')
    parser.add_argument('--ad-only', action='store_true', help='Extract data from Active Directory only')
    parser.add_argument('--add-skills', action='store_true', help='Add skills to an employee (requires --employee-id)')
    parser.add_argument('--add-projects', action='store_true', help='Add projects to an employee (requires --employee-id)')
    parser.add_argument('--add-custom-attribute', type=str, help='Custom attribute name to add (requires --employee-id)')
    parser.add_argument('--employee-id', type=str, help='Employee ID for skills/projects operations')
    parser.add_argument('--search', action='store_true', help='Search employees by criteria')
    parser.add_argument('--get-by-skill', type=str, help='Find employees with specific skill')
    parser.add_argument('--get-by-project', type=str, help='Find employees who worked on specific project')
    parser.add_argument('--bulk-update', action='store_true', help='Bulk update employee attributes from JSON file')
    parser.add_argument('--input-file', type=str, help='JSON file for bulk operations')
    args = parser.parse_args()
    
    extractor = HRDataExtractor()
    
    # Extract from HR systems
    if args.sap_only:
        sap_data = extractor.extract_from_sap()
        extractor.store_data("sap_employees", sap_data)
    elif args.ps_only:
        ps_data = extractor.extract_from_peoplesoft()
        extractor.store_data("peoplesoft_employees", ps_data)
    elif args.ad_only:
        ad_data = extractor.extract_from_active_directory()
        extractor.store_data("ad_employees", ad_data)
    elif args.add_skills and args.employee_id:
        # Interactive skills addition
        skills = []
        print("\nEnter employee skills (enter blank line to finish):")
        while True:
            skill_name = input("Skill name: ")
            if not skill_name:
                break
                
            skill_level = input("Skill level (beginner/intermediate/advanced/expert): ")
            years_exp = input("Years of experience: ")
            certification = input("Certification (if any): ")
            
            skill = {
                "name": skill_name,
                "level": skill_level,
                "years_experience": years_exp,
                "certification": certification,
                "last_updated": datetime.datetime.now().isoformat()
            }
            skills.append(skill)
        
        extractor.add_employee_skills(args.employee_id, skills)
    elif args.add_projects and args.employee_id:
        # Interactive projects addition
        projects = []
        print("\nEnter employee projects (enter blank line to finish):")
        while True:
            project_name = input("Project name: ")
            if not project_name:
                break
                
            role = input("Role in project: ")
            start_date = input("Start date (YYYY-MM-DD): ")
            end_date = input("End date (YYYY-MM-DD or 'ongoing'): ")
            description = input("Brief description: ")
            skills_used = input("Skills used (comma separated): ").split(",")
            skills_used = [s.strip() for s in skills_used if s.strip()]
            
            project = {
                "name": project_name,
                "role": role,
                "start_date": start_date,
                "end_date": end_date,
                "description": description,
                "skills_used": skills_used,
                "last_updated": datetime.datetime.now().isoformat()
            }
            projects.append(project)
        
        extractor.add_employee_projects(args.employee_id, projects)
    elif args.add_custom_attribute and args.employee_id:
        # Add custom attribute to employee
        attr_name = args.add_custom_attribute
        attr_value = input(f"Enter value for {attr_name}: ")
        extractor.add_custom_employee_attribute(args.employee_id, attr_name, attr_value)
    elif args.search:
        # Interactive search
        print("\nSearch employees (enter search criteria):")
        field = input("Field (e.g., first_name, department, position): ")
        value = input("Value: ")
        
        query = {field: {"$regex": value, "$options": "i"}}  # Case-insensitive search
        employees = extractor.search_employees(query)
        
        if employees:
            print(f"\nFound {len(employees)} matching employees:")
            for emp in employees:
                print(f"ID: {emp['employee_id']}, Name: {emp.get('first_name', '')} {emp.get('last_name', '')}, Position: {emp.get('position', '')}")
        else:
            print("No matching employees found.")
    elif args.get_by_skill:
        # Get employees by skill
        employees = extractor.get_employees_by_skill(args.get_by_skill)
        if employees:
            print(f"\nFound {len(employees)} employees with {args.get_by_skill} skill:")
            for emp in employees:
                print(f"ID: {emp['employee_id']}, Name: {emp.get('first_name', '')} {emp.get('last_name', '')}")
        else:
            print(f"No employees found with {args.get_by_skill} skill.")
    elif args.get_by_project:
        # Get employees by project
        employees = extractor.get_employees_by_project(args.get_by_project)
        if employees:
            print(f"\nFound {len(employees)} employees who worked on {args.get_by_project}:")
            for emp in employees:
                print(f"ID: {emp['employee_id']}, Name: {emp.get('first_name', '')} {emp.get('last_name', '')}")
        else:
            print(f"No employees found who worked on {args.get_by_project}.")
    elif args.bulk_update and args.input_file:
        # Bulk update from JSON file
        try:
            with open(args.input_file, 'r') as f:
                data = json.load(f)
                
            if not isinstance(data, dict) or "attribute_name" not in data or "data" not in data:
                print("Invalid JSON format. Should contain 'attribute_name' and 'data' fields.")
                sys.exit(1)
                
            attribute_name = data["attribute_name"]
            attribute_data = data["data"]
            
            extractor.bulk_add_employee_attribute(attribute_name, attribute_data)
            print(f"Bulk update completed for {len(attribute_data)} employees.")
        except Exception as e:
            print(f"Error processing bulk update: {str(e)}")
    else:
        # Extract from all systems by default
        extractor.extract_all_data()
    
    logger.info("HR data extraction completed")


# Additional helper class for external skills and projects management
class EmployeeSkillsManager:
    def __init__(self, mongodb_uri=None):
        """Initialize with optional MongoDB URI or use from .env.local"""
        if not mongodb_uri:
            load_dotenv(".env.local")
            mongodb_uri = os.getenv("MONGODB_URI")
            
        if not mongodb_uri:
            raise ValueError("MongoDB URI not provided and not found in .env.local")
            
        self.mongo_client = pymongo.MongoClient(mongodb_uri)
        self.db = self.mongo_client["hr_data"]
        
    def add_skill(self, employee_id, skill_data):
        """Add a single skill to employee record"""
        if not isinstance(skill_data, dict) or "name" not in skill_data:
            raise ValueError("Skill data must be a dictionary with at least a 'name' field")
            
        # Ensure last_updated is present
        if "last_updated" not in skill_data:
            skill_data["last_updated"] = datetime.datetime.now().isoformat()
            
        # Add to unified employees collection
        unified_coll = self.db["unified_employees"]
        employee = unified_coll.find_one({"employee_id": employee_id})
        
        if not employee:
            raise ValueError(f"Employee with ID {employee_id} not found")
            
        # Check if skill already exists
        existing_skills = employee.get("skills", [])
        skill_exists = False
        
        for i, skill in enumerate(existing_skills):
            if skill.get("name") == skill_data["name"]:
                # Update existing skill
                existing_skills[i] = skill_data
                skill_exists = True
                break
                
        if not skill_exists:
            # Add new skill
            existing_skills.append(skill_data)
            
        # Update employee record
        unified_coll.update_one(
            {"employee_id": employee_id},
            {"$set": {"skills": existing_skills}}
        )
        
        # Update in source collection if it exists
        source_system = employee.get("source_system")
        if source_system:
            source_coll = self.db[f"{source_system.lower().replace(' ', '_')}_employees"]
            source_coll.update_one(
                {"employee_id": employee_id},
                {"$set": {"skills": existing_skills}}
            )
            
        return True
        
    def add_project(self, employee_id, project_data):
        """Add a single project to employee record"""
        if not isinstance(project_data, dict) or "name" not in project_data:
            raise ValueError("Project data must be a dictionary with at least a 'name' field")
            
        # Ensure last_updated is present
        if "last_updated" not in project_data:
            project_data["last_updated"] = datetime.datetime.now().isoformat()
            
        # Add to unified employees collection
        unified_coll = self.db["unified_employees"]
        employee = unified_coll.find_one({"employee_id": employee_id})
        
        if not employee:
            raise ValueError(f"Employee with ID {employee_id} not found")
            
        # Check if project already exists
        existing_projects = employee.get("projects", [])
        project_exists = False
        
        for i, project in enumerate(existing_projects):
            if project.get("name") == project_data["name"]:
                # Update existing project
                existing_projects[i] = project_data
                project_exists = True
                break
                
        if not project_exists:
            # Add new project
            existing_projects.append(project_data)
            
        # Update employee record
        unified_coll.update_one(
            {"employee_id": employee_id},
            {"$set": {"projects": existing_projects}}
        )
        
        # Update in source collection if it exists
        source_system = employee.get("source_system")
        if source_system:
            source_coll = self.db[f"{source_system.lower().replace(' ', '_')}_employees"]
            source_coll.update_one(
                {"employee_id": employee_id},
                {"$set": {"projects": existing_projects}}
            )
            
        return True
    
    def bulk_import_skills(self, skills_data):
        """
        Bulk import skills for multiple employees
        skills_data should be a list of dictionaries with employee_id and skills fields
        """
        bulk_ops_unified = []
        source_bulk_ops = {
            "sap": [],
            "peoplesoft": [],
            "active_directory": []
        }
        
        for item in skills_data:
            employee_id = item.get("employee_id")
            skills = item.get("skills", [])
            
            if not employee_id or not skills:
                continue
                
            # Get employee to determine source system
            employee = self.db["unified_employees"].find_one(
                {"employee_id": employee_id},
                {"source_system": 1}
            )
            
            if not employee:
                continue
                
            # Add operation for unified collection
            bulk_ops_unified.append(
                pymongo.UpdateOne(
                    {"employee_id": employee_id},
                    {"$set": {"skills": skills}}
                )
            )
            
            # Add operation for source collection
            source = employee.get("source_system", "").lower().replace(" ", "_")
            if source in source_bulk_ops:
                source_bulk_ops[source].append(
                    pymongo.UpdateOne(
                        {"employee_id": employee_id},
                        {"$set": {"skills": skills}}
                    )
                )
        
        # Execute bulk operations
        results = {"unified": 0}
        
        if bulk_ops_unified:
            result = self.db["unified_employees"].bulk_write(bulk_ops_unified)
            results["unified"] = result.modified_count
            
        for source, ops in source_bulk_ops.items():
            if ops:
                coll_name = f"{source}_employees"
                result = self.db[coll_name].bulk_write(ops)
                results[source] = result.modified_count
                
        return results
    
    def bulk_import_projects(self, projects_data):
        """
        Bulk import projects for multiple employees
        projects_data should be a list of dictionaries with employee_id and projects fields
        """
        bulk_ops_unified = []
        source_bulk_ops = {
            "sap": [],
            "peoplesoft": [],
            "active_directory": []
        }
        
        for item in projects_data:
            employee_id = item.get("employee_id")
            projects = item.get("projects", [])
            
            if not employee_id or not projects:
                continue
                
            # Get employee to determine source system
            employee = self.db["unified_employees"].find_one(
                {"employee_id": employee_id},
                {"source_system": 1}
            )
            
            if not employee:
                continue
                
            # Add operation for unified collection
            bulk_ops_unified.append(
                pymongo.UpdateOne(
                    {"employee_id": employee_id},
                    {"$set": {"projects": projects}}
                )
            )
            
            # Add operation for source collection
            source = employee.get("source_system", "").lower().replace(" ", "_")
            if source in source_bulk_ops:
                source_bulk_ops[source].append(
                    pymongo.UpdateOne(
                        {"employee_id": employee_id},
                        {"$set": {"projects": projects}}
                    )
                )
        
        # Execute bulk operations
        results = {"unified": 0}
        
        if bulk_ops_unified:
            result = self.db["unified_employees"].bulk_write(bulk_ops_unified)
            results["unified"] = result.modified_count
            
        for source, ops in source_bulk_ops.items():
            if ops:
                coll_name = f"{source}_employees"
                result = self.db[coll_name].bulk_write(ops)
                results[source] = result.modified_count
                
        return results
    
    def find_employees_with_skills(self, skills, match_all=True):
        """
        Find employees with specific skills
        skills should be a list of skill names
        match_all=True requires all skills, False requires any of the skills
        """
        if not skills:
            return []
            
        query = {}
        if match_all:
            # Must match all skills in list
            query = {"$and": [{"skills.name": skill} for skill in skills]}
        else:
            # Match any skill in list
            query = {"skills.name": {"$in": skills}}
            
        employees = self.db["unified_employees"].find(
            query,
            {
                "employee_id": 1, 
                "first_name": 1, 
                "last_name": 1, 
                "position": 1,
                "department": 1,
                "email": 1,
                "skills": 1
            }
        )
        
        return list(employees)
    
    def find_employees_for_project(self, required_skills, experience_level=None):
        """
        Find employees suitable for a project based on skills and experience
        required_skills is a list of skill names
        experience_level can be 'beginner', 'intermediate', 'advanced', 'expert'
        """
        if not required_skills:
            return []
            
        base_query = {"skills.name": {"$in": required_skills}}
        
        if experience_level:
            # Add experience level criteria
            base_query["skills"] = {
                "$elemMatch": {
                    "name": {"$in": required_skills},
                    "level": experience_level
                }
            }
            
        employees = self.db["unified_employees"].find(
            base_query,
            {
                "employee_id": 1, 
                "first_name": 1, 
                "last_name": 1, 
                "position": 1,
                "department": 1,
                "email": 1,
                "skills": 1,
                "projects": 1
            }
        )
        
        # Process to calculate skill match percentage and sort
        result = []
        for emp in employees:
            emp_skills = {skill["name"]: skill for skill in emp.get("skills", [])}
            matched_skills = [skill for skill in required_skills if skill in emp_skills]
            match_percentage = (len(matched_skills) / len(required_skills)) * 100
            
            result.append({
                "employee": emp,
                "matched_skills": matched_skills,
                "match_percentage": match_percentage
            })
            
        # Sort by match percentage (highest first)
        result.sort(key=lambda x: x["match_percentage"], reverse=True)
        return result
    
    def get_department_skill_matrix(self, department):
        """
        Generate a skill matrix for a department
        Returns a dictionary of skills and employees who possess them
        """
        employees = self.db["unified_employees"].find(
            {"department": department},
            {
                "employee_id": 1, 
                "first_name": 1, 
                "last_name": 1, 
                "skills": 1
            }
        )
        
        skill_matrix = {}
        
        for emp in employees:
            employee_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}"
            
            for skill in emp.get("skills", []):
                skill_name = skill.get("name")
                if not skill_name:
                    continue
                    
                if skill_name not in skill_matrix:
                    skill_matrix[skill_name] = []
                    
                skill_matrix[skill_name].append({
                    "employee_id": emp.get("employee_id"),
                    "name": employee_name,
                    "level": skill.get("level", ""),
                    "years_experience": skill.get("years_experience", "")
                })
                
        return skill_matrix
    
    def get_skill_gap_analysis(self, department, critical_skills):
        """
        Perform a skill gap analysis for a department
        Returns missing critical skills and recommendations
        """
        skill_matrix = self.get_department_skill_matrix(department)
        
        # Analyze gaps
        gaps = {
            "missing_skills": [],
            "underrepresented_skills": [],
            "recommendations": []
        }
        
        for skill in critical_skills:
            if skill not in skill_matrix:
                gaps["missing_skills"].append(skill)
                gaps["recommendations"].append(f"Recruit or train for {skill}")
            elif len(skill_matrix[skill]) < 2:
                gaps["underrepresented_skills"].append({
                    "skill": skill,
                    "count": len(skill_matrix[skill])
                })
                gaps["recommendations"].append(f"Increase capacity for {skill}")
                
        return gaps


# Sample data generator for skills and projects (useful for testing)
class SampleDataGenerator:
    def __init__(self):
        # Sample skills list
        self.skills = [
            "Python", "Java", "JavaScript", "C#", "SQL", "MongoDB", 
            "Project Management", "Agile", "Scrum", "DevOps", "AWS", 
            "Azure", "Data Analysis", "Machine Learning", "AI", 
            "Leadership", "Communication", "Presentation", "Negotiation",
            "React", "Angular", "Vue", "Node.js", "Spring Boot"
        ]
        
        # Sample projects
        self.projects = [
            "Website Redesign", "Mobile App Development", "Database Migration",
            "Cloud Migration", "ERP Implementation", "CRM Integration",
            "Data Warehouse Setup", "Business Intelligence", "Security Audit",
            "Performance Optimization", "Automated Testing Framework"
        ]
        
        # Sample roles
        self.roles = [
            "Developer", "Team Lead", "Project Manager", "Architect",
            "Analyst", "QA Tester", "DevOps Engineer", "Subject Matter Expert"
        ]
        
    def generate_skill(self):
        """Generate a random skill"""
        skill_name = random.choice(self.skills)
        levels = ["beginner", "intermediate", "advanced", "expert"]
        years = random.randint(1, 15)
        
        return {
            "name": skill_name,
            "level": random.choice(levels),
            "years_experience": years,
            "certification": "Yes" if random.random() > 0.7 else "No",
            "last_updated": datetime.datetime.now().isoformat()
        }
    
    def generate_project(self):
        """Generate a random project"""
        project_name = random.choice(self.projects)
        
        # Random start date in the past 5 years
        days_in_past = random.randint(30, 1825)  # Between 1 month and 5 years
        start_date = (datetime.datetime.now() - datetime.timedelta(days=days_in_past)).strftime("%Y-%m-%d")
        
        # 70% chance the project is completed
        completed = random.random() > 0.3
        
        if completed:
            # End date between start date and now
            project_duration = random.randint(30, min(days_in_past, 365))  # Between 1 month and 1 year
            end_date = (datetime.datetime.now() - datetime.timedelta(days=days_in_past-project_duration)).strftime("%Y-%m-%d")
        else:
            end_date = "ongoing"
        
        # Select 1-4 random skills used in the project
        num_skills = random.randint(1, 4)
        project_skills = random.sample(self.skills, num_skills)
        
        return {
            "name": project_name,
            "role": random.choice(self.roles),
            "start_date": start_date,
            "end_date": end_date,
            "description": f"Implementation of {project_name} for business requirements",
            "skills_used": project_skills,
            "last_updated": datetime.datetime.now().isoformat()
        }
    
    def generate_employee_skills(self, employee_id, num_skills=None):
        """Generate random skills for an employee"""
        if num_skills is None:
            num_skills = random.randint(3, 8)
            
        # Ensure unique skills
        sampled_skills = random.sample(self.skills, min(num_skills, len(self.skills)))
        skills = []
        
        for skill_name in sampled_skills:
            levels = ["beginner", "intermediate", "advanced", "expert"]
            years = random.randint(1, 15)
            
            skill = {
                "name": skill_name,
                "level": random.choice(levels),
                "years_experience": years,
                "certification": "Yes" if random.random() > 0.7 else "No",
                "last_updated": datetime.datetime.now().isoformat()
            }
            skills.append(skill)
            
        return {
            "employee_id": employee_id,
            "skills": skills
        }
    
    def generate_employee_projects(self, employee_id, num_projects=None):
        """Generate random projects for an employee"""
        if num_projects is None:
            num_projects = random.randint(1, 5)
            
        # Ensure unique projects
        sampled_projects = random.sample(self.projects, min(num_projects, len(self.projects)))
        projects = []
        
        for project_name in sampled_projects:
            # Random start date in the past 5 years
            days_in_past = random.randint(30, 1825)  # Between 1 month and 5 years
            start_date = (datetime.datetime.now() - datetime.timedelta(days=days_in_past)).strftime("%Y-%m-%d")
            
            # 70% chance the project is completed
            completed = random.random() > 0.3
            
            if completed:
                # End date between start date and now
                project_duration = random.randint(30, min(days_in_past, 365))  # Between 1 month and 1 year
                end_date = (datetime.datetime.now() - datetime.timedelta(days=days_in_past-project_duration)).strftime("%Y-%m-%d")
            else:
                end_date = "ongoing"
            
            # Select 1-4 random skills used in the project
            num_skills = random.randint(1, 4)
            project_skills = random.sample(self.skills, num_skills)
            
            project = {
                "name": project_name,
                "role": random.choice(self.roles),
                "start_date": start_date,
                "end_date": end_date,
                "description": f"Implementation of {project_name} for business requirements",
                "skills_used": project_skills,
                "last_updated": datetime.datetime.now().isoformat()
            }
            projects.append(project)
            
        return {
            "employee_id": employee_id,
            "projects": projects
        }
    
    def generate_bulk_skills_data(self, employee_ids):
        """Generate skills data for multiple employees"""
        return [self.generate_employee_skills(emp_id) for emp_id in employee_ids]
    
    def generate_bulk_projects_data(self, employee_ids):
        """Generate projects data for multiple employees"""
        return [self.generate_employee_projects(emp_id) for emp_id in employee_ids]


# If this script is run directly, execute the main function
if __name__ == "__main__":
    main()
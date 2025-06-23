#!/usr/bin/env python3
"""
ERP Data Extraction Script
--------------------------
This script connects to various ERP systems, extracts employee data,
and stores it in MongoDB in the org_sim_db database.
"""

import os
import sys
import json
import csv
import logging
import argparse
from datetime import datetime
from typing import Dict, List, Any, Optional

import pymongo
from pymongo import MongoClient

# ERP System imports
try:
    import pandas as pd
    import pyodbc  # For Microsoft SQL Server / Active Directory
    import cx_Oracle  # For Oracle
    import pyrfc  # For SAP
    import requests  # For REST APIs (Workday, etc.)
    from ldap3 import Server, Connection, ALL  # For LDAP/Active Directory
except ImportError as e:
    print(f"Warning: Some ERP connectors not available: {e}")
    print("Install required packages using: pip install pandas pyodbc cx_Oracle pyrfc requests ldap3")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("erp_extract.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("erp_extract")

# MongoDB Configuration
MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = "org_sim_db"
COLLECTION_NAME = "Project3_Employees"

class ERPExtractor:
    """Base class for ERP data extraction"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.mongodb_uri = config.get("mongodb_uri", MONGODB_URI)
        self.db_name = config.get("db_name", DB_NAME)
        self.collection_name = config.get("collection_name", COLLECTION_NAME)
        self.output_csv = config.get("output_csv", f"employee_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
        
        logger.info(f"Initialized {self.__class__.__name__} with connection to {self.db_name}.{self.collection_name}")
    
    def extract(self) -> List[Dict[str, Any]]:
        """Extract data from ERP system - to be implemented by subclasses"""
        raise NotImplementedError("Subclasses must implement extract()")
    
    def save_to_csv(self, data: List[Dict[str, Any]]) -> str:
        """Save extracted data to CSV file"""
        if not data:
            logger.warning("No data to save to CSV")
            return ""
        
        try:
            with open(self.output_csv, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=data[0].keys())
                writer.writeheader()
                writer.writerows(data)
            
            logger.info(f"Saved {len(data)} records to {self.output_csv}")
            return self.output_csv
        except Exception as e:
            logger.error(f"Error saving to CSV: {e}")
            return ""
    
    def save_to_mongodb(self, data: List[Dict[str, Any]]) -> bool:
        """Save extracted data to MongoDB"""
        if not data:
            logger.warning("No data to save to MongoDB")
            return False
        
        try:
            client = MongoClient(self.mongodb_uri)
            db = client[self.db_name]
            collection = db[self.collection_name]
            
            # Insert data into MongoDB
            result = collection.insert_many(data)
            
            logger.info(f"Saved {len(result.inserted_ids)} records to MongoDB {self.db_name}.{self.collection_name}")
            client.close()
            return True
        except Exception as e:
            logger.error(f"Error saving to MongoDB: {e}")
            return False

class SAPExtractor(ERPExtractor):
    """SAP HR data extractor"""
    
    def extract(self) -> List[Dict[str, Any]]:
        """Extract employee data from SAP HR"""
        logger.info("Extracting data from SAP HR...")
        
        try:
            # SAP connection parameters
            conn_params = {
                'ashost': self.config.get('host'),
                'sysnr': self.config.get('system_number', '00'),
                'client': self.config.get('client_number', '100'),
                'user': self.config.get('username'),
                'passwd': self.config.get('password'),
                'lang': self.config.get('language', 'EN'),
            }
            
            # Try to connect to SAP
            conn = pyrfc.Connection(**conn_params)
            
            # Define the BAPI function to call (HR_EMPLOYEE_GETLIST for example)
            result = conn.call('BAPI_EMPLOYEE_GETLIST')
            
            if 'EMPLOYEE_LIST' in result and result['EMPLOYEE_LIST']:
                # Process employee data
                employees = []
                
                for emp in result['EMPLOYEE_LIST']:
                    # Get employee details using employee ID
                    emp_id = emp.get('PERNR', '')
                    emp_details = conn.call('BAPI_EMPLOYEE_GETDATA', employeenumber=emp_id)
                    
                    # Extract personal info
                    personal_data = emp_details.get('PERSONAL_DATA', {})
                    org_data = emp_details.get('ORGANIZATION_DATA', {})
                    
                    employee = {
                        'id': emp_id,
                        'name': f"{personal_data.get('LAST_NAME', '')} {personal_data.get('FIRST_NAME', '')}".strip(),
                        'email': personal_data.get('EMAIL', 'N/A'),
                        'position': org_data.get('POSITION', 'N/A'),
                        'department': org_data.get('DEPARTMENT', 'N/A'),
                        'manager_id': org_data.get('MANAGER', 'N/A'),
                        'hire_date': personal_data.get('HIRE_DATE', 'N/A'),
                        'location': org_data.get('LOCATION', 'N/A'),
                        'phone': personal_data.get('PHONE', 'N/A'),
                        'skills': 'N/A',  # SAP may have skills in a different table
                        'source': 'SAP_HR'
                    }
                    employees.append(employee)
                
                logger.info(f"Extracted {len(employees)} employees from SAP HR")
                return employees
            else:
                logger.warning("No employees found in SAP HR")
                return []
                
        except Exception as e:
            logger.error(f"Error extracting data from SAP HR: {e}")
            return []

class MicrosoftADExtractor(ERPExtractor):
    """Microsoft Active Directory data extractor"""
    
    def extract(self) -> List[Dict[str, Any]]:
        """Extract employee data from Microsoft AD"""
        logger.info("Extracting data from Microsoft AD...")
        
        try:
            # AD connection parameters
            server = Server(self.config.get('host'), get_info=ALL)
            conn = Connection(
                server,
                user=self.config.get('username'),
                password=self.config.get('password'),
                auto_bind=True
            )
            
            # Search base and filter
            search_base = self.config.get('search_base', 'DC=example,DC=com')
            search_filter = self.config.get('search_filter', '(&(objectClass=user)(objectCategory=person))')
            
            # Attributes to retrieve
            attributes = [
                'sAMAccountName', 'givenName', 'sn', 'mail', 'title', 
                'department', 'manager', 'whenCreated', 
                'physicalDeliveryOfficeName', 'telephoneNumber'
            ]
            
            # Search AD
            conn.search(
                search_base=search_base,
                search_filter=search_filter,
                attributes=attributes
            )
            
            employees = []
            
            for entry in conn.entries:
                # Convert entry to dictionary
                entry_dict = entry.entry_attributes_as_dict
                
                employee = {
                    'id': entry_dict.get('sAMAccountName', ['N/A'])[0],
                    'name': f"{entry_dict.get('sn', [''])[0]} {entry_dict.get('givenName', [''])[0]}".strip(),
                    'email': entry_dict.get('mail', ['N/A'])[0],
                    'position': entry_dict.get('title', ['N/A'])[0],
                    'department': entry_dict.get('department', ['N/A'])[0],
                    'manager_id': entry_dict.get('manager', ['N/A'])[0],
                    'hire_date': entry_dict.get('whenCreated', ['N/A'])[0],
                    'location': entry_dict.get('physicalDeliveryOfficeName', ['N/A'])[0],
                    'phone': entry_dict.get('telephoneNumber', ['N/A'])[0],
                    'skills': 'N/A',  # AD typically doesn't store skills
                    'source': 'MICROSOFT_AD'
                }
                employees.append(employee)
            
            logger.info(f"Extracted {len(employees)} employees from Microsoft AD")
            return employees
                
        except Exception as e:
            logger.error(f"Error extracting data from Microsoft AD: {e}")
            return []

class OracleExtractor(ERPExtractor):
    """Oracle ERP data extractor"""
    
    def extract(self) -> List[Dict[str, Any]]:
        """Extract employee data from Oracle ERP"""
        logger.info("Extracting data from Oracle ERP...")
        
        try:
            # Oracle connection string
            dsn = cx_Oracle.makedsn(
                self.config.get('host'),
                self.config.get('port', 1521),
                service_name=self.config.get('service_name')
            )
            
            conn = cx_Oracle.connect(
                user=self.config.get('username'),
                password=self.config.get('password'),
                dsn=dsn
            )
            
            cursor = conn.cursor()
            
            # Query to get employee data
            query = """
            SELECT 
                e.employee_id,
                e.first_name || ' ' || e.last_name as full_name,
                e.email,
                j.job_title,
                d.department_name,
                e.manager_id,
                e.hire_date,
                l.city,
                e.phone_number,
                'N/A' as skills
            FROM 
                hr.employees e
            JOIN 
                hr.jobs j ON e.job_id = j.job_id
            JOIN 
                hr.departments d ON e.department_id = d.department_id
            JOIN 
                hr.locations l ON d.location_id = l.location_id
            """
            
            cursor.execute(query)
            
            employees = []
            for row in cursor:
                employee = {
                    'id': str(row[0]),
                    'name': row[1],
                    'email': row[2] if row[2] else 'N/A',
                    'position': row[3] if row[3] else 'N/A',
                    'department': row[4] if row[4] else 'N/A',
                    'manager_id': str(row[5]) if row[5] else 'N/A',
                    'hire_date': row[6].strftime('%Y-%m-%d') if row[6] else 'N/A',
                    'location': row[7] if row[7] else 'N/A',
                    'phone': row[8] if row[8] else 'N/A',
                    'skills': row[9],
                    'source': 'ORACLE'
                }
                employees.append(employee)
            
            cursor.close()
            conn.close()
            
            logger.info(f"Extracted {len(employees)} employees from Oracle ERP")
            return employees
                
        except Exception as e:
            logger.error(f"Error extracting data from Oracle ERP: {e}")
            return []

class PeopleSoftExtractor(ERPExtractor):
    """PeopleSoft ERP data extractor"""
    
    def extract(self) -> List[Dict[str, Any]]:
        """Extract employee data from PeopleSoft"""
        logger.info("Extracting data from PeopleSoft...")
        
        try:
            # PeopleSoft typically uses Oracle as its database
            dsn = cx_Oracle.makedsn(
                self.config.get('host'),
                self.config.get('port', 1521),
                service_name=self.config.get('service_name')
            )
            
            conn = cx_Oracle.connect(
                user=self.config.get('username'),
                password=self.config.get('password'),
                dsn=dsn
            )
            
            cursor = conn.cursor()
            
            # Query to get employee data from PeopleSoft
            query = """
            SELECT 
                p.emplid,
                p.name,
                p.email_addr,
                j.descr as job_title,
                d.descr as department,
                p.supervisor_id,
                p.hire_dt,
                l.location,
                p.phone,
                'N/A' as skills
            FROM 
                ps_personal_data p
            JOIN 
                ps_job j ON p.emplid = j.emplid AND j.effdt = 
                    (SELECT MAX(effdt) FROM ps_job WHERE emplid = p.emplid AND effdt <= SYSDATE)
            JOIN 
                ps_dept_tbl d ON j.deptid = d.deptid AND d.effdt = 
                    (SELECT MAX(effdt) FROM ps_dept_tbl WHERE deptid = j.deptid AND effdt <= SYSDATE)
            JOIN 
                ps_location_tbl l ON j.location = l.location AND l.effdt = 
                    (SELECT MAX(effdt) FROM ps_location_tbl WHERE location = j.location AND effdt <= SYSDATE)
            WHERE 
                p.effdt = (SELECT MAX(effdt) FROM ps_personal_data WHERE emplid = p.emplid AND effdt <= SYSDATE)
            """
            
            cursor.execute(query)
            
            employees = []
            for row in cursor:
                employee = {
                    'id': row[0],
                    'name': row[1],
                    'email': row[2] if row[2] else 'N/A',
                    'position': row[3] if row[3] else 'N/A',
                    'department': row[4] if row[4] else 'N/A',
                    'manager_id': row[5] if row[5] else 'N/A',
                    'hire_date': row[6].strftime('%Y-%m-%d') if row[6] else 'N/A',
                    'location': row[7] if row[7] else 'N/A',
                    'phone': row[8] if row[8] else 'N/A',
                    'skills': row[9],
                    'source': 'PEOPLESOFT'
                }
                employees.append(employee)
            
            cursor.close()
            conn.close()
            
            logger.info(f"Extracted {len(employees)} employees from PeopleSoft")
            return employees
                
        except Exception as e:
            logger.error(f"Error extracting data from PeopleSoft: {e}")
            return []

class WorkdayExtractor(ERPExtractor):
    """Workday API data extractor"""
    
    def extract(self) -> List[Dict[str, Any]]:
        """Extract employee data from Workday"""
        logger.info("Extracting data from Workday...")
        
        try:
            # Workday API connection details
            tenant_url = self.config.get('host')
            api_version = self.config.get('api_version', 'v35.0')
            tenant = self.config.get('tenant')
            client_id = self.config.get('client_id')
            client_secret = self.config.get('client_secret')
            
            # Authenticate with Workday API
            auth_url = f"{tenant_url}/ccx/oauth2/{tenant}/token"
            auth_response = requests.post(
                auth_url,
                data={
                    'grant_type': 'client_credentials',
                    'client_id': client_id,
                    'client_secret': client_secret
                }
            )
            
            if auth_response.status_code != 200:
                logger.error(f"Failed to authenticate with Workday API: {auth_response.text}")
                return []
            
            access_token = auth_response.json().get('access_token')
            
            # Get workers data
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            workers_url = f"{tenant_url}/api/{api_version}/data/workers"
            workers_response = requests.get(workers_url, headers=headers)
            
            if workers_response.status_code != 200:
                logger.error(f"Failed to get workers from Workday API: {workers_response.text}")
                return []
            
            workers_data = workers_response.json()
            
            employees = []
            for worker in workers_data.get('data', {}).get('data', []):
                # Extract employee data from Workday response
                personal_data = worker.get('personalData', {})
                job_data = worker.get('jobData', {})
                
                employee = {
                    'id': worker.get('workerId', 'N/A'),
                    'name': f"{personal_data.get('lastName', '')} {personal_data.get('firstName', '')}".strip(),
                    'email': personal_data.get('email', 'N/A'),
                    'position': job_data.get('positionTitle', 'N/A'),
                    'department': job_data.get('departmentName', 'N/A'),
                    'manager_id': job_data.get('managerId', 'N/A'),
                    'hire_date': job_data.get('hireDate', 'N/A'),
                    'location': job_data.get('locationName', 'N/A'),
                    'phone': personal_data.get('phone', 'N/A'),
                    'skills': 'N/A',
                    'source': 'WORKDAY'
                }
                employees.append(employee)
            
            logger.info(f"Extracted {len(employees)} employees from Workday")
            return employees
                
        except Exception as e:
            logger.error(f"Error extracting data from Workday: {e}")
            return []

def main():
    """Main function to handle CLI arguments and run the extraction"""
    parser = argparse.ArgumentParser(description="ERP Data Extraction Tool")
    parser.add_argument("--config", type=str, help="Path to configuration JSON file")
    parser.add_argument("--type", type=str, choices=["SAP_HR", "MICROSOFT_AD", "ORACLE", "PEOPLESOFT", "WORKDAY"],
                         help="ERP system type")
    parser.add_argument("--host", type=str, help="ERP system host address")
    parser.add_argument("--port", type=str, help="ERP system port")
    parser.add_argument("--username", type=str, help="ERP system username")
    parser.add_argument("--password", type=str, help="ERP system password")
    parser.add_argument("--database", type=str, help="Database name (if applicable)")
    parser.add_argument("--output", type=str, help="Output CSV filename")
    parser.add_argument("--mongodb_uri", type=str, help="MongoDB connection URI")
    
    args = parser.parse_args()
    
    # Load configuration
    config = {}
    if args.config:
        try:
            with open(args.config, 'r') as f:
                config = json.load(f)
        except Exception as e:
            logger.error(f"Error loading configuration: {e}")
            sys.exit(1)
    
    # Override config with command line args
    if args.type:
        config["type"] = args.type
    if args.host:
        config["host"] = args.host
    if args.port:
        config["port"] = args.port
    if args.username:
        config["username"] = args.username
    if args.password:
        config["password"] = args.password
    if args.database:
        config["database"] = args.database
    if args.output:
        config["output_csv"] = args.output
    if args.mongodb_uri:
        config["mongodb_uri"] = args.mongodb_uri
    
    # Check required config parameters
    if "type" not in config:
        logger.error("ERP system type not specified")
        sys.exit(1)
    
    if "host" not in config:
        logger.error("ERP system host not specified")
        sys.exit(1)
    
    # Create extractor based on ERP type
    extractor = None
    erp_type = config["type"]
    
    if erp_type == "SAP_HR":
        extractor = SAPExtractor(config)
    elif erp_type == "MICROSOFT_AD":
        extractor = MicrosoftADExtractor(config)
    elif erp_type == "ORACLE":
        extractor = OracleExtractor(config)
    elif erp_type == "PEOPLESOFT":
        extractor = PeopleSoftExtractor(config)
    elif erp_type == "WORKDAY":
        extractor = WorkdayExtractor(config)
    else:
        logger.error(f"Unsupported ERP type: {erp_type}")
        sys.exit(1)
    
    # Extract data
    data = extractor.extract()
    
    if not data:
        logger.error("No data extracted from ERP system")
        sys.exit(1)
    
    # Save to CSV
    csv_file = extractor.save_to_csv(data)
    if not csv_file:
        logger.error("Failed to save data to CSV")
    
    # Save to MongoDB
    if extractor.save_to_mongodb(data):
        logger.info("ERP data extraction and storage complete")
    else:
        logger.error("Failed to save data to MongoDB")
        sys.exit(1)

if __name__ == "__main__":
    main() 
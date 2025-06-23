#!/usr/bin/env python3
import os
import logging
import json
import requests
from dotenv import load_dotenv
from urllib.parse import urlparse, quote_plus

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Load environment variables
load_dotenv('.env.local', override=True)
load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DATABASE") or os.getenv("MONGODB_DB_NAME") or "org_sim_db"
COLLECTION_NAME = "merged_output"
ATLAS_API_KEY = os.getenv("ATLAS_API_PUBLIC_KEY")
ATLAS_API_SECRET = os.getenv("ATLAS_API_PRIVATE_KEY")
ATLAS_GROUP_ID = os.getenv("ATLAS_GROUP_ID")  # Also known as Project ID
ATLAS_CLUSTER_NAME = os.getenv("ATLAS_CLUSTER_NAME")

# Default dynamic search index definition
DEFAULT_INDEX_DEFINITION = {
    "name": "default",
    "searchAnalyzer": "lucene.standard",
    "analyzer": "lucene.standard",
    "collectionName": COLLECTION_NAME,
    "database": DB_NAME,
    "mappings": {
        "dynamic": True,
        "fields": {
            "email": {
                "type": "string",
                "analyzer": "lucene.standard"
            },
            "name": {
                "type": "string",
                "analyzer": "lucene.standard" 
            },
            "firstName": {
                "type": "string",
                "analyzer": "lucene.standard"
            },
            "lastName": {
                "type": "string",
                "analyzer": "lucene.standard"
            },
            "job_title": {
                "type": "string",
                "analyzer": "lucene.standard"
            },
            "department": {
                "type": "string",
                "analyzer": "lucene.standard"
            },
            "projects": {
                "type": "document",
                "fields": {
                    "project_title": {
                        "type": "string",
                        "analyzer": "lucene.standard"
                    },
                    "project_description": {
                        "type": "string", 
                        "analyzer": "lucene.standard"
                    },
                    "project_status": {
                        "type": "string",
                        "analyzer": "lucene.standard"
                    },
                    "project_tech_stack": {
                        "type": "string",
                        "analyzer": "lucene.standard"
                    }
                }
            },
            "job_duties.duty": {
                "type": "string",
                "analyzer": "lucene.standard"
            },
            "responsibilities": {
                "type": "string",
                "analyzer": "lucene.standard"
            }
        }
    }
}

def extract_cluster_info_from_uri(uri):
    """Extract Atlas cluster information from MongoDB URI."""
    if not uri or "mongodb+srv" not in uri:
        logging.error("Not a valid Atlas URI or not using mongodb+srv protocol")
        return None, None
    
    try:
        parsed = urlparse(uri)
        hostname = parsed.netloc
        
        # The hostname format is: cluster-name.something.mongodb.net
        cluster_name = hostname.split('.')[0]
        
        return cluster_name, hostname
    except Exception as e:
        logging.error(f"Error parsing MongoDB URI: {e}")
        return None, None

def get_api_credentials():
    """Get or prompt for Atlas API credentials."""
    api_key = ATLAS_API_KEY
    api_secret = ATLAS_API_SECRET
    project_id = ATLAS_GROUP_ID
    cluster_name = ATLAS_CLUSTER_NAME
    
    # If credentials are missing, try to extract from URI
    if not cluster_name:
        extracted_cluster, hostname = extract_cluster_info_from_uri(MONGO_URI)
        if extracted_cluster:
            cluster_name = extracted_cluster
            logging.info(f"Extracted cluster name from URI: {cluster_name}")
        
    if not all([api_key, api_secret, project_id, cluster_name]):
        logging.warning("Some Atlas API credentials are missing.")
        logging.info("\nTo create an Atlas Search index, you need the following:")
        logging.info("1. Atlas API Public Key & Private Key")
        logging.info("2. Atlas Project ID (also called Group ID)")
        logging.info("3. Atlas Cluster Name")
        logging.info("\nYou can get these from the Atlas UI under:")
        logging.info("- API Keys: Project Settings > Access > API Keys")
        logging.info("- Project ID: Project Settings > Project ID")
        logging.info("- Cluster Name: Deployment > Database > cluster name (e.g., 'Cluster0')")
        
        if not api_key:
            api_key = input("Enter your Atlas API Public Key: ").strip()
        if not api_secret:
            api_secret = input("Enter your Atlas API Private Key: ").strip()
        if not project_id:
            project_id = input("Enter your Atlas Project/Group ID: ").strip()
        if not cluster_name:
            cluster_name = input("Enter your Atlas Cluster Name: ").strip()
    
    return {
        "api_key": api_key,
        "api_secret": api_secret,
        "project_id": project_id,
        "cluster_name": cluster_name
    }

def create_atlas_search_index(credentials, index_definition=None):
    """Create an Atlas Search index using the Atlas API."""
    if index_definition is None:
        index_definition = DEFAULT_INDEX_DEFINITION
    
    api_key = credentials["api_key"]
    api_secret = credentials["api_secret"]
    project_id = credentials["project_id"]
    cluster_name = credentials["cluster_name"]
    
    # Atlas API endpoint for search indexes
    url = f"https://cloud.mongodb.com/api/atlas/v1.0/groups/{project_id}/clusters/{cluster_name}/fts/indexes"
    
    # Make API request
    try:
        response = requests.post(
            url,
            auth=(api_key, api_secret),
            json=index_definition,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 201:
            logging.info(f"Successfully created Atlas Search index '{index_definition['name']}'")
            return True
        else:
            logging.error(f"Failed to create index. Status code: {response.status_code}")
            logging.error(f"Response: {response.text}")
            return False
    except Exception as e:
        logging.error(f"Exception during API request: {e}")
        return False

def list_existing_indexes(credentials):
    """List existing Atlas Search indexes."""
    api_key = credentials["api_key"]
    api_secret = credentials["api_secret"]
    project_id = credentials["project_id"]
    cluster_name = credentials["cluster_name"]
    
    # Atlas API endpoint for listing search indexes
    url = f"https://cloud.mongodb.com/api/atlas/v1.0/groups/{project_id}/clusters/{cluster_name}/fts/indexes"
    
    try:
        response = requests.get(
            url,
            auth=(api_key, api_secret)
        )
        
        if response.status_code == 200:
            indexes = response.json()
            if not indexes:
                logging.info("No Atlas Search indexes found.")
                return []
            
            logging.info(f"Found {len(indexes)} Atlas Search indexes:")
            for idx in indexes:
                status = idx.get("status", "unknown")
                name = idx.get("name", "unnamed")
                collection = idx.get("collectionName", "unknown")
                database = idx.get("database", "unknown")
                logging.info(f"- {name} (Collection: {database}.{collection}, Status: {status})")
            
            return indexes
        else:
            logging.error(f"Failed to list indexes. Status code: {response.status_code}")
            logging.error(f"Response: {response.text}")
            return []
    except Exception as e:
        logging.error(f"Exception listing indexes: {e}")
        return []

def main():
    logging.info("Atlas Search Index Setup Utility")
    logging.info("-------------------------------")
    
    # Get API credentials
    credentials = get_api_credentials()
    if not all(credentials.values()):
        logging.error("Missing required Atlas API credentials. Exiting.")
        return
    
    # List existing indexes
    existing_indexes = list_existing_indexes(credentials)
    
    # Check if our target index already exists
    default_index_exists = any(idx.get("name") == "default" for idx in existing_indexes)
    
    if default_index_exists:
        logging.info("The 'default' Atlas Search index already exists.")
        choice = input("Do you want to create another index? (y/n): ").strip().lower()
        if choice != 'y':
            logging.info("Exiting without creating a new index.")
            return
    
    # Create a new index
    logging.info("Creating a new Atlas Search index...")
    
    # You can customize the index definition here
    create_atlas_search_index(credentials)

if __name__ == "__main__":
    main() 
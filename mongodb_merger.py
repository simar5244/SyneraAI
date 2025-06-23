#!/usr/bin/env python3
"""
MongoDB Integration Data Merger

This script continuously monitors company databases for changes in the 'integrations' collection
and merges that data into the 'users' collection by matching company email fields.

It runs as a standalone process and is automatically started with npm run dev/start.
"""

import os
import sys
import time
import signal
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
import pymongo
from pymongo import MongoClient
from pymongo.errors import PyMongoError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("mongodb_merger.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("mongodb_merger")

# MongoDB Configuration
MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
COMPANY_DB_PREFIX = "company_"

# Global variables
client = None
change_streams = {}
is_running = False
poll_interval = None

def merge_integration_data_to_users(company_code: str) -> Dict[str, Any]:
    """
    Merge integration data to users collection for a specific company
    
    Args:
        company_code: The company code
        
    Returns:
        Dict with success status, stats, and message
    """
    temp_client = None
    
    try:
        # Validate inputs
        normalized_company_code = (company_code or "").strip().lower()
        
        if not normalized_company_code:
            raise ValueError("Company code is required")
        
        if not MONGODB_URI:
            raise ValueError("MongoDB URI is not configured")
        
        logger.info(f"[Integration Merger] Starting merge for company: {normalized_company_code}")
        
        # Connect to MongoDB if not using global client
        if client is None:
            temp_client = MongoClient(MONGODB_URI)
            use_client = temp_client
        else:
            use_client = client
        
        # Use company-specific database to ensure tenant isolation
        db_name = f"{COMPANY_DB_PREFIX}{normalized_company_code}"
        db = use_client[db_name]
        
        # Access collections within this company's database only
        integrations_collection = db["integrations"]
        users_collection = db["users"]
        
        # Find all integration records with email that haven't been merged yet
        query = {
            "email": {"$exists": True, "$ne": None},
            "merged": {"$ne": True}
        }
        
        integration_records = list(integrations_collection.find(query))
        
        if not integration_records:
            logger.info(f"[Integration Merger] No new integration records for company {normalized_company_code}")
            return {
                "success": True,
                "stats": {"total": 0, "matched": 0, "updated": 0, "errors": 0, "skipped": 0},
                "message": "No new integration records to process"
            }
        
        logger.info(f"[Integration Merger] Found {len(integration_records)} records to process for company {normalized_company_code}")
        
        # Track statistics
        stats = {
            "total": len(integration_records),
            "matched": 0,
            "updated": 0,
            "errors": 0,
            "skipped": 0
        }
        
        # Process each record
        for record in integration_records:
            email = record.get("email", "")
            if isinstance(email, str):
                email = email.lower().strip()
            
            if not email:
                stats["skipped"] += 1
                continue
            
            try:
                # Find matching user within the same company database by email
                user = users_collection.find_one({"email": email})
                
                if not user:
                    logger.info(f"[Integration Merger] No user found with email: {email} in company {normalized_company_code}")
                    stats["skipped"] += 1
                    continue
                
                stats["matched"] += 1
                
                # Prepare update data (exclude special fields and metadata)
                update_data = {}
                excluded_fields = ["_id", "email", "password", "role", "uploader", "uploadedAt", 
                                 "status", "merged", "mergedAt", "createdAt", "updatedAt"]
                
                for key, value in record.items():
                    if key not in excluded_fields and value is not None:
                        update_data[key] = value
                
                if not update_data:
                    logger.info(f"[Integration Merger] No fields to update for user {email}")
                    stats["skipped"] += 1
                    continue
                
                # Update the user record with fields from integration data
                # Using $set to add or update fields in user record
                update_result = users_collection.update_one(
                    {"_id": user["_id"]},
                    {"$set": update_data}
                )
                
                if update_result.modified_count > 0:
                    stats["updated"] += 1
                    logger.info(f"[Integration Merger] Updated user {email} with integration data")
                else:
                    logger.info(f"[Integration Merger] No changes made to user {email}")
                
                # Mark integration record as merged
                integrations_collection.update_one(
                    {"_id": record["_id"]},
                    {
                        "$set": {
                            "merged": True,
                            "mergedAt": datetime.now(),
                            "mergedTo": str(user["_id"])
                        }
                    }
                )
                
            except Exception as e:
                logger.error(f"[Integration Merger] Error updating user {email} in company {normalized_company_code}: {e}")
                stats["errors"] += 1
        
        # Log results
        logger.info(f"[Integration Merger] Merge completed for company: {normalized_company_code}")
        logger.info(f"Total: {stats['total']}, Matched: {stats['matched']}, Updated: {stats['updated']}, "
                  f"Skipped: {stats['skipped']}, Errors: {stats['errors']}")
        
        return {
            "success": True,
            "stats": stats,
            "message": f"Successfully merged {stats['updated']} integration records for company {normalized_company_code}"
        }
        
    except Exception as e:
        logger.error(f"[Integration Merger] Error merging data for company {company_code}: {e}")
        return {
            "success": False,
            "message": "Failed to merge integration data",
            "error": str(e)
        }
    finally:
        # Only close the connection if we created a temporary client
        if temp_client:
            temp_client.close()

def watch_company_integrations(company_code: str) -> None:
    """
    Watch for changes in a specific company's integrations collection
    
    Args:
        company_code: The company code
    """
    global change_streams
    
    if client is None:
        raise ValueError("MongoDB client not initialized")
    
    # Skip if already watching this company
    if company_code in change_streams:
        return
    
    db_name = f"{COMPANY_DB_PREFIX}{company_code}"
    db = client[db_name]
    collection = db["integrations"]
    
    logger.info(f"Setting up change stream for {db_name}.integrations")
    
    try:
        # Create a change stream to watch for new documents or changes
        change_stream = collection.watch(
            [{"$match": {"operationType": {"$in": ["insert", "update"]}}}],
            full_document="updateLookup"
        )
        
        # Store the change stream
        change_streams[company_code] = {
            "stream": change_stream,
            "thread": None
        }
        
        # Start a background thread to monitor this change stream
        def monitor_stream():
            try:
                for change in change_stream:
                    if not is_running:
                        break
                    
                    if change["operationType"] in ["insert", "update"]:
                        logger.info(f"[{datetime.now().isoformat()}] Detected change in {db_name}.integrations")
                        
                        # Check if the affected document has an email and hasn't been merged
                        doc = change.get("fullDocument", {})
                        if doc and "email" in doc and doc.get("merged") is not True:
                            try:
                                # Process the merge for this company only
                                merge_integration_data_to_users(company_code)
                            except Exception as e:
                                logger.error(f"Error processing automatic merge for {company_code}: {e}")
            except PyMongoError as e:
                logger.error(f"Error in change stream for {db_name}.integrations: {e}")
                
                # Try to recover by recreating the change stream after a delay
                if is_running:
                    logger.info(f"Will try to reconnect change stream for {company_code} in 5 seconds")
                    time.sleep(5)
                    watch_company_integrations(company_code)
        
        # Start monitoring in the same thread for simplicity in Python
        # In a production environment, consider using threading or asyncio
        if is_running:
            monitor_stream()
        
        logger.info(f"Change stream active for {db_name}.integrations")
    except Exception as e:
        logger.error(f"Error setting up change stream for {db_name}: {e}")

def watch_for_new_companies() -> None:
    """
    Periodically check for new company databases
    """
    global poll_interval
    
    def check_new_companies():
        if client is None or not is_running:
            return
        
        try:
            # Get current list of company databases
            dbs = client.list_database_names()
            company_dbs = [db[len(COMPANY_DB_PREFIX):] for db in dbs if db.startswith(COMPANY_DB_PREFIX)]
            
            # Check for any companies we're not already monitoring
            for company_code in company_dbs:
                if company_code not in change_streams:
                    logger.info(f"Discovered new company database: {company_code}")
                    
                    # Check if integrations collection exists
                    db = client[f"{COMPANY_DB_PREFIX}{company_code}"]
                    if "integrations" in db.list_collection_names():
                        # Process any existing data first
                        merge_integration_data_to_users(company_code)
                        
                        # Then set up the watcher
                        watch_company_integrations(company_code)
        except Exception as e:
            logger.error(f"Error checking for new company databases: {e}")
    
    # Run immediately for the first time
    check_new_companies()
    
    # Then set up regular interval
    while is_running:
        time.sleep(30)  # Check every 30 seconds
        check_new_companies()

def scheduled_merge_all() -> None:
    """
    Regularly process all companies to make sure none are missed
    """
    if client is None or not is_running:
        return
    
    try:
        logger.info("[Scheduled Merge] Running scheduled merge for all companies")
        
        # Get all company databases
        dbs = client.list_database_names()
        company_dbs = [db[len(COMPANY_DB_PREFIX):] for db in dbs if db.startswith(COMPANY_DB_PREFIX)]
        
        # Process each company
        for company_code in company_dbs:
            try:
                merge_integration_data_to_users(company_code)
            except Exception as e:
                logger.error(f"Error in scheduled merge for {company_code}: {e}")
        
        logger.info("[Scheduled Merge] Completed scheduled merge for all companies")
    except Exception as e:
        logger.error(f"Error in scheduled merge all: {e}")

def start() -> None:
    """
    Start the integration data merger service
    """
    global client, is_running
    
    if is_running:
        logger.info("Integration data merger is already running")
        return
    
    if not MONGODB_URI:
        raise ValueError("MongoDB URI is not configured")
    
    try:
        # Connect to MongoDB
        client = MongoClient(MONGODB_URI)
        logger.info("Integration data merger connected to MongoDB")
        
        # Find all company databases
        dbs = client.list_database_names()
        company_dbs = [db[len(COMPANY_DB_PREFIX):] for db in dbs if db.startswith(COMPANY_DB_PREFIX)]
        
        logger.info(f"Found {len(company_dbs)} company databases to monitor")
        
        # Set is_running before starting watchers
        is_running = True
        
        # Set up watchers for each company database
        for db_name in [f"{COMPANY_DB_PREFIX}{code}" for code in company_dbs]:
            company_code = db_name[len(COMPANY_DB_PREFIX):]
            
            # Check if the integrations collection exists
            db = client[db_name]
            if "integrations" in db.list_collection_names():
                # Process any existing unmerged data first
                merge_integration_data_to_users(company_code)
                
                # Then set up the watcher
                watch_company_integrations(company_code)
        
        # Start watcher for new databases
        import threading
        watcher_thread = threading.Thread(target=watch_for_new_companies)
        watcher_thread.daemon = True
        watcher_thread.start()
        
        # Schedule regular complete merges every 5 minutes
        def scheduled_merge_thread():
            while is_running:
                time.sleep(300)  # 5 minutes
                if is_running:
                    scheduled_merge_all()
        
        merge_thread = threading.Thread(target=scheduled_merge_thread)
        merge_thread.daemon = True
        merge_thread.start()
        
        logger.info("Integration data merger started successfully")
        
    except Exception as e:
        logger.error(f"Error starting integration data merger: {e}")
        is_running = False
        shutdown()
        raise

def shutdown() -> None:
    """
    Shutdown the merger service
    """
    global client, change_streams, is_running
    
    try:
        # Set running flag to false to stop threads
        is_running = False
        
        # Close all change streams
        for company_code, stream_info in change_streams.items():
            try:
                logger.info(f"Closing change stream for company {company_code}")
                stream_info["stream"].close()
            except Exception as e:
                logger.error(f"Error closing change stream for {company_code}: {e}")
        
        # Clear the dict
        change_streams = {}
        
        # Close the MongoDB connection
        if client:
            client.close()
            client = None
        
        logger.info("Integration data merger shut down")
    except Exception as e:
        logger.error(f"Error during integration data merger shutdown: {e}")

def setup_signal_handlers() -> None:
    """
    Handle process termination signals
    """
    def signal_handler(sig, frame):
        logger.info(f"Signal {sig} received, shutting down Integration Data Merger service...")
        shutdown()
        sys.exit(0)
    
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

def main() -> None:
    """
    Main function
    """
    logger.info("Starting Integration Data Merger service...")
    
    # Set up signal handlers
    setup_signal_handlers()
    
    try:
        # Start the service
        start()
        
        logger.info("Integration Data Merger service is running continuously.")
        logger.info("Press Ctrl+C to stop the service.")
        
        # Keep the process running
        while is_running:
            time.sleep(60)
        
    except Exception as e:
        logger.error(f"Fatal error in Integration Data Merger service: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
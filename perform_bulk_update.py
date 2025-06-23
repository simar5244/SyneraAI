def perform_bulk_update(operations):
    """Execute bulk update operations"""
    if not operations:
        return
        
    try:
        # Group operations by collection
        merged_ops = [op for op in operations if op._filter.get("_id") is not None]
        users_ops = [op for op in operations if op._filter.get("email") is not None and op._filter.get("_id") is None]
        
        # Convert NumPy values to native Python types for MongoDB compatibility
        for op in merged_ops + users_ops:
            if hasattr(op, '_update') and op._update:
                op._update = convert_numpy_to_python(op._update)
        
        # Process merged_output operations
        if merged_ops:
            try:
                result = db[OUTPUT_COLLECTION].bulk_write(merged_ops, ordered=False)
                logging.info(f"Bulk update to {OUTPUT_COLLECTION} completed: {result.modified_count} documents modified")
            except Exception as e:
                logging.error(f"Error during bulk update on {OUTPUT_COLLECTION}: {e}")
                # Try one-by-one to identify problematic documents
                for op in merged_ops:
                    try:
                        db[OUTPUT_COLLECTION].update_one(
                            op._filter, 
                            op._update, 
                            upsert=op._upsert
                        )
                    except Exception as inner_e:
                        logging.error(f"Failed to update document: {op._filter} with error: {inner_e}")
        
        # Process users operations
        if users_ops:
            try:
                result = db[USERS_COLLECTION].bulk_write(users_ops, ordered=False)
                logging.info(f"Bulk update to {USERS_COLLECTION} completed: {result.modified_count} documents modified")
            except Exception as e:
                logging.error(f"Error during bulk update on {USERS_COLLECTION}: {e}")
                # Try one-by-one
                for op in users_ops:
                    try:
                        db[USERS_COLLECTION].update_one(
                            op._filter, 
                            op._update, 
                            upsert=op._upsert
                        )
                    except Exception as inner_e:
                        logging.error(f"Failed to update user document: {op._filter} with error: {inner_e}")
            
    except Exception as e:
        logging.error(f"Error during bulk update: {e}") 
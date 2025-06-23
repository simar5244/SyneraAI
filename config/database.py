from flask_mongoengine import MongoEngine
import logging

# Initialize the MongoDB engine
db = MongoEngine()

def initialize_db(app):
    """Initialize the MongoDB connection with the Flask app"""
    try:
        db.init_app(app)
        logging.info("Successfully connected to MongoDB")
    except Exception as e:
        logging.error(f"Failed to connect to MongoDB: {str(e)}")
        raise e 
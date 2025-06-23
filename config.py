#THIS IS A BACKUP SCRIPT FOR THE ERP BACKEND. AVOID USING IT. USE @ERPBACKEND.PY INSTEAD.
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Base configuration."""
    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'default-dev-key-change-in-production')
    FLASK_APP = os.getenv('FLASK_APP', 'app.py')
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    
    # MongoDB
    MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/orgvision')
    
    # Application settings
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'logs/app.log')
    
    # NLTK configuration
    NLTK_DATA = os.getenv('NLTK_DATA', None)
    
    # API Configuration
    API_PREFIX = '/api'
    
    # ERP Integration Settings (empty by default)
    ERP_INTEGRATIONS = {
        'sap': {
            'enabled': os.getenv('SAP_HR_URL', '') != '',
            'url': os.getenv('SAP_HR_URL', ''),
            'username': os.getenv('SAP_HR_USERNAME', ''),
            'password': os.getenv('SAP_HR_PASSWORD', '')
        },
        'oracle': {
            'enabled': os.getenv('ORACLE_HR_CONNECTION_STRING', '') != '',
            'connection_string': os.getenv('ORACLE_HR_CONNECTION_STRING', ''),
            'username': os.getenv('ORACLE_HR_USERNAME', ''),
            'password': os.getenv('ORACLE_HR_PASSWORD', '')
        },
        'active_directory': {
            'enabled': os.getenv('AD_SERVER', '') != '',
            'server': os.getenv('AD_SERVER', ''),
            'username': os.getenv('AD_USERNAME', ''),
            'password': os.getenv('AD_PASSWORD', ''),
            'domain': os.getenv('AD_DOMAIN', '')
        },
        'peoplesoft': {
            'enabled': os.getenv('PEOPLESOFT_URL', '') != '',
            'url': os.getenv('PEOPLESOFT_URL', ''),
            'username': os.getenv('PEOPLESOFT_USERNAME', ''),
            'password': os.getenv('PEOPLESOFT_PASSWORD', '')
        },
        'workday': {
            'enabled': os.getenv('WORKDAY_API_URL', '') != '',
            'api_url': os.getenv('WORKDAY_API_URL', ''),
            'api_key': os.getenv('WORKDAY_API_KEY', ''),
            'tenant_id': os.getenv('WORKDAY_TENANT_ID', '')
        }
    }

class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    TESTING = False

class TestingConfig(Config):
    """Testing configuration."""
    DEBUG = False
    TESTING = True
    MONGODB_URI = os.getenv('TEST_MONGODB_URI', 'mongodb://localhost:27017/orgvision_test')

class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    TESTING = False
    SECRET_KEY = os.getenv('SECRET_KEY')  # Must be set in production
    # Use a robust configuration for production settings
    MONGODB_URI = os.getenv('MONGODB_URI')  # Must be set in production
    
    # Override logging for production
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'ERROR')  # Higher threshold for production
    
    # Disable all mock services in production
    USE_MOCK_DATA = False

# Export configurations
config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}

# Get the current config based on environment variable or default to development
def get_config():
    env = os.getenv('FLASK_ENV', 'development')
    return config.get(env, config['default']) 
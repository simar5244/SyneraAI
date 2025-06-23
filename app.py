from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
from config.database import initialize_db
from routes.employee_routes import employee_blueprint
from routes.project_routes import project_blueprint
from routes.analytics_routes import analytics_blueprint
from routes.search_routes import search_blueprint
from routes.hr_routes import hr_blueprint
from routes.simulation_routes import simulation_blueprint

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure MongoDB
app.config['MONGODB_SETTINGS'] = {
    'host': os.getenv('MONGODB_URI', 'mongodb://localhost:27017/orgvision')
}

# Initialize database connection
initialize_db(app)

# Register blueprints
app.register_blueprint(employee_blueprint, url_prefix='/api/employees')
app.register_blueprint(project_blueprint, url_prefix='/api/projects')
app.register_blueprint(analytics_blueprint, url_prefix='/api/analytics')
app.register_blueprint(search_blueprint, url_prefix='/api/search')
app.register_blueprint(hr_blueprint, url_prefix='/api/hr')
app.register_blueprint(simulation_blueprint, url_prefix='/api/simulation')

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true') 
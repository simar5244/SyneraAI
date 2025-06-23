# 3D Organization Galaxy Visualization

This feature provides a 3D visualization of your organization structure, representing departments as "suns" and employees as "planets" orbiting around them. Collaboration projects are shown as connections between employees.

## Features

- Interactive 3D galaxy visualization
- Departments represented as large glowing suns
- Employees represented as smaller planets orbiting around their respective departments
- Employee hierarchies shown with translucent lines
- Project collaborations displayed as connections between employees
- Hover over employees to see basic details (name and department)
- Click on employees to see more detailed information
- Click on collaboration lines to see project details
- Search for employees by name
- Filter employees by department
- Full-screen mode for immersive viewing

## Backend Setup

The visualization uses a Python FastAPI backend to fetch data from MongoDB and serve it to the frontend.

### Prerequisites

- Python 3.7+
- MongoDB
- Node.js 14+
- npm or yarn

### Setting Up the Backend

1. Install MongoDB if you don't have it already
   ```
   # macOS (with Homebrew)
   brew install mongodb-community
   
   # Ubuntu
   sudo apt update
   sudo apt install mongodb
   ```

2. Install Python dependencies
   ```
   pip install -r requirements.txt
   ```

3. Start the backend server with mock data
   ```
   # Using the provided script (for Unix/macOS)
   chmod +x start_galaxy_backend.sh
   ./start_galaxy_backend.sh
   
   # OR manually
   python run_galaxy_backend.py --load-mock-data
   ```

   This will load the sample data from:
   - `mock_organization_large.csv` - Organization structure
   - `mock_projects_collaborations.csv` - Project collaborations

4. The backend API will be available at:
   - Galaxy data: http://localhost:8000/api/galaxy/data
   - Employee details: http://localhost:8000/api/galaxy/employee/{employee_id}
   - Search: http://localhost:8000/api/galaxy/search?q={query}
   - Department filter: http://localhost:8000/api/galaxy/department/{department}

## Frontend Setup

1. Install frontend dependencies
   ```
   npm install
   ```

2. Start the development server
   ```
   npm run dev
   ```

3. Navigate to http://localhost:3000/visualization/galaxy to view the visualization

## Using the Visualization

1. Click "Enter Full Screen View" to see the galaxy in immersive mode
2. Use mouse to rotate and zoom the galaxy:
   - Left-click and drag to rotate
   - Scroll to zoom in/out
3. Hover over planets (employees) to see basic information
4. Click on planets to see detailed information
5. Hover over lines between planets to see collaboration details
6. Use the search box to find specific employees
7. Use the department filters to focus on specific departments
8. Click "Exit Full Screen" to return to normal view

## Customizing the Visualization

The visualization appearance can be customized in:
- `src/components/GalaxyVisualization.tsx` - Main visualization component
- `src/api/galaxy/data.py` - Backend data processing

### Customization options:

- Sun (department) colors: Line 77 in data.py
- Planet (employee) colors: Line 89 in data.py
- Galaxy background: GalaxyVisualization.tsx Stars component
- Node sizes and glow effects: NodeObject component in GalaxyVisualization.tsx

## Connecting to Real Data

To connect to your real organizational data instead of mock data:

1. Set up the MongoDB connection string in an environment variable
   ```
   export MONGODB_URI="mongodb://username:password@your-mongodb-host:port/database"
   ```

2. Import your own organization data into MongoDB collections:
   - `employees` collection for employee data
   - `collaborations` collection for project collaborations

3. Start the backend without the mock data flag
   ```
   python run_galaxy_backend.py
   ```

## Troubleshooting

- **Backend connection issues**: Ensure MongoDB is running and the connection string is correct
- **3D rendering problems**: Check that your browser supports WebGL
- **Missing data**: Verify that the CSV files are in the correct format and loaded properly
- **Performance issues**: Reduce the number of stars or decrease the complexity of the galaxy in the Stars component 
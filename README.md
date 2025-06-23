# Organization Galaxy - Workforce Management Platform

A data-driven platform for enterprise workforce optimization, talent management, and organizational insights.

## Deployment

### Prerequisites

- Docker and Docker Compose
- Node.js 18+
- MongoDB (local or cloud)
- Redis (recommended for production)

### Quick Start with Docker

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd project-name
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Start the application:
   ```bash
   chmod +x start-docker.sh
   ./start-docker.sh
   ```

4. Access the application at http://localhost:3000

### Deployment to Render.com

For detailed deployment instructions to Render.com, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. The application will be available at http://localhost:3000

## Overview

Organization Galaxy is a comprehensive workforce management system that leverages AI and data analytics to optimize:

1. **Resource Allocation & Project Support**
2. **Talent Management & Development**
3. **Succession Planning**
4. **Organizational Structure Optimization**

The platform connects to enterprise ERP systems to build a complete view of your organization's structure and project activities, turning this data into actionable insights.

## System Architecture

### Core Datasets

The platform operates on two primary datasets:

1. **ERP Dataset (Organizational Graph):**
   - Employee details (ID, name, email, title, etc.)
   - Reporting relationships (manager-employee)
   - Skills and competencies
   - Seniority and organizational levels

2. **Project Activity Dataset (Work Contribution Ledger):**
   - Project metadata (ID, title, description, tech stack)
   - Employee contributions (hours, roles, technologies used)
   - Project timelines and status

### Key Features

#### 1. Live Project Support & Workforce Allocation Assistant
- Analyzes project requirements to recommend appropriate staffing
- Identifies underutilized employees for project assignments
- Suggests technology and best practices
- Recommends personnel substitutions for overloaded employees

#### 2. Executive Intelligence Reports
- Identifies overworked and underutilized employees
- Maps domain expertise across the organization
- Provides cross-functional transfer recommendations
- Department overlap and skill distribution analysis

#### 3. Succession Planning Engine
- Identifies critical employees based on network centrality
- Suggests viable internal successors for key positions
- Highlights employees with high growth potential
- Attrition risk prediction and mitigation strategies

#### 4. OrgGPT: Internal Navigator
- Natural language search for organizational data
- Complex queries across organizational structure and project history
- Semantic understanding of roles, skills, and relationships

#### 5. Org Tokenization & Internal Economy Mapping
- Value token allocation based on contribution metrics
- Visualization of value flow across the organization
- Identification of talent mismatches and hidden talent

#### 6. AI-Powered HR Advisor
- Data-driven recommendations for promotions, raises, and role changes
- Strategic termination suggestions based on skill relevance and contribution

## Technical Implementation

### Backend (Python/Flask)
- RESTful API with MongoDB data store
- Domain-driven design with clear separation of concerns
- Comprehensive analytics and recommendation engines
- Natural language processing for search capabilities

### Prerequisites
- Python 3.8+
- MongoDB 4.4+
- NLTK and other ML libraries

## Getting Started

### Installation

1. Clone the repository:
```
git clone https://github.com/your-org/organization-galaxy.git
cd organization-galaxy
```

2. Create a virtual environment and activate it:
```
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```
pip install -r requirements.txt
```

4. Set up environment variables:
```
cp .env.example .env
# Edit .env with your MongoDB connection details
```

5. Start the server:
```
python app.py
```

### API Documentation

The API is structured around the following resources:

- `/api/employees` - Employee management endpoints
- `/api/projects` - Project management endpoints
- `/api/analytics` - Analytics and insights endpoints
- `/api/search` - OrgGPT search capabilities
- `/api/hr` - HR advisory endpoints

Detailed API documentation is available at `/api/docs` when the server is running.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

# OrgSim AI Chart

An AI-powered organizational simulator for large enterprise applications.

## Overview

This is a 2D organization chart simulator, visible only to Top Management roles. It renders a nodular organizational chart where users can be hovered, clicked, moved, or simulated for deletion. AI insights are fully integrated, with project load, responsibility parsing, skill inference, and role fitting suggestions.

## Features

- Org Structure Visualization
- Visual Stress Heatmap
- AI-Powered Suggestions
- Role & Responsibility Management
- Access Control for Top Management

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Create a `.env.local` file with your MongoDB URI and Gemini API key:
   ```
   MONGODB_URI="your_mongodb_connection_string"
   MONGODB_DB_NAME="org_sim_db"
   GEMINI_API_KEY="your_gemini_api_key"
   ```
4. Run the application:
   ```
   python main.py
   ```

## API Endpoints

### Organization Chart

- `GET /api/org-sim/chart` - Get full org chart with stress analysis
- `GET /api/org-sim/user/{user_id}/suggest-placement` - Get AI suggestions for better user placement
- `GET /api/org-sim/user/{user_id}/simulate-deletion` - Simulate user deletion with workload redistribution

### Profile Management

- `GET /api/profile/responsibilities` - Get current user's responsibilities
- `PATCH /api/profile/responsibilities` - Update user's responsibilities and auto-infer skills

### Simulations

- `POST /api/org-sim/simulations/` - Simulate organizational changes

## Demo Accounts

The system comes with demo accounts:

- Top Management with data: username `alice`, password `password`
- Top Management without data: username `bob`, password `password`
- Employee with data: username `carol`, password `password`
- Employee without data: username `dave`, password `password`

## Technologies

- Backend: FastAPI
- Database: MongoDB
- AI: Google Gemini API

# Org-Sim AI: Organization Simulation Platform

An AI-powered visualization and simulation platform for designing and optimizing organizational structures.

## Features

- **Interactive Organization Charts**: Create and edit organization charts with drag-and-drop interfaces
- **Multiple Node Types**: Define departments, roles, and people with customizable attributes
- **Smart Workload Analysis**: Automatically calculate workload and highlight overloaded nodes
- **Simulation Engine**: Test changes to your organization before implementing them
- **AI-Driven Optimization**: Get suggestions for improving your organizational structure

## Tech Stack

- **Frontend**: React, TypeScript, Material UI, D3.js
- **Visualization**: D3.js for interactive organization charts
- **Routing**: React Router for navigation between different views
- **Styling**: Material UI for responsive design and theming

## Getting Started

### Prerequisites

- Node.js 14+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/org-sim-ai.git
   cd org-sim-ai
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Project Structure

```
org-sim-ai/
├── app.tsx                   # Main App component with routing
├── index.tsx                 # Entry point
├── index.html                # HTML template
├── types.ts                  # TypeScript interfaces
├── org_chart_component.tsx   # Organization chart visualization component
├── layout_manager.tsx        # Layout management interface
├── simulation_page.tsx       # Simulation interface
├── package.json              # Project dependencies
└── README.md                 # Project documentation
```

## Usage Guide

### Creating an Organization Layout

1. Navigate to the "Organization Layouts" section
2. Click "New Layout" to create a new organizational structure
3. Add departments, roles, and people using the toolbar
4. Create connections between nodes to establish reporting relationships
5. Drag nodes to position them in the chart

### Running Simulations

1. Navigate to the "Simulation" section
2. Select an existing organization layout
3. Click "Start Simulation" to enter simulation mode
4. Make changes to the organization structure
5. Click "Run Simulation" to see the potential impact
6. Review the impact score and modified workloads
7. Apply changes if satisfied or discard them if not

## Future Enhancements

- Advanced analytics and reporting
- Team performance metrics
- Integration with HR systems
- Collaborative editing
- More complex simulation scenarios
- AI-powered organization design recommendations 
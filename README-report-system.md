# AI-Powered Automated Report Generation System

## Overview

This AI-powered automated report generation system provides comprehensive, data-driven insights through automatically generated reports. The system uses dual LLM processing – Claude for query refinement and Gemini for report generation – to create detailed executive-level reports with visualizations, actionable insights, and department-specific breakdowns.

## Features

### Advanced Report Generation
- **Comprehensive Reports**: Generates 10+ page executive-level reports with detailed analysis
- **Multiple Time Period Analysis**: Overall, year-to-date, and last-period comparisons
- **Department Breakdowns**: 2 pages dedicated to each department's metrics and insights
- **Interactive Visualizations**: Charts for all key metrics using Chart.js
- **Export Options**: PDF and Word document export functionality

### Advanced AI Integration
- **Query Refinement with Claude**: Uses Claude API to translate natural language to MongoDB queries
- **Report Generation with Gemini**: Uses Gemini API (high token limit) for final report creation
- **Schema-Aware Querying**: Automatically identifies your database schema for accurate queries
- **No Atlas Search Required**: Works without MongoDB Atlas Search or vector search capabilities

### Key Analytics
- **Employee Attrition Risk**: Tracks high-risk employees and attrition metrics
- **Utilization Scores**: Analyzes employee and team utilization scores
- **Project Tracking**: Reports on project status, timelines, and resources
- **New Duties Analysis**: Highlights changes in responsibilities and new duties
- **Complete Employee Profiles**: Detailed profiles for high-risk employees

### Scheduling and Automation
- **Flexible Scheduling**: Set custom report generation frequencies (daily, weekly, monthly, etc.)
- **Cron Integration**: Automated report generation at scheduled intervals
- **Email Notifications**: Optional notifications when reports are generated
- **Manual Triggers**: Admin panel for on-demand report generation

## Technical Architecture

The system consists of several key components:

1. **Claude Query Generator API** (`/api/llm/claude-query-generator.js`)
   - Translates natural language requests into MongoDB queries
   - Uses database schema to create accurate queries
   - No need for Atlas Search or vector search

2. **Automated Report Generator** (`/api/automated-reports/generate.js`)
   - Orchestrates the report generation process
   - Queries MongoDB database using Claude-generated queries
   - Formats and processes data for Gemini
   - Generates comprehensive reports with Gemini

3. **Cron Job Handler** (`/api/cron/run-scheduled-reports.js`)
   - Identifies reports due for generation
   - Calls the report generation API
   - Manages generation scheduling

4. **Report Scheduling Interface** (`/dashboard/your-reports`)
   - User interface for scheduling reports
   - Viewing generated reports
   - Managing report schedules

5. **Report Renderer** (`/components/ReportRenderer.tsx`)
   - Renders markdown-formatted reports
   - Displays interactive charts and visualizations

## Setup Instructions

### Prerequisites
- Node.js and npm
- MongoDB database
- Claude API key
- Gemini API key

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <project-directory>
   ```

2. Install dependencies:
   ```bash
   chmod +x install_dependencies.sh
   ./install_dependencies.sh
   ```

3. Configure environment variables in `.env.local`:
   ```
   MONGODB_URI=your_mongodb_connection_string
   MONGODB_DB_NAME=your_database_name
   CLAUDE_API_KEY=your_claude_api_key
   GEMINI_API_KEY=your_gemini_api_key
   INTERNAL_API_KEY=some_secure_random_string
   ADMIN_KEY=some_secure_admin_key
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=some_secure_random_string
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Setting Up Cron for Automated Reports

To set up a cron job for running the scheduled reports:

1. Create a cron script (e.g., `run-reports-cron.js`):
   ```javascript
   const fetch = require('node-fetch');

   async function runScheduledReports() {
     try {
       const response = await fetch('http://localhost:3000/api/cron/run-scheduled-reports', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'x-api-key': process.env.INTERNAL_API_KEY
         }
       });
       
       const result = await response.json();
       console.log('Scheduled reports execution result:', result);
     } catch (error) {
       console.error('Error running scheduled reports:', error);
     }
   }

   runScheduledReports();
   ```

2. Add a cron job to run this script (e.g., every hour):
   ```bash
   0 * * * * cd /path/to/project && node run-reports-cron.js >> /path/to/logs/reports-cron.log 2>&1
   ```

## Using the System

### Creating a Scheduled Report

1. Navigate to the "Your Reports" page
2. Click "Schedule Report"
3. Fill in the report details:
   - Title and description
   - Generation frequency
   - Report specification
   - Content options (department breakdown, attrition analysis, etc.)
4. Click "Schedule Report" to save

### Generating a Manual Report

1. Navigate to the "Report Generation" page
2. Fill in the report details in the multi-step form
3. Submit the form to generate a report

### Viewing Reports

1. Go to the "Your Reports" page
2. View the list of generated reports
3. Click on a report to view it in detail
4. Use the export options to download as PDF or Word

### Managing Scheduled Reports

1. On the "Your Reports" page, find the "Scheduled Reports" section
2. View all your scheduled reports
3. Delete any scheduled reports you no longer need

### Admin Trigger

As an admin, you can manually trigger the report generation process:

1. Navigate to the Admin Panel
2. Enter your admin key
3. Click "Trigger Report Generation"

## API Documentation

### `/api/llm/claude-query-generator` (POST)

Generates MongoDB queries from natural language prompts.

**Request Body**:
```json
{
  "prompt": "Get all high-risk employees with their project assignments",
  "schemas": { /* Optional database schema */ }
}
```

**Response**:
```json
{
  "success": true,
  "prompt": "...",
  "generatedQuery": {
    "collection": "employees",
    "operation": "find",
    "query": { "attritionRisk": { "$gt": 0.7 } },
    "options": { "projection": { "name": 1, "projects": 1 } }
  },
  "results": [/* query results */]
}
```

### `/api/automated-reports` (POST)

Creates a new scheduled report.

**Request Body**:
```json
{
  "title": "Monthly Attrition Report",
  "description": "Report on employee attrition risk",
  "frequency": "monthly",
  "customFrequency": { "value": 1, "unit": "months" },
  "reportSpecification": "Detailed analysis of attrition risk",
  "includeDepartmentBreakdown": true,
  "includeAttritionRisk": true,
  "includeUtilizationScores": true,
  "includeDuties": true,
  "includeProjects": true,
  "includeEmployeeProfiles": true
}
```

### `/api/automated-reports/generate` (POST)

Generates a report based on a scheduled report configuration.

**Request Body**:
```json
{
  "reportId": "report_id_here"
}
```

**Headers**:
- `x-api-key`: Internal API key for authorization when called via cron

### `/api/cron/run-scheduled-reports` (POST)

Triggers the generation of all scheduled reports that are due.

**Headers**:
- `x-api-key`: Internal API key for authorization

### `/api/cron/manual-trigger` (POST)

Allows administrators to manually trigger the report generation process.

**Request Body**:
```json
{
  "adminKey": "your_admin_key"
}
```

## Customizing the System

### Adding New Query Types

To add new types of queries to the report generation system:

1. Edit `pages/api/automated-reports/generate.js`
2. Add your new query to the `queries` array:
   ```javascript
   const claudeQueries = [
     // Existing queries...
     { 
       prompt: `Generate a query to get your custom data`,
       category: "your_category" 
     }
   ];
   ```

### Customizing Report Templates

The report generation prompt can be customized in `pages/api/automated-reports/generate.js`:

1. Find the `reportPrompt` in the `generateReport` function
2. Modify the prompt to change the report structure, sections, or focus areas

### Adding New Chart Types

1. Edit `src/components/ReportRenderer.tsx`
2. Add support for new chart types in the `renderChart` function

## Troubleshooting

### Database Connection Issues

- Check that your MongoDB URI is correct
- Ensure database user has appropriate permissions
- Check network connectivity to MongoDB server

### API Key Issues

- Verify Claude API key is valid and has necessary permissions
- Verify Gemini API key is valid and has necessary permissions
- Check for proper formatting of API keys in .env.local

### Report Generation Failures

- Check MongoDB query errors in logs
- Verify database schema matches expected fields
- Check LLM API response errors

## Contributors

This system was developed by a team of developers as part of the organization simulation platform. Special thanks to the AI and data engineering teams for their contributions.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
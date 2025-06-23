# Employee Utilization Analyzer

A sophisticated analytical system that assesses employee workload, responsibility scope, and utilization based on multiple dimensions of work data.

## Overview

The Employee Utilization Analyzer builds on the task intensity analyzer concept to create a comprehensive, multi-dimensional evaluation of employee workload and utilization. It connects to MongoDB, processes employee data across multiple dimensions, and applies a weighted mathematical model to determine if employees are optimally utilized, overutilized, or underutilized.

This system has been designed with high precision to ensure fair assessment of employee workload, with appropriate weighting for different factors that contribute to job complexity.

## Key Assessment Dimensions

The analyzer evaluates four critical dimensions:

1. **Tool Complexity** - Evaluates the technical sophistication of tools an employee uses, with higher weights for complex tools (e.g., AutoCAD=0.9 vs. Excel=0.5).

2. **Role Complexity** - Assesses the expected responsibility level based on job title and role, accounting for seniority and domain.

3. **Project Load** - Analyzes the quantity and intensity of projects, including:
   - Number of active projects
   - Project priorities and criticality
   - Time pressure (deadline proximity)
   - Multi-project overlap

4. **Responsibility Breadth** - Determines if an employee is:
   - Managing others
   - Performing individual contributor work
   - Mentoring/coaching
   - Working across multiple domains
   - Handling responsibilities above or below their role level

## Features

- Sophisticated semantic matching of job titles, roles, and tools to predefined complexity scales
- Mathematical model to weight different aspects of utilization
- Project timeline analysis to identify deadline-driven pressure
- Gap analysis between expected and actual responsibility scope
- Confidence scoring to indicate reliability of the assessment
- Real-time processing through MongoDB change streams
- Detailed dimensional breakdown for targeted interventions

## Requirements

- Python 3.6+
- MongoDB Atlas account or MongoDB server
- Required Python packages:
  - pymongo
  - python-dotenv
  - sentence-transformers
  - scikit-learn
  - numpy

## Installation

1. Clone this repository
2. Install the required packages:
   ```bash
   pip install pymongo python-dotenv sentence-transformers scikit-learn numpy
   ```

## Configuration

Create an `.env` file or `.env.local` file in the same directory with the following variables:

```
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/
MONGODB_DATABASE=your_database_name
```

## Usage

Run the script to analyze all employees and then monitor for changes:

```bash
python employee_utilization_analyzer.py
```

## How It Works

### 1. Tool Complexity Analysis

The system maintains a comprehensive database of tools with assigned complexity scores. These scores reflect the cognitive load, training required, and technical sophistication of the tool:

```
TOOL_COMPLEXITY = {
    "python": 0.7,
    "autocad": 0.9,
    "excel": 0.5,
    ...
}
```

Employee tools are matched against this database, with semantic fuzzy matching used when exact matches aren't found.

### 2. Role Complexity Analysis

Job titles and roles are mapped to expected complexity levels:

```
ROLE_COMPLEXITY = {
    "junior developer": 0.4,
    "senior software engineer": 0.8,
    "project manager": 0.7,
    ...
}
```

This provides a baseline for expected responsibility levels.

### 3. Project Load Analysis

Projects are evaluated based on:
- Current status (active projects weighted higher)
- Priority level
- Time remaining until deadline
- Hours per week committed
- Total number of simultaneous projects

### 4. Responsibility Breadth Analysis

The system analyzes project contributions to determine:
- Management responsibilities
- Mentoring activities
- Technical leadership
- Execution work
- Domain variety

It then compares this distribution against the expected scope for the employee's role.

### 5. Utilization Assessment

The final utilization score is calculated using a weighted formula:
```
(0.2 * tool complexity) + (0.3 * project load) + (0.3 * breadth score) + (0.2 * role complexity)
```

This is then adjusted based on the gap between expected and actual responsibility breadth.

## Output Format

The analyzer adds a new `utilizationAssessment` field to each document in MongoDB with detailed analysis:

```json
{
  "utilizationAssessment": {
    "timestamp": "2023-06-15T14:23:45.123456",
    "email": "employee@example.com",
    "tool_complexity_analysis": {
      "overall_score": 0.75,
      "tool_details": [...],
      "avg_complexity": 0.7,
      "max_complexity": 0.9,
      "tool_count": 8
    },
    "role_complexity_analysis": {
      "complexity": 0.8,
      "matched_role": "senior software engineer",
      "input_job_title": "Senior Software Engineer",
      "input_role": "Developer"
    },
    "project_load_analysis": {
      "project_count": 3,
      "active_project_count": 2,
      "average_priority": 0.7,
      "time_pressure_score": 0.6,
      "overlap_score": 0.85,
      "overall_load_score": 0.73,
      "project_details": [...]
    },
    "responsibility_breadth_analysis": {
      "breadth_score": 0.65,
      "expected_breadth": 0.7,
      "breadth_gap": -0.05,
      "is_management_role": false,
      "role_distribution": {
        "management": 0.1,
        "mentoring": 0.2,
        "technical_leadership": 0.5,
        "execution": 0.2
      },
      "domain_variety": {
        "unique_domains": 3,
        "domains": ["frontend", "backend", "devops"]
      }
    },
    "utilization_assessment": {
      "utilization_score": 0.72,
      "utilization_status": "optimal",
      "confidence_score": 0.9,
      "raw_score": 0.74,
      "adjustment_factor": -0.02
    }
  }
}
```

## Interpretation Guide

### Utilization Status
- **Underutilized** (score < 0.4): Employee has capacity for additional responsibilities
- **Optimal** (score 0.4-0.8): Employee has a balanced workload
- **Overutilized** (score > 0.8): Employee may be overloaded and at risk of burnout

### Confidence Score
- **High** (> 0.8): Assessment based on comprehensive data
- **Medium** (0.5-0.8): Some key data points missing
- **Low** (< 0.5): Insufficient data for reliable assessment

### Breadth Gap
- **Positive**: Employee performing above role expectations
- **Negative**: Employee performing below role expectations
- **Near Zero**: Employee aligned with role expectations

## Extending the System

### Adding New Tools
To add new tools to the complexity database, update the `TOOL_COMPLEXITY` dictionary in the script:

```python
TOOL_COMPLEXITY["new_tool"] = 0.8  # Add new tool with complexity score
```

### Customizing Role Complexity
Update the `ROLE_COMPLEXITY` dictionary to add or modify role complexity scores:

```python
ROLE_COMPLEXITY["new_role"] = 0.7  # Add new role with complexity score
```

### Adjusting Weights
The weighting factors in the formula can be adjusted in the `calculate_utilization_score` function to match organizational priorities.

## Best Practices

1. **Regular Review**: Periodically review and update the complexity scores as tools evolve and job responsibilities change.

2. **Human Oversight**: Use the automated scores as a starting point for discussions, not as the final word on employee performance or utilization.

3. **Data Quality**: Ensure employee profiles are kept up-to-date with accurate tool lists, project assignments, and role descriptions.

4. **Holistic Assessment**: Consider the utilization score alongside other factors like employee satisfaction surveys and manager feedback.

## License

MIT 
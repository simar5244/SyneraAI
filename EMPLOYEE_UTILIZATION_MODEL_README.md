# Employee Utilization Analysis System - Technical Documentation

## Overview

This document provides a comprehensive explanation of the mathematical models and data processing techniques used in the Employee Utilization Analysis System. This system evaluates employee utilization based on multiple factors to provide an objective assessment that can be used for resource allocation, workload balancing, and other personnel decisions.

## Data Sources

The system draws data from the following fields in the MongoDB database:

1. **Basic Employee Information**:
   - `email`: Employee identifier
   - `jobTitle`: Employee's current job title
   - `role`: Employee's internal permission role (used only for system permissions, not for analysis)

2. **Technical Skills**:
   - `toolsProficient`: Array of tools/technologies the employee is proficient with

3. **Job Responsibilities**:
   - `jobDuties`: Array of objects containing duty descriptions and weekly hours
   - `jobResponsibilities`: Secondary/fallback field for duties (used if jobDuties is empty)

4. **Project Data**:
   - `projects`: Array of project objects containing:
     - `project_id`, `project_title`, `project_status`, `project_priority`
     - `project_start_date`, `project_end_date`
     - `user_contribution`: Object with `role_in_project` and `hours_per_week`

5. **Tenure Information**:
   - `timeWithCompany`: Time with the company (string, e.g., "2 years 3 months")
   - `timeInCurrentRole`: Time in current role (string, e.g., "1 year 6 months")
   - `totalduration`: Alternative field for company tenure (numeric months)
   - `currentroleduration`: Alternative field for role tenure (numeric months)

6. **Collaboration Data**:
   - `skillsFeedback`: Object containing feedback information:
     - `feedbackGiven`: Number of feedback entries given
     - `feedbackReceived`: Number of feedback entries received
     - `averageRating`: Average rating score
     - `weightedRating`: Weighted rating score

## Mathematical Model Components

The utilization score is calculated through several component analyses, each producing a subscore that contributes to the final utilization assessment.

### 1. Role Complexity Analysis

**Purpose**: Determine the complexity level of the employee's role based on their job title.

**Input Field**: `jobTitle`

**Process**:
1. The job title is normalized to lowercase and matched against a predefined dictionary of roles (`ROLE_COMPLEXITY`)
2. Role categories are identified (software, administrative, data, etc.) to prevent cross-category mismatches
3. Matching attempts in order:
   - Direct exact match
   - Partial match within the same job category
   - Fuzzy semantic matching with similarity threshold of 0.6 (using SentenceTransformer)
4. Special case handling (e.g., "software assistant" → 80% of "software engineer" complexity)

**Output**: 
- `complexity`: Score between 0.1-1.0
- `matched_role`: The role that was matched from our dictionary
- `categories`: Job categories identified

### 2. Tool Complexity Analysis

**Purpose**: Assess technical skill complexity based on tools and technologies the employee is proficient with.

**Input Field**: `toolsProficient`

**Process**:
1. Each tool is matched against a predefined complexity dictionary (`TOOL_COMPLEXITY`)
2. For each tool, its complexity score (0.1-1.0) is recorded
3. Overall complexity calculation: `(0.7 * max_complexity) + (0.3 * avg_complexity)`
   - Gives higher weight to the most complex tool while accounting for breadth

**Output**:
- `overall_score`: Combined tool complexity score (0.1-1.0)
- `tool_details`: Detailed breakdown of each tool and its complexity
- `avg_complexity`: Average complexity across all tools
- `max_complexity`: Highest complexity tool score
- `tool_count`: Number of tools analyzed

### 3. Job Intensity Analysis

**Purpose**: Determine the intensity of job duties weighted by hours spent.

**Input Fields**: `jobDuties` or `jobResponsibilities` (fallback)

**Process**:
1. For each duty:
   - Match the duty description against benchmark tasks using semantic similarity
   - Retrieve or calculate intensity score (0.1-1.0)
   - Weight by hours per week spent on the duty
2. Calculate weighted average intensity: `sum(duty_intensity * hours) / total_hours`
3. Calculate workload factor based on total weekly hours:
   - For hours < 40: `2 / (1 + e^(-0.15*(hours-20)))` (sigmoid function)
   - For hours > 40: `1.0 + log(hours/40)` (logarithmic scaling for overtime)
4. Adjusted intensity = weighted average intensity * workload factor

**Output**:
- `weighted_intensity`: Hour-weighted average intensity (0.1-1.0)
- `adjusted_intensity`: Intensity adjusted for total workload
- `total_hours`: Total hours of work per week
- `workload_factor`: Adjustment factor based on total hours (0.0-2.0)
- `duties_analysis`: Detailed breakdown of each duty and its intensity score

### 4. Project Load Analysis

**Purpose**: Assess workload from projects considering complexity, priority, and time pressure.

**Input Field**: `projects`

**Process**:
1. Count active projects (status weight ≥ 0.5)
2. Calculate average priority across all projects
3. Time pressure calculation:
   - For each project with a deadline, calculate time pressure based on proximity
   - Critical proximity (7 days): 0.7-1.0 pressure score
   - High proximity (14 days): 0.5-0.7 pressure score
   - Medium proximity (30 days): 0.3-0.5 pressure score
   - Beyond 30 days: exponential decay formula
4. Calculate overlap score by identifying concurrent projects in same time periods
5. Project count factor: `min(1.0, 0.3 * log(active_count + 1) + 0.2)`
6. Overall load calculation: `(0.30 * time_pressure) + (0.25 * project_count_factor) + (0.25 * overlap_score) + (0.20 * avg_priority)`

**Output**:
- `overall_load_score`: Final project load score (0.0-1.0)
- `time_pressure_score`: Score based on deadline proximity
- `overlap_score`: Score based on concurrent project count
- `project_count_factor`: Score based on total active projects
- `average_priority`: Average priority across all projects
- `project_details`: Detailed analysis of each project

### 5. Responsibility Breadth Analysis

**Purpose**: Assess the breadth of responsibilities compared to expected role.

**Input Fields**: `projects`, `jobTitle`

**Process**:
1. Determine expected seniority level based on job title (0.1-1.0)
2. Classify project roles into categories:
   - Management roles
   - Mentoring roles
   - Technical leadership
   - Execution roles
3. Compare actual role distribution against expected distribution for seniority level
4. Calculate breadth score: `(management_pct * 1.0) + (mentoring_pct * 0.8) + (technical_lead_pct * 0.6) + (execution_pct * 0.3)`
5. Adjust for technical domain variety: `breadth_score = (breadth_score * 0.7) + (domain_variety_score * 0.3)`
6. Calculate gap between actual and expected breadth: `breadth_gap = breadth_score - expected_breadth`

**Output**:
- `breadth_score`: Score indicating responsibility breadth (0.0-1.0)
- `expected_breadth`: Expected breadth based on seniority
- `breadth_gap`: Gap between actual and expected breadth
- `role_distribution`: Breakdown of role types by percentage
- `role_overlaps`: Analysis of overlapping responsibilities

### 6. Collaboration Index Analysis

**Purpose**: Assess the employee's collaboration activity and quality.

**Input Field**: `skillsFeedback`

**Process**:
1. Calculate feedback activity score based on total feedback (given + received):
   - Logarithmic scaling: `min(1.0, log(total_feedback + 1) / log(50))`
2. Calculate feedback quality score based on ratings:
   - `max(avg_rating, weighted_rating) / 5.0`
3. Combined collaboration score:
   - `(0.6 * feedback_activity_score) + (0.4 * quality_score)`

**Output**:
- `collaboration_score`: Overall collaboration score (0.0-1.0)
- `feedback_activity_score`: Score based on feedback quantity
- `feedback_quality_score`: Score based on feedback ratings
- `has_feedback_data`: Boolean indicating if feedback data was available

## Final Utilization Score Calculation

The final utilization score combines all component analyses with the following formula:

```
raw_utilization = (0.15 * tool_complexity) + 
                 (0.2 * project_load) + 
                 (0.1 * pressure_handling) + 
                 (0.2 * breadth_score) + 
                 (0.15 * role_complexity) +
                 (0.2 * job_intensity)
```

**Adjustments applied**:
1. Workload factor: `workload_adjusted_utilization = raw_utilization * workload_factor`
2. Role overlap adjustment: `overlap_adjustment = overlap_factor * role_mismatch_score * 0.3`
3. Breadth adjustment: `breadth_adjustment = breadth_gap * 0.2`

**Final score**:
```
adjusted_utilization = workload_adjusted_utilization + role_overlap_adjustment + breadth_adjustment
final_utilization = max(0.0, min(1.0, adjusted_utilization))  // Constrained to 0.0-1.0 range
```

**Utilization Status Categories**:
- < 0.3: "severely_underutilized"
- 0.3-0.45: "underutilized"
- 0.45-0.75: "optimal"
- 0.75-0.9: "highly_utilized"
- > 0.9: "overutilized"

## Database Output

The analysis results are written to both the `merged_output` and `users` collections with the following fields:

1. `utilizationAssessment`: Complete detailed assessment with all subcomponents
2. `utilization_score`: Direct access to the final utilization score
3. `job_intensity_analysis`: Analysis of job duty intensity
4. `collaboration_analysis`: Analysis of collaboration metrics
5. Various time-related fields: `timeWithCompanyMonths`, `timeInCurrentRoleMonths`

## Time-based Data Processing

Time expressions in `timeWithCompany` and `timeInCurrentRole` are parsed into numerical months:
1. Years are multiplied by 12
2. Explicit month values are added
3. Alternative numeric fields (`totalduration`, `currentroleduration`) are used if available

## Summary

This mathematical model provides a comprehensive, data-driven approach to employee utilization assessment. The model is designed to be:

1. **Multi-dimensional**: Considers various aspects of employee workload
2. **Fair**: Uses objective measures rather than subjective assessments
3. **Explainable**: Each component can be traced back to source data
4. **Adaptable**: Different components can be weighted differently if needed

The model is applied consistently across all employees, providing a standardized assessment that can be used for organizational planning and decision-making. 
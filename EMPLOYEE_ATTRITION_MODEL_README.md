# Employee Attrition Risk Assessment Model - Technical Documentation

## Overview

This document provides a comprehensive explanation of the mathematical models and data processing techniques used in the Employee Attrition Risk Assessment System. This system evaluates the likelihood of voluntary employee turnover based on multiple weighted factors derived from employee data, using research-backed indicators of attrition risk.

## Data Sources

The attrition assessment system draws data from the following fields in the MongoDB database:

1. **Basic Employee Information**:
   - `email`: Employee identifier
   - `jobTitle`: Employee's current job title

2. **Tenure Information**:
   - `timeWithCompanyMonths`: Processed tenure with company in months
   - `timeInCurrentRoleMonths`: Processed tenure in current role in months
   - `totalduration`: Alternative field for company tenure (numeric months)
   - `currentroleduration`: Alternative field for role tenure (numeric months)

3. **Utilization Assessment**:
   - `utilizationAssessment`: Complete utilization analysis from the utilization model
   - `utilization_score`: Top-level direct access to utilization score

4. **Job Intensity**:
   - `job_intensity_analysis`: Analysis of job duty intensity from the utilization model

5. **Project Information**:
   - `projects`: Array of project objects

6. **Collaboration Data**:
   - `collaboration_analysis`: Collaboration metrics from utilization model
   - `skillsFeedback`: Raw feedback metrics
   - `feedbackGiven`: Legacy list of feedback provided
   - `feedbackReceived`: Legacy list of feedback received

7. **Job Responsibilities**:
   - `jobDuties`: Array of objects containing duty descriptions and weekly hours
   - `jobResponsibilities`: Secondary/fallback field for duties (used if jobDuties is empty)

8. **Skills**:
   - `toolsProficient`: Array of tools/technologies the employee is proficient with

## Mathematical Model Components

The attrition score is calculated through several component analyses, each producing a subscore that contributes to the final assessment. Each component is weighted according to its predictive power based on research.

### 1. Responsibility Mismatch Analysis

**Purpose**: Detect misalignment between an employee's job title and actual responsibilities, which can lead to frustration and turnover.

**Input Fields**: `jobDuties`, `jobTitle`

**Process**:
1. Compare actual job responsibilities with expected responsibilities for the role/seniority
2. Calculate gaps between expected and actual responsibility distribution
3. Assign higher mismatch scores when employee performs duties more complex than expected for their role

**Output**:
- `mismatch_score`: Attrition risk score (0.0-1.0)
- `explanation`: Human-readable explanation of the mismatch

### 2. Tenure Factor Analysis

**Purpose**: Assess risk based on time with company and in current role, identifying critical periods when employees are most likely to leave.

**Input Fields**: `timeWithCompanyMonths`, `timeInCurrentRoleMonths`

**Process**:
1. Identify risk based on common turnover patterns at specific milestones:
   - Honeymoon end (9 months)
   - Assessment period (18 months)
   - Growth plateau (36 months)
   - Significant milestone (60 months)
   - Long tenure reassessment (84+ months)
2. Calculate a role stagnation ratio: `role_tenure / company_tenure`
   - Higher ratios indicate potential career stagnation
3. Apply risk amplifiers when tenure coincides with high-risk periods

**Output**:
- `tenure_score`: Attrition risk score (0.0-1.0)
- `company_tenure_months`: Tenure with company in months
- `role_tenure_months`: Tenure in current role in months
- `stagnation_ratio`: Ratio of role tenure to company tenure
- `explanation`: Context-specific explanation of tenure risk

### 3. Utilization Factor Analysis

**Purpose**: Evaluate how employee workload and capacity utilization affects retention risk.

**Input Field**: `utilizationAssessment`

**Process**:
1. Extract utilization score (0.0-1.0) and utilization status from assessment
2. Calculate deviation from optimal utilization (0.6 is considered ideal)
3. Convert deviation to attrition risk: `min(1.0, deviation * 1.8)`
4. Apply status-based adjustments:
   - Severely underutilized: minimum 0.8 risk
   - Underutilized: minimum 0.6 risk
   - Optimal: maximum 0.3 risk
   - Highly utilized: minimum 0.7 risk
   - Overutilized: minimum 0.85 risk

**Output**:
- `utilization_attrition_score`: Attrition risk score (0.0-1.0)
- `current_utilization`: Raw utilization score
- `utilization_status`: Categorized utilization status
- `explanation`: Human-readable explanation of utilization impact

### 4. Seniority Factor Analysis

**Purpose**: Account for how career stage affects turnover patterns.

**Input Field**: `jobTitle`

**Process**:
1. Extract seniority level from job title (0.1-1.0 scale)
2. Map seniority to research-backed attrition risk:
   - Junior level (0.1-0.2): 0.3-0.4 risk (building career)
   - Mid level (0.3-0.5): 0.5-0.7 risk (highest risk - seeking advancement)
   - Senior level (0.6-0.7): 0.5-0.6 risk (selective about opportunities)
   - Leadership (0.8-1.0): 0.2-0.4 risk (established positions)

**Output**:
- `seniority_attrition_score`: Attrition risk score (0.0-1.0)
- `seniority_level`: Numeric seniority level (0.1-1.0)
- `seniority_category`: Category label (junior, mid, senior, lead/principal, executive)
- `explanation`: Context explanation for the seniority-related risk

### 5. Task Variety Index

**Purpose**: Measure job diversity and complexity as they relate to engagement.

**Input Fields**: `jobDuties`, `projects`, `toolsProficient`

**Process**:
1. Analyze variety of tasks in job duties
2. Consider project diversity (domains, technologies)
3. Include tools/skills breadth
4. Calculate variety score using logarithmic scaling to account for diminishing returns
5. Map variety to attrition risk (moderate variety is optimal)

**Output**:
- `attrition_risk`: Attrition risk score (0.0-1.0)
- `variety_score`: Raw measurement of task variety
- `explanation`: Human-readable explanation of variety impact

### 6. Job Intensity Factor

**Purpose**: Assess how job intensity affects burnout risk and retention.

**Input Field**: `job_intensity_analysis`

**Process**:
1. Extract intensity metrics from analysis
2. Calculate deviation from optimal intensity (0.6 is ideal)
3. Convert to attrition risk using different formulas based on direction:
   - For high intensity: `0.5 + (0.5 * min(1, (intensity - optimal) * 2.5))`
   - For low intensity: `0.5 + (0.3 * min(1, (optimal - intensity) * 2))`
4. Apply workload adjustment for overtime: `max(intensity_factor, 0.7 + (0.3 * min(1, (workload_factor - 1.2) * 1.25)))`

**Output**:
- `intensity_attrition_score`: Attrition risk score (0.0-1.0)
- `current_intensity`: Raw intensity value
- `workload_factor`: Adjustment factor based on total hours
- `explanation`: Context-specific explanation of intensity impact

### 7. Role-Project Ratio Analysis

**Purpose**: Evaluate whether an employee's project load is appropriate for their seniority.

**Input Fields**: `projects`, seniority level

**Process**:
1. Count active projects
2. Determine expected project count based on seniority
3. Calculate ratio of actual to expected
4. Convert to attrition risk using thresholds:
   - Ratio < 0.5: 0.6-0.9 risk (significantly underutilized)
   - Ratio 0.5-0.8: 0.4-0.6 risk (slightly underutilized)
   - Ratio 0.8-1.2: 0.3 risk (optimal)
   - Ratio 1.2-1.5: 0.4-0.7 risk (slightly overloaded)
   - Ratio > 1.5: 0.7-1.0 risk (significantly overloaded)

**Output**:
- `role_project_attrition_score`: Attrition risk score (0.0-1.0)
- `active_projects`: Count of active projects
- `expected_projects`: Expected project count for seniority level
- `project_ratio`: Ratio of actual to expected
- `explanation`: Context-specific explanation of project load impact

### 8. Collaboration Index

**Purpose**: Measure the strength of workplace relationships and social integration.

**Input Fields**: `collaboration_analysis` or `skillsFeedback` or `feedbackGiven`/`feedbackReceived`

**Process**:
1. Extract collaboration metrics from preferred source
2. Calculate activity score based on feedback quantity (using logarithmic scaling)
3. Calculate quality score based on average feedback ratings
4. Combine: `(0.6 * activity_score) + (0.4 * quality_score)`
5. Convert to attrition risk (inverse of collaboration score): `1 - collaboration_score`

**Output**:
- `collaboration_attrition_score`: Attrition risk score (0.0-1.0)
- `collaboration_score`: Raw collaboration strength score
- `feedback_activity`: Score based on feedback quantity
- `feedback_quality`: Score based on feedback ratings
- `explanation`: Context-specific explanation of collaboration impact

## Final Attrition Score Calculation

The final attrition score combines all component analyses with the following weighted formula:

```
weighted_score = (responsibility_mismatch * 0.15) +
                 (tenure_factor * 0.12) +
                 (utilization_factor * 0.15) +
                 (seniority_factor * 0.08) +
                 (task_variety_index * 0.12) +
                 (job_intensity * 0.10) +
                 (role_project_ratio * 0.13) +
                 (collaboration_index * 0.15)
```

These weights reflect extensive research on the relative importance of each factor in predicting voluntary turnover.

**Attrition Risk Categories**:
- < 0.3: "very_low" risk
- 0.3-0.4: "low" risk
- 0.4-0.6: "medium" risk
- 0.6-0.75: "high" risk
- > 0.75: "very_high" risk

## Primary Risk Factors Identification

The system identifies which factors are contributing most significantly to attrition risk:

1. Each factor's score is compared to the overall attrition score
2. Factors scoring 0.15+ higher than overall score are flagged as primary risk factors
3. The top 3 primary factors are included in the output
4. The highest-scoring factor's explanation is used as the primary explanation

## Database Output

The analysis results are written to both the `merged_output` and `users` collections with the following structure:

```json
{
  "attritionAssessment": {
    "timestamp": "ISO datetime",
    "email": "employee email",
    "attrition_score": 0.XX,
    "attrition_risk": "risk level category",
    "primary_explanation": "explanation of top risk factor",
    "primary_risk_factors": [
      {
        "factor": "factor name",
        "score": 0.XX,
        "explanation": "factor-specific explanation"
      }
    ],
    "factor_scores": {
      "responsibility_mismatch": 0.XX,
      "tenure_factor": 0.XX,
      "utilization_factor": 0.XX,
      "seniority_factor": 0.XX,
      "task_variety_index": 0.XX,
      "job_intensity": 0.XX,
      "role_project_ratio": 0.XX,
      "collaboration_index": 0.XX
    },
    "factor_details": {
      // Detailed outputs from each factor calculation
    }
  }
}
```

## Summary

This mathematical model provides a comprehensive, data-driven approach to predicting employee attrition risk. The model is designed to be:

1. **Multi-dimensional**: Considers various aspects of the employee experience
2. **Research-backed**: Based on established patterns in turnover literature
3. **Explainable**: Each component provides human-readable explanations
4. **Actionable**: Identifies specific risk factors for potential intervention

The model is applied consistently across all employees, providing a standardized assessment that can help identify at-risk employees before they reach the resignation decision point. 
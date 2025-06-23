# Employee Analytics System Documentation

This document provides in-depth technical documentation for the Employee Analytics System, consisting of two main components:

1. **Employee Utilization Analyzer** - Evaluates employee workload and resource allocation
2. **Attrition Score Analyzer** - Predicts employee attrition risk based on multiple factors

Both systems work together to provide comprehensive analytics for workforce optimization, connecting to MongoDB for data retrieval and storage.

## Table of Contents

1. [System Overview](#system-overview)
2. [Employee Utilization Analyzer](#employee-utilization-analyzer)
   - [Scientific Basis](#utilization-scientific-basis)
   - [Scoring Methodology](#utilization-scoring-methodology)
   - [Dimensional Analysis](#utilization-dimensional-analysis)
   - [Mathematical Models](#utilization-mathematical-models)
3. [Attrition Score Analyzer](#attrition-score-analyzer)
   - [Scientific Basis](#attrition-scientific-basis)
   - [Factor Weighting](#attrition-factor-weighting)
   - [Score Calculation](#attrition-score-calculation)
   - [Mathematical Models](#attrition-mathematical-models)
4. [System Integration](#system-integration)
5. [Technical Implementation](#technical-implementation)

## System Overview

The Employee Analytics System takes a data-driven approach to workforce management, combining cutting-edge natural language processing with research-backed mathematical models. The system processes employee data from MongoDB, including:

- Job titles and responsibilities
- Project assignments and technical skills
- Tenure and career progression
- Feedback and collaboration patterns
- Work intensity and task distribution

Results are stored back to MongoDB to enable dashboard visualization and strategic decision-making.

## Employee Utilization Analyzer

The Employee Utilization Analyzer evaluates how effectively employees' time and skills are being utilized, considering multiple dimensions to create a comprehensive assessment.

### Utilization Scientific Basis

The utilization model draws from several established research areas:

1. **Cognitive Load Theory** - Assesses mental effort required for different tasks and tools, based on intrinsic (task complexity), extraneous (how presented), and germane (learning process) cognitive loads.

2. **Role Theory** - Evaluates expected vs. actual role performance, accounting for role conflict (incompatible demands) and role ambiguity (unclear expectations).

3. **Project Management Principles** - Draws on established project management methodologies to evaluate workload based on:
   - Critical path dependencies
   - Resource allocation optimization
   - Deadline-driven stress impacts

4. **Multi-tasking Impact Models** - Research shows performance degradation with multiple simultaneous projects, with the formula:
   ```
   Efficiency = 1 / (1 + context_switching_cost * (n_projects - 1))
   ```

### Utilization Scoring Methodology

The utilization score is calculated through a multi-step process:

#### 1. Tool Complexity Analysis

Tool complexity is determined using a comprehensive database of technical tools with research-assigned complexity scores:

```python
tools_analysis = {
  "overall_score": weighted_sum_of_tool_complexities,
  "tool_details": [individual_tool_scores],
  "avg_complexity": mean_complexity,
  "max_complexity": highest_complexity_tool,
  "tool_count": number_of_tools_used
}
```

When tools aren't found in the database, semantic similarity using sentence transformers is employed for fuzzy matching.

#### 2. Role Complexity Analysis

Job titles are mapped to expected complexity levels with semantic matching:

```python
role_analysis = {
  "complexity": role_complexity_score,
  "matched_role": semantically_closest_role,
  "input_job_title": original_job_title,
  "input_role": original_role_field
}
```

#### 3. Project Load Analysis

Project load is calculated with a sophisticated model incorporating:

```python
project_load = base_load * priority_multiplier * deadline_pressure * overlap_factor
```

Where:
- **Base Load**: Starting value determined by number of active projects
- **Priority Multiplier**: Higher for critical/high-priority projects
- **Deadline Pressure**: Exponential function of days until deadline
- **Overlap Factor**: Logarithmic scaling based on simultaneous projects

The model applies logarithmic scaling to prevent linear scaling problems:
```
project_scaling_factor = log_base(1 + project_count) / log_base(1 + optimal_project_count)
```

This recognizes that going from 1 to 2 projects has more impact than going from 5 to 6.

#### 4. Responsibility Breadth Analysis

Analyzes job duties distribution across five key categories:
- Management responsibilities
- Mentoring/coaching
- Technical leadership
- Execution work
- Strategic planning

The distribution is compared to expected values for the employee's seniority level:

```python
responsibility_analysis = {
  "breadth_score": overall_breadth_assessment,
  "expected_breadth": expected_for_role,
  "breadth_gap": actual_minus_expected,
  "role_distribution": {category_percentages},
  "domain_variety": {variety_measures}
}
```

#### 5. Job Intensity Analysis

Utilizes sentence transformers for semantic matching of job duties against a benchmark database of task intensities. The model incorporates:

```python
intensity_score = base_intensity * workload_factor * complexity_multiplier
```

Where:
- **Base Intensity**: Average intensity of matched tasks
- **Workload Factor**: Adjustment based on total weekly hours
- **Complexity Multiplier**: Higher for complex duties requiring mental effort

### Utilization Dimensional Analysis

Each dimension contributes to the final score with carefully calibrated weights:

```python
utilization_score = (
  (tool_weight * tool_score) + 
  (project_weight * project_score) + 
  (responsibility_weight * responsibility_score) + 
  (role_weight * role_score)
)
```

Weights are optimized through retrospective calibration against known cases of under/over-utilization.

### Utilization Mathematical Models

The system employs several advanced mathematical techniques:

1. **Semantic Similarity Calculation**:
   ```
   similarity = cosine_similarity(embedding1, embedding2)
   ```

2. **Project Pressure Calculation** (deadline pressure curve):
   ```
   deadline_pressure = 1 + (0.5 * exp(-0.1 * days_to_deadline))
   ```

3. **Workload Adjustment Formula**:
   ```
   workload_factor = (hours_per_week / 40)^0.7
   ```
   The exponent 0.7 creates a non-linear relationship based on research showing diminishing returns.

4. **Confidence Scoring**:
   ```
   confidence = (data_completeness * 0.6) + (match_quality * 0.4)
   ```

## Attrition Score Analyzer

The Attrition Score Analyzer calculates employee flight risk using eight critical factors, each with robust scientific grounding.

### Attrition Scientific Basis

The model is grounded in established research on employee retention:

1. **Job Demands-Resources (JD-R) Model** - Examines how job demands (workload, complexity) and resources (support, autonomy) influence burnout and engagement.

2. **Employee Life Cycle Research** - Identifies high-risk tenure periods where employees typically reassess their position.

3. **Person-Organization Fit Theory** - Measures alignment between employee capabilities and organizational demands.

4. **Organizational Psychology** - Research on collaboration's impact on retention and identity formation.

### Attrition Factor Weighting

Eight factors are weighted based on meta-analytic research of predictive validity:

```python
ATTRITION_FACTOR_WEIGHTS = {
    "responsibility_mismatch": 0.15,
    "tenure_factor": 0.12,
    "utilization_factor": 0.15,
    "seniority_factor": 0.08,
    "task_variety_index": 0.12,
    "job_intensity": 0.10,
    "role_project_ratio": 0.13,
    "collaboration_index": 0.15
}
```

These weights reflect extensive research on the relative importance of each factor in predicting voluntary turnover.

### Attrition Score Calculation

#### 1. Responsibility Mismatch

Compares actual vs. expected responsibilities based on seniority:

```python
mismatch_calculation = {
    "expected_distribution": roles_by_seniority_level,
    "actual_distribution": current_role_distribution,
    "gap_analysis": difference_between_distributions
}
```

The model applies higher weights to cases where employees are performing significantly more complex work than expected for their level, as this correlates strongly with burnout.

#### 2. Tenure Factor

Applies a sophisticated model of employee lifecycle patterns:

```python
tenure_risk = f(company_tenure, role_tenure, stagnation_ratio)
```

The model implements research-identified critical periods:
- Honeymoon end (9 months)
- Assessment period (18 months)
- Growth plateau (36 months)
- Significant milestone (60 months)
- Long tenure reassessment (84+ months)

For each period, a modified Gaussian function models risk elevation:
```
period_risk = exp(-0.5 * ((tenure_months - period_center) / period_width)^2)
```

#### 3. Utilization Factor

Converts utilization assessment to attrition risk using a non-linear relationship:

```python
optimal_utilization = 0.6  # Research-backed optimal level
deviation = |actual_utilization - optimal_utilization|
attrition_risk = min(1.0, deviation * 1.8)
```

Both under and over-utilization increase risk, with specific adjustments for severe cases:
- Severely underutilized: `attrition_risk = max(attrition_risk, 0.8)`
- Optimal: `attrition_risk = min(attrition_risk, 0.3)`
- Overutilized: `attrition_risk = max(attrition_risk, 0.85)`

#### 4. Seniority Factor

Uses research showing mid-senior employees are most likely to leave:

```python
SENIORITY_ATTRITION_RISK = {
    0.1: 0.3,  # Entry level (building experience)
    0.2: 0.4,  # Junior level (building career)
    0.3: 0.5,  # Junior-mid level (starting to consider options)
    0.4: 0.6,  # Mid level (high risk - actively seeking advancement)
    0.5: 0.7,  # Mid-senior level (highest risk - marketable & seeking growth)
    0.6: 0.6,  # Senior level (high risk but more selective)
    0.7: 0.5,  # Staff/Principal level (moderate risk)
    0.8: 0.4,  # Director level (lower risk - established)
    0.9: 0.3,  # VP/Executive level (lower risk - compensation & stability)
    1.0: 0.2   # C-Suite (lowest risk - peak position)
}
```

These values are based on industry studies of voluntary turnover by career stage.

#### 5. Task Variety Index

Employs information theory (Shannon entropy) to measure task diversity:

```python
entropy = -sum(p * log(p) for p in task_probabilities)
normalized_entropy = entropy / max_possible_entropy
attrition_risk = 1 - normalized_entropy  # Inverse relationship
```

A custom function models the relationship between variety and attrition:
- Very low variety (< 0.3): high risk (> 0.7)
- Moderate variety (0.3-0.7): moderate risk (0.3-0.7)
- High variety (> 0.7): low risk (< 0.3)

#### 6. Job Intensity

Maps job intensity to attrition risk using a sigmoid function:

```python
optimal_intensity = 0.6
intensity_deviation = |intensity - optimal_intensity|

if intensity > optimal_intensity:
    # High intensity (burnout risk)
    intensity_factor = 0.5 + (0.5 * min(1, (intensity - optimal_intensity) * 2.5))
else:
    # Low intensity (boredom risk)
    intensity_factor = 0.5 + (0.3 * min(1, (optimal_intensity - intensity) * 2))
```

This asymmetric function reflects research showing burnout is a stronger predictor of attrition than boredom.

#### 7. Role-Project Ratio

Compares actual project count to seniority-appropriate levels:

```python
EXPECTED_PROJECTS_BY_SENIORITY = {
    0.1: 1,  # Entry level: 1 project
    0.2: 1,  # Junior: 1 project
    0.3: 2,  # Junior-mid: 2 projects
    0.4: 2,  # Mid level: 2 projects
    0.5: 3,  # Mid-senior: 3 projects
    0.6: 3,  # Senior: 3 projects
    0.7: 4,  # Staff/Principal: 4 projects 
    0.8: 4,  # Director: 4 projects
    0.9: 5,  # VP/Executive: 5 projects
    1.0: 5   # C-Suite: 5 projects
}

ratio = active_project_count / expected_projects
```

Risk is calculated based on deviation from expected ratio, with both under and over-assignment increasing risk:
- Too few projects: potential underutilization
- Too many projects: potential overwhelm

#### 8. Collaboration Index

Evaluates isolation risk based on collaboration network strength:

```python
collaboration_index = min(1.0, 0.2 * log(1 + unique_collaborators, 2) + 
                     0.15 * log(1 + total_interactions, 2))
```

The logarithmic scale captures research showing diminishing returns with very large networks, while a minimum threshold of connections is essential.

Specific risk adjustments include:
- No collaborators: very high risk (0.9)
- Very few collaborators (< 3): high risk (0.7+)
- Strong network (5+ collaborators): lower risk floor (0.6)
- Very strong network (8+ collaborators, 10+ interactions): very low risk (0.3)

### Attrition Mathematical Models

The system implements several mathematical techniques:

1. **Shannon Entropy** for task variety:
   ```
   entropy = -Σ(p_i * log(p_i))
   ```

2. **Modified Gaussian Functions** for tenure risk periods:
   ```
   risk = exp(-0.5 * ((x - center) / width)^2)
   ```

3. **Sigmoid Function** for normalizing scores:
   ```
   normalized_score = 1 / (1 + e^(-6 * (x - 0.5)))
   ```

4. **Weighted Aggregation** for final score:
   ```
   final_score = Σ(factor_score_i * weight_i) / Σ(weight_i)
   ```

## System Integration

The Employee Utilization Analyzer and Attrition Score Analyzer work together by:

1. Utilization system analyzes workload and responsibility distribution
2. Results are stored in MongoDB with the `utilizationAssessment` field
3. Attrition system retrieves utilization data and combines it with other factors
4. Final attrition scores are stored as `attritionAssessment` in both collections

Both systems support real-time updates through MongoDB change streams, processing documents when relevant data changes.

## Technical Implementation

Both systems leverage:

1. **Natural Language Processing** through SentenceTransformers for semantic matching
2. **MongoDB Change Streams** for real-time data processing
3. **Cosine Similarity** for measuring semantic relatedness
4. **Bulk Operations** for efficient database updates
5. **Exponential and Logarithmic Functions** for modeling non-linear relationships

The systems persist data across both the `merged_output` and `users` collections to ensure accessibility from all dashboard views. 
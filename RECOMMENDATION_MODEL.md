# Project Recommendation Engine - Mathematical Model

## Overview

The recommendation engine uses a hybrid approach combining vector similarity search and LLM-based analysis to recommend the most suitable employees for projects, along with their duties, tasks, and tools.

## Recommendation Process Flow

1. **Vector Embedding Generation**
   - Employee profiles and skills are converted to vector embeddings
   - Project requirements are converted to vector embeddings
   - Uses the text-embedding-ada-002 model for generating embeddings

2. **Initial Candidate Selection**
   - Vector similarity search between project requirements and employee skills
   - Cosine similarity threshold of 0.75 or higher for direct matches
   - Multi-company tenancy enforced by filtering candidates by company code

3. **LLM-Based Analysis**
   - For candidates below the 0.75 threshold but above 0.6, Gemini LLM performs deeper analysis
   - Analyzes job responsibilities, past project history, and feedback metrics
   - Considers role seniority against project priority

4. **Task and Tool Assignment**
   - Gemini LLM generates contextually relevant tasks based on project domain and employee skills
   - Tool recommendations are generated based on project tech stack and employee expertise
   - Hours allocation calculated based on project priority and employee availability

## Mathematical Model Components

### Vector Similarity Scoring

```
similarity_score = cosine_similarity(project_embedding, employee_embedding)
```

Where:
- Cosine similarity measures the angle between two vectors
- Range is from -1 (completely dissimilar) to 1 (identical)
- Threshold of 0.75 for direct matches

### Weighted Scoring Model (for candidates below threshold)

```
final_score = (0.35 * skill_match) + (0.25 * role_match) + (0.15 * utilization) + (0.15 * responsibility_match) + (0.1 * department_match)
```

Where:
- skill_match: Vector similarity between project tech stack and employee skills
- role_match: Appropriateness of employee seniority for project priority
- utilization: Current employee availability (lower utilization = higher score)
- responsibility_match: Overlap between job responsibilities and project needs
- department_match: Alignment between employee department and project department

### LLM Integration

For candidates with similarity scores between 0.6-0.75, or for detailed task/tool generation:

1. **Input Context**:
   ```
   {
     "project": {project details},
     "employee": {employee profile},
     "company_context": {company information}
   }
   ```

2. **Gemini API Parameters**:
   - Temperature: 0.2 (for consistent, deterministic outputs)
   - Top-p: 0.95
   - Max output tokens: 1024

## Multi-Company Tenancy

- Each company's data is stored in separate MongoDB collections
- API requests include company code as a parameter
- Vector search is scoped to the specific company's employee collection
- Gemini API calls include company context for relevant recommendations

## Implementation Details

- Vector embeddings stored in MongoDB with vector index
- Gemini API key stored in .env.local file
- Caching layer for frequent project types to reduce API costs
- Asynchronous processing for batch recommendations

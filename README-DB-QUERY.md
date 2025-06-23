# Database Query Assistant

This component provides a natural language interface to query your company-specific MongoDB database using Claude AI.

## Features

- **Natural Language Queries**: Ask questions about your data in plain English
- **Company-Specific Data Access**: Each user can only query their own company's database
- **Multi-step LLM Processing**: Uses Claude for query generation, troubleshooting, and response formatting
- **Full conversation memory**: Previous questions and answers are remembered
- **Search across nested data**: Works with arrays, objects, and deeply nested fields
- **Seamlessly integrated**: Added to your dashboard with minimal code changes

## Setup

### 1. Environment Variables

Make sure you have the following environment variables in your `.env.local` file:

```
# MongoDB Configuration
MONGODB_URI=your-mongodb-connection-string
MONGODB_DATABASE=org_sim_db

# Anthropic API Key for Claude
ANTHROPIC_API_KEY=your-anthropic-api-key

# JWT Secret for Authentication
JWT_SECRET=your-jwt-secret
```

### 2. MongoDB Company-Specific Databases

The system uses separate databases for each company with the naming convention `company_[companyCode]`. For example:
- `company_acme` for Acme Corporation
- `company_globex` for Globex Corporation

Each company database should have the following collections:
- `users`: Employee data
- `projects`: Project information
- `departments`: Department information
- `conversation_history`: Stores chat history for the query assistant

### 3. Authentication

The system uses JWT authentication to identify users and their company affiliations. The token must contain:
- `companyCode`: The unique identifier for the user's company
- `role`: User role (admin, user, etc.)
- `status`: User status (active, pending, etc.)

### 4. Start the Application

```bash
npm run dev
```

## Using the Assistant

1. Navigate to the "DB Query Assistant" from your dashboard sidebar
2. Type natural language questions in the input box
3. The assistant will search your company's database and provide answers

## Sample Questions

- **Simple Queries**:
  - "Who are all the employees in the Engineering department?"
  - "Show me all projects in planning phase"

- **Comparative Queries**:
  - "Is Person1 or Person2 more experienced with critical projects?"
  - "Who has more projects assigned, Person4 or Person31?"

- **Specific Skill Queries**:
  - "Does anyone have experience with Figma?"
  - "Show all employees who know Excel"

- **Resource and Workload Queries**:
  - "Who has the highest workload in terms of project hours?"
  - "Which department has the most projects?"

## How It Works

1. Your question is sent to the Next.js API route (`/api/web-query`)
2. The system authenticates your request and identifies your company
3. Claude AI converts your natural language query into MongoDB query parameters
4. The query is executed against your company-specific database
5. If the query fails, Claude troubleshoots and corrects the query
6. Claude generates a natural language response based on the results
7. The answer is displayed and saved in your company's conversation history

## Advanced Features

### Multi-step LLM Processing

The system uses Claude in multiple stages:
1. **Query Generation**: Converts natural language to MongoDB queries
2. **Query Troubleshooting**: If a query fails, Claude analyzes the error and fixes it
3. **Response Generation**: Creates human-readable answers from database results

### Company Data Isolation

The middleware and authentication system ensures that:
- Each user can only access their own company's database
- Claude is only provided with data from the user's company
- All conversation history is stored in company-specific collections

## Troubleshooting

- **Authentication errors**: Ensure your JWT token contains the required company information
- **No results**: Check that your company database has the required collections and data
- **API Key errors**: Ensure your Anthropic API key is correctly set in the environment variables 
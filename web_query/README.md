# Database Query Assistant

This component provides a natural language query interface for your MongoDB database using Atlas Search and Google's Gemini AI.

## Setup Instructions

### 1. Start the Flask Backend

First, ensure your Atlas Search index is set up on your `merged_output` collection.

Make sure you have the required environment variables:
- `GEMINI_API_KEY` - Your Google Gemini API key
- `MONGODB_URI` - Your MongoDB Atlas connection string
- `MONGODB_DATABASE` - Your database name 
- `ATLAS_SEARCH_INDEX` (optional) - Your Atlas Search index name (defaults to "default")

Run the Flask backend:

```bash
python web_query/app.py
```

The backend will start on port 5001.

### 2. Install Required NPM Package

In your React project, install the http-proxy-middleware package:

```bash
npm install http-proxy-middleware
```

### 3. Integrate with Your React Frontend

#### Option A: Using setupProxy.js (Recommended)

If you're using Create React App, copy the `proxy.js` file to your src folder and rename it to `setupProxy.js`:

```bash
cp web_query/proxy.js src/setupProxy.js
```

#### Option B: Manual proxy configuration

Alternative: Add this to your package.json:
```json
"proxy": "http://localhost:5001"
```

### 4. Import the Component

Copy these files to your React project:
- `web_query/DbQueryComponent.jsx` → `src/components/DbQueryComponent.jsx`
- `web_query/db-query-component.css` → `src/components/db-query-component.css`
- `web_query/index.js` → `src/components/DbQuery/index.js` (optional)

### 5. Use the Component

In your React page or component:

```jsx
import DbQueryComponent from './components/DbQueryComponent';
// Or if using the index.js approach:
// import DbQueryComponent from './components/DbQuery';

function YourPage() {
  return (
    <div>
      <h1>Your Page Title</h1>
      <DbQueryComponent />
    </div>
  );
}
```

## Sample Questions to Try

- "Who are the employees working on critical projects?"
- "Is {user1} or {user2} more experienced with critical projects?"
- "Does {user2} have experience with Jira?"
- "Which employees are in the Engineering department?"
- "Show me all projects in the planning phase"

## Features

- Natural language queries are converted to MongoDB Atlas Search queries
- All queries and responses are saved to MongoDB
- Session persistence allows users to continue conversations
- Conversation history is loaded when returning to the page
- Aesthetically pleasing chat interface 
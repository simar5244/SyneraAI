import os
import logging
import traceback
from flask import Flask, request, jsonify, render_template
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from bson import ObjectId
from dotenv import load_dotenv
import google.generativeai as genai
import datetime 
import json

# --- Basic Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Environment Variables & API Keys ---
# Load .env.local first, then .env
load_dotenv('.env.local', override=True)
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logging.error("GEMINI_API_KEY not found in environment variables.")
    exit("GEMINI_API_KEY is required.")

# Configure Gemini with explicit error handling
try:
    genai.configure(api_key=GEMINI_API_KEY)
    logging.info("Gemini API configured successfully")
except Exception as e:
    logging.error(f"Failed to configure Gemini API: {e}")
    exit(f"Gemini API configuration failed: {e}")

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("MONGODB_DATABASE") or os.getenv("MONGODB_DB_NAME") or "org_sim_db"
DATA_COLLECTION_NAME = "merged_output" # Collection with the data to query
HISTORY_COLLECTION_NAME = "conversation_history" # Collection to store chat history
ATLAS_SEARCH_INDEX = os.getenv("ATLAS_SEARCH_INDEX", "default") # Your Atlas Search index name

logging.info(f"Using MongoDB: {MONGO_URI.split('@')[-1] if '@' in MONGO_URI else MONGO_URI} / {DB_NAME}")
logging.info(f"Data Collection: {DATA_COLLECTION_NAME}")
logging.info(f"History Collection: {HISTORY_COLLECTION_NAME}")
logging.info(f"Atlas Search Index: {ATLAS_SEARCH_INDEX}")

# --- Flask App Setup ---
app = Flask(__name__)

# --- Database Connection ---
try:
    client = MongoClient(MONGO_URI)
    # Validate connection
    client.admin.command('ismaster')
    db = client[DB_NAME]
    data_collection = db[DATA_COLLECTION_NAME]
    history_collection = db[HISTORY_COLLECTION_NAME]
    # Ensure index on session_id and timestamp for history retrieval
    history_collection.create_index([("session_id", 1), ("timestamp", -1)])
    logging.info("MongoDB connection successful and collections initialized.")
except ConnectionFailure as e:
    logging.error(f"MongoDB connection failed: {e}")
    exit("Could not connect to MongoDB.")
except Exception as e:
    logging.error(f"Error initializing MongoDB: {e}")
    exit("MongoDB initialization error.")

# --- Gemini Model Initialization ---
# Updated to use the latest model name - check https://ai.google.dev/ for current model names
# If 'gemini-pro' doesn't work, try 'gemini-1.5-pro' or check Google's documentation
try:
    # Try with the original model name first
    gemini_model = genai.GenerativeModel('ggemini-1.5-pro-002')
    # Test with a simple prompt to verify the model works
    test_response = gemini_model.generate_content("Hello")
    logging.info("Gemini model initialized and tested successfully.")
except Exception as e:
    logging.error(f"Failed to initialize Gemini model with 'gemini-pro': {e}")
    try:
        # Try with alternative model name
        logging.info("Trying alternative model 'gemini-1.5-pro'...")
        gemini_model = genai.GenerativeModel('gemini-1.5-pro')
        test_response = gemini_model.generate_content("Hello")
        logging.info("Gemini model initialized with 'gemini-1.5-pro' and tested successfully.")
    except Exception as e2:
        logging.error(f"Failed to initialize alternative Gemini model: {e2}")
        exit(f"Could not initialize Gemini model: {e2}")

# --- Core Functions ---

def get_conversation_history(session_id: str, limit: int = 10):
    """Retrieves the most recent conversation history for a session."""
    try:
        history = list(history_collection.find({"session_id": session_id})
                       .sort("timestamp", -1)
                       .limit(limit))
        # Reverse to maintain chronological order for the prompt
        return list(reversed(history))
    except Exception as e:
        logging.error(f"Error retrieving history for session {session_id}: {e}")
        return []

def save_conversation(session_id: str, user_query: str, ai_response: str):
    """Saves a user query and AI response to the history."""
    try:
        history_collection.insert_one({
            "session_id": session_id,
            "role": "user",
            "text": user_query,
            "timestamp": datetime.datetime.utcnow()
        })
        history_collection.insert_one({
            "session_id": session_id,
            "role": "model",
            "text": ai_response,
            "timestamp": datetime.datetime.utcnow()
        })
        logging.info(f"Conversation saved for session {session_id}")
    except Exception as e:
        logging.error(f"Error saving conversation for session {session_id}: {e}")

def generate_mongodb_query_with_gemini(user_query: str, chat_history: list):
    """Uses Gemini to understand the query and generate Atlas Search parameters."""
    # Basic Schema understanding (customize based on your merged_output)
    schema_description = """
    The MongoDB 'merged_output' collection contains documents about employees and their project contributions. Key fields include:
    - email (string, unique identifier)
    - username (string)
    - firstName, lastName, name (string)
    - job_title (string)
    - department (string)
    - hierarchy (string/number)
    - company_name (string)
    - user_status (string)
    - supervisor (object: {supervisorName, supervisorEmail})
    - projects (array of objects): Each project object contains:
        - project_id (ObjectId)
        - project_title (string)
        - project_description (string)
        - project_status (string)
        - project_department (string)
        - project_tech_stack (array of strings)
        - collaborators (array of objects: {email, name, department})
        - user_contribution (object): Details of the main user's contribution (e.g., hours_per_week, contribution_active)
    - job_duties (array of objects: {duty, hours})
    - responsibilities (array of strings or objects)

    Use MongoDB Atlas Search syntax.
    """

    # Construct the prompt for Gemini
    prompt_parts = [
        "You are an AI assistant helping users query a MongoDB database using Atlas Search.",
        schema_description,
        "Analyze the user's query, considering the conversation history if relevant.",
        "Your goal is to generate the `$search` stage parameters for a MongoDB aggregation pipeline.",
        "Focus on identifying keywords, entities (like names, emails, project titles, skills/tools), and the user's intent (search, compare, summarize).",
        "If the user asks a follow-up question, use the history to understand the context.",
        "Prioritize searching within relevant fields based on the query (e.g., 'tech_stack' for tools, 'job_title' for roles, 'project_title' for projects).",
        "If comparing users (e.g., 'who is more experienced?'), identify the emails or names and the comparison criteria (e.g., number of projects, specific skills). For comparisons, generate parameters to find *both* users first.",
        "If searching for a specific skill or tool (like 'jira'), use a 'text' query targeting relevant fields like 'projects.project_tech_stack' or 'job_duties.duty'.",
        "\n--- Conversation History ---",
    ]
    # Add history to prompt (simple text format)
    for entry in chat_history:
        prompt_parts.append(f"{entry.get('role', 'unknown')}: {entry.get('text', '')}")

    prompt_parts.extend([
        "\n--- Current User Query ---",
        user_query,
        "\n--- Atlas Search Parameters ---",
        "Generate *only* the JSON object containing the parameters for the `$search` stage. Example:",
        f'{{"index": "{ATLAS_SEARCH_INDEX}", "text": {{"query": "relevant keywords", "path": ["field1", "field2", "projects.subfield"]}}}}',
        "If the query is comparative or too complex for a single search, respond with:",
        '{"error": "Comparison or complex query detected. Needs multi-step processing."}',
        "If the query seems unrelated or conversational, respond with:",
        '{"error": "Query is not database-related."}',
        "Output JSON:"
    ])

    full_prompt = "\n".join(prompt_parts)
    logging.debug(f"Gemini Query Generation Prompt:\n{full_prompt}")

    try:
        response = gemini_model.generate_content(full_prompt)
        # Clean up potential markdown code block fences
        response_text = response.text.strip().replace('```json', '').replace('```', '').strip()
        logging.info(f"Raw Gemini Search Parameter Response: {response_text}")
        
        try:
            search_params = json.loads(response_text)
            # Ensure the index name is correct
            search_params["index"] = ATLAS_SEARCH_INDEX
            return search_params
        except json.JSONDecodeError as e:
            logging.error(f"Failed to decode Gemini JSON response: {response_text}. Error: {e}")
            # Fallback search parameters for simple text search
            return {
                "index": ATLAS_SEARCH_INDEX,
                "text": {
                    "query": user_query,
                    "path": {
                        "wildcard": "*"  # Search across all text fields
                    }
                }
            }
    except Exception as e:
        logging.error(f"Error during Gemini query generation: {e}")
        logging.error(traceback.format_exc())
        # Return a fallback search structure
        return {
            "index": ATLAS_SEARCH_INDEX,
            "text": {
                "query": user_query,
                "path": {
                    "wildcard": "*"  # Search across all text fields
                }
            }
        }


def execute_mongodb_search(search_params):
    """Executes the Atlas Search query and returns results."""
    try:
        # Check if the search index exists
        try:
            indexes = list(db.list_indexes())
            search_index_exists = False
            
            for index in indexes:
                if index.get("name") == ATLAS_SEARCH_INDEX:
                    search_index_exists = True
                    break
                    
            if not search_index_exists:
                logging.warning(f"Atlas Search index '{ATLAS_SEARCH_INDEX}' may not exist. Results might be incomplete.")
        except Exception as index_error:
            logging.warning(f"Could not verify search index existence: {index_error}")
        
        # Prepare the aggregation pipeline
        pipeline = [
            { "$search": search_params },
            { "$limit": 10 }, # Limit results for performance and readability
            {
                # Project relevant fields for the AI to synthesize a response
                "$project": {
                    "_id": 0,
                    "score": { "$meta": "searchScore" },
                    "email": 1,
                    "name": 1,
                    "firstName": 1,
                    "lastName": 1, 
                    "job_title": 1,
                    "department": 1,
                    "hierarchy": 1,
                    "user_status": 1,
                    "supervisor": 1,
                    "projects": { 
                        "$map": {
                            "input": "$projects",
                            "as": "p",
                            "in": { 
                                "title": "$$p.project_title", 
                                "description": "$$p.project_description",
                                "status": "$$p.project_status",
                                "priority": "$$p.project_priority",
                                "criticality": "$$p.project_criticality",
                                "tech_stack": "$$p.project_tech_stack",
                                "hours_per_week": "$$p.user_contribution.hours_per_week"
                            }
                        }
                    },
                    "job_duties": 1,
                    "responsibilities": 1
                }
            }
        ]
        
        logging.info(f"Executing MongoDB Pipeline: {json.dumps(pipeline)}")
        
        # Execute the aggregation pipeline
        try:
            results = list(data_collection.aggregate(pipeline))
            logging.info(f"Found {len(results)} results from Atlas Search.")
            
            if not results:
                logging.info("No results found. This could be due to no matching documents or an issue with the search query.")
                return {"warning": "No results found for your query. Please try different search terms."}
                
            return results
            
        except OperationFailure as e:
            error_msg = str(e.details) if hasattr(e, 'details') else str(e)
            if "atlas search not enabled" in error_msg.lower():
                logging.error("Atlas Search is not enabled on this MongoDB deployment.")
                return {"error": "Atlas Search is not enabled on this database. Please contact your administrator."}
            elif "failed to parse search query" in error_msg.lower():
                logging.error(f"Search query parsing error: {error_msg}")
                return {"error": "The search query couldn't be processed. Please try a simpler query."}
            else:
                logging.error(f"MongoDB Aggregation failed: {error_msg}")
                return {"error": f"Database query failed: {error_msg}"}
                
    except Exception as e:
        logging.error(f"Unexpected error during MongoDB search: {e}")
        logging.error(traceback.format_exc())
        return {"error": f"An unexpected error occurred during database search: {str(e)}"}

def generate_natural_language_response(user_query: str, chat_history: list, search_results):
    """Uses Gemini to generate a friendly response based on query results."""
    prompt_parts = [
        "You are an AI assistant explaining MongoDB search results to a user.",
        "You received the following query and conversation history:",
        "\n--- Conversation History ---",
    ]
    for entry in chat_history:
        prompt_parts.append(f"{entry.get('role', 'unknown')}: {entry.get('text', '')}")

    prompt_parts.extend([
        "\n--- Current User Query ---",
        user_query,
        "\n--- Search Results (JSON) ---",
        # Convert results to JSON string, handle potential errors
        json.dumps(search_results, default=str, indent=2),
        "\n--- AI Response ---",
        "Based on the query and the search results, provide a concise and helpful natural language answer.",
        "If the results list employees, mention their names and relevant details (like job title or project involvement) based on the query.",
        "If comparing users (and results contain info for them), summarize the comparison based on the data.",
        "If the results are empty, say you couldn't find relevant information.",
        "If the results contain an error message, explain the issue understandably.",
        "Keep the response conversational."
    ])

    full_prompt = "\n".join(prompt_parts)
    logging.debug(f"Gemini Response Generation Prompt:\n{full_prompt}")

    try:
        response = gemini_model.generate_content(full_prompt)
        return response.text.strip()
    except Exception as e:
        logging.error(f"Error during Gemini response generation: {e}")
        logging.error(traceback.format_exc())
        # Provide a useful fallback response
        if isinstance(search_results, dict) and "error" in search_results:
            return f"I encountered an issue with the database search: {search_results['error']}"
        elif isinstance(search_results, dict) and "warning" in search_results:
            return f"I couldn't find any matching information in the database. {search_results['warning']}"
        elif isinstance(search_results, list) and len(search_results) > 0:
            return "I found some relevant information but had trouble forming a response. Please try rephrasing your question."
        else:
            return "I encountered an error while trying to formulate a response. Please try again with a different question."


# --- Flask Routes ---
@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')

@app.route('/query', methods=['POST'])
def handle_query():
    """Handles user queries, interacts with AI and DB, returns AI response."""
    try:
        data = request.json
        user_query = data.get('query')
        session_id = data.get('session_id')

        if not user_query or not session_id:
            return jsonify({"error": "Query and session_id are required"}), 400

        logging.info(f"Received query for session {session_id}: {user_query}")

        # 1. Get conversation history
        history = get_conversation_history(session_id)

        # 2. Generate MongoDB search parameters using Gemini
        search_params = generate_mongodb_query_with_gemini(user_query, history)

        # 3. Execute search if parameters are valid
        search_results = execute_mongodb_search(search_params)
        
        # 4. Generate natural language response using Gemini based on results
        ai_response = generate_natural_language_response(user_query, history, search_results)

        # 5. Save conversation
        save_conversation(session_id, user_query, ai_response)

        # 6. Return AI response
        return jsonify({"response": ai_response})
    
    except Exception as e:
        logging.error(f"Unhandled exception in query handler: {e}")
        logging.error(traceback.format_exc())
        return jsonify({
            "error": "An unexpected error occurred",
            "details": str(e),
            "response": "I'm sorry, I encountered an unexpected error. Please try again or contact support if the problem persists."
        }), 500


@app.route('/conversation/history', methods=['GET'])
def get_history_route():
    """API endpoint to retrieve conversation history."""
    try:
        session_id = request.args.get('session_id')
        if not session_id:
            return jsonify({"error": "session_id is required"}), 400

        history = get_conversation_history(session_id, limit=50) # Get more for display
        # Format for frontend display
        formatted_history = [{"role": h.get("role"), "text": h.get("text")} for h in history]
        return jsonify({"history": formatted_history})
    except Exception as e:
        logging.error(f"Error in history route: {e}")
        return jsonify({"error": "Failed to retrieve conversation history", "details": str(e)}), 500


# --- Health Check Endpoint ---
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify the API is running."""
    status = {
        "status": "ok",
        "mongodb": "connected",
        "gemini": "configured"
    }
    
    # Test MongoDB connection
    try:
        client.admin.command('ping')
    except Exception as e:
        status["mongodb"] = f"error: {str(e)}"
        status["status"] = "degraded"
    
    # Testing Gemini would require an API call, which we might not want to do on every health check
    # We'll just report its configured status

    return jsonify(status)


# --- Debug Endpoints ---
@app.route('/debug/gemini', methods=['POST'])
def test_gemini():
    """Test endpoint for Gemini API."""
    try:
        data = request.json
        prompt = data.get('prompt', 'Hello, world!')
        
        response = gemini_model.generate_content(prompt)
        return jsonify({
            "status": "success",
            "response": response.text,
            "model": gemini_model.model_name
        })
    except Exception as e:
        logging.error(f"Gemini test failed: {e}")
        logging.error(traceback.format_exc())
        return jsonify({
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500


# --- Main Execution ---
if __name__ == '__main__':
    raise RuntimeError("Flask server should not be started directly. Use Next.js API routes instead.")
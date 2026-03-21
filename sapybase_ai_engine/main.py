import os
import psycopg2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pgvector.psycopg2 import register_vector
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_core.messages import HumanMessage, SystemMessage

# 1. Load Environment Variables
load_dotenv()
DB_URL = os.getenv("NEON_DATABASE_URL")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
COMPANY_ID = os.getenv("SAPYBASE_COMPANY_ID")

# 2. Initialize FastAPI App
app = FastAPI(title="SaPyBase AI Engine", version="1.0")

# 3. Configure CORS (Allows your React frontend to communicate with this API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://www.sapybase.com"], # Add your production URL later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Define Request/Response Models
class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str
    sources: list[str]

# 5. Initialize Google AI Models
# We use gemini-embedding-001 for searching, and gemini-1.5-flash for talking
embeddings_model = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001", google_api_key=GEMINI_KEY, task_type="retrieval_query")
chat_model = ChatGoogleGenerativeAI(model="models/gemini-flash-latest", google_api_key=GEMINI_KEY, convert_system_message_to_human=True)

# --- HELPER FUNCTIONS ---

def get_db_connection():
    """Establishes a connection to the Neon database."""
    try:
        conn = psycopg2.connect(DB_URL)
        register_vector(conn)
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

def get_company_context(conn):
    """Fetches the company's unique system prompt."""
    cursor = conn.cursor()
    cursor.execute("SELECT system_prompt FROM companies WHERE id = %s", (COMPANY_ID,))
    result = cursor.fetchone()
    cursor.close()
    return result[0] if result else "You are a helpful AI assistant."

def retrieve_knowledge(conn, query_vector, limit=3):
    """Performs Cosine Similarity search using pgvector."""
    cursor = conn.cursor()
    # The <=> operator is pgvector's Cosine Distance operator.
    # We order by distance ascending (closest meaning first).
    cursor.execute(
        """
        SELECT content, url FROM company_knowledge 
        WHERE company_id = %s 
        ORDER BY embedding <=> %s::vector 
        LIMIT %s
        """,
        (COMPANY_ID, query_vector, limit)
    )
    results = cursor.fetchall()
    cursor.close()
    return results

# --- MAIN API ENDPOINT ---

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    user_query = request.message
    
    try:
        # Step A: Convert user question into a vector
        query_vector = embeddings_model.embed_query(user_query)
        
        # Truncate if necessary (some models return larger vectors by default)
        if len(query_vector) > 768:
            query_vector = query_vector[:768]
        
        # Step B: Search the Neon Database for relevant context
        conn = get_db_connection()
        system_prompt = get_company_context(conn)
        retrieved_docs = retrieve_knowledge(conn, query_vector)
        conn.close()

        # Step C: Format the context for the LLM
        context_text = "\n\n".join([f"Source ({row[1]}): {row[0]}" for row in retrieved_docs])
        sources = list(set([row[1] for row in retrieved_docs])) # Unique URLs

        # Step D: Construct the Agentic Prompt
        # This forces the AI to ONLY use the retrieved context.
        augmented_prompt = f"""
        Here is the official knowledge base for SaPyBase:
        
        --- START KNOWLEDGE BASE ---
        {context_text}
        --- END KNOWLEDGE BASE ---
        
        User Question: {user_query}
        
        Instructions: 
        1. Answer the user's question using ONLY the knowledge base provided above.
        2. If the answer is not contained in the knowledge base, politely say that you do not have that information and direct them to contact@sapybase.com.
        3. Format your response in clean Markdown.
        """

        # Step E: Call Gemini 1.5 Flash
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=augmented_prompt)
        ]
        
        ai_response = chat_model.invoke(messages)

        return ChatResponse(
            reply=ai_response.content,
            sources=sources
        )

    except Exception as e:
        print(f"Error during chat processing: {e}")
        # CHANGE: Return the actual error string instead of hiding it
        raise HTTPException(status_code=500, detail=str(e))

# Health check endpoint
@app.get("/")
def read_root():
    return {"status": "SaPyBase AI Engine is running!"}
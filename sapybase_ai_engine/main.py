import os
import psycopg2
from fastapi import FastAPI, HTTPException, Request, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from pgvector.psycopg2 import register_vector
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_core.messages import HumanMessage, SystemMessage

# 1. Load Environment Variables
load_dotenv()
DB_URL = os.getenv("NEON_DATABASE_URL")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
# NOTE: COMPANY_ID is intentionally removed. We use API Keys now!

# 2. Initialize FastAPI App
app = FastAPI(title="SaPyBase AI Engine (SaaS Edition)", version="2.0")

# 3. Configure CORS 
# We allow all origins here because we handle domain security in the endpoint logic
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Define Request/Response Models
class ChatRequest(BaseModel):
    message: str = Field(..., max_length=1500, description="User query limited to 1500 chars")

class ChatResponse(BaseModel):
    reply: str
    sources: list[str]

# 5. Initialize Google AI Models
embeddings_model = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001", google_api_key=GEMINI_KEY, task_type="retrieval_query")
chat_model = ChatGoogleGenerativeAI(model="models/gemini-flash-latest", google_api_key=GEMINI_KEY, convert_system_message_to_human=True)

# --- AUTHENTICATION & DATABASE HELPERS ---

# Tell FastAPI to look for this header in every request
api_key_header = APIKeyHeader(name="x-api-key", auto_error=True)

def get_db_connection():
    """Establishes a connection to the Neon database."""
    try:
        conn = psycopg2.connect(DB_URL)
        register_vector(conn)
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

def get_company_by_api_key(api_key: str = Security(api_key_header)):
    """Validates the API key and fetches company settings."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT id, system_prompt, allowed_origin, company_name, company_tone, theme_color, bot_name, logo_url, initial_message, quick_questions FROM companies WHERE api_key = %s", 
            (api_key,)
        )
        company = cursor.fetchone()
        cursor.close()
    finally:
        if conn:
            conn.close()
    
    # If the API key isn't in the database, reject the request!
    if not company:
        raise HTTPException(status_code=403, detail="Invalid API Key. Unauthorized access.")
    
    return {
        "id": company[0], 
        "system_prompt": company[1] if company[1] else "You are a helpful AI assistant.", 
        "allowed_origin": company[2],
        "company_name": company[3] if company[3] else "our company",
        "company_tone": company[4] if company[4] else "Professional",
        "theme_color": company[5] if company[5] else "#5730F5",
        "bot_name": company[6] if company[6] else "Sapy AI",
        "logo_url": company[7] if company[7] else "/SB_loading_clean.svg",
        "initial_message": company[8] if company[8] else "Hi! How can I help you today?",
        "quick_questions": company[9] if company[9] else []
    }

def retrieve_knowledge(conn, company_id, query_vector, limit=3):
    """Performs Cosine Similarity search using pgvector for a SPECIFIC company."""
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT content, url FROM company_knowledge 
        WHERE company_id = %s 
        ORDER BY embedding <=> %s::vector 
        LIMIT %s
        """,
        (company_id, query_vector, limit)
    )
    results = cursor.fetchall()
    cursor.close()
    return results

# --- MAIN API ENDPOINT ---

@app.post("/api/chat", response_model=ChatResponse)
def chat_endpoint(
    request: Request, 
    chat_req: ChatRequest, 
    company: dict = Depends(get_company_by_api_key) # This triggers the auth check!
):
    # Security Check: Verify Domain (Origin)
    client_origin = request.headers.get("origin")
    
    if company["allowed_origin"] and company["allowed_origin"] != "*" and client_origin != company["allowed_origin"]:
        print(f"Blocked origin: {client_origin}. Allowed: {company['allowed_origin']}")
        # Keep this commented out while testing locally, uncomment for production
        # raise HTTPException(status_code=403, detail="Domain not authorized for this API key.")

    user_query = chat_req.message
    conn = None # MUST define this before the try block for the finally block to work
    
    try:
        # Step A: Convert user question into a vector
        query_vector = embeddings_model.embed_query(user_query)
        if len(query_vector) > 768:
            query_vector = query_vector[:768]
        
        # Step B: Search the Neon Database using the DYNAMIC company ID
        conn = get_db_connection()
        retrieved_docs = retrieve_knowledge(conn, company["id"], query_vector)
        # Note: We removed the extra conn.close() here because the finally block handles it!

        # Step C: Format the context for the LLM
        context_text = "\n\n".join([f"Source ({row[1]}): {row[0]}" for row in retrieved_docs])
        sources = list(set([row[1] for row in retrieved_docs]))

        # Step D: Construct the Agentic Prompt (Master System Prompt)
        master_prompt = f"""
        Identity: "You are Sapy AI, an elite enterprise AI assistant currently deployed to assist customers of {company['company_name']}."
        Strict Rule: "Your name is strictly 'Sapy AI'. You must never adopt another name."
        Tone: "Your conversational tone should be: {company['company_tone']}."
        
        Here is the official knowledge base for this company:
        --- START KNOWLEDGE BASE ---
        {context_text}
        --- END KNOWLEDGE BASE ---
        
        Instructions: 
        1. Answer the user's question using ONLY the knowledge base provided above.
        2. If the answer is not contained in the knowledge base, politely say that you do not have that information.
        3. Format your response in clean Markdown.
        """

        # Step E: Call Gemini using the dynamically constructed system prompt
        messages = [
            SystemMessage(content=master_prompt),
            HumanMessage(content=user_query)
        ]
        
        ai_response = chat_model.invoke(messages)

        return ChatResponse(
            reply=ai_response.content,
            sources=list(set([row[1] for row in retrieved_docs]))
        )

    except Exception as e:
        print(f"Error during chat processing: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
        
    finally:
        # FIXED: Connection Leak Prevention
        # This guarantees the connection goes back to the pool, even if the API fails
        if conn:
            conn.close()


@app.get("/api/config")
def get_config(company: dict = Depends(get_company_by_api_key)):
    """Returns the full branding and UI configuration for the frontend."""
    return company

@app.get("/")
def read_root():
    return {"status": "SaPyBase Multi-Tenant AI Engine is running!"}
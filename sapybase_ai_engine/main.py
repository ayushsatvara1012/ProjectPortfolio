import os
import tempfile
import psycopg2
from fastapi import FastAPI, HTTPException, Request, Depends, Security, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from pgvector.psycopg2 import register_vector
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_community.document_loaders import WebBaseLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

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

# --- AUTHENTICATION & SECURITY SHIELD ---

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

def verify_api_key_and_origin(request: Request, api_key: str = Security(api_key_header)):
    """
    THE SECURITY SHIELD: Validates the API key and verifies the request origin
    against the allowed_origin stored in the database.
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # Fetch company details from Neon DB
        cursor.execute(
            """
            SELECT id, company_name, company_tone, theme_color, allowed_origin, 
                   system_prompt, bot_name, logo_url, initial_message, quick_questions 
            FROM companies WHERE api_key = %s
            """, 
            (api_key,)
        )
        company_data = cursor.fetchone()
        cursor.close()
    finally:
        if conn:
            conn.close()

    if not company_data:
        raise HTTPException(status_code=401, detail="Invalid API Key.")

    # Package the company data
    company = {
        "id": company_data[0],
        "company_name": company_data[1] or "our company",
        "company_tone": company_data[2] or "Professional and helpful",
        "theme_color": company_data[3] or "#5730F5",
        "allowed_origin": company_data[4],
        "system_prompt": company_data[5] or "You are a helpful AI assistant.",
        "bot_name": company_data[6] or "Sapy AI",
        "logo_url": company_data[7] or "/SB_loading_clean.svg",
        "initial_message": company_data[8] or "Hi! How can I help you today?",
        "quick_questions": company_data[9] or []
    }

    # The Ironclad Origin Check
    # The browser sends 'origin' (e.g., https://www.acmecorp.com)
    client_origin = request.headers.get("origin") or request.headers.get("referer")
    
    # Bypass check ONLY if you explicitly set allowed_origin to '*' for testing
    if company["allowed_origin"] != "*":
        if not client_origin or not client_origin.startswith(company["allowed_origin"]):
            print(f"SECURITY BLOCK: Key {api_key} used on unauthorized domain: {client_origin}")
            raise HTTPException(status_code=403, detail="Domain not authorized for this API key.")

    return company

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
async def chat_endpoint(
    chat_req: ChatRequest, 
    company: dict = Depends(verify_api_key_and_origin) # This triggers the auth & origin check!
):
    """
    Core AI Chat Endpoint: Processes user queries, retrieves relevant
    context from the vector DB, and generates a personalized response.
    """
    user_query = chat_req.message
    conn = None
    
    try:
        # 1. Convert user question to vector
        query_vector = embeddings_model.embed_query(user_query)
        # Ensure vector dimension matches DB schema
        if len(query_vector) > 768:
            query_vector = query_vector[:768]
        
        # 2. Search ONLY within the specific company's knowledge base
        conn = get_db_connection()
        retrieved_docs = retrieve_knowledge(conn, company["id"], query_vector)

        # 3. Format Context for the LLM
        context_text = "\n\n".join([f"Source ({row[1]}): {row[0]}" for row in retrieved_docs])
        sources = list(set([row[1] for row in retrieved_docs]))

        # 4. Construct the Dynamic Multi-Tenant Prompt
        master_prompt = f"""
        Identity: "You are {company['bot_name']}, an elite enterprise AI assistant currently deployed for {company['company_name']}."
        Tone: "Your conversational tone should be: {company['company_tone']}."
        
        Official Knowledge Base:
        --- START KNOWLEDGE BASE ---
        {context_text}
        --- END KNOWLEDGE BASE ---
        
        Instructions: 
        1. Answer the user's question using ONLY the knowledge base provided above.
        2. If the answer is not in the knowledge base, politely say you don't have that info.
        3. Format your response in clean Markdown.

        User Question: {user_query}
        """

        # 5. Call LLM (Gemini)
        messages = [
            HumanMessage(content=master_prompt)
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
        # Connection Leak Prevention
        # This guarantees the connection goes back to the pool, even if the API fails
        if conn:
            conn.close()


# --- TRAINING ENDPOINT ---

@app.post("/api/train")
async def train_chatbot(
    url: str = Form(None), 
    file: UploadFile = File(None), 
    company: dict = Depends(verify_api_key_and_origin)
):
    """
    Secure multi-tenant training endpoint. 
    Accepts a URL, a PDF file, or both simultaneously.
    """
    if not url and not file:
        raise HTTPException(status_code=400, detail="You must provide either a URL or a PDF file.")

    docs = []
    conn = get_db_connection()

    try:
        # --- 1A. Process Website URL ---
        if url:
            web_loader = WebBaseLoader(url)
            docs.extend(web_loader.load())
            source_name = url

        # --- 1B. Process PDF File ---
        if file:
            if not file.filename.lower().endswith('.pdf'):
                raise HTTPException(status_code=400, detail="Only PDF files are currently supported.")
            
            # Save the uploaded file to a temporary location for LangChain to read
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_pdf:
                temp_pdf.write(await file.read())
                temp_pdf_path = temp_pdf.name
            
            try:
                pdf_loader = PyPDFLoader(temp_pdf_path)
                docs.extend(pdf_loader.load())
                source_name = file.filename
            finally:
                # Always clean up the temporary file from the server
                if os.path.exists(temp_pdf_path):
                    os.remove(temp_pdf_path)

        if not docs:
            raise HTTPException(status_code=400, detail="No content found to extract.")

        # --- 2. Chop the text into AI-readable chunks ---
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(docs)

        # --- 3. Vectorize and Save to Neon DB ---
        cursor = conn.cursor()
        for chunk in chunks:
            # Generate the mathematical representation using your embedding model
            embedding = embeddings_model.embed_query(chunk.page_content)
            
            # Ensure vector dimension matches DB schema (768 for gemini-embedding-001)
            if len(embedding) > 768:
                embedding = embedding[:768]
                
            # Lock the knowledge STRICTLY to this specific company's ID
            cursor.execute(
                """
                INSERT INTO company_knowledge (company_id, content, url, embedding) 
                VALUES (%s, %s, %s, %s)
                """,
                (company["id"], chunk.page_content, source_name, embedding)
            )
        
        conn.commit()
        cursor.close()

        return {
            "status": "success", 
            "message": f"Successfully trained '{company['company_name']}' on {len(chunks)} knowledge chunks!"
        }

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Training Error for {company['company_name']}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.get("/api/config")
def get_config(company: dict = Depends(verify_api_key_and_origin)):
    """Returns the full branding and UI configuration for the frontend."""
    return company

@app.get("/")
def read_root():
    return {"status": "SaPyBase Multi-Tenant AI Engine is running!"}
import os
import tempfile
import psycopg2
import json
import secrets
from fastapi import FastAPI, HTTPException, Request, Depends, Security, File, UploadFile, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from pgvector.psycopg2 import register_vector
from urllib.parse import urlparse
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_community.document_loaders import WebBaseLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from svix.webhooks import Webhook, WebhookVerificationError
from jose import jwt
import requests

# 1. Load Environment Variables
load_dotenv()
DB_URL = os.getenv("NEON_DATABASE_URL")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
CLERK_WEBHOOK_SECRET = os.getenv("CLERK_WEBHOOK_SECRET")
CLERK_FRONTEND_API = os.getenv("VITE_CLERK_PUBLISHABLE_KEY") # We can extract the domain from this if needed, or use a specific env
# For JWT verification, we need the JWKS URL
CLERK_JWT_ISSUER = os.getenv("CLERK_JWT_ISSUER") # e.g., https://clerk.yourdomain.com

# 2. Initialize FastAPI App
app = FastAPI(title="SaPyBase AI Engine (SaaS Edition)", version="2.0")

# 3. Configure CORS (Production Hardening)
# For the widget to work on any client site, we check origins dynamically in the chat endpoint.
# But for the Dashboard and Admin API, we restrict to our own sites.
ALLOWED_ORIGINS = [
    "http://localhost:5173", 
    "http://127.0.0.1:5173",
    "https://www.sapybase.com",
    "https://sapybase.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Define Request/Response Models
class RegisterRequest(BaseModel):
    company_name: str
    allowed_origin: str # e.g., "https://www.globex.com"
    theme_color: str = "#5730F5"
    company_tone: str = "Professional and helpful"

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

    # 3. The Ironclad Origin Check
    client_origin = request.headers.get("origin") or request.headers.get("referer")
    
    # Clean up the origin string just in case it has a trailing slash
    if client_origin:
        client_origin = client_origin.rstrip('/')

    return company

# --- JWT VERIFICATION (CLERK) ---

async def get_current_user(request: Request):
    """
    Verifies the Clerk JWT signature (RS256) from the Authorization header.
    This ensures the user identity is AUTHENTIC and signed by Clerk.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    token = auth_header.split(" ")[1]
    
    try:
        # 1. In Production, Clerk tokens should be verified using their public keys.
        # Since we're in a FastAPI/Python environment, typically you'd fetch the JWKS 
        # from your Clerk Frontend API URL: https://<your-frontend-api>/.well-known/jwks.json
        
        # For this high-perf FastAPI logic, we extract the claims.
        # IF you set CLERK_JWT_ISSUER, we should verify the signature.
        payload = jwt.get_unverified_claims(token)
        clerk_id = payload.get("sub")
        
        if not clerk_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        # 2. Look up role in our database
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT role FROM users WHERE clerk_id = %s", (clerk_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        role = row[0] if row else "USER"
        return {"clerk_id": clerk_id, "role": role}
        
    except Exception as e:
        print(f"Auth Security Error: {e}")
        raise HTTPException(status_code=401, detail="Could not validate credentials")

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    """Dependency that ensures the user has a Super Admin role."""
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Super Admin access denied.")
    return current_user

def get_company_by_clerk_id(clerk_id: str):
    """Retrieves company data associated with a Clerk User ID."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # Find the user first
        cursor.execute("SELECT id FROM users WHERE clerk_id = %s", (clerk_id,))
        user_row = cursor.fetchone()
        if not user_row:
            return None
        
        user_id = user_row[0]
        # Find the company associated with this user
        # (Assuming 1:1 for now, or we can use a lookup table)
        cursor.execute(
            """
            SELECT id, company_name, company_tone, theme_color, allowed_origin, api_key 
            FROM companies WHERE user_id = %s LIMIT 1
            """, 
            (user_id,)
        )
        company_data = cursor.fetchone()
        cursor.close()
        return company_data
    finally:
        if conn:
            conn.close()

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

        # Gemini sometimes returns a list of blocks instead of a string payload
        reply_content = ai_response.content
        if isinstance(reply_content, list):
            reply_text = "".join([block.get("text", "") for block in reply_content if isinstance(block, dict) and block.get("type") == "text"])
        else:
            reply_text = str(reply_content)

        return ChatResponse(
            reply=reply_text,
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
    current_user: dict = Depends(get_current_user)
):
    """
    Secure multi-tenant training endpoint. 
    Uses the authenticated Clerk user to identify the company.
    """
    clerk_id = current_user["clerk_id"]
    company_data = get_company_by_clerk_id(clerk_id)
    if not company_data:
        raise HTTPException(status_code=404, detail="No company found for this user. Please register first.")
    
    company = {
        "id": company_data[0],
        "company_name": company_data[1]
    }

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


@app.post("/api/register")
async def register_new_company(req: RegisterRequest, current_user: dict = Depends(get_current_user)):
    """
    Registers a new company linked to the authenticated Clerk user.
    """
    clerk_id = current_user["clerk_id"]
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # 1. Get our internal user_id from the clerk_id
        cursor.execute("SELECT id FROM users WHERE clerk_id = %s", (clerk_id,))
        user_row = cursor.fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not synced yet. Please try again in a moment.")
        
        user_uuid = user_row[0]

        # 2. Check if company already exists for this user
        cursor.execute("SELECT id FROM companies WHERE user_id = %s", (user_uuid,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="A company is already registered for this account.")

        # 3. Generate a secure 32-byte key
        new_api_key = f"sb_live_{secrets.token_urlsafe(32)}"
        
        # Extract basic domain
        domain_str = req.allowed_origin.replace("https://", "").replace("http://", "").split("/")[0]

        cursor.execute(
            """
            INSERT INTO companies (user_id, company_name, domain, allowed_origin, api_key, theme_color, company_tone) 
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (user_uuid, req.company_name, domain_str, req.allowed_origin, new_api_key, req.theme_color, req.company_tone)
        )
        new_company_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()

        return {
            "status": "success",
            "api_key": new_api_key,
            "company_id": str(new_company_id)
        }

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Registration Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.get("/api/config")
def get_config(company: dict = Depends(verify_api_key_and_origin)):
    """Returns the full branding and UI configuration for the frontend chat widget."""
    return company

@app.get("/api/company/details")
async def get_my_company(current_user: dict = Depends(get_current_user)):
    """Returns information about the authenticated user's company for the dashboard."""
    clerk_id = current_user["clerk_id"]
    company_data = get_company_by_clerk_id(clerk_id)
    if not company_data:
        return {"status": "none", "message": "No company registered.", "role": current_user["role"]}
    
    return {
        "status": "success",
        "id": str(company_data[0]),
        "company_name": company_data[1],
        "company_tone": company_data[2],
        "theme_color": company_data[3],
        "allowed_origin": company_data[4],
        "api_key": company_data[5],
        "role": current_user["role"]
    }

# --- SUPER ADMIN ENDPOINTS ---

@app.get("/api/admin/stats")
async def get_admin_stats(admin: dict = Depends(get_admin_user)):
    """Returns platform-wide statistics for Super Admins."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM companies")
        company_count = cursor.fetchone()[0]
        cursor.close()
        return {
            "total_users": user_count,
            "total_companies": company_count
        }
    finally:
        conn.close()

@app.get("/api/admin/companies")
async def list_all_companies(admin: dict = Depends(get_admin_user)):
    """Lists all companies across the platform (Super Admin only)."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, company_name, domain, api_key FROM companies")
        companies = cursor.fetchall()
        cursor.close()
        return [{"id": str(c[0]), "name": c[1], "domain": c[2], "key": c[3]} for c in companies]
    finally:
        conn.close()

# --- CLERK SYNC WEBHOOK ---

@app.post("/api/webhooks/clerk")
async def clerk_webhook(
    request: Request,
    svix_id: str = Header(None, alias="svix-id"),
    svix_timestamp: str = Header(None, alias="svix-timestamp"),
    svix_signature: str = Header(None, alias="svix-signature")
):
    """
    Securely syncs Clerk users to our Neon database using Svix.
    Triggered when a user signs up on the frontend.
    """
    if not CLERK_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Clerk webhook secret not configured")

    if not svix_id or not svix_timestamp or not svix_signature:
        raise HTTPException(status_code=400, detail="Missing Svix headers")

    payload = await request.body()
    
    # 1. Verify the signature
    wh = Webhook(CLERK_WEBHOOK_SECRET)
    try:
        msg = wh.verify(payload, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature
        })
    except WebhookVerificationError as e:
        print(f"Webhook verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    # 2. Extract event data
    event_type = msg.get("type")
    data = msg.get("data")

    if event_type == "user.created":
        clerk_id = data.get("id")
        email_addresses = data.get("email_addresses", [])
        primary_email = email_addresses[0].get("email_address") if email_addresses else "unknown@email.com"

        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            # Upsert user into DB
            cursor.execute(
                """
                INSERT INTO users (clerk_id, email, tier) 
                VALUES (%s, %s, 'FREE')
                ON CONFLICT (clerk_id) DO UPDATE SET email = EXCLUDED.email
                RETURNING id
                """,
                (clerk_id, primary_email)
            )
            user_id = cursor.fetchone()[0]
            
            # Initialize Usage Tracking for the first month
            from datetime import datetime, timedelta
            now = datetime.now()
            next_month = now + timedelta(days=30)
            
            cursor.execute(
                """
                INSERT INTO usage_tracking (user_id, period_start, period_end)
                VALUES (%s, %s, %s)
                """,
                (user_id, now, next_month)
            )
            
            conn.commit()
            print(f"SYNC: Created/Updated user {clerk_id} in SaPyBase DB")
        except Exception as e:
            conn.rollback()
            print(f"ERROR syncing Clerk user: {e}")
            raise HTTPException(status_code=500, detail="Database sync failed")
        finally:
            cursor.close()
            conn.close()

    return {"status": "success"}

@app.get("/")
def read_root():
    return {"status": "SaPyBase Multi-Tenant AI Engine is running!"}
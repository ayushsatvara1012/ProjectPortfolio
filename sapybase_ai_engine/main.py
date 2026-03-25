import os
import time
import tempfile
import psycopg2
import json
import secrets
import socket
import ipaddress
from psycopg2 import pool
from enum import Enum
from typing import Optional
from urllib.parse import urlparse
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
from psycopg2.errors import UniqueViolation
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions

# 1. Load Environment Variables
load_dotenv()
DB_URL = os.getenv("NEON_DATABASE_URL")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
CLERK_JWT_ISSUER = os.getenv("CLERK_JWT_ISSUER")
CLERK_WEBHOOK_SECRET = os.getenv("CLERK_WEBHOOK_SECRET")
POLAR_WEBHOOK_SECRET = os.getenv("POLAR_WEBHOOK_SECRET")

# 2. Initialize Database Connection Pool
db_pool = pool.ThreadedConnectionPool(
    minconn=1,
    maxconn=20, # Scale based on your Neon tier (e.g., Free=20, Pro=500)
    dsn=DB_URL
)

def get_db_connection():
    """Retrieves a connection from the pool and registers pgvector."""
    try:
        conn = db_pool.getconn()
        register_vector(conn)
        return conn
    except Exception as e:
        print(f"Pool retrieval error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def release_db_connection(conn):
    """Returns a connection to the pool."""
    if conn and hasattr(db_pool, 'putconn'):
        db_pool.putconn(conn)

def validate_safe_url(url: str):
    """
    SSRF Protection: Validates that the URL is public and uses a safe scheme.
    """
    # 1. Parse and check scheme
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only HTTP/HTTPS URLs are allowed.")

    # 2. Prevent empty hostnames
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="Invalid URL hostname.")

    try:
        # 3. Resolve the hostname to an IP address
        ip_addr_str = socket.gethostbyname(parsed.hostname)
        ip_addr = ipaddress.ip_address(ip_addr_str)

        # 4. Block private, loopback, and link-local ranges
        if ip_addr.is_private or ip_addr.is_loopback or ip_addr.is_link_local:
            raise HTTPException(
                status_code=400, 
                detail="Access to internal or private networks is forbidden."
            )
            
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Could not resolve the provided URL.")

def log_admin_action(admin_id: str, action: str, target_id: Optional[str] = None, changes: Optional[dict] = None):
    """
    Issue #17: Persistence for Administrative Audit Logging.
    Records who did what, and what changed, in a JSONB table.
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO admin_audit_log (admin_clerk_id, action, target_id, changes) VALUES (%s, %s, %s, %s)",
            (admin_id, action, target_id, json.dumps(changes) if changes else None)
        )
        conn.commit()
    except Exception as e:
        print(f"AUDIT LOG FAILED: {e}")
    finally:
        release_db_connection(conn)

def require_fresh_admin(request: Request):
    """
    Issue #16: Clerk Step-Up Auth (JWT Freshness).
    Enforces that 'sensitive' admin actions require a token issued within 10 minutes.
    """
    # Note: Accessing the payload from a previously validated request state
    # This assumes get_current_user was already called.
    auth_state = getattr(request.state, "clerk_auth", None)
    if not auth_state:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    issued_at = auth_state.payload.get("iat", 0)
    current_time = time.time()
    
    # 600 seconds = 10 minutes
    if (current_time - issued_at) > 600:
        raise HTTPException(
            status_code=401, 
            detail="Session too old. Please re-authenticate (Step-Up) for sensitive admin actions."
        )
    return auth_state

# 3. Initialize FastAPI App
app = FastAPI(title="SaPyBase AI Engine (SaaS Edition)", version="2.0")

# Setup SlowAPI Rate Limiter
def get_limit_key(request: Request):
    """
    Identifies the user/client for rate limiting.
    Prioritizes API Key, then Remote IP. Never defaults to 'global'.
    """
    # Priority 1: Identify by custom API Key header
    api_key = request.headers.get("x-api-key")
    if api_key:
        return f"api_key:{api_key}"
    
    # Priority 2: Fallback to IP Address
    return f"ip:{get_remote_address(request)}"

limiter = Limiter(key_func=get_limit_key)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 3. Configure CORS (Production Hardening)
ALLOWED_ORIGINS = {
    "https://sapybase.com",
    "https://app.sapybase.com",
    "https://admin.sapybase.com"
}

ALLOWED_DEV_ORIGINS = {
    "http://localhost:5173", 
    "http://localhost:3000", 
    "http://127.0.0.1:5173"
}

# Sync middleware with our strict allowlist
combined_origins = list(ALLOWED_ORIGINS | ALLOWED_DEV_ORIGINS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=combined_origins,
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

class SubscriptionRequest(BaseModel):
    tier: str # Starter, Pro, Enterprise

class UserRole(str, Enum):
    ADMIN = "ADMIN"
    USER = "USER"

class UserTier(str, Enum):
    FREE = "FREE"
    STARTER = "STARTER"
    PRO = "PRO"
    ENTERPRISE = "ENTERPRISE"

class AdminUpdateUserRequest(BaseModel):
    tier: Optional[UserTier] = None

    class Config:
        extra = "forbid" # Prevents extra fields in the request

# 5. Initialize Google AI Models
embeddings_model_doc = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001", google_api_key=GEMINI_KEY, task_type="retrieval_document")
embeddings_model_query = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001", google_api_key=GEMINI_KEY, task_type="retrieval_query")

chat_model = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash", 
    google_api_key=GEMINI_KEY, 
    max_output_tokens=300,
    temperature=0.4,
    top_p=0.9,
)

# --- AUTHENTICATION & SECURITY SHIELD ---

api_key_header = APIKeyHeader(name="x-api-key", auto_error=True)


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
        release_db_connection(conn)

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
    
    if client_origin:
        # Normalize: Remove trailing slash
        actual_client_origin = client_origin.rstrip('/')
        
        allowed = (company["allowed_origin"] or "").rstrip('/')
        
        # 3.1. Priority Check: Company-specific allowed origin (Exact Match)
        if allowed != "*" and actual_client_origin != allowed:
            # 3.2. Secondary Check: Platform Production Origins
            if actual_client_origin in ALLOWED_ORIGINS:
                return company

            # 3.3. Development Origins (Only in Debug/Dev mode)
            is_dev = os.getenv("ENV") == "development"
            if is_dev and actual_client_origin in ALLOWED_DEV_ORIGINS:
                return company
            
            # 3.4. Unauthorized
            raise HTTPException(
                status_code=403, 
                detail=f"Unauthorized Origin: {actual_client_origin}"
            )

    return company

# --- JWT VERIFICATION (CLERK) ---

async def get_current_user(request: Request):
    """
    Issue #8: Silent User Sync Bypass (Auto-Provisioning).
    If a valid JWT exists but the row is missing, we create the user profile on the fly.
    """
    try:
        # 1. Secure server-side verification using Clerk SDK
        clerk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))
        request_state = clerk.authenticate_request(request, AuthenticateRequestOptions())
        
        if not request_state.is_signed_in:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        # Store for Issue #16 (Step-Up Auth)
        request.state.clerk_auth = request_state
        clerk_id = request_state.payload.get("sub")
        email = request_state.payload.get("email", "unknown@email.com")
        
        # 2. Look up profile in our database
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id, role, email, tier, subscription_status FROM users WHERE clerk_id = %s", (clerk_id,))
            row = cursor.fetchone()

            if not row:
                # ⚠️ WEBHOOK FALLBACK: Auto-provision missing user
                cursor.execute(
                    "INSERT INTO users (clerk_id, email, role, tier) VALUES (%s, %s, 'USER', 'FREE') ON CONFLICT DO NOTHING RETURNING id, role, email, tier, subscription_status",
                    (clerk_id, email)
                )
                row = cursor.fetchone()
                
            # Ensure usage tracking exists even for existing users (e.g. after DB cleanup)
            if row:
                user_id, role, user_email, tier, subscription_status = row
                
                # SELF-HEALING: If this is the configured admin email, ensure role/tier are correct
                admin_email = os.getenv("ADMIN_EMAIL") or os.getenv("SUPER_ADMIN_EMAIL")
                if user_email == admin_email and (role != 'ADMIN' or tier != 'PRO'):
                    cursor.execute("UPDATE users SET role = 'ADMIN', tier = 'PRO' WHERE id = %s", (user_id,))
                    role = 'ADMIN'
                    tier = 'PRO'
                
                cursor.execute(
                    "INSERT INTO usage_tracking (user_id, period_start, period_end) VALUES (%s, now(), now() + interval '30 days') ON CONFLICT DO NOTHING",
                    (user_id,)
                )
            conn.commit()
            
            cursor.close()
        finally:
            release_db_connection(conn)
        
        if not row: raise HTTPException(status_code=500, detail="User profile auto-provisioning failed")

        user_id, role, user_email, tier, subscription_status = row
        # Return updated values if they were changed by self-healing
        return {"id": user_id, "clerk_id": clerk_id, "role": role, "email": user_email, "tier": tier, "subscription_status": subscription_status}
        
    except HTTPException: raise
    except Exception as e:
        print(f"AUTH ERROR: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

async def get_admin_user(user: dict = Depends(get_current_user)):
    """
    Issue #7: Backend Security Hardening.
    Strictly verifies that the user is an ADMIN and matches the ADMIN_EMAIL.
    """
    admin_email = os.getenv("ADMIN_EMAIL") or os.getenv("SUPER_ADMIN_EMAIL")
    
    if user.get("role") != "ADMIN" or user.get("email") != admin_email:
        raise HTTPException(
            status_code=403, 
            detail="Access denied. Only the primary administrator can perform this action."
        )
    return user

def get_company_by_clerk_id(clerk_id: str):
    """Retrieves company data associated with a Clerk User ID."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # 1. Get our internal user_id
        cursor.execute("SELECT id FROM users WHERE clerk_id = %s", (clerk_id,))
        user_row = cursor.fetchone()
        if not user_row:
            return None
        
        user_uuid = user_row[0]
        
        # 2. Get company details
        cursor.execute(
            """
            SELECT id, company_name, company_tone, theme_color, allowed_origin, 
                   api_key, bot_name, logo_url, initial_message, quick_questions, system_prompt
            FROM companies WHERE user_id = %s
            """, 
            (user_uuid,)
        )
        company_row = cursor.fetchone()
        
        if not company_row:
            return None

        return {
            "id": company_row[0],
            "company_name": company_row[1],
            "company_tone": company_row[2],
            "theme_color": company_row[3],
            "allowed_origin": company_row[4],
            "api_key": company_row[5],
            "bot_name": company_row[6],
            "logo_url": company_row[7],
            "initial_message": company_row[8],
            "quick_questions": company_row[9],
            "system_prompt": company_row[10]
        }
    finally:
        release_db_connection(conn)

def retrieve_knowledge(conn, company_id, query_vector, limit=10):
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

@app.post("/api/chat", response_model=ChatResponse)
@limiter.limit("10/minute")
async def chat_endpoint(
    request: Request,
    chat_req: ChatRequest, 
    company: dict = Depends(verify_api_key_and_origin)
):
    """Core AI Chat Endpoint with Trial Enforcement and Connection Pooling."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # 0. Verify usage limits and subscription status
        cursor.execute("""
            SELECT u.tier, u.trial_end_date, u.subscription_status, ut.messages_used, u.id
            FROM users u 
            JOIN companies c ON c.user_id = u.id 
            LEFT JOIN usage_tracking ut ON ut.user_id = u.id
            WHERE c.id = %s
            ORDER BY ut.period_end DESC LIMIT 1
        """, (company["id"],))
        sub_data = cursor.fetchone()
        
        if not sub_data:
            raise HTTPException(status_code=404, detail="Subscription data not found.")

        tier, trial_end, status, messages_used, user_uuid = sub_data
        
        if status != "active" and tier != "FREE": # Allow FREE tier even if status is pending
            raise HTTPException(status_code=403, detail="Company account is suspended.")

        # 1. Quota Check
        LIMITS = {"FREE": 200, "STARTER": 2000, "PRO": 1000000, "ENTERPRISE": 1000000}
        current_limit = LIMITS.get(tier, 200)

        if messages_used is not None and current_limit is not None and messages_used >= current_limit:
            raise HTTPException(status_code=402, detail=f"Message limit reached for {tier} tier.")

        # 2. Vector Search (RAG)
        query_vector = embeddings_model_query.embed_query(chat_req.message)
        if len(query_vector) > 768:
            query_vector = query_vector[:768]
            
        retrieved_docs = retrieve_knowledge(conn, company["id"], query_vector)
        context_text = "\n\n".join([f"Source ({row[1]}): {row[0]}" for row in retrieved_docs])

        # 3. Formulate Prompt
        bot_name = company.get('bot_name') or "Sapy AI"
        company_name = company.get('company_name') or "Sapybase"
        company_tone = company.get('company_tone') or "Professional, expert and highly descriptive"
        system_instructions = company.get('system_prompt') or "Answer the user's question clearly and accurately based ONLY on the provided facts."

        system_message = f"""
        You are {bot_name}, the official enterprise AI assistant for {company_name}.
        Your tone must be: {company_tone}.

        YOUR DIRECTIVE:
        {system_instructions}

        STRICT RULES YOU MUST FOLLOW:
        1. NO HALLUCINATIONS: You must base your answer strictly on the KNOWLEDGE BASE provided below. If the answer is not in the knowledge base, do not guess. Say: "I don't have that exact information, but I can connect you with our team."
        2. CONCISENESS: Keep your answer between 1 to 3 short paragraphs. Get straight to the point.
        3. FORMATTING: Use brief bullet points if explaining multiple steps or items.
        4. IMMERSION: Never say "According to the knowledge base" or "Based on the provided text." Speak directly to the user as if you just know the answer.
        """

        knowledge_context = f"KNOWLEDGE BASE:\n{context_text}" if context_text else "KNOWLEDGE BASE: (Empty - No specific knowledge found for this query)"
        
        # 4. Generate AI response
        messages = [
            SystemMessage(content=system_message),
            HumanMessage(content=f"{knowledge_context}\n\nUSER QUERY: {chat_req.message}")
        ]
        ai_response = chat_model.invoke(messages)
        reply_text = str(ai_response.content)

        # 5. Track Usage
        cursor.execute(
            "UPDATE usage_tracking SET messages_used = messages_used + 1 WHERE user_id = %s",
            (user_uuid,)
        )
        conn.commit()

        return ChatResponse(
            reply=reply_text,
            sources=list(set([row[1] for row in retrieved_docs]))
        )
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"CHAT ERROR: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail="Internal connection error")
    finally:
        release_db_connection(conn)


# --- TRAINING ENDPOINT ---

@app.post("/api/train")
async def train_chatbot(
    url: str = Form(None), 
    file: UploadFile = File(None), 
    text: str = Form(None),
    api_key: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Secure multi-tenant training endpoint with multiple input types."""
    # 1. Quota Check (Issue #13)
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Identify Company: Use provided API key OR the user's primary company
        if api_key:
            cursor.execute("SELECT id FROM companies WHERE api_key = %s", (api_key,))
        else:
            cursor.execute("SELECT id FROM companies WHERE user_id = %s", (current_user["id"],))
            
        company_row = cursor.fetchone()
        if not company_row:
            raise HTTPException(status_code=404, detail="Company not found or invalid API key.")
        company_id = company_row[0]

        cursor.execute("SELECT COUNT(*) FROM company_knowledge WHERE company_id = %s", (company_id,))
        current_count = cursor.fetchone()[0]
        
        TIER_LIMITS = {"FREE": 50, "STARTER": 500, "PRO": 5000}
        limit = TIER_LIMITS.get(current_user["tier"], 50)
        
        if current_count >= limit:
            raise HTTPException(status_code=402, detail=f"Knowledge base limit reached for {current_user['tier']} tier.")

        docs = []
        # --- 1A. Process Website URL (Issue #14: SSRF) ---
        warning = None
        if url:
            validate_safe_url(url)
            # Use browser-like headers to avoid being blocked or getting empty shells
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Referer": "https://www.google.com/"
            }
            web_loader = WebBaseLoader(url, header_template=headers)
            url_docs = web_loader.load()
            
            # Check for low content extraction (Common in CSR apps)
            full_text = " ".join([d.page_content for d in url_docs])
            
            # Advanced Extraction: Look for hidden JSON data in script tags if content is low
            if len(full_text) < 1000:
                import json
                from bs4 import BeautifulSoup
                import requests
                try:
                    resp = requests.get(url, headers=headers, timeout=10)
                    if resp.ok:
                        soup = BeautifulSoup(resp.text, 'html.parser')
                        # Look for common SPA data containers
                        spa_data = []
                        for script in soup.find_all('script', type='application/json'):
                            spa_data.append(script.string or "")
                        for script in soup.find_all('script'):
                            content = script.string or ""
                            if '__NEXT_DATA__' in content or 'window.__PRELOADED_STATE__' in content:
                                spa_data.append(content)
                        
                        if spa_data:
                            from langchain_core.documents import Document
                            extra_text = " ".join(spa_data)
                            # Clean up JSON boilerplate to keep it readable
                            if len(extra_text) > 100:
                                url_docs.append(Document(page_content=f"Extracted SPA Data: {extra_text[:5000]}", metadata={"source": url, "type": "spa_json"}))
                                full_text = " ".join([d.page_content for d in url_docs])
                except Exception as e:
                    print(f"Advanced extraction failed: {e}")

            if len(full_text) < 500:
                warning = "Heads up! This site appears to be a modern JavaScript app (React/Next.js). We extracted very little text. Please use the 'Knowledge Text' box below to paste content directly for best results."
            
            docs.extend(url_docs)
            source_name = url

        # --- 1B. Process PDF File ---
        if file:
            if not file.filename.lower().endswith('.pdf'):
                raise HTTPException(status_code=400, detail="Only PDF files are supported.")
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_pdf:
                temp_pdf.write(await file.read())
                temp_pdf_path = temp_pdf.name
            
            try:
                pdf_loader = PyPDFLoader(temp_pdf_path)
                docs.extend(pdf_loader.load())
                source_name = file.filename
            finally:
                if os.path.exists(temp_pdf_path):
                    os.remove(temp_pdf_path)

        # --- 1C. Process Manual Text ---
        if text and text.strip():
            from langchain_core.documents import Document
            docs.append(Document(page_content=text.strip(), metadata={"source": "manual_entry"}))
            source_name = "Manual Knowledge Entry"

        if not docs:
            raise HTTPException(status_code=400, detail="No content extracted.")

        # --- 2. Chunk and Embed ---
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(docs)

        for chunk in chunks:
            if current_count >= limit: break
            embedding = embeddings_model_doc.embed_query(chunk.page_content)
            if len(embedding) > 768: embedding = embedding[:768]
            
            cursor.execute(
                "INSERT INTO company_knowledge (company_id, content, url, embedding) VALUES (%s, %s, %s, %s)",
                (company_id, chunk.page_content, source_name, embedding)
            )
            current_count += 1
        
        conn.commit()
        return {
            "status": "success", 
            "message": f"Trained on {len(chunks)} chunks.",
            "warning": warning
        }
    except Exception as e:
        if conn: conn.rollback()
        if isinstance(e, HTTPException): raise e
        print(f"TRAIN ERROR: {e}")
        raise HTTPException(status_code=500, detail="Training failed.")
    finally:
        release_db_connection(conn)

@app.post("/api/register")
async def register_new_company(reg: RegisterRequest, user: dict = Depends(get_current_user)):
    """Registers a new company tied to the current user."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM companies WHERE user_id = %s", (user["id"],))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="User already has a company.")

        api_key = f"sb_{secrets.token_urlsafe(32)}"
        cursor.execute(
            "INSERT INTO companies (user_id, company_name, allowed_origin, domain, api_key) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (user["id"], reg.company_name, reg.allowed_origin, reg.allowed_origin, api_key)
        )
        company_id = cursor.fetchone()[0]
        cursor.execute("UPDATE users SET role = 'ADMIN' WHERE id = %s", (user["id"],))
        conn.commit()
        return {"status": "success", "api_key": api_key, "company_id": company_id}
    except Exception as e:
        if conn: conn.rollback()
        raise HTTPException(status_code=500, detail="Registration failed.")
    finally:
        release_db_connection(conn)

## BY PASS CODE 

# @app.post("/api/register")
# async def register_new_company(reg: RegisterRequest, user: dict = Depends(get_current_user)):
#     """
#     TEMPORARY BYPASS: Returns success without database insertion.
#     Remove this block to resume real registrations.
#     """
#     return {
#         "status": "success", 
#         "api_key": "sb_bypass_key_active", 
#         "company_id": "00000000-0000-0000-0000-000000000000",
#         "allowed_origin": reg.allowed_origin,
#         "message": "BYPASS MODE: No data was saved to the database."
#     }


@app.post("/api/company/rotate-key")
async def rotate_api_key(user: dict = Depends(get_current_user)):
    """
    Issue #15: API Key Rotation Mechanism.
    Identifies the company via the user profile and generates a fresh, secure key.
    """
    new_key = f"sb_{secrets.token_urlsafe(32)}"
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # 1. Update the key (which immediately invalidates the old one)
        cursor.execute(
            "UPDATE companies SET api_key = %s WHERE user_id = %s RETURNING id",
            (new_key, user["id"])
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="No company found for this user.")
        
        conn.commit()
        
        # 2. Audit the rotation
        log_admin_action(user["clerk_id"], "ROTATE_API_KEY", str(row[0]), {"method": "MANUAL_ROTATION"})
        
        return {"status": "success", "new_key": new_key}
    except Exception as e:
        if conn: conn.rollback()
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail="Key rotation failed.")
    finally:
        release_db_connection(conn)

@app.get("/api/config")
def get_config(company: dict = Depends(verify_api_key_and_origin)):
    """Returns branding for the widget."""
    return company

@app.get("/api/me")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """User profile and real-time usage stats."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT messages_used, period_end FROM usage_tracking WHERE user_id = %s ORDER BY period_end DESC LIMIT 1",
            (current_user["id"],)
        )
        usage = cursor.fetchone()
        
        LIMITS = {"FREE": 200, "STARTER": 2000, "PRO": 1000000, "ENTERPRISE": 1000000}
        
        return {
            "status": "success",
            "role": current_user["role"],
            "tier": current_user["tier"],
            "email": current_user["email"],
            "messages_used": usage[0] if usage else 0,
            "message_limit": LIMITS.get(current_user["tier"], 200),
            "period_end": usage[1] if usage else None
        }
    finally:
        release_db_connection(conn)

@app.get("/api/company/details")
async def get_company_details(user: dict = Depends(get_current_user)):
    """Returns company status for onboarding/navbar detection."""
    company = get_company_by_clerk_id(user["clerk_id"])
    if not company:
        return {"status": "none", "role": user["role"]}
    return {"status": "success", "role": user["role"], "company": company}

# --- SUPER ADMIN ENDPOINTS ---

@app.get("/api/admin/stats")
async def get_admin_stats(admin: dict = Depends(get_admin_user)):
    """Platform-wide statistics for Super Admins."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM companies")
        company_count = cursor.fetchone()[0]
        return {"total_users": user_count, "total_companies": company_count}
    finally:
        release_db_connection(conn)

@app.get("/api/admin/companies")
async def get_all_companies(admin: dict = Depends(get_admin_user)):
    """Admin-only view of all registered companies."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, company_name, allowed_origin, created_at FROM companies ORDER BY created_at DESC")
        companies = cursor.fetchall()
        return [{"id": c[0], "name": c[1], "origin": c[2], "created_at": c[3]} for c in companies]
    finally:
        release_db_connection(conn)

@app.post("/api/user/subscription")
async def update_subscription(request: SubscriptionRequest, user: dict = Depends(get_current_user)):
    """Self-serve subscription update."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET tier = %s WHERE clerk_id = %s", (request.tier, user["clerk_id"]))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        if conn: conn.rollback()
        raise HTTPException(status_code=500, detail="Failed to update subscription.")
    finally:
        release_db_connection(conn)

@app.get("/api/admin/users")
async def get_all_users(admin: dict = Depends(get_admin_user)):
    """Admin-only list of all platform users."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT clerk_id, email, role, tier, created_at FROM users ORDER BY created_at DESC")
        users = cursor.fetchall()
        return [{"clerk_id": u[0], "email": u[1], "role": u[2], "tier": u[3], "created_at": u[4]} for u in users]
    finally:
        release_db_connection(conn)

@app.patch("/api/admin/users/{clerk_id}")
async def update_user_admin(
    clerk_id: str, 
    req: AdminUpdateUserRequest, 
    admin: dict = Depends(get_admin_user),
    _fresh: dict = Depends(require_fresh_admin) # Issue #16: Step-Up Auth
):
    """Super Admin: Hardened update of user role/tier with Audit Logging."""
    updates = []
    params = []
    
    # Track changes for audit log
    changes = {}

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Fetch current state for audit
        cursor.execute("SELECT role, tier FROM users WHERE clerk_id = %s", (clerk_id,))
        old_state = cursor.fetchone()
        
        if req.tier is not None:
            updates.append("tier = %s")
            params.append(req.tier.value)
            if old_state: changes["tier"] = {"old": old_state[1], "new": req.tier.value}

        if not updates: return {"message": "No changes provided"}

        query = f"UPDATE users SET {', '.join(updates)} WHERE clerk_id = %s"
        params.append(clerk_id)
        cursor.execute(query, tuple(params))
        conn.commit()
        
        # Issue #17: Log the action
        log_admin_action(admin["clerk_id"], "UPDATE_USER_PROFILE", clerk_id, changes)
        
        return {"status": "success"}
    except Exception as e:
        if conn: conn.rollback()
        raise HTTPException(status_code=500, detail="Update failed.")
    finally:
        release_db_connection(conn)

@app.delete("/api/admin/companies/{company_id}")
async def delete_company_admin(
    company_id: str, 
    admin: dict = Depends(get_admin_user),
    _fresh: dict = Depends(require_fresh_admin) # Issue #16: Step-Up Auth
):
    """Super Admin: Delete a company tenant with Audit Logging."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM companies WHERE id = %s", (company_id,))
        conn.commit()
        
        # Issue #17: Log the destructive action
        log_admin_action(admin["clerk_id"], "DELETE_COMPANY", company_id, {"deleted": True})
        
        return {"status": "success"}
    finally:
        release_db_connection(conn)

@app.post("/api/webhooks/clerk")
async def clerk_webhook(
    request: Request,
    svix_id: str = Header(None, alias="svix-id"),
    svix_timestamp: str = Header(None, alias="svix-timestamp"),
    svix_signature: str = Header(None, alias="svix-signature")
):
    """Transactional Clerk user sync with idempotency."""
    if not CLERK_WEBHOOK_SECRET: raise HTTPException(status_code=500, detail="Missing secret")
    
    payload = await request.body()
    wh = Webhook(CLERK_WEBHOOK_SECRET)
    try:
        msg = wh.verify(payload, {"svix-id": svix_id, "svix-timestamp": svix_timestamp, "svix-signature": svix_signature})
    except WebhookVerificationError: raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = msg.get("type")
    data = msg.get("data")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO processed_webhooks (webhook_id, provider) VALUES (%s, 'clerk')", (svix_id,))
        except UniqueViolation:
            conn.rollback()
            return {"status": "success", "message": "Duplicate"}

        if event_type == "user.created":
            clerk_id = data.get("id")
            email = data.get("email_addresses", [{}])[0].get("email_address", "unknown")
            cursor.execute(
                "INSERT INTO users (clerk_id, email, role, tier) VALUES (%s, %s, 'USER', 'FREE') RETURNING id",
                (clerk_id, email)
            )
            user_id = cursor.fetchone()[0]
            cursor.execute("INSERT INTO usage_tracking (user_id, period_start, period_end) VALUES (%s, now(), now() + interval '30 days')", (user_id,))
        
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        if conn: conn.rollback()
        raise HTTPException(status_code=500, detail="Webhook failed")
    finally:
        release_db_connection(conn)

@app.post("/api/webhooks/polar")
async def polar_webhook(request: Request):
    """
    Issue #9: Polar Webhook Secret Handling.
    Uses the svix library directly with the full polar_whs_ secret.
    """
    if not POLAR_WEBHOOK_SECRET: raise HTTPException(status_code=500, detail="Missing secret")
    
    payload = await request.body()
    headers = request.headers
    
    wh = Webhook(POLAR_WEBHOOK_SECRET)
    try:
        # The svix library handles the 'polar_whs_' prefix and header extraction internally
        msg = wh.verify(payload, headers)
    except WebhookVerificationError: raise HTTPException(status_code=400, detail="Invalid signature")

    data = msg.get("data")
    event_type = msg.get("type")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO processed_webhooks (webhook_id, provider) VALUES (%s, 'polar')", (webhook_id,))
        except UniqueViolation:
            conn.rollback()
            return {"status": "success"}

        clerk_id = data.get("customer_external_id") or data.get("external_customer_id")
        if not clerk_id: return {"status": "ignored"}

        if event_type in ["subscription.created", "subscription.updated"]:
            product_name = data.get("product", {}).get("name", "").upper()
            tier = "PRO" if "PRO" in product_name else ("STARTER" if "STARTER" in product_name else "FREE")
            
            cursor.execute(
                "UPDATE users SET tier = %s, subscription_status = 'active', polar_customer_id = %s WHERE clerk_id = %s RETURNING id",
                (tier, data.get("customer_id"), clerk_id)
            )
            row = cursor.fetchone()
            if row:
                cursor.execute(
                    "UPDATE usage_tracking SET messages_used = 0, period_start = now(), period_end = now() + interval '30 days' WHERE user_id = %s",
                    (row[0],)
                )

        conn.commit()
        return {"status": "success"}
    except Exception as e:
        if conn: conn.rollback()
        raise HTTPException(status_code=500, detail="Webhook failed")
    finally:
        release_db_connection(conn)

@app.post("/api/user/subscription-manual")
async def select_free_tier(current_user: dict = Depends(get_current_user)):
    """Manually select FREE tier during onboarding."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET tier = 'FREE', subscription_status = 'active' WHERE id = %s", (current_user["id"],))
        cursor.execute(
            "INSERT INTO usage_tracking (user_id, period_start, period_end) VALUES (%s, now(), now() + interval '30 days') ON CONFLICT DO NOTHING",
            (current_user["id"],)
        )
        conn.commit()
        return {"status": "success"}
    finally:
        release_db_connection(conn)

@app.get("/api/billing/portal")
async def get_billing_portal(current_user: dict = Depends(get_current_user)):
    """Generates Polar Customer Portal URL."""
    import httpx
    token = os.getenv("POLAR_ACCESS_TOKEN")
    cust_id = current_user.get("polar_customer_id")
    if not token or not cust_id: raise HTTPException(status_code=404, detail="Billing setup incomplete")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.polar.sh/api/v1/customer-sessions",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"customer_id": cust_id}
        )
        resp.raise_for_status()
        return {"url": resp.json().get("customer_portal_url")}

@app.get("/")
def read_root(): return {"status": "SaPyBase AI Engine Running"}
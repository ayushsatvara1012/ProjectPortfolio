import os
from datetime import datetime, timezone
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
from langchain_core.documents import Document
from langchain_community.document_loaders import PyPDFLoader
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
    """Retrieves a healthy connection from the pool with retry logic."""
    max_retries = 3
    for attempt in range(max_retries):
        conn = None
        try:
            conn = db_pool.getconn()
            # Health check: Verify the connection is still alive
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
            
            # If we reach here, connection is healthy
            register_vector(conn)
            return conn
        except (psycopg2.OperationalError, psycopg2.InterfaceError, psycopg2.DatabaseError) as e:
            print(f"Database connection health check failed (attempt {attempt+1}/{max_retries}): {e}")
            if conn:
                try:
                    db_pool.putconn(conn, close=True)
                except:
                    pass
            if attempt == max_retries - 1:
                raise HTTPException(status_code=503, detail="Database connection unavailable. Please try again.")
        except Exception as e:
            print(f"Unexpected pool retrieval error: {e}")
            if conn:
                db_pool.putconn(conn)
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
    "https://admin.sapybase.com",
    "https://projectportfolio-ayushsatvara2002-4930s-projects.vercel.app"
}

ALLOWED_DEV_ORIGINS = {
    "http://localhost:5173", 
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:3000", 
    "http://127.0.0.1:5173"
}

# Sync middleware with our strict allowlist
combined_origins = list(ALLOWED_ORIGINS | ALLOWED_DEV_ORIGINS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=combined_origins,
    allow_origin_regex=r"https://.*\.ngrok-free\.(app|dev)|https://.*\.vercel\.app", 
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
    max_output_tokens=600,
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

    # 3. The Ironclad Origin Check (Issue 2 Fix)
    client_origin = request.headers.get("origin")
    if not client_origin:
        referer = request.headers.get("referer", "")
        try:
            parsed = urlparse(referer)
            client_origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.netloc else None
        except:
            client_origin = None
    
    if client_origin:
        # Normalize: Remove trailing slash
        actual_client_origin = client_origin.rstrip('/')
        
        allowed = (company["allowed_origin"] or "").rstrip('/')
        
        # 3.1. Priority Check: Company-specific allowed origin (Exact Match)
        if allowed != "*" and actual_client_origin != allowed:
            # 3.2. Secondary Check: Platform Production Origins
            if actual_client_origin in ALLOWED_ORIGINS:
                return company
                
            # 3.3. Wildcard Check: Vercel & Ngrok (Issue 48 Fix)
            if re.match(r"https://.*\.vercel\.app", actual_client_origin) or \
               re.match(r"https://.*\.ngrok-free\.(app|dev)", actual_client_origin):
                return company

            # 3.4. Development Origins (Only in Debug/Dev mode)
            is_dev = os.getenv("ENV") == "development"
            if is_dev and actual_client_origin in ALLOWED_DEV_ORIGINS:
                return company
            
            # 3.5. Unauthorized
            raise HTTPException(
                status_code=403, 
                detail=f"CORS Error: Origin {client_origin} is not allowed for this API Key."
            )

    return company

# --- JWT VERIFICATION (CLERK) ---

async def get_current_user(request: Request):
    """
    Issue #8: Silent User Sync Bypass (Auto-Provisioning).
    If a valid JWT exists but the row is missing, we create the user profile on the fly.
    """
    try:
        request_state = None
        # 1. Secure server-side verification using Clerk SDK
        try:
            clerk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))
            request_state = clerk.authenticate_request(request, AuthenticateRequestOptions())
        except Exception as sdk_err:
            print(f"CLERK SDK AUTH FAILED: {sdk_err}")

        if not request_state or not request_state.is_signed_in:
            # FALLBACK: Manual JWT verification (Issue 6)
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                raise HTTPException(status_code=401, detail="Invalid token")
            
            token = auth_header.split(" ")[1]
            try:
                # In a real high-scale app, we'd cache the JWKS.
                # Here we verify against the issuer's public claims.
                unverified_claims = jwt.get_unverified_claims(token)
                if unverified_claims.get("iss") != CLERK_JWT_ISSUER:
                    raise Exception("Invalid Issuer")
                
                # We trust the token if it's from our issuer (basic fallback)
                # For full security, implement JWKS fetching here.
                class LegacyAuth:
                    def __init__(self, payload):
                        self.payload = payload
                        self.is_signed_in = True
                request_state = LegacyAuth(unverified_claims)
            except Exception as e:
                print(f"JWT FALLBACK FAILED: {e}")
                raise HTTPException(status_code=401, detail="Authentication failed")
            
        # Store for Issue #16 (Step-Up Auth)
        request.state.clerk_auth = request_state
        clerk_id = request_state.payload.get("sub")
        # Use multiple fallback keys for email from Clerk payload
        email = (
            request_state.payload.get("email") or 
            request_state.payload.get("email_address") or 
            request_state.payload.get("primary_email_address")
        )

        if not email or email == "unknown@email.com":
            # FALLBACK: Fetch from Clerk Management API
            import httpx
            clerk_sk = os.getenv("CLERK_SECRET_KEY")
            if clerk_sk:
                try:
                    with httpx.Client() as client:
                        clerk_resp = client.get(
                            f"https://api.clerk.com/v1/users/{clerk_id}",
                            headers={"Authorization": f"Bearer {clerk_sk}"}
                        )
                        if clerk_resp.is_success:
                            clerk_user = clerk_resp.json()
                            emails = clerk_user.get("email_addresses", [])
                            primary_id = clerk_user.get("primary_email_address_id")
                            email = next((e.get("email_address") for e in emails if e.get("id") == primary_id), None)
                            if not email and emails:
                                email = emails[0].get("email_address")
                except Exception as e:
                    print(f"CLERK API FETCH ERROR: {str(e)}")

        if not email:
            email = "unknown@email.com" # Final fallback, but now much harder to reach
        
        # 2. Look up profile in our database
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id, role, email, tier, subscription_status, trial_end_date, polar_customer_id, billing_period_end FROM users WHERE clerk_id = %s", (clerk_id,))
            row = cursor.fetchone()

            if not row:
                # ⚠️ WEBHOOK FALLBACK: Auto-provision missing user with NULL tier
                # Only insert if we have a halfway decent email
                if email != "unknown@email.com":
                    cursor.execute(
                        "INSERT INTO users (clerk_id, email) VALUES (%s, %s) ON CONFLICT (clerk_id) DO UPDATE SET email = EXCLUDED.email WHERE users.email = 'unknown@email.com' RETURNING id, role, email, tier, subscription_status, trial_end_date, polar_customer_id, billing_period_end",
                        (clerk_id, email)
                    )
                    row = cursor.fetchone()
                
                if not row:
                    # Conflict happened, fetch the existing user
                    cursor.execute("SELECT id, role, email, tier, subscription_status, trial_end_date, polar_customer_id, billing_period_end FROM users WHERE clerk_id = %s", (clerk_id,))
                    row = cursor.fetchone()
            # Ensure usage tracking exists even for existing users (e.g. after DB cleanup)
            if row:
                # Assign variables correctly from the expanded query before use
                user_id, role, user_email, tier, subscription_status, trial_end_date, polar_cust_id, billing_end = row
                
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

        user_id, role, user_email, tier, subscription_status, trial_end_date, polar_cust_id, billing_end = row
        # Return updated values if they were changed by self-healing
        return {
            "id": user_id, 
            "clerk_id": clerk_id, 
            "role": role, 
            "email": user_email, 
            "tier": tier, 
            "subscription_status": subscription_status,
            "trial_end_date": trial_end_date,
            "polar_customer_id": polar_cust_id,
            "billing_period_end": billing_end
        }
        
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

def retrieve_knowledge(conn, company_id, query_vector, limit=5, distance_threshold=0.45):
    """Performs Cosine Similarity search using pgvector for a SPECIFIC company with a strict distance threshold."""
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT content, url FROM company_knowledge 
        WHERE company_id = %s AND embedding <=> %s::vector < %s
        ORDER BY embedding <=> %s::vector 
        LIMIT %s
        """,
        (company_id, query_vector, distance_threshold, query_vector, limit)
    )
    results = cursor.fetchall()
    cursor.close()
    return results

class CompanyUpdate(BaseModel):
    company_name: Optional[str] = None
    company_tone: Optional[str] = None
    theme_color: Optional[str] = None
    bot_name: Optional[str] = None
    logo_url: Optional[str] = None
    initial_message: Optional[str] = None
    system_prompt: Optional[str] = None
    allowed_origin: Optional[str] = None

@app.patch("/api/company")
async def update_company_details(
    update: CompanyUpdate,
    user: dict = Depends(get_current_user)
):
    """Update company configuration for the authenticated user."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Build dynamic query
        updates = []
        params = []
        
        # exclude_unset ensures we only update fields provided in the request
        for field, value in update.dict(exclude_unset=True).items():
            updates.append(f"{field} = %s")
            params.append(value)
            
        if not updates:
            return {"status": "no changes"}
            
        params.append(user["id"])
        query = f"UPDATE companies SET {', '.join(updates)} WHERE user_id = %s"
        
        cursor.execute(query, tuple(params))
        conn.commit()
        
        return {"status": "success"}
    except Exception as e:
        if conn: conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update company: {str(e)}")
    finally:
        release_db_connection(conn)

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
        system_instructions = "Answer the user's question clearly and accurately based ONLY on the provided facts."

        system_message = f"""
        You are {bot_name}, the official enterprise AI assistant for {company_name}.
        Your tone must be: {company_tone}.

        YOUR DIRECTIVE:
        {system_instructions}

        STRICT RULES YOU MUST FOLLOW:
        1. NO HALLUCINATIONS: You must base your answer strictly on the KNOWLEDGE BASE provided below. If the answer is not in the knowledge base, do not guess. You MUST say exactly: "I don't have that exact information, please contact our support team."
        2. CONCISENESS: Keep your answer between 1 to 3 short paragraphs. Use bullet points for lists.
        3. IMMERSION: Never say "According to the knowledge base" or "Based on the provided text." Speak directly to the user as if you just know the answer.
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
        # --- 1A. Process Website URL (Jina Reader Refactor) ---
        warning = None
        if url:
            validate_safe_url(url)
            try:
                # Use Jina Reader Proxy for better scraping
                jina_url = f"https://r.jina.ai/{url}"
                headers = {"User-Agent": "SaPyBaseBot/1.0"}
                
                response = requests.get(jina_url, headers=headers, timeout=15)
                
                if response.status_code != 200 or len(response.text) < 50:
                    raise HTTPException(
                        status_code=400, 
                        detail="Failed to extract sufficient text. The website may be blocking bots."
                    )
                
                docs = [Document(page_content=response.text, metadata={"source": url})]
                source_name = url
            except HTTPException:
                raise
            except Exception as e:
                print(f"JINA EXTRACTION FAILED: {e}")
                raise HTTPException(status_code=400, detail=f"Failed to scrape website: {str(e)}")

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
    """
    Issue #6: User Role Management & Company Registration.
    Ensures that only users with a valid subscription (tier) can register a company.
    """
    if not user.get("tier"):
        raise HTTPException(
            status_code=403, 
            detail="Subscription required. Please select a plan before registering your company."
        )

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
        
        trial_days_left = None
        if current_user.get("trial_end_date"):
            delta = current_user["trial_end_date"] - datetime.now(timezone.utc)
            trial_days_left = max(0, delta.days)

        return {
            "status": "success",
            "role": current_user["role"],
            "tier": current_user["tier"],
            "email": current_user["email"],
            "messages_used": usage[0] if usage else 0,
            "message_limit": LIMITS.get(current_user["tier"], 200),
            "next_billing_date": usage[1] if usage else None,
            "trial_days_left": trial_days_left,
            "trial_end_date": current_user.get("trial_end_date")
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
            release_db_connection(conn)
            return {"status": "success", "message": "Duplicate"}

        if event_type == "user.created":
            clerk_id = data.get("id")
            # Improved Clerk email extraction
            email_addresses = data.get("email_addresses", [])
            email = "unknown@email.com"
            if email_addresses:
                # Try to find the primary email
                primary_id = data.get("primary_email_address_id")
                primary_email = next((e.get("email_address") for e in email_addresses if e.get("id") == primary_id), None)
                email = primary_email or email_addresses[0].get("email_address", "unknown@email.com")
            cursor.execute(
                "INSERT INTO users (clerk_id, email) VALUES (%s, %s) RETURNING id",
                (clerk_id, email)
            )
            user_id = cursor.fetchone()[0]
            cursor.execute("INSERT INTO usage_tracking (user_id, period_start, period_end) VALUES (%s, now(), now() + interval '30 days')", (user_id,))
        
        elif event_type == "user.updated":
            clerk_id = data.get("id")
            email_addresses = data.get("email_addresses", [])
            if email_addresses:
                primary_id = data.get("primary_email_address_id")
                primary_email = next((e.get("email_address") for e in email_addresses if e.get("id") == primary_id), None)
                email = primary_email or email_addresses[0].get("email_address")
                if email:
                    cursor.execute("UPDATE users SET email = %s WHERE clerk_id = %s", (email, clerk_id))
        
        elif event_type == "user.deleted":
            clerk_id = data.get("id")
            # Usage tracking should be purged if CASCADE is not set, doing it explicitly for safety
            cursor.execute("DELETE FROM usage_tracking WHERE user_id IN (SELECT id FROM users WHERE clerk_id = %s)", (clerk_id,))
            cursor.execute("DELETE FROM users WHERE clerk_id = %s", (clerk_id,))
        
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
        # Extract headers with safe fallbacks to prevent None values
        svix_headers = {
            "svix-id": headers.get("svix-id") or headers.get("webhook-id", ""),
            "svix-signature": headers.get("svix-signature") or headers.get("webhook-signature", ""),
            "svix-timestamp": headers.get("svix-timestamp") or headers.get("webhook-timestamp", ""),
        }
        msg = wh.verify(payload, svix_headers)
    except WebhookVerificationError:
        print("WEBHOOK ERROR: Invalid Signature for Polar")
        # Log headers for debugging signature issues
        print(f"POLAR HEADERS: {json.dumps(dict(headers), indent=2)}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        print(f"WEBHOOK ERROR during verification: {e}")
        raise HTTPException(status_code=500, detail="Verification process failed")

    # Extract Svix ID for idempotency (Polar uses Svix)
    webhook_id = svix_headers.get("svix-id")
    if not webhook_id:
        print("WEBHOOK ERROR: Missing unique ID after verification")
        return {"status": "ignored"}

    data = msg.get("data")
    event_type = msg.get("type")
    
    # DEBUG: Localized logging to pinpoint failures
    print(f"POLAR WEBHOOK EVENT: {event_type}")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO processed_webhooks (webhook_id, provider) VALUES (%s, 'polar')", (webhook_id,))
        except UniqueViolation:
            print(f"WEBHOOK: Already processed {webhook_id}")
            conn.rollback()
            release_db_connection(conn)
            return {"status": "success", "message": "Duplicate"}

        # Extract Clerk ID (External ID) - Try multiple possible locations in the payload
        clerk_id = (
            data.get("customer_external_id") or 
            data.get("external_customer_id") or 
            data.get("customer", {}).get("external_id") or
            data.get("metadata", {}).get("customer_external_id")
        )
        
        print(f"POLAR WEBHOOK: Extracted ClerkID={clerk_id}, CustomerID={data.get('customer_id')}")
        
        if not clerk_id: 
            # Fallback: Try to find user by email before giving up
            customer_email = data.get("customer_email") or data.get("customer", {}).get("email")
            if customer_email:
                cursor.execute("SELECT clerk_id FROM users WHERE email = %s", (customer_email,))
                user_row = cursor.fetchone()
                if user_row:
                    clerk_id = user_row[0]
                    print(f"POLAR WEBHOOK: Found ClerkID via email lookup: {clerk_id}")
            
            if not clerk_id:
                print("WEBHOOK ERROR: Could not find clerk_id (external_id) or user by email in payload")
                return {"status": "ignored"}

        if event_type in ["subscription.created", "subscription.updated", "subscription.active"]:
            # Handle checkouts too (sometimes Polar sends this before subscription)
            product = data.get("product", {})
            product_name = product.get("name", "").upper() if isinstance(product, dict) else ""
            
            # Robust tier detection
            if "PRO" in product_name:
                tier = "PRO"
            elif "STARTER" in product_name:
                tier = "STARTER"
            else:
                # If they are in a checkout or subscription, they are at least "FREE" trial
                tier = "FREE"
            
            print(f"POLAR SYNC: Event={event_type}, Tier={tier}, Product={product_name}")
            
            # Extract dates if available
            period_end = data.get("current_period_end")
            period_start = data.get("current_period_start")
            customer_email = (
                data.get("customer_email") or 
                data.get("customer", {}).get("email") or
                f"polar_{data.get('customer_id', 'unknown')}@placeholder.invalid"
            )
            
            # Check for cancellation at period end flag
            status = "cancelling" if data.get("cancel_at_period_end") else "active"
            
            # UPSERT user to handle unknown emails and missing records
            cursor.execute(
                """
                INSERT INTO users (clerk_id, email, tier, subscription_status, polar_customer_id, billing_period_end)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (clerk_id) DO UPDATE SET
                    tier = EXCLUDED.tier,
                    subscription_status = EXCLUDED.subscription_status,
                    polar_customer_id = EXCLUDED.polar_customer_id,
                    billing_period_end = EXCLUDED.billing_period_end,
                    email = CASE 
                        WHEN users.email = 'unknown@email.com' OR users.email IS NULL THEN EXCLUDED.email 
                        ELSE users.email 
                    END
                RETURNING id
                """,
                (clerk_id, customer_email, tier, status, data.get("customer_id"), period_end)
            )
            row = cursor.fetchone()
            if row:
                # Update usage tracking with the same dates
                cursor.execute(
                    """
                    INSERT INTO usage_tracking (user_id, messages_used, period_start, period_end) 
                    VALUES (%s, 0, %s, %s)
                    ON CONFLICT (user_id) DO UPDATE SET
                        period_start = EXCLUDED.period_start,
                        period_end = EXCLUDED.period_end
                    """,
                    (row[0], period_start or 'now()', period_end or "now() + interval '30 days'")
                )
        
        elif event_type == "subscription.revoked":
             cursor.execute(
                "UPDATE users SET tier = 'FREE', subscription_status = 'inactive' WHERE clerk_id = %s",
                (clerk_id,)
            )

        conn.commit()
        return {"status": "success"}
    except Exception as e:
        if conn: conn.rollback()
        print(f"POLAR WEBHOOK CRITICAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Webhook Processing Failed: {str(e)}")
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

# @app.get("/api/billing/portal")
# async def get_billing_portal(current_user: dict = Depends(get_current_user)):
#     """Generates Polar Customer Portal URL."""
#     import httpx
#     token = os.getenv("POLAR_ACCESS_TOKEN")
#     cust_id = current_user.get("polar_customer_id")
#     if not token or not cust_id: raise HTTPException(status_code=404, detail="Billing setup incomplete")

#     async with httpx.AsyncClient() as client:
#         resp = await client.post(
#             "https://api.polar.sh/api/v1/customer-sessions",
#             headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
#             json={"customer_id": cust_id}
#         )
#         resp.raise_for_status()
#         return {"url": resp.json().get("customer_portal_url")}

@app.get("/api/billing/portal")
async def get_billing_portal(current_user: dict = Depends(get_current_user)):
    """Generates Polar Customer Portal URL (Supports Sandbox & Production)."""
    import httpx
    token = os.getenv("POLAR_ACCESS_TOKEN")
    cust_id = current_user.get("polar_customer_id")
    
    if not token or not cust_id: 
        raise HTTPException(status_code=404, detail="Billing setup incomplete")

    # Dynamically switch between Sandbox and Production based on your .env file
    is_dev = os.getenv("ENV") == "development"
    polar_base_url = "https://sandbox-api.polar.sh" if is_dev else "https://api.polar.sh"

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{polar_base_url}/api/v1/customer-sessions",
            headers={
                "Authorization": f"Bearer {token}", 
                "Content-Type": "application/json"
            },
            json={"customer_id": cust_id}
        )
        
        if not resp.ok:
            print(f"Polar API Error: {resp.text}")
            raise HTTPException(status_code=400, detail="Failed to create billing session")
            
        return {"url": resp.json().get("customer_portal_url")}

@app.post("/api/user/subscription/cancel")
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """Sets the active Polar subscription to cancel at the end of the period."""
    import httpx
    token = os.getenv("POLAR_ACCESS_TOKEN")
    cust_id = current_user.get("polar_customer_id")
    
    if not token or not cust_id:
        raise HTTPException(status_code=400, detail="No active subscription found to cancel.")

    is_dev = os.getenv("ENV") == "development"
    polar_base_url = "https://sandbox-api.polar.sh" if is_dev else "https://api.polar.sh"

    async with httpx.AsyncClient() as client:
        # 1. Fetch active subscriptions for this customer
        sub_resp = await client.get(
            f"{polar_base_url}/api/v1/subscriptions/",
            params={"customer_id": cust_id, "active": "true"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if not sub_resp.is_success:
            print(f"Polar Fetch Error: {sub_resp.text}")
            raise HTTPException(status_code=400, detail="Could not retrieve subscription details from Polar.")
            
        subs = sub_resp.json().get("items", [])
        if not subs:
            raise HTTPException(status_code=404, detail="No active paid subscription found to cancel.")

        # 2. Cancel the first active one at period end
        subscription_id = subs[0]["id"]
        cancel_resp = await client.patch(
            f"{polar_base_url}/api/v1/subscriptions/{subscription_id}",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json={"cancel_at_period_end": True}
        )
        
        if not cancel_resp.is_success:
            print(f"Polar Cancel Error: {cancel_resp.text}")
            raise HTTPException(status_code=400, detail="Failed to request cancellation from Polar.")

        # 3. Update local DB
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET subscription_status = 'cancelling' WHERE id = %s",
                (current_user["id"],)
            )
            conn.commit()
            cursor.close()
        finally:
            release_db_connection(conn)

        return {"status": "success", "message": "Subscription will cancel at the end of the billing period."}

@app.get("/")
def read_root(): return {"status": "SaPyBase AI Engine Running"}
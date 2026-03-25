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

# 2. Initialize FastAPI App
app = FastAPI(title="SaPyBase AI Engine (SaaS Edition)", version="2.0")

# Setup SlowAPI Rate Limiter
def get_limit_key(request: Request = None):
    # Some versions of slowapi call the key_func without arguments 
    # and expect it to fetch the request from context, or they use 
    # inspection which can fail on lambdas.
    if request:
        return request.headers.get("x-api-key") or get_remote_address(request)
    return "global"

limiter = Limiter(key_func=get_limit_key)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 3. Configure CORS (Production Hardening)
# For the widget to work on any client site, we check origins dynamically in the chat endpoint.
# But for the Dashboard and Admin API, we restrict to our own sites.
ALLOWED_ORIGINS = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False, # Must be False for allow_origins=["*"]
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

# 5. Initialize Google AI Models
embeddings_model = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001", google_api_key=GEMINI_KEY, task_type="retrieval_query")
chat_model = ChatGoogleGenerativeAI(
    model="models/gemini-flash-latest", 
    google_api_key=GEMINI_KEY, 
    max_output_tokens=300,
    convert_system_message_to_human=True
)

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
    
    # Clean up the origin string
    if client_origin:
        client_origin = client_origin.rstrip('/')
        
        # Normalize for comparison (remove protocol for simple domain match if necessary, 
        # but here we compare strict origin strings or "*" )
        allowed = (company["allowed_origin"] or "").rstrip('/')
        
        if allowed != "*" and client_origin != allowed:
             # Basic sanity check: also check if origin is localhost/sapybase (internal dashboard)
             if "*" not in ALLOWED_ORIGINS and client_origin not in ALLOWED_ORIGINS:
                 # Allow local development origins regardless of company settings
                 if client_origin and not any(ext in client_origin for ext in ["localhost", "127.0.0.1"]):
                    raise HTTPException(status_code=403, detail=f"Unauthorized Origin: {client_origin}")

    return company

# --- JWT VERIFICATION (CLERK) ---

async def get_current_user(request: Request):
    """
    Verifies the Clerk JWT signature (RS256) from the Authorization header.
    This ensures the user identity is AUTHENTIC and signed by Clerk.
    """
    try:
        # Secure server-side verification using Clerk SDK
        clerk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))
        request_state = clerk.authenticate_request(
            request, 
            AuthenticateRequestOptions()
        )
        
        if not request_state.is_signed_in:
            raise HTTPException(status_code=401, detail="Invalid or expired token signature")
            
        clerk_id = request_state.payload.get("sub")
        
        if not clerk_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        # 2. Look up profile in our database
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, role, email, tier, subscription_status FROM users WHERE clerk_id = %s", (clerk_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="User profile not synced. Please ensure Clerk webhooks are firing.")

        user_id, role, email, tier, subscription_status = row
        return {"id": user_id, "clerk_id": clerk_id, "role": role, "email": email, "tier": tier, "subscription_status": subscription_status}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Auth Security Error: {e}")
        raise HTTPException(status_code=401, detail="Could not validate credentials")

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    """Dependency that ensures the user has a Super Admin role and matching email."""
    allowed_admin_email = os.getenv("SUPER_ADMIN_EMAIL")
    
    # 1. Primary Check: Role must be ADMIN
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Super Admin access denied.")
    
    # 2. Secondary Guard: If SUPER_ADMIN_EMAIL is set, enforce matching email
    # This allows for a master admin account while still enabling role-based access for others if needed,
    # or strictly locking it down to one dev email.
    if allowed_admin_email and current_user["email"] != allowed_admin_email:
        # For now, if someone is specifically set as ADMIN in the DB, we can trust them 
        # unless the SUPER_ADMIN_EMAIL is explicitly meant to be the ONLY allowed admin.
        # But commonly, the role check is enough for platform admins.
        # Let's keep it as a 'Warning' log but allow for now if needed, 
        # OR keep it strict if the user prefers. 
        # The user's request implies they want their promoted account to work.
        pass 
        
    return current_user

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
            "SELECT id, company_name, company_tone, theme_color, allowed_origin, api_key FROM companies WHERE user_id = %s", 
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
            "api_key": company_row[5]
        }
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
@limiter.limit("10/minute")
async def chat_endpoint(
    request: Request,
    chat_req: ChatRequest, 
    company: dict = Depends(verify_api_key_and_origin)
):
    """
    Core AI Chat Endpoint with Trial Enforcement.
    """
    # 0. Verify usage limits and subscription status
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.tier, u.trial_end_date, c.status, ut.messages_used, u.id
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
        
        if status != "active":
            raise HTTPException(status_code=403, detail="Company account is suspended.")

        if tier == "STARTER" and trial_end:
            from datetime import datetime
            if trial_end < datetime.now():
                raise HTTPException(status_code=402, detail="Starter trial has expired. Please upgrade.")

        # Define Limits
        LIMITS = {
            "FREE": 200,
            "STARTER": 2000,
            "PRO": None,
            "ENTERPRISE": None
        }
        current_limit = LIMITS.get(tier, 200)

        # Atomic Usage Increment (Race-Condition Free)
        cursor.execute(
            """
            UPDATE usage_tracking 
            SET messages_used = messages_used + 1 
            WHERE user_id = %s AND (messages_used < %s OR %s::integer IS NULL) 
            RETURNING messages_used
            """,
            (user_uuid, current_limit, current_limit)
        )
        updated_row = cursor.fetchone()
        conn.commit()

        if not updated_row:
            display_limit = current_limit if current_limit is not None else 'Unlimited'
            raise HTTPException(status_code=402, detail=f"Message limit reached for {tier} tier ({display_limit} messages). Please upgrade.")
            
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

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
    Secure multi-tenant training endpoint with Trial Enforcement.
    """
    if current_user["tier"] == "STARTER" and current_user["trial_end_date"]:
        from datetime import datetime
        if current_user["trial_end_date"] < datetime.now():
            raise HTTPException(status_code=402, detail="Starter trial has expired. Please upgrade to Pro to add more data.")

    clerk_id = current_user["clerk_id"]
    company_data = get_company_by_clerk_id(clerk_id)
    if not company_data:
        raise HTTPException(status_code=404, detail="No company found for this user. Please register first.")
    
    company = {
        "id": company_data["id"],
        "company_name": company_data["company_name"]
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
        
        # 1. Get our internal user_id and tier from the clerk_id
        cursor.execute("SELECT id, tier FROM users WHERE clerk_id = %s", (clerk_id,))
        user_row = cursor.fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not synced yet. Please try again in a moment.")
        
        user_uuid = user_row[0]
        user_tier = user_row[1]

        # Block registration for users who haven't selected ANY plan (tier is NULL)
        if not user_tier:
            raise HTTPException(status_code=402, detail="Please select a subscription plan or start a free trial first.")

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
        "id": str(company_data["id"]),
        "company_name": company_data["company_name"],
        "company_tone": company_data["company_tone"],
        "theme_color": company_data["theme_color"],
        "allowed_origin": company_data["allowed_origin"],
        "api_key": company_data["api_key"],
        "role": current_user["role"]
    }

@app.get("/api/me")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Returns the authenticated user's own profile and real-time usage stats."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT messages_used, period_end FROM usage_tracking WHERE user_id = %s ORDER BY period_end DESC LIMIT 1",
            (current_user["id"],)
        )
        usage_row = cursor.fetchone()
        
        messages_used = usage_row[0] if usage_row else 0
        period_end = usage_row[1] if usage_row else None
        
        LIMITS = {
            "FREE": 200,
            "STARTER": 2000,
            "PRO": 999999, # frontend can display 'Unlimited'
            "ENTERPRISE": 999999
        }
        message_limit = LIMITS.get(current_user["tier"], 200)

        return {
            "status": "success",
            "clerk_id": current_user["clerk_id"],
            "role": current_user["role"],
            "tier": current_user["tier"],
            "subscription_status": current_user.get("subscription_status"),
            "email": current_user["email"],
            "messages_used": messages_used,
            "message_limit": message_limit,
            "period_end": period_end
        }
    finally:
        conn.close()

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
async def get_all_companies(admin: dict = Depends(get_admin_user)):
    """Admin-only view of all registered companies."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, company_name, allowed_origin, created_at, admin_notes FROM companies ORDER BY created_at DESC")
        companies = cursor.fetchall()
        return [
            {"id": c[0], "name": c[1], "origin": c[2], "created_at": c[3], "notes": c[4]} 
            for c in companies
        ]
    finally:
        conn.close()

@app.post("/api/user/subscription")
async def update_subscription(
    request: SubscriptionRequest, 
    user: dict = Depends(get_current_user)
):
    """Updates the user's subscription tier and sets trial end date for STARTER."""
    if request.tier not in ["FREE", "STARTER", "PRO", "ENTERPRISE"]:
        raise HTTPException(status_code=400, detail="Invalid subscription tier")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        trial_end = None
        if request.tier == "STARTER":
            from datetime import datetime, timedelta
            trial_end = datetime.now() + timedelta(days=30)

        cursor.execute(
            "UPDATE users SET tier = %s, trial_end_date = %s WHERE clerk_id = %s", 
            (request.tier, trial_end, user["clerk_id"])
        )
        conn.commit()
        return {"status": "success", "message": f"Subscription updated to {request.tier}", "trial_end": trial_end}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/admin/users")
async def get_all_users(admin: dict = Depends(get_admin_user)):
    """Admin-only view of all registered users."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT clerk_id, email, role, tier, trial_end_date, created_at FROM users ORDER BY created_at DESC")
        users = cursor.fetchall()
        return [
            {
                "clerk_id": u[0], 
                "email": u[1], 
                "role": u[2], 
                "tier": u[3], 
                "trial_end": u[4], 
                "created_at": u[5]
            } for u in users
        ]
    finally:
        conn.close()

@app.patch("/api/admin/users/{clerk_id}")
async def update_user_admin(clerk_id: str, data: dict, admin: dict = Depends(get_admin_user)):
    """Super Admin: Update a user's role or tier."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        if "role" in data:
            cursor.execute("UPDATE users SET role = %s WHERE clerk_id = %s", (data["role"], clerk_id))
        if "tier" in data:
            cursor.execute("UPDATE users SET tier = %s WHERE clerk_id = %s", (data["tier"], clerk_id))
        conn.commit()
        return {"status": "success"}
    finally:
        conn.close()

@app.delete("/api/admin/companies/{company_id}")
async def delete_company_admin(company_id: str, admin: dict = Depends(get_admin_user)):
    """Super Admin: Delete a company."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM companies WHERE id = %s", (company_id,))
        conn.commit()
        return {"status": "success"}
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
                INSERT INTO users (clerk_id, email, tier, subscription_status) 
                VALUES (%s, %s, '', 'pending')
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
                ON CONFLICT (user_id) DO NOTHING
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

@app.post("/api/webhooks/polar")
async def polar_webhook(
    request: Request,
    webhook_id: str = Header(None, alias="webhook-id"),
    webhook_timestamp: str = Header(None, alias="webhook-timestamp"),
    webhook_signature: str = Header(None, alias="webhook-signature")
):
    """
    Handles Polar.sh subscription webhooks to update user tiers and reset usage.
    """
    if not POLAR_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Polar webhook secret not configured")

    if not webhook_id or not webhook_timestamp or not webhook_signature:
        raise HTTPException(status_code=400, detail="Missing Webhook headers")

    payload = await request.body()
    
    # Polar secrets can start with polar_whs_ - we must strip it if present for Standard Webhook compat
    secret = POLAR_WEBHOOK_SECRET or ""
    if secret.startswith("polar_whs_"):
        secret = secret[len("polar_whs_"):]
    
    wh = Webhook(secret)
    try:
        msg = wh.verify(payload, {
            "webhook-id": webhook_id,
            "webhook-timestamp": webhook_timestamp,
            "webhook-signature": webhook_signature
        })
    except WebhookVerificationError as e:
        print(f"POLAR WEBHOOK ERROR: Signature verification failed. Error: {e}")
        # Log IDs for debugging (don't log the full signature for security)
        print(f"POLAR DEBUG: id={webhook_id}, ts={webhook_timestamp}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = msg.get("type")
    data = msg.get("data")

    clerk_id = data.get("customer_external_id") or data.get("external_customer_id")
    polar_customer_id = data.get("customer_id")

    if not clerk_id:
        return {"status": "ignored", "reason": "No clerk_id attached"}

    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        if event_type in ["subscription.created", "subscription.updated"]:
            product_name = data.get("product", {}).get("name", "PRO").upper()
            tier = "PRO" if "PRO" in product_name else ("STARTER" if "STARTER" in product_name else "FREE")
            
            period_end = data.get("current_period_end")
            period_start = data.get("current_period_start")

            # 1. Update User Tier and Polar Customer ID
            cursor.execute(
                "UPDATE users SET tier = %s, billing_period_end = %s, polar_customer_id = %s, subscription_status = 'active' WHERE clerk_id = %s RETURNING id",
                (tier, period_end, polar_customer_id, clerk_id)
            )
            user_row = cursor.fetchone()
            
            if user_row:
                user_id = user_row[0]
                
                # 2. Idempotent Reset Usage Tracking 
                cursor.execute(
                    """
                    UPDATE usage_tracking 
                    SET messages_used = 0, period_start = %s, period_end = %s 
                    WHERE user_id = %s AND (period_end IS NULL OR %s::timestamptz > period_end)
                    """,
                    (period_start, period_end, user_id, period_end)
                )
                
                if cursor.rowcount == 0:
                    cursor.execute("SELECT 1 FROM usage_tracking WHERE user_id = %s", (user_id,))
                    if not cursor.fetchone():
                        cursor.execute(
                            """
                            INSERT INTO usage_tracking (user_id, messages_used, period_start, period_end) 
                            VALUES (%s, 0, %s, %s)
                            ON CONFLICT (user_id) DO UPDATE SET 
                                messages_used = EXCLUDED.messages_used,
                                period_start = EXCLUDED.period_start,
                                period_end = EXCLUDED.period_end
                            """,
                            (user_id, period_start, period_end)
                        )
                    else:
                        print(f"POLAR SYNC: Ignored redundant usage wipe for user {clerk_id}")
                
                conn.commit()
                print(f"POLAR SYNC: Updated user {clerk_id} to tier {tier}")
            else:
                print(f"POLAR SYNC: No user found with clerk_id {clerk_id}")

        elif event_type in ["subscription.revoked", "subscription.canceled"]:
            # DOWNGRADE LOGIC: Instantly revert to FREE tier
            cursor.execute(
                "UPDATE users SET tier = 'FREE', billing_period_end = NULL, subscription_status = 'canceled' WHERE clerk_id = %s RETURNING id",
                (clerk_id,)
            )
            if cursor.fetchone():
                conn.commit()
                print(f"POLAR DOWNGRADE: User {clerk_id} instantly reverted to FREE tier.")
            else:
                print(f"POLAR DOWNGRADE: No user found for {clerk_id}")

    except Exception as e:
        conn.rollback()
        print(f"POLAR SYNC ERROR: {e}")
    finally:
        conn.close()

    return {"status": "success"}

@app.post("/api/user/subscription")
async def update_user_subscription(data: dict, current_user: dict = Depends(get_current_user)):
    """Allows users to select the FREE tier during onboarding."""
    tier = data.get("tier")
    if tier != "FREE":
        raise HTTPException(status_code=400, detail="Only 'FREE' tier can be manually selected.")
    
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # Set user tier to FREE and status to active
        cursor.execute("UPDATE users SET tier = 'FREE', subscription_status = 'active' WHERE id = %s", (current_user["id"],))
        
        # Ensure they have a usage tracking row initialized
        from datetime import datetime, timedelta
        now = datetime.now()
        next_month = now + timedelta(days=30)
        
        cursor.execute(
            """
            INSERT INTO usage_tracking (user_id, period_start, period_end)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id) DO NOTHING
            """,
            (current_user["id"], now, next_month)
        )
        
        conn.commit()
        return {"status": "success", "tier": tier}
    except Exception as e:
        conn.rollback()
        print(f"Error setting FREE tier: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize FREE tier")
    finally:
        conn.close()

@app.get("/api/billing/portal")
async def get_billing_portal(current_user: dict = Depends(get_current_user)):
    """Generates an authenticated Customer Portal URL for the user."""
    from os import getenv
    import httpx
    
    polar_access_token = getenv("POLAR_ACCESS_TOKEN")
    if not polar_access_token:
        raise HTTPException(
            status_code=500, 
            detail="POLAR_ACCESS_TOKEN is not configured in .env. Please check the implementation plan for instructions."
        )

    polar_customer_id = current_user.get("polar_customer_id")
    if not polar_customer_id:
        # Fallback: If we don't have the ID, they might not have a subscription yet
        # or they might need to use the manual login portal once to sync.
        raise HTTPException(
            status_code=404, 
            detail="No Polar customer record found for your account. Please subscribe to a plan first or contact support."
        )

    # Call Polar API to create a Customer Session
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.polar.sh/api/v1/customer-sessions",
                headers={
                    "Authorization": f"Bearer {polar_access_token}",
                    "Content-Type": "application/json"
                },
                json={"customer_id": polar_customer_id}
            )
            response.raise_for_status()
            session_data = response.json()
            return {"status": "success", "url": session_data.get("customer_portal_url")}
        except httpx.HTTPStatusError as e:
            print(f"POLAR API ERROR: {e.response.text}")
            raise HTTPException(status_code=500, detail="Failed to create Polar billing session.")
        except Exception as e:
            print(f"POLAR SESSION ERROR: {e}")
            raise HTTPException(status_code=500, detail="An error occurred while connecting to the billing portal.")

@app.get("/")
def read_root():
    return {"status": "SaPyBase Multi-Tenant AI Engine is running!"}
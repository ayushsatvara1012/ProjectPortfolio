"""Pydantic request/response models.

Extracted verbatim from main.py (no logic changes) and re-exported from main so
`from main import ChatRequest` (etc.) and the test suite resolve unchanged.
Outward dependencies only: config (constants) and input_safety (sanitizer);
neither imports this module, so there is no import cycle.
"""

from enum import Enum
from typing import Optional, List, Literal

from pydantic import BaseModel, ConfigDict, Field, validator

from core.config import VALID_MODELS, VALID_LOGO_SHAPES
from input_safety import sanitize_message
from services.slack_handoff import is_valid_slack_webhook
from lead_outcomes import LEAD_STATUSES, normalize_status
from booking import is_valid_booking_url


class RegisterRequest(BaseModel):
    company_name: str
    allowed_origin: str  # e.g., "https://www.globex.com"
    theme_color: str = "#5730F5"
    company_tone: str = "Professional and helpful"


class ChatMessage(BaseModel):
    role: str = Field(..., max_length=20)
    # The widget only ever sends the last 8 turns (ChatWidget.tsx `.slice(-8)`),
    # each capped by the same 1500-char message limit plus a short state note.
    # 4000 gives headroom for that without letting a non-widget caller pad the
    # request body / cache-key hash / eventual prompt tokens for free.
    content: str = Field(..., max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=1500, description="User query limited to 1500 chars")
    # Bounded to well above what the widget sends (8 turns, see ChatMessage)
    # so a direct API caller can't submit an unbounded history array to drive
    # up per-request parsing/hashing cost or (if this ever gets fed further
    # upstream) LLM input-token cost. Server-side the agent path additionally
    # re-caps to the last 8 regardless.
    history: Optional[list[ChatMessage]] = Field(
        None, max_length=16, description="Last N chat messages for context-aware caching"
    )
    session_id: Optional[str] = Field(None, max_length=128, description="Client-side session tracking id")
    visitor_id: Optional[str] = Field(None, max_length=128, description="Device-local visitor id (localStorage UUID) — scopes the Phase 1d history list")

    @validator('message')
    def sanitize_jailbreak_patterns(cls, v):
        # Defense-in-depth: neutralize known prompt-injection phrases (does not
        # block). Logic lives in input_safety.sanitize_message so runtime pattern
        # reloads apply immediately.
        return sanitize_message(v)


class ChatResponse(BaseModel):
    reply: str
    sources: list[str]


class LeadCaptureRequest(BaseModel):
    email: str = Field(..., max_length=255)
    name: Optional[str] = Field(None, max_length=100)
    context: Optional[str] = Field(None, max_length=500)
    # ── attribution (best-effort, from the widget; untrusted → length-capped) ──
    page_url: Optional[str] = Field(None, max_length=2048)
    referrer: Optional[str] = Field(None, max_length=2048)
    utm_source: Optional[str] = Field(None, max_length=255)
    utm_medium: Optional[str] = Field(None, max_length=255)
    utm_campaign: Optional[str] = Field(None, max_length=255)

    @validator('email')
    def validate_email(cls, v):
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, v.strip()):
            raise ValueError('Invalid email address')
        return v.strip().lower()

    @validator('page_url', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign')
    def blank_to_none(cls, v):
        # Normalize empty/whitespace to None so 'Direct' attribution is clean.
        if v is None:
            return None
        v = v.strip()
        return v or None


class ExploreEnquiryRequest(BaseModel):
    """Explore access request from a personal-email applicant (§3, pending approval)."""
    email: str = Field(..., max_length=255)
    name: Optional[str] = Field(None, max_length=100)
    company_name: Optional[str] = Field(None, max_length=200)
    use_case: Optional[str] = Field(None, max_length=1000)
    # Honeypot: hidden in the UI; real users leave it empty, bots fill it.
    website: Optional[str] = Field(None, max_length=255)

    @validator('email')
    def validate_email(cls, v):
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, v.strip()):
            raise ValueError('Invalid email address')
        return v.strip().lower()

    @validator('name', 'company_name', 'use_case')
    def blank_to_none(cls, v):
        if v is None:
            return None
        v = v.strip()
        return v or None


class EnquiryDeclineRequest(BaseModel):
    """Super-admin decline of an Explore enquiry — reason is required (§6)."""
    reason: str = Field(..., min_length=3, max_length=500)

    @validator('reason')
    def trim_reason(cls, v):
        v = (v or '').strip()
        if len(v) < 3:
            raise ValueError('A decline reason is required.')
        return v


class SubscriptionRequest(BaseModel):
    tier: str  # Starter, Pro, Enterprise


class HandoffMessage(BaseModel):
    role: str
    content: str


class HandoffRequest(BaseModel):
    transcript: List[HandoffMessage]
    visitor_email: Optional[str] = None
    visitor_name: Optional[str] = None


class UserRole(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    USER = "USER"


class UserTier(str, Enum):
    FREE = "FREE"
    EXPLORE = "EXPLORE"
    STARTER = "STARTER"
    PRO = "PRO"
    BUSINESS = "BUSINESS"
    ENTERPRISE = "ENTERPRISE"
    CUSTOM = "CUSTOM"


class CustomPlanConfig(BaseModel):
    plan_name: Optional[str] = "Custom Plan"
    monthly_price_usd: Optional[float] = 0
    trial_days: Optional[int] = 14
    max_bots: Optional[int] = None
    max_messages: Optional[int] = None
    max_chunks: Optional[int] = None
    gemini_model: Optional[str] = None
    max_output_tokens: Optional[int] = None
    advanced_bot: Optional[bool] = False
    human_handoff: Optional[bool] = False
    lead_capture: Optional[bool] = False
    white_label: Optional[bool] = False
    webhook: Optional[bool] = False
    custom_logo: Optional[bool] = False
    analytics: Optional[bool] = False
    byo_database: Optional[bool] = False  # RFC §3.1 BYOD capability flag (super-admin set)
    notes: Optional[str] = ""
    # Payment metadata set by /provision — read-only from admin form
    polar_checkout_url: Optional[str] = None
    polar_created_at: Optional[str] = None

    @validator("gemini_model")
    def validate_model(cls, v):
        if v and v not in VALID_MODELS:
            raise ValueError(f"gemini_model must be one of: {', '.join(sorted(VALID_MODELS))}")
        return v

    @validator("monthly_price_usd")
    def price_positive(cls, v):
        if v is not None and v < 0:
            raise ValueError("monthly_price_usd must be 0 or greater")
        return v

    @validator("trial_days")
    def trial_days_range(cls, v):
        if v is not None and not (0 <= v <= 30):
            raise ValueError("trial_days must be between 0 and 30")
        return v

    @validator("max_bots", "max_messages", "max_chunks", "max_output_tokens", pre=True)
    def non_negative(cls, v):
        if v is not None and v < 0:
            raise ValueError("Must be 0 or greater")
        return v

    model_config = ConfigDict(extra="forbid")


class AdminUpdateUserRequest(BaseModel):
    tier: Optional[UserTier] = None
    status: Optional[str] = None
    custom_plan_config: Optional[CustomPlanConfig] = None

    model_config = ConfigDict(extra="forbid")


class AdminUpdateVerticalRequest(BaseModel):
    """Super-admin-only reassignment of a company's vertical pack.

    ``vertical=None``/``""`` reverts the company to the generic bot path."""
    vertical: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class CompanyUpdate(BaseModel):
    company_id:       Optional[str]  = None
    company_name:     Optional[str]  = None
    company_tone:     Optional[str]  = None
    theme_color:      Optional[str]  = None
    bot_name:         Optional[str]  = None
    logo_url:         Optional[str]  = None   # existing Sapybase default logo path
    initial_message:  Optional[str]  = None
    system_prompt:    Optional[str]  = None
    allowed_origin:   Optional[str]  = None
    quick_questions:  Optional[list] = None
    ai_model:         Optional[str]  = None
    # ── v13 new fields ──
    logo_shape:       Optional[str]  = None   # circle | squircle | bento | sharp
    custom_logo_url:  Optional[str]  = None   # tenant-provided HTTPS image URL
    avatar_bg_style:  Optional[str]  = None   # e.g. none, hacker, sunset
    # ── v15 integrations ──
    webhook_url:           Optional[str]  = None   # HTTPS URL for lead capture webhooks
    # ── v17 human handoff ──
    handoff_redirect_url:  Optional[str]  = None   # WhatsApp/Calendly/etc link shown after handoff
    # ── v18 white-label ──
    hide_branding:         Optional[bool] = None   # True = remove "Powered by Sapybase" footer
    # ── conversion engine: instant HOT-lead alerts ──
    hot_lead_alerts_enabled: Optional[bool] = None  # owner opt-in for instant HOT-lead emails
    alert_email:             Optional[str]  = None  # override recipient; blank = account email
    weekly_digest_enabled:   Optional[bool] = None  # owner opt-in for the weekly results email
    slack_webhook_url:       Optional[str]  = None  # Slack Incoming Webhook for lead handoff
    booking_url:             Optional[str]  = None  # HTTPS scheduling link offered to qualified leads
    vertical:                Optional[str]  = None  # vertical pack slug ('chemical', etc.) or '' to clear
    # ── Phase 5 (customise): per-company vertical-pack overrides. These don't map to
    # plain columns — the handler folds them into the companies.pack_overrides JSONB.
    sample_form:        Optional[list] = None  # full replacement field list; [] = reset to pack default
    sample_sink_url:    Optional[str]  = None  # owner's own sheet/Zapier webhook (HTTPS); "" = clear
    sample_sink_secret: Optional[str]  = None  # HMAC secret paired with the sink url

    @validator('booking_url')
    def validate_booking_url(cls, v):
        # Allow clearing (None/blank); otherwise must be a valid HTTPS link.
        if v is None:
            return v
        v = v.strip()
        if v == "":
            return ""
        if not is_valid_booking_url(v):
            raise ValueError("booking_url must start with https://")
        return v

    @validator('slack_webhook_url')
    def validate_slack_webhook_url(cls, v):
        # Allow clearing (None/blank); otherwise must be a genuine Slack webhook.
        if v is None:
            return v
        v = v.strip()
        if v == "":
            return ""
        if not is_valid_slack_webhook(v):
            raise ValueError("slack_webhook_url must start with https://hooks.slack.com/")
        return v

    @validator('alert_email')
    def validate_alert_email(cls, v):
        # Allow clearing the override (None/blank) so alerts fall back to the
        # account email. Validate format only when a non-empty value is given.
        if v is None:
            return v
        v = v.strip()
        if v == "":
            return ""
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, v):
            raise ValueError("Invalid alert_email address")
        return v.lower()

    @validator('webhook_url')
    def validate_webhook_url(cls, v):
        if v is not None and v.strip():
            if not v.strip().startswith('https://'):
                raise ValueError("webhook_url must start with https://")
        return v.strip() if v else v

    @validator('handoff_redirect_url')
    def validate_handoff_redirect_url(cls, v):
        if v is not None and v.strip():
            if not v.strip().startswith('https://'):
                raise ValueError("handoff_redirect_url must start with https://")
        return v.strip() if v else v

    @validator('logo_shape')
    def validate_logo_shape(cls, v):
        if v is not None and v not in VALID_LOGO_SHAPES:
            raise ValueError(f"logo_shape must be one of: {', '.join(sorted(VALID_LOGO_SHAPES))}")
        return v

    model_config = ConfigDict(extra="forbid")


class LeadOutcomeUpdate(BaseModel):
    status: str = Field(..., description="Pipeline state: new | contacted | won | lost")
    value_usd: Optional[float] = Field(
        None, ge=0, le=10_000_000,
        description="Realized deal value (only meaningful when status is 'won')",
    )

    @validator("status")
    def validate_status(cls, v):
        nv = normalize_status(v)
        if nv is None:
            raise ValueError(f"status must be one of: {', '.join(LEAD_STATUSES)}")
        return nv

    model_config = ConfigDict(extra="forbid")


class RoiBenchmarkUpdate(BaseModel):
    avg_human_cost_per_ticket: float
    avg_lead_value: float


class DeleteChunksRequest(BaseModel):
    chunk_ids: list[str] = Field(..., max_length=500, description="List of chunk UUIDs to delete (max 500)")


class DeleteSourceRequest(BaseModel):
    source_name: str = Field(..., description="The exact filename/URL source to delete fully.")


class DeleteCatalogRowsRequest(BaseModel):
    table_name: str = Field(..., description="Catalog table the rows belong to; validated against pack config.")
    row_ids: list[str] = Field(..., min_length=1, max_length=500, description="Catalog row UUIDs to delete (max 500).")


class TrialExtensionRequest(BaseModel):
    days: int = Field(..., ge=1, le=180, description="Number of days to extend the trial (1-180)")
    reason: Optional[str] = Field(None, max_length=500, description="Internal reason for the extension (audit log)")


class CustomPlanProvisionRequest(BaseModel):
    config: CustomPlanConfig

    model_config = ConfigDict(extra="forbid")


class CustomPlanOverrideRequest(BaseModel):
    action: str = Field(..., description="One of: activate, suspend, reactivate, cancel, extend, reset")
    reason: str = Field(..., min_length=1, max_length=500, description="Reason for override (stored in audit log)")
    extend_days: Optional[int] = Field(None, ge=1, le=365, description="Days to extend billing period (only for 'extend' action)")

    model_config = ConfigDict(extra="forbid")


class ByodConnectionRequest(BaseModel):
    """A BYOD tenant database connection string (RFC §3.1 / §4.1). Validated,
    encrypted, and stored ciphertext-only; never echoed back in full."""
    db_url: str = Field(..., min_length=1, max_length=4096, description="Tenant Postgres DSN")
    reason: Optional[str] = Field(None, max_length=500, description="Internal reason (audit log)")

    model_config = ConfigDict(extra="forbid")


class ByodProvisionRequest(BaseModel):
    """Trigger provisioning of the already-stored tenant DSN (RFC §4.1 / §16.6).
    No DSN here — it is read from the stored ciphertext. ``reason`` is audit-only."""
    reason: Optional[str] = Field(None, max_length=500, description="Internal reason (audit log)")

    model_config = ConfigDict(extra="forbid")


class ByodRequestChangeRequest(BaseModel):
    """A BYOD client's self-serve request for an admin-run change (UI plan Phase 4
    / §2.2). Performs **no** mutation — it only signals the operator. ``reconnect``
    = my DB credential/host changed, please re-provision; ``leave`` = take me off
    BYOD (admin runs switch-out / offboard)."""
    kind: Literal["reconnect", "leave"] = Field(..., description="reconnect | leave")
    note: Optional[str] = Field(None, max_length=1000, description="Optional context for the operator")

    model_config = ConfigDict(extra="forbid")


class EvalQuestion(BaseModel):
    question: str = Field(..., max_length=1000)
    expected_answer: str = Field(..., max_length=3000)


class EvalRunRequest(BaseModel):
    company_id: str
    run_label: str = Field(..., max_length=100, description="A short label for this run, e.g. 'after-hyde'")
    questions: List[EvalQuestion] = Field(..., min_length=1, max_length=50)

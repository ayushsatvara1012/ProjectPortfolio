// Single source of truth for response shapes from the FastAPI backend.
// Add fields as endpoints solidify; keep optional where the backend may omit.

export type Tier = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE' | 'CUSTOM';
export type Role = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export interface MeResponse {
  role: Role | string;
  tier: Tier | string;
  subscription_status?: string;
  trial_end_date?: string | null;
  messages_used?: number;
  message_limit?: number;
  total_documents?: number;
  total_messages?: number;
  billing_period_end?: string | null;
  custom_plan_name?: string | null;
  custom_plan_features?: unknown;
}

export interface BotSummary {
  id: string;
  bot_name: string;
  company_name: string;
  theme_color: string;
  allowed_origin: string;
  messages_used: number;
}

export interface BotPlan {
  tier: string;
  can_add_more: boolean;
  speed_tier: string;
  current_bots: number;
  max_bots: number;
  message_limit: number;
  chunk_limit: number;
}

export interface CompaniesResponse {
  bots: BotSummary[];
  plan: BotPlan;
}

export interface CompanyDetails {
  bot_name?: string;
  theme_color?: string;
  initial_message?: string;
  quick_questions?: unknown;
  company_tone?: string;
  system_prompt?: string;
  ai_model?: string;
  logo_shape?: string;
  custom_logo_url?: string;
  avatar_bg_style?: string;
  webhook_url?: string;
  handoff_redirect_url?: string;
  hide_branding?: boolean;
  booking_url?: string;
}

export interface CompanyDetailsResponse {
  company?: CompanyDetails;
}

export interface TrainStatusResponse {
  status: 'queued' | 'running' | 'done' | 'error';
  progress?: number;
  total?: number;
  chunks_added?: number;
  is_upsert?: boolean;
  truncated?: boolean;
  message?: string;
}

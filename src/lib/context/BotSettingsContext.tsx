'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedFetch } from '@/src/lib/hooks/useAuthenticatedFetch';

// Phase 5 — one field of the customizable vertical-pack sample form.
export type SampleFormField = {
  name: string;
  label: string;
  type: string;       // text|email|tel|number|textarea|product|grade
  required: boolean;
  placeholder?: string;
};
// Phase 5 — a pack hub card (read-only here; drives the bot PREVIEW's hub render).
export type PreviewHubCard = { id: string; label: string; icon: string; subtitle?: string; action?: string };
// Contextual teaser (Phase 3) — one owner-authored URL rule. `id` is server-derived
// once saved (kept stable across edits so analytics stay attributed to the same
// rule); `match`/`page` are the target (at least one needed for the rule to fire).
export type TeaserRuleField = {
  id?: string;
  match: string;
  page: string;
  title: string;
  subtext: string;
};

type BotSettings = {
  name: string;
  primaryColor: string;
  greeting: string;
  quickQuestions: string[];
  companyTone: string[];
  systemPrompt: string;
  aiModel: string;
  logoShape: string;
  customLogoUrl: string;
  avatarBgStyle: string;
  webhookUrl: string;
  handoffRedirectUrl: string;
  hideBranding: boolean;
  // ── Conversion engine: lead alerts & notifications ──
  hotLeadAlertsEnabled: boolean;
  alertEmail: string;
  weeklyDigestEnabled: boolean;
  slackWebhookUrl: string;
  bookingUrl: string;
  // ── Phase 5 (customise): vertical-pack config ──
  vertical: string;                 // '' = generic bot; 'chemical' = chemical pack
  hubCards: PreviewHubCard[];        // read-only pack cards, for the preview's hub
  sampleForm: SampleFormField[];     // editable per-client sample form fields
  sampleSinkUrl: string;             // owner's own sheet/Zapier webhook
  sampleSinkSecret: string;          // HMAC secret paired with the sink
  sinkStatus: { ok: boolean; detail?: string; at?: string } | null;  // last "Send test row" outcome
  // ── COA finder (Phase 0): the client's Drive folder of certificates ──
  coaFolder: string;                 // owner pastes a Drive folder URL; '' = feature off
  coaFolderUrl: string;              // canonical URL echoed back for the saved folder
  // ── Spec finder (Phase 2): a SECOND, independent Drive folder of spec sheets ──
  specFolder: string;                // owner pastes a Drive folder URL; '' = feature off
  specFolderUrl: string;             // canonical URL echoed back for the saved folder
  // ── Contextual teaser (Phase 1): launcher bubble copy ──
  teaserEnabled: boolean;
  teaserTitle: string;               // '' = default copy ("Hi, I'm {botName}")
  teaserSubtext: string;             // '' = default copy
  // ── Contextual teaser (Phase 3): owner-authored page rules ──
  teaserRules: TeaserRuleField[];    // [] = no owner rules; falls back to pack seeds
};

type BotSettingsContextValue = {
  botSettings: BotSettings;
  updateSetting: (key: keyof BotSettings, value: any) => void;
  saveSettings: (botId?: string | null) => Promise<{ success: boolean; message?: string }>;
  fetchSettings: (botId?: string | null) => Promise<void>;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  error: string | null;
  previewOpen: boolean;
  setPreviewOpen: (open: boolean) => void;
};

export const BotSettingsContext = createContext<BotSettingsContextValue | undefined>(undefined);

const DEFAULT_SETTINGS: BotSettings = {
  name: 'Sapybase AI',
  primaryColor: '#5730F5',
  greeting: 'Hi! How can I help you today?',
  quickQuestions: ['Pricing'],
  companyTone: ['Professional'],
  systemPrompt: '',
  aiModel: '',
  logoShape: 'circle',
  customLogoUrl: '',
  avatarBgStyle: 'none',
  webhookUrl: '',
  handoffRedirectUrl: '',
  hideBranding: false,
  hotLeadAlertsEnabled: true,
  alertEmail: '',
  weeklyDigestEnabled: true,
  slackWebhookUrl: '',
  bookingUrl: '',
  vertical: '',
  hubCards: [],
  sampleForm: [],
  sampleSinkUrl: '',
  sampleSinkSecret: '',
  sinkStatus: null,
  coaFolder: '',
  coaFolderUrl: '',
  specFolder: '',
  specFolderUrl: '',
  teaserEnabled: true,
  teaserTitle: '',
  teaserSubtext: '',
  teaserRules: [],
};

const COMPANY_DETAILS_KEY = (botId: string | null) => ['company-details', botId ?? 'default'] as const;
const COMPANY_DETAILS_STALE_MS = 1000 * 60 * 5;

const mapCompanyToSettings = (company: any): BotSettings => {
  const rawQs = company.quick_questions || [];
  const parsedQuickQuestions = Array.isArray(rawQs) ? rawQs : [];
  const quickQuestions = parsedQuickQuestions
    .map((q: any) => (typeof q === 'string' ? q : q.label || q.prompt || ''))
    .filter(Boolean);
  return {
    name: company.bot_name || 'Sapybase AI',
    primaryColor: company.theme_color || '#5730F5',
    greeting: company.initial_message || 'Hi! How can I help you today?',
    quickQuestions,
    companyTone: company.company_tone ? company.company_tone.split(',') : [],
    systemPrompt: company.system_prompt || '',
    aiModel: company.ai_model || '',
    // Avatar shape is locked to circle product-wide; coerce any legacy value.
    logoShape: 'circle',
    customLogoUrl: company.custom_logo_url || '',
    avatarBgStyle: company.avatar_bg_style || 'none',
    webhookUrl: company.webhook_url || '',
    handoffRedirectUrl: company.handoff_redirect_url || '',
    hideBranding: company.hide_branding === true,
    // Default booleans to true when the backend omits them (undefined) so
    // existing customers keep alerts/digests; only an explicit false disables.
    hotLeadAlertsEnabled: company.hot_lead_alerts_enabled !== false,
    alertEmail: company.alert_email || '',
    weeklyDigestEnabled: company.weekly_digest_enabled !== false,
    slackWebhookUrl: company.slack_webhook_url || '',
    bookingUrl: company.booking_url || '',
    // Phase 5 — vertical-pack config. sample_form is the EFFECTIVE form (override or
    // pack default, pre-filled by the backend) so the editor starts from the live state.
    vertical: company.vertical || '',
    hubCards: Array.isArray(company.hub_cards) ? company.hub_cards : [],
    sampleForm: Array.isArray(company.sample_form) ? company.sample_form : [],
    sampleSinkUrl: company.sample_sink?.url || '',
    sampleSinkSecret: company.sample_sink?.secret || '',
    sinkStatus: company.channel_delivery_status?.sink || null,
    // COA finder (Phase 0) — the backend stores the extracted folder ID but echoes
    // a canonical URL back; the editor shows the URL so the owner can click through
    // and confirm it points at the folder they meant.
    coaFolder: company.coa?.folder_url || '',
    coaFolderUrl: company.coa?.folder_url || '',
    // Spec finder (Phase 2) — the second folder, read from its own key so a bot with
    // one folder configured and not the other hydrates correctly either way.
    specFolder: company.spec?.folder_url || '',
    specFolderUrl: company.spec?.folder_url || '',
    // Contextual teaser (Phase 1) — enabled defaults to true; empty text means
    // "using the default copy" (shown as placeholder in the editor).
    teaserEnabled: company.teaser?.enabled !== false,
    teaserTitle: company.teaser?.title || '',
    teaserSubtext: company.teaser?.subtext || '',
    // Contextual teaser (Phase 3) — owner's own rules only; [] falls back to
    // the pack's seeded rules (not shown here — those live server-side).
    teaserRules: Array.isArray(company.teaser?.rules)
      ? company.teaser.rules.map((r: any) => ({
          id: typeof r?.id === 'string' ? r.id : undefined,
          match: r?.match || '',
          page: r?.page || '',
          title: r?.title || '',
          subtext: r?.subtext || '',
        }))
      : [],
  };
};

export const BotSettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const authFetch = useAuthenticatedFetch();
  const [botSettings, setBotSettings] = useState<BotSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string>('');

  const isDirty = useMemo(
    () => savedSnapshot !== '' && JSON.stringify(botSettings) !== savedSnapshot,
    [botSettings, savedSnapshot],
  );

  const fetchSettings = useCallback(async (botId: string | null = null) => {
    if (!isSignedIn) return;
    setError(null);
    try {
      // React Query cache: dedupes concurrent loads and serves stale-fresh data
      // instantly when the user toggles back to a previously-selected bot.
      const data = await queryClient.fetchQuery({
        queryKey: COMPANY_DETAILS_KEY(botId),
        staleTime: COMPANY_DETAILS_STALE_MS,
        queryFn: async () => {
          setIsLoading(true);
          const url = botId
            ? `/api/company/details?company_id=${botId}`
            : `/api/company/details`;
          return authFetch<any>(url);
        },
      });

      if (data?.company) {
        const mapped = mapCompanyToSettings(data.company);
        setBotSettings(mapped);
        setSavedSnapshot(JSON.stringify(mapped));
      }
    } catch (err) {
      console.error('Failed to fetch bot settings:', err);
      setError('Could not load settings.');
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, authFetch, queryClient]);

  const saveSettings = async (botId: string | null = null) => {
    setIsSaving(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        company_id: botId,
        bot_name: botSettings.name,
        theme_color: botSettings.primaryColor,
        initial_message: botSettings.greeting,
        company_tone: botSettings.companyTone.join(','),
        system_prompt: botSettings.systemPrompt,
        quick_questions: botSettings.quickQuestions,
        ai_model: botSettings.aiModel || null,
        logo_shape: botSettings.logoShape,
        custom_logo_url: botSettings.customLogoUrl || null,
        avatar_bg_style: botSettings.avatarBgStyle,
        webhook_url: botSettings.webhookUrl || null,
        handoff_redirect_url: botSettings.handoffRedirectUrl || null,
        hide_branding: botSettings.hideBranding,
        // vertical intentionally excluded — locked to SUPER_ADMIN edits via the
        // admin panel (docs/archived/vertical-lock-plan.md); this page renders it read-only.
        hot_lead_alerts_enabled: botSettings.hotLeadAlertsEnabled,
        alert_email: botSettings.alertEmail.trim() || null,
        weekly_digest_enabled: botSettings.weeklyDigestEnabled,
        slack_webhook_url: botSettings.slackWebhookUrl.trim() || null,
        booking_url: botSettings.bookingUrl.trim() || null,
        // Contextual teaser (Phase 1) — blank text resets to the default copy.
        teaser_enabled: botSettings.teaserEnabled,
        teaser_title: botSettings.teaserTitle.trim(),
        teaser_subtext: botSettings.teaserSubtext.trim(),
        // Contextual teaser (Phase 3) — full replacement; the backend drops any
        // row missing a title or a target (match/page) rather than erroring, so
        // a half-filled draft row just silently doesn't fire yet.
        teaser_rules: botSettings.teaserRules.map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          match: r.match.trim(),
          page: r.page.trim(),
          title: r.title.trim(),
          subtext: r.subtext.trim(),
        })),
      };
      // Phase 5 — only a vertical (pack) bot carries pack_overrides; a generic bot
      // never sends these, so it can never accidentally grow a pack_overrides row.
      if (botSettings.vertical) {
        payload.sample_form = botSettings.sampleForm;
        payload.sample_sink_url = botSettings.sampleSinkUrl.trim();
        payload.sample_sink_secret = botSettings.sampleSinkSecret.trim();
        // COA finder (Phase 0) — send the raw paste; the backend extracts the folder
        // ID and 400s on an unparseable link rather than silently ignoring it.
        payload.coa_folder = botSettings.coaFolder.trim();
        // Spec finder (Phase 2) — sent as its own key, so saving one folder never
        // rewrites the other (D4). Same contract: raw paste, backend extracts and 400s.
        payload.spec_folder = botSettings.specFolder.trim();
      }
      await authFetch<any>('/api/company', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      // Invalidate cached company details so the next read fetches fresh data.
      queryClient.invalidateQueries({ queryKey: COMPANY_DETAILS_KEY(botId) });
      queryClient.invalidateQueries({ queryKey: ['bots'] });
      setSavedSnapshot(JSON.stringify(botSettings));
      return { success: true };
    } catch (err: any) {
      console.error('Failed to save bot settings:', err);
      const msg = err.message || 'Could not save settings.';
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (isSignedIn) {
      fetchSettings();
    }
  }, [isSignedIn, fetchSettings]);

  const updateSetting = (key: keyof BotSettings, value: any) =>
    setBotSettings((prev) => ({ ...prev, [key]: value }));

  return (
    <BotSettingsContext.Provider
      value={{
        botSettings,
        updateSetting,
        saveSettings,
        fetchSettings,
        isLoading,
        isSaving,
        isDirty,
        error,
        previewOpen,
        setPreviewOpen,
      }}
    >
      {children}
    </BotSettingsContext.Provider>
  );
};

export const useBotSettings = () => {
  const ctx = useContext(BotSettingsContext);
  if (!ctx) throw new Error('useBotSettings must be used within BotSettingsProvider');
  return ctx;
};

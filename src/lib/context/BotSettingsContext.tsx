'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

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
};

type BotSettingsContextValue = {
  botSettings: BotSettings;
  updateSetting: (key: keyof BotSettings, value: any) => void;
  saveSettings: (botId?: string | null) => Promise<{ success: boolean; message?: string }>;
  fetchSettings: (botId?: string | null) => Promise<void>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  previewOpen: boolean;
  setPreviewOpen: (open: boolean) => void;
};

const BotSettingsContext = createContext<BotSettingsContextValue | undefined>(undefined);

const DEFAULT_SETTINGS: BotSettings = {
  name: 'SaPyBase AI',
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
};

export const BotSettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const [botSettings, setBotSettings] = useState<BotSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';

  const fetchSettings = useCallback(async (botId: string | null = null) => {
    if (!isSignedIn) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const url = botId
        ? `${baseUrl}/api/company/details?company_id=${botId}`
        : `${baseUrl}/api/company/details`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok && data.company) {
        const rawQs = data.company.quick_questions || [];
        const parsedQuickQuestions = Array.isArray(rawQs) ? rawQs : [];
        const quickQuestions = parsedQuickQuestions
          .map((q: any) => (typeof q === 'string' ? q : q.label || q.prompt || ''))
          .filter(Boolean);

        setBotSettings({
          name: data.company.bot_name || 'SaPyBase AI',
          primaryColor: data.company.theme_color || '#5730F5',
          greeting: data.company.initial_message || 'Hi! How can I help you today?',
          quickQuestions,
          companyTone: data.company.company_tone ? data.company.company_tone.split(',') : [],
          systemPrompt: data.company.system_prompt || '',
          aiModel: data.company.ai_model || '',
          logoShape: data.company.logo_shape || 'circle',
          customLogoUrl: data.company.custom_logo_url || '',
          avatarBgStyle: data.company.avatar_bg_style || 'none',
          webhookUrl: data.company.webhook_url || '',
          handoffRedirectUrl: data.company.handoff_redirect_url || '',
          hideBranding: data.company.hide_branding === true,
        });
      }
    } catch (err) {
      console.error('Failed to fetch bot settings:', err);
      setError('Could not load settings.');
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, getToken, baseUrl]);

  const saveSettings = async (botId: string | null = null) => {
    setIsSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/company`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = typeof data.detail === 'string' ? data.detail : data.detail?.message || 'Save failed';
        throw new Error(msg);
      }
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
    if (isAuthLoaded && isSignedIn) {
      fetchSettings();
    }
  }, [isAuthLoaded, isSignedIn, fetchSettings]);

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

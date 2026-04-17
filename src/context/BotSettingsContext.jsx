import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

const BotSettingsContext = createContext();

export const BotSettingsProvider = ({ children }) => {
    const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
    const [botSettings, setBotSettings] = useState({
        name: 'SaPyBase AI',
        primaryColor: '#5730F5',
        greeting: 'Hi! How can I help you today?',
        quickQuestions: ['Pricing'],
        companyTone: ['Professional'],
        systemPrompt: '',
        aiModel: '',
        // ── v13: logo customization ──
        logoShape: 'circle',        // circle | squircle | bento | sharp
        customLogoUrl: '',          // tenant-provided HTTPS image URL
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    const baseUrl = import.meta.env.VITE_API_URL || '';

    const fetchSettings = async (botId = null) => {
        if (!isSignedIn) return;
        setIsLoading(true);
        setError(null);
        try {
            const token = await getToken();
            const url = botId
                ? `${baseUrl}/api/company/details?company_id=${botId}`
                : `${baseUrl}/api/company/details`;

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (res.ok && data.company) {
                const rawQs = data.company.quick_questions || [];
                const parsedQuickQuestions = Array.isArray(rawQs) ? rawQs : [];
                // Normalise: backend now returns string[], but guard against old {label,prompt} rows
                const quickQuestions = parsedQuickQuestions.map(q =>
                    typeof q === 'string' ? q : (q.label || q.prompt || '')
                ).filter(Boolean);

                setBotSettings({
                    name: data.company.bot_name || 'SaPyBase AI',
                    primaryColor: data.company.theme_color || '#5730F5',
                    greeting: data.company.initial_message || 'Hi! How can I help you today?',
                    quickQuestions,
                    companyTone: data.company.company_tone ? data.company.company_tone.split(',') : [],
                    systemPrompt: data.company.system_prompt || '',
                    aiModel: data.company.ai_model || '',
                    // ── v13 ──
                    logoShape: data.company.logo_shape || 'circle',
                    customLogoUrl: data.company.custom_logo_url || '',
                    avatarBgStyle: data.company.avatar_bg_style || 'none',
                });
            }
        } catch (err) {
            console.error("Failed to fetch bot settings:", err);
            setError("Could not load settings.");
        } finally {
            setIsLoading(false);
        }
    };

    const saveSettings = async (botId = null) => {
        setIsSaving(true);
        setError(null);
        try {
            const token = await getToken();
            const res = await fetch(`${baseUrl}/api/company`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
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
                    // ── v13 ──
                    logo_shape: botSettings.logoShape,
                    custom_logo_url: botSettings.customLogoUrl || null,
                    avatar_bg_style: botSettings.avatarBgStyle,
                })
            });
            const data = await res.json();
            if (!res.ok) {
                const msg = typeof data.detail === 'string'
                    ? data.detail
                    : data.detail?.message || 'Save failed';
                throw new Error(msg);
            }
            return { success: true };
        } catch (err) {
            console.error("Failed to save bot settings:", err);
            const msg = err.message || "Could not save settings.";
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
    }, [isAuthLoaded, isSignedIn]);

    const updateSetting = (key, value) =>
        setBotSettings(prev => ({ ...prev, [key]: value }));

    return (
        <BotSettingsContext.Provider value={{
            botSettings,
            updateSetting,
            saveSettings,
            fetchSettings,
            isLoading,
            isSaving,
            error,
            previewOpen,
            setPreviewOpen
        }}>
            {children}
        </BotSettingsContext.Provider>
    );
};

export const useBotSettings = () => {
    const ctx = useContext(BotSettingsContext);
    if (!ctx) throw new Error('useBotSettings must be used within BotSettingsProvider');
    return ctx;
};

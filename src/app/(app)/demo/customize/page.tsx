'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getBotConfig, saveBotConfig } from '@/src/lib/demo/demoStorage';
import { SHAPE_CLASS_MAP, AVATAR_GRADIENTS, FAB_SHAPES } from '@/src/app/components/avatar/AvatarShared';
import BotPreview from '@/src/app/components/BotPreview';
import { BotAvatar } from '@/src/app/components/LogoCustomizer';
import { BotSettingsContext } from '@/src/lib/context/BotSettingsContext';

const IS_DEV = process.env.NODE_ENV === 'development';
const ASSET_BASE_URL = IS_DEV ? '' : 'https://www.sapybase.com';
const BrandLogo = `${ASSET_BASE_URL}/SB_loading.svg`;

const inputCls = "w-full text-sm font-google px-4 py-3 bg-slate-100 dark:bg-white/[0.04] focus:bg-slate-200 dark:focus:bg-white/[0.08] focus:outline-none text-slate-900 dark:text-slate-200 transition-colors rounded-xl";
const labelCls = "block text-sm font-medium font-google text-slate-600 dark:text-slate-400 mb-2 transition-colors";
const sectionHeadingCls = "text-sm font-semibold font-google text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-4 transition-colors";
const cardCls = "bg-white dark:bg-white/[0.02] rounded-2xl p-5 transition-colors duration-500";

// Shape / gradient / FAB definitions now imported from AvatarShared.ts
// Derive LOGO_SHAPE_DATA from FAB_SHAPES so paths stay in sync automatically.
const LOGO_SHAPE_DATA = (['circle', 'squircle', 'bento', 'sharp'] as const).map(id => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    path: FAB_SHAPES[id].path,
}));

const InlineLogoCustomizer = ({
    logoShape, customLogoUrl, primaryColor, botName,
    avatarBgStyle, onShapeChange, onUrlChange, onBgStyleChange, onPrimaryColorChange,
}: {
    logoShape: string; customLogoUrl: string; primaryColor: string; botName: string;
    avatarBgStyle: string; onShapeChange: (v: string) => void; onUrlChange: (v: string) => void;
    onBgStyleChange: (v: string) => void; onPrimaryColorChange: (v: string) => void;
}) => {
    const fileRef = React.useRef<HTMLInputElement>(null);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => onUrlChange(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-5">
            {/* Preview avatar */}
            <div className="flex items-center gap-4">
                <BotAvatar shapeId={logoShape} logoUrl={customLogoUrl} botName={botName} themeColor={primaryColor} size="lg" bgStyle={avatarBgStyle} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold font-google text-slate-700 dark:text-slate-300">{botName || 'Bot'}</p>
                    <p className="text-xs font-google text-slate-400 dark:text-slate-500 mt-0.5">Avatar preview</p>
                </div>
            </div>

            {/* Theme color */}
            <div>
                <label className={labelCls}>Theme Color</label>
                <div className="flex gap-3 items-center">
                    <input
                        type="color"
                        value={primaryColor || '#5730F5'}
                        onChange={e => onPrimaryColorChange(e.target.value)}
                        className="w-12 h-10 border border-gray-200 dark:border-slate-800 p-1 cursor-pointer bg-transparent rounded-lg shrink-0"
                    />
                    <input
                        type="text"
                        value={primaryColor || '#5730F5'}
                        onChange={e => onPrimaryColorChange(e.target.value)}
                        className={inputCls + ' font-mono'}
                        placeholder="#5730F5"
                    />
                </div>
            </div>

            {/* Logo shape */}
            <div>
                <label className={labelCls}>Avatar Shape</label>
                <div className="grid grid-cols-4 gap-4 py-2">
                    {LOGO_SHAPE_DATA.map(s => {
                        const isSelected = logoShape === s.id;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => onShapeChange(s.id)}
                                className="group relative flex flex-col items-center gap-3 transition-all duration-300"
                            >
                                <div className={`flex items-center justify-center transition-all duration-300 ${isSelected ? 'text-blue-500 scale-110' : 'text-slate-300 dark:text-slate-700 group-hover:text-slate-400 dark:group-hover:text-slate-500 group-hover:scale-105'}`}>
                                    <div className="w-10 h-10 flex items-center justify-center">
                                        <svg viewBox="0 0 100 100" className="w-full h-full" fill="currentColor">
                                            <path d={s.path} />
                                        </svg>
                                    </div>
                                    {isSelected && (
                                        <div className="absolute -top-1 -right-1 bg-white dark:bg-slate-900 rounded-full shadow-sm">
                                            <span className="material-symbols-outlined text-[16px] text-blue-500 block p-0.5">check_circle</span>
                                        </div>
                                    )}
                                </div>
                                <span className={`text-xs font-semibold font-google transition-colors ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {s.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Avatar bg style */}
            <div>
                <label className={labelCls}>Avatar Background</label>
                <div className="flex flex-wrap gap-4 py-2">
                    {Object.entries(AVATAR_GRADIENTS).map(([baseId, gradData]) => {
                        const isSelected = (avatarBgStyle || 'none') === baseId;
                        const hasGradient = gradData !== null;
                        return (
                            <button
                                key={baseId}
                                type="button"
                                onClick={() => onBgStyleChange(baseId)}
                                className="group relative flex flex-col items-center gap-2 transition-all duration-300"
                            >
                                <div
                                    className={`w-10 h-10 rounded-full transition-all duration-300 flex items-center justify-center ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500 scale-110 dark:ring-offset-slate-900' : 'ring-1 ring-slate-200 dark:ring-slate-800 hover:scale-105'}`}
                                    style={hasGradient ? { background: `linear-gradient(135deg, ${gradData[0]}, ${gradData[1]})` } : { backgroundColor: 'transparent' }}
                                >
                                    {!hasGradient && <span className="material-symbols-outlined text-[16px] text-slate-400">block</span>}
                                    {isSelected && hasGradient && (
                                        <span className="material-symbols-outlined text-[18px] text-white font-bold">check</span>
                                    )}
                                </div>
                                <span className={`text-xs font-semibold font-google capitalize transition-colors ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {baseId}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Custom logo URL */}
            <div>
                <label className={labelCls}>Custom Logo URL</label>
                <input
                    type="url"
                    value={customLogoUrl}
                    onChange={e => onUrlChange(e.target.value)}
                    className={inputCls}
                    placeholder="https://example.com/logo.svg"
                />
            </div>

            {/* Upload */}
            <div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-2.5 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-sm font-semibold font-google text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-[16px]">upload</span> Upload Image
                </button>
            </div>
        </div>
    );
};

// ── Main Page ──
export default function DemoCustomizePage() {
    const [settings, setSettings] = React.useState<any>(null);
    const [isDark, setIsDark] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [alertOpen, setAlertOpen] = React.useState(false);

    React.useEffect(() => {
        setSettings(getBotConfig());
        const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isGlobalDark = document.documentElement.classList.contains('dark');
        setIsDark(isSystemDark || isGlobalDark);
    }, []);

    const updateSetting = (key: string, value: any) => {
        setSettings((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        saveBotConfig(settings);
        await new Promise(r => setTimeout(r, 800));
        setIsSaving(false);
        setAlertOpen(true);
        setTimeout(() => setAlertOpen(false), 3000);
    };

    if (!settings) return null;

    const TONES = ['Professional', 'Friendly', 'Humorous', 'Technical', 'Concise'];

    return (
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 bg-[#f8f9fa] dark:bg-[#05070a] transition-colors duration-500">

            {/* ── LEFT: Settings ── */}
            <div className="flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden border-r border-slate-100 dark:border-white/[0.04] transition-colors duration-500">
                
                {/* Header */}
                <div className="px-6 md:px-8 pt-6 pb-4 shrink-0">
                    <div className="flex items-center gap-2.5 mb-1">
                        <span className="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400">palette</span>
                        <h1 className="text-2xl font-semibold font-google text-slate-900 dark:text-slate-200 transition-colors">Customize bot</h1>
                    </div>
                    <p className="text-sm font-google text-slate-500 dark:text-slate-400 transition-colors">Changes reflect instantly in the preview.</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-google mt-1.5">
                        Demo Mode — local changes only
                    </p>
                </div>

                {/* Scrollable cards body */}
                <div data-lenis-prevent className="px-6 md:px-8 pb-6 space-y-4 relative flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    <div className="space-y-4">

                        {/* ── Bot Appearance ── */}
                        <div className={cardCls + ' space-y-4'}>
                            <p className={sectionHeadingCls}>
                                <span className="material-symbols-outlined text-[16px] text-slate-400">palette</span>
                                Bot appearance
                            </p>
                            <div>
                                <label className={labelCls}>Bot name</label>
                                <input
                                    type="text"
                                    value={settings.name || ''}
                                    onChange={e => updateSetting('name', e.target.value)}
                                    className={inputCls}
                                    placeholder="Sapybase AI"
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Greeting message</label>
                                <input
                                    type="text"
                                    value={settings.greeting || ''}
                                    onChange={e => updateSetting('greeting', e.target.value)}
                                    className={inputCls}
                                    placeholder="Hi! How can I help you today?"
                                />
                            </div>

                            {/* Branding toggle */}
                            <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] transition-colors">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium font-google text-slate-800 dark:text-slate-200 transition-colors">
                                        Remove "Powered by Sapybase" branding
                                    </p>
                                    <p className="text-xs font-google text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                                        Hide the Sapybase footer from your widget.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => updateSetting('hideBranding', !settings.hideBranding)}
                                    className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${settings.hideBranding ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow transition-transform duration-200 ${settings.hideBranding ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>

                        {/* ── Logo & Avatar Shape ── */}
                        <div className={cardCls}>
                            <p className={sectionHeadingCls}>
                                <span className="material-symbols-outlined text-[16px] text-slate-400">image</span>
                                Logo &amp; avatar shape
                            </p>
                            <InlineLogoCustomizer
                                logoShape={settings.logoShape || 'circle'}
                                customLogoUrl={settings.customLogoUrl || ''}
                                primaryColor={settings.primaryColor || '#5730F5'}
                                botName={settings.name || 'S'}
                                avatarBgStyle={settings.avatarBgStyle || 'none'}
                                onShapeChange={v => updateSetting('logoShape', v)}
                                onUrlChange={v => updateSetting('customLogoUrl', v)}
                                onBgStyleChange={v => updateSetting('avatarBgStyle', v)}
                                onPrimaryColorChange={v => { updateSetting('primaryColor', v); updateSetting('themeColor', v); }}
                            />
                        </div>

                        {/* ── Advanced: Tone + System Prompt + Quick Questions ── */}
                        <div className={cardCls + ' space-y-4'}>
                            <p className={sectionHeadingCls}>
                                <span className="material-symbols-outlined text-[16px] text-slate-400">psychology</span>
                                Advanced behavior
                            </p>

                            <div>
                                <label className={labelCls}>Company tone</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {TONES.map(tone => (
                                        <label key={tone} className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 dark:bg-white/[0.02] rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={(Array.isArray(settings.companyTone) ? settings.companyTone : []).includes(tone)}
                                                onChange={e => {
                                                    const prev: string[] = Array.isArray(settings.companyTone) ? settings.companyTone : [];
                                                    const next = e.target.checked ? [...prev, tone] : prev.filter((t: string) => t !== tone);
                                                    updateSetting('companyTone', next);
                                                }}
                                                className="w-4 h-4 accent-slate-900 dark:accent-blue-500 shrink-0"
                                            />
                                            <span className="text-sm font-google text-slate-700 dark:text-slate-300">{tone}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className={labelCls}>System prompt / instructions</label>
                                <textarea
                                    value={settings.systemPrompt || ''}
                                    onChange={e => updateSetting('systemPrompt', e.target.value)}
                                    className={inputCls + ' min-h-[120px] resize-none'}
                                    placeholder="Example: You are a helpful assistant for Sapybase..."
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className={labelCls + ' mb-0'}>Quick questions</label>
                                    <button
                                        onClick={() => updateSetting('quickQuestions', [...(Array.isArray(settings.quickQuestions) ? settings.quickQuestions : []), ''])}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium font-google bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.08] rounded-lg transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[12px]">add</span> Add
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {(Array.isArray(settings.quickQuestions) ? settings.quickQuestions : []).map((q: any, idx: number) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={typeof q === 'string' ? q : (q.label || '')}
                                                onChange={e => {
                                                    const newQs = [...settings.quickQuestions];
                                                    newQs[idx] = e.target.value;
                                                    updateSetting('quickQuestions', newQs);
                                                }}
                                                className={inputCls}
                                            />
                                            <button
                                                onClick={() => {
                                                    const newQs = [...settings.quickQuestions];
                                                    newQs.splice(idx, 1);
                                                    updateSetting('quickQuestions', newQs);
                                                }}
                                                className="p-2 text-slate-400 hover:text-red-500 transition-colors shrink-0 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── Integrations ── */}
                        <div className={cardCls + ' space-y-4'}>
                            <p className={sectionHeadingCls}>
                                <span className="material-symbols-outlined text-[16px] text-slate-400">webhook</span>
                                Integrations
                            </p>
                            <div>
                                <label className={labelCls}>Lead capture webhook URL</label>
                                <input
                                    type="url"
                                    value={settings.webhookUrl || ''}
                                    onChange={e => updateSetting('webhookUrl', e.target.value)}
                                    className={inputCls}
                                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Human handoff — instant contact link</label>
                                <input
                                    type="url"
                                    value={settings.handoffRedirectUrl || ''}
                                    onChange={e => updateSetting('handoffRedirectUrl', e.target.value)}
                                    className={inputCls}
                                    placeholder="https://wa.me/..."
                                />
                            </div>
                        </div>

                        {/* ── Save button ── */}
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full py-3.5 min-h-[48px] bg-slate-900 dark:bg-white text-white dark:text-black text-sm font-semibold font-google rounded-xl hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" />
                                    Saving…
                                </>
                            ) : 'Save settings'}
                        </button>

                        {/* Inline success alert */}
                        {alertOpen && (
                            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-xl">
                                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                <p className="text-sm font-semibold font-google">Settings saved successfully!</p>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {/* ── RIGHT: Preview ── */}
            <div className={`relative flex items-center justify-center border-t lg:border-t-0 min-h-[450px] lg:min-h-0 lg:flex-1 lg:shrink-0 overflow-hidden transition-colors ${isDark ? 'dark bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700"
                    style={{ backgroundImage: "url('/nature_1.webp')", backgroundColor: '#e2e8f0' }}
                />
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/60 backdrop-blur-[1px] pointer-events-none transition-colors duration-500" />

                {/* Theme toggle */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
                    <p className="text-xs font-medium font-google text-slate-500 dark:text-slate-400">Check contrast in both modes</p>
                    <button
                        onClick={() => setIsDark(!isDark)}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all border border-slate-200 dark:border-slate-700"
                    >
                        <div className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                            <span className="material-symbols-outlined text-[13px] text-slate-700 dark:text-slate-300">
                                {isDark ? 'light_mode' : 'dark_mode'}
                            </span>
                        </div>
                        <span className="text-xs font-medium font-google text-slate-700 dark:text-slate-300">
                            {isDark ? 'Light mode' : 'Dark mode'}
                        </span>
                    </button>
                </div>

                {/* Bot preview */}
                <div className="relative z-10 flex items-center justify-center w-full py-20 lg:py-0">
                    <div className="scale-[0.75] sm:scale-[0.82] lg:scale-100 transition-transform duration-500">
                        <BotSettingsContext.Provider value={{
                            botSettings: settings,
                            updateSetting: () => {},
                            saveSettings: async () => ({ success: true }),
                            fetchSettings: async () => {},
                            isLoading: false,
                            isSaving: false,
                            error: null,
                            previewOpen: false,
                            setPreviewOpen: () => {},
                        }}>
                            <BotPreview theme={isDark ? 'dark' : 'light'} />
                        </BotSettingsContext.Provider>
                    </div>
                </div>
            </div>

        </div>
    );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getBotConfig, saveBotConfig } from '@/src/lib/demo/demoStorage';
import { SHAPE_CLASS_MAP, AVATAR_GRADIENTS, FAB_SHAPES } from '@/src/app/components/avatar/AvatarShared';

const IS_DEV = process.env.NODE_ENV === 'development';
const ASSET_BASE_URL = IS_DEV ? '' : 'https://www.Sapybase.com';
const BrandLogo = `${ASSET_BASE_URL}/SB_loading.svg`;

const inputCls = "w-full text-md font-medium font-google px-3 py-2.5 bg-transparent border border-gray-300 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900/20 dark:focus:ring-blue-500/50 focus:border-slate-400 dark:focus:border-blue-400 text-slate-900 dark:text-slate-200 transition-colors rounded-sm";
const labelCls = "block text-lg font-semibold font-google text-slate-600 dark:text-slate-400 mb-1.5 transition-colors";
const headingCls = "text-xl font-medium font-google mb-4 transition-colors text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-green-600 dark:from-blue-400 dark:to-green-500";

// Shape / gradient / FAB definitions now imported from AvatarShared.ts
// (single source of truth — no local copies to drift)

// ── Icons ──────────────────────────────────────────────────────────────────
const MoreHorizontalIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
);
const XIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
const SendIcon = ({ color }: { color: string }) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
);

// ── BotAvatar (Inline) ──
const BotAvatar = ({ shapeId, logoUrl, botName, themeColor, size = 'md', bgStyle = 'none' }: any) => {
    const initial = String(botName || 'S').charAt(0).toUpperCase();
    const shapeClass = SHAPE_CLASS_MAP[shapeId] || 'rounded-full';
    const gradient = bgStyle && bgStyle !== 'none' ? AVATAR_GRADIENTS[bgStyle] : null;

    const sizeClasses: any = {
        sm: 'w-7 h-7 text-xs',
        md: 'w-10 h-10 text-md',
        lg: 'w-14 h-14 text-lg',
    };

    let bgProps: any = { backgroundColor: logoUrl ? '#ffffff' : themeColor };
    if (logoUrl && gradient) {
        bgProps = {
            background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
            backgroundColor: 'transparent'
        };
    }

    return (
        <div
            className={`${sizeClasses[size]} ${shapeClass} flex items-center justify-center border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden shrink-0`}
            style={bgProps}
        >
            {logoUrl ? (
                <img src={logoUrl} alt="" className="w-[80%] h-[80%] object-contain" />
            ) : (
                <span className="font-bold text-white leading-none">{initial}</span>
            )}
        </div>
    );
};

// ── Inline Bot Preview ──
const InlineBotPreview = ({ settings, theme = 'light' }: { settings: any; theme?: string }) => {
    const isDark = theme === 'dark';
    const color = settings.primaryColor || '#5730F5';
    const botName = settings.name || 'Demo Bot';
    const greeting = settings.greeting || 'Hi! How can I help you today?';
    const logoUrl = settings.customLogoUrl || '/SB_loading.svg';
    const logoShape = settings.logoShape || 'circle';
    const bgStyle = settings.avatarBgStyle || 'none';
    const hideBranding = settings.hideBranding || false;

    const quickQs = (Array.isArray(settings.quickQuestions) ? settings.quickQuestions : [])
        .map((q: any) => (typeof q === 'string' ? q : q.label || '')).filter(Boolean);

    return (
        <div className={`w-full max-w-[440px] h-[600px] flex flex-col border shadow-2xl overflow-hidden relative transition-all rounded-2xl ${isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
            {/* Header */}
            <div className="relative shrink-0">
                <div
                    className="absolute inset-0 animate-gradient-x opacity-20"
                    style={{
                        backgroundImage: `linear-gradient(90deg, ${color}, #f97316, ${color})`,
                        backgroundSize: '200% 200%'
                    }}
                />
                <div className={`backdrop-blur-md p-2 flex justify-end items-center relative z-10 border-b ${isDark ? 'bg-slate-900/40 text-slate-100 border-slate-800/50' : 'bg-white/40 text-slate-900 border-gray-200/50'}`}>
                    <div className="relative flex flex-row justify-between items-center w-full">
                        <div className="relative flex items-center gap-3 pl-4">
                            <div className="relative">
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white animate-pulse z-10" />
                                <BotAvatar shapeId={logoShape} logoUrl={settings.customLogoUrl} botName={botName} themeColor={color} bgStyle={bgStyle} />
                            </div>
                            <div className="flex flex-row items-center justify-center">
                                <p className="text-lg font-display font-bold" style={{ color }}>{botName}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                                <MoreHorizontalIcon />
                            </button>
                            <button className="p-2 hover:bg-red-50 rounded-full transition-colors group">
                                <XIcon />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className={`flex-1 p-4 flex flex-col gap-5 overflow-y-auto pt-6 pb-2 ${isDark ? 'bg-slate-950/50' : 'bg-gray-50/50'}`}>
                {/* Bot greeting */}
                <div className="flex max-w-[96%] self-start text-left">
                    <div className="flex flex-col max-w-full min-w-0 items-start">
                        <span className={`text-md uppercase tracking-widest font-bold font-sans mb-1.5 ml-1 leading-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {botName}
                        </span>
                        <div className={`px-4 py-2 min-h-[38px] flex items-center rounded-2xl rounded-tl-none border text-sm font-google leading-relaxed ${isDark ? 'bg-slate-800 text-slate-200 border-slate-700/60' : 'bg-white text-gray-800 border-gray-200/60'}`}>
                            {greeting}
                        </div>
                    </div>
                </div>

                {/* Mock user message */}
                <div className="flex max-w-[96%] self-end text-right">
                    <div className="flex flex-col max-w-full min-w-0 items-end">
                        <span className={`text-md uppercase tracking-widest font-bold font-sans mb-1.5 mr-1 leading-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            YOU
                        </span>
                        <div className="px-4 py-2 min-h-[38px] flex items-center rounded-2xl rounded-tr-none text-white text-sm font-google leading-relaxed" style={{ backgroundColor: color }}>
                            Looking good!
                        </div>
                    </div>
                </div>

                {/* Quick Questions */}
                {quickQs.length > 0 && (
                    <div className="flex flex-col items-end gap-2 px-3 pb-2 pt-1">
                        {quickQs.map((label: string, idx: number) => (
                            <button
                                key={idx}
                                className={`px-4 py-2.5 border rounded-md text-md font-regular font-google whitespace-nowrap ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex-1" />
            </div>

            {/* Branding Strip */}
            {!hideBranding && (
                <div className={`shrink-0 py-1.5 flex justify-center items-center backdrop-blur-sm ${isDark ? 'bg-slate-950/80' : 'bg-gray-50/80'}`}>
                    <span className={`flex items-center gap-1.5 text-[9px] font-sans font-bold uppercase tracking-[0.2em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        <img src={BrandLogo} alt="Sapybase" className="w-5 h-5 grayscale opacity-50" />
                        Powered by Sapybase
                    </span>
                </div>
            )}

            {/* Input Area */}
            <div className={`backdrop-blur-2xl border-t shrink-0 z-10 flex flex-col ${isDark ? 'bg-slate-900/95 border-slate-800/50' : 'bg-white/95 border-gray-200/50'}`}>
                <div className="p-2 w-full">
                    <div className="relative flex items-center gap-2 pb-1">
                        <input
                            readOnly
                            placeholder="Ask anything..."
                            className={`flex-1 min-h-[40px] bg-transparent px-2.5 py-[9px] focus:outline-none leading-relaxed text-xl font-medium font-sans ${isDark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-900 placeholder-gray-400'}`}
                        />
                        <button className="p-2 shrink-0 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center">
                            <SendIcon color={color} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Inline Logo Customizer ──
// Derive LOGO_SHAPE_DATA from FAB_SHAPES so paths stay in sync automatically.
const LOGO_SHAPE_DATA = (['circle', 'squircle', 'bento', 'sharp'] as const).map(id => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    path: FAB_SHAPES[id].path,
}));

const AVATAR_BG_STYLES = [
    { id: 'none', label: 'None' },
    { id: 'solid', label: 'Solid' },
    { id: 'gradient', label: 'Gradient' },
];

const InlineLogoCustomizer = ({
    logoShape, customLogoUrl, primaryColor, botName,
    avatarBgStyle, onShapeChange, onUrlChange, onBgStyleChange, onPrimaryColorChange,
}: {
    logoShape: string; customLogoUrl: string; primaryColor: string; botName: string;
    avatarBgStyle: string; onShapeChange: (v: string) => void; onUrlChange: (v: string) => void;
    onBgStyleChange: (v: string) => void; onPrimaryColorChange: (v: string) => void;
}) => {
    const fileRef = React.useRef<HTMLInputElement>(null);

    const shapeClass = logoShape === 'square' ? 'rounded-none' : logoShape === 'rounded' ? 'rounded-xl' : 'rounded-full';

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
                    <p className="text-md font-semibold font-google text-slate-700 dark:text-slate-300">{botName || 'Bot'}</p>
                    <p className="text-[11px] font-google text-slate-400 dark:text-slate-500 mt-0.5">Avatar preview</p>
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
                        className="w-12 h-10 border border-gray-200 dark:border-slate-700 p-1 cursor-pointer"
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
                                <div className={`flex items-center justify-center transition-all duration-300 ${isSelected ? 'text-blue-500 scale-110' : 'text-slate-300 group-hover:text-slate-400 group-hover:scale-105'}`}>
                                    <div className="w-10 h-10 flex items-center justify-center">
                                        <svg viewBox="0 0 100 100" className="w-full h-full" fill="currentColor">
                                            <path d={s.path} />
                                        </svg>
                                    </div>
                                    {isSelected && (
                                        <div className="absolute -top-1 -right-1 bg-white dark:bg-slate-900 rounded-full">
                                            <span className="material-symbols-outlined text-[16px] text-blue-500 block p-0.5">check_circle</span>
                                        </div>
                                    )}
                                </div>
                                <span className={`text-sm font-medium font-sans transition-colors ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
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
                <div className="flex flex-wrap gap-6 py-2">
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
                                    className={`w-10 h-10 rounded-full transition-all duration-300 flex items-center justify-center ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'ring-1 ring-gray-200 hover:scale-105'}`}
                                    style={hasGradient ? { background: `linear-gradient(135deg, ${gradData[0]}, ${gradData[1]})` } : { backgroundColor: '#fff' }}
                                >
                                    {!hasGradient && <span className="material-symbols-outlined text-[16px] text-slate-400">block</span>}
                                    {isSelected && hasGradient && (
                                        <span className="material-symbols-outlined text-[18px] text-white font-bold">check</span>
                                    )}
                                </div>
                                <span className={`text-sm font-normal font-google transition-colors ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
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
                    className="w-full py-2.5 border border-dashed border-gray-300 dark:border-slate-700 text-[10px] uppercase tracking-widest font-bold font-sans text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-[14px]">upload</span> Upload Image
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-[#E8EBF0] dark:bg-slate-900 transition-colors duration-500 min-h-[calc(100vh-3rem)] overflow-x-hidden">

            {/* ── LEFT: Settings Form ── */}
            <div className="bg-white dark:bg-slate-950 flex flex-col relative transition-colors">
                <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-800 shrink-0 transition-colors">
                    <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-0.5 transition-colors">Customize</h2>
                    <p className="text-md font-display text-slate-500 dark:text-slate-500 leading-relaxed transition-colors">Configure your bot's visual identity. Changes reflect instantly in the preview.</p>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar lg:max-h-[calc(100vh-9.5rem)]">
                    <div className="space-y-8">

                        {/* ── Bot Appearance ── */}
                        <div className="space-y-6">
                            <p className={headingCls + ' flex items-center'}>
                                <span className="material-symbols-outlined inline text-[14px] mr-1.5 text-slate-500 dark:text-slate-500 transition-colors">palette</span>
                                Bot Appearance
                            </p>
                            <div>
                                <label className={labelCls}>Bot Name</label>
                                <input
                                    type="text"
                                    value={settings.name || ''}
                                    onChange={e => updateSetting('name', e.target.value)}
                                    className={inputCls}
                                    placeholder="Sapybase AI"
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Greeting Message</label>
                                <input
                                    type="text"
                                    value={settings.greeting || ''}
                                    onChange={e => updateSetting('greeting', e.target.value)}
                                    className={inputCls}
                                    placeholder="Hi! How can I help you today?"
                                />
                            </div>

                            {/* Hide Branding toggle */}
                            <div className="relative">
                                <div className="flex items-start justify-between gap-4 p-4 border border-gray-200 dark:border-slate-800 bg-[#FAFAFA] dark:bg-slate-900 transition-colors">
                                    <div className="min-w-0">
                                        <p className="text-md font-semibold font-google text-slate-800 dark:text-slate-200 transition-colors">
                                            Remove "Powered by Sapybase" branding
                                        </p>
                                        <p className="text-[11px] font-google text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                                            Hide the Sapybase footer from your widget.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => updateSetting('hideBranding', !settings.hideBranding)}
                                        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${settings.hideBranding ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${settings.hideBranding ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 dark:border-slate-800 transition-colors" />

                        {/* ── Logo & Avatar Shape ── */}
                        <div className="space-y-4">
                            <p className={headingCls + ' flex items-center'}>
                                <span className="material-symbols-outlined inline text-[14px] mr-1.5 text-slate-500 dark:text-slate-500 transition-colors">image</span>
                                Logo & Avatar Shape
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

                        <div className="border-t border-gray-100 dark:border-slate-800 transition-colors" />

                        {/* ── Advanced: Tone + System Prompt + Quick Questions ── */}
                        <div className="space-y-6">
                            <div className="mb-6">
                                <label className={labelCls}>Company Tone</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {TONES.map(tone => (
                                        <label key={tone} className="flex items-center gap-2 p-3 border border-gray-100 dark:border-slate-800 bg-[#FAFAFA] dark:bg-slate-900 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={(Array.isArray(settings.companyTone) ? settings.companyTone : []).includes(tone)}
                                                onChange={e => {
                                                    const prev: string[] = Array.isArray(settings.companyTone) ? settings.companyTone : [];
                                                    const next = e.target.checked ? [...prev, tone] : prev.filter((t: string) => t !== tone);
                                                    updateSetting('companyTone', next);
                                                }}
                                                className="w-4 h-4 accent-slate-900 dark:accent-blue-600"
                                            />
                                            <span className="text-lg font-google text-slate-700 dark:text-slate-300">{tone}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className={labelCls}>System Prompt / Instructions</label>
                                <textarea
                                    value={settings.systemPrompt || ''}
                                    onChange={e => updateSetting('systemPrompt', e.target.value)}
                                    className={inputCls + ' min-h-[120px] resize-none py-3'}
                                    placeholder="Example: You are a helpful assistant for Sapybase..."
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className={labelCls + ' mb-0'}>Quick Questions</label>
                                    <button
                                        onClick={() => updateSetting('quickQuestions', [...(Array.isArray(settings.quickQuestions) ? settings.quickQuestions : []), ''])}
                                        className="p-1 px-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-500 text-[10px] uppercase tracking-widest font-bold font-sans transition-colors flex items-center gap-1.5"
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
                                                className={inputCls + ' text-md font-semibold py-2'}
                                            />
                                            <button
                                                onClick={() => {
                                                    const newQs = [...settings.quickQuestions];
                                                    newQs.splice(idx, 1);
                                                    updateSetting('quickQuestions', newQs);
                                                }}
                                                className="p-2 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 dark:border-slate-800 transition-colors" />

                        {/* ── Integrations ── */}
                        <div className="space-y-4">
                            <p className={headingCls + ' flex items-center'}>
                                <span className="material-symbols-outlined inline text-[14px] mr-1.5 text-slate-500 dark:text-slate-500 transition-colors">webhook</span>
                                Integrations
                            </p>
                            <div className="space-y-6">
                                <div>
                                    <label className={labelCls}>Lead Capture Webhook URL</label>
                                    <input
                                        type="url"
                                        value={settings.webhookUrl || ''}
                                        onChange={e => updateSetting('webhookUrl', e.target.value)}
                                        className={inputCls}
                                        placeholder="https://hooks.zapier.com/hooks/catch/..."
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Human Handoff — Instant Contact Link</label>
                                    <input
                                        type="url"
                                        value={settings.handoffRedirectUrl || ''}
                                        onChange={e => updateSetting('handoffRedirectUrl', e.target.value)}
                                        className={inputCls}
                                        placeholder="https://wa.me/..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ── Save Button ── */}
                        <div className="pt-4 border-t border-gray-100 dark:border-slate-800 transition-colors">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full py-4 min-h-[48px] bg-gradient-to-r from-blue-600 to-green-600 text-white text-lg uppercase tracking-widest font-bold font-sans hover:opacity-90 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        PERSISTING...
                                    </>
                                ) : 'SAVE_CONFIG'}
                            </button>
                        </div>

                        {/* Inline success alert */}
                        {alertOpen && (
                            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
                                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                <p className="text-sm font-semibold font-google">Settings saved successfully!</p>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {/* ── RIGHT: Preview Column ── */}
            <div className={`overflow-hidden border-t lg:border-t-0 lg:border-l w-full relative transition-colors flex flex-col items-center justify-center p-0 lg:p-8 ${isDark ? 'dark bg-slate-950 border-slate-800' : 'bg-[#FAFAFA] border-gray-100'}`}>
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-100 transition-opacity duration-700"
                    style={{ backgroundImage: "url('/nature_1.webp')" }}
                />
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/60 backdrop-blur-[1px] pointer-events-none transition-colors duration-500" />

                <div className="absolute bottom-8 lg:top-2 lg:bottom-auto left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 w-full px-4 text-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Check contrast in both modes</p>
                    <button
                        onClick={() => setIsDark(!isDark)}
                        className="flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all"
                    >
                        <div className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                            <span className="material-symbols-outlined text-[14px] text-slate-700 dark:text-slate-300">
                                {isDark ? 'light_mode' : 'dark_mode'}
                            </span>
                        </div>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-700 dark:text-slate-300">
                            {isDark ? 'Light Mode' : 'Dark Mode'} — <span className="text-blue-500 dark:text-amber-500">Switch</span>
                        </span>
                    </button>
                </div>

                <div className="w-full lg:w-full flex lg:items-center lg:justify-center origin-top lg:origin-center scale-[0.82] lg:scale-100 transition-transform duration-500 py-4 lg:py-0 relative z-10">
                    <InlineBotPreview settings={settings} theme={isDark ? 'dark' : 'light'} />
                </div>
            </div>

        </div>
    );
}

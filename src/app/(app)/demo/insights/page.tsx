'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { getBotConfig } from '@/src/lib/demo/demoStorage';

const cellCls = 'bg-white dark:bg-slate-900 rounded-2xl transition-colors duration-500';

// ─────────────────────────────────────────────────────────────────────────────
// One coherent demo business, told across every tab. Numbers reconcile:
// 420 conversations → 64 leads → 28 contacted → 11 won ($8,400) over 30 days.
// ─────────────────────────────────────────────────────────────────────────────

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const DEMO_LEADS = [
    { id: '1', email: 'amelia@northstar.io', name: 'Amelia Wong', score: 92, band: 'HOT', status: 'new', value_usd: null, context: 'Ready to buy — asked for a demo this week and pricing for 12 seats.', created_at: hoursAgo(2) },
    { id: '2', email: 'sarah@brightwell.co', name: 'Sarah Johnson', score: 88, band: 'HOT', status: 'new', value_usd: null, context: 'Asked about enterprise pricing and onboarding timeline.', created_at: hoursAgo(5) },
    { id: '3', email: 'marcus@techcorp.io', name: 'Marcus Chen', score: 76, band: 'WARM', status: 'contacted', value_usd: null, context: 'Wanted to confirm it integrates with Shopify before committing.', created_at: hoursAgo(26) },
    { id: '4', email: 'priya@launchpad.co', name: 'Priya Patel', score: 71, band: 'WARM', status: 'won', value_usd: 1200, context: 'Compared Pro vs Business and upgraded the same day.', created_at: hoursAgo(50) },
    { id: '5', email: 'diego@menloretail.com', name: 'Diego Alvarez', score: 44, band: 'COLD', status: 'new', value_usd: null, context: 'General question about the return policy.', created_at: hoursAgo(8) },
    { id: '6', email: 'tom@harborgoods.com', name: 'Tom Becker', score: 38, band: 'COLD', status: 'lost', value_usd: null, context: 'Asked about free-trial length, never replied to follow-up.', created_at: hoursAgo(72) },
];

const DEMO_FUNNEL = {
    stages: [
        { key: 'conversations', label: 'Conversations', count: 420, pct_of_top: 100, pct_of_prev: 100, dropoff_pct: 0 },
        { key: 'leads', label: 'Leads captured', count: 64, pct_of_top: 15, pct_of_prev: 15, dropoff_pct: 85 },
        { key: 'contacted', label: 'Contacted', count: 28, pct_of_top: 7, pct_of_prev: 44, dropoff_pct: 56 },
        { key: 'won', label: 'Won', count: 11, pct_of_top: 3, pct_of_prev: 39, dropoff_pct: 61 },
    ],
    overall: 2.6,
    wonValue: 8400,
    quality: {
        total_scored: 64,
        bands: [
            { band: 'hot', count: 18, pct: 28 },
            { band: 'warm', count: 27, pct: 42 },
            { band: 'cold', count: 19, pct: 30 },
        ],
    },
    sources: {
        total_leads: 64,
        items: [
            { source: 'Chat widget', leads: 41, won: 8, won_value: 5200 },
            { source: 'Pricing page', leads: 14, won: 2, won_value: 2100 },
            { source: 'Docs', leads: 9, won: 1, won_value: 1100 },
        ],
    },
};

const DEMO_FIXES = [
    { query: 'Do you offer a free trial?', ask_count: 9, last_asked: hoursAgo(3), confidence: null, category: 'unanswered' as const },
    { query: 'What is your refund policy?', ask_count: 6, last_asked: hoursAgo(20), confidence: null, category: 'unanswered' as const },
    { query: 'Can I export my leads to CSV?', ask_count: 4, last_asked: hoursAgo(28), confidence: 0.42, category: 'low_confidence' as const },
    { query: 'Do you support multiple languages?', ask_count: 3, last_asked: hoursAgo(40), confidence: 0.55, category: 'low_confidence' as const },
    { query: 'Is there a discount for nonprofits?', ask_count: 2, last_asked: hoursAgo(60), confidence: null, category: 'unanswered' as const },
];

const fmtMoney = (n: number) => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtNum = (n: number) => Number(n || 0).toLocaleString('en-US');

// ── Analytics report mock ────────────────────────────────────────────────────

function buildCalendarData() {
    const today = new Date();
    const seed = [0, 5, 0, 0, 8, 0, 3, 0, 0, 12, 0, 0, 6, 0, 9, 0, 0, 4, 0, 0, 7, 0, 11, 0, 2, 0, 0, 8, 0, 5];
    return Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (29 - i));
        const q = seed[i] ?? 0;
        return {
            date: d.toISOString().split('T')[0],
            total_questions: q,
            interacted_users: q > 0 ? Math.ceil(q * 0.7) : 0,
            answered_questions: q > 0 ? Math.ceil(q * 0.82) : 0,
            unanswered_questions: q > 0 ? Math.floor(q * 0.18) : 0,
            top_questions: q > 0 ? ['What are the pricing plans?', 'How do I get started?'] : [],
            top_unanswered: q > 0 && Math.floor(q * 0.18) > 0 ? ['Do you offer a free trial?'] : [],
        };
    });
}

function buildDemoReport(botName: string) {
    return {
        roi_metrics: { support_savings: '$312.50', potential_revenue: '$1,250.00' },
        top_trends: [
            'Users frequently ask about product pricing and available tiers.',
            'Questions about integration and setup process are common.',
            'Support inquiries focus on account management and billing.',
            'Feature requests appear regularly in conversations.',
        ],
        high_value_gaps: ['What is your refund policy?', 'Do you offer a free trial?', 'Can I export my data?'],
        actionable_advice: `Train ${botName} on more detailed FAQs to reduce unanswered queries. Focus on pricing tiers, refund policies, and free-trial availability to convert more visitors into leads.`,
        peak_activity_blocks: buildCalendarData(),
        recent_conversations: [
            { query: 'What are the pricing plans?', unanswered: false, timestamp: hoursAgo(1) },
            { query: 'Do you offer a free trial?', unanswered: true, timestamp: hoursAgo(2) },
            { query: 'How do I integrate the widget?', unanswered: false, timestamp: hoursAgo(3) },
            { query: 'What is your refund policy?', unanswered: true, timestamp: hoursAgo(4) },
            { query: 'Can I customize the bot appearance?', unanswered: false, timestamp: hoursAgo(5) },
        ],
    };
}

// ── Score / status styles (mirror LeadsPanel) ────────────────────────────────

const BAND_STYLES: Record<string, string> = {
    HOT: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-900/40',
    WARM: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-900/40',
    COLD: 'text-slate-500 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-800/40 dark:border-slate-700',
};
const STATUS_STYLES: Record<string, string> = {
    new: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-800/40 dark:border-slate-700',
    contacted: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-900/40',
    won: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-900/40',
    lost: 'text-slate-400 bg-slate-50 border-slate-200 dark:text-slate-500 dark:bg-slate-800/40 dark:border-slate-700',
};

const ScoreBadge = ({ score, band }: { score: number; band: string }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm border text-[10px] uppercase tracking-widest font-bold font-google whitespace-nowrap ${BAND_STYLES[band] || BAND_STYLES.COLD}`}>
        {band} · {score}
    </span>
);

// ── Action Center (default tab) ──────────────────────────────────────────────

const URGENCY = {
    high: { label: 'Act now', accent: 'border-l-rose-500', badge: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' },
    medium: { label: 'Soon', accent: 'border-l-amber-400', badge: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
    low: { label: 'Later', accent: 'border-l-slate-300 dark:border-l-slate-600', badge: 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400' },
} as const;
const BAND_CHIP: Record<string, string> = { HOT: 'bg-rose-500 text-white', WARM: 'bg-amber-400 text-white', COLD: 'bg-sky-400 text-white' };

const DemoActionCenterPanel = () => {
    const initialQueue = [
        { ...DEMO_LEADS[0], urgency: 'high' as const, reason: 'Hot lead · 2h old' },
        { ...DEMO_LEADS[1], urgency: 'high' as const, reason: 'Hot lead · 5h old' },
        { ...DEMO_LEADS[4], urgency: 'medium' as const, reason: 'Awaiting first reply · 8h old' },
    ];
    const [queue, setQueue] = React.useState(initialQueue);
    const [acted, setActed] = React.useState<Record<string, 'won' | 'lost'>>({});
    // Register the green/red colour, then drop the row a beat later.
    const act = (id: string, outcome: 'won' | 'lost') => {
        setActed(a => ({ ...a, [id]: outcome }));
        setTimeout(() => setQueue(q => q.filter(l => l.id !== id)), 480);
    };

    const counts = {
        high: queue.filter(l => l.urgency === 'high').length,
        medium: queue.filter(l => l.urgency === 'medium').length,
        total: queue.length,
    };

    const summaryChip = (label: string, n: number, cls: string) => (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${cls}`}>
            <span className="text-sm font-google font-bold">{n}</span>
            <span className="text-xs font-google font-medium">{label}</span>
        </div>
    );

    return (
        <div className="flex flex-col gap-3 flex-1">
            {/* Slim header row */}
            <div className="flex items-center justify-between gap-3 flex-wrap px-1">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[18px] text-slate-700 dark:text-slate-400">bolt</span>
                    <h2 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Action Center</h2>
                    <span className="hidden sm:inline text-xs font-google text-slate-400 dark:text-slate-500">· your next actions, ranked</span>
                </div>
                {counts.total > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {counts.high > 0 && summaryChip('Act now', counts.high, URGENCY.high.badge)}
                        {counts.medium > 0 && summaryChip('Soon', counts.medium, URGENCY.medium.badge)}
                    </div>
                )}
            </div>

            {queue.length === 0 ? (
                <div className={`${cellCls} p-10 sm:p-14 flex flex-col items-center text-center`}>
                    <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/20">
                        <span className="material-symbols-outlined text-[22px] text-emerald-500">task_alt</span>
                    </div>
                    <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200 mt-4">You&apos;re all caught up</h3>
                    <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                        No open leads need attention right now. New hot leads appear here the moment they come in.
                    </p>
                </div>
            ) : (
                <>
                    <div className={`${cellCls} overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50`}>
                        {queue.map(lead => {
                            const u = URGENCY[lead.urgency] || URGENCY.low;
                            return (
                                <div key={lead.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                    {/* Identity + context — left */}
                                    <div className="min-w-0 w-full sm:w-[32%] sm:shrink-0">
                                        <div className="flex items-baseline gap-2 min-w-0">
                                            <span className="text-sm font-google font-semibold text-slate-900 dark:text-slate-200 truncate max-w-[55%] shrink-0">{lead.name || lead.email}</span>
                                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">{lead.email}</span>
                                        </div>
                                        {lead.context && <p className="text-xs font-google text-slate-400 dark:text-slate-500 truncate mt-0.5">“{lead.context}”</p>}
                                    </div>

                                    {/* Three columns — reason · urgency · band, no partitions */}
                                    <div className="w-full sm:flex-1 grid grid-cols-3 items-center gap-3">
                                        <span className="text-[11px] font-google text-slate-500 dark:text-slate-400 truncate text-center">{lead.reason}</span>
                                        <div className="flex justify-center">
                                            <span className={`text-[10px] font-bold font-google uppercase tracking-widest px-2 py-0.5 rounded-md ${u.badge}`}>{u.label}</span>
                                        </div>
                                        <div className="flex justify-center">
                                            {lead.band && <span className={`text-[10px] font-bold font-google uppercase tracking-widest px-2 py-0.5 rounded-md ${BAND_CHIP[lead.band] || BAND_CHIP.COLD}`}>{lead.band}</span>}
                                        </div>
                                    </div>
                                    {/* Actions — right */}
                                    <div className="shrink-0 flex items-center gap-1.5 self-end sm:self-auto">
                                        <span aria-hidden="true" className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                                            <span className="material-symbols-outlined text-[15px]">mail</span>
                                        </span>
                                        <button onClick={() => act(lead.id, 'won')} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold font-google transition-colors ${acted[lead.id] === 'won' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400'}`}>Won</button>
                                        <button onClick={() => act(lead.id, 'lost')} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold font-google transition-colors ${acted[lead.id] === 'lost' ? 'bg-rose-500 border-rose-500 text-white' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-400'}`}>Lost</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs font-google text-slate-400 dark:text-slate-500 text-center">
                        Won deals add to realized revenue · set the exact deal value in the Leads CRM tab.
                    </p>
                </>
            )}
        </div>
    );
};

// ── Funnel ───────────────────────────────────────────────────────────────────

const STAGE_ACCENT: Record<string, { bar: string; dot: string; text: string }> = {
    conversations: { bar: 'bg-slate-400 dark:bg-slate-500', dot: 'bg-slate-400', text: 'text-slate-600 dark:text-slate-300' },
    leads: { bar: 'bg-indigo-400 dark:bg-indigo-500', dot: 'bg-indigo-400', text: 'text-indigo-600 dark:text-indigo-400' },
    contacted: { bar: 'bg-amber-400 dark:bg-amber-500', dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400' },
    won: { bar: 'bg-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
};
const QUALITY_ACCENT: Record<string, { bar: string; chip: string }> = {
    hot: { bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' },
    warm: { bar: 'bg-amber-400', chip: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
    cold: { bar: 'bg-sky-400', chip: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400' },
};

const DemoFunnelPanel = () => {
    const [windowDays, setWindowDays] = React.useState(30);
    const f = DEMO_FUNNEL;
    const maxLeads = f.sources.items.reduce((m, s) => Math.max(m, s.leads), 0) || 1;

    return (
        <div className="flex flex-col gap-4 flex-1">
            <div className={`${cellCls} p-6 sm:p-8`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[18px] text-slate-700 dark:text-slate-400">filter_alt</span>
                        <div>
                            <h2 className="text-lg font-semibold font-google text-slate-900 dark:text-slate-200">Conversion funnel</h2>
                            <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-0.5">How visitors turn into revenue, stage by stage</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 self-start">
                        {[{ v: 7, l: '7d' }, { v: 30, l: '30d' }, { v: 90, l: '90d' }, { v: 0, l: 'All' }].map(w => (
                            <button key={w.v} onClick={() => setWindowDays(w.v)} className={`px-3 py-1.5 text-xs font-medium font-google rounded-lg transition-all ${windowDays === w.v ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{w.l}</button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stages (60%) + outcome summary (40%) */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className={`${cellCls} p-5 sm:p-8 lg:col-span-3`}>
                <div className="flex flex-col gap-1">
                    {f.stages.map((s, i) => {
                        const accent = STAGE_ACCENT[s.key] || STAGE_ACCENT.conversations;
                        const width = s.count > 0 ? Math.max(s.pct_of_top, 2) : 0;
                        const prev = i > 0 ? f.stages[i - 1] : null;
                        return (
                            <React.Fragment key={s.key}>
                                {prev && (
                                    <div className="flex items-center gap-2 pl-1 py-1 select-none">
                                        <span className="material-symbols-outlined text-[14px] text-slate-300 dark:text-slate-600">south</span>
                                        <span className="text-[11px] font-google text-slate-400 dark:text-slate-500">
                                            {s.pct_of_prev}% continued
                                            {s.dropoff_pct > 0 && <span className="text-rose-500/80 dark:text-rose-400/80"> · {s.dropoff_pct}% drop-off</span>}
                                        </span>
                                    </div>
                                )}
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`w-2 h-2 rounded-full ${accent.dot} shrink-0`} />
                                            <span className="text-sm font-medium font-google text-slate-700 dark:text-slate-300 truncate">{s.label}</span>
                                        </div>
                                        <div className="flex items-baseline gap-2 shrink-0">
                                            <span className="text-base sm:text-lg font-google font-bold text-slate-900 dark:text-slate-200">{fmtNum(s.count)}</span>
                                            <span className={`text-xs font-google font-medium ${accent.text}`}>{s.pct_of_top}%</span>
                                        </div>
                                    </div>
                                    <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-white/[0.04] overflow-hidden">
                                        <div className={`h-full rounded-full ${accent.bar} transition-all duration-700`} style={{ width: `${width}%` }} />
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Outcome summary (40%, stacked beside the funnel) */}
            <div className="lg:col-span-2 flex flex-col sm:flex-row lg:flex-col gap-4">
                <div className={`${cellCls} p-6 sm:p-8 flex flex-col justify-center flex-1`}>
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 font-google mb-2">Overall conversion</span>
                    <span className="text-3xl md:text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{f.overall}%</span>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">of conversations end in a won deal</p>
                </div>
                <div className={`${cellCls} p-6 sm:p-8 flex flex-col justify-center flex-1 border border-emerald-200 dark:border-emerald-900/40`}>
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 font-google uppercase tracking-wide mb-2">Revenue won</span>
                    <span className="text-3xl md:text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{fmtMoney(f.wonValue)}</span>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">closed-won in this window</p>
                </div>
            </div>

            </div>

            {/* Lead quality */}
            <div className={`${cellCls} p-5 sm:p-8`}>
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400">local_fire_department</span>
                    <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Lead quality</h3>
                </div>
                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mb-5">How the {fmtNum(f.quality.total_scored)} scored leads in this window break down by intent.</p>
                <div className="flex flex-col gap-4">
                    {f.quality.bands.map(b => {
                        const accent = QUALITY_ACCENT[b.band] || QUALITY_ACCENT.cold;
                        return (
                            <div key={b.band} className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between gap-3">
                                    <span className={`text-[11px] font-semibold font-google uppercase tracking-wide px-2 py-0.5 rounded-md ${accent.chip}`}>{b.band}</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-sm font-google font-bold text-slate-900 dark:text-slate-200">{fmtNum(b.count)}</span>
                                        <span className="text-xs font-google text-slate-400 dark:text-slate-500">{b.pct}%</span>
                                    </div>
                                </div>
                                <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-white/[0.04] overflow-hidden">
                                    <div className={`h-full rounded-full ${accent.bar} transition-all duration-700`} style={{ width: `${Math.max(b.pct, 2)}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Source attribution */}
            <div className={`${cellCls} p-5 sm:p-8`}>
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400">travel_explore</span>
                    <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Where your leads come from</h3>
                </div>
                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mb-5">Top sources by lead volume — and the revenue each has actually closed.</p>
                <div className="flex flex-col gap-4">
                    {f.sources.items.map(s => (
                        <div key={s.source} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-medium font-google text-slate-700 dark:text-slate-300 truncate">{s.source}</span>
                                <div className="flex items-baseline gap-3 shrink-0">
                                    <span className="text-sm font-google font-bold text-slate-900 dark:text-slate-200">{fmtNum(s.leads)}</span>
                                    <span className="text-xs font-google text-slate-400 dark:text-slate-500">leads</span>
                                    {s.won > 0 && <span className="text-xs font-google font-semibold text-emerald-600 dark:text-emerald-400">{fmtMoney(s.won_value)} won</span>}
                                </div>
                            </div>
                            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-white/[0.04] overflow-hidden">
                                <div className="h-full rounded-full bg-slate-400 dark:bg-slate-500 transition-all duration-700" style={{ width: `${Math.max((s.leads / maxLeads) * 100, 3)}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ── Fixes Needed ─────────────────────────────────────────────────────────────

const DemoFixesNeededPanel = () => {
    const fixes = DEMO_FIXES;
    const unansweredCount = fixes.filter(f => f.category === 'unanswered').length;
    const lowConfCount = fixes.filter(f => f.category === 'low_confidence').length;
    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex flex-col gap-px bg-white dark:bg-slate-800 flex-1 overflow-hidden rounded-2xl">
            <div className={`${cellCls} p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800`}>
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-amber-500 dark:text-amber-400">build</span>
                    <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">{fixes.length} Fixes Needed</h2>
                </div>
                <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest font-bold font-google">
                    <span className="flex items-center gap-1.5 text-amber-500"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{unansweredCount} Unanswered</span>
                    <span className="flex items-center gap-1.5 text-orange-500"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" />{lowConfCount} Low confidence</span>
                </div>
            </div>
            <div className={`${cellCls} flex-1 divide-y divide-gray-100 dark:divide-slate-800/50`}>
                {fixes.map((fix, idx) => {
                    const isUnanswered = fix.category === 'unanswered';
                    return (
                        <div key={idx} className="px-3 py-3 sm:px-6 sm:py-4 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                            <span className={`w-2 h-2 rounded-full block mt-2 shrink-0 ${isUnanswered ? 'bg-amber-400' : 'bg-orange-400'}`} />
                            <div className="flex-1 min-w-0">
                                <p className="text-md font-google text-slate-700 dark:text-slate-300 font-medium break-words">{fix.query}</p>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5">
                                    <span className={`text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-sm ${isUnanswered ? 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20' : 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20'}`}>
                                        {isUnanswered ? 'Unanswered' : 'Low confidence'}
                                    </span>
                                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google">Asked {fix.ask_count}×</span>
                                    {!isUnanswered && fix.confidence !== null && (
                                        <span className="text-[10px] uppercase tracking-widest font-bold text-orange-500 font-google">{Math.round(fix.confidence * 100)}% grounded</span>
                                    )}
                                    <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">{formatTime(fix.last_asked)}</span>
                                </div>
                            </div>
                            <Link href={`/demo/train?query=${encodeURIComponent(fix.query)}`} className="shrink-0 inline-flex items-center gap-1 mt-0.5 px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold font-google rounded-sm bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-700 dark:hover:bg-blue-500 transition-colors">
                                <span className="material-symbols-outlined text-[12px]">build</span> Train
                            </Link>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ── Leads CRM (with scoring + pipeline) ──────────────────────────────────────

const DemoLeadsPanel = () => {
    const leads = DEMO_LEADS;
    return (
        <div className="flex flex-col gap-px bg-white dark:bg-slate-800 flex-1 overflow-hidden rounded-2xl">
            <div className={`${cellCls} p-4 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800`}>
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-blue-500 dark:text-blue-400">group</span>
                    <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Total Leads: {leads.length}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {(['All', 'HOT', 'WARM', 'COLD'] as const).map(b => (
                        <span key={b} className={`px-3 py-1.5 text-[11px] uppercase tracking-widest font-bold font-google rounded-sm ${b === 'All' ? 'bg-slate-900 dark:bg-blue-600 text-white' : 'border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}>{b}</span>
                    ))}
                    <span className="px-4 py-2 border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold font-google uppercase tracking-widest flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">download</span> Export CSV
                    </span>
                </div>
            </div>

            <div className={`${cellCls} flex-1 overflow-x-auto custom-scrollbar`}>
                <table className="w-full text-left border-collapse min-w-[820px]">
                    <thead className="bg-gray-50 dark:bg-slate-900/90 border-b border-gray-100 dark:border-slate-800">
                        <tr>
                            {['Contact Info', 'Score', 'Status / Value', 'Context / Query', 'Captured At'].map(h => (
                                <th key={h} className="px-6 py-4 text-[11px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google border-r border-gray-100 dark:border-slate-800/50">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                        {leads.map(lead => (
                            <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-slate-900/30 transition-colors align-top">
                                <td className="px-6 py-4 border-r border-gray-100 dark:border-slate-800/50">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-bold font-google text-slate-900 dark:text-slate-100 text-md break-all">{lead.email}</span>
                                        <span className="text-md text-slate-500 dark:text-slate-400 font-mono tracking-wide">{lead.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 border-r border-gray-100 dark:border-slate-800/50"><ScoreBadge score={lead.score} band={lead.band} /></td>
                                <td className="px-6 py-4 border-r border-gray-100 dark:border-slate-800/50">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-sm border text-[10px] uppercase tracking-widest font-bold font-google ${STATUS_STYLES[lead.status]}`}>{lead.status}</span>
                                    {lead.status === 'won' && lead.value_usd != null && (
                                        <div className="mt-1.5 text-xs font-mono text-emerald-600 dark:text-emerald-400">{fmtMoney(lead.value_usd)}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 border-r border-gray-100 dark:border-slate-800/50">
                                    <p className="text-md font-google text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2 rounded-sm border border-slate-100 dark:border-slate-800 leading-relaxed max-w-xs">{lead.context}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                        {new Date(lead.created_at).toLocaleDateString()}<br />
                                        {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ── Activity Calendar (Analytics) ────────────────────────────────────────────

const ActivityCalendar = ({ data }: { data: any[] }) => {
    const [selectedCell, setSelectedCell] = React.useState<any>(null);
    const calendarDates = React.useMemo(() => {
        const days: string[] = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
        }
        return days;
    }, []);

    const dataMap: Record<string, any> = {};
    let maxCount = 0;
    data?.forEach(d => { if (d.date) { dataMap[d.date] = d; if (d.total_questions > maxCount) maxCount = d.total_questions; } });

    React.useEffect(() => {
        if (data && data.length > 0 && !selectedCell) {
            const todayStr = new Date().toISOString().split('T')[0];
            setSelectedCell(dataMap[todayStr] || data[data.length - 1]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    const formatDateStr = (s: string) => s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

    return (
        <div className="flex flex-col lg:flex-row gap-8 w-full p-1">
            <div className="w-full lg:w-1/2 flex flex-col gap-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium font-google text-slate-500">Activity overview</span>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400"><div className="w-2 h-2 rounded-full border border-slate-200" /> Idle</div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400"><div className="w-2 h-2 rounded-full bg-blue-500/50" /> Active</div>
                    </div>
                </div>
                <div className="grid grid-cols-7 gap-1.5 md:gap-3 w-full overflow-hidden p-2.5">
                    {calendarDates.map(dateStr => {
                        const cellData = dataMap[dateStr];
                        const count = cellData?.total_questions || 0;
                        const opacity = maxCount > 0 ? (count / maxCount) : 0;
                        const isSelected = selectedCell?.date === dateStr;
                        return (
                            <div
                                key={dateStr}
                                onClick={() => setSelectedCell(cellData || { date: dateStr, count: 0 })}
                                onMouseEnter={() => setSelectedCell(cellData || { date: dateStr, count: 0 })}
                                className={`aspect-[3/4] sm:aspect-square w-full min-w-[24px] rounded-xl cursor-pointer transition-all duration-200 border relative flex flex-col items-center justify-center gap-0.5 ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 z-10 scale-105' : 'hover:scale-105 z-0'}`}
                                style={{ backgroundColor: count > 0 ? `rgba(59, 130, 246, ${Math.max(0.15, opacity)})` : 'transparent', borderColor: count === 0 ? 'rgba(148, 163, 184, 0.15)' : 'rgba(59, 130, 246, 0.4)' }}
                            >
                                <span className={`text-[12px] sm:text-[14px] leading-none font-mono font-semibold ${count > 0 ? 'text-blue-700 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'}`}>{new Date(dateStr).getDate()}</span>
                                <span className={`text-[8px] sm:text-[9px] font-google font-medium leading-none ${count > 0 ? 'text-blue-600/70 dark:text-blue-300/70' : 'text-slate-300 dark:text-slate-600'}`}>{new Date(dateStr).toLocaleDateString(undefined, { month: 'short' })}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="w-full lg:w-1/2 flex flex-col">
                {selectedCell && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} key={selectedCell.date} className="flex flex-col bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl flex-1">
                        <div className="flex flex-col gap-1 mb-6 pb-4">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 font-google">Daily inspector</span>
                            <span className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-google">{formatDateStr(selectedCell.date)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="flex flex-col p-4 bg-white dark:bg-slate-900 rounded-xl"><span className="text-xs text-slate-400 font-google mb-1">Total activity</span><span className="text-2xl font-semibold font-google text-slate-900 dark:text-slate-100">{selectedCell.total_questions || 0}</span></div>
                            <div className="flex flex-col p-4 bg-white dark:bg-slate-900 rounded-xl"><span className="text-xs text-slate-400 font-google mb-1">Unique users</span><span className="text-2xl font-semibold font-google text-slate-900 dark:text-slate-200">{selectedCell.interacted_users || 0}</span></div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg"><span className="text-sm font-google text-slate-500 dark:text-slate-400">Answered correctly</span><span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{selectedCell.answered_questions || 0}</span></div>
                            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg"><span className="text-sm font-google text-slate-500 dark:text-slate-400">Failed response</span><span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{selectedCell.unanswered_questions || 0}</span></div>
                        </div>
                        <div className="mt-6 flex-1 flex flex-col gap-5">
                            <div className="flex flex-col">
                                <span className="text-xs font-medium text-slate-400 font-google mb-3 flex items-center gap-2"><span className="w-1 h-3 bg-blue-500 rounded-full" />Top questions</span>
                                {selectedCell.top_questions?.length > 0 ? (
                                    <div className="space-y-2">{selectedCell.top_questions.map((q: string, i: number) => <p key={i} className="text-sm font-google text-slate-600 dark:text-slate-400 italic bg-white dark:bg-slate-900 p-3 rounded-xl">&quot;{q}&quot;</p>)}</div>
                                ) : <span className="text-sm font-google text-slate-400 italic">No activity recorded</span>}
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

// ── Conversations ────────────────────────────────────────────────────────────

const DemoConversationsPanel = () => {
    const [filter, setFilter] = React.useState('all');
    const [expandedSession, setExpandedSession] = React.useState<string | null>(null);

    const sessions = [
        {
            session_id: 's1', last_active: hoursAgo(1), message_count: 4, has_unanswered: false,
            messages: [
                { user_query: 'What are the pricing plans?', bot_response: 'We offer Starter, Pro, and Business plans starting at $29/month — you can upgrade or downgrade anytime.', is_unanswered: false, timestamp: hoursAgo(1) },
                { user_query: 'Can I upgrade anytime?', bot_response: 'Yes — change your plan at any time from account settings, and changes are prorated automatically.', is_unanswered: false, timestamp: hoursAgo(1) },
            ],
        },
        {
            session_id: 's2', last_active: hoursAgo(24), message_count: 2, has_unanswered: true,
            messages: [
                { user_query: 'Do you offer a free trial?', bot_response: "I'm sorry, I don't have information about free trials at the moment.", is_unanswered: true, timestamp: hoursAgo(24) },
                { user_query: 'What is your refund policy?', bot_response: "I'm sorry, I don't have details on the refund policy.", is_unanswered: true, timestamp: hoursAgo(24) },
            ],
        },
        {
            session_id: 's3', last_active: hoursAgo(48), message_count: 2, has_unanswered: false,
            messages: [
                { user_query: 'How do I integrate the widget on my website?', bot_response: 'Add a single script tag to your HTML — we provide step-by-step docs for Shopify, WordPress, Webflow and more.', is_unanswered: false, timestamp: hoursAgo(48) },
            ],
        },
    ];

    const filtered = filter === 'unanswered' ? sessions.filter(s => s.has_unanswered) : sessions;
    const total = filtered.length;
    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex flex-col gap-px bg-white dark:bg-slate-800 flex-1 overflow-hidden rounded-2xl">
            {/* Header */}
            <div className={`${cellCls} p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800`}>
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-blue-500 dark:text-blue-400">forum</span>
                    <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">{total} Conversation{total !== 1 ? 's' : ''}</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-[11px] uppercase tracking-widest font-bold font-google rounded-sm transition-colors ${filter === 'all' ? 'bg-slate-900 dark:bg-blue-600 text-white' : 'border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-900'}`}>All</button>
                    <button onClick={() => setFilter('unanswered')} className={`px-3 py-1.5 text-[11px] uppercase tracking-widest font-bold font-google rounded-sm flex items-center gap-1.5 transition-colors ${filter === 'unanswered' ? 'bg-amber-500 text-white' : 'border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-900'}`}><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Unanswered</button>
                </div>
            </div>

            {/* Session list */}
            <div className={`${cellCls} flex-1 divide-y divide-gray-100 dark:divide-slate-800/50`}>
                {filtered.map(session => {
                    const isExpanded = expandedSession === session.session_id;
                    const preview = session.messages[0]?.user_query || '';
                    return (
                        <div key={session.session_id} className="flex flex-col">
                            <button onClick={() => setExpandedSession(isExpanded ? null : session.session_id)} className="w-full text-left px-3 py-3 sm:px-6 sm:py-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors flex items-start gap-4">
                                <div className="mt-1 shrink-0">
                                    <span className={`w-2 h-2 rounded-full block mt-1 ${session.has_unanswered ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-md font-google text-slate-700 dark:text-slate-300 truncate font-medium">{preview || 'No messages'}</p>
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                                        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">{formatTime(session.last_active)}</span>
                                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google">{session.message_count} msg{session.message_count !== 1 ? 's' : ''}</span>
                                        {session.has_unanswered && <span className="text-[10px] uppercase tracking-widest font-bold text-amber-500 font-google">Has gaps</span>}
                                    </div>
                                </div>
                                <span className={`material-symbols-outlined text-[18px] text-slate-400 shrink-0 transition-transform mt-0.5 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                            </button>

                            {isExpanded && (
                                <div className="px-3 pb-4 sm:px-6 sm:pb-6 bg-slate-50 dark:bg-slate-900/40 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-4 pt-4">
                                    {session.messages.map((msg, idx) => (
                                        <div key={idx} className="flex flex-col gap-2">
                                            <div className="flex items-start gap-3">
                                                <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5"><span className="material-symbols-outlined text-[12px] text-slate-500 dark:text-slate-400">person</span></div>
                                                <div className="flex-1">
                                                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google">User</span>
                                                    <p className="text-sm font-google text-slate-700 dark:text-slate-300 leading-relaxed mt-0.5">{msg.user_query}</p>
                                                </div>
                                                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 shrink-0 mt-0.5">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className={`flex items-start gap-3 ml-4 pl-4 border-l-2 ${msg.is_unanswered ? 'border-amber-300 dark:border-amber-700' : 'border-blue-200 dark:border-blue-900'}`}>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google">Bot</span>
                                                        {msg.is_unanswered && <span className="text-[9px] uppercase tracking-widest font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-sm">Unanswered</span>}
                                                    </div>
                                                    <p className="text-sm font-google text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">{msg.bot_response}</p>
                                                    {msg.is_unanswered && (
                                                        <Link href={`/demo/train?query=${encodeURIComponent(msg.user_query)}`} className="inline-flex items-center gap-1 mt-2 text-[10px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"><span className="material-symbols-outlined text-[12px]">build</span>Train this gap</Link>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ── ROI Calculator ───────────────────────────────────────────────────────────

const DemoROIPanel = ({ botName }: { botName: string }) => {
    const [costPerTicket, setCostPerTicket] = React.useState('5');
    const [leadValue, setLeadValue] = React.useState('50');
    const [saved, setSaved] = React.useState(false);

    // Reconciles with the rest of the demo business.
    const stats = { total_queries_30d: 420, answered_queries_30d: 344, leads_30d: 64 };
    const realizedRevenue = 8400;
    const wonDeals = 11;

    const previewCost = parseFloat(costPerTicket) || 0;
    const previewLead = parseFloat(leadValue) || 0;
    const previewSavings = stats.answered_queries_30d * previewCost;
    const previewRevenue = stats.leads_30d * previewLead;
    const previewTotal = previewSavings + previewRevenue;
    const answerRate = stats.total_queries_30d > 0 ? Math.round((stats.answered_queries_30d / stats.total_queries_30d) * 100) : 0;
    const fmt2 = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="flex flex-col gap-4 flex-1">
            {/* Header */}
            <div className={`${cellCls} p-6 sm:p-8`}>
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-slate-700 dark:text-slate-400">savings</span>
                    <div>
                        <h2 className="text-lg font-semibold font-google text-slate-900 dark:text-slate-200">Live ROI dashboard</h2>
                        <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-0.5">Real-time value your bot generates — last 30 days</p>
                    </div>
                </div>
            </div>

            {/* Scorecards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`${cellCls} p-8 flex flex-col justify-center`}>
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 font-google mb-2">Support cost saved</span>
                    <span className="text-2xl sm:text-3xl md:text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{fmt2(previewSavings)}</span>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">{stats.answered_queries_30d.toLocaleString()} queries × ${previewCost.toFixed(2)}/ticket</p>
                </div>
                <div className={`${cellCls} p-8 flex flex-col justify-center`}>
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 font-google mb-2">Potential revenue</span>
                    <span className="text-2xl sm:text-3xl md:text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{fmt2(previewRevenue)}</span>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">{stats.leads_30d.toLocaleString()} leads × ${previewLead.toFixed(2)}/lead</p>
                </div>
                <div className={`${cellCls} p-8 flex flex-col justify-center`}>
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 font-google mb-2">Total ROI</span>
                    <span className="text-2xl sm:text-3xl md:text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{fmt2(previewTotal)}</span>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Answer rate: {answerRate}%</p>
                </div>
            </div>

            {/* Proven (realized) revenue */}
            <div className={`${cellCls} p-6 sm:p-8 border border-emerald-200 dark:border-emerald-900/40`}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20 shrink-0"><span className="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400">paid</span></div>
                        <div>
                            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 font-google uppercase tracking-wide">Proven revenue · closed-won</span>
                            <p className="text-2xl sm:text-3xl md:text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200 mt-0.5">{fmt2(realizedRevenue)}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-xl sm:text-2xl font-google font-bold text-slate-900 dark:text-slate-200">{wonDeals.toLocaleString()}</span>
                        <p className="text-xs font-medium text-slate-400 font-google mt-0.5">deals won (all-time)</p>
                    </div>
                </div>
                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">Actual revenue from leads you marked <span className="font-semibold text-emerald-700 dark:text-emerald-400">Won</span>. Update lead outcomes in the Leads tab to grow this number.</p>
            </div>

            {/* Activity stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { icon: 'forum', val: stats.total_queries_30d, label: 'Total queries' },
                    { icon: 'check_circle', val: stats.answered_queries_30d, label: 'Answered' },
                    { icon: 'group', val: stats.leads_30d, label: 'Leads captured' },
                ].map(s => (
                    <div key={s.label} className={`${cellCls} p-6 flex items-center gap-4`}>
                        <div className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-white/[0.04] shrink-0"><span className="material-symbols-outlined text-[18px] text-slate-700 dark:text-slate-400">{s.icon}</span></div>
                        <div>
                            <span className="text-lg sm:text-xl md:text-2xl font-google font-bold text-slate-900 dark:text-slate-200">{s.val.toLocaleString()}</span>
                            <p className="text-xs font-medium text-slate-400 font-google mt-0.5">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Benchmark editor */}
            <div className={`${cellCls} p-4 sm:p-8`}>
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400">tune</span>
                    <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Calibrate your benchmarks</h3>
                </div>
                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mb-6">Set values that match your business. Numbers update live above as you type.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 font-google mb-2">Cost per support ticket ($)</label>
                        <input type="number" min="0" step="0.5" value={costPerTicket} onChange={e => { setCostPerTicket(e.target.value); setSaved(false); }} className="w-full px-4 py-3 bg-slate-100 dark:bg-white/[0.04] focus:bg-slate-200 dark:focus:bg-white/[0.08] focus:outline-none text-base font-mono text-slate-900 dark:text-slate-200 rounded-xl transition-colors" placeholder="5.00" />
                        <p className="text-xs font-google text-slate-400 dark:text-slate-500 mt-1.5">Industry avg: $5–$25 per ticket</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 font-google mb-2">Average lead value ($)</label>
                        <input type="number" min="0" step="5" value={leadValue} onChange={e => { setLeadValue(e.target.value); setSaved(false); }} className="w-full px-4 py-3 bg-slate-100 dark:bg-white/[0.04] focus:bg-slate-200 dark:focus:bg-white/[0.08] focus:outline-none text-base font-mono text-slate-900 dark:text-slate-200 rounded-xl transition-colors" placeholder="50.00" />
                        <p className="text-xs font-google text-slate-400 dark:text-slate-500 mt-1.5">What is one captured lead worth to you?</p>
                    </div>
                </div>
                <button onClick={() => setSaved(true)} className="w-full sm:w-auto px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-black text-sm font-semibold font-google rounded-xl hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]">
                    {saved ? (<><span className="material-symbols-outlined text-[14px]">check</span> Saved</>) : (<>Save Benchmarks</>)}
                </button>
                <p className="text-xs font-google text-slate-400 dark:text-slate-500 text-center mt-4">Demo data for {botName} — connect your bot to see real metrics</p>
            </div>
        </div>
    );
};

// ── Analytics tab ────────────────────────────────────────────────────────────

const DemoAnalyticsPanel = ({ report }: { report: ReturnType<typeof buildDemoReport> }) => (
    <div className="flex flex-col gap-6 flex-1 w-full">
        {/* Scorecards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
            <div className={`${cellCls} p-4 sm:p-8 flex flex-col justify-center`}>
                <div className="flex items-center gap-2 mb-3"><span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 pt-0.5">timer</span><h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 font-google">Support hours saved</h3></div>
                <div className="flex items-end gap-1"><span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">12</span><span className="text-sm uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-2 ml-1">hours</span></div>
                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Based on estimated handled query resolution time.</p>
            </div>
            <div className={`${cellCls} p-4 sm:p-8 flex flex-col justify-center`}>
                <div className="flex items-center gap-2 mb-3"><span className="material-symbols-outlined text-[18px] text-green-600 dark:text-green-500 pt-0.5">savings</span><h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 font-google">Estimated savings</h3></div>
                <div className="flex items-end gap-1"><span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{report.roi_metrics.support_savings}</span></div>
                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Cost avoided against standard human agent hourly rates.</p>
            </div>
            <div className={`${cellCls} p-4 sm:p-8 flex flex-col justify-center`}>
                <div className="flex items-center gap-2 mb-3"><span className="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-500 pt-0.5">leaderboard</span><h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 font-google">Potential revenue</h3></div>
                <div className="flex items-end gap-1"><span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{report.roi_metrics.potential_revenue}</span><span className="text-sm uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-2 ml-1">est. value</span></div>
                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Calculated from the leads captured by the AI.</p>
            </div>
        </div>

        {/* Trends + Gaps */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
            <div className="lg:col-span-7 flex flex-col gap-4">
                <div className={`${cellCls} p-4 sm:p-8 flex-1`}>
                    <div className="flex items-center gap-2 mb-6"><span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">trending_up</span><h2 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Top customer trends</h2></div>
                    <p className="text-sm font-google text-slate-500 dark:text-slate-400 mb-6">The most common subjects and questions your users are asking.</p>
                    <div className="space-y-2">
                        {report.top_trends.map((trend, idx) => (
                            <div key={idx} className={`${cellCls} flex items-start gap-4 p-5`}>
                                <div className="w-8 h-8 shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold font-mono text-slate-500 dark:text-slate-400">{String(idx + 1).padStart(2, '0')}</div>
                                <p className="text-sm font-google text-slate-700 dark:text-slate-300 pt-1.5">{trend}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="lg:col-span-5 flex flex-col gap-4">
                <div className={`${cellCls} p-4 sm:p-8 flex-1`}>
                    <div className="flex items-center gap-2 mb-4"><span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">warning</span><h2 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">High value gaps</h2></div>
                    <p className="text-sm font-google text-slate-500 dark:text-slate-400 mb-5">Questions your bot failed to answer. Train these topics to secure leads.</p>
                    <div className="space-y-2 mb-4">
                        {report.high_value_gaps.map((gap, idx) => (
                            <div key={idx} className="flex items-start gap-3 p-4 bg-slate-100 dark:bg-slate-800">
                                <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">help_center</span>
                                <p className="text-sm font-google text-slate-700 dark:text-slate-300 flex-1">&quot;{gap}&quot;</p>
                                <Link href={`/demo/train?query=${encodeURIComponent(gap)}`} className="shrink-0 text-[10px] uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center transition-colors">Fix <span className="material-symbols-outlined text-[12px] ml-1">build</span></Link>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 mb-4"><span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">lightbulb</span><h2 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Actionable advice</h2></div>
                    <p className="text-sm font-google text-slate-600 dark:text-slate-400 leading-relaxed">{report.actionable_advice}</p>
                </div>
            </div>
        </div>

        {/* Peak activity */}
        <div className={`${cellCls} p-4 sm:p-8`}>
            <div className="flex items-center gap-2 mb-4"><span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">calendar_month</span><h2 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">30-day peak activity</h2></div>
            <ActivityCalendar data={report.peak_activity_blocks} />
        </div>

        {/* Recent log */}
        <div className={`${cellCls} p-4 sm:p-8`}>
            <div className="flex items-center gap-2 mb-6"><span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 pt-0.5">history</span><h2 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Recent activity log</h2></div>
            <div className="hidden md:grid grid-cols-12 gap-4 pb-3 mb-3 px-4">
                <div className="col-span-8 text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google">User Query</div>
                <div className="col-span-2 text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google text-center">Status</div>
                <div className="col-span-2 text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google text-right">Time</div>
            </div>
            <div className="space-y-3 md:space-y-1">
                {report.recent_conversations.map((log, idx) => (
                    <div key={idx} className="flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 py-4 md:py-3 px-3 sm:px-4 bg-[#f1f3f5]/50 md:bg-transparent dark:bg-slate-900/20 md:dark:bg-transparent rounded-xl md:items-center">
                        <div className="col-span-8 text-sm font-google font-medium text-slate-700 dark:text-slate-300">{log.query}</div>
                        <div className="col-span-2 flex items-center md:justify-center">
                            {log.unanswered ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-slate-400/60" /> Unanswered</span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-slate-800 dark:bg-slate-200 animate-pulse" /> Handled</span>
                            )}
                        </div>
                        <div className="col-span-2 flex items-center md:justify-end"><span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// ── Main page ────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'action', label: 'Action Center' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'leads', label: 'Leads CRM' },
    { id: 'funnel', label: 'Funnel' },
    { id: 'conversations', label: 'Conversations' },
    { id: 'fixes', label: 'Fixes Needed' },
    { id: 'roi', label: 'ROI' },
];

export default function DemoInsightsPage() {
    const [botConfig, setBotConfig] = React.useState<any>(getBotConfig());
    const [mounted, setMounted] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('action');

    React.useEffect(() => {
        setBotConfig(getBotConfig());
        setMounted(true);
    }, []);

    const report = buildDemoReport(botConfig.name);

    if (!mounted) return null;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full w-full min-w-0 bg-[#f8f9fa] dark:bg-slate-950 overflow-hidden transition-colors duration-500">
            {/* Header — tabs sit near the top; demo context lives in the top bar */}
            <div className="px-6 py-3 sm:px-8 sm:py-4 shrink-0 min-w-0 w-full">
                <div className="overflow-x-auto scrollbar-hide">
                    <div className="flex items-center gap-1 min-w-max sm:min-w-0 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                        {TABS.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium font-google rounded-lg whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{tab.label}</button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 w-full min-w-0 overflow-y-auto custom-scrollbar flex flex-col px-6 pb-8 md:px-8 gap-4 pt-1">
                {activeTab === 'action' && <DemoActionCenterPanel />}
                {activeTab === 'analytics' && <DemoAnalyticsPanel report={report} />}
                {activeTab === 'leads' && <DemoLeadsPanel />}
                {activeTab === 'funnel' && <DemoFunnelPanel />}
                {activeTab === 'conversations' && <DemoConversationsPanel />}
                {activeTab === 'fixes' && <DemoFixesNeededPanel />}
                {activeTab === 'roi' && <DemoROIPanel botName={botConfig.name} />}
            </div>
        </motion.div>
    );
}

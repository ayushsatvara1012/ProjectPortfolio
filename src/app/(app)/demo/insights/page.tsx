'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { getBotConfig } from '@/src/lib/demo/demoStorage';
import {
    card,
    cx,
    Badge,
    Card,
    EmptyState,
    fmtNum,
    fmtMoney,
    MetricCard,
    SectionHeader,
    SkeletonBlock,
    TrendChart,
    TrendPill,
    Segmented,
    FunnelChart,
    DonutChart,
    HorizontalBars,
    badgeToneFor,
} from '@/src/components/dashboard/insights/ui';

// ─────────────────────────────────────────────────────────────────────────────
// Time and formatting helpers
// ─────────────────────────────────────────────────────────────────────────────
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const fmtDay = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// ─────────────────────────────────────────────────────────────────────────────
// Initial Mock Data
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_DEMO_LEADS = [
    { id: '1', email: 'amelia@northstar.io', name: 'Amelia Wong', score: 92, band: 'HOT', status: 'new', value_usd: null, context: 'Ready to buy — asked for a demo this week and pricing for 12 seats.', created_at: hoursAgo(2) },
    { id: '2', email: 'sarah@brightwell.co', name: 'Sarah Johnson', score: 88, band: 'HOT', status: 'new', value_usd: null, context: 'Asked about enterprise pricing and onboarding timeline.', created_at: hoursAgo(5) },
    { id: '3', email: 'marcus@techcorp.io', name: 'Marcus Chen', score: 76, band: 'WARM', status: 'contacted', value_usd: null, context: 'Wanted to confirm it integrates with Shopify before committing.', created_at: hoursAgo(26) },
    { id: '4', email: 'priya@launchpad.co', name: 'Priya Patel', score: 71, band: 'WARM', status: 'won', value_usd: 1200, context: 'Compared Pro vs Business and upgraded the same day.', created_at: hoursAgo(50) },
    { id: '5', email: 'diego@menloretail.com', name: 'Diego Alvarez', score: 44, band: 'COLD', status: 'new', value_usd: null, context: 'General question about the return policy.', created_at: hoursAgo(8) },
    { id: '6', email: 'tom@harborgoods.com', name: 'Tom Becker', score: 38, band: 'COLD', status: 'lost', value_usd: null, context: 'Asked about free-trial length, never replied to follow-up.', created_at: hoursAgo(72) },
];

const INITIAL_DEMO_FIXES = [
    { query: 'Do you offer a free trial?', ask_count: 9, last_asked: hoursAgo(3), confidence: null, category: 'unanswered' as const },
    { query: 'What is your refund policy?', ask_count: 6, last_asked: hoursAgo(20), confidence: null, category: 'unanswered' as const },
    { query: 'Can I export my leads to CSV?', ask_count: 4, last_asked: hoursAgo(28), confidence: 0.42, category: 'low_confidence' as const },
    { query: 'Do you support multiple languages?', ask_count: 3, last_asked: hoursAgo(40), confidence: 0.55, category: 'low_confidence' as const },
    { query: 'Is there a discount for nonprofits?', ask_count: 2, last_asked: hoursAgo(60), confidence: null, category: 'unanswered' as const },
];

const INITIAL_DEMO_SESSIONS = [
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

const DEMO_FUNNEL_RAW = {
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

const STAGE_DESCRIPTIONS: Record<string, string> = {
    conversations: 'Visitors who chatted with the assistant.',
    leads: 'Provided their email or contact details.',
    contacted: 'Followed up by email or suggestion.',
    won: 'Closed and converted to a deal.',
};

const QUALITY_COLORS: Record<string, string> = { hot: '#f43f5e', warm: '#f59e0b', cold: '#0ea5e9' };
const QUALITY_DESCRIPTIONS: Record<string, string> = {
    hot: 'High intent — follow up now.',
    warm: 'Engaged — asked about features or pricing.',
    cold: 'Browsing or low-intent signals.',
};

const SOURCE_ICONS: Record<string, string> = {
    'chat widget': 'forum',
    'pricing page': 'sell',
    docs: 'menu_book',
    direct: 'arrow_outward',
};

// ─────────────────────────────────────────────────────────────────────────────
// Activity insights helpers (from dashboard/insights/page.tsx)
// ─────────────────────────────────────────────────────────────────────────────
interface DayDatum {
    date: string;
    total: number;
    answered: number;
    unanswered: number;
    users: number;
    raw: any;
}

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

function buildDailySeries(blocks: any[], days = 30): DayDatum[] {
    const map: Record<string, any> = {};
    (blocks || []).forEach((b) => { if (b?.date) map[b.date] = b; });
    const out: DayDatum[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const b = map[key] || {};
        out.push({
            date: key,
            total: b.total_questions || 0,
            answered: b.answered_questions || 0,
            unanswered: b.unanswered_questions || 0,
            users: b.interacted_users || 0,
            raw: b,
        });
    }
    return out;
}

function pctDelta(values: number[]): number {
    const half = Math.floor(values.length / 2);
    const prior = values.slice(0, half).reduce((a, b) => a + b, 0);
    const recent = values.slice(half).reduce((a, b) => a + b, 0);
    if (prior === 0) return recent > 0 ? 100 : 0;
    return ((recent - prior) / prior) * 100;
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

const HEAT_STEPS = [
    'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500',
    'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    'bg-slate-400 dark:bg-slate-600 text-slate-800 dark:text-slate-200',
    'bg-slate-600 dark:bg-slate-400 text-white dark:text-slate-950',
    'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900',
];

// ─────────────────────────────────────────────────────────────────────────────
// Local Sub-components matching Dashboard Look & Feel
// ─────────────────────────────────────────────────────────────────────────────

// ── Activity Heatmap ──
function ActivityHeatmap({ series, selected, onSelect }: { series: DayDatum[]; selected: string | null; onSelect: (d: DayDatum) => void }) {
    const max = series.reduce((m, d) => Math.max(m, d.total), 0) || 1;
    const stepFor = (n: number) => {
        if (n === 0) return 0;
        const r = n / max;
        if (r <= 0.25) return 1;
        if (r <= 0.5) return 2;
        if (r <= 0.75) return 3;
        return 4;
    };
    let prevMonth = '';
    return (
        <div className="flex flex-col items-center gap-3 w-full">
            <div className="flex flex-wrap gap-x-1.5 gap-y-2 justify-center w-full">
                {series.map((d) => {
                    const isSel = selected === d.date;
                    const dateObj = new Date(d.date + 'T00:00:00');
                    const dayNum = dateObj.getDate();
                    const month = dateObj.toLocaleDateString(undefined, { month: 'short' });
                    const showMonth = month !== prevMonth;
                    prevMonth = month;
                    return (
                        <div key={d.date} className="flex flex-col items-center gap-1">
                            <span className="h-3 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap leading-none select-none">
                                {showMonth ? month : '\u00A0'}
                            </span>
                            <button
                                key={d.date}
                                type="button"
                                onClick={() => onSelect(d)}
                                onMouseEnter={() => onSelect(d)}
                                aria-label={`${fmtDay(d.date)}: ${d.total} queries`}
                                title={`${fmtDay(d.date)} · ${d.total} queries`}
                                className={cx(
                                    'h-8 w-8 sm:h-9 sm:w-9 rounded-md relative flex items-center justify-center text-[11px] sm:text-[12px] font-extrabold transition-all duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 focus-visible:ring-slate-400',
                                    HEAT_STEPS[stepFor(d.total)],
                                    isSel
                                        ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-900 ring-slate-900 dark:ring-white z-10 scale-105'
                                        : 'hover:scale-105 hover:z-10 hover:ring-1 hover:ring-slate-400/70 dark:hover:ring-slate-500/70',
                                )}
                            >
                                {dayNum}
                            </button>
                        </div>
                    );
                })}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                <span>Less</span>
                {HEAT_STEPS.map((c, i) => (
                    <span
                        key={i}
                        className={cx(
                            'h-3.5 w-3.5 rounded-[3px]',
                            c.split(' ')[0] + ' ' + (c.includes('dark:') ? c.split(' ').find(x => x.startsWith('dark:bg-')) : '')
                        )}
                    />
                ))}
                <span>More</span>
            </div>
        </div>
    );
}

// ── Activity Insights ──
function ActivityInsights({ blocks }: { blocks: any[] }) {
    const series = useMemo(() => buildDailySeries(blocks, 30), [blocks]);
    const [selected, setSelected] = useState<DayDatum | null>(null);

    useEffect(() => {
        if (series.length) {
            const withData = [...series].reverse().find((d) => d.total > 0);
            setSelected(withData || series[series.length - 1]);
        }
    }, [series]);

    const totals = series.map((d) => d.total);
    const unans = series.map((d) => d.unanswered);
    const users = series.map((d) => d.users);
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

    const totalQ = sum(totals);
    const totalUn = sum(unans);
    const totalUsers = sum(users);
    const answeredRate = totalQ > 0 ? Math.round(((totalQ - totalUn) / totalQ) * 100) : 0;

    const half = Math.floor(series.length / 2);
    const priorQ = sum(totals.slice(0, half));
    const priorUn = sum(unans.slice(0, half));
    const recentQ = sum(totals.slice(half));
    const recentUn = sum(unans.slice(half));
    const priorRate = priorQ > 0 ? ((priorQ - priorUn) / priorQ) * 100 : 0;
    const recentRate = recentQ > 0 ? ((recentQ - recentUn) / recentQ) * 100 : 0;
    const rateDelta = Math.round((recentRate - priorRate) * 10) / 10;

    const trendPoints = series.map((d) => ({
        label: fmtDay(d.date),
        values: { total: d.total, unanswered: d.unanswered },
    }));

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard label="Questions" value={fmtNum(totalQ)} hint="last 30 days" delta={pctDelta(totals)} spark={totals} tone="accent" />
                <MetricCard label="Answer rate" value={`${answeredRate}%`} hint="answered confidently" delta={rateDelta} tone="positive" />
                <MetricCard label="Chat sessions" value={fmtNum(totalUsers)} hint="engaged conversations" delta={pctDelta(users)} spark={users} tone="info" />
                <MetricCard label="Gaps" value={fmtNum(totalUn)} hint="unanswered questions" delta={pctDelta(unans)} deltaInvert spark={unans} tone="warn" />
            </div>

            <Card className="p-4 sm:p-5">
                <SectionHeader title="Activity trend" subtitle="Daily question volume and gaps over the last 30 days" icon="show_chart" className="mb-4" />
                <TrendChart
                    points={trendPoints}
                    series={[
                        { key: 'total', name: 'Questions', color: '#3b82f6', fill: true },
                        { key: 'unanswered', name: 'Unanswered', color: '#f43f5e', fill: false },
                    ]}
                />
            </Card>

            <Card className="overflow-hidden">
                <div className="p-4 sm:p-5">
                    <SectionHeader title="30-day activity map" subtitle="Tap a day to inspect what customers asked" icon="calendar_view_month" className="mb-4" />
                    <ActivityHeatmap series={series} selected={selected?.date || null} onSelect={setSelected} />
                </div>

                <div className="border-t border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-4 sm:p-5">
                    {selected ? (
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                                <div>
                                    <p className="text-[16px] font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                                        {new Date(selected.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge tone="ok">{fmtNum(selected.answered)} answered</Badge>
                                    <Badge tone={selected.unanswered > 0 ? 'alert' : 'neutral'}>{fmtNum(selected.unanswered)} unanswered</Badge>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Total activity', value: selected.total },
                                    { label: 'Chat sessions', value: selected.users },
                                ].map((s) => (
                                    <div key={s.label} className="rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 px-3.5 py-2.5">
                                        <span className="text-[12px] text-slate-500 dark:text-slate-400">{s.label}</span>
                                        <p className="text-[22px] font-bold tabular-nums text-slate-900 dark:text-slate-100 leading-none mt-1">{fmtNum(s.value)}</p>
                                    </div>
                                ))}
                            </div>

                            {(selected.raw?.top_questions?.length > 0 || (selected.unanswered > 0 && selected.raw?.top_unanswered?.length > 0)) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 pt-1">
                                    {selected.raw?.top_questions?.length > 0 && (
                                        <div>
                                            <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Top questions</span>
                                            <ul className="space-y-1">
                                                {selected.raw.top_questions.map((q: string, i: number) => (
                                                    <li key={i} className="text-[12.5px] text-slate-600 dark:text-slate-400 leading-snug font-medium">“{q}”</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {selected.unanswered > 0 && selected.raw?.top_unanswered?.length > 0 && (
                                        <div>
                                            <span className="text-[12px] font-semibold text-amber-600 dark:text-amber-400 block mb-1.5">Unanswered queries</span>
                                            <ul className="space-y-1">
                                                {selected.raw.top_unanswered.map((q: string, i: number) => (
                                                    <li key={i} className="text-[12.5px] text-slate-600 dark:text-slate-400 leading-snug font-medium">“{q}”</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <EmptyState icon="touch_app" title="Select a day" hint="Tap a square above to inspect that day's activity." />
                    )}
                </div>
            </Card>
        </div>
    );
}

// ── Demo Inline Training Widget ──
function DemoInlineTrainingWidget({ query, onCancel, onSuccess }: { query: string; onCancel: () => void; onSuccess: (ans: string) => void }) {
    const [activeTab, setActiveTab] = useState<'quick' | 'pdf'>('quick');
    const [answerText, setAnswerText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isPending, setIsPending] = useState(false);

    const handleSave = () => {
        setIsPending(true);
        setTimeout(() => {
            setIsPending(false);
            if (activeTab === 'quick') {
                onSuccess(answerText);
            } else {
                onSuccess(`Trained via uploaded PDF: ${file?.name || 'document.pdf'}`);
            }
        }, 1200);
    };

    return (
        <div className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col gap-3 transition-all">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold font-google text-slate-700 dark:text-slate-300">
                    Teach Vaayu AI the Answer
                </span>
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={() => setActiveTab('quick')}
                        disabled={isPending}
                        className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === 'quick' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Write Answer
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('pdf')}
                        disabled={isPending}
                        className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === 'pdf' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Upload PDF
                    </button>
                </div>
            </div>

            {activeTab === 'quick' ? (
                <div className="flex flex-col gap-2">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold">Question:</span> "{query}"
                    </div>
                    <textarea
                        rows={3}
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        disabled={isPending}
                        placeholder="Provide the facts or response that Vaayu should use to answer this..."
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none rounded-xl text-slate-900 dark:text-slate-200 transition-all resize-none"
                    />
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <div
                        className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[24px] text-slate-500 dark:text-slate-400">
                            cloud_upload
                        </span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 text-center mt-1">
                            {file ? file.name : 'Choose PDF file'}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">Max 10MB</span>
                        <input
                            type="file"
                            className="hidden"
                            accept=".pdf"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f && f.type === 'application/pdf') {
                                    setFile(f);
                                }
                            }}
                        />
                    </div>
                </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-1">
                <button
                    type="button"
                    disabled={isPending}
                    onClick={onCancel}
                    className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={isPending || (activeTab === 'quick' ? !answerText.trim() : !file)}
                    onClick={handleSave}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                    {isPending ? (
                        <>
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                            Training...
                        </>
                    ) : (
                        'Save & Train'
                    )}
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────
export default function DemoInsightsPage() {
    const [botConfig, setBotConfig] = useState<any>({ name: 'Vaayu AI' });
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState('sales');
    const [mobileSubTab, setMobileSubTab] = useState<'action' | 'leads'>('action');

    // Shared States
    const [leads, setLeads] = useState(INITIAL_DEMO_LEADS);
    const [costPerTicket, setCostPerTicket] = useState('5');
    const [leadValue, setLeadValue] = useState('50');
    const [showCalibrate, setShowCalibrate] = useState(false);
    const [calibrateSaved, setCalibrateSaved] = useState(false);
    const [isCalibrating, setIsCalibrating] = useState(false);

    // Action Queue items mapped to leads state
    const actionQueue = useMemo(() => {
        // High = HOT, Medium = WARM, Low = COLD.
        // Return active ones (not won and not lost, or new/contacted status)
        return leads
            .filter((l) => l.status === 'new' || l.status === 'contacted')
            .map((l) => {
                const urgency = l.band === 'HOT' ? 'high' as const : l.band === 'WARM' ? 'medium' as const : 'low' as const;
                const hoursText = l.id === '1' ? '2h' : l.id === '2' ? '5h' : '8h';
                return {
                    ...l,
                    urgency,
                    reason: `${l.band === 'HOT' ? 'Hot lead' : l.band === 'WARM' ? 'Awaiting first reply' : 'Leads captures'} · ${hoursText} old`,
                };
            });
    }, [leads]);

    const [acted, setActed] = useState<Record<string, 'won' | 'lost'>>({});
    const [enteringValueLeadId, setEnteringValueLeadId] = useState<string | null>(null);
    const [dealValueInput, setDealValueInput] = useState('');
    const [emailDraftLead, setEmailDraftLead] = useState<any | null>(null);
    const [draftSubject, setDraftSubject] = useState('');
    const [draftBody, setDraftBody] = useState('');
    const [draftCc, setDraftCc] = useState('');
    const [copied, setCopied] = useState(false);
    const [showEmailProviders, setShowEmailProviders] = useState(false);

    // Leads CRM table filters & states
    const [leadsPage, setLeadsPage] = useState(1);
    const [leadsSort, setLeadsSort] = useState('recent');
    const [leadsBandFilter, setLeadsBandFilter] = useState('all');
    const [leadsStatusFilter, setLeadsStatusFilter] = useState('all');
    const [deleteConfirmLeadId, setDeleteConfirmLeadId] = useState<string | null>(null);
    const [leadValueDrafts, setLeadValueDrafts] = useState<Record<string, string>>({});

    // Conversations state
    const [sessions, setSessions] = useState(INITIAL_DEMO_SESSIONS);
    const [conversationsPage, setConversationsPage] = useState(1);
    const [conversationsFilter, setConversationsFilter] = useState('all'); // all, unanswered
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
    const [selectedQueryFilter, setSelectedQueryFilter] = useState<string | null>(null);
    const [trainingQuery, setTrainingQuery] = useState<string | null>(null);

    // Gaps (fixes) state
    const [fixes, setFixes] = useState(INITIAL_DEMO_FIXES);

    // Funnel state & Simulated Insights
    const [windowDays, setWindowDays] = useState<number>(30);
    const [activeBand, setActiveBand] = useState<string | null>(null);
    const [reportData, setReportData] = useState<any>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);

    useEffect(() => {
        setBotConfig(getBotConfig());
        setMounted(true);
    }, []);

    const report = useMemo(() => buildDemoReport(botConfig.name), [botConfig.name]);

    // ─────────────────────────────────────────────────────────────────────────
    // Financial ROI Computations
    // ─────────────────────────────────────────────────────────────────────────
    const stats30d = { total_queries: 420, answered_queries: 344, leads: 64 };
    const numCostPerTicket = parseFloat(costPerTicket) || 0;
    const numLeadValue = parseFloat(leadValue) || 0;
    const previewSavings = stats30d.answered_queries * numCostPerTicket;
    const previewRevenue = stats30d.leads * numLeadValue;
    const previewTotal = previewSavings + previewRevenue;
    const answerRate = stats30d.total_queries > 0 ? Math.round((stats30d.answered_queries / stats30d.total_queries) * 100) : 0;

    // We baseline realized revenue at $7,200 (10 deals) + Priya Patel ($1,200 won)
    // Plus any other leads marked Won during this demo run.
    const wonActiveLeads = leads.filter((l) => l.status === 'won' && l.id !== '4');
    const activeWonValue = wonActiveLeads.reduce((acc, l) => acc + (l.value_usd || 0), 0);
    const priyaStatus = leads.find((l) => l.id === '4')?.status;
    const priyaValue = priyaStatus === 'won' ? (leads.find((l) => l.id === '4')?.value_usd || 1200) : 0;

    const realizedRevenue = 7200 + activeWonValue + priyaValue;
    const wonDealsCount = 10 + wonActiveLeads.length + (priyaStatus === 'won' ? 1 : 0);

    // ─────────────────────────────────────────────────────────────────────────
    // Handlers
    // ─────────────────────────────────────────────────────────────────────────
    const handleCalibrateSave = () => {
        setIsCalibrating(true);
        setTimeout(() => {
            setIsCalibrating(false);
            setCalibrateSaved(true);
            setTimeout(() => setCalibrateSaved(false), 2500);
        }, 800);
    };

    const handleActionOutcome = (leadId: string, status: 'won' | 'lost', valUsd: number | null) => {
        setActed((prev) => ({ ...prev, [leadId]: status }));
        setTimeout(() => {
            setLeads((prev) =>
                prev.map((l) => (l.id === leadId ? { ...l, status, value_usd: valUsd } : l))
            );
            setActed((prev) => {
                const n = { ...prev };
                delete n[leadId];
                return n;
            });
        }, 480);
    };

    const handleLeadStatusChange = (leadId: string, newStatus: string) => {
        setLeads((prev) =>
            prev.map((l) =>
                l.id === leadId
                    ? { ...l, status: newStatus, value_usd: newStatus === 'won' ? (l.value_usd ?? 0) : null }
                    : l
            )
        );
    };

    const handleSaveLeadValue = (leadId: string) => {
        const valStr = leadValueDrafts[leadId];
        const val = parseFloat(valStr);
        setLeads((prev) =>
            prev.map((l) =>
                l.id === leadId ? { ...l, status: 'won', value_usd: Number.isFinite(val) && val >= 0 ? val : 0 } : l
            )
        );
        setLeadValueDrafts((prev) => {
            const n = { ...prev };
            delete n[leadId];
            return n;
        });
    };

    const handleExportCSV = () => {
        try {
            const headers = 'ID,Name,Email,Score,Band,Status,Value (USD),Context,Created At\n';
            const rows = leads
                .map((l) => `${l.id},"${l.name || ''}",${l.email},${l.score},${l.band},${l.status},${l.value_usd || ''},"${l.context || ''}",${l.created_at}`)
                .join('\n');
            const blob = new Blob([headers + rows], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `leads_demo_${botConfig.name.toLowerCase().replace(/\s+/g, '_')}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            alert('Export failed. Please try again.');
        }
    };

    const handleEmailDraftOpen = (lead: any) => {
        setEmailDraftLead(lead);
        const leadName = lead.name || 'there';
        const context = lead.context ? `"${lead.context}"` : 'your questions';
        const companyName = 'our company';
        const subject = `Following up on your inquiry with ${botConfig.name}`;
        const body = `Hi ${leadName},\n\n` +
            `Thanks for checking out our website and chatting with our AI assistant, ${botConfig.name}.\n\n` +
            `I saw you were asking about ${context}. I wanted to follow up personally to see if you have any other questions, or if we can help you with anything else.\n\n` +
            `Looking forward to hearing from you!\n\nBest regards,\nThe team at ${companyName}`;
        setDraftSubject(subject);
        setDraftBody(body);
        setDraftCc('');
        setCopied(false);
        setShowEmailProviders(false);
    };

    const handleCopyEmailDraft = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleTeachSuccess = (queryText: string, taughtAnswer: string) => {
        // Mark transcripts matching the query as handled
        setSessions((prev) =>
            prev.map((s) => {
                const matched = s.messages.some((m) => m.user_query.toLowerCase() === queryText.toLowerCase());
                if (!matched) return s;
                const newMessages = s.messages.map((m) =>
                    m.user_query.toLowerCase() === queryText.toLowerCase()
                        ? { ...m, is_unanswered: false, bot_response: taughtAnswer }
                        : m
                );
                const hasUnans = newMessages.some((m) => m.is_unanswered);
                return { ...s, messages: newMessages, has_unanswered: hasUnans };
            })
        );

        // Remove from gaps list
        setFixes((prev) => prev.filter((f) => f.query.toLowerCase() !== queryText.toLowerCase()));
        setTrainingQuery(null);
    };

    const handleGenerate = () => {
        setIsGenerating(true);
        setReportData(null);
        setTimeout(() => {
            setIsGenerating(false);
            setReportData(report);
            setLastGeneratedAt(new Date().toLocaleString());
        }, 1500);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Filtered / Sorted Data Sets
    // ─────────────────────────────────────────────────────────────────────────

    // Filtered Leads CRM
    const filteredLeads = useMemo(() => {
        return leads
            .filter((l) => {
                if (leadsBandFilter !== 'all' && l.band !== leadsBandFilter) return false;
                if (leadsStatusFilter !== 'all' && l.status !== leadsStatusFilter) return false;
                return true;
            })
            .sort((a, b) => {
                if (leadsSort === 'score') return b.score - a.score;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
    }, [leads, leadsBandFilter, leadsStatusFilter, leadsSort]);

    // Filtered Transcripts
    const filteredSessions = useMemo(() => {
        let list = sessions;
        if (conversationsFilter === 'unanswered') {
            list = list.filter((s) => s.has_unanswered);
        }
        if (selectedQueryFilter) {
            list = list.filter((s) =>
                s.messages.some((m) => m.user_query.toLowerCase().includes(selectedQueryFilter.toLowerCase()))
            );
        }
        return list;
    }, [sessions, conversationsFilter, selectedQueryFilter]);

    // ─────────────────────────────────────────────────────────────────────────
    // Tab Headers Rendering
    // ─────────────────────────────────────────────────────────────────────────
    const TABS = [
        { id: 'sales', label: 'Sales & Leads', shortLabel: 'Sales', icon: 'sell' },
        { id: 'conversations', label: 'Conversations', shortLabel: 'Chats', icon: 'forum' },
        { id: 'funnel', label: 'Funnel & Insights', shortLabel: 'Funnel', icon: 'insights' },
    ];

    const botSelector = (
        <div className="relative">
            <select
                value="demo"
                disabled
                aria-label="Select bot"
                className="appearance-none cursor-not-allowed rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-3 pr-8 py-1.5 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 focus-visible:outline-none"
            >
                <option value="demo">{botConfig.name}</option>
            </select>
            <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 pointer-events-none">expand_more</span>
        </div>
    );

    const generateBtn = activeTab === 'funnel' && (
        <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            title="Generate insights"
            aria-label="Generate insights"
        >
            <span className={cx("material-symbols-outlined text-[16px]", isGenerating && "animate-spin")}>
                autorenew
            </span>
            <span className="hidden sm:inline">
                {isGenerating ? 'Synthesizing…' : 'Generate insights'}
            </span>
        </button>
    );

    const renderHeader = () => (
        <div className="relative shrink-0 z-30 bg-[#f8f9fa]/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/70">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 md:px-6 lg:px-8 py-1.5 sm:py-0">
                <div role="tablist" aria-label="Insights sections" className="flex items-center gap-1 min-w-0">
                    {TABS.map((tab) => {
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                role="tab"
                                aria-selected={active}
                                onClick={() => setActiveTab(tab.id)}
                                className={cx(
                                    'relative inline-flex items-center gap-1.5 py-3 px-2 text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none',
                                    active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
                                )}
                            >
                                <span className="material-symbols-outlined text-[17px]">{tab.icon}</span>
                                <span className="hidden sm:inline">{tab.label}</span>
                                <span className="sm:hidden">{tab.shortLabel}</span>
                                {active && <span className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
                            </button>
                        );
                    })}
                </div>
                <div className="flex flex-wrap items-center gap-2 py-1.5 sm:py-2">
                    {botSelector}
                    {generateBtn}
                </div>
            </div>
            {activeTab === 'funnel' && lastGeneratedAt && (
                <div className="px-4 md:px-6 lg:px-8 pb-1.5 -mt-1">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">Insights last generated {lastGeneratedAt}</span>
                </div>
            )}
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Tab Paner Renderers
    // ─────────────────────────────────────────────────────────────────────────

    // ── Tab 1: Sales & Leads ──
    const renderSalesAndLeadsTab = () => {
        // ROIPanel Mock
        const roiPanel = (
            <section className="flex flex-col gap-3" aria-label="Financial impact and ROI">
                <SectionHeader
                    title="Financial impact & ROI"
                    subtitle="What your assistant is worth — last 30 days"
                    icon="payments"
                    right={
                        <button
                            onClick={() => setShowCalibrate((v) => !v)}
                            aria-expanded={showCalibrate}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-[12.5px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                        >
                            <span className="material-symbols-outlined text-[16px]">tune</span>
                            {showCalibrate ? 'Hide' : 'Calibrate'}
                        </button>
                    }
                />

                {showCalibrate && (
                    <div className={cx(card, 'p-5')}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Cost per support ticket ($)</label>
                                <input
                                    type="number" min="0" step="0.5"
                                    value={costPerTicket}
                                    onChange={(e) => setCostPerTicket(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[14px] tabular-nums text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                    placeholder="5.00"
                                />
                                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">Industry avg: $5–$25 per ticket</p>
                            </div>
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Average lead value ($)</label>
                                <input
                                    type="number" min="0" step="5"
                                    value={leadValue}
                                    onChange={(e) => setLeadValue(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[14px] tabular-nums text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                    placeholder="50.00"
                                />
                                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">Estimate of one captured lead's worth</p>
                            </div>
                        </div>
                        <button
                            onClick={handleCalibrateSave}
                            disabled={isCalibrating}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-[12.5px] font-semibold text-white dark:text-slate-900 disabled:opacity-50 transition-colors"
                        >
                            {isCalibrating ? (
                                <><span className="h-3 w-3 border-2 border-slate-400 border-t-white animate-spin rounded-full motion-reduce:animate-none" />Saving…</>
                            ) : calibrateSaved ? (
                                <><span className="material-symbols-outlined text-[16px]">check</span>Saved</>
                            ) : (
                                'Save benchmarks'
                            )}
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard label="Support saved" value={fmtMoney(previewSavings)} hint={`${fmtNum(stats30d.answered_queries)} queries answered`} icon="support_agent" tone="default" />
                    <MetricCard label="Potential revenue" value={fmtMoney(previewRevenue)} hint={`${fmtNum(stats30d.leads)} leads captured`} icon="trending_up" tone="info" />
                    <MetricCard label="Proven revenue" value={fmtMoney(realizedRevenue)} hint={`${fmtNum(wonDealsCount)} closed-won deal${wonDealsCount !== 1 ? 's' : ''}`} icon="verified" tone="positive" />
                    <MetricCard label="Estimated total ROI" value={fmtMoney(previewTotal)} hint={`${answerRate}% answer rate`} icon="account_balance" tone="accent" />
                </div>
            </section>
        );

        // ActionCenterPanel Mock
        const actionCenterPanel = (
            <Card className="overflow-hidden">
                <div className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
                    <SectionHeader title="Action queue" subtitle="Hot leads worth a follow-up right now" icon="bolt" />
                    <div className="flex items-center gap-1.5 shrink-0">
                        {actionQueue.filter((l) => l.urgency === 'high').length > 0 && (
                            <Badge tone="hot">{actionQueue.filter((l) => l.urgency === 'high').length} urgent</Badge>
                        )}
                        {actionQueue.filter((l) => l.urgency === 'medium').length > 0 && (
                            <Badge tone="warm">{actionQueue.filter((l) => l.urgency === 'medium').length} soon</Badge>
                        )}
                    </div>
                </div>

                {actionQueue.length === 0 ? (
                    <EmptyState icon="celebration" title="You're all caught up" hint="New hot leads will appear here the moment they come in." />
                ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {actionQueue.map((lead) => {
                            const isEnteringValue = enteringValueLeadId === lead.id;
                            const isHigh = lead.urgency === 'high';
                            const badgeTone = isHigh ? 'hot' as const : 'warm' as const;
                            const labelText = isHigh ? 'Act now' : 'Soon';

                            return (
                                <li key={lead.id} className="px-4 sm:px-5 py-3.5 flex flex-col lg:flex-row lg:items-center gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                    <div className="min-w-0 lg:w-[34%] lg:shrink-0">
                                        <div className="flex items-baseline gap-2 min-w-0">
                                            <span className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 truncate">{lead.name || lead.email}</span>
                                            {lead.name && <span className="text-[12px] text-slate-500 dark:text-slate-400 truncate">{lead.email}</span>}
                                        </div>
                                        {lead.context && <p className="text-[12.5px] text-slate-500 dark:text-slate-400 truncate mt-0.5">“{lead.context}”</p>}
                                    </div>

                                    <div className="lg:flex-1 flex flex-wrap items-center gap-2 min-w-0">
                                        <span className="text-[12.5px] text-slate-600 dark:text-slate-300 truncate max-w-full">{lead.reason}</span>
                                        <Badge tone={badgeTone}>{labelText}</Badge>
                                        {lead.band && <Badge tone={badgeToneFor(lead.band)}>{lead.band}</Badge>}
                                    </div>

                                    <div className="shrink-0 flex items-center gap-2 self-end lg:self-auto">
                                        {isEnteringValue ? (
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1">
                                                    <span className="text-[12px] text-slate-400">$</span>
                                                    <input
                                                        type="number" placeholder="Value" value={dealValueInput}
                                                        onChange={(e) => setDealValueInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                const val = parseFloat(dealValueInput);
                                                                handleActionOutcome(lead.id, 'won', Number.isFinite(val) && val >= 0 ? val : 0);
                                                                setEnteringValueLeadId(null);
                                                            } else if (e.key === 'Escape') setEnteringValueLeadId(null);
                                                        }}
                                                        autoFocus
                                                        className="w-16 bg-transparent text-[12px] tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none"
                                                    />
                                                </div>
                                                <button onClick={() => { const val = parseFloat(dealValueInput); handleActionOutcome(lead.id, 'won', Number.isFinite(val) && val >= 0 ? val : 0); setEnteringValueLeadId(null); }} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors">Save</button>
                                                <button onClick={() => { handleActionOutcome(lead.id, 'won', null); setEnteringValueLeadId(null); }} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Skip</button>
                                            </div>
                                        ) : (
                                            <>
                                                <button type="button" onClick={() => handleEmailDraftOpen(lead)} title="Draft follow-up email" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                                    <span className="material-symbols-outlined text-[16px]">mail</span>
                                                </button>
                                                <button type="button" onClick={() => { setEnteringValueLeadId(lead.id); setDealValueInput(''); }} className={cx('rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors', acted[lead.id] === 'won' ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400')}>Won</button>
                                                <button type="button" onClick={() => handleActionOutcome(lead.id, 'lost', null)} className={cx('rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors', acted[lead.id] === 'lost' ? 'bg-rose-500 border-rose-500 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-400')}>Lost</button>
                                            </>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {actionQueue.length > 0 && (
                    <p className="px-5 py-2.5 text-[11.5px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                        Won deals add to realized revenue · edit values in the Leads CRM below
                    </p>
                )}
            </Card>
        );

        // LeadsPanel Mock
        const STATUS_OPTIONS = ['new', 'contacted', 'won', 'lost'] as const;
        const STATUS_DOT: Record<string, string> = { new: 'bg-slate-400', contacted: 'bg-sky-500', won: 'bg-emerald-500', lost: 'bg-slate-300 dark:bg-slate-600' };

        const renderStatusCell = (lead: any) => {
            const status = lead.status || 'new';
            return (
                <div className="flex flex-col gap-1.5">
                    <div className="relative inline-flex items-center">
                        <span className={cx('absolute left-2.5 h-1.5 w-1.5 rounded-full pointer-events-none', STATUS_DOT[status])} />
                        <select
                            value={status}
                            onChange={(e) => handleLeadStatusChange(lead.id, e.target.value)}
                            aria-label="Lead status"
                            className="appearance-none cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-5 pr-7 py-1 text-[12px] font-semibold capitalize text-slate-700 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                        >
                            {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                        </select>
                        <span className="material-symbols-outlined absolute right-1 text-[14px] text-slate-400 pointer-events-none">expand_more</span>
                    </div>
                    {status === 'won' && (
                        <div className="flex items-center gap-1">
                            <span className="text-[12px] text-slate-400">$</span>
                            <input
                                type="number" min="0" step="any" inputMode="decimal"
                                value={leadValueDrafts[lead.id] ?? (lead.value_usd ?? '')}
                                onChange={(e) => setLeadValueDrafts((p) => ({ ...p, [lead.id]: e.target.value }))}
                                onBlur={() => { if (leadValueDrafts[lead.id] !== undefined) handleSaveLeadValue(lead.id); }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { handleSaveLeadValue(lead.id); (e.target as HTMLInputElement).blur(); }
                                    else if (e.key === 'Escape') { setLeadValueDrafts((p) => { const n = { ...p }; delete n[lead.id]; return n; }); (e.target as HTMLInputElement).blur(); }
                                }}
                                placeholder="0"
                                aria-label="Deal value in USD"
                                className="w-20 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1 text-[12px] tabular-nums text-right text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                            />
                            <button onClick={() => handleSaveLeadValue(lead.id)} title="Save deal value" className="flex h-6 w-6 items-center justify-center rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors">
                                <span className="material-symbols-outlined text-[14px]">check</span>
                            </button>
                        </div>
                    )}
                </div>
            );
        };

        const deleteCell = (lead: any, align = 'center') => {
            const isConfirming = deleteConfirmLeadId === lead.id;
            return isConfirming ? (
                <div className={cx('flex flex-col gap-1.5', align === 'center' ? 'items-center' : 'items-end')}>
                    <span className="text-[11px] font-semibold uppercase text-rose-600 dark:text-rose-400">Delete?</span>
                    <div className="flex gap-1.5">
                        <button onClick={() => { setLeads((prev) => prev.filter((l) => l.id !== lead.id)); setDeleteConfirmLeadId(null); }} className="rounded-md bg-rose-500 hover:bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white">Yes</button>
                        <button onClick={() => setDeleteConfirmLeadId(null)} className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">No</button>
                    </div>
                </div>
            ) : (
                <button onClick={() => setDeleteConfirmLeadId(lead.id)} title="Delete lead" className={cx('flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors', align === 'center' && 'mx-auto')}>
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
            );
        };

        const leadsPanel = (
            <Card className="flex flex-col overflow-hidden">
                <div className="px-4 sm:px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-slate-400">contacts</span>
                        <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{fmtNum(filteredLeads.length)} lead{filteredLeads.length !== 1 ? 's' : ''}</h3>
                    </div>
                    {(leads.length > 0) && (
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <select
                                    value={leadsStatusFilter}
                                    onChange={(e) => { setLeadsStatusFilter(e.target.value); setLeadsPage(1); }}
                                    aria-label="Filter by pipeline status"
                                    className="appearance-none cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-3 pr-7 py-1.5 text-[12px] font-semibold capitalize text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                >
                                    <option value="all">All statuses</option>
                                    {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                                </select>
                                <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-[14px] text-slate-400 pointer-events-none">expand_more</span>
                            </div>
                            <Segmented
                                ariaLabel="Filter by lead quality"
                                size="sm"
                                options={[{ value: 'all', label: 'All' }, { value: 'HOT', label: 'Hot' }, { value: 'WARM', label: 'Warm' }, { value: 'COLD', label: 'Cold' }]}
                                value={leadsBandFilter}
                                onChange={(v) => { setLeadsBandFilter(v); setLeadsPage(1); }}
                            />
                            <button
                                onClick={() => { setLeadsSort((s) => (s === 'score' ? 'recent' : 'score')); setLeadsPage(1); }}
                                title="Toggle sort order"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[14px]">swap_vert</span>{leadsSort === 'score' ? 'Score' : 'Recent'}
                            </button>
                            <button onClick={handleExportCSV} title="Export CSV" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <span className="material-symbols-outlined text-[14px]">download</span>CSV
                            </button>
                        </div>
                    )}
                </div>

                {filteredLeads.length === 0 ? (
                    <EmptyState
                        icon="person_search"
                        title={leadsBandFilter !== 'all' ? `No ${leadsBandFilter.toLowerCase()} leads` : leadsStatusFilter !== 'all' ? `No ${leadsStatusFilter} leads` : 'No leads captured yet'}
                        hint="When your assistant triggers the lead form, contacts will appear here."
                    />
                ) : (
                    <>
                        {/* Mobile cards */}
                        <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
                            {filteredLeads.map((lead: any) => (
                                <div key={lead.id} className="px-4 py-3.5 flex flex-col gap-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 break-all">{lead.email}</p>
                                            {lead.name && <p className="text-[12px] text-slate-500 dark:text-slate-400">{lead.name}</p>}
                                        </div>
                                        <Badge tone={badgeToneFor(lead.band)}>
                                            {lead.band} · {lead.score}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">{renderStatusCell(lead)}</div>
                                    {lead.context && <p className="text-[12.5px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-2.5 py-1.5 leading-snug break-words">{lead.context}</p>}
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11.5px] tabular-nums text-slate-400">{new Date(lead.created_at).toLocaleDateString()} · {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        {deleteCell(lead, 'end')}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop table */}
                        <div className="hidden sm:block overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[920px]">
                                <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                                    <tr>
                                        {['Contact', 'Quality', 'Deal stage & value', 'What they wanted', 'Captured', ''].map((h, i) => (
                                            <th key={i} className={cx('px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400', i === 5 && 'text-center')}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {filteredLeads.map((lead: any) => (
                                        <tr key={lead.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors align-top">
                                            <td className="px-4 py-3">
                                                <p className="text-[13.5px] font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[200px]" title={lead.email}>{lead.email}</p>
                                                {lead.name && <p className="text-[12px] text-slate-500 dark:text-slate-400">{lead.name}</p>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge tone={badgeToneFor(lead.band)}>
                                                    {lead.band} · {lead.score}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3">{renderStatusCell(lead)}</td>
                                            <td className="px-4 py-3">
                                                <p className="text-[12.5px] text-slate-600 dark:text-slate-300 leading-snug break-words max-w-[260px]">{lead.context || '—'}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-[12px] tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                    {new Date(lead.created_at).toLocaleDateString()}<br />{new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">{deleteCell(lead)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </Card>
        );

        return (
            <div className="flex flex-col gap-6 w-full min-w-0">
                {roiPanel}

                {/* Desktop consolidated layout */}
                <div className="hidden sm:flex flex-col gap-6 w-full">
                    {actionCenterPanel}
                    {leadsPanel}
                </div>

                {/* Mobile sub-tabs */}
                <div className="flex sm:hidden flex-col gap-4 w-full">
                    <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-0.5 self-start">
                        {([['action', 'Action queue'], ['leads', 'All leads']] as const).map(([id, label]) => {
                            const active = mobileSubTab === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => setMobileSubTab(id)}
                                    aria-pressed={active}
                                    className={cx(
                                        'rounded-[6px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
                                        active ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400',
                                    )}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    {mobileSubTab === 'action' ? actionCenterPanel : leadsPanel}
                </div>
            </div>
        );
    };

    // ── Tab 2: Conversations & Gaps ──
    const renderConversationsTab = () => {
        const filterButton = (id: string, label: string, dotColor?: string) => {
            const active = conversationsFilter === id && !selectedQueryFilter;
            return (
                <button
                    onClick={() => { setConversationsFilter(id); setSelectedQueryFilter(null); setConversationsPage(1); }}
                    aria-pressed={active}
                    className={cx(
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-none',
                        active ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
                    )}
                >
                    {dotColor && <span className={cx('h-1.5 w-1.5 rounded-full', dotColor)} />}
                    {label}
                </button>
            );
        };

        const transcriptListCard = (
            <Card className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-slate-400">forum</span>
                        <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{fmtNum(filteredSessions.length)} conversation{filteredSessions.length !== 1 ? 's' : ''}</h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {filterButton('all', 'All')}
                        {filterButton('unanswered', 'Has gaps', 'bg-amber-500')}
                    </div>
                </div>

                {selectedQueryFilter && (
                    <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/30 flex items-center justify-between gap-2 text-[12px] text-amber-700 dark:text-amber-300">
                        <span className="truncate">Showing matches for <span className="font-semibold">“{selectedQueryFilter}”</span></span>
                        <button onClick={() => setSelectedQueryFilter(null)} className="shrink-0 inline-flex items-center gap-0.5 font-semibold hover:underline">
                            Clear <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                    </div>
                )}

                {filteredSessions.length === 0 ? (
                    <EmptyState
                        icon={conversationsFilter === 'unanswered' ? 'task_alt' : 'chat'}
                        title={conversationsFilter === 'unanswered' ? 'No gaps here' : 'No conversations yet'}
                        hint={conversationsFilter === 'unanswered' ? 'Your assistant answered everything it was asked.' : 'Transcripts appear here once people start chatting.'}
                    />
                ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/60">
                        {filteredSessions.map((session) => {
                            const isExpanded = expandedSessionId === session.session_id;
                            const preview = session.messages[0]?.user_query || '';
                            return (
                                <div key={session.session_id} className="flex flex-col">
                                    <button
                                        onClick={() => setExpandedSessionId(isExpanded ? null : session.session_id)}
                                        aria-expanded={isExpanded}
                                        className={cx(
                                            'w-full text-left px-4 py-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors flex items-start gap-3 border-l-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/40',
                                            session.has_unanswered ? 'border-l-amber-500' : 'border-l-transparent',
                                        )}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13.5px] font-medium text-slate-800 dark:text-slate-200 truncate">{preview || 'No messages'}</p>
                                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                                                <span className="tabular-nums">{new Date(session.last_active).toLocaleDateString()}</span>
                                                <span aria-hidden>·</span>
                                                <span className="tabular-nums">{session.message_count} msg{session.message_count !== 1 ? 's' : ''}</span>
                                                {session.has_unanswered && <Badge tone="alert">Has gaps</Badge>}
                                            </div>
                                        </div>
                                        <span className={cx('material-symbols-outlined text-[18px] text-slate-400 shrink-0 transition-transform mt-0.5', isExpanded && 'rotate-180')}>expand_more</span>
                                    </button>

                                    {isExpanded && (
                                        <div className="px-4 py-3 bg-slate-50/60 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800/50 flex flex-col gap-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
                                            {session.messages.map((msg, idx) => {
                                                const isTrainingThis = trainingQuery === msg.user_query;
                                                return (
                                                    <div key={idx} className="flex flex-col gap-1.5">
                                                        <div className="flex items-start gap-2">
                                                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 mt-0.5">
                                                                <span className="material-symbols-outlined text-[11px] text-slate-500 dark:text-slate-300">person</span>
                                                            </span>
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">User</span>
                                                                <p className="text-[13.5px] text-slate-800 dark:text-slate-200 leading-snug mt-0.5 break-words whitespace-pre-wrap">{msg.user_query}</p>
                                                            </div>
                                                            <span className="text-[11.5px] tabular-nums text-slate-400 shrink-0 mt-0.5">
                                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <div className={cx('ml-2.5 pl-3 border-l-2', msg.is_unanswered ? 'border-l-amber-400' : 'border-l-slate-200 dark:border-l-slate-700')}>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Assistant</span>
                                                                {msg.is_unanswered && <Badge tone="alert">Unanswered</Badge>}
                                                            </div>
                                                            <p className="text-[13.5px] text-slate-600 dark:text-slate-400 leading-snug mt-0.5 break-words whitespace-pre-wrap">{msg.bot_response}</p>
                                                            {msg.is_unanswered && !isTrainingThis && (
                                                                <button
                                                                    onClick={() => setTrainingQuery(msg.user_query)}
                                                                    className="inline-flex items-center gap-1 mt-1.5 text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                                                                >
                                                                    <span className="material-symbols-outlined text-[14px]">school</span>Teach the assistant
                                                                </button>
                                                            )}
                                                            {isTrainingThis && (
                                                                <div className="mt-2 w-full max-w-lg">
                                                                    <DemoInlineTrainingWidget
                                                                        query={msg.user_query}
                                                                        onCancel={() => setTrainingQuery(null)}
                                                                        onSuccess={(ansText) => handleTeachSuccess(msg.user_query, ansText)}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        );

        // Sidebar Gaps list matching FixesNeededPanel.tsx in mode="sidebar"
        const fixesNeededPanel = (
            <Card className="flex flex-col overflow-hidden h-full">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[18px] text-amber-500 shrink-0">build</span>
                        <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                            Gaps to teach
                        </h3>
                    </div>
                    {fixes.length > 0 && (
                        <div className="flex items-center gap-1.5 shrink-0">
                            {fixes.filter(f => f.category === 'unanswered').length > 0 && (
                                <Badge tone="alert" title="Unanswered">{fixes.filter(f => f.category === 'unanswered').length}</Badge>
                            )}
                            {fixes.filter(f => f.category === 'low_confidence').length > 0 && (
                                <Badge tone="warm" title="Low confidence">{fixes.filter(f => f.category === 'low_confidence').length}</Badge>
                            )}
                        </div>
                    )}
                </div>

                {fixes.length === 0 ? (
                    <EmptyState icon="task_alt" title="No gaps detected" hint="Your assistant answered confidently across the last 30 days." />
                ) : (
                    <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/60">
                        {fixes.map((fix, idx) => {
                            const isUnanswered = fix.category === 'unanswered';
                            const isActive = selectedQueryFilter === fix.query;
                            return (
                                <li key={idx}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setConversationsFilter('unanswered');
                                            setSelectedQueryFilter(isActive ? null : fix.query);
                                            setConversationsPage(1);
                                        }}
                                        aria-pressed={isActive}
                                        className={cx(
                                            'w-full text-left px-4 py-3 flex items-start gap-2.5 transition-colors',
                                            'hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer border-l-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/40',
                                            isActive ? 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20' : 'border-l-transparent',
                                        )}
                                    >
                                        <span className={cx('h-2 w-2 rounded-full mt-1.5 shrink-0', isUnanswered ? 'bg-amber-500' : 'bg-orange-400')} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200 leading-snug break-words">{fix.query}</p>
                                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                                                <span className={cx('font-semibold', isUnanswered ? 'text-amber-600 dark:text-amber-400' : 'text-orange-600 dark:text-orange-400')}>
                                                    {isUnanswered ? 'Unanswered' : 'Low confidence'}
                                                </span>
                                                <span className="tabular-nums">Asked {fix.ask_count}×</span>
                                                {!isUnanswered && fix.confidence !== null && <span className="tabular-nums">{Math.round(fix.confidence * 100)}% grounded</span>}
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Card>
        );

        return (
            <div className="flex flex-col gap-4 w-full min-w-0">
                {/* Mobile / Tablet layout */}
                <div className="lg:hidden">
                    {fixesNeededPanel}
                </div>

                {/* Desktop layout */}
                <div className="flex flex-col lg:flex-row gap-4 w-full flex-1 min-w-0">
                    {transcriptListCard}
                    <div className="hidden lg:block lg:w-[34%] min-w-0 shrink-0">
                        {fixesNeededPanel}
                    </div>
                </div>
            </div>
        );
    };

    // ── Tab 3: Funnel & Insights ──
    const renderFunnelTab = () => {
        const windowSelector = (
            <Segmented
                ariaLabel="Funnel time window"
                options={[{ value: 7, label: '7d' }, { value: 30, label: '30d' }, { value: 90, label: '90d' }, { value: 0, label: 'All' }]}
                value={windowDays}
                onChange={setWindowDays}
                size="sm"
            />
        );

        const funnelStages = DEMO_FUNNEL_RAW.stages.map(s => ({
            ...s,
            description: STAGE_DESCRIPTIONS[s.key],
        }));

        const sourceAttributionBars = DEMO_FUNNEL_RAW.sources.items.map(s => ({
            label: s.source,
            value: s.leads,
            secondary: s.won > 0 ? fmtMoney(s.won_value) : undefined,
            icon: SOURCE_ICONS[s.source.toLowerCase()] || 'language',
        }));

        const donutChartData = DEMO_FUNNEL_RAW.quality.bands.map(b => ({
            key: b.band.toLowerCase(),
            label: b.band.charAt(0).toUpperCase() + b.band.slice(1),
            count: b.count,
            pct: b.pct,
            color: QUALITY_COLORS[b.band.toLowerCase()] || '#94a3b8',
            description: QUALITY_DESCRIPTIONS[b.band.toLowerCase()],
        }));

        return (
            <div className="flex flex-col gap-6 w-full min-w-0">
                {/* Funnel Section */}
                <div className="flex flex-col gap-4">
                    <SectionHeader
                        title="Conversion funnel"
                        subtitle="How visitors turn into revenue, stage by stage"
                        icon="filter_alt"
                        right={windowSelector}
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        <Card className="lg:col-span-8 p-4 sm:p-5">
                            <FunnelChart stages={funnelStages} />
                        </Card>
                        <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
                            <MetricCard
                                label="Overall conversion"
                                value="2.6%"
                                hint="conversations → won deals"
                                icon="conversion_path"
                                tone="accent"
                            />
                            <MetricCard
                                label="Revenue won"
                                value={fmtMoney(realizedRevenue)}
                                hint="closed-won in this window"
                                icon="paid"
                                tone="positive"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card className="p-4 sm:p-5">
                            <SectionHeader title="Lead quality" subtitle="Volume by purchase-intent signals" className="mb-4" />
                            <DonutChart data={donutChartData} total={DEMO_FUNNEL_RAW.quality.total_scored} totalLabel="Scored" />
                        </Card>

                        <Card className="p-4 sm:p-5">
                            <SectionHeader title="Where customers found you" subtitle="Top channels by leads & revenue won" className="mb-4" />
                            <HorizontalBars data={sourceAttributionBars} valueFormat={(n) => `${fmtNum(n)}`} />
                        </Card>
                    </div>
                </div>

                {/* AI Insights Synthesis Report (Simulated) */}
                {reportData && !isGenerating && (
                    <div className="flex flex-col gap-6 w-full">
                        <div className="border-t border-slate-200/70 dark:border-slate-800/70 pt-2" />

                        <ActivityInsights blocks={reportData.peak_activity_blocks} />

                        {/* Trends + advice */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            <Card className="lg:col-span-7 p-4 sm:p-5">
                                <SectionHeader title="Top customer trends" subtitle="What people ask about most" icon="trending_up" className="mb-3" />
                                {reportData.top_trends?.length > 0 ? (
                                    <ol className="flex flex-col">
                                        {reportData.top_trends.map((trend: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/50 text-[11px] font-bold tabular-nums text-blue-600 dark:text-blue-400">{idx + 1}</span>
                                                <p className="text-[13.5px] text-slate-700 dark:text-slate-300 leading-snug">{trend}</p>
                                            </li>
                                        ))}
                                    </ol>
                                ) : (
                                    <EmptyState icon="lightbulb" title="No trends available yet" />
                                )}
                            </Card>

                            <Card className="lg:col-span-5 p-5 bg-gradient-to-br from-blue-50/70 to-blue-50/50 dark:from-blue-950/30 dark:to-blue-950/20 border-blue-100 dark:border-blue-900/40">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-[18px] text-blue-500">auto_awesome</span>
                                    <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">Recommended action</h3>
                                </div>
                                <p className="text-[13.5px] text-slate-700 dark:text-slate-300 leading-relaxed">
                                    {reportData.actionable_advice || 'Keep monitoring your analytics.'}
                                </p>
                            </Card>
                        </div>

                        {/* Recent activity */}
                        <Card className="overflow-hidden">
                            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                                <SectionHeader title="Recent activity" subtitle="The latest questions your assistant handled" icon="history" />
                            </div>
                            <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                                <div className="col-span-8 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">User query</div>
                                <div className="col-span-2 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-center">Status</div>
                                <div className="col-span-2 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-right">Time</div>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {reportData.recent_conversations?.length > 0 ? (
                                    reportData.recent_conversations.map((log: any, idx: number) => (
                                        <div key={idx} className="flex flex-col md:grid md:grid-cols-12 gap-1.5 md:gap-4 px-5 py-3 md:items-center hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                            <div className="col-span-8 text-[13.5px] text-slate-700 dark:text-slate-300 md:truncate break-words">{log.query}</div>
                                            <div className="col-span-2 flex md:justify-center">
                                                <Badge tone={log.unanswered ? 'alert' : 'ok'}>{log.unanswered ? 'Unanswered' : 'Handled'}</Badge>
                                            </div>
                                            <div className="col-span-2 flex md:justify-end">
                                                <span className="text-[12px] tabular-nums text-slate-500 dark:text-slate-400">
                                                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <EmptyState icon="history" title="No recent activity found" />
                                )}
                            </div>
                        </Card>
                    </div>
                )}

                {/* Empty State before generating */}
                {!reportData && !isGenerating && (
                    <Card>
                        <EmptyState icon="auto_awesome" title="Generate your AI insights" hint='Click "Generate insights" above to synthesize trends, gaps and recommendations from your chat logs.' />
                    </Card>
                )}

                {/* Generator loading spinner */}
                {isGenerating && (
                    <Card>
                        <div className="flex flex-col items-center gap-3 py-10">
                            <span className="h-7 w-7 border-2 border-slate-200 dark:border-slate-700 border-t-blue-500 animate-spin rounded-full motion-reduce:animate-none" />
                            <p className="text-[13.5px] text-slate-500 dark:text-slate-400">Analyzing your chat logs — this takes 5–10 seconds.</p>
                        </div>
                    </Card>
                )}
            </div>
        );
    };

    if (!mounted) return null;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full w-full min-w-0 bg-[#f8f9fa] dark:bg-slate-950 overflow-hidden transition-colors duration-500">
            {renderHeader()}

            <div className="flex-1 w-full min-w-0 overflow-y-auto custom-scrollbar flex flex-col p-4 md:p-6 lg:p-8">
                {activeTab === 'sales' && renderSalesAndLeadsTab()}
                {activeTab === 'conversations' && renderConversationsTab()}
                {activeTab === 'funnel' && renderFunnelTab()}
            </div>

            {/* Email Draft Modal Overlay */}
            <AnimatePresence>
                {emailDraftLead && (() => {
                    const toStr = encodeURIComponent(emailDraftLead.email);
                    const ccStr = encodeURIComponent(draftCc);
                    const subStr = encodeURIComponent(draftSubject);
                    const bodyStr = encodeURIComponent(draftBody);
                    const authUserStr = encodeURIComponent('demo-agent@example.com');
                    const mailto = `mailto:${emailDraftLead.email}?cc=${ccStr}&subject=${subStr}&body=${bodyStr}`;
                    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${toStr}&cc=${ccStr}&su=${subStr}&body=${bodyStr}&authuser=${authUserStr}`;
                    const outlookUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${toStr}&cc=${ccStr}&subject=${subStr}&body=${bodyStr}`;
                    const yahooUrl = `https://compose.mail.yahoo.com/?to=${toStr}&cc=${ccStr}&subject=${subStr}&body=${bodyStr}`;

                    return (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Compose follow-up email"
                        >
                            <motion.div
                                initial={{ scale: 0.95, y: 10 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.95, y: 10 }}
                                className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] max-h-[800px]"
                            >
                                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px] text-blue-500">auto_awesome</span>
                                        <span className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">AI-drafted follow-up</span>
                                    </div>
                                    <button onClick={() => setEmailDraftLead(null)} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                        <span className="material-symbols-outlined text-[20px]">close</span>
                                    </button>
                                </div>

                                <div className="flex flex-col flex-1 overflow-hidden">
                                    <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 py-3">
                                        <span className="text-slate-400 text-[13px] w-16">From</span>
                                        <div className="flex-1 text-[14px] text-slate-500 dark:text-slate-400 truncate">demo-agent@example.com</div>
                                    </div>
                                    <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 py-3">
                                        <span className="text-slate-400 text-[13px] w-16">To</span>
                                        <div className="flex-1 text-[14px] font-medium text-slate-800 dark:text-slate-200 truncate">{emailDraftLead.name ? `${emailDraftLead.name} <${emailDraftLead.email}>` : emailDraftLead.email}</div>
                                    </div>
                                    <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 py-3">
                                        <span className="text-slate-400 text-[13px] w-16">Cc</span>
                                        <input value={draftCc} onChange={(e) => setDraftCc(e.target.value)} placeholder="Add Cc…" className="flex-1 bg-transparent text-[14px] text-slate-800 dark:text-slate-200 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600" />
                                    </div>
                                    <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 py-3">
                                        <span className="text-slate-400 text-[13px] w-16">Subject</span>
                                        <input value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} placeholder="Email subject…" className="flex-1 bg-transparent text-[14px] font-semibold text-slate-900 dark:text-slate-100 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600" />
                                    </div>
                                    <div className="flex-1 p-6 overflow-hidden">
                                        <textarea value={draftBody} onChange={(e) => setDraftBody(e.target.value)} placeholder="Write your email here…" className="w-full h-full bg-transparent text-[14.5px] leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none resize-none custom-scrollbar" />
                                    </div>
                                </div>

                                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-900">
                                    <button type="button" onClick={() => handleCopyEmailDraft(`${draftSubject}\n\n${draftBody}`)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-[13px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        <span className="material-symbols-outlined text-[16px]">content_copy</span>{copied ? 'Copied!' : 'Copy draft'}
                                    </button>
                                    <div className="relative">
                                        <button type="button" onClick={() => setShowEmailProviders((p) => !p)} aria-expanded={showEmailProviders} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-5 py-2 text-[13px] font-semibold text-white transition-colors">
                                            <span className="material-symbols-outlined text-[16px]">send</span>Send via…
                                            <span className="material-symbols-outlined text-[16px]">{showEmailProviders ? 'expand_more' : 'expand_less'}</span>
                                        </button>
                                        {showEmailProviders && (
                                            <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden z-10 flex flex-col py-1">
                                                {[{ href: gmailUrl, icon: 'mail', label: 'Gmail' }, { href: outlookUrl, icon: 'forward_to_inbox', label: 'Outlook' }, { href: yahooUrl, icon: 'email', label: 'Yahoo Mail' }].map((p) => (
                                                    <a key={p.label} href={p.href} target="_blank" rel="noopener noreferrer" onClick={() => setEmailDraftLead(null)} className="px-4 py-2 text-[13px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 transition-colors">
                                                        <span className="material-symbols-outlined text-[16px]">{p.icon}</span>{p.label}
                                                    </a>
                                                ))}
                                                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />
                                                <a href={mailto} onClick={() => setEmailDraftLead(null)} className="px-4 py-2 text-[13px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 transition-colors">
                                                    <span className="material-symbols-outlined text-[16px]">devices</span>Default mail app
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    );
                })()}
            </AnimatePresence>
        </motion.div>
    );
}

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { getBotConfig } from '@/src/lib/demo/demoStorage';

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';

// ── Mock Data Builders ───────────────────────────────────────────────────────

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
        roi_metrics: {
            support_savings: '$312.50',
            potential_revenue: '$1,250.00',
        },
        top_trends: [
            'Users frequently ask about product pricing and available tiers.',
            'Questions about integration and setup process are common.',
            'Support inquiries focus on account management and billing.',
            'Feature requests appear regularly in conversations.',
        ],
        high_value_gaps: [
            'What is your refund policy?',
            'Do you offer a free trial?',
            'Can I export my data?',
        ],
        actionable_advice: `Train ${botName} on more detailed FAQs to reduce unanswered queries. Focus on pricing tiers, refund policies, and free trial availability to convert more visitors into leads.`,
        peak_activity_blocks: buildCalendarData(),
        recent_conversations: [
            { query: 'What are the pricing plans?', unanswered: false, timestamp: new Date(Date.now() - 3_600_000).toISOString() },
            { query: 'Do you offer a free trial?', unanswered: true, timestamp: new Date(Date.now() - 7_200_000).toISOString() },
            { query: 'How do I integrate the widget?', unanswered: false, timestamp: new Date(Date.now() - 10_800_000).toISOString() },
            { query: 'What is your refund policy?', unanswered: true, timestamp: new Date(Date.now() - 14_400_000).toISOString() },
            { query: 'Can I customize the bot appearance?', unanswered: false, timestamp: new Date(Date.now() - 18_000_000).toISOString() },
        ],
    };
}

// ── Activity Calendar ────────────────────────────────────────────────────────

const ActivityCalendar = ({ data }: { data: any[] }) => {
    const [selectedCell, setSelectedCell] = React.useState<any>(null);

    const generateLast30Days = () => {
        const days = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
        }
        return days;
    };

    const calendarDates = generateLast30Days();

    const dataMap: Record<string, any> = {};
    let maxCount = 0;
    if (data && data.length > 0) {
        data.forEach(d => {
            if (d.date) {
                dataMap[d.date] = d;
                if (d.total_questions > maxCount) maxCount = d.total_questions;
            }
        });
    }

    React.useEffect(() => {
        if (data && data.length > 0 && !selectedCell) {
            const todayStr = new Date().toISOString().split('T')[0];
            if (dataMap[todayStr]) {
                setSelectedCell(dataMap[todayStr]);
            } else {
                setSelectedCell(data[data.length - 1]);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    const formatDateStr = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8 w-full p-1">
            {/* Calendar Grid */}
            <div className="w-full lg:w-1/2 flex flex-col gap-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-google uppercase tracking-widest font-bold text-slate-500">Activity Overview</span>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                            <div className="w-2 h-2 rounded-full border border-slate-200" /> IDLE
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                            <div className="w-2 h-2 rounded-full bg-blue-500/50" /> ACTIVE
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-7 gap-1.5 md:gap-3 w-full max-w-full overflow-hidden p-2.5">
                    {calendarDates.map((dateStr) => {
                        const cellData = dataMap[dateStr];
                        const count = cellData?.total_questions || 0;
                        const opacity = maxCount > 0 ? (count / maxCount) : 0;
                        const isSelected = selectedCell?.date === dateStr;

                        return (
                            <div
                                key={dateStr}
                                onClick={() => setSelectedCell(cellData || { date: dateStr, count: 0 })}
                                onMouseEnter={() => setSelectedCell(cellData || { date: dateStr, count: 0 })}
                                className={`aspect-[3/4] sm:aspect-square w-full min-w-[24px] rounded-md cursor-pointer transition-all duration-200 border relative flex flex-col items-center justify-center gap-0.5 sm:gap-1 ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 z-10 scale-105' : 'hover:scale-105 z-0'}`}
                                style={{
                                    backgroundColor: count > 0 ? `rgba(59, 130, 246, ${Math.max(0.15, opacity)})` : 'transparent',
                                    borderColor: count === 0 ? 'rgba(148, 163, 184, 0.15)' : 'rgba(59, 130, 246, 0.4)',
                                }}
                            >
                                <span className={`text-[11px] sm:text-[14px] leading-none font-mono font-bold ${count > 0 ? 'text-blue-700 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'}`}>
                                    {new Date(dateStr).getDate()}
                                </span>
                                <span className={`text-[7px] sm:text-[9px] uppercase tracking-widest font-google font-bold leading-none ${count > 0 ? 'text-blue-600/70 dark:text-blue-300/70' : 'text-slate-300 dark:text-slate-600'}`}>
                                    {new Date(dateStr).toLocaleDateString(undefined, { month: 'short' })}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Inspector Panel */}
            <div className="w-full lg:w-1/2 flex flex-col">
                {selectedCell ? (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={selectedCell.date}
                        className="flex flex-col bg-slate-50 dark:bg-slate-900 border border-blue-200 dark:border-blue-900/40 p-6 rounded-lg shadow-sm flex-1 ring-1 ring-blue-500/5"
                    >
                        <div className="flex flex-col gap-1 mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
                            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-blue-500 dark:text-blue-400 font-google">Daily Inspector</span>
                            <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-google">
                                {formatDateStr(selectedCell.date)}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="flex flex-col p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-sm">
                                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold font-google">Total Activity</span>
                                <span className="text-2xl font-bold font-google text-slate-900 dark:text-slate-100 mt-1">{selectedCell.total_questions || 0}</span>
                            </div>
                            <div className="flex flex-col p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-sm">
                                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold font-google">Unique Users</span>
                                <span className="text-2xl font-bold font-google text-blue-600 dark:text-blue-400 mt-1">{selectedCell.interacted_users || 0}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-2">
                                <span className="text-xs font-google text-slate-500 dark:text-slate-400">Answered Correct</span>
                                <span className="text-sm font-bold text-green-600 dark:text-green-500">{selectedCell.answered_questions || 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-2">
                                <span className="text-xs font-google text-slate-500 dark:text-slate-400">Failed Response</span>
                                <span className={`text-sm font-bold ${selectedCell.unanswered_questions > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                    {selectedCell.unanswered_questions || 0}
                                </span>
                            </div>
                        </div>

                        <div className="mt-8 flex-1 flex flex-col gap-5">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-google mb-3 flex items-center gap-2">
                                    <span className="w-1 h-3 bg-blue-500 rounded-full" />
                                    Top Questions
                                </span>
                                {selectedCell.top_questions?.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedCell.top_questions.map((q: string, qIdx: number) => (
                                            <p key={qIdx} className="text-xs font-google text-slate-600 dark:text-slate-400 leading-relaxed italic bg-white dark:bg-slate-800/50 p-2 rounded-sm border border-slate-100 dark:border-slate-800">
                                                &ldquo;{q}&rdquo;
                                            </p>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-xs font-google text-slate-400 italic">No activity recorded</span>
                                )}
                            </div>

                            {selectedCell.unanswered_questions > 0 && selectedCell.top_unanswered?.length > 0 && (
                                <div className="flex flex-col border-t border-red-500/10 pt-5">
                                    <span className="text-[10px] uppercase tracking-widest text-red-400 font-bold font-google mb-3 flex items-center gap-2">
                                        <span className="w-1 h-3 bg-red-500 rounded-full" />
                                        Unanswered Queries
                                    </span>
                                    <div className="space-y-2">
                                        {selectedCell.top_unanswered.map((q: string, qIdx: number) => (
                                            <p key={qIdx} className="text-xs font-google text-red-500/80 leading-relaxed border-l-2 border-red-500/30 pl-3">
                                                &ldquo;{q}&rdquo;
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <div className="flex flex-col bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 p-8 rounded-lg items-center justify-center h-full">
                        <span className="material-symbols-outlined text-[32px] text-slate-300 dark:text-slate-600 mb-2">radar</span>
                        <p className="text-xs font-google text-slate-400 uppercase tracking-widest font-bold text-center">Select a day<br />to inspect activity</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Demo Leads Panel ─────────────────────────────────────────────────────────

const DemoLeadsPanel = () => {
    const leads = [
        { id: '1', name: 'Sarah Johnson', email: 'sarah@example.com', phone: '+1 555-0101', source: 'Chat Widget', created_at: new Date(Date.now() - 3_600_000).toISOString() },
        { id: '2', name: 'Marcus Chen', email: 'marcus@techcorp.io', phone: '+1 555-0142', source: 'Chat Widget', created_at: new Date(Date.now() - 86_400_000).toISOString() },
        { id: '3', name: 'Priya Patel', email: 'priya@startup.co', phone: null, source: 'Chat Widget', created_at: new Date(Date.now() - 172_800_000).toISOString() },
    ];

    return (
        <div className={`${cellCls} flex-1 p-4 sm:p-8`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">person_add</span>
                        <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Leads CRM</h2>
                    </div>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400">{leads.length} leads captured (Demo)</p>
                </div>
                <button
                    disabled
                    className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 dark:bg-blue-600 text-white text-[10px] uppercase tracking-widest font-bold opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-[14px]">download</span>
                    Export CSV
                </button>
            </div>

            {/* Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 pb-3 border-b border-gray-100 dark:border-slate-800 mb-3 px-4">
                <div className="col-span-3 text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google">Name</div>
                <div className="col-span-4 text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google">Email</div>
                <div className="col-span-3 text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google">Phone</div>
                <div className="col-span-2 text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google text-right">Captured</div>
            </div>
            <div className="space-y-3 md:space-y-1">
                {leads.map(lead => (
                    <div key={lead.id} className="flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 py-4 md:py-3 px-4 bg-slate-50 md:bg-transparent dark:bg-slate-900/50 md:dark:bg-transparent rounded-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors md:items-center">
                        <div className="col-span-3 text-sm font-google font-medium text-slate-700 dark:text-slate-300">{lead.name}</div>
                        <div className="col-span-4 text-sm font-google text-slate-500 dark:text-slate-400 truncate">{lead.email}</div>
                        <div className="col-span-3 text-sm font-google text-slate-500 dark:text-slate-400">{lead.phone || '—'}</div>
                        <div className="col-span-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 md:text-right">
                            {new Date(lead.created_at).toLocaleDateString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── Demo Conversations Panel ─────────────────────────────────────────────────

const DemoConversationsPanel = () => {
    const [filter, setFilter] = React.useState('all');
    const [expandedSession, setExpandedSession] = React.useState<string | null>(null);

    const sessions = [
        {
            session_id: 's1',
            started_at: new Date(Date.now() - 3_600_000).toISOString(),
            message_count: 6,
            has_unanswered: false,
            messages: [
                { role: 'user', content: 'What are the pricing plans?' },
                { role: 'assistant', content: 'We offer Starter, Pro, and Enterprise plans starting at $29/month.' },
                { role: 'user', content: 'Can I upgrade anytime?' },
                { role: 'assistant', content: 'Yes, you can upgrade or downgrade your plan at any time from your account settings.' },
            ],
        },
        {
            session_id: 's2',
            started_at: new Date(Date.now() - 86_400_000).toISOString(),
            message_count: 4,
            has_unanswered: true,
            messages: [
                { role: 'user', content: 'Do you offer a free trial?' },
                { role: 'assistant', content: "I'm sorry, I don't have information about free trials at the moment." },
                { role: 'user', content: 'What is your refund policy?' },
                { role: 'assistant', content: "I'm sorry, I don't have details on the refund policy." },
            ],
        },
        {
            session_id: 's3',
            started_at: new Date(Date.now() - 172_800_000).toISOString(),
            message_count: 5,
            has_unanswered: false,
            messages: [
                { role: 'user', content: 'How do I integrate the widget on my website?' },
                { role: 'assistant', content: 'You can integrate the widget by adding a single script tag to your HTML. We provide step-by-step documentation.' },
            ],
        },
    ];

    const filtered = filter === 'unanswered' ? sessions.filter(s => s.has_unanswered) : sessions;

    return (
        <div className={`${cellCls} flex-1 p-4 sm:p-8`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">forum</span>
                    <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Conversations</h2>
                </div>
                <div className="flex gap-2">
                    {['all', 'unanswered'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-1.5 text-[10px] uppercase tracking-widest font-bold transition-colors ${filter === f ? 'bg-slate-900 dark:bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                {filtered.map(session => (
                    <div key={session.session_id} className="border border-gray-100 dark:border-slate-800 rounded-sm overflow-hidden">
                        <div
                            className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                            onClick={() => setExpandedSession(expandedSession === session.session_id ? null : session.session_id)}
                        >
                            <div className="flex items-center gap-3 flex-1">
                                <span className="material-symbols-outlined text-[18px] text-slate-400">chat_bubble_outline</span>
                                <div>
                                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400">Session #{session.session_id}</p>
                                    <p className="text-[10px] font-google text-slate-400 dark:text-slate-500">{new Date(session.started_at).toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-google text-slate-400">{session.message_count} messages</span>
                                {session.has_unanswered ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-900/50 px-2 py-0.5 rounded-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Unanswered
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-900/50 px-2 py-0.5 rounded-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Handled
                                    </span>
                                )}
                                <span className={`material-symbols-outlined text-[16px] text-slate-400 transition-transform ${expandedSession === session.session_id ? 'rotate-180' : ''}`}>expand_more</span>
                            </div>
                        </div>
                        {expandedSession === session.session_id && (
                            <div className="border-t border-gray-100 dark:border-slate-800 p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                                {session.messages.map((msg, idx) => (
                                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] px-4 py-2.5 rounded-sm text-sm font-google leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700'}`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── Demo ROI Panel ───────────────────────────────────────────────────────────

const DemoROIPanel = ({ botName }: { botName: string }) => {
    const [costPerTicket, setCostPerTicket] = React.useState('5.00');
    const [leadValue, setLeadValue] = React.useState('50.00');

    const totalQuestions = 71;
    const totalLeads = 3;
    const answeredQuestions = 58;

    const supportSavings = answeredQuestions * parseFloat(costPerTicket || '0');
    const revenuePotential = totalLeads * parseFloat(leadValue || '0');
    const hoursSaved = Math.floor(supportSavings / 25);

    const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className={`${cellCls} flex-1 p-4 sm:p-8`}>
            <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-[18px] text-green-600 dark:text-green-500">savings</span>
                <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">ROI Calculator</h2>
            </div>

            {/* Benchmark Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-sm">
                <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google block mb-1.5">Avg. Cost Per Ticket ($)</label>
                    <input
                        type="number"
                        value={costPerTicket}
                        onChange={e => setCostPerTicket(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google block mb-1.5">Avg. Lead Value ($)</label>
                    <input
                        type="number"
                        value={leadValue}
                        onChange={e => setLeadValue(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* ROI Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-white dark:bg-slate-800 mb-8">
                <div className={`${cellCls} p-4 sm:p-8 flex flex-col justify-center border border-gray-100 dark:border-slate-800`}>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 pt-0.5">timer</span>
                        <h3 className="text-md uppercase font-bold tracking-widest text-slate-600 dark:text-slate-400 font-google">Support Hours Saved</h3>
                    </div>
                    <div className="flex items-end gap-1">
                        <span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{hoursSaved}</span>
                        <span className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-2 ml-1">hours</span>
                    </div>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Based on estimated handled query resolution time.</p>
                </div>
                <div className={`${cellCls} p-4 sm:p-8 flex flex-col justify-center border border-gray-100 dark:border-slate-800`}>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-[18px] text-green-600 dark:text-green-500 pt-0.5">savings</span>
                        <h3 className="text-md uppercase font-bold tracking-widest text-slate-600 dark:text-slate-400 font-google">Estimated Savings</h3>
                    </div>
                    <div className="flex items-end gap-1">
                        <span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{fmt(supportSavings)}</span>
                    </div>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Cost avoided against standard human agent hourly rates.</p>
                </div>
                <div className={`${cellCls} p-4 sm:p-8 flex flex-col justify-center border border-gray-100 dark:border-slate-800`}>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-500 pt-0.5">leaderboard</span>
                        <h3 className="text-md uppercase font-bold tracking-widest text-slate-600 dark:text-slate-400 font-google">Potential Revenue</h3>
                    </div>
                    <div className="flex items-end gap-1">
                        <span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{fmt(revenuePotential)}</span>
                        <span className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-2 ml-1">est. value</span>
                    </div>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Calculated from the leads captured by the AI.</p>
                </div>
            </div>

            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google text-center">
                Demo data for {botName} — connect your bot to see real metrics
            </p>
        </div>
    );
};

// ── Main Page ────────────────────────────────────────────────────────────────

export default function DemoInsightsPage() {
    const [botConfig, setBotConfig] = React.useState<any>(getBotConfig());
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setBotConfig(getBotConfig());
        setMounted(true);
    }, []);

    const reportData = buildDemoReport(botConfig.name);
    const [activeTab, setActiveTab] = React.useState('analytics');

    const renderHeader = () => (
        <div className="bg-white dark:bg-slate-950 px-4 py-4 sm:px-8 sm:py-6 shrink-0 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400 transition-colors">
                            insights
                        </span>
                        <h1 className="text-xl md:text-2xl font-google font-black tracking-tight leading-none text-slate-900 dark:text-slate-200 transition-colors">
                            Sapybase Insights
                        </h1>
                    </div>
                    <p className="text-md font-google text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        AI-synthesized business intelligence from your chat logs. Reports refresh every 24 hours.
                    </p>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google mt-1.5 transition-colors">
                        Demo Mode — sample data only
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="mt-6 -mx-4 sm:mx-0 overflow-x-auto">
                <div className="flex items-center gap-4 sm:gap-6 border-b border-gray-100 dark:border-slate-800 px-4 sm:px-0 min-w-max sm:min-w-0">
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`pb-3 text-sm font-google tracking-widest uppercase font-bold transition-all border-b-2 ${activeTab === 'analytics' ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Analytics Report
                    </button>
                    <button
                        onClick={() => setActiveTab('leads')}
                        className={`pb-3 text-sm font-google tracking-widest uppercase font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'leads' ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Leads CRM
                    </button>
                    <button
                        onClick={() => setActiveTab('conversations')}
                        className={`pb-3 text-sm font-google tracking-widest uppercase font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'conversations' ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Conversations
                    </button>
                    <button
                        onClick={() => setActiveTab('roi')}
                        className={`pb-3 text-sm font-google tracking-widest uppercase font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'roi' ? 'border-green-600 text-green-600 dark:text-green-400 dark:border-green-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <span className="material-symbols-outlined text-[14px]">savings</span>
                        ROI
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden transition-colors duration-500"
        >
            {renderHeader()}

            <div className="flex-1 overflow-auto custom-scrollbar flex flex-col">

                {activeTab === 'leads' && <DemoLeadsPanel />}

                {activeTab === 'conversations' && <DemoConversationsPanel />}

                {activeTab === 'roi' && <DemoROIPanel botName={botConfig.name} />}

                {activeTab === 'analytics' && (
                    <div className="flex flex-col gap-px bg-white dark:bg-slate-800 flex-1">

                        {/* ── ROI Scorecards ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-white dark:bg-slate-800">
                            <div className={`${cellCls} p-4 sm:p-8 flex flex-col justify-center`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 pt-0.5">timer</span>
                                    <h3 className="text-md uppercase font-bold tracking-widest text-slate-600 dark:text-slate-400 font-google">Support Hours Saved</h3>
                                </div>
                                <div className="flex items-end gap-1">
                                    <span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">12</span>
                                    <span className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-2 ml-1">hours</span>
                                </div>
                                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Based on estimated handled query resolution time.</p>
                            </div>
                            <div className={`${cellCls} p-4 sm:p-8 flex flex-col justify-center`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-outlined text-[18px] text-green-600 dark:text-green-500 pt-0.5">savings</span>
                                    <h3 className="text-md uppercase font-bold tracking-widest text-slate-600 dark:text-slate-400 font-google">Estimated Savings</h3>
                                </div>
                                <div className="flex items-end gap-1">
                                    <span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{reportData.roi_metrics.support_savings}</span>
                                </div>
                                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Cost avoided against standard human agent hourly rates.</p>
                            </div>
                            <div className={`${cellCls} p-4 sm:p-8 flex flex-col justify-center`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-500 pt-0.5">leaderboard</span>
                                    <h3 className="text-md uppercase font-bold tracking-widest text-slate-600 dark:text-slate-400 font-google">Potential Revenue</h3>
                                </div>
                                <div className="flex items-end gap-1">
                                    <span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{reportData.roi_metrics.potential_revenue}</span>
                                    <span className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-2 ml-1">est. value</span>
                                </div>
                                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Calculated from the leads captured by the AI.</p>
                            </div>
                        </div>

                        {/* ── Trends & Gaps ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-white dark:bg-slate-800 overflow-visible transition-colors duration-500 flex-1">
                            {/* Left: Top Trends */}
                            <div className="lg:col-span-7 flex flex-col gap-px bg-white dark:bg-slate-800 transition-colors duration-500">
                                <div className={`${cellCls} p-4 sm:p-8 flex-1`}>
                                    <div className="flex items-center gap-2 mb-6">
                                        <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">trending_up</span>
                                        <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">
                                            Top Customer Trends
                                        </h2>
                                    </div>
                                    <p className="text-md font-google text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                                        The most common subjects and questions your users are asking.
                                    </p>
                                    <div className="space-y-px bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800">
                                        {reportData.top_trends.map((trend, idx) => (
                                            <div key={idx} className={`${cellCls} flex items-start gap-4 p-5`}>
                                                <div className="w-8 h-8 shrink-0 bg-white dark:bg-slate-800 flex items-center justify-center text-xs font-bold font-mono text-slate-500 dark:text-slate-400">
                                                    {String(idx + 1).padStart(2, '0')}
                                                </div>
                                                <p className="text-sm font-google text-slate-700 dark:text-slate-300 leading-relaxed pt-1.5">
                                                    {trend}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Gaps + Advice */}
                            <div className="lg:col-span-5 flex flex-col gap-px bg-white dark:bg-slate-800 transition-colors duration-500">
                                <div className={`${cellCls} p-4 sm:p-8 flex-1`}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="material-symbols-outlined text-[18px] text-amber-500 dark:text-amber-400">warning</span>
                                        <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">
                                            High Value Gaps
                                        </h2>
                                    </div>
                                    <p className="text-md font-google text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
                                        Questions your bot failed to answer. Train these topics to secure leads.
                                    </p>
                                    <div className="space-y-2 mb-4 overflow-y-auto max-h-[160px] custom-scrollbar pr-1">
                                        {reportData.high_value_gaps.map((gap, idx) => (
                                            <div key={idx} className="flex items-start gap-3 p-4 bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                                                <span className="material-symbols-outlined text-[16px] text-amber-500 dark:text-amber-400 shrink-0 mt-0.5">help_center</span>
                                                <p className="text-sm font-google text-slate-700 dark:text-slate-300 leading-relaxed flex-1">&ldquo;{gap}&rdquo;</p>
                                                <Link href="/demo/train" className="shrink-0 text-[10px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 flex items-center transition-colors">Fix <span className="material-symbols-outlined text-[12px] ml-1">build</span></Link>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">lightbulb</span>
                                        <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Actionable Advice</h2>
                                    </div>
                                    <p className="text-sm font-google text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {reportData.actionable_advice}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── Peak Activity ── */}
                        <div className="flex flex-col gap-px bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-800">
                            <div className={`${cellCls} p-4 sm:p-8`}>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[18px] text-blue-500 dark:text-blue-400">calendar_month</span>
                                    <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">30-Day Peak Activity</h2>
                                </div>
                                <div className="w-full">
                                    <ActivityCalendar data={reportData.peak_activity_blocks} />
                                </div>
                            </div>
                        </div>

                        {/* ── Recent Activity Log ── */}
                        <div className="flex flex-col gap-px bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-800">
                            <div className={`${cellCls} p-4 sm:p-8 overflow-x-auto`}>
                                <div className="flex items-center gap-2 mb-6">
                                    <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 pt-0.5">history</span>
                                    <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Recent Activity Log</h2>
                                </div>
                                <div className="w-full">
                                    <div className="hidden md:grid grid-cols-12 gap-4 pb-3 border-b border-gray-100 dark:border-slate-800 mb-3 px-4">
                                        <div className="col-span-8 text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google">User Query</div>
                                        <div className="col-span-2 text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google text-center">Status</div>
                                        <div className="col-span-2 text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google text-right">Time</div>
                                    </div>
                                    <div className="space-y-3 md:space-y-1">
                                        {reportData.recent_conversations.map((log, idx) => (
                                            <div key={idx} className="flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 py-4 md:py-3 px-4 bg-slate-50 md:bg-transparent dark:bg-slate-900/50 md:dark:bg-transparent rounded-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors md:items-center">
                                                <div className="col-span-8 text-sm font-google font-medium text-slate-700 dark:text-slate-300 md:truncate">
                                                    {log.query}
                                                </div>
                                                <div className="col-span-2 flex items-center md:justify-center gap-3 md:gap-0 mt-2 md:mt-0">
                                                    <span className="md:hidden text-[10px] uppercase font-bold text-slate-400 font-google tracking-widest">Status:</span>
                                                    {log.unanswered ? (
                                                        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-900/50 px-2 py-0.5 rounded-sm">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-[-1px]" /> Unanswered
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-900/50 px-2 py-0.5 rounded-sm">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-[-1px]" /> Handled
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="col-span-2 flex items-center md:justify-end gap-3 md:gap-0 mt-1 md:mt-0">
                                                    <span className="md:hidden text-[10px] uppercase font-bold text-slate-400 font-google tracking-widest">Time:</span>
                                                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </motion.div>
    );
}

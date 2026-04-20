import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { getBotConfig, getKnowledge } from './demoStorage';

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';

// ── Static demo data that exactly mirrors the real report shape ───────────────
function buildDemoReport(botName, chunksUsed) {
    return {
        roi_metrics: {
            support_savings: '$0.00',
            potential_revenue: '$0.00',
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
        ],
        actionable_advice: `Train your bot on more detailed FAQs to reduce unanswered queries. Upload a pricing document and support guide to improve answer accuracy for ${botName}.`,
        peak_activity_blocks: buildCalendarData(),
        recent_conversations: buildRecentConversations(),
    };
}

function buildCalendarData() {
    const today = new Date();
    return Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (29 - i));
        const dateStr = d.toISOString().split('T')[0];
        const q = i % 4 === 0 ? Math.floor(Math.random() * 8) + 1 : 0;
        return {
            date: dateStr,
            total_questions: q,
            interacted_users: q > 0 ? Math.ceil(q * 0.7) : 0,
            answered_questions: q > 0 ? Math.ceil(q * 0.8) : 0,
            unanswered_questions: q > 0 ? Math.floor(q * 0.2) : 0,
            top_questions: q > 0 ? ['What are the pricing plans?', 'How do I integrate the bot?'].slice(0, Math.min(q, 2)) : [],
            top_unanswered: q > 0 && Math.floor(q * 0.2) > 0 ? ['Do you offer a free trial?'] : [],
        };
    });
}

function buildRecentConversations() {
    return [
        { query: 'What are the pricing plans?', unanswered: false, timestamp: new Date(Date.now() - 3600000).toISOString() },
        { query: 'How do I embed the chatbot on my site?', unanswered: false, timestamp: new Date(Date.now() - 7200000).toISOString() },
        { query: 'Do you offer a free trial?', unanswered: true, timestamp: new Date(Date.now() - 10800000).toISOString() },
        { query: 'Can I customize the bot appearance?', unanswered: false, timestamp: new Date(Date.now() - 14400000).toISOString() },
        { query: 'What is your refund policy?', unanswered: true, timestamp: new Date(Date.now() - 18000000).toISOString() },
    ];
}

// ── Activity Calendar (exact copy of real component) ─────────────────────────
const ActivityCalendar = ({ data }) => {
    const [selectedCell, setSelectedCell] = useState(null);

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
    const dataMap = {};
    let maxCount = 0;
    data?.forEach(d => {
        if (d.date) { dataMap[d.date] = d; if (d.total_questions > maxCount) maxCount = d.total_questions; }
    });

    useEffect(() => {
        if (data?.length > 0 && !selectedCell) {
            const todayStr = new Date().toISOString().split('T')[0];
            setSelectedCell(dataMap[todayStr] || data[0]);
        }
    }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

    const formatDateStr = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8 w-full p-1">
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
                <div className="grid grid-cols-7 gap-1.5 md:gap-3 w-full p-2.5">
                    {calendarDates.map((dateStr) => {
                        const cellData = dataMap[dateStr];
                        const count = cellData?.total_questions || 0;
                        const opacity = maxCount > 0 ? (count / maxCount) : 0;
                        const isSelected = selectedCell?.date === dateStr;
                        return (
                            <div key={dateStr}
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

            <div className="w-full lg:w-1/2 flex flex-col">
                {selectedCell ? (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} key={selectedCell.date}
                        className="flex flex-col bg-slate-50 dark:bg-slate-900 border border-blue-200 dark:border-blue-900/40 p-6 rounded-lg shadow-sm flex-1 ring-1 ring-blue-500/5">
                        <div className="flex flex-col gap-1 mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
                            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-blue-500 font-google">Daily Inspector</span>
                            <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-google">{formatDateStr(selectedCell.date)}</span>
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
                                <span className={`text-sm font-bold ${(selectedCell.unanswered_questions || 0) > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                    {selectedCell.unanswered_questions || 0}
                                </span>
                            </div>
                        </div>
                        <div className="mt-8 flex-1 flex flex-col gap-5">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-google mb-3 flex items-center gap-2">
                                    <span className="w-1 h-3 bg-blue-500 rounded-full" /> Top Questions
                                </span>
                                {selectedCell.top_questions?.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedCell.top_questions.map((q, qIdx) => (
                                            <p key={qIdx} className="text-xs font-google text-slate-600 dark:text-slate-400 leading-relaxed italic bg-white dark:bg-slate-800/50 p-2 rounded-sm border border-slate-100 dark:border-slate-800">
                                                "{q}"
                                            </p>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-xs font-google text-slate-400 italic">No activity recorded</span>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <div className="flex flex-col bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 p-8 rounded-lg items-center justify-center h-full">
                        <span className="material-symbols-outlined text-[32px] text-slate-300 dark:text-slate-600 mb-2">radar</span>
                        <p className="text-xs font-google text-slate-400 uppercase tracking-widest font-bold text-center">Select a day<br/>to inspect activity</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Demo Leads Panel ───────────────────────────────────────────────────────────
const DemoLeadsPanel = () => (
    <div className="p-4 sm:p-8 flex-1">
        <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">person_add</span>
            <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Leads CRM</h2>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm font-google">
                <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800">
                        {['Name', 'Email', 'Source', 'Captured'].map(h => (
                            <th key={h} className="text-left text-[10px] uppercase tracking-widest font-bold text-slate-400 pb-3 pr-4">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                    {[
                        { name: 'Alex Johnson', email: 'alex@example.com', source: 'Chat Widget', date: '2 hrs ago' },
                        { name: 'Maria Garcia', email: 'maria@acme.co', source: 'Chat Widget', date: '5 hrs ago' },
                        { name: 'Demo User', email: 'demo@test.com', source: 'Landing Page', date: '1 day ago' },
                    ].map((lead, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                            <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-200">{lead.name}</td>
                            <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">{lead.email}</td>
                            <td className="py-3 pr-4">
                                <span className="px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">{lead.source}</span>
                            </td>
                            <td className="py-3 text-slate-400 dark:text-slate-500 text-xs font-mono">{lead.date}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 flex items-start gap-3">
            <span className="material-symbols-outlined text-[18px] text-amber-500 mt-0.5 shrink-0">experiment</span>
            <p className="text-sm font-google text-amber-700 dark:text-amber-300 leading-relaxed">
                Demo data — Sign up to capture real leads from your bot conversations, export to CSV, and connect Zapier webhooks.
            </p>
        </div>
    </div>
);

// ── Demo Conversations Panel ───────────────────────────────────────────────────
const DemoConversationsPanel = ({ conversations }) => (
    <div className={`${cellCls} p-4 sm:p-8 overflow-x-auto flex-1`}>
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
                {conversations.map((log, idx) => (
                    <div key={idx} className="flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 py-4 md:py-3 px-4 bg-slate-50 md:bg-transparent dark:bg-slate-900/50 md:dark:bg-transparent rounded-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors md:items-center">
                        <div className="col-span-8 text-sm font-google font-medium text-slate-700 dark:text-slate-300 md:truncate">{log.query}</div>
                        <div className="col-span-2 flex items-center md:justify-center gap-3 md:gap-0 mt-2 md:mt-0">
                            {log.unanswered ? (
                                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-900/50 px-2 py-0.5 rounded-sm">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Unanswered
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-900/50 px-2 py-0.5 rounded-sm">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Handled
                                </span>
                            )}
                        </div>
                        <div className="col-span-2 flex items-center md:justify-end gap-3 md:gap-0 mt-1 md:mt-0">
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// ── Demo ROI Panel ─────────────────────────────────────────────────────────────
const DemoROIPanel = () => (
    <div className="p-4 sm:p-8 flex-1">
        <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-[18px] text-green-600 dark:text-green-500">savings</span>
            <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">ROI Calculator</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-gray-100 dark:bg-slate-800 mb-6">
            {[
                { label: 'Support Hours Saved', value: '0 hrs', icon: 'timer', color: 'text-slate-600 dark:text-slate-400' },
                { label: 'Estimated Savings', value: '$0.00', icon: 'savings', color: 'text-green-600 dark:text-green-500' },
                { label: 'Potential Revenue', value: '$0.00 est.', icon: 'leaderboard', color: 'text-blue-600 dark:text-blue-500' },
            ].map((s, i) => (
                <div key={i} className={`${cellCls} p-6`}>
                    <div className="flex items-center gap-2 mb-3">
                        <span className={`material-symbols-outlined text-[18px] ${s.color}`}>{s.icon}</span>
                        <h3 className="text-md uppercase font-bold tracking-widest text-slate-600 dark:text-slate-400 font-google">{s.label}</h3>
                    </div>
                    <span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{s.value}</span>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Start chatting to accumulate real metrics.</p>
                </div>
            ))}
        </div>
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 flex items-start gap-3">
            <span className="material-symbols-outlined text-[18px] text-amber-500 mt-0.5 shrink-0">experiment</span>
            <p className="text-sm font-google text-amber-700 dark:text-amber-300 leading-relaxed">
                Demo mode — ROI metrics populate automatically once your bot handles real conversations. Sign up to see live savings.
            </p>
        </div>
    </div>
);

// ── Main DemoInsights ──────────────────────────────────────────────────────────
const DemoInsights = () => {
    const botConfig = getBotConfig();
    const chunksUsed = getKnowledge().length;
    const reportData = buildDemoReport(botConfig.name, chunksUsed);

    const [activeTab, setActiveTab] = useState('analytics');
    const lastGeneratedAt = new Date().toLocaleString();

    const TABS = [
        { id: 'analytics', label: 'Analytics Report' },
        { id: 'leads', label: 'Leads CRM' },
        { id: 'conversations', label: 'Conversations' },
        { id: 'roi', label: 'ROI', icon: 'savings', green: true },
    ];

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col bg-white dark:bg-slate-900 overflow-x-hidden transition-colors duration-500">

            {/* Header */}
            <div className="bg-white dark:bg-slate-950 px-4 py-4 sm:px-8 sm:py-6 shrink-0 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400">insights</span>
                            <h1 className="text-xl md:text-2xl font-google font-black tracking-tight leading-none text-slate-900 dark:text-slate-200">
                                SaPyBase Insights
                            </h1>
                        </div>
                        <p className="text-md font-google text-slate-500 dark:text-slate-400 leading-relaxed">
                            AI-synthesized business intelligence from your chat logs. Reports refresh every 24 hours.
                        </p>
                        {activeTab === 'analytics' && (
                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google mt-1.5">
                                Demo data — generated {lastGeneratedAt}
                            </p>
                        )}
                    </div>
                    {activeTab === 'analytics' && (
                        <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 self-start sm:self-auto">
                            <span className="material-symbols-outlined text-[16px] text-amber-500">experiment</span>
                            <span className="text-[10px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-400 font-sans">Demo Data</span>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="mt-6">
                    <div className="flex items-center gap-4 sm:gap-6 border-b border-gray-100 dark:border-slate-800 overflow-x-auto scrollbar-hide">
                        {TABS.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`pb-3 text-sm font-google tracking-widest uppercase font-bold transition-all border-b-2 flex items-center gap-2 shrink-0 ${
                                    activeTab === tab.id
                                        ? tab.green ? 'border-green-600 text-green-600 dark:text-green-400 dark:border-green-400' : 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}>
                                {tab.icon && <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col">
                {activeTab === 'leads' && <DemoLeadsPanel />}
                {activeTab === 'conversations' && <DemoConversationsPanel conversations={reportData.recent_conversations} />}
                {activeTab === 'roi' && <DemoROIPanel />}

                {activeTab === 'analytics' && (
                    <div className="flex flex-col gap-px bg-white dark:bg-slate-800 flex-1">
                        {/* ROI Scorecards */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-white dark:bg-slate-800">
                            <div className={`${cellCls} p-4 sm:p-8 flex flex-col justify-center`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 pt-0.5">timer</span>
                                    <h3 className="text-md uppercase font-bold tracking-widest text-slate-600 dark:text-slate-400 font-google">Support Hours Saved</h3>
                                </div>
                                <div className="flex items-end gap-1">
                                    <span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">0</span>
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
                                    <span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">$0.00</span>
                                </div>
                                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Cost avoided against standard human agent hourly rates.</p>
                            </div>
                            <div className={`${cellCls} p-4 sm:p-8 flex flex-col justify-center`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-500 pt-0.5">leaderboard</span>
                                    <h3 className="text-md uppercase font-bold tracking-widest text-slate-600 dark:text-slate-400 font-google">Potential Revenue</h3>
                                </div>
                                <div className="flex items-end gap-1">
                                    <span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">$0.00</span>
                                    <span className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-2 ml-1">est. value</span>
                                </div>
                                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Calculated from leads captured by the AI.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-white dark:bg-slate-800 flex-1">
                            {/* Top Trends */}
                            <div className={`lg:col-span-7 flex flex-col gap-px bg-white dark:bg-slate-800`}>
                                <div className={`${cellCls} p-4 sm:p-8 flex-1`}>
                                    <div className="flex items-center gap-2 mb-6">
                                        <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">trending_up</span>
                                        <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Top Customer Trends</h2>
                                    </div>
                                    <p className="text-md font-google text-slate-500 dark:text-slate-400 leading-relaxed mb-6">The most common subjects your users ask about.</p>
                                    <div className="space-y-px bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800">
                                        {reportData.top_trends.map((trend, idx) => (
                                            <div key={idx} className={`${cellCls} flex items-start gap-4 p-5`}>
                                                <div className="w-8 h-8 shrink-0 bg-white dark:bg-slate-800 flex items-center justify-center text-xs font-bold font-mono text-slate-500 dark:text-slate-400">
                                                    {String(idx + 1).padStart(2, '0')}
                                                </div>
                                                <p className="text-sm font-google text-slate-700 dark:text-slate-300 leading-relaxed pt-1.5">{trend}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Knowledge Gaps + Advice */}
                            <div className="lg:col-span-5 flex flex-col gap-px bg-white dark:bg-slate-800">
                                <div className={`${cellCls} p-4 sm:p-8 flex-1`}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="material-symbols-outlined text-[18px] text-amber-500 dark:text-amber-400">warning</span>
                                        <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">High Value Gaps</h2>
                                    </div>
                                    <p className="text-md font-google text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
                                        Questions your bot failed to answer. Train these topics to secure leads.
                                    </p>
                                    <div className="space-y-2 mb-6">
                                        {reportData.high_value_gaps.map((gap, idx) => (
                                            <div key={idx} className="flex items-start gap-3 p-4 bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                                                <span className="material-symbols-outlined text-[16px] text-amber-500 shrink-0 mt-0.5">help_center</span>
                                                <p className="text-sm font-google text-slate-700 dark:text-slate-300 leading-relaxed flex-1">"{gap}"</p>
                                                <Link to="/demo/train" className="shrink-0 text-[10px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-400 hover:text-amber-800 flex items-center transition-colors">
                                                    Fix <span className="material-symbols-outlined text-[12px] ml-1">build</span>
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">lightbulb</span>
                                        <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Actionable Advice</h2>
                                    </div>
                                    <p className="text-sm font-google text-slate-600 dark:text-slate-400 leading-relaxed">{reportData.actionable_advice}</p>
                                </div>
                            </div>
                        </div>

                        {/* 30-Day Activity */}
                        <div className="flex flex-col gap-px bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-800">
                            <div className={`${cellCls} p-4 sm:p-8`}>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[18px] text-blue-500 dark:text-blue-400">calendar_month</span>
                                    <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">30-Day Peak Activity</h2>
                                </div>
                                <ActivityCalendar data={reportData.peak_activity_blocks} />
                            </div>
                        </div>

                        {/* Recent Activity Log */}
                        <div className="border-t border-gray-100 dark:border-slate-800">
                            <DemoConversationsPanel conversations={reportData.recent_conversations} />
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default DemoInsights;

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { getBotConfig, getKnowledge } from '@/src/lib/demo/demoStorage';

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';

function buildDemoReport(botName: string) {
    return {
        roi_metrics: { support_savings: '$0.00', potential_revenue: '$0.00' },
        top_trends: [
            'Users frequently ask about product pricing and available tiers.',
            'Questions about integration and setup process are common.',
            'Support inquiries focus on account management and billing.',
            'Feature requests appear regularly in conversations.',
        ],
        high_value_gaps: ['What is your refund policy?', 'Do you offer a free trial?'],
        actionable_advice: `Train your bot on more detailed FAQs to reduce unanswered queries for ${botName}.`,
        peak_activity_blocks: buildCalendarData(),
        recent_conversations: [
            { query: 'What are the pricing plans?', unanswered: false, timestamp: new Date(Date.now() - 3600000).toISOString() },
            { query: 'Do you offer a free trial?', unanswered: true, timestamp: new Date(Date.now() - 10800000).toISOString() },
        ],
    };
}

function buildCalendarData() {
    const today = new Date();
    return Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (29 - i));
        const q = i % 4 === 0 ? Math.floor(Math.random() * 8) + 1 : 0;
        return {
            date: d.toISOString().split('T')[0],
            total_questions: q,
            interacted_users: q > 0 ? Math.ceil(q * 0.7) : 0,
            answered_questions: q > 0 ? Math.ceil(q * 0.8) : 0,
            unanswered_questions: q > 0 ? Math.floor(q * 0.2) : 0,
            top_questions: q > 0 ? ['What are the pricing plans?'] : [],
        };
    });
}

const ActivityCalendar = ({ data }: any) => {
    const [selectedCell, setSelectedCell] = useState<any>(null);
    const calendarDates = Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        return d.toISOString().split('T')[0];
    });

    const dataMap: any = {};
    let maxCount = 0;
    data?.forEach((d: any) => {
        dataMap[d.date] = d;
        if (d.total_questions > maxCount) maxCount = d.total_questions;
    });

    useEffect(() => {
        if (data?.length > 0) setSelectedCell(data[data.length - 1]);
    }, [data]);

    return (
        <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
                 <div className="grid grid-cols-7 gap-2">
                     {calendarDates.map(date => {
                         const cell = dataMap[date];
                         const count = cell?.total_questions || 0;
                         const opacity = maxCount > 0 ? count / maxCount : 0;
                         return (
                             <div key={date} onClick={() => setSelectedCell(cell || { date })} className={`aspect-square border rounded-md flex items-center justify-center cursor-pointer transition-all hover:scale-105 ${selectedCell?.date === date ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 z-10 scale-105' : ''}`} style={{ backgroundColor: count > 0 ? `rgba(59, 130, 246, ${Math.max(0.1, opacity)})` : 'transparent', borderColor: count === 0 ? 'rgba(148, 163, 184, 0.15)' : 'rgba(59, 130, 246, 0.4)' }}>
                                 <span className={`text-[10px] font-bold font-mono ${count > 0 ? 'text-blue-700 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'}`}>{new Date(date).getDate()}</span>
                             </div>
                         );
                     })}
                 </div>
            </div>
            <div className="w-full lg:w-80">
                 {selectedCell && (
                     <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-blue-200 dark:border-blue-900/40 rounded-lg space-y-4 shadow-sm">
                         <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Daily Inspector</p>
                         <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{new Date(selectedCell.date).toLocaleDateString()}</p>
                         <div className="grid grid-cols-2 gap-2">
                             <div className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-sm"><p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Total</p><p className="text-xl font-bold text-slate-900 dark:text-slate-100">{selectedCell.total_questions || 0}</p></div>
                             <div className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-sm"><p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Users</p><p className="text-xl font-bold text-blue-600 dark:text-blue-400">{selectedCell.interacted_users || 0}</p></div>
                         </div>
                     </div>
                 )}
            </div>
        </div>
    );
};

export default function DemoInsightsPage() {
    const botConfig = getBotConfig();
    const reportData = buildDemoReport(botConfig.name);
    const [activeTab, setActiveTab] = useState('analytics');

    return (
        <div className="flex flex-col bg-[#E8EBF0] dark:bg-slate-900 min-h-full transition-colors duration-500">
            <div className="bg-white dark:bg-slate-950 px-8 py-6 border-b border-gray-100 dark:border-slate-800 transition-colors">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-200">SaPyBase Insights</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">AI-synthesized business intelligence (Demo Mode).</p>
                <div className="flex gap-6 mt-6">
                    {['analytics', 'leads', 'conversations', 'roi'].map(t => (
                        <button key={t} onClick={() => setActiveTab(t)} className={`pb-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-8 space-y-8">
                {activeTab === 'analytics' && (
                    <>
                        <div className="grid grid-cols-3 gap-px bg-gray-200/30 dark:bg-slate-800/30 border border-gray-100 dark:border-slate-800">
                            <div className="bg-white dark:bg-slate-950 p-8 transition-colors"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Hours Saved</p><p className="text-3xl font-bold text-slate-900 dark:text-slate-200">0</p></div>
                            <div className="bg-white dark:bg-slate-950 p-8 transition-colors"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Savings</p><p className="text-3xl font-bold text-green-600 dark:text-green-500">$0.00</p></div>
                            <div className="bg-white dark:bg-slate-950 p-8 transition-colors"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Revenue</p><p className="text-3xl font-bold text-blue-600 dark:text-blue-400">$0.00</p></div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Top Trends</h2>
                                <div className="border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 divide-y divide-gray-100 dark:divide-slate-800 transition-colors">
                                    {reportData.top_trends.map((t, i) => <div key={i} className="p-4 text-sm text-slate-700 dark:text-slate-300">{t}</div>)}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-amber-500">High Value Gaps</h2>
                                <div className="space-y-2">
                                    {reportData.high_value_gaps.map((g, i) => <div key={i} className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 text-sm italic text-amber-700 dark:text-amber-300">"{g}"</div>)}
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 border-t border-gray-100 dark:border-slate-800">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-6">30-Day Activity</h2>
                            <ActivityCalendar data={reportData.peak_activity_blocks} />
                        </div>
                    </>
                )}
                {activeTab === 'leads' && (
                    <div className="p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4 text-slate-400 dark:text-slate-600">
                        <span className="material-symbols-outlined text-4xl">person_add</span>
                        <p className="font-bold uppercase text-xs">No Leads Captured (Demo)</p>
                    </div>
                )}
            </div>
        </div>
    );
}

'use client';

import React, { useState } from 'react';
import ROIPanel from './ROIPanel';
import ActionCenterPanel from './ActionCenterPanel';
import LeadsPanel from './LeadsPanel';
import UpgradePrompt from './UpgradePrompt';

interface SalesAndLeadsPanelProps {
    selectedBotId: string;
    authFetch: any;
    entitlements: {
        canUseAnalytics: boolean;
        canUseLeadCapture: boolean;
    };
    selectedBot?: any;
}

export default function SalesAndLeadsPanel({
    selectedBotId,
    authFetch,
    entitlements,
    selectedBot
}: SalesAndLeadsPanelProps) {
    const [mobileTab, setMobileTab] = useState<'action' | 'leads'>('action');

    const canAnalytics = entitlements.canUseAnalytics;
    const canLeadCapture = entitlements.canUseLeadCapture;

    return (
        <div className="flex flex-col gap-4 w-full min-w-0">
            {/* 1. Premium ROI Banner (Visible to all authorized analytics users) */}
            <ROIPanel
                selectedBotId={selectedBotId}
                authFetch={authFetch}
                isAuthorized={canAnalytics}
            />

            {/* 2. Permission Gate for Lead Capture */}
            {!canLeadCapture ? (
                <div className="bg-white dark:bg-slate-900 rounded-md p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] uppercase tracking-widest font-sans text-slate-400 mb-2">Lead Capture & CRM</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                        Capture contact details automatically from hot website conversations, score customer intent, and draft AI follow-ups to close sales.
                    </p>
                    <UpgradePrompt code="DEFAULT" mode="inline" />
                </div>
            ) : (
                <>
                    {/* 3. Desktop View */}
                    <div className="hidden sm:flex flex-col gap-6 w-full">
                        <ActionCenterPanel
                            selectedBotId={selectedBotId}
                            authFetch={authFetch}
                            isAuthorized={canLeadCapture}
                            selectedBot={selectedBot}
                        />
                        <LeadsPanel
                            selectedBotId={selectedBotId}
                            authFetch={authFetch}
                            isAuthorized={canLeadCapture}
                        />
                    </div>

                    {/* 4. Mobile View (Sub-tabs to eliminate scroll fatigue) */}
                    <div className="flex sm:hidden flex-col gap-4 w-full">
                        {/* Mobile sub-tabs — underline style */}
                        <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800">
                            <button
                                onClick={() => setMobileTab('action')}
                                className={`py-2 text-xs font-sans uppercase tracking-wider transition-all border-b-2 ${
                                    mobileTab === 'action'
                                        ? 'border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100 font-bold'
                                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-medium'
                                }`}
                            >
                                Action Queue
                            </button>
                            <button
                                onClick={() => setMobileTab('leads')}
                                className={`py-2 text-xs font-sans uppercase tracking-wider transition-all border-b-2 ${
                                    mobileTab === 'leads'
                                        ? 'border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100 font-bold'
                                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-medium'
                                }`}
                            >
                                All Leads CRM
                            </button>
                        </div>

                        {/* Mobile active panel rendering */}
                        <div className="w-full">
                            {mobileTab === 'action' ? (
                                <ActionCenterPanel
                                    selectedBotId={selectedBotId}
                                    authFetch={authFetch}
                                    isAuthorized={canLeadCapture}
                                    selectedBot={selectedBot}
                                />
                            ) : (
                                <LeadsPanel
                                    selectedBotId={selectedBotId}
                                    authFetch={authFetch}
                                    isAuthorized={canLeadCapture}
                                />
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

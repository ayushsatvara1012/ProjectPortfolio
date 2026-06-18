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
        <div className="flex flex-col gap-6 w-full min-w-0">
            {/* 1. Premium ROI Banner (Visible to all authorized analytics users) */}
            <ROIPanel
                selectedBotId={selectedBotId}
                authFetch={authFetch}
                isAuthorized={canAnalytics}
            />

            {/* 2. Permission Gate for Lead Capture */}
            {!canLeadCapture ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800/80">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                        Unlock Lead Capture & CRM Features
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                        Capture contact details automatically from hot website conversations, score customer intent, and draft AI follow-ups to close sales.
                    </p>
                    <UpgradePrompt code="DEFAULT" mode="inline" />
                </div>
            ) : (
                <>
                    {/* 3. Desktop View (Stacked vertically) */}
                    <div className="hidden sm:flex flex-col gap-6 w-full">
                        <ActionCenterPanel
                            selectedBotId={selectedBotId}
                            authFetch={authFetch}
                            isAuthorized={canLeadCapture}
                            selectedBot={selectedBot}
                        />
                        <div className="border-t border-slate-200 dark:border-slate-800/60 my-2" />
                        <LeadsPanel
                            selectedBotId={selectedBotId}
                            authFetch={authFetch}
                            isAuthorized={canLeadCapture}
                        />
                    </div>

                    {/* 4. Mobile View (Sub-tabs to eliminate scroll fatigue) */}
                    <div className="flex sm:hidden flex-col gap-4 w-full">
                        {/* Mobile sub-tabs */}
                        <div className="flex bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 gap-1">
                            <button
                                onClick={() => setMobileTab('action')}
                                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                                    mobileTab === 'action'
                                        ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                Action Queue
                            </button>
                            <button
                                onClick={() => setMobileTab('leads')}
                                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                                    mobileTab === 'leads'
                                        ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
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

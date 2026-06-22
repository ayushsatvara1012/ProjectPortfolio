'use client';

import React, { useState } from 'react';
import ROIPanel from './ROIPanel';
import ActionCenterPanel from './ActionCenterPanel';
import LeadsPanel from './LeadsPanel';
import UpgradePrompt from './UpgradePrompt';
import { Card, cx } from '@/src/app/components/insights/ui';

interface SalesAndLeadsPanelProps {
    selectedBotId: string;
    authFetch: any;
    entitlements: { canUseAnalytics: boolean; canUseLeadCapture: boolean };
    selectedBot?: any;
}

export default function SalesAndLeadsPanel({ selectedBotId, authFetch, entitlements, selectedBot }: SalesAndLeadsPanelProps) {
    const [mobileTab, setMobileTab] = useState<'action' | 'leads'>('action');
    const canAnalytics = entitlements.canUseAnalytics;
    const canLeadCapture = entitlements.canUseLeadCapture;

    return (
        <div className="flex flex-col gap-6 w-full min-w-0">
            {/* ROI scorecard — visible to all analytics users */}
            <ROIPanel selectedBotId={selectedBotId} authFetch={authFetch} isAuthorized={canAnalytics} />

            {!canLeadCapture ? (
                <Card className="p-5 sm:p-6">
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Lead capture & CRM</p>
                    <p className="text-[13.5px] text-slate-600 dark:text-slate-300 mb-4 leading-relaxed max-w-prose">
                        Automatically capture contact details from hot website conversations, score customer intent, and draft AI follow-ups to close more sales.
                    </p>
                    <UpgradePrompt code="DEFAULT" mode="inline" />
                </Card>
            ) : (
                <>
                    {/* Desktop */}
                    <div className="hidden sm:flex flex-col gap-6 w-full">
                        <ActionCenterPanel selectedBotId={selectedBotId} authFetch={authFetch} isAuthorized={canLeadCapture} selectedBot={selectedBot} />
                        <LeadsPanel selectedBotId={selectedBotId} authFetch={authFetch} isAuthorized={canLeadCapture} />
                    </div>

                    {/* Mobile sub-tabs */}
                    <div className="flex sm:hidden flex-col gap-4 w-full">
                        <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-0.5 self-start">
                            {([['action', 'Action queue'], ['leads', 'All leads']] as const).map(([id, label]) => {
                                const active = mobileTab === id;
                                return (
                                    <button
                                        key={id}
                                        onClick={() => setMobileTab(id)}
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
                        {mobileTab === 'action' ? (
                            <ActionCenterPanel selectedBotId={selectedBotId} authFetch={authFetch} isAuthorized={canLeadCapture} selectedBot={selectedBot} />
                        ) : (
                            <LeadsPanel selectedBotId={selectedBotId} authFetch={authFetch} isAuthorized={canLeadCapture} />
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

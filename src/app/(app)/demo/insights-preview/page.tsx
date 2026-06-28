'use client';

// TEMPORARY preview harness — verifies the gradient + noise metric cards. Delete after.

import React from 'react';
import { MetricCard } from '@/src/components/dashboard/insights/ui';

const totals = [8, 12, 9, 14, 18, 11, 7, 13, 22, 19, 16, 24, 28, 21, 17, 26, 31, 29, 23, 33, 27, 19, 25, 34, 30, 22, 28, 36, 32, 25];
const unanswered = [2, 3, 1, 4, 3, 2, 1, 3, 5, 4, 3, 4, 6, 3, 2, 4, 5, 3, 2, 4, 3, 1, 2, 3, 2, 1, 2, 3, 2, 1];

export default function Preview() {
    return (
        <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-950 p-4 md:p-8 flex flex-col gap-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard label="Questions" value="78" hint="last 30 days" delta={-55.6} spark={totals} tone="accent" />
                <MetricCard label="Answer rate" value="73%" hint="answered confidently" delta={-3.2} tone="positive" />
                <MetricCard label="Chat sessions" value="44" hint="engaged conversations" delta={-58.1} spark={totals.map((t) => t * 0.7)} tone="info" />
                <MetricCard label="Gaps" value="21" hint="unanswered questions" delta={-50} deltaInvert spark={unanswered} tone="warn" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard label="Support saved" value="$1,240" hint="312 queries answered" icon="support_agent" tone="default" />
                <MetricCard label="Proven revenue" value="$8,400" hint="11 closed-won deals" icon="verified" tone="positive" />
                <MetricCard label="Overall conversion" value="2.6%" hint="conversations → won" icon="conversion_path" tone="accent" />
                <MetricCard label="Revenue won" value="$8,400" hint="closed-won this window" icon="paid" tone="positive" />
            </div>
        </div>
    );
}

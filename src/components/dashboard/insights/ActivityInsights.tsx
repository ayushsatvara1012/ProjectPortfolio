'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    Badge,
    Card,
    cx,
    EmptyState,
    fmtNum,
    MetricCard,
    SectionHeader,
    TrendChart,
    TrendPoint,
} from '@/src/components/dashboard/insights/ui';

/* ────────────────────────────────────────────────────────────────────────── */
/* Activity series helpers — everything below is derived from REAL daily data.  */
/* `peak_activity_blocks` is a sparse list of active days; we densify to a       */
/* continuous N-day axis (zero-filling gaps) so trends & deltas are honest.      */
/* Shared by /dashboard/insights and /demo/insights so the AI-report block never */
/* drifts between the two surfaces.                                              */
/* ────────────────────────────────────────────────────────────────────────── */

interface DayDatum {
    date: string;
    total: number;
    answered: number;
    unanswered: number;
    users: number;
    raw: any;
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

/** Recent-half vs prior-half percentage change of a daily metric. */
function pctDelta(values: number[]): number {
    const half = Math.floor(values.length / 2);
    const prior = values.slice(0, half).reduce((a, b) => a + b, 0);
    const recent = values.slice(half).reduce((a, b) => a + b, 0);
    if (prior === 0) return recent > 0 ? 100 : 0;
    return ((recent - prior) / prior) * 100;
}

const fmtDay = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// ── Activity heatmap (tap/keyboard accessible) — 10x3 grid with date labels ─
const HEAT_STEPS = [
    'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500',
    'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    'bg-slate-400 dark:bg-slate-600 text-slate-800 dark:text-slate-200',
    'bg-slate-600 dark:bg-slate-400 text-white dark:text-slate-950',
    'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900',
];


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
                                {showMonth ? month : ' '}
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

// ── Activity insights block: KPI strip + trend chart + heatmap + inspector ──
export function ActivityInsights({ blocks }: { blocks: any[] }) {
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

    // Answer-rate delta in percentage points (recent half vs prior half).
    const half = Math.floor(series.length / 2);
    const priorQ = sum(totals.slice(0, half));
    const priorUn = sum(unans.slice(0, half));
    const recentQ = sum(totals.slice(half));
    const recentUn = sum(unans.slice(half));
    const priorRate = priorQ > 0 ? ((priorQ - priorUn) / priorQ) * 100 : 0;
    const recentRate = recentQ > 0 ? ((recentQ - recentUn) / recentQ) * 100 : 0;
    const rateDelta = Math.round((recentRate - priorRate) * 10) / 10;

    const trendPoints: TrendPoint[] = series.map((d) => ({
        label: fmtDay(d.date),
        values: { total: d.total, unanswered: d.unanswered },
    }));

    return (
        <div className="flex flex-col gap-4">
            {/* KPI strip — honest period-over-period deltas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard label="Questions" value={fmtNum(totalQ)} hint="last 30 days" delta={pctDelta(totals)} spark={totals} tone="accent" />
                <MetricCard label="Answer rate" value={`${answeredRate}%`} hint="answered confidently" delta={rateDelta} tone="positive" />
                <MetricCard label="Chat sessions" value={fmtNum(totalUsers)} hint="engaged conversations" delta={pctDelta(users)} spark={users} tone="info" />
                <MetricCard label="Gaps" value={fmtNum(totalUn)} hint="unanswered questions" delta={pctDelta(unans)} deltaInvert spark={unans} tone="warn" />
            </div>

            {/* Trend chart */}
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

            {/* Activity map + daily inspector — one seamless card, two zones */}
            <Card className="overflow-hidden">
                {/* Zone 1: the calendar */}
                <div className="p-4 sm:p-5">
                    <SectionHeader title="30-day activity map" subtitle="Tap a day to inspect what customers asked" icon="calendar_view_month" className="mb-4" />
                    <ActivityHeatmap series={series} selected={selected?.date || null} onSelect={setSelected} />
                </div>

                {/* Zone 2: the daily inspector — continues seamlessly below a hairline */}
                <div className="border-t border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-4 sm:p-5">
                    {selected ? (
                        <div className="flex flex-col gap-4">
                            {/* Header: date + answered / unanswered at a glance */}
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

                            {/* Headline stats */}
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

                            {/* Detail lists */}
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

export default ActivityInsights;

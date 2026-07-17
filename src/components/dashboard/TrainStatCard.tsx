import React from 'react';
import { cx, ProgressBar } from '@/src/components/dashboard/insights/ui';

export type Tone = 'default' | 'accent' | 'info' | 'warn' | 'positive';

export const TONE: Record<Tone, { grad: string; ring: string; bar: string }> = {
    default: { grad: 'from-slate-100 via-slate-50 to-white dark:from-slate-700/40 dark:via-slate-800/30 dark:to-slate-900', ring: 'ring-slate-200/70 dark:ring-slate-700/60', bar: 'bg-gradient-to-r from-slate-500 to-slate-400 dark:from-slate-400 dark:to-slate-500' },
    accent: { grad: 'from-blue-100 via-blue-50 to-white dark:from-blue-900/40 dark:via-blue-950/20 dark:to-slate-900', ring: 'ring-blue-200/70 dark:ring-blue-900/50', bar: 'bg-gradient-to-r from-blue-600 to-blue-400' },
    info: { grad: 'from-sky-100 via-sky-50 to-white dark:from-sky-900/40 dark:via-sky-950/20 dark:to-slate-900', ring: 'ring-sky-200/70 dark:ring-sky-900/50', bar: 'bg-gradient-to-r from-sky-500 to-sky-400' },
    warn: { grad: 'from-amber-100 via-amber-50 to-white dark:from-amber-900/40 dark:via-amber-950/20 dark:to-slate-900', ring: 'ring-amber-200/70 dark:ring-amber-900/50', bar: 'bg-gradient-to-r from-amber-500 to-amber-400' },
    positive: { grad: 'from-emerald-100 via-emerald-50 to-white dark:from-emerald-900/40 dark:via-emerald-950/20 dark:to-slate-900', ring: 'ring-emerald-200/70 dark:ring-emerald-900/50', bar: 'bg-gradient-to-r from-emerald-500 to-emerald-400' },
};

export const NOISE_BG =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='tnNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23tnNoise)'/%3E%3C/svg%3E\")";

export function StatCard({
    label, icon, tone = 'default', value, limit, unit, progress, progressTone, footer, badge,
}: {
    label: React.ReactNode;
    icon?: string;
    tone?: Tone;
    value: React.ReactNode;
    limit?: React.ReactNode;
    unit?: React.ReactNode;
    progress?: number | null;
    progressTone?: string;
    footer?: React.ReactNode;
    badge?: React.ReactNode;
}) {
    const t = TONE[tone];
    return (
        <div
            className={cx(
                'relative flex flex-col gap-3 p-4 sm:p-5 overflow-hidden rounded-2xl',
                'bg-gradient-to-br ring-1 ring-inset shadow-sm shadow-slate-900/[0.03] transition-colors duration-300',
                t.grad,
                t.ring,
            )}
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.20] mix-blend-soft-light"
                style={{ backgroundImage: NOISE_BG, backgroundSize: '140px 140px' }}
            />
            <div className="relative z-10 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 leading-tight">
                    {icon && <span className="material-symbols-outlined text-[16px] text-slate-400/90 dark:text-slate-500">{icon}</span>}
                    {label}
                </span>
                {badge}
            </div>

            <div className="relative z-10 flex items-end gap-1.5 flex-wrap">
                <span className="text-[26px] sm:text-[28px] font-bold tabular-nums leading-none tracking-[-0.02em] text-slate-900 dark:text-slate-100">
                    {value}
                </span>
                {limit && <span className="text-[15px] font-semibold tabular-nums text-slate-400 dark:text-slate-500 leading-none mb-0.5">/ {limit}</span>}
                {unit && <span className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 leading-none mb-0.5">{unit}</span>}
            </div>

            {typeof progress === 'number' && (
                <div className="relative z-10">
                    <ProgressBar pct={progress} tone={progressTone || t.bar} height="h-1.5" />
                </div>
            )}

            {footer && <div className="relative z-10 text-[12px] text-slate-500 dark:text-slate-400 leading-tight">{footer}</div>}
        </div>
    );
}

export const StatSkeleton = () => (
    <div className="rounded-2xl ring-1 ring-inset ring-slate-200/70 dark:ring-slate-700/60 bg-slate-50 dark:bg-slate-900 p-4 sm:p-5 h-[140px] animate-pulse motion-reduce:animate-none transition-colors" />
);

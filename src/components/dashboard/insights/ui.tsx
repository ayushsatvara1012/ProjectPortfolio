'use client';

/**
 * Insights design system — accessible, themeable primitives + pure chart
 * components for the analytics dashboard.
 *
 * Principles applied here (and relied on by every insights panel):
 *  - Type floor: labels never below 12px; body 13–14px; metrics 24–32px.
 *  - Contrast: meaningful text uses slate-500/600 (AA), never slate-400.
 *  - Numbers: always `tabular-nums` so columns align.
 *  - Colour carries meaning: emerald = positive/revenue, rose = negative/urgent,
 *    amber = attention/warm, sky = info/cold, blue = brand/primary trend.
 *  - Interactions are tap-first (click selects; tooltips work on touch) and
 *    honour `prefers-reduced-motion`.
 *  - Charts are pure/presentational so they render with mock data and in tests.
 */

import React, { useId, useMemo, useState } from 'react';

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export const fmtNum = (n: number | string | null | undefined) =>
    Number(n || 0).toLocaleString('en-US');

export const fmtMoney = (n: number | string | null | undefined, dp = 0) =>
    '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });

/** 12_400 → "12.4k", 2_300_000 → "2.3M". Keeps small numbers exact. */
export const fmtCompact = (n: number | null | undefined) => {
    const v = Number(n || 0);
    if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(v);
};

export const fmtMoneyCompact = (n: number | null | undefined) => {
    const v = Number(n || 0);
    if (Math.abs(v) >= 1000) return '$' + fmtCompact(v);
    return fmtMoney(v);
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Card + section header                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

export const card =
    'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm shadow-slate-900/[0.03]';

export function Card({
    className = '',
    children,
    as: As = 'div',
    ...rest
}: React.HTMLAttributes<HTMLElement> & { as?: any }) {
    return (
        <As className={cx(card, 'transition-colors duration-300', className)} {...rest}>
            {children}
        </As>
    );
}

export function SectionHeader({
    title,
    subtitle,
    icon,
    right,
    className = '',
}: {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    icon?: string;
    right?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cx('flex items-start justify-between gap-3 flex-wrap', className)}>
            <div className="flex items-start gap-2.5 min-w-0">
                {icon && (
                    <span className="material-symbols-outlined text-[18px] text-slate-400 dark:text-slate-500 mt-px shrink-0">
                        {icon}
                    </span>
                )}
                <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 leading-tight tracking-[-0.01em]">
                        {title}
                    </h3>
                    {subtitle && (
                        <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{subtitle}</p>
                    )}
                </div>
            </div>
            {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Trend pill — accessible period-over-period delta                             */
/* ────────────────────────────────────────────────────────────────────────── */

export function TrendPill({
    value,
    /** When true, a negative value is the "good" direction (e.g. unanswered ↓). */
    invert = false,
    suffix = '%',
    showZero = true,
    className = '',
}: {
    value: number | null | undefined;
    invert?: boolean;
    suffix?: string;
    showZero?: boolean;
    className?: string;
}) {
    if (value === null || value === undefined || Number.isNaN(value)) return null;
    const v = Math.round(value * 10) / 10;
    if (v === 0 && !showZero) return null;

    const isUp = v > 0;
    const isFlat = v === 0;
    const good = isFlat ? null : invert ? !isUp : isUp;

    const tone = isFlat
        ? 'text-slate-500 dark:text-slate-400'
        : good
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-rose-600 dark:text-rose-400';

    const arrow = isFlat ? '→' : isUp ? '▲' : '▼';
    const label = isFlat ? 'No change' : `${isUp ? 'Up' : 'Down'} ${Math.abs(v)}${suffix} vs prior period`;

    return (
        <span
            className={cx('inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums', tone, className)}
            title={label}
        >
            <span aria-hidden className="text-[9px] leading-none">{arrow}</span>
            {Math.abs(v)}
            {suffix}
            <span className="sr-only">{label}</span>
        </span>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Sparkline — pure inline trend                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export function Sparkline({
    data,
    width = 96,
    height = 28,
    className = 'text-blue-500 dark:text-blue-400',
    fill = true,
    strokeWidth = 2,
}: {
    data: number[];
    width?: number;
    height?: number;
    className?: string;
    fill?: boolean;
    strokeWidth?: number;
}) {
    const gid = useId().replace(/:/g, '');
    if (!data || data.length < 2) return <div style={{ width, height }} aria-hidden />;

    const max = Math.max(...data);
    const min = Math.min(...data);
    const span = max - min || 1;
    const pad = strokeWidth;
    const stepX = (width - pad * 2) / (data.length - 1);
    const pts = data.map((d, i) => {
        const x = pad + i * stepX;
        const y = pad + (1 - (d - min) / span) * (height - pad * 2);
        return [x, y] as const;
    });
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cx('overflow-visible', className)} aria-hidden>
            {fill && (
                <>
                    <defs>
                        <linearGradient id={`sl-${gid}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path d={area} fill={`url(#sl-${gid})`} stroke="none" />
                </>
            )}
            <path d={line} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={strokeWidth + 0.5} fill="currentColor" />
        </svg>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Metric / KPI card                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

type Tone = 'default' | 'positive' | 'info' | 'accent' | 'warn';

// Tinted gradient background per tone (light + dark), plus the matching
// sparkline accent. The metric value stays neutral for legibility on the tint.
const TONE_ACCENT: Record<Tone, { grad: string; ring: string; spark: string }> = {
    default: { grad: 'from-slate-100 via-slate-50 to-white dark:from-slate-700/40 dark:via-slate-800/30 dark:to-slate-900', ring: 'ring-slate-200/70 dark:ring-slate-700/60', spark: 'text-slate-400 dark:text-slate-500' },
    positive: { grad: 'from-emerald-100 via-emerald-50 to-white dark:from-emerald-900/40 dark:via-emerald-950/20 dark:to-slate-900', ring: 'ring-emerald-200/70 dark:ring-emerald-900/50', spark: 'text-emerald-500 dark:text-emerald-400' },
    info: { grad: 'from-sky-100 via-sky-50 to-white dark:from-sky-900/40 dark:via-sky-950/20 dark:to-slate-900', ring: 'ring-sky-200/70 dark:ring-sky-900/50', spark: 'text-sky-500 dark:text-sky-400' },
    accent: { grad: 'from-blue-100 via-blue-50 to-white dark:from-blue-900/40 dark:via-blue-950/20 dark:to-slate-900', ring: 'ring-blue-200/70 dark:ring-blue-900/50', spark: 'text-blue-500 dark:text-blue-400' },
    warn: { grad: 'from-amber-100 via-amber-50 to-white dark:from-amber-900/40 dark:via-amber-950/20 dark:to-slate-900', ring: 'ring-amber-200/70 dark:ring-amber-900/50', spark: 'text-amber-500 dark:text-amber-400' },
};

// Fine fractal-noise grain, used as a subtle overlay so the gradients read as
// a tactile, premium surface rather than a flat fill.
const NOISE_BG =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='mcNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23mcNoise)'/%3E%3C/svg%3E\")";

export function MetricCard({
    label,
    value,
    hint,
    delta,
    deltaInvert = false,
    spark,
    tone = 'default',
    icon,
    className = '',
}: {
    label: React.ReactNode;
    value: React.ReactNode;
    hint?: React.ReactNode;
    delta?: number | null;
    deltaInvert?: boolean;
    spark?: number[];
    tone?: Tone;
    icon?: string;
    className?: string;
}) {
    const t = TONE_ACCENT[tone];
    return (
        <div
            className={cx(
                'relative flex flex-col justify-between gap-3 p-4 sm:p-5 overflow-hidden rounded-2xl',
                'bg-gradient-to-br ring-1 ring-inset shadow-sm shadow-slate-900/[0.03] transition-colors duration-300',
                t.grad,
                t.ring,
                className,
            )}
        >
            {/* grain overlay */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.20] mix-blend-soft-light"
                style={{ backgroundImage: NOISE_BG, backgroundSize: '140px 140px' }}
            />
            <div className="relative z-10 flex items-start justify-between gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 leading-tight">
                    {label}
                </span>
                {icon && <span className="material-symbols-outlined text-[18px] text-slate-400/80 dark:text-slate-500 shrink-0">{icon}</span>}
            </div>
            <div className="relative z-10 flex items-end justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[26px] sm:text-[28px] font-bold tabular-nums leading-none tracking-[-0.02em] text-slate-900 dark:text-slate-100">
                        {value}
                    </div>
                    {(hint || delta !== undefined) && (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {delta !== undefined && <TrendPill value={delta} invert={deltaInvert} />}
                            {hint && <span className="text-[12px] text-slate-500 dark:text-slate-400 leading-tight">{hint}</span>}
                        </div>
                    )}
                </div>
                {spark && spark.length > 1 && (
                    <div className="shrink-0 self-end">
                        <Sparkline data={spark} className={t.spark} />
                    </div>
                )}
            </div>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Badges — temperature, status, generic                                        */
/* ────────────────────────────────────────────────────────────────────────── */

type BadgeTone = 'hot' | 'warm' | 'cold' | 'new' | 'contacted' | 'won' | 'lost' | 'neutral' | 'alert' | 'ok';

const BADGE: Record<BadgeTone, { dot: string; text: string; ring: string; bg: string }> = {
    // Temperature metaphor restored: hot=rose, warm=amber, cold=sky.
    hot: { dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300', ring: 'ring-rose-200 dark:ring-rose-900/60', bg: 'bg-rose-50 dark:bg-rose-950/40' },
    warm: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-200 dark:ring-amber-900/60', bg: 'bg-amber-50 dark:bg-amber-950/40' },
    cold: { dot: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-300', ring: 'ring-sky-200 dark:ring-sky-900/60', bg: 'bg-sky-50 dark:bg-sky-950/40' },
    new: { dot: 'bg-slate-400', text: 'text-slate-600 dark:text-slate-300', ring: 'ring-slate-200 dark:ring-slate-700', bg: 'bg-slate-50 dark:bg-slate-800/60' },
    contacted: { dot: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-300', ring: 'ring-sky-200 dark:ring-sky-900/60', bg: 'bg-sky-50 dark:bg-sky-950/40' },
    won: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-200 dark:ring-emerald-900/60', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
    lost: { dot: 'bg-slate-300 dark:bg-slate-600', text: 'text-slate-500 dark:text-slate-400', ring: 'ring-slate-200 dark:ring-slate-700', bg: 'bg-slate-50 dark:bg-slate-800/60' },
    neutral: { dot: 'bg-slate-400', text: 'text-slate-600 dark:text-slate-300', ring: 'ring-slate-200 dark:ring-slate-700', bg: 'bg-slate-50 dark:bg-slate-800/60' },
    alert: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-200 dark:ring-amber-900/60', bg: 'bg-amber-50 dark:bg-amber-950/40' },
    ok: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-200 dark:ring-emerald-900/60', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
};

export function badgeToneFor(key: string | null | undefined): BadgeTone {
    const k = (key || '').toLowerCase();
    if (k in BADGE) return k as BadgeTone;
    return 'neutral';
}

export function Badge({
    tone = 'neutral',
    children,
    dot = true,
    soft = true,
    className = '',
    title,
}: {
    tone?: BadgeTone;
    children: React.ReactNode;
    dot?: boolean;
    soft?: boolean;
    className?: string;
    title?: string;
}) {
    const s = BADGE[tone];
    return (
        <span
            title={title}
            className={cx(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ring-1 ring-inset',
                soft ? s.bg : 'bg-transparent',
                s.text,
                s.ring,
                className,
            )}
        >
            {dot && <span className={cx('h-1.5 w-1.5 rounded-full shrink-0', s.dot)} />}
            {children}
        </span>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Progress bar                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export function ProgressBar({
    pct,
    tone = 'bg-slate-800 dark:bg-slate-200',
    track = 'bg-slate-100 dark:bg-slate-800',
    className = '',
    height = 'h-2',
}: {
    pct: number;
    tone?: string;
    track?: string;
    className?: string;
    height?: string;
}) {
    const clamped = Math.max(0, Math.min(100, pct));
    return (
        <div
            className={cx('w-full rounded-full overflow-hidden', track, height, className)}
            role="progressbar"
            aria-valuenow={Math.round(clamped)}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div
                className={cx('h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none', tone)}
                style={{ width: `${Math.max(clamped, clamped > 0 ? 2 : 0)}%` }}
            />
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Empty / skeleton                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export function EmptyState({
    icon = 'inbox',
    title,
    hint,
    className = '',
}: {
    icon?: string;
    title: React.ReactNode;
    hint?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cx('flex flex-col items-center justify-center text-center py-10 px-6', className)}>
            <span className="material-symbols-outlined text-[28px] text-slate-300 dark:text-slate-600 mb-2">{icon}</span>
            <p className="text-[13.5px] font-medium text-slate-600 dark:text-slate-300">{title}</p>
            {hint && <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{hint}</p>}
        </div>
    );
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
    return <div className={cx('rounded-lg bg-slate-100 dark:bg-slate-800/70 animate-pulse motion-reduce:animate-none', className)} />;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Segmented control (window / filter selector)                                */
/* ────────────────────────────────────────────────────────────────────────── */

export function Segmented<T extends string | number>({
    options,
    value,
    onChange,
    ariaLabel,
    size = 'md',
}: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (v: T) => void;
    ariaLabel: string;
    size?: 'sm' | 'md';
}) {
    return (
        <div
            role="group"
            aria-label={ariaLabel}
            className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-0.5"
        >
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <button
                        key={String(o.value)}
                        type="button"
                        onClick={() => onChange(o.value)}
                        aria-pressed={active}
                        className={cx(
                            'rounded-[6px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
                            size === 'sm' ? 'px-2.5 py-1 text-[11.5px]' : 'px-3 py-1.5 text-[12.5px]',
                            active
                                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
                        )}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Trend chart — responsive multi-series area/line, tap-friendly               */
/* ────────────────────────────────────────────────────────────────────────── */

export interface TrendPoint {
    label: string; // x label / date
    values: Record<string, number>;
}

export interface TrendSeries {
    key: string;
    name: string;
    color: string; // hex
    fill?: boolean;
}

export function TrendChart({
    points,
    series,
    height = 240,
    valueFormat = (n: number) => fmtNum(n),
}: {
    points: TrendPoint[];
    series: TrendSeries[];
    height?: number;
    valueFormat?: (n: number) => string;
}) {
    const gid = useId().replace(/:/g, '');
    const [active, setActive] = useState<number | null>(null);

    const W = 760;
    const H = height;
    const padL = 44;
    const padR = 16;
    const padT = 16;
    const padB = 30;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const maxVal = useMemo(() => {
        let m = 0;
        points.forEach((p) => series.forEach((s) => (m = Math.max(m, p.values[s.key] || 0))));
        return m || 1;
    }, [points, series]);

    // "Nice" rounded top for the axis.
    const niceMax = useMemo(() => {
        const pow = Math.pow(10, Math.floor(Math.log10(maxVal)));
        const n = Math.ceil(maxVal / pow) * pow;
        return n || 1;
    }, [maxVal]);

    if (points.length < 2) {
        return <EmptyState icon="show_chart" title="Not enough data yet" hint="A trend line appears once there are at least two days of activity." />;
    }

    const xAt = (i: number) => padL + (i / (points.length - 1)) * chartW;
    const yAt = (v: number) => padT + chartH - (v / niceMax) * chartH;

    const buildPath = (key: string) => {
        const pts = points.map((p, i) => [xAt(i), yAt(p.values[key] || 0)] as const);
        const line = pts
            .map((p, i) => {
                if (i === 0) return `M${p[0].toFixed(1)},${p[1].toFixed(1)}`;
                const prev = pts[i - 1];
                const cx1 = prev[0] + (p[0] - prev[0]) / 2;
                const cx2 = p[0] - (p[0] - prev[0]) / 2;
                return `C${cx1.toFixed(1)},${prev[1].toFixed(1)} ${cx2.toFixed(1)},${p[1].toFixed(1)} ${p[0].toFixed(1)},${p[1].toFixed(1)}`;
            })
            .join(' ');
        const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${(padT + chartH).toFixed(1)} L${pts[0][0].toFixed(1)},${(padT + chartH).toFixed(1)} Z`;
        return { line, area };
    };

    // Show ~6 x labels max to avoid clutter.
    const labelStep = Math.max(1, Math.ceil(points.length / 6));

    return (
        <div className="flex flex-col gap-3">
            {/* Legend */}
            <div className="flex items-center gap-4 flex-wrap">
                {series.map((s) => (
                    <span key={s.key} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-600 dark:text-slate-300">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                        {s.name}
                    </span>
                ))}
            </div>

            <div className="relative w-full">
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="w-full h-auto overflow-visible"
                    role="img"
                    aria-label={`Trend chart of ${series.map((s) => s.name).join(', ')} over ${points.length} days`}
                    onMouseLeave={() => setActive(null)}
                >
                    <defs>
                        {series.map((s) => (
                            <linearGradient key={s.key} id={`tg-${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={s.color} stopOpacity="0.20" />
                                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                            </linearGradient>
                        ))}
                    </defs>

                    {/* Y gridlines + labels */}
                    {[0, 0.25, 0.5, 0.75, 1].map((r) => {
                        const y = padT + chartH * (1 - r);
                        return (
                            <g key={r}>
                                <line x1={padL} y1={y} x2={W - padR} y2={y} className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="1" />
                                <text x={padL - 8} y={y + 3} textAnchor="end" className="fill-slate-400 dark:fill-slate-500 text-[10px] tabular-nums">
                                    {fmtCompact(Math.round(niceMax * r))}
                                </text>
                            </g>
                        );
                    })}

                    {/* Areas + lines */}
                    {series.map((s) => {
                        const { line, area } = buildPath(s.key);
                        return (
                            <g key={s.key}>
                                {s.fill !== false && <path d={area} fill={`url(#tg-${gid}-${s.key})`} />}
                                <path d={line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </g>
                        );
                    })}

                    {/* X labels */}
                    {points.map((p, i) =>
                        i % labelStep === 0 || i === points.length - 1 ? (
                            <text key={i} x={xAt(i)} y={H - 8} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500 text-[10px]">
                                {p.label}
                            </text>
                        ) : null,
                    )}

                    {/* Active crosshair + dots */}
                    {active !== null && (
                        <g pointerEvents="none">
                            <line x1={xAt(active)} y1={padT} x2={xAt(active)} y2={padT + chartH} className="stroke-slate-300 dark:stroke-slate-600" strokeDasharray="3 3" strokeWidth="1" />
                            {series.map((s) => (
                                <circle key={s.key} cx={xAt(active)} cy={yAt(points[active].values[s.key] || 0)} r="4" fill="white" stroke={s.color} strokeWidth="2.5" className="dark:fill-slate-900" />
                            ))}
                        </g>
                    )}

                    {/* Hit areas (tap-friendly) */}
                    {points.map((p, i) => (
                        <rect
                            key={i}
                            x={xAt(i) - chartW / points.length / 2}
                            y={0}
                            width={chartW / points.length}
                            height={H}
                            fill="transparent"
                            className="cursor-pointer"
                            onMouseEnter={() => setActive(i)}
                            onClick={() => setActive(i)}
                        />
                    ))}
                </svg>

                {/* Tooltip */}
                {active !== null && (
                    <div
                        className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 py-2 shadow-lg z-10"
                        style={{ left: `${(xAt(active) / W) * 100}%`, top: `${(padT / H) * 100}%` }}
                    >
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 whitespace-nowrap">{points[active].label}</div>
                        {series.map((s) => (
                            <div key={s.key} className="flex items-center justify-between gap-3 text-[12px] whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                                    {s.name}
                                </span>
                                <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{valueFormat(points[active].values[s.key] || 0)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Funnel chart — proper tapering bars, drop-off between stages                 */
/* ────────────────────────────────────────────────────────────────────────── */

export interface FunnelStageDatum {
    key: string;
    label: string;
    count: number;
    pct_of_top: number;
    pct_of_prev: number;
    dropoff_pct: number;
    description?: string;
}

const FUNNEL_COLORS = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa']; // blue 700 → 400 ramp

export function FunnelChart({ stages }: { stages: FunnelStageDatum[] }) {
    const [active, setActive] = useState<number | null>(null);
    const top = stages[0]?.count || 1;

    return (
        <div className="flex flex-col">
            {stages.map((s, i) => {
                const widthPct = Math.max((s.count / (top || 1)) * 100, 3);
                const color = FUNNEL_COLORS[i % FUNNEL_COLORS.length];
                const isActive = active === i;
                return (
                    <div key={s.key}>
                        <button
                            type="button"
                            onMouseEnter={() => setActive(i)}
                            onMouseLeave={() => setActive(null)}
                            onFocus={() => setActive(i)}
                            onBlur={() => setActive(null)}
                            className="group w-full text-left rounded-lg px-1 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                            aria-label={`${s.label}: ${fmtNum(s.count)}, ${s.pct_of_top}% of top of funnel`}
                        >
                            <div className="flex items-baseline justify-between gap-3 mb-1">
                                <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{s.label}</span>
                                <span className="flex items-baseline gap-2">
                                    <span className="text-[15px] font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmtNum(s.count)}</span>
                                    <span className="text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">{s.pct_of_top}%</span>
                                </span>
                            </div>
                            <div className="h-9 w-full rounded-lg bg-slate-100 dark:bg-slate-800/70 overflow-hidden">
                                <div
                                    className="h-full rounded-lg flex items-center transition-[width,filter] duration-700 ease-out motion-reduce:transition-none"
                                    style={{
                                        width: `${widthPct}%`,
                                        background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                                        filter: isActive ? 'brightness(1.08)' : 'none',
                                    }}
                                />
                            </div>
                        </button>
                        {/* Drop-off connector */}
                        {i < stages.length - 1 && (
                            <div className="flex items-center gap-2 pl-1 py-1 text-[11.5px]">
                                <span className="material-symbols-outlined text-[14px] text-slate-300 dark:text-slate-600">south</span>
                                <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                                    {stages[i + 1].pct_of_prev}% continue
                                </span>
                                {stages[i + 1].dropoff_pct > 0 && (
                                    <span className="text-rose-600 dark:text-rose-400 font-medium tabular-nums">
                                        · {stages[i + 1].dropoff_pct}% drop off
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Donut chart — accessible, tap-select, center total                          */
/* ────────────────────────────────────────────────────────────────────────── */

export interface DonutDatum {
    key: string;
    label: string;
    count: number;
    pct: number;
    color: string; // hex
    description?: string;
}

export function DonutChart({
    data,
    total,
    totalLabel = 'Total',
    centerValue,
}: {
    data: DonutDatum[];
    total: number;
    totalLabel?: string;
    centerValue?: React.ReactNode;
}) {
    const [active, setActive] = useState<string | null>(null);
    const radius = 64;
    const stroke = 18;
    const circ = 2 * Math.PI * radius;
    let acc = 0;

    if (total === 0) {
        return <EmptyState icon="donut_large" title="Nothing to break down yet" hint="Categories appear once data is scored." />;
    }

    return (
        <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-[150px] h-[150px] shrink-0">
                <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                    <circle cx="80" cy="80" r={radius} fill="none" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth={stroke} />
                    {data.map((d) => {
                        const len = (d.pct / 100) * circ;
                        const offset = -(acc / 100) * circ;
                        acc += d.pct;
                        const dim = active !== null && active !== d.key;
                        return (
                            <circle
                                key={d.key}
                                cx="80"
                                cy="80"
                                r={radius}
                                fill="none"
                                stroke={d.color}
                                strokeWidth={active === d.key ? stroke + 3 : stroke}
                                strokeDasharray={`${len} ${circ}`}
                                strokeDashoffset={offset}
                                strokeLinecap="butt"
                                opacity={dim ? 0.35 : 1}
                                className="cursor-pointer transition-[opacity,stroke-width] duration-200"
                                onMouseEnter={() => setActive(d.key)}
                                onMouseLeave={() => setActive(null)}
                                onClick={() => setActive((a) => (a === d.key ? null : d.key))}
                            />
                        );
                    })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[24px] font-bold tabular-nums text-slate-900 dark:text-slate-100 leading-none">
                        {centerValue ?? fmtNum(active ? data.find((d) => d.key === active)?.count : total)}
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500 mt-1">
                        {active ? data.find((d) => d.key === active)?.label : totalLabel}
                    </span>
                </div>
            </div>

            <ul className="flex flex-col gap-1.5 flex-1 min-w-0 w-full">
                {data.map((d) => {
                    const isActive = active === d.key;
                    return (
                        <li key={d.key}>
                            <button
                                type="button"
                                onMouseEnter={() => setActive(d.key)}
                                onMouseLeave={() => setActive(null)}
                                onClick={() => setActive((a) => (a === d.key ? null : d.key))}
                                className={cx(
                                    'w-full text-left flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
                                    isActive ? 'bg-slate-50 dark:bg-slate-800/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30',
                                )}
                            >
                                <span className="h-2.5 w-2.5 rounded-full shrink-0 mt-1" style={{ background: d.color }} />
                                <span className="flex-1 min-w-0">
                                    <span className="flex items-baseline gap-2">
                                        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{d.label}</span>
                                        <span className="text-[13px] font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmtNum(d.count)}</span>
                                        <span className="text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">{d.pct}%</span>
                                    </span>
                                    {d.description && <span className="block text-[11.5px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{d.description}</span>}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Horizontal bars — source attribution                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export interface BarDatum {
    label: string;
    value: number;
    secondary?: string; // e.g. "$5,200"
    icon?: string;
}

export function HorizontalBars({ data, valueFormat = fmtNum }: { data: BarDatum[]; valueFormat?: (n: number) => string }) {
    const max = data.reduce((m, d) => Math.max(m, d.value), 0) || 1;
    return (
        <ul className="flex flex-col gap-3">
            {data.map((d, i) => (
                <li key={d.label + i} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                            {d.icon && <span className="material-symbols-outlined text-[15px] text-slate-400 dark:text-slate-500 shrink-0">{d.icon}</span>}
                            <span className="text-[12.5px] font-medium text-slate-700 dark:text-slate-200 truncate">{d.label}</span>
                        </span>
                        <span className="flex items-baseline gap-2 shrink-0">
                            <span className="text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">{valueFormat(d.value)}</span>
                            {d.secondary && <span className="text-[12px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{d.secondary}</span>}
                        </span>
                    </div>
                    <ProgressBar pct={(d.value / max) * 100} tone="bg-gradient-to-r from-blue-600 to-blue-400" height="h-2.5" />
                </li>
            ))}
        </ul>
    );
}

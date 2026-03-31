import { useState, useEffect } from "react";

/**
 * Skeleton UI Components
 * ──────────────────────
 * High-precision placeholders for Bento-grid layouts.
 * Optimized for mobile-first responsiveness.
 */

export const SkeletonBase = ({ className = "" }) => (
    <div className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-md ${className}`} />
);

export const StatsSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-xl flex flex-col justify-between h-[104px]">
                <div className="flex items-center gap-2 mb-3">
                    <SkeletonBase className="w-3.5 h-3.5 rounded-md" />
                    <SkeletonBase className="w-16 h-2.5" />
                </div>
                <SkeletonBase className="w-20 h-6 rounded-lg" />
            </div>
        ))}
    </div>
);

export const FormSkeleton = () => (
    <div className="space-y-6 h-[352px] pt-4">
        <div className="space-y-2">
            <SkeletonBase className="w-32 h-2.5" />
            <SkeletonBase className="w-full h-10 rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <SkeletonBase className="w-24 h-2.5" />
                <SkeletonBase className="w-full h-10 rounded-md" />
            </div>
            <div className="space-y-2">
                <SkeletonBase className="w-24 h-2.5" />
                <SkeletonBase className="w-full h-10 rounded-md" />
            </div>
        </div>
        <SkeletonBase className="w-full h-11 rounded-md mt-4" />
    </div>
);

export const TableSkeleton = ({ rows = 5 }) => (
    <div className="w-full space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center gap-3 w-1/3">
                    <SkeletonBase className="w-8 h-8 rounded-md" />
                    <div className="space-y-1.5 grow">
                        <SkeletonBase className="w-3/4 h-2.5" />
                        <SkeletonBase className="w-1/2 h-2 opacity-50" />
                    </div>
                </div>
                <SkeletonBase className="w-24 h-6 rounded-md" />
                <SkeletonBase className="w-8 h-8 rounded-md" />
            </div>
        ))}
    </div>
);

export const BentoCardSkeleton = ({ className = "" }) => (
    <div className={`bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-xl ${className}`}>
        <div className="flex justify-between items-start mb-6">
            <SkeletonBase className="w-8 h-8 rounded-md" />
            <SkeletonBase className="w-20 h-5 rounded-md" />
        </div>
        <SkeletonBase className="w-3/4 h-6 mb-4" />
        <SkeletonBase className="w-full h-16 mb-6" />
        <div className="flex gap-2">
            <SkeletonBase className="w-12 h-3" />
            <SkeletonBase className="w-12 h-3" />
        </div>
    </div>
);

export const CardSkeleton = ({ className = "" }) => (
    <div className={`bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl h-[160px] ${className}`}>
        <div className="flex items-center gap-2 mb-6">
            <SkeletonBase className="w-3.5 h-3.5 rounded-md" />
            <SkeletonBase className="w-20 h-2.5" />
        </div>
        <div className="flex items-end gap-2 mb-5">
            <SkeletonBase className="w-24 h-8 rounded-md" />
            <SkeletonBase className="w-10 h-2.5 mb-1.5" />
        </div>
        <SkeletonBase className="w-full h-1.5 rounded-full mb-3" />
        <div className="flex justify-between">
            <SkeletonBase className="w-14 h-2" />
            <SkeletonBase className="w-16 h-2" />
        </div>
    </div>
);

export const AppPageSkeleton = () => {
    const [pct, setPct] = useState(0);
    const [done, setDone] = useState(false);
    const messages = ['Initializing…', 'Loading assets…', 'Almost there…', 'Finishing up…'];
 
    useEffect(() => {
        const interval = setInterval(() => {
            setPct(prev => {
                const next = Math.min(prev + Math.random() * 4 + 1, 100);
                if (next >= 100) {
                    clearInterval(interval);
                    setTimeout(() => setDone(true), 300);
                }
                return next;
            });
        }, 80);
        return () => clearInterval(interval);
    }, []);
 
    const msgIdx = Math.min(Math.floor(pct / 25), messages.length - 1);
 
    return (
        <div className="flex-1 flex items-center justify-center min-h-[50vh] p-8 transition-colors duration-500">
            <style>{`
                @keyframes eyeSlide {
                    0%   { transform: translateX(0px); }
                    25%  { transform: translateX(5px); }
                    75%  { transform: translateX(-5px); }
                    100% { transform: translateX(0px); }
                }
                @keyframes brandFadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes labelPulse {
                    0%, 100% { opacity: 1; }
                    50%      { opacity: 0.5; }
                }
                .brand-eye {
                    transform-box: fill-box;
                    transform-origin: center;
                    animation: eyeSlide 2.4s ease-in-out infinite;
                }
                .brand-wrap { animation: brandFadeIn 0.6s ease-out both; }
                .brand-label { animation: labelPulse 1.8s ease-in-out infinite; }
            `}</style>
 
            <div className="brand-wrap flex flex-col items-center">
                <svg
                    viewBox="120 28 160 160"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ width: 180, height: 'auto', marginBottom: 32 }}
                >
                    {/* Corner dots */}
                    <path opacity="0.45" d="M128 104H124C122.895 104 122 104.895 122 106V110C122 111.105 122.895 112 124 112H128C129.105 112 130 111.105 130 110V106C130 104.895 129.105 104 128 104Z" fill="#5730F5"/>
                    <path opacity="0.45" d="M276 104H272C270.895 104 270 104.895 270 106V110C270 111.105 270.895 112 272 112H276C277.105 112 278 111.105 278 110V106C278 104.895 277.105 104 276 104Z" fill="#5730F5"/>
                    <path opacity="0.4"  d="M128 146H124C123.448 146 123 146.448 123 147V151C123 151.552 123.448 152 124 152H128C128.552 152 129 151.552 129 151V147C129 146.448 128.552 146 128 146Z" fill="#0F2060"/>
                    <path opacity="0.4"  d="M276 146H272C271.448 146 271 146.448 271 147V151C271 151.552 271.448 152 272 152H276C276.552 152 277 151.552 277 151V147C277 146.448 276.552 146 276 146Z" fill="#0F2060"/>
                    <path opacity="0.45" d="M201 44H198C196.895 44 196 44.8954 196 46V49C196 50.1046 196.895 51 198 51H201C202.105 51 203 50.1046 203 49V46C203 44.8954 202.105 44 201 44Z" fill="#5730F5"/>
 
                    {/* Body blocks */}
                    <path d="M148 77H138C135.791 77 134 78.7909 134 81V91C134 93.2091 135.791 95 138 95H148C150.209 95 152 93.2091 152 91V81C152 78.7909 150.209 77 148 77Z" fill="#0F2060" className="dark:fill-white"/>
                    <path d="M170 59H160C157.791 59 156 60.7909 156 63V73C156 75.2091 157.791 77 160 77H170C172.209 77 174 75.2091 174 73V63C174 60.7909 172.209 59 170 59Z" fill="#0F2060" className="dark:fill-white"/>
                    <path d="M258 99H248C245.791 99 244 100.791 244 103V113C244 115.209 245.791 117 248 117H258C260.209 117 262 115.209 262 113V103C262 100.791 260.209 99 258 99Z" fill="#0F2060" className="dark:fill-white"/>
                    <path d="M258 77H248C245.791 77 244 78.7909 244 81V91C244 93.2091 245.791 95 248 95H258C260.209 95 262 93.2091 262 91V81C262 78.7909 260.209 77 258 77Z" fill="#0F2060" className="dark:fill-white"/>
                    <path d="M148 99H138C135.791 99 134 100.791 134 103V113C134 115.209 135.791 117 138 117H148C150.209 117 152 115.209 152 113V103C152 100.791 150.209 99 148 99Z" fill="#0F2060" className="dark:fill-white"/>
                    <path d="M236 59H226C223.791 59 222 60.7909 222 63V73C222 75.2091 223.791 77 226 77H236C238.209 77 240 75.2091 240 73V63C240 60.7909 238.209 59 236 59Z" fill="#0F2060" className="dark:fill-white"/>
                    <path d="M192 77H182C179.791 77 178 78.7909 178 81V91C178 93.2091 179.791 95 182 95H192C194.209 95 196 93.2091 196 91V81C196 78.7909 194.209 77 192 77Z" fill="#0F2060" className="dark:fill-white"/>
                    <path d="M214 77H204C201.791 77 200 78.7909 200 81V91C200 93.2091 201.791 95 204 95H214C216.209 95 218 93.2091 218 91V81C218 78.7909 216.209 77 214 77Z" fill="#0F2060" className="dark:fill-white"/>
 
                    {/* Eyes — slide left / right only */}
                    <path className="brand-eye" d="M170 99H160C157.791 99 156 100.791 156 103V113C156 115.209 157.791 117 160 117H170C172.209 117 174 115.209 174 113V103C174 100.791 172.209 99 170 99Z" fill="#5730F5"/>
                    <path className="brand-eye" d="M236 100H226C223.791 100 222 101.791 222 104V114C222 116.209 223.791 118 226 118H236C238.209 118 240 116.209 240 114V104C240 101.791 238.209 100 236 100Z" fill="#5730F5"/>
 
                    {/* Lower body */}
                    <path d="M192 121H182C179.791 121 178 122.791 178 125V135C178 137.209 179.791 139 182 139H192C194.209 139 196 137.209 196 135V125C196 122.791 194.209 121 192 121Z" fill="#0F2060" className="dark:fill-white"/>
                    <path d="M214 121H204C201.791 121 200 122.791 200 125V135C200 137.209 201.791 139 204 139H214C216.209 139 218 137.209 218 135V125C218 122.791 216.209 121 214 121Z" fill="#0F2060" className="dark:fill-white"/>
                    <path d="M170 137H160C157.791 137 156 138.791 156 141V151C156 153.209 157.791 155 160 155H170C172.209 155 174 153.209 174 151V141C174 138.791 172.209 137 170 137Z" fill="#0F2060" className="dark:fill-white"/>
                    <path d="M236 137H226C223.791 137 222 138.791 222 141V151C222 153.209 223.791 155 226 155H236C238.209 155 240 153.209 240 151V141C240 138.791 238.209 137 236 137Z" fill="#0F2060" className="dark:fill-white"/>
                    <path d="M148 121H138C135.791 121 134 122.791 134 125V135C134 137.209 135.791 139 138 139H148C150.209 139 152 137.209 152 135V125C152 122.791 150.209 121 148 121Z" fill="#0F2060" className="dark:fill-white"/>
                    <path d="M258 121H248C245.791 121 244 122.791 244 125V135C244 137.209 245.791 139 248 139H258C260.209 139 262 137.209 262 135V125C262 122.791 260.209 121 258 121Z" fill="#0F2060" className="dark:fill-white"/>
 
                    {/* Nose blocks */}
                    <path d="M192 99H182C179.791 99 178 100.791 178 103V113C178 115.209 179.791 117 182 117H192C194.209 117 196 115.209 196 113V103C196 100.791 194.209 99 192 99Z" fill="#0F2060" className="dark:fill-white"/>
                    <path d="M213 99H203C200.791 99 199 100.791 199 103V113C199 115.209 200.791 117 203 117H213C215.209 117 217 115.209 217 113V103C217 100.791 215.209 99 213 99Z" fill="#0F2060" className="dark:fill-white"/>
 
                    {/* Bottom bar */}
                    <g transform="matrix(1 0 0 1.802319 0 -139.202346)">
                        <path d="M249.811,171c-26.284853,1.656625-60.541601,4.781331-99.622,0-.421,0-.762,1.119-.762,2.5s.341,2.5.762,2.5h99.622c.421,0,.762-1.119-.762-2.5s-.341-2.5-.762-2.5Z" transform="matrix(1 0 0 0.999999 -1 0.000174)" fill="#0F2060" className="dark:fill-white"/>
                        <path d="M150.237,171h-1.619c-.893,0-1.618.895-1.618,2v1c0,1.105.725,2,1.618,2h1.619c.893,0,1.618-.895,1.618-2v-1c0-1.105-.725-2-1.618-2Z" fill="#5730F5"/>
                        <path d="M251.382,171h-1.619c-.893,0-1.618.895-1.618,2v1c0,1.105.725,2,1.618,2h1.619c.893,0,1.618-.895,1.618-2v-1c0-1.105-.725-2-1.618-2Z" fill="#5730F5"/>
                    </g>
                </svg>
 
                {/* Progress bar */}
                <div className="w-64 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-3.5">
                    <div
                        className="h-full rounded-full transition-all duration-75"
                        style={{ width: `${pct.toFixed(1)}%`, background: '#0F2060' }}
                    />
                </div>
 
                {/* Status label */}
                {done ? (
                    <span className="text-[13px] text-slate-400 dark:text-slate-500 transition-opacity duration-500">
                        Ready
                    </span>
                ) : (
                    <span className="brand-label text-[13px] text-slate-400 dark:text-slate-500">
                        {messages[msgIdx]} {Math.round(pct)}%
                    </span>
                )}
            </div>
        </div>
    );
};

const SkeletonLoader = {
    Stats: StatsSkeleton,
    Form: FormSkeleton,
    Table: TableSkeleton,
    Bento: BentoCardSkeleton,
    Card: CardSkeleton,
    Base: SkeletonBase,
    AppPage: AppPageSkeleton,
};

export default SkeletonLoader;


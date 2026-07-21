'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import VaayuLogo from '@/src/components/ui/VaayuLogo';

interface Panel {
    eyebrow: string;
    icon: string | null;
    title: string;
    paragraphs: string[];
    bullets?: { title: string; description: string }[];
}

const PANELS: Panel[] = [
    {
        eyebrow: 'Introduction',
        icon: null,
        title: 'Welcome to the Vaayu demo',
        paragraphs: [
            "This is a full, hands-on walkthrough of the actual Vaayu product — not a video, not a sandboxed toy. You'll train a real AI assistant on real content, chat with it, and see the same owner dashboard a paying customer sees.",
            "Everything you do runs in this browser tab only. Nothing is saved to an account, nothing is shared, and there's no signup to get started.",
            "The next four steps walk through the flow in order: train it, verify it, see what it tracks, then make it yours.",
        ],
    },
    {
        eyebrow: 'Step 1 of 4',
        icon: 'psychology',
        title: 'Train your bot on real content',
        paragraphs: [
            "On the Train AI page, feed the bot a knowledge source — upload a PDF, paste a page URL, drop in a CSV, or just paste raw text. Whatever you give it gets broken into indexed segments, the same way the real product builds a bot's knowledge base.",
            "This matters because of how the bot answers questions afterward: it only draws from what you trained it on. It doesn't invent facts about your business — it retrieves the relevant segment and answers from that, which is exactly what keeps a real deployed bot from making things up to a customer.",
            'Chat stays locked until training succeeds at least once, so by the time you reach Step 2 there is always something real to test against.',
        ],
    },
    {
        eyebrow: 'Step 2 of 4',
        icon: 'chat',
        title: 'Chat with it and check the answers',
        paragraphs: [
            "Once training finishes, head to Chat and ask it the kinds of questions a real visitor would ask about the document or page you uploaded. This step is the pressure test — you're not just watching it reply, you're checking that what it says actually matches your source content.",
            "If you ask something the source doesn't cover, a well-trained bot should say it doesn't know rather than guess. That honesty is the whole point: it's the same grounded-answer behavior your real bot would show a customer on your website.",
        ],
    },
    {
        eyebrow: 'Step 3 of 4',
        icon: 'insights',
        title: 'Explore what the owner sees',
        paragraphs: [
            'Every conversation feeds an Insights dashboard — this is what you, as the owner, would actually check day to day. It has three tabs:',
        ],
        bullets: [
            { title: 'Sales & Leads', description: 'Financial ROI, a prioritized action queue of hot leads to follow up on, and every captured lead.' },
            { title: 'Conversations', description: 'Every chat session with full transcripts, so you can audit exactly what the bot told people.' },
            { title: 'Funnel & Insights', description: 'A conversion funnel from chat to won deal, lead quality breakdown, and AI-written trend summaries.' },
        ],
    },
    {
        eyebrow: 'Step 4 of 4',
        icon: 'palette',
        title: 'Customize the bot to match your brand',
        paragraphs: [
            "Last, on Customize Bot you can change its avatar, accent color, greeting message, quick-question shortcuts, and tone — all the same controls a paying customer uses to make the widget feel like part of their own site rather than a generic chatbot.",
            "That's the whole loop: train it, verify it, see what it tracks, make it yours. Let's start with training.",
        ],
    },
];

interface DemoOnboardingModalProps {
    onClose: () => void;
}

export default function DemoOnboardingModal({ onClose }: DemoOnboardingModalProps) {
    const router = useRouter();
    const [index, setIndex] = useState(0);
    const [direction, setDirection] = useState(1);
    const isLast = index === PANELS.length - 1;
    const isFirst = index === 0;
    const panel = PANELS[index];

    const goNext = () => {
        if (isLast) {
            onClose();
            router.push('/demo/train');
            return;
        }
        setDirection(1);
        setIndex(i => Math.min(i + 1, PANELS.length - 1));
    };

    const goBack = () => {
        setDirection(-1);
        setIndex(i => Math.max(i - 1, 0));
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') goNext();
            if (e.key === 'ArrowLeft' && !isFirst) goBack();
        };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index]);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="How the demo works">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                    onClick={onClose}
                />
                <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 320, mass: 0.8 }}
                    className="relative w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl bg-white dark:bg-slate-950 shadow-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 flex flex-col"
                >
                    {/* Header — icon + eyebrow + progress dots */}
                    <div className="flex shrink-0 items-start justify-between gap-3 px-6 sm:px-7 pt-6 pb-5 border-b border-slate-100 dark:border-slate-800/70">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                                {panel.icon ? (
                                    <span className="material-symbols-outlined text-[20px]">{panel.icon}</span>
                                ) : (
                                    <VaayuLogo iconOnly size={22} />
                                )}
                            </span>
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">{panel.eyebrow}</p>
                                <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-slate-100 leading-tight mt-0.5">{panel.title}</h2>
                            </div>
                        </div>
                        <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors">
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>

                    {/* Body — animated panel swap */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-6 sm:px-7 py-5 relative min-h-[220px]">
                        <AnimatePresence mode="wait" custom={direction} initial={false}>
                            <motion.div
                                key={index}
                                custom={direction}
                                initial={{ opacity: 0, x: direction * 16 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: direction * -16 }}
                                transition={{ duration: 0.18, ease: 'easeOut' }}
                                className="flex flex-col gap-3.5"
                            >
                                {panel.paragraphs.map((p, i) => (
                                    <p key={i} className="text-[13.5px] text-slate-600 dark:text-slate-300 leading-relaxed">{p}</p>
                                ))}
                                {panel.bullets && (
                                    <ul className="flex flex-col gap-3 mt-1">
                                        {panel.bullets.map((b) => (
                                            <li key={b.title} className="flex items-start gap-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 px-3.5 py-3">
                                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                                                <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    <span className="font-semibold text-slate-900 dark:text-slate-100">{b.title}</span>
                                                    {' — '}{b.description}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Footer — progress dots + Back/Next */}
                    <div className="shrink-0 px-6 sm:px-7 py-5 border-t border-slate-100 dark:border-slate-800/70 flex flex-col gap-4">
                        <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
                            {PANELS.map((_, i) => (
                                <span
                                    key={i}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-blue-600' : 'w-1.5 bg-slate-200 dark:bg-slate-700'}`}
                                />
                            ))}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            {isFirst ? (
                                <button
                                    onClick={onClose}
                                    className="text-[13px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                                >
                                    Skip tutorial
                                </button>
                            ) : (
                                <button
                                    onClick={goBack}
                                    className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                                    Back
                                </button>
                            )}
                            <button
                                onClick={goNext}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-emerald-600 px-6 py-2.5 text-[13px] font-semibold text-white hover:opacity-90 transition-all active:scale-[0.99]"
                            >
                                {isLast ? (
                                    <><span className="material-symbols-outlined text-[17px]">bolt</span> Start training my bot</>
                                ) : isFirst ? (
                                    <>Let's get started <span className="material-symbols-outlined text-[17px]">arrow_forward</span></>
                                ) : (
                                    <>Next <span className="material-symbols-outlined text-[17px]">arrow_forward</span></>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

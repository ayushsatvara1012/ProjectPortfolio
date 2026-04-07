import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

/**
 * DocMedia Component: A premium wrapper for documentation media (images or videos).
 * Provides a beautiful placeholder if the media source is missing.
 */
const DocMedia = ({ alt, placeholderText, src }) => {
    const isVideo = src && /\.(mp4|webm|ogg|mov)$/i.test(src);

    return (
        <div className="group relative aspect-video w-full rounded-xl overflow-hidden my-4 bg-slate-50 dark:bg-slate-900 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/10">
            {src ? (
                isVideo ? (
                    <video
                        src={src}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="metadata"
                        className="absolute -top-8 w-full h-full object-cover"
                    />
                ) : (
                    <img src={src} alt={alt} className="w-full h-full" />
                )
            ) : (
                <div className="w-full h-full bg-linear-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-700 mb-4 select-none">
                        {placeholderText?.toLowerCase().includes('video') || placeholderText?.toLowerCase().includes('recording') ? 'videocam' : 'image'}
                    </span>
                    <p className="text-sm font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest leading-tight max-w-[280px]">
                        {placeholderText || 'Media Placeholder'}
                    </p>
                </div>
            )}
            <div className="absolute bottom-4 right-4 px-3 py-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-100 dark:border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{alt}</span>
            </div>
        </div>
    );
};


const BotIntegrationDocs = ({ apiKey = 'YOUR_API_KEY', apiUrl = 'https://sapyai.onrender.com', standalone = false }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('setup');
    const [copied, setCopied] = useState(false);

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const CodeSnippet = ({ apiKey, apiUrl }) => (
        <div className="font-mono text-sm leading-relaxed overflow-x-auto">
            <div className="flex gap-2">
                <span className="text-pink-400">&lt;script&gt;</span>
            </div>
            <div className="pl-4">
                <span className="text-blue-400">window</span>
                <span className="text-slate-400">.</span>
                <span className="text-blue-300">SaPyBaseConfig</span>
                <span className="text-slate-400"> = {'{'}</span>
            </div>
            <div className="pl-8">
                <span className="text-blue-400">apiKey</span>
                <span className="text-slate-400">:</span>
                <span className="text-emerald-400"> "{apiKey}"</span>
                <span className="text-slate-400">,</span>
            </div>
            <div className="pl-8">
                <span className="text-blue-400">apiUrl</span>
                <span className="text-slate-400">:</span>
                <span className="text-emerald-400"> "{apiUrl}"</span>
            </div>
            <div className="pl-4">
                <span className="text-slate-400">{'}'};</span>
            </div>
            <div className="">
                <span className="text-pink-400">&lt;/script&gt;</span>
            </div>
            <div className="">
                <span className="text-pink-400">&lt;script</span>
            </div>
            <div className="pl-4">
                <span className="text-blue-400">src</span>
                <span className="text-slate-400">=</span>
                <span className="text-emerald-400">"https://www.sapybase.com/widget.js"</span>
            </div>
            <div className="pl-4">
                <span className="text-blue-400">defer</span>
                <span className="text-pink-400">&gt;</span>
            </div>
            <div className="">
                <span className="text-pink-400">&lt;/script&gt;</span>
            </div>
        </div>
    );

//     const snippet = `<script>
//   window.SaPyBaseConfig = {
//     apiKey: "${apiKey}",
//     apiUrl: "${apiUrl}"
//   };
// </script>
// <script 
//   src="https://www.sapybase.com/widget.js" 
//   defer>
// </script>`;

    const navLinks = [
        { id: 'setup', label: '1. Account Setup', icon: 'person_add' },
        { id: 'integration', label: '2. Integration', icon: 'code' },
        { id: 'customization', label: '3. Customization', icon: 'palette' },
        { id: 'training', label: '4. Training AI', icon: 'model_training' },
        { id: 'knowledge', label: '5. Knowledge Base', icon: 'database' },
        { id: 'multiple-bots', label: '6. Managing Bots', icon: 'hub' },
        { id: 'support', label: 'Getting Help', icon: 'support_agent' },
    ];

    const tocLinks = [
        { id: 'setup', label: 'Registration' },
        { id: 'integration', label: 'Website Integration' },
        { id: 'customization', label: 'Branding & Styling' },
        { id: 'training', label: 'Teaching the AI' },
        { id: 'knowledge', label: 'Managing Data' },
        { id: 'multiple-bots', label: 'Agency Mode (Pro)' },
        { id: 'cta', label: 'Ready to start?' },
    ];

    // Simple scroll spy effect
    useEffect(() => {
        const handleScroll = () => {
            const sections = tocLinks.map(link => document.getElementById(link.id));
            const scrollPosition = window.scrollY + 120;

            sections.forEach(section => {
                if (section && scrollPosition >= section.offsetTop) {
                    setActiveSection(section.id);
                }
            });
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollTo = (id) => {
        const element = document.getElementById(id);
        if (element) {
            window.scrollTo({
                top: element.offsetTop - 100,
                behavior: 'smooth'
            });
        }
        setIsMenuOpen(false);
    };

    // If not standalone (embedding in another page), show a simpler card version
    if (!standalone) {
        return (
            <div className="bg-white dark:bg-slate-950 border border-gray-100 dark:border-slate-800 p-8 shadow-sm transition-colors duration-500">
                <div className="flex items-center gap-3 mb-6">
                    <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-2xl">rocket_launch</span>
                    <h3 className="text-xl font-display font-bold text-slate-900 dark:text-slate-200">Final Step: Integration</h3>
                </div>
                <p className="text-xl font-medium tracking-wide text-slate-600 dark:text-slate-400 mb-6 leading-relaxed font-sans transition-colors">
                    Copy the code below and paste it onto your website. Need help? Check our <Link to="/docs" className="text-blue-600 dark:text-blue-400 font-bold underline">full guide</Link>.
                </p>

                <div className="relative group">
                    <div className="p-6 bg-slate-900 text-blue-200 text-sm font-mono overflow-x-auto rounded-none border border-slate-900 shadow-2xl">
                        <CodeSnippet apiKey={apiKey} apiUrl={apiUrl} />
                    </div>
                    <button onClick={() => handleCopy(snippet)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all">
                        <span className="material-symbols-outlined text-lg">{copied ? 'check_circle' : 'content_copy'}</span>
                    </button>
                </div>
            </div>
        );

    }

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col font-sans transition-colors duration-500">
            {/* Mobile Header / Nav */}
            <div className="lg:hidden sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between transition-colors">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600">description</span>
                    <span className="font-display font-black text-slate-900 dark:text-slate-200 tracking-tight">Manual</span>
                </div>
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-600 dark:text-slate-400">
                    <span className="material-symbols-outlined text-2xl">{isMenuOpen ? 'close' : 'menu'}</span>
                </button>
            </div>


            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="fixed inset-0 z-40 lg:hidden bg-white dark:bg-slate-950 pt-20 px-8 transition-colors overflow-y-auto"
                    >
                        <nav className="space-y-6 pb-20">
                            {navLinks.map((link) => (
                                <button
                                    key={link.id}
                                    onClick={() => scrollTo(link.id)}
                                    className="flex items-center gap-4 w-full text-left p-2 text-2xl font-medium"
                                >
                                    <span className="material-symbols-outlined text-green-500">{link.icon}</span>
                                    <span className="text-xl font-bold text-slate-900 dark:text-slate-200">{link.label}</span>
                                </button>
                            ))}
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-8xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 py-12 flex-1">

                {/* ── LEFT COLUMN: Navigation (Hidden on mobile) ── */}
                <aside className="hidden lg:block lg:col-span-3 sticky top-24 h-fit">
                    <h4 className="text-xl uppercase tracking-[0.2em] font-black text-slate-400 dark:text-slate-600 mb-6 ml-4">Features</h4>
                    <nav className="space-y-1">
                        {navLinks.map((link) => (
                            <button
                                key={link.id}
                                onClick={() => scrollTo(link.id)}
                                className={`flex items-center gap-3 w-full px-3 py-2 text-lg font-bold transition-all rounded-lg group ${activeSection === link.id
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                            >
                                <span className={`material-symbols-outlined text-[20px] ${activeSection === link.id ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'} transition-colors`}>
                                    {link.icon}
                                </span>
                                {link.label}
                            </button>

                        ))}
                    </nav>
                </aside>

                {/* ── MIDDLE COLUMN: Content ── */}
                <main className="lg:col-span-6 space-y-24">

                    {/* Welcome Section */}
                    <div className="space-y-6">
                        <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-[10px] font-black text-blue-600 border border-blue-100 dark:border-blue-800 rounded-full mb-2 mt-12 uppercase tracking-widest w-fit">
                            <span className="material-symbols-outlined text-[14px]">auto_awesome</span> Visual Guide
                        </span>
                        <h1 className="text-4xl md:text-5xl font-display font-black text-slate-900 dark:text-slate-200 tracking-tight leading-tight mb-6 transition-colors">
                            The Ultimate Sapybase<br /> <span className="text-transparent bg-clip-text bg-linear-to-r from-green-600 to-blue-600 dark:from-green-400 dark:to-blue-400">AI Chat Integration Manual</span>
                        </h1>
                        <p className="text-xl font-medium tracking-wide text-slate-500 dark:text-slate-400 leading-relaxed font-sans transition-colors">
                            This guide shows you exactly how to build and launch your custom AI chatbot into your website. No technical skills required! Follow the steps below to start automating your customer support.
                        </p>
                    </div>


                    {/* Section 1: Account Setup */}
                    <section id="setup" className="scroll-mt-24 prose prose-slate dark:prose-invert max-w-none">
                        <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-slate-200 mb-6 transition-colors flex items-center gap-3">
                            <span className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center text-sm font-black rounded-full select-none">1</span>
                            Account Setup & Registration
                        </h2>

                        <p className="text-xl font-medium tracking-wide text-slate-600 dark:text-slate-400 leading-relaxed font-sans transition-colors">
                            First things first, you need to create your account and tell us about your business. This helps the AI understand who you are.
                        </p>

                        <ul className="text-xl font-medium space-y-4">
                            <li><strong>Sign Up:</strong> Use your email or Google account to create account in our server.</li>
                            <li><strong>Sign In:</strong> Use your email or Google account to sign in to our server.</li>
                            <li><strong>Chatbot ID:</strong> We automatically create a "house" for your data so everything stays safe.</li>
                        </ul>
                        <DocMedia
                            alt="Registration Screen"
                            placeholderText="Screen Recording: Walking through the Registration Screen showing the Business Name input and account setup fields."
                            src="/videos/registration_sapybase.mp4"
                        />
                        <ul className="text-xl font-medium space-y-4">
                            <li>After successful registration, you will be redirected to the dashboard.</li>
                            <li><strong>Subscribe to a plan:</strong> Choose a plan that suits your needs and subscribe to it. Initially you will get to try the "beta version" on basic plan. To try advanced features you can upgrade to premium plan.</li>
                            <li><strong>Business Profile:</strong> Give your chatbot a company name (e.g., "Sapybase LLC") and provide your website URL.</li>
                        </ul>
                        <DocMedia
                            alt="Registration Screen"
                            placeholderText="Screen Recording: Walking through the Registration Screen showing the Business Name input and account setup fields."
                            src="/videos/Bot_Creation.mp4"
                        />
                    </section>

                    {/* Section 2: Integration */}
                    <section id="integration" className="scroll-mt-24 prose prose-slate dark:prose-invert max-w-none">
                        <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-slate-200 mb-6 transition-colors flex items-center gap-3">
                            <span className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center text-sm font-black rounded-full select-none">2</span>
                            Integrating the Chatbot
                        </h2>

                        <p className="text-xl font-medium tracking-wide text-slate-600 dark:text-slate-400 leading-relaxed font-sans transition-colors">
                            Adding the chatbot to your website is as simple as copying and pasting a single line of code.
                        </p>

                        <div className="bg-slate-50 dark:bg-slate-900 p-6 border border-gray-100 dark:border-slate-800 rounded-xl my-6">
                            <p className="font-bold text-slate-900 dark:text-slate-200 mb-2">How to install:</p>
                            <ol className="space-y-2 text-xl font-medium">
                                <li>Copy your <strong>Script</strong> right after creation of the bot from the Bot Identity section, which is located in the sidebar.</li>
                                <li>Copy the <strong>Embed Code</strong> shown in the above video (in the last).</li>
                                <li>Paste it into your websites index.html or whichever file is the entry point of your website just above the <code>&lt;/body&gt;</code> tag.</li>
                            </ol>
                        </div>
                        <DocMedia
                            alt="Dashboard Snippet"
                            placeholderText="Screen Recording: Showing how to copy the Snippet and find the API Key in the Dashboard."
                            src="/videos/Integrate_Bot.mp4"
                        />
                        <div className="relative group">
                            <div className="p-6 bg-slate-900 text-blue-200 text-sm font-mono overflow-x-auto rounded-none border border-slate-900 shadow-2xl transition-all">
                                <CodeSnippet apiKey={apiKey} apiUrl={apiUrl} />
                            </div>
                            <button onClick={() => handleCopy(snippet)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">{copied ? 'check_circle' : 'content_copy'}</span>
                            </button>
                        </div>

                    </section>

                    {/* Section 3: Customization */}
                    <section id="customization" className="scroll-mt-24 prose prose-slate dark:prose-invert max-w-none">
                        <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-slate-200 mb-6 transition-colors flex items-center gap-3">
                            <span className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center text-sm font-black rounded-full select-none">3</span>
                            Customizing Look & Feel
                        </h2>
                        <p className="text-xl font-medium tracking-wide text-slate-600 dark:text-slate-400 leading-relaxed font-sans transition-colors">
                            You don't need to be a designer to make your bot look amazing. Every change you make in the dashboard updates your website <strong>instantly</strong>.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
                            <div className="p-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl">
                                <span className="material-symbols-outlined text-blue-500 text-3xl mb-4">palette</span>
                                <h4 className="font-bold mb-2">Brand Colors</h4>
                                <p className="text-2xl font-semibold font-sans text-slate-300">Pick any color for your chat bubbles and buttons.</p>
                            </div>
                            <div className="p-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl">
                                <span className="material-symbols-outlined text-blue-500 text-3xl mb-4">edit_note</span>
                                <h4 className="font-bold mb-2">Welcome Text</h4>
                                <p className="text-2xl font-semibold font-sans text-slate-300">" Write a friendly greeting message for your visitors."</p>
                            </div>
                        </div>

                        <DocMedia
                            alt="Customization Settings"
                            placeholderText="Screen Recording: Moving through the Settings tab, changing colors, and uploading a logo with instant preview."
                            src="/videos/Customise_Bot.mp4"
                        />
                    </section>

                    {/* Section 4: Training AI */}
                    <section id="training" className="scroll-mt-24 prose prose-slate dark:prose-invert max-w-none">
                        <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-slate-200 mb-6 transition-colors flex items-center gap-3">
                            <span className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center text-sm font-black rounded-full select-none">4</span>
                            Training the AI
                        </h2>

                        <p className="text-xl font-medium tracking-wide text-slate-600 dark:text-slate-400 leading-relaxed font-sans transition-colors">
                            To make your bot smart, you need to "train" it with your business information. You can do this in two ways:
                        </p>

                        <ul className="space-y-4 text-xl font-medium">
                            <li><strong>Upload Files:</strong> Drop in your PDFs, Word docs, or manuals. The AI will read every page.</li>
                            <li><strong>Website Sync:</strong> Paste your website URL, and the AI will crawl it to learn your latest updates.</li>
                        </ul>
                        <DocMedia
                            alt="Training Interface"
                            placeholderText="Screen Recording: How to use the URL crawler and drag-and-drop file upload for training the AI."
                            src="/videos/Train_Bot.mp4"
                        />
                    </section>

                    {/* Section 5: Managing Knowledge */}
                    <section id="knowledge" className="scroll-mt-24 prose prose-slate dark:prose-invert max-w-none">
                        <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-slate-200 mb-6 transition-colors flex items-center gap-3">
                            <span className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center text-sm font-black rounded-full select-none">5</span>
                            Managing Knowledge
                        </h2>

                        <p className="text-xl font-medium tracking-wide text-slate-600 dark:text-slate-400 leading-relaxed font-sans transition-colors">
                            Business details change (like pricing or store hours). When they do, you can easily remove old information to keep your bot accurate.
                        </p>

                        <div className="flex items-start gap-4 p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl my-6">
                            <span className="material-symbols-outlined text-red-600">warning</span>
                            <p className="text-xl font-medium text-red-800 dark:text-red-400 m-0">
                                Be careful! Deleting a "knowledge chunk" means the AI will forget that specific piece of information forever.
                            </p>
                        </div>
                        <DocMedia
                            alt="Knowledge Base Management"
                            placeholderText="Screen Recording: Managing the Knowledge Base, reviewing chunks, and deleting outdated information."
                        />
                    </section>

                    {/* Section 6: Multiple Bots */}
                    <section id="multiple-bots" className="scroll-mt-24 prose prose-slate dark:prose-invert max-w-none">
                        <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-slate-200 mb-6 transition-colors flex items-center gap-3">
                            <span className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center text-sm font-black rounded-full select-none">6</span>
                            Managing Multiple Bots (Pro)
                        </h2>

                        <p className="text-xl font-medium tracking-wide text-slate-600 dark:text-slate-400 leading-relaxed font-sans transition-colors">
                            Do you run multiple businesses? Our Pro plan lets you create and switch between entirely separate bots from a single dashboard.
                        </p>

                        <p className="text-xl font-medium tracking-wide text-slate-600 dark:text-slate-400 leading-relaxed font-sans transition-colors">
                            Each bot has its own name, its own training data, and its own unique look. You can switch between them in seconds using the <strong>Bot Manager</strong> dropdown at the top.
                        </p>

                        <DocMedia
                            alt="Agency Bot Manager"
                            placeholderText="Screen Recording: Switching between multiple bots and creating a new bot instance in Agency Mode."
                            src="/Manage_Bot.png"
                            className="absolute w-full h-auto -top-10"
                        />
                    </section>

                    {/* Support */}
                    <section id="support" className="scroll-mt-24 bg-slate-900 dark:bg-blue-900/20 p-12 text-white text-center rounded-none relative overflow-hidden transition-colors">
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,#fff,transparent)]" />
                        <span className="material-symbols-outlined text-6xl mb-6 select-none opacity-50">help</span>
                        <h3 className="text-2xl font-display font-bold mb-4 text-slate-50">Need a hand to get started?</h3>
                        <p className="text-xl font-medium tracking-wide text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed font-sans transition-colors">
                            If you get stuck or just want a human to talk you through it, our team is always just a message away.
                        </p>

                        <Link to="/contact" className="inline-flex px-8 py-4 bg-white text-blue-900 font-black uppercase tracking-widest text-sm transition-transform hover:scale-105 active:scale-95 shadow-xl">
                            Message Support
                        </Link>
                    </section>


                    {/* ── THE GRAND CTA ── */}
                    <section id="cta" className="relative p-12 bg-linear-to-br from-blue-600 via-blue-700 to-green-800 text-white overflow-hidden scroll-mt-24 group transition-colors shadow-2xl">
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,white,transparent)] transition-opacity" />
                        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />

                        <div className="relative z-10 text-center space-y-8">
                            <h2 className="text-3xl md:text-5xl font-display font-black tracking-tight leading-tight text-slate-50">
                                Ready to automate your <br /> customer support?
                            </h2>
                            <p className="text-xl font-medium tracking-wide text-blue-100 opacity-90 max-w-2xl mx-auto leading-relaxed font-sans transition-colors">
                                Join thousands of smart business owners who save 20 hours a week with our AI chatbots.
                            </p>

                            <div className="flex justify-center pt-4">
                                <Link to="/app/pricing" className="relative group/btn inline-flex">
                                    <div className="absolute -inset-0.5 bg-white rounded-none blur opacity-30 group-hover/btn:opacity-60 transition-opacity animate-pulse" />
                                    <button className="text-xl relative px-10 py-5 bg-white text-blue-700 hover:text-blue-600 text-md uppercase tracking-[0.2em] font-black transition-all group-hover/btn:translate-y-[-2px] active:scale-95 shadow-2xl">
                                        Get your AI Chatbot now
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </section>


                </main>

                {/* ── RIGHT COLUMN: TOC (Hidden on mobile) ── */}
                <aside className="hidden lg:block lg:col-span-3 sticky top-24 h-fit border-l border-gray-100 dark:border-slate-800 pl-8 transition-colors">
                    <div className="space-y-1">
                        <h4 className="text-xl uppercase tracking-[0.2em] font-black text-slate-400 dark:text-slate-600 mb-6">On this page</h4>
                        {tocLinks.map((link) => (
                            <button
                                key={link.id}
                                onClick={() => scrollTo(link.id)}
                                className={`block py-1.5 text-lg font-bold transition-all w-full text-left border-l-2 pl-4 -ml-[33px] ${activeSection === link.id
                                        ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50/30'
                                        : 'text-slate-400 dark:text-slate-600 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                            >

                                {link.label}
                            </button>
                        ))}
                    </div>
                </aside>

            </div>

            {/* Footer-ish back link */}
            <div className="border-t border-gray-100 dark:border-slate-800 py-12 bg-gray-50/50 dark:bg-slate-900/50 mt-12 transition-colors">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
                    <Link to="/" className="text-lg font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined">arrow_back</span> Back to home page
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default BotIntegrationDocs;


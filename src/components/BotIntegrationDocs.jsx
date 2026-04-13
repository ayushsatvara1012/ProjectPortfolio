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
    const [integrationTab, setIntegrationTab] = useState('html');

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const SyntaxHighlightedCode = ({ code }) => {
        // One-pass replacement to avoid double-highlighting
        const tokens = [
            { name: 'doctype', regex: /(&lt;!DOCTYPE html&gt;)/gi, color: 'text-blue-400' },
            { name: 'comment', regex: /(&lt;!--[\s\S]*?--&gt;|\{\/\*[\s\S]*?\*\/\}|\/\/.*)/g, color: 'text-slate-500 italic' },
            { name: 'string', regex: /(&quot;.*?&quot;|&#39;.*?&#39;|".*?"|'.*?'|`[\s\S]*?`)/g, color: 'text-green-400' },
            { name: 'tag', regex: /(&lt;\/?[a-zA-Z0-9]+)/g, color: 'text-red-400' },
            { name: 'attr', regex: /\b(lang|src|defer|href|rel|target|id|strategy|type|apiKey|apiUrl|className)\b(?==|:|\s|&gt;)/g, color: 'text-orange-300' },
            { name: 'keyword', regex: /\b(window|SaPyBaseConfig|document|console|Script|import|export|default|function|return|const|let|var|from)\b/g, color: 'text-blue-400' }
        ];

        let escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // We use a temporary map to hold segments to avoid re-processing
        let segments = [{ text: escaped, isRaw: true }];

        tokens.forEach(token => {
            let newSegments = [];
            segments.forEach(seg => {
                if (!seg.isRaw) {
                    newSegments.push(seg);
                    return;
                }

                let lastIndex = 0;
                let match;
                while ((match = token.regex.exec(seg.text)) !== null) {
                    // Pre-match text
                    if (match.index > lastIndex) {
                        newSegments.push({ text: seg.text.substring(lastIndex, match.index), isRaw: true });
                    }
                    // The match
                    newSegments.push({
                        text: `<span class="${token.color}">${match[0]}</span>`,
                        isRaw: false
                    });
                    lastIndex = token.regex.lastIndex;
                    if (!token.regex.global) break;
                }
                // Post-match text
                if (lastIndex < seg.text.length) {
                    newSegments.push({ text: seg.text.substring(lastIndex), isRaw: true });
                }
            });
            segments = newSegments;
        });

        const finalHtml = segments.map(s => s.text).join('');

        return (
            <div className="relative group mt-4">
                <div className="p-4 bg-slate-900 text-slate-50 text-[13px] sm:text-sm font-mono overflow-x-auto rounded-lg shadow-inner">
                    <pre className="m-0 leading-relaxed"><code dangerouslySetInnerHTML={{ __html: finalHtml }} /></pre>
                </div>
                <button
                    onClick={() => handleCopy(code)}
                    className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center bg-slate-800/80 hover:bg-slate-700 text-white rounded-none opacity-0 group-hover:opacity-100 transition-opacity border border-slate-700/50 backdrop-blur-sm"
                    title="Copy to clipboard"
                >
                    <span className="material-symbols-outlined text-[20px] leading-none">{copied ? 'check_circle' : 'content_copy'}</span>
                </button>
            </div>
        );
    };

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
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-200 tracking-tight">Final Step: Integration</h3>
                </div>
                <p className="text-lg font-google tracking-wide text-slate-600 dark:text-slate-400 mb-6 leading-relaxed transition-colors">
                    Copy the code below and paste it onto your website. Need help? Check our <Link to="/docs" className="text-blue-600 dark:text-blue-400 font-bold underline">full guide</Link>.
                </p>

                <SyntaxHighlightedCode code={`<!-- Place this inside the <head> -->
<script>
  window.SaPyBaseConfig = {
    apiKey: "${apiKey}",
    apiUrl: "${apiUrl}"
  };
</script>
<script src="https://www.sapybase.com/widget.js" defer></script>`} />
            </div>
        );

    }

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col font-google transition-colors duration-500">
            {/* Mobile Header / Nav */}
            <div className="lg:hidden sticky top-16 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between transition-all">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600">description</span>
                    <span className="font-google font-bold text-slate-900 dark:text-slate-200 tracking-wide">Manual</span>
                </div>
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-600 dark:text-slate-400">
                    <span className="material-symbols-outlined text-2xl">{isMenuOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</span>
                </button>

                {/* Mobile Menu Dropdown */}
                <AnimatePresence>
                    {isMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-[calc(100%+8px)] left-4 right-4 z-40 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden transition-colors"
                        >
                            <nav className="p-2 space-y-1">
                                {navLinks.map((link) => (
                                    <button
                                        key={link.id}
                                        onClick={() => scrollTo(link.id)}
                                        className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-colors ${activeSection === link.id
                                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                                            }`}
                                    >
                                        <span className={`material-symbols-outlined ${activeSection === link.id ? 'text-blue-600' : 'text-slate-400'}`}>{link.icon}</span>
                                        <span className="text-md font-google">{link.label}</span>
                                    </button>
                                ))}
                            </nav>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="max-w-8xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 py-12 px-3 flex-1">

                {/* ── LEFT COLUMN: Navigation (Hidden on mobile) ── */}
                <aside className="hidden lg:block lg:col-span-3 sticky top-24 h-fit">
                    <h4 className="text-lg uppercase tracking-[0.2em] font-google text-slate-400 dark:text-slate-600 mb-6 ml-4">Features</h4>
                    <nav className="space-y-1">
                        {navLinks.map((link) => (
                            <button
                                key={link.id}
                                onClick={() => scrollTo(link.id)}
                                className={`flex items-center gap-3 w-full px-3 py-2 text-lg font-google transition-all rounded-lg group ${activeSection === link.id
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
                <main className="lg:col-span-6 space-y-12">

                    {/* Welcome Section */}
                    <div className="space-y-6">
                        <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-[10px] font-black text-blue-600 border border-blue-100 dark:border-blue-800 rounded-full mb-2 mt-12 uppercase tracking-widest w-fit">
                            <span className="material-symbols-outlined text-[14px]">auto_awesome</span> Visual Guide
                        </span>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-slate-200 tracking-tight leading-tight mb-3 transition-colors">
                            The Ultimate Sapybase<br /> <span className="text-transparent bg-clip-text bg-linear-to-r from-green-600 to-blue-600 dark:from-green-400 dark:to-blue-400">AI Chat Integration Manual</span>
                        </h1>
                        <p className="text-lg font-google tracking-wide text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                            This guide shows you exactly how to build and launch your custom AI chatbot into your website. No technical skills required! Follow the steps below to start automating your customer support.
                        </p>
                    </div>


                    {/* Section 1: Account Setup */}
                    <section id="setup" className="scroll-mt-24 prose prose-slate dark:prose-invert max-w-none">
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-200 mb-6 transition-colors flex items-center gap-3 tracking-tight">
                            <span className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center text-sm font-black rounded-full select-none">1</span>
                            Account Setup & Registration
                        </h2>

                        <p className="text-lg font-google tracking-wide text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
                            First things first, you need to create your account and tell us about your business. This helps the AI understand who you are.
                        </p>

                        <ul className="text-lg font-google space-y-4">
                            <li><strong>Sign Up:</strong> Use your email or Google account to create account in our server.</li>
                            <li><strong>Sign In:</strong> Use your email or Google account to sign in to our server.</li>
                            <li><strong>Chatbot ID:</strong> We automatically create a "house" for your data so everything stays safe.</li>
                        </ul>
                        <DocMedia
                            alt="Registration Screen"
                            placeholderText="Screen Recording: Walking through the Registration Screen showing the Business Name input and account setup fields."
                            src="/videos/registration_sapybase.mp4"
                        />
                        <ul className="text-lg font-google space-y-4">
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
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-200 mb-6 transition-colors flex items-center gap-3 tracking-tight">
                            <span className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center text-sm font-black rounded-full select-none">2</span>
                            Integrating the Chatbot
                        </h2>

                        <p className="text-lg font-google tracking-wide text-slate-600 dark:text-slate-400 leading-relaxed transition-colors mb-6">
                            Adding the chatbot to your website is as simple as copying and pasting a single snippet of code. Select your platform below for specific instructions.
                        </p>

                        {/* Tabs Navigation */}
                        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-100 dark:border-slate-800 pb-4">
                            {[
                                { id: 'html', label: 'Static HTML' },
                                { id: 'react', label: 'React / Vite' },
                                { id: 'nextjs', label: 'Next.js' },
                                { id: 'wordpress', label: 'WordPress' },
                                { id: 'shopify', label: 'Shopify' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setIntegrationTab(tab.id)}
                                    className={`px-4 py-2 text-sm font-google font-bold rounded-lg transition-colors ${integrationTab === tab.id
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="bg-gray-50 dark:bg-slate-900/30 p-6 rounded-xl border border-gray-100 dark:border-slate-800 mb-8">

                            {integrationTab === 'html' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-slate-200 mb-2 mt-0">Plain HTML / Static Websites</h3>
                                        <p className="text-lg text-slate-600 dark:text-slate-400 font-google mb-0">For traditional websites built with HTML, CSS, and basic JavaScript.</p>
                                    </div>
                                    <ul className="text-lg font-google space-y-3 mt-4">
                                        <li className="flex items-start gap-3"><span className="material-symbols-outlined text-orange-500 text-[20px] mt-0.5">folder</span> <span><strong>File to edit:</strong> <code>index.html</code> (or your main layout file).</span></li>
                                        <li className="flex items-start gap-3"><span className="material-symbols-outlined text-orange-500 text-[20px] mt-0.5">place</span> <span><strong>Where to paste:</strong> Right before the closing <code>&lt;/body&gt;</code> tag to avoid blocking your site from loading.</span></li>
                                    </ul>
                                    <SyntaxHighlightedCode code={`<!DOCTYPE html>
<html lang="en">
<head>
    <title>My Website</title>
</head>
<body>
    <h1>Welcome to my business</h1>
    <script>
      window.SaPyBaseConfig = {
        apiKey: "YOUR_API_KEY",
        apiUrl: "https://sapyai.onrender.com"
      };
    </script>
    <script src="https://www.sapybase.com/widget.js" defer></script>
</body>
</html>`} />
                                </div>
                            )}

                            {integrationTab === 'react' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-slate-200 mb-2 mt-0">React (Vite or CRA)</h3>
                                        <p className="text-lg text-slate-600 dark:text-slate-400 font-google mb-0">In a Single Page Application (SPA), add the script to the root HTML file that wraps your React app—<strong>not</strong> inside your React components.</p>
                                    </div>
                                    <ul className="text-lg font-google space-y-3 mt-4">
                                        <li className="flex items-start gap-3"><span className="material-symbols-outlined text-blue-500 text-[20px] mt-0.5">folder</span> <span><strong>File to edit (Vite):</strong> <code>index.html</code> (in the root folder).</span></li>
                                        <li className="flex items-start gap-3"><span className="material-symbols-outlined text-blue-500 text-[20px] mt-0.5">folder</span> <span><strong>File to edit (CRA):</strong> <code>public/index.html</code>.</span></li>
                                        <li className="flex items-start gap-3"><span className="material-symbols-outlined text-blue-500 text-[20px] mt-0.5">place</span> <span><strong>Where to paste:</strong> Below the <code>&lt;div id="root"&gt;&lt;/div&gt;</code> tag, before the closing <code>&lt;/body&gt;</code> tag.</span></li>
                                    </ul>
                                    <SyntaxHighlightedCode code={`<body>
    <div id="root"></div>
    
    <script>
      window.SaPyBaseConfig = {
        apiKey: "YOUR_API_KEY",
        apiUrl: "https://sapyai.onrender.com"
      };
    </script>
    <script src="https://www.sapybase.com/widget.js" defer></script>
    
    <script type="module" src="/src/main.jsx"></script>
</body>`} />
                                </div>
                            )}

                            {integrationTab === 'nextjs' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-slate-200 mb-2 mt-0">Next.js (App Router)</h3>
                                        <p className="text-lg text-slate-600 dark:text-slate-400 font-google mb-0">Next.js requires the optimized <code>Script</code> component to load external files without hurting SEO or performance.</p>
                                    </div>
                                    <ul className="text-lg font-google space-y-3 mt-4">
                                        <li className="flex items-start gap-3"><span className="material-symbols-outlined text-black dark:text-white text-[20px] mt-0.5">deployed_code</span> <span><strong>File to edit:</strong> <code>app/layout.jsx</code> or <code>app/layout.tsx</code></span></li>
                                        <li className="flex items-start gap-3"><span className="material-symbols-outlined text-black dark:text-white text-[20px] mt-0.5">place</span> <span><strong>Where to paste:</strong> Inside the <code>&lt;body&gt;</code> tag using <code>next/script</code>.</span></li>
                                    </ul>
                                    <SyntaxHighlightedCode code={`import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}

        {/* SaPyBase Configuration */}
        <Script id="sapybase-config" strategy="beforeInteractive">
          {\`
            window.SaPyBaseConfig = {
              apiKey: "YOUR_API_KEY",
              apiUrl: "https://sapyai.onrender.com"
            };
          \`}
        </Script>
        
        {/* SaPyBase Widget Script */}
        <Script 
          src="https://www.sapybase.com/widget.js" 
          strategy="lazyOnload" 
        />
      </body>
    </html>
  );
}`} />
                                </div>
                            )}

                            {integrationTab === 'wordpress' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-slate-200 mb-2 mt-0">WordPress Integration</h3>
                                        <p className="text-lg text-slate-600 dark:text-slate-400 font-google mb-0">There are two simple ways to add the widget to your WordPress site.</p>
                                    </div>

                                    <div className="mt-8 space-y-8">
                                        <div className="bg-white dark:bg-slate-950 p-6 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm transition-colors duration-500">
                                            <h4 className="text-lg font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-4 mt-0">Method A (No-Code Plugin)</h4>
                                            <ul className="text-lg font-google space-y-3">
                                                <li className="flex items-start gap-3"><span className="material-symbols-outlined text-slate-400 text-[20px] mt-0.5">extension</span> <span><strong>Where to go:</strong> Install the free "WPCode" (Insert Headers and Footers) plugin.</span></li>
                                                <li className="flex items-start gap-3"><span className="material-symbols-outlined text-slate-400 text-[20px] mt-0.5">place</span> <span><strong>Where to paste:</strong> Go to <em>Code Snippets {'>'} Header & Footer</em>. Paste the entire snippet into the <strong>Footer</strong> box and hit Save.</span></li>
                                            </ul>
                                        </div>

                                        <div className="bg-white dark:bg-slate-950 p-6 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm transition-colors duration-500">
                                            <h4 className="text-lg font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-4 mt-0">Method B (Theme Editor)</h4>
                                            <ul className="text-lg font-google space-y-3">
                                                <li className="flex items-start gap-3"><span className="material-symbols-outlined text-slate-400 text-[20px] mt-0.5">folder</span> <span><strong>File to edit:</strong> <code>footer.php</code> (via <em>Appearance {'>'} Theme File Editor</em>).</span></li>
                                                <li className="flex items-start gap-3"><span className="material-symbols-outlined text-slate-400 text-[20px] mt-0.5">place</span> <span><strong>Where to paste:</strong> Right above the <code>&lt;/body&gt;</code> and <code>&lt;/html&gt;</code> tags.</span></li>
                                            </ul>
                                        </div>
                                    </div>

                                    <SyntaxHighlightedCode code={`<script>
  window.SaPyBaseConfig = {
    apiKey: "YOUR_API_KEY",
    apiUrl: "https://sapyai.onrender.com"
  };
</script>
<script src="https://www.sapybase.com/widget.js" defer></script>`} />
                                </div>
                            )}

                            {integrationTab === 'shopify' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-slate-200 mb-2 mt-0">Shopify Store</h3>
                                        <p className="text-lg text-slate-600 dark:text-slate-400 font-google mb-0">For e-commerce stores running on Shopify.</p>
                                    </div>
                                    <ul className="text-lg font-google space-y-3 mt-4">
                                        <li className="flex items-start gap-3"><span className="material-symbols-outlined text-emerald-600 text-[20px] mt-0.5">folder</span> <span><strong>File to edit:</strong> <code>theme.liquid</code></span></li>
                                        <li className="flex items-start gap-3"><span className="material-symbols-outlined text-emerald-600 text-[20px] mt-0.5">navigation</span> <span><strong>Where to go:</strong> Online Store {'>'} Themes {'>'} Click "..." menu {'>'} Edit Code. Find <code>theme.liquid</code> under the Layout folder.</span></li>
                                        <li className="flex items-start gap-3"><span className="material-symbols-outlined text-emerald-600 text-[20px] mt-0.5">place</span> <span><strong>Where to paste:</strong> Scroll to the very bottom and paste right above the <code>&lt;/body&gt;</code> tag.</span></li>
                                    </ul>
                                    <SyntaxHighlightedCode code={`    <script>
      window.SaPyBaseConfig = {
        apiKey: "YOUR_API_KEY",
        apiUrl: "https://sapyai.onrender.com"
      };
    </script>
    <script src="https://www.sapybase.com/widget.js" defer></script>
  </body>
</html>`} />
                                </div>
                            )}
                        </div>

                        <DocMedia
                            alt="Dashboard Snippet Copy"
                            placeholderText="Screen Recording: Showing how to copy the Snippet and find the API Key in the Dashboard."
                            src="/videos/Integrate_Bot.mp4"
                        />
                    </section>

                    {/* Section 3: Customization */}
                    <section id="customization" className="scroll-mt-24 prose prose-slate dark:prose-invert max-w-none">
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-200 mb-6 transition-colors flex items-center gap-3 tracking-tight">
                            <span className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center text-sm font-black rounded-full select-none">3</span>
                            Customizing Look & Feel
                        </h2>
                        <p className="text-lg font-google tracking-wide text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
                            You don't need to be a designer to make your bot look amazing. Every change you make in the dashboard updates your website <strong>instantly</strong>.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
                            <div className="relative overflow-hidden p-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl group transition-all duration-300">
                                <span className="material-symbols-outlined absolute -right-12 -bottom-12 text-transparent bg-clip-text bg-conic/decreasing from-violet-700/10 via-lime-300/10 to-violet-700/10 block pointer-events-none select-none z-0" style={{ fontSize: '240px', lineHeight: '1' }}>
                                    palette
                                </span>
                                <div className="relative z-10">
                                    <h4 className="font-google font-bold text-xl mb-2">Brand Colors</h4>
                                    <p className="text-2xl font-google font-semibold text-slate-400 dark:text-slate-500"><span className="text-transparent bg-clip-text bg-linear-to-r from-red-500 to-yellow-500">Pick any color</span> for your <span className="text-transparent bg-clip-text bg-linear-to-r from-yellow-500 to-green-500">chat bubbles</span> and buttons.</p>
                                </div>
                            </div>
                            <div className="relative overflow-hidden p-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl group transition-all duration-300">
                                <span className="material-symbols-outlined absolute -right-12 -bottom-12 text-transparent bg-clip-text bg-linear-to-br from-blue-500/10 to-emerald-500/10 block pointer-events-none select-none z-0" style={{ fontSize: '240px', lineHeight: '1' }}>
                                    edit_note
                                </span>
                                <div className="relative z-10">
                                    <h4 className="font-google font-bold text-xl mb-2">Welcome Text</h4>
                                    <p className="text-2xl font-google font-semibold text-slate-400 dark:text-slate-500">" Write a friendly greeting message for your visitors."</p>
                                </div>
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
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-200 mb-6 transition-colors flex items-center gap-3 tracking-tight">
                            <span className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center text-sm font-black rounded-full select-none">4</span>
                            Training the AI
                        </h2>

                        <p className="text-lg font-google tracking-wide text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
                            To make your bot smart, you need to "train" it with your business information. You can do this in two ways:
                        </p>

                        <ul className="space-y-4 text-lg font-google">
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
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-200 mb-6 transition-colors flex items-center gap-3 tracking-tight">
                            <span className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center text-sm font-black rounded-full select-none">5</span>
                            Managing Knowledge
                        </h2>

                        <p className="text-lg font-google tracking-wide text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
                            Business details change (like pricing or store hours). When they do, you can easily remove old information to keep your bot accurate.
                        </p>

                        <div className="flex items-start gap-4 p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl my-6">
                            <span className="material-symbols-outlined text-red-600">warning</span>
                            <p className="text-lg font-google text-red-800 dark:text-red-400 m-0">
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
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-200 mb-6 transition-colors flex items-center gap-3 tracking-tight">
                            <span className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center text-sm font-black rounded-full select-none">6</span>
                            Managing Multiple Bots (Pro)
                        </h2>

                        <p className="text-lg font-google tracking-wide text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
                            Do you run multiple businesses? Our Pro plan lets you create and switch between entirely separate bots from a single dashboard.
                        </p>

                        <p className="text-lg font-google tracking-wide text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
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
                        <h3 className="text-2xl font-bold mb-4 text-slate-50 tracking-tight">Need a hand to get started?</h3>
                        <p className="text-lg font-google tracking-wide text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed transition-colors">
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
                            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight text-slate-50">
                                Ready to automate your <br /> customer support?
                            </h2>
                            <p className="text-lg font-google tracking-wide text-blue-100 opacity-90 max-w-2xl mx-auto leading-relaxed transition-colors">
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
                        <h4 className="text-lg uppercase tracking-[0.2em] font-google text-slate-400 dark:text-slate-600 mb-6">On this page</h4>
                        {tocLinks.map((link) => (
                            <button
                                key={link.id}
                                onClick={() => scrollTo(link.id)}
                                className={`block py-1.5 text-lg font-google transition-all w-full text-left border-l-2 pl-4 -ml-[33px] ${activeSection === link.id
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


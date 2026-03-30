import React, { useState } from 'react';
import { Mail, MessageSquare, Send, Zap, Terminal, ChevronDown } from 'lucide-react';
import Alert from '../components/alert';
import SEO from '../components/Seo';
import seoConfig from '../seo/seoConfig';

function ContactPage() {
  const [activeFaq, setActiveFaq] = useState(null);
  const [alertConfig, setAlertConfig] = useState({ open: false, type: 'success', msg: '' });

  const showError = (event) => {
    event.preventDefault();
    setAlertConfig({ open: true, type: 'error', msg: 'No Status at the moment' })
    setTimeout(() => setAlertConfig({ open: false }), 3000)
  }
  const showDev = (event) => {
    event.preventDefault();
    setAlertConfig({ open: true, type: 'development', msg: 'Try using our whatsapp' })
    setTimeout(() => setAlertConfig({ open: false }), 3000)
  }

  const faqs = [
    { q: "What we do?", a: "We build custom web applications and AI solutions for businesses." },
    { q: "How long it takes?", a: "It depends on the complexity of the project. Basic Websites with 3-5 pages takes 1 week" },
    { q: "What is your stack?", a: "We use Python, React, Next.js, FastAPI, PostgreSQL, Supabase, AWS, Docker and other modern technologies." }
  ];

  return (
    <>
      <SEO {...seoConfig.contact} />
      <section id="contact" className="relative py-12 sm:py-20 bg-white dark:bg-slate-950 overflow-hidden">
        {/* Background Grid - Scaled for Mobile */}
        <div className="absolute inset-0 opacity-[0.2] dark:opacity-[0.1] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(var(--color-border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--color-border-subtle) 1px, transparent 1px)', backgroundSize: 'clamp(20px, 5vw, 40px) clamp(20px, 5vw, 40px)' }} />

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          {/* Header - Centered on Mobile, Left-aligned on Desktop */}
          <div className="my-10 text-center sm:mb-10 sm:mt-0 lg:mb-10 lg:mt-0 lg:text-left">
            <div className="inline-flex items-center gap-2 px-2 py-1 rounded-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-4">
              <Terminal size={16} className='text-indigo-600' />
              <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500">Sapybase_v2.0</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-slate-200">
              Let's <span className="text-indigo-600">Connect.</span>
            </h1>
          </div>

          <div className="flex flex-col-reverse lg:grid lg:grid-cols-2 gap-8 lg:gap-16 items-start">
            {/* LEFT: FAQ & Contact Nodes */}
            <div className="w-full space-y-6">
              <div className="space-y-3">
                <h2 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 text-center lg:text-left">Frequently Asked Questions</h2>
                {faqs.map((faq, i) => (
                  <div key={i} className="rounded-none border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900 overflow-hidden transition-all">
                    <button
                      onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                      className="w-full px-5 py-4 flex items-center justify-between text-left group"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-200 text-sm tracking-tight">{faq.q}</span>
                      <ChevronDown className={`transition-transform duration-300 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 ${activeFaq === i ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''}`} size={16} />
                    </button>
                    <div className={`px-5 transition-all duration-300 ease-in-out ${activeFaq === i ? 'pb-5 max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
                      <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed border-l-2 border-slate-200 dark:border-slate-800 pl-4">{faq.a}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1">
                <div type='button' onClick={showError} className="p-4 rounded-none bg-emerald-50 dark:bg-emerald-900/20 border border-dashed border-emerald-200 dark:border-emerald-800/40 flex flex-row items-center justify-center text-center gap-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors text-emerald-600 dark:text-emerald-400 cursor-pointer">
                  <MessageSquare size={18} />
                  <span className="text-[10px] uppercase tracking-widest font-bold">Track Your Project Status</span>
                </div>
              </div>
            </div>

            {/* RIGHT: Form Terminal */}
            <div className="w-full relative">
              <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Zap className="text-indigo-600" size={20} />
                  <h3 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200">Project Briefing</h3>
                </div>

                <form className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 ml-1">Your Identity</label>
                      <input type="text" placeholder="Name" className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-none px-4 py-3 text-sm focus:ring-0 focus:border-slate-900 transition-colors outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 ml-1">Channel</label>
                      <input type="email" placeholder="Email" className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-none px-4 py-3 text-sm focus:ring-0 focus:border-slate-900 transition-colors outline-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 ml-1">Architecture Overview</label>
                    <textarea rows="4" placeholder="Describe your vision..." className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-none px-4 py-3 text-sm focus:ring-0 focus:border-slate-900 transition-colors outline-none resize-none"></textarea>
                  </div>
                  <button onClick={showDev} type='button' className="w-full bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-[10px] uppercase tracking-widest font-bold text-white px-8 py-5 rounded-none flex items-center justify-center gap-2 transition-colors group">
                    Deploy Message <Send size={16} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </form>
              </div>
            </div>
          </div>

        </div>

        <Alert
          isOpen={alertConfig.open}
          type={alertConfig.type}
          message={alertConfig.msg}
          onClose={() => setAlertConfig({ ...alertConfig, open: false })}
        />
      </section>
    </>
  );
}

export default ContactPage;
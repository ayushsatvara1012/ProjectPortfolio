import React, { useState } from 'react';
import { Mail, MessageSquare, Send, Zap, ChevronDown, Terminal } from 'lucide-react';
import Alert from '../components/alert';


function ContactPage() {
  const [activeFaq, setActiveFaq] = useState(null);
  const [alertConfig, setAlertConfig] = useState({open: false, type: 'success', msg: ''});

  const showSuccess = (event) => {
    event.preventDefault();
    setAlertConfig({ open: true, type: 'success', msg: 'Operation successfull' })
    setTimeout(()=>setAlertConfig({open:false}),3000)
  }
  const showError = (event) => {
    event.preventDefault();
    setAlertConfig({ open: true, type: 'error', msg: 'No Status at the moment' })
    setTimeout(()=>setAlertConfig({open:false}),3000)
  }
  const showDev = (event) => {
    event.preventDefault();
    setAlertConfig({ open: true, type: 'development', msg: 'Currently in Development' })
    setTimeout(()=>setAlertConfig({open:false}),3000)
  }

  const faqs = [
    { q: "Timeline?", a: "MVP architectures deployed in 4-8 weeks." },
    { q: "Support?", a: "Yes, 'Cloud-Care' monitoring packages available." },
    { q: "Stacks?", a: "Python/React specialized, but stack-agnostic." }
  ];

  return (
    <>
      <section id="contact" className="relative py-12 sm:py-20 bg-white dark:bg-slate-950 overflow-hidden antialiased">
        {/* Background Grid - Scaled for Mobile */}
        <div className="absolute inset-0 opacity-[0.2] dark:opacity-[0.1] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(var(--color-border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--color-border-subtle) 1px, transparent 1px)', backgroundSize: 'clamp(20px, 5vw, 40px) clamp(20px, 5vw, 40px)' }} />

        <div className="max-w-7xl mx-auto px-5 relative z-10">
          {/* Header - Centered on Mobile, Left-aligned on Desktop */}
          <div className="my-10 text-center sm:mb-10 sm:mt-0 lg:mb-10 lg:mt-0 lg:text-left">
            <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-4">
              <Terminal size={12} className="text-indigo-600" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 font-mono">Terminal_v2.0</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
              Let's <span className="text-indigo-600">Connect.</span>
            </h2>
          </div>

          {/* Main Content: Flex-col-reverse ensures Form is on top for mobile */}
          <div className="flex flex-col-reverse lg:grid lg:grid-cols-2 gap-8 lg:gap-16 items-start">

            {/* LEFT: FAQ & Contact Nodes (Secondary on Mobile) */}
            <div className="w-full space-y-6">
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center lg:text-left">Frequently Asked Questions</p>
                {faqs.map((faq, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900 overflow-hidden transition-all">
                    <button
                      onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                      className="w-full px-5 py-4 flex items-center justify-between text-left group"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{faq.q}</span>
                      <ChevronDown className={`transition-transform duration-300 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 ${activeFaq === i ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''}`} size={16} />
                    </button>
                    <div className={`px-5 transition-all duration-300 ease-in-out ${activeFaq === i ? 'pb-5 max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
                      <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed border-l-2 border-indigo-100 dark:border-indigo-900 pl-4">{faq.a}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Contact Pills: Grid for all sizes */}
              <div className="grid grid-cols-2 gap-3">
                <a href="mailto:ayushsatvara2002@gmail.com" className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-dashed border-indigo-200 dark:border-indigo-800/40 flex flex-col items-center text-center gap-2 hover:scale-[1.02] transition-transform text-indigo-600 dark:text-indigo-400">
                  <Mail size={18} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Email Us</span>
                </a>
                <div type='button' onClick={showError} className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-dashed border-emerald-200 dark:border-emerald-800/40 flex flex-col items-center text-center gap-2 hover:scale-[1.02] transition-transform text-emerald-600 dark:text-emerald-400">
                  <MessageSquare size={18} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Live Status</span>
                </div>
              </div>
            </div>

            {/* RIGHT: Form Terminal (Primary on Mobile) */}
            <div className="w-full relative">
              {/* Soft Shadow behind the form on mobile */}
              <div className="absolute -inset-1 bg-linear-to-r from-indigo-500 to-violet-500 rounded-4xl opacity-10 blur-xl md:opacity-0" />

              <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-4xl p-6 md:p-8 shadow-lg shadow-slate-200/50 dark:shadow-none lg:shadow-xl dark:lg:shadow-2xl dark:lg:shadow-black/20">
                <div className="flex items-center gap-3 mb-6">
                  <Zap className="text-indigo-600" size={20} />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Project Briefing</h3>
                </div>

                <form className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">Your Identity</label>
                      <input type="text" placeholder="Name" className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/10 dark:focus:ring-indigo-500/20 focus:border-indigo-600 dark:focus:border-indigo-500 outline-none transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">Channel</label>
                      <input type="email" placeholder="Email" className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/10 dark:focus:ring-indigo-500/20 focus:border-indigo-600 dark:focus:border-indigo-500 outline-none transition-all" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">Architecture Overview</label>
                    <textarea rows="3" placeholder="Describe your vision..." className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/10 dark:focus:ring-indigo-500/20 focus:border-indigo-600 dark:focus:border-indigo-500 outline-none transition-all resize-none"></textarea>
                  </div>

                  <button onClick={showDev} type='button' className="w-full bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.97] group text-sm shadow-lg shadow-slate-200/50 dark:shadow-none">
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
};

export default ContactPage;
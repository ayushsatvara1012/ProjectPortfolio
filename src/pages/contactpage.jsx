import React, { useState } from 'react';
import { Mail, MessageSquare, Send, Zap, ChevronDown, Terminal } from 'lucide-react';

const ContactPage = () => {
  const [activeFaq, setActiveFaq] = useState(null);

  const faqs = [
    { q: "Timeline?", a: "MVP architectures deployed in 4-8 weeks." },
    { q: "Support?", a: "Yes, 'Cloud-Care' monitoring packages available." },
    { q: "Stacks?", a: "Python/React specialized, but stack-agnostic." }
  ];

  return (
    <section id="contact" className="relative py-12 md:py-20 bg-white overflow-hidden">
      {/* Background Grid - Scaled for Mobile */}
      <div className="absolute inset-0 opacity-[0.1] pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)', backgroundSize: 'clamp(20px, 5vw, 40px) clamp(20px, 5vw, 40px)' }} />

      <div className="max-w-7xl mx-auto px-5 relative z-10">
        {/* Header - Centered on Mobile, Left-aligned on Desktop */}
        <div className="my-10 text-center sm:mb-10 sm:mt-0 lg:mb-10 lg:mt-0 lg:text-left">
          <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 mb-4">
            <Terminal size={12} className="text-indigo-600" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 font-mono">Terminal_v2.0</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">
            Let's <span className="text-indigo-600">Connect.</span>
          </h2>
        </div>

        {/* Main Content: Flex-col-reverse ensures Form is on top for mobile */}
        <div className="flex flex-col-reverse lg:grid lg:grid-cols-2 gap-8 lg:gap-16 items-start">
          
          {/* LEFT: FAQ & Contact Nodes (Secondary on Mobile) */}
          <div className="w-full space-y-6">
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center lg:text-left">Frequently Asked Questions</p>
              {faqs.map((faq, i) => (
                <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/40 overflow-hidden transition-all">
                  <button 
                    onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left group"
                  >
                    <span className="font-bold text-slate-700 text-sm">{faq.q}</span>
                    <ChevronDown className={`transition-transform duration-300 text-slate-400 group-hover:text-indigo-600 ${activeFaq === i ? 'rotate-180 text-indigo-600' : ''}`} size={16} />
                  </button>
                  <div className={`px-5 transition-all duration-300 ease-in-out ${activeFaq === i ? 'pb-5 max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <p className="text-slate-500 text-xs leading-relaxed border-l-2 border-indigo-100 pl-4">{faq.a}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Contact Pills: Grid for all sizes */}
            <div className="grid grid-cols-2 gap-3">
              <a href="mailto:hello@startup.io" className="p-4 rounded-2xl bg-indigo-600 text-white flex flex-col items-center text-center gap-2 hover:scale-[1.02] transition-transform">
                <Mail size={18} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Email Us</span>
              </a>
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-dashed border-emerald-600/20 text-white flex flex-col items-center text-center gap-2">
                <MessageSquare size={18} color={'#00bd7d'}/>
                <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Live Status</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Form Terminal (Primary on Mobile) */}
          <div className="w-full relative">
            {/* Soft Shadow behind the form on mobile */}
            <div className="absolute -inset-1 bg-linear-to-r from-indigo-500 to-violet-500 rounded-4xl opacity-10 blur-xl md:opacity-0" />
            
            <div className="relative bg-white border border-slate-200 rounded-4xl p-6 md:p-8 shadow lg:shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <Zap className="text-indigo-600" size={20} />
                <h3 className="text-lg font-bold text-slate-900">Project Briefing</h3>
              </div>

              <form className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Your Identity</label>
                    <input type="text" placeholder="Name" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 outline-none transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Channel</label>
                    <input type="email" placeholder="Email" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 outline-none transition-all" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Architecture Overview</label>
                  <textarea rows="3" placeholder="Describe your vision..." className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 outline-none transition-all resize-none"></textarea>
                </div>

                <button className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.97] group text-sm shadow-lg shadow-slate-200 dark:shadow-none">
                  Deploy Message <Send size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default ContactPage;
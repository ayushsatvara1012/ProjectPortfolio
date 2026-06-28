'use client';

import React, { useState } from 'react';
import Alert from '@/src/components/ui/Alert';
import ScrollReveal from '@/src/components/marketing/ScrollReveal';

export default function ContactClient() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [selectedService, setSelectedService] = useState('Custom AI Chatbot');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{ open: boolean; type: 'success' | 'error' | 'warning' | 'development'; msg: string }>({
    open: false,
    type: 'success',
    msg: ''
  });

  const showAlert = (type: typeof alertConfig.type, msg: string) => {
    setAlertConfig({ open: true, type, msg });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          service: selectedService,
          message: formMessage,
        }),
      });

      if (res.ok) {
        showAlert('success', 'Message sent! We\'ll get back to you within 24 hours.');
        setFormName('');
        setFormEmail('');
        setFormMessage('');
        setSelectedService('Custom AI Chatbot');
      } else {
        showAlert('error', 'Something went wrong. Please try emailing us directly.');
      }
    } catch {
      showAlert('error', 'Network error. Please try again or email us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqs = [
    { q: "What we do?", a: "We build custom web applications and AI solutions for businesses." },
    { q: "How long it takes?", a: "It depends on the complexity of the project. Basic Websites with 3-5 pages takes 1 week" },
    { q: "What is your stack?", a: "We use Python, React, Next.js, FastAPI, PostgreSQL, Supabase, AWS, Docker and other modern technologies." }
  ];

  return (
    <section id="contact" className="relative w-full bg-white dark:bg-slate-950 py-24 sm:py-32 overflow-x-clip transition-colors duration-500">
      {/* Ambient glows (same as HowItWorks) */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/5 dark:bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* max-w-8xl container */}
      <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 relative z-10">
        <ScrollReveal>
          {/* Main Grid: Info on left, Form on right */}
          <div className="flex flex-col-reverse lg:grid lg:grid-cols-2 gap-12 lg:gap-16 items-start mb-20 sm:mb-28">

            {/* LEFT COLUMN (50%) - Sticky on Desktop */}
            <div className="w-full lg:sticky lg:top-32 space-y-12 lg:pl-8">

              <div>
                {/* 1. SECTION LABEL */}
                <div className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold font-google text-slate-400 dark:text-slate-500 mb-4">
                  <span className="material-symbols-outlined text-[16px] text-blue-500">connect_without_contact</span>
                  <span>Get In Touch</span>
                </div>

                {/* 2. HEADING */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-google font-medium tracking-tight leading-tight text-slate-900 dark:text-slate-200 mb-4">
                  Let's build something <br />
                  <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                    remarkable together.
                  </span>
                </h1>

                {/* 3. SUBHEADING */}
                <p className="text-base md:text-lg font-google text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                  Have an idea, project, or question? Drop us a line and let's turn your vision into a high-performance solution.
                </p>
              </div>

              {/* 4. CONTACT METHODS */}
              <div className="space-y-3">
                {/* Email Entry */}
                <a
                  href="mailto:ayush@sapybase.com"
                  className="rounded-2xl border border-slate-200 dark:border-slate-800/60 p-4 flex items-center gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors bg-white dark:bg-slate-950"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-blue-500 text-[20px]">mail</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-google text-slate-500 dark:text-slate-400">Direct line</span>
                    <span className="text-base font-google font-medium text-slate-800 dark:text-slate-200">ayush@sapybase.com</span>
                  </div>
                </a>

                {/* LinkedIn Entry */}
                <a
                  href="https://linkedin.com/in/ayushsatvara"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-slate-200 dark:border-slate-800/60 p-4 flex items-center gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors bg-white dark:bg-slate-950"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-blue-500 text-[20px]">work</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-google text-slate-500 dark:text-slate-400">Professional network</span>
                    <span className="text-base font-google font-medium text-slate-800 dark:text-slate-200">/in/ayushsatvara</span>
                  </div>
                </a>

                {/* WhatsApp Entry */}
                <a
                  href="https://wa.me/15626681855"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-slate-200 dark:border-slate-800/60 p-4 flex items-center gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors bg-white dark:bg-slate-950"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-blue-500 text-[20px]">chat</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-google text-slate-500 dark:text-slate-400">Fastest response</span>
                    <span className="text-base font-google font-medium text-slate-800 dark:text-slate-200">Message us directly</span>
                  </div>
                </a>
              </div>

            </div>

            {/* RIGHT COLUMN (50%) */}
            <div className="w-full lg:pr-4">
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950 p-5 sm:p-8 lg:p-10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none transition-all duration-300">

                {/* CARD HEADER */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/40 pb-6 mb-8">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-blue-500">bolt</span>
                    <span className="text-sm uppercase tracking-widest font-bold font-google text-slate-400 dark:text-slate-500">Project Brief</span>
                  </div>
                  <span className="text-sm font-google text-slate-400 dark:text-slate-500">
                    Let's collaborate
                  </span>
                </div>

                {/* FORM */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Row 1: Name and Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="name" className="text-sm font-google font-medium text-slate-700 dark:text-slate-300">
                        Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        required
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        placeholder="Name"
                        className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-base font-google text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-mono focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 dark:focus:border-blue-500 outline-none transition-all duration-200 w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="email" className="text-sm font-google font-medium text-slate-700 dark:text-slate-300">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        required
                        value={formEmail}
                        onChange={e => setFormEmail(e.target.value)}
                        placeholder="Email"
                        className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-base font-google text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-mono focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 dark:focus:border-blue-500 outline-none transition-all duration-200 w-full"
                      />
                    </div>
                  </div>

                  {/* Row 2: Service selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-google font-medium text-slate-700 dark:text-slate-300">
                      Service
                    </label>

                    {/* Visual pill selector (3 cols on sm+, wrap on mobile) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        'Custom AI Chatbot',
                        'RAG Pipeline',
                        'Full-Stack Web App',
                        'Performance & SEO',
                        'Other'
                      ].map((service) => {
                        const isSelected = selectedService === service;
                        return (
                          <button
                            key={service}
                            type="button"
                            onClick={() => setSelectedService(service)}
                            className={`px-4 py-3 text-sm font-google font-medium rounded-xl border text-center transition-all duration-200 ${isSelected
                                ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors'
                              }`}
                          >
                            {service}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Row 3: Textarea */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="message" className="text-sm font-google font-medium text-slate-700 dark:text-slate-300">
                      Tell us about your project
                    </label>
                    <textarea
                      id="message"
                      rows={5}
                      required
                      value={formMessage}
                      onChange={e => setFormMessage(e.target.value)}
                      placeholder="What are you building? Timeline? Budget range?"
                      className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-base font-google text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-mono focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 dark:focus:border-blue-500 outline-none transition-all duration-200 w-full resize-none"
                    />
                  </div>

                  {/* SUBMIT BUTTON */}
                  <div className="w-full flex flex-col items-center lg:items-stretch">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto lg:w-full overflow-hidden relative bg-slate-900 dark:bg-slate-900 text-lg font-google text-white font-medium cursor-pointer z-10 group flex items-center justify-center px-8 py-4 rounded-full border border-slate-200/50 dark:border-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {/* Wave layer 1 — lightest blue, reveals first */}
                      <span className="absolute w-[150%] h-50 -top-26 -left-2 bg-blue-200 rotate-12 transform scale-x-0 group-hover:scale-x-100 transition-transform group-hover:duration-500 duration-1000 origin-left" />
                      {/* Wave layer 2 — mid blue */}
                      <span className="absolute w-[75%] h-36 -top-22 -left-2 bg-blue-600 rotate-12 transform scale-x-0 group-hover:scale-x-100 transition-transform group-hover:duration-700 duration-700 origin-left" />
                      {/* Wave layer 3 — dark blue, reveals last */}
                      <span className="absolute w-[30%] h-32 -top-14 -left-2 bg-blue-800 rotate-12 transform scale-x-0 group-hover:scale-x-100 transition-transform group-hover:duration-1000 duration-500 origin-left" />

                      {/* Hover label — fades in on top of waves */}
                      <span className="group-hover:opacity-100 group-hover:duration-1000 duration-100 opacity-0 absolute z-10 whitespace-nowrap flex items-center gap-2">
                        Send It →
                      </span>
                      {/* Default label */}
                      <span className="relative z-10 flex items-center gap-2 group-hover:opacity-0 transition-opacity duration-300">
                        {isSubmitting ? 'Sending…' : 'Send Message'}
                        {!isSubmitting && <span className="material-symbols-outlined text-[18px]">send</span>}
                      </span>
                    </button>

                    {/* FOOTER NOTE */}
                    <p className="text-xs font-google text-slate-400 dark:text-slate-500 text-center mt-3">
                      We respond within 24 hours. No spam, ever.
                    </p>
                  </div>

                </form>

              </div>
            </div>

          </div>

          {/* 5. FAQ ACCORDION - FULL SPAN */}
          <div className="w-full pt-16 border-t border-slate-200/60 dark:border-slate-800/40">
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="text-center">
                <h3 className="text-sm font-google uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mb-3">
                  Frequently Asked Questions
                </h3>
              </div>
              <div className="space-y-3">
                {faqs.map((faq, i) => {
                  const isOpen = activeFaq === i;
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950 overflow-hidden transition-colors duration-300"
                    >
                      <button
                        onClick={() => setActiveFaq(isOpen ? null : i)}
                        className="w-full px-5 py-4 flex items-center justify-between text-left group transition-colors duration-300"
                      >
                        <span className="text-base font-google font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
                          {faq.q}
                        </span>
                        <span
                          className={`material-symbols-outlined transition-transform duration-300 text-[16px] text-slate-400 dark:text-slate-500 group-hover:text-blue-500 ${isOpen ? 'rotate-180 text-blue-500' : ''
                            }`}
                        >
                          expand_more
                        </span>
                      </button>

                      <div
                        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                          }`}
                        style={{ display: 'grid' }}
                      >
                        <div className="overflow-hidden">
                          <p className="px-5 pb-5 text-sm font-google text-slate-500 dark:text-slate-400 leading-relaxed">
                            {faq.a}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>

      <Alert
        isOpen={alertConfig.open}
        type={alertConfig.type}
        message={alertConfig.msg}
        onClose={() => setAlertConfig(prev => ({ ...prev, open: false }))}
      />
    </section>
  );
}

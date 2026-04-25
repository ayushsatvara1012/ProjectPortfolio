import React from 'react';
import { Gavel, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Terms & Conditions | Sapybase',
  description: 'Service agreement and terms of use for Sapybase LLC.',
};

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 text-slate-600 dark:text-slate-300 pt-32 pb-20 px-6 transition-colors duration-500">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors mb-12 group">
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </Link>

        <header className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] uppercase tracking-widest font-bold font-sans mb-6 transition-colors">
            <Gavel size={14} />
            Service Agreement
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-white mb-6 transition-colors">Terms & Conditions</h1>
          <p className="text-sm text-slate-500 font-medium transition-colors">Last Updated: March 25, 2026</p>
        </header>

        <div className="space-y-12">
          <section>
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-white mb-4 flex items-center gap-3 transition-colors">
              <span className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-emerald-600 dark:text-emerald-500 text-base font-bold font-sans transition-colors">01</span>
              Agreement to Terms
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
              By accessing or using the services provided by Sapybase LLC, you agree to be bound by these Terms and Conditions. If you disagree with any part of these terms, you may not access our services.
            </p>
          </section>

          <section>
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-white mb-4 flex items-center gap-3 transition-colors">
              <span className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-emerald-600 dark:text-emerald-500 text-base font-bold font-sans transition-colors">02</span>
              Professional Services
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
              Sapybase LLC provides high-performance full-stack engineering and web deployment services. Specific project scopes, timelines, and deliverables are governed by individual Master Service Agreements (MSA) or Statements of Work (SOW) executed between Sapybase LLC and the Client.
            </p>
          </section>

          <section>
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-white mb-4 flex items-center gap-3 transition-colors">
              <span className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-emerald-600 dark:text-emerald-500 text-base font-bold font-sans transition-colors">03</span>
              Intellectual Property
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
              Unless otherwise agreed in a written contract, all intellectual property rights for custom code and designs developed for a Client remain the property of Sapybase LLC until full payment is received, at which point rights are transferred as specified in the service agreement.
            </p>
          </section>

          <section>
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-white mb-4 flex items-center gap-3 transition-colors">
              <span className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-emerald-600 dark:text-emerald-500 text-base font-bold font-sans transition-colors">04</span>
              Limitation of Liability
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
              In no event shall Sapybase LLC, nor its directors, employees, or partners, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
            </p>
          </section>

          <section>
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-white mb-4 flex items-center gap-3 transition-colors">
              <span className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-emerald-600 dark:text-emerald-500 text-base font-bold font-sans transition-colors">05</span>
              AI Training and Ingestion
            </h2>
            <div className="space-y-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
              <p>
                Sapybase provides technical tools to ingest and process data for the purpose of training custom AI models ("AI Ingestion"). By providing a URL, PDF, or text for Ingestion, you certify that:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-400 transition-colors">
                <li>You have the legal right, ownership, or permission to access and scrape the content provided.</li>
                <li>The content does not violate any third-party intellectual property, privacy, or trade secret rights.</li>
                <li>The ingestion does not bypass non-public security measures or paywalls (CFAA compliance).</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-white mb-4 flex items-center gap-3 transition-colors">
              <span className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-emerald-600 dark:text-emerald-500 text-base font-bold font-sans transition-colors">06</span>
              Indemnification
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
              You agree to defend, indemnify, and hold harmless Sapybase LLC and its employees from and against any and all claims, damages, obligations, losses, liabilities, costs, or debt (including legal fees) resulting from: (i) your use and access of the Service, (ii) your violation of any third-party right, including copyright, or (iii) any claim that your training data caused damage to a third party.
            </p>
          </section>

          <section>
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-white mb-4 flex items-center gap-3 transition-colors">
              <span className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-emerald-600 dark:text-emerald-500 text-base font-bold font-sans transition-colors">07</span>
              Governing Law
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
              Any dispute arising from these terms or our services shall be governed by and construed in accordance with the laws of the jurisdiction in which Sapybase LLC is registered.
            </p>
          </section>

          <div className="flex items-start gap-4 p-6 rounded-2xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 transition-colors">
            <AlertCircle className="text-amber-600 dark:text-amber-500 shrink-0 mt-1 transition-colors" size={20} />
            <div>
              <h3 className="text-xl md:text-2xl font-display font-bold text-amber-700 dark:text-amber-500 mb-1 transition-colors">Company Registration</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium transition-colors">
                Sapybase LLC is a fully registered Limited Liability Company. All contracts are legally binding under the entity's registered jurisdiction.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

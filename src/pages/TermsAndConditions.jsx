import React from 'react';
import { FileText, Gavel, Scale, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const TermsAndConditions = () => {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-300 pt-32 pb-20 px-6">
            <div className="max-w-4xl mx-auto">
                <Link to="/" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors mb-12 group">
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Home
                </Link>

                <header className="mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
                        <Gavel size={14} />
                        Service Agreement
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">Terms & Conditions</h1>
                    <p className="text-slate-500">Last Updated: March 10, 2026</p>
                </header>

                <div className="space-y-12">
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-500 text-sm">01</span>
                            Agreement to Terms
                        </h2>
                        <p className="leading-relaxed">
                            By accessing or using the services provided by Sapybase LLC, you agree to be bound by these Terms and Conditions. If you disagree with any part of these terms, you may not access our services.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-500 text-sm">02</span>
                            Professional Services
                        </h2>
                        <p className="leading-relaxed">
                            Sapybase LLC provides high-performance full-stack engineering and web deployment services. Specific project scopes, timelines, and deliverables are governed by individual Master Service Agreements (MSA) or Statements of Work (SOW) executed between Sapybase LLC and the Client.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-500 text-sm">03</span>
                            Intellectual Property
                        </h2>
                        <p className="leading-relaxed">
                            Unless otherwise agreed in a written contract, all intellectual property rights for custom code and designs developed for a Client remain the property of Sapybase LLC until full payment is received, at which point rights are transferred as specified in the service agreement.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-500 text-sm">04</span>
                            Limitation of Liability
                        </h2>
                        <p className="leading-relaxed">
                            In no event shall Sapybase LLC, nor its directors, employees, or partners, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-500 text-sm">05</span>
                            Governing Law
                        </h2>
                        <p className="leading-relaxed">
                            Any dispute arising from these terms or our services shall be governed by and construed in accordance with the laws of the jurisdiction in which Sapybase LLC is registered.
                        </p>
                    </section>

                    <div className="flex items-start gap-4 p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                        <AlertCircle className="text-amber-500 shrink-0 mt-1" size={20} />
                        <div>
                            <h3 className="text-amber-500 font-bold mb-1">Company Registration</h3>
                            <p className="text-slate-400 text-sm">
                                Sapybase LLC is a fully registered Limited Liability Company. All contracts are legally binding under the entity's registered jurisdiction.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TermsAndConditions;

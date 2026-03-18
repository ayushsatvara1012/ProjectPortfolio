import React from 'react';
import { Shield, Lock, Eye, FileText, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/Seo';
import { seoConfig } from '../seo/seoConfig';

const PrivacyPolicy = () => {
    return (
        <>
            <SEO {...seoConfig.privacy} />
        <div className="min-h-screen bg-slate-950 text-slate-300 pt-32 pb-20 px-6">
            <div className="max-w-4xl mx-auto">
                <Link to="/" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors mb-12 group">
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Home
                </Link>

                <header className="mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-6">
                        <Shield size={14} />
                        Legal Compliance
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">Privacy Policy</h1>
                    <p className="text-slate-500">Last Updated: March 10, 2026</p>
                </header>

                <div className="space-y-12">
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-500 text-sm">01</span>
                            Introduction
                        </h2>
                        <p className="leading-relaxed">
                            At Sapybase LLC, we respect your privacy and are committed to protecting it. This Privacy Policy explains how we collect, use, and safeguard your information when you visit our website and use our services.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-500 text-sm">02</span>
                            Information We Collect
                        </h2>
                        <div className="space-y-4">
                            <p className="leading-relaxed">
                                We may collect information that identifies you ("Personal Information") such as your name, email address, and phone number when you voluntarily provide it through our contact forms or project inquiries.
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400">
                                <li>Contact Information (Name, Email, Phone Number)</li>
                                <li>Project Requirements and Business Information</li>
                                <li>Usage Data (IP address, browser type, pages visited) via cookies</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-500 text-sm">03</span>
                            How We Use Your Information
                        </h2>
                        <p className="leading-relaxed mb-4">
                            Your information is used to provide and improve our services, including:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-slate-400">
                            <li>Responding to your inquiries and providing support</li>
                            <li>Executing projects and delivering engineering services</li>
                            <li>Optimizing our website performance and user experience</li>
                            <li>Sending occasional updates regarding our services (with your consent)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-500 text-sm">04</span>
                            Data Protection
                        </h2>
                        <p className="leading-relaxed">
                            We implement industry-standard security measures to maintain the safety of your personal information. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
                        </p>
                    </section>

                    <section className="p-8 rounded-2xl bg-indigo-600/5 border border-indigo-500/20">
                        <h2 className="text-xl font-bold text-white mb-4">Contact Our Legal Team</h2>
                        <p className="text-slate-400 mb-6 italic">
                            Questions regarding our privacy practices or data handling?
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <a href="mailto:legal@sapybase.com" className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition-colors">
                                Email Legal Department
                            </a>
                        </div>
                    </section>
                </div>
            </div>
        </div>
        </>
    );
};

export default PrivacyPolicy;

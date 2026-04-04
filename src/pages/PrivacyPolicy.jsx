import React from 'react';
import { Shield, Lock, Eye, FileText, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/Seo';
import { seoConfig } from '../seo/seoConfig';

const PrivacyPolicy = () => {
    return (
        <>
            <SEO {...seoConfig.privacy} />
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 text-slate-600 dark:text-slate-300 pt-32 pb-20 px-6 transition-colors duration-500">
            <div className="max-w-4xl mx-auto">
                <Link to="/" className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors mb-12 group">
                    <span className="material-symbols-outlined">
                        arrow_back
                    </span>
                    <span className="material-symbols-outlined">home_app_logo</span>
                </Link>

                <header className="mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] uppercase tracking-widest font-bold font-sans mb-6 transition-colors">
                        <Shield size={14} />
                        Legal Compliance
                    </div>
                    <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-white mb-6 transition-colors">Privacy Policy</h1>
                    <p className="text-md text-slate-500 font-medium font-sans transition-colors">Last Updated: March 10, 2026</p>
                </header>

                <div className="space-y-12">
                    <section>
                        <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-white mb-4 flex items-center gap-3 transition-colors">
                            <span className="w-10 h-10 rounded-lg dark:bg-slate-900 flex items-center justify-center text-indigo-600 dark:text-indigo-500 font-bold font-sans transition-colors">01</span>
                            Introduction
                        </h2>
                        <p className="text-lg font-medium md:text-xl text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
                            At Sapybase LLC, we respect your privacy and are committed to protecting it. This Privacy Policy explains how we collect, use, and safeguard your information when you visit our website and use our services.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-white mb-4 flex items-center gap-3 transition-colors">
                            <span className="w-10 h-10 rounded-lg dark:bg-slate-900 flex items-center justify-center text-indigo-600 dark:text-indigo-500 font-bold font-sans transition-colors">02</span>
                            Information We Collect
                        </h2>
                        <div className="space-y-4">
                            <p className="text-lg font-medium md:text-xl  text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
                                We may collect information that identifies you ("Personal Information") such as your name, email address, and phone number when you voluntarily provide it through our contact forms or project inquiries.
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-400 text-lg font-medium md:text-xl  leading-relaxed transition-colors">
                                <li>Contact Information (Name, Email, Phone Number)</li>
                                <li>Project Requirements and Business Information</li>
                                <li>Usage Data (IP address, browser type, pages visited) via cookies</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-white mb-4 flex items-center gap-3 transition-colors">
                            <span className="w-10 h-10 rounded-lg dark:bg-slate-900 flex items-center justify-center text-indigo-600 dark:text-indigo-500 font-bold font-sans transition-colors">03</span>
                            How We Use Your Information
                        </h2>
                        <p className="text-lg font-medium md:text-xl  text-slate-600 dark:text-slate-400 leading-relaxed mb-4 transition-colors">
                            Your information is used to provide and improve our services, including:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-400 text-lg font-medium md:text-xl  leading-relaxed transition-colors">
                            <li>Responding to your inquiries and providing support</li>
                            <li>Executing projects and delivering engineering services</li>
                            <li>Optimizing our website performance and user experience</li>
                            <li>Sending occasional updates regarding our services (with your consent)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-white mb-4 flex items-center gap-3 transition-colors">
                            <span className="w-10 h-10 rounded-lg dark:bg-slate-900 flex items-center justify-center text-indigo-600 dark:text-indigo-500 font-bold font-sans transition-colors">04</span>
                            Data Protection
                        </h2>
                        <p className="text-lg font-medium md:text-xl  text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
                            We implement industry-standard security measures to maintain the safety of your personal information. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
                        </p>
                    </section>

                    <section className="p-8 rounded-2xl bg-indigo-50 dark:bg-indigo-600/5 border border-indigo-200 dark:border-indigo-500/20 transition-colors">
                        <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-white mb-4 transition-colors">Contact Our Legal Team</h2>
                        <p className="text-base text-slate-600 dark:text-slate-400 font-medium italic mb-6 transition-colors">
                            Questions regarding our privacy practices or data handling?
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <a href="mailto:legal@sapybase.com" className="px-6 py-3 rounded-xl bg-indigo-600 dark:bg-indigo-600 text-white text-[10px] uppercase tracking-widest font-bold font-sans hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-colors shadow-sm">
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

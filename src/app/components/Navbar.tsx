'use client';

import { useState, useEffect, useRef } from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  UserButton,
  SignInButton,
  SignUpButton,
  Show,
} from '@clerk/nextjs';
import Logo from './Logo';

type ServiceItem = { title: string; desc: string; price: string };
type ServiceGroup = { label: string; items: ServiceItem[] };
type NavLink = { name: string; href: string; id: string; dropdown?: boolean };

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsServicesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const serviceGroups: ServiceGroup[] = [
    {
      label: 'Build',
      items: [
        { title: 'Custom AI Chatbot', desc: 'LLM-powered support & sales agents', price: 'From $3,000' },
        { title: 'RAG Pipeline Architecture', desc: 'pgvector · document retrieval · FastAPI', price: 'From $2,500' },
        { title: 'Full-Stack Web App', desc: 'React · FastAPI · PostgreSQL · AWS', price: 'From $2,500' },
      ],
    },
    {
      label: 'Optimize',
      items: [
        { title: 'AI Integration & LLM Consulting', desc: 'Embed AI into existing products', price: 'Custom' },
        { title: 'Performance & SEO', desc: 'Core Web Vitals · Technical SEO', price: 'From $300' },
        { title: 'Cloud Infrastructure', desc: 'AWS · S3 · EC2 · Route53 · Lambda', price: 'From $400' },
      ],
    },
  ];

  const navLinks: NavLink[] = [
    { name: 'Home', href: '#home', id: 'home' },
    { name: 'Projects', href: '/about#projects', id: 'projects' },
    { name: 'Services', href: '/services', id: 'services', dropdown: true },
    { name: 'Pricing', href: '/pricing', id: 'pricing' },
    { name: 'Docs', href: '/docs', id: 'docs' },
    { name: 'Contact', href: '/contact', id: 'contact' },
    { name: 'About', href: '/about', id: 'about' },
  ];

  const handleLinkClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setIsOpen(false);
    setIsServicesOpen(false);

    if (href.startsWith('#')) {
      if (pathname === '/') {
        const targetElement = document.querySelector(href);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        router.push('/');
        setTimeout(() => {
          const targetElement = document.querySelector(href);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }
    } else {
      router.push(href);
    }
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-white dark:bg-slate-950 h-16 transition-colors duration-500">
        <div className="max-w-screen-2xl mx-auto h-full flex items-center justify-between transition-colors duration-500">

          {/* Cell 1: Logo */}
          <div className="px-6 h-full flex items-center shrink-0 min-w-fit">
            <a href="#home" onClick={(e) => handleLinkClick(e, '#home')} className="flex items-center">
              <Logo className="h-10 w-auto" />
            </a>
          </div>

          {/* Cell 2: Desktop Navigation Links (md+) */}
          <div className="hidden lg:flex flex-1 items-center gap-4 lg:gap-8 xl:gap-10 px-6 lg:px-10 h-full">
            {navLinks.map((link) => (
              <div
                key={`nav-desk-${link.id || link.name}`}
                className="relative text-md font-google font-regular antialiased tracking-wider text-slate-800 dark:text-slate-50 hover:text-slate-900 dark:hover:text-white transition-colors h-full flex items-center"
                ref={link.dropdown ? dropdownRef : null}
              >
                {link.dropdown ? (
                  <button
                    onMouseEnter={() => setIsServicesOpen(true)}
                    onClick={() => setIsServicesOpen(!isServicesOpen)}
                    className="text-base font-google text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors h-full flex items-center gap-1.5 group"
                  >
                    {link.name}
                    <span
                      className={`material-symbols-outlined text-black dark:text-white text-[12px] opacity-40 transition-transform duration-200 ${isServicesOpen ? 'rotate-180' : ''}`}
                    >
                      keyboard_arrow_down
                    </span>

                    {/* Desktop Dropdown */}
                    <div
                      className={`absolute top-full -left-1/4 w-[760px] bg-white dark:bg-slate-950 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] dark:shadow-none rounded-3xl border border-gray-100 dark:border-slate-800/60 transition-all duration-300 ease-out z-50 transform origin-top ${isServicesOpen ? 'opacity-100 translate-y-4 scale-100' : 'opacity-0 translate-y-0 scale-95 pointer-events-none'}`}
                      onMouseLeave={() => setIsServicesOpen(false)}
                    >
                      <div className="flex p-8">
                        {/* Left Content */}
                        <div className="w-1/2 pr-12 flex flex-col items-start justify-between">
                          <div>
                            <h3 className="text-2xl font-google font-medium text-slate-900 dark:text-white leading-tight mb-4 tracking-tight">
                              Built for developers<br/>in the agent-first era
                            </h3>
                            <p className="text-sm font-google text-slate-500 dark:text-slate-400 leading-relaxed mb-8">
                              Explore how Sapybase helps you build
                            </p>
                          </div>
                          <Link href="/services" onClick={() => setIsServicesOpen(false)} className="px-5 py-2.5 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800 text-slate-900 dark:text-white text-sm font-google font-medium rounded-full transition-colors">
                            See overview
                          </Link>
                        </div>
                        
                        {/* Right Content - Services List */}
                        <div className="w-1/2 flex flex-col gap-0.5">
                          {serviceGroups.flatMap(group => group.items).map((service, idx) => {
                            const icons = ['smart_toy', 'account_tree', 'code_blocks', 'api', 'speed', 'cloud'];
                            return (
                              <Link
                                key={`service-drop-${idx}`}
                                href="/services"
                                onClick={() => setIsServicesOpen(false)}
                                className="group/item flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                              >
                                <div className="flex items-center gap-4">
                                  <span className="material-symbols-outlined text-[20px] text-slate-400 dark:text-slate-500 group-hover/item:text-slate-800 dark:group-hover/item:text-slate-200 transition-colors">
                                    {icons[idx]}
                                  </span>
                                  <span className="text-[15px] font-google text-slate-700 dark:text-slate-300 group-hover/item:text-slate-900 dark:group-hover/item:text-slate-100 transition-colors">
                                    {service.title}
                                  </span>
                                </div>
                                <span className="material-symbols-outlined text-[16px] text-slate-300 dark:text-slate-600 opacity-0 -translate-x-2 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all duration-300 ease-out">
                                  chevron_right
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </button>
                ) : (
                  <a
                    href={link.href}
                    onClick={(e) => handleLinkClick(e, link.href)}
                    className="text-base font-google text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors py-2 relative group"
                  >
                    {link.name}
                    <div className="absolute -bottom-1 left-0 w-full h-px bg-slate-900 dark:bg-slate-200 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* Cell 3: Auth & Account (Desktop md+) */}
          <div className="hidden lg:flex items-center h-full overflow-hidden shrink-0 transition-colors duration-500">
            <Show when="signed-out">
              <div className="h-full bg-white dark:bg-slate-950 flex items-center px-2 lg:px-4 transition-colors duration-500">
                <SignInButton mode="modal">
                  <button className="font-google text-base  text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors px-4 py-3 cursor-pointer">
                    Login
                  </button>
                </SignInButton>
              </div>
              <div className="h-full flex items-center transition-colors duration-500">
                <SignUpButton mode="modal">
                  <button className=" text-slate-900 dark:text-slate-200 font-google text-base px-4 lg:px-6 xl:px-8 py-5 h-full transition-all  shrink-0 duration-500 group cursor-pointer">
                    <span className="group-hover:text-transparent bg-clip-text bg-linear-to-r from-green-400 to-blue-500 transition-all duration-500">
                      Get_Started
                    </span>
                  </button>
                </SignUpButton>
              </div>
            </Show>
            <Show when="signed-in">
              <div className="h-full bg-white dark:bg-slate-950 flex items-center px-3 lg:px-6 gap-6 transition-colors duration-500">
                <Link
                  href="/dashboard"
                  className="text-sm text-slate-900 dark:text-slate-200 font-google hover:text-transparent bg-clip-text bg-linear-to-r from-green-600 to-blue-600 transition-all ease-in-out duration-300 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">dashboard</span>
                  Dashboard
                </Link>
                <div className="h-10 w-10 group/user p-0 flex items-center justify-center">
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox: 'w-8 h-8 rounded-none',
                        userButtonTrigger: 'rounded-none',
                      },
                    }}
                  />
                </div>
              </div>
            </Show>
          </div>

          {/* Mobile Actions (Hamburger & Auth) */}
          <div className="flex items-center lg:hidden h-full transition-colors duration-500">
            <Show when="signed-in">
              <div className="h-16 w-16 bg-white dark:bg-slate-950 flex items-center justify-center border-l border-gray-200 dark:border-slate-800 overflow-hidden transition-colors duration-500">
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: 'w-9 h-9 rounded-none',
                      userButtonTrigger: 'p-0 rounded-none w-full h-full',
                    },
                  }}
                />
              </div>
            </Show>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="h-16 w-16 bg-white dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-slate-200 active:bg-slate-50 dark:active:bg-slate-900 transition-colors border-l border-gray-200 dark:border-slate-800 rounded-none"
              aria-label="Toggle Menu"
            >
              {isOpen ? <span className="material-symbols-outlined text-[20px]">close</span> : <span className="material-symbols-outlined text-[20px]">menu</span>}
            </button>
          </div>
        </div>
      </header>

      {/* Zero-Scroll Mobile Dropdown Menu */}
      <div
        className={`fixed top-16 left-0 w-full h-[calc(100vh-64px)] z-40 bg-white dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 transition-all duration-500 ease-in-out lg:hidden flex flex-col overflow-hidden ${
          isOpen ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex-1 flex flex-col h-full overflow-y-auto">
          <div className="flex flex-col bg-white dark:bg-slate-950">
            {navLinks.map((link) =>
              link.dropdown ? (
                <div key={`nav-mob-${link.id}`} className="border-b border-gray-100 dark:border-slate-800">
                  {/* Services toggle row */}
                  <button
                    onClick={() => setIsServicesOpen((p) => !p)}
                    className="w-full px-8 py-5 flex items-center justify-between text-lg font-google uppercase  font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                  >
                    <span>{link.name}</span>
                    <span
                      className={`material-symbols-outlined text-[16px] opacity-40 transition-transform duration-200 ${isServicesOpen ? 'rotate-180' : ''}`}
                    >
                      keyboard_arrow_down
                    </span>
                  </button>

                  {/* Services sub-items */}
                  <div className={`overflow-hidden transition-all duration-300 ${isServicesOpen ? 'max-h-[600px]' : 'max-h-0'}`}>
                    <div className="border-t border-gray-100 dark:border-slate-800">
                      {serviceGroups.map((group) => (
                        <div key={group.label}>
                          {/* Partition label */}
                          <div className="px-8 py-2 bg-slate-50 dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
                            <span className="text-sm uppercase  font-bold font-google text-slate-400 dark:text-slate-600">
                              {group.label}
                            </span>
                          </div>
                          {group.items.map((service, idx) => (
                            <a
                              key={`mob-svc-${group.label}-${idx}`}
                              href="/services"
                              onClick={(e) => handleLinkClick(e, '/services')}
                              className="flex items-center gap-4 px-8 py-3.5 border-b border-gray-50 dark:border-slate-800/60 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                            >
                              <div className="w-7 h-7 shrink-0 border border-gray-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400">
                                {/* icon slot preserved from Vite original */}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-google font-bold text-slate-800 dark:text-slate-200 leading-tight">{service.title}</p>
                                <p className="text-sm font-google text-slate-600 dark:text-slate-400 truncate mt-0.5">{service.desc}</p>
                              </div>
                              <span className="text-sm font-mono font-bold text-slate-400 dark:text-slate-600 shrink-0">{service.price}</span>
                            </a>
                          ))}
                        </div>
                      ))}
                      <Link
                        href="/services"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-between px-8 py-4 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <span className="text-xs font-google font-bold uppercase  text-blue-600 dark:text-blue-400">View All Services</span>
                        <span className="material-symbols-outlined text-[12px] text-blue-600 dark:text-blue-400">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <a
                  key={`nav-mob-${link.id || link.name}`}
                  href={link.href}
                  onClick={(e) => handleLinkClick(e, link.href)}
                  className="w-full border-b border-gray-100 dark:border-slate-800 px-8 py-5 sm:py-6 flex items-center justify-between text-sm font-google uppercase  font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                  <span>{link.name}</span>
                  <span className="material-symbols-outlined text-[18px] opacity-40">arrow_forward</span>
                </a>
              )
            )}
          </div>

          {/* Mobile Bottom CTA Section */}
          <div className="p-6 sm:p-8 bg-white dark:bg-slate-950 mt-auto border-t border-gray-200 dark:border-slate-800 space-y-4">
            <Show when="signed-out">
              <SignUpButton mode="modal">
                <button className="w-full bg-slate-800 dark:bg-slate-900 text-white py-6 text-sm font-google  font-bold hover:bg-slate-700 dark:hover:bg-slate-800 transition-all rounded-none mb-3 border-4 border-l-green-500 dark:border-y-slate-950 dark:border-r-slate-950">
                  Start_Free_Trial
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button className="w-full border border-gray-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 py-6 text-sm font-google  font-bold rounded-none hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                  Login_to_System
                </button>
              </SignInButton>
            </Show>

            <Show when="signed-in">
              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className="w-full bg-slate-900 dark:bg-indigo-600 text-white py-6 text-sm font-google  font-bold hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all rounded-none block text-center"
              >
                SYSTEM_DASHBOARD
              </Link>
            </Show>

            <div className="pt-8 flex items-center justify-between text-slate-600 dark:text-slate-400">
              <div className="flex gap-6 text-[10px] uppercase  font-bold font-google">
                <a href="https://github.com/ayushsatvara1012" target="_blank" rel="noreferrer" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">GIT</a>
                <a href="https://www.linkedin.com/in/ayushsatvara" target="_blank" rel="noreferrer" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">LNK</a>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[12px] text-emerald-500 animate-pulse">vital_signs</span>
                <span className="text-[10px] uppercase  font-bold font-google">Uptime: 99.99%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

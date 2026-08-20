'use client';

import { useState, useEffect, useRef } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SignInButton,
  SignUpButton,
  Show,
} from '@clerk/nextjs';
import Logo from '../ui/Logo';
import { ArrowDownIcon } from '../icons';
import dynamic from 'next/dynamic';

// UserButton (avatar menu) is the heaviest Clerk UI component and only renders
// for signed-in users — split it so anonymous visitors never download it.
// Its containers are fixed-size (w-10 h-10 / w-16), so deferred mount can't shift layout.
const UserButton = dynamic(() => import('@clerk/nextjs').then((m) => m.UserButton), {
  ssr: false,
});

const AntigravityBackground = dynamic(() => import('../../components/marketing/AntigravityBackground'), {
  ssr: false,
});

type ServiceItem = { title: string; desc: string; price: string; href?: string };
type ServiceGroup = { label: string; items: ServiceItem[] };
type DropdownKey = 'product' | 'services';
type NavLink = {
  name: string;
  href: string;
  id: string;
  dropdown?: boolean;
  dropdownType?: DropdownKey;
  borderRadius?: string;
};

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<DropdownKey | null>(null);
  const [activeMobileDropdown, setActiveMobileDropdown] = useState<DropdownKey | null>(null);
  const [renderCanvas, setRenderCanvas] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [forceExpanded, setForceExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDarkSection, setIsDarkSection] = useState(true);
  const [isSystemDark, setIsSystemDark] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Partial<Record<DropdownKey, HTMLButtonElement | null>>>({});
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    setIsSystemDark(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsSystemDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const checkSectionTheme = () => {
      const checkY = 85;
      const checkX = Math.min(window.innerWidth / 2, 400);
      const element = document.elementFromPoint(checkX, checkY);
      if (!element) return;

      const heroEl = element.closest('#home');
      if (heroEl || window.scrollY < 300) {
        setIsDarkSection(true);
        return;
      }

      const section = element.closest('section, main, header, div[id]');
      if (section) {
        const isDarkBgClass =
          section.classList.contains('bg-slate-950') ||
          section.classList.contains('bg-[#0B0F19]') ||
          section.classList.contains('bg-black') ||
          section.getAttribute('data-theme') === 'dark';

        if (isDarkBgClass) {
          setIsDarkSection(true);
          return;
        }

        const bg = window.getComputedStyle(section).backgroundColor;
        const rgb = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (rgb) {
          const [, r, g, b] = rgb.map(Number);
          if (r + g + b < 250 && bg !== 'rgba(0, 0, 0, 0)') {
            setIsDarkSection(true);
            return;
          }
        }
      }

      setIsDarkSection(false);
    };

    checkSectionTheme();
    window.addEventListener('scroll', checkSectionTheme, { passive: true });
    window.addEventListener('resize', checkSectionTheme, { passive: true });
    return () => {
      window.removeEventListener('scroll', checkSectionTheme);
      window.removeEventListener('resize', checkSectionTheme);
    };
  }, []);

  const isDarkNav = isSystemDark || isDarkSection;

  const handleMouseEnterDropdown = (key: DropdownKey) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
    setActiveDropdown(key);
  };

  const handleMouseLeaveDropdown = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 200);
  };

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (activeDropdown === 'product') {
      setRenderCanvas(true);
    } else {
      timeoutId = setTimeout(() => {
        setRenderCanvas(false);
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [activeDropdown]);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    // Split thresholds: without the gap, jitter around a single 80px boundary
    // restarts the 560ms shell animation in both directions.
    let ticking = false;
    const sync = () => {
      ticking = false;
      const y = window.scrollY;
      setScrolled((was) => (was ? y > 40 : y > 80));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      // Clear force-expanded state once user scrolls.
      if (forceExpanded) {
        setForceExpanded(false);
      }
      requestAnimationFrame(sync);
    };
    sync();
    // Enable the transition only once the restored scroll position has been
    // reflected, so a reload deep in the page paints the pill directly.
    const raf = requestAnimationFrame(() => setMounted(true));
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [forceExpanded]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash;
      const scrollToHash = () => {
        const element = document.querySelector(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
          return true;
        }
        return false;
      };

      if (!scrollToHash()) {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (scrollToHash() || attempts > 20) {
            clearInterval(interval);
          }
        }, 100);
        return () => clearInterval(interval);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (isOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      // Signal the open mobile menu so the chat widget can drop below it.
      document.body.classList.add('mobile-menu-open');
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.classList.remove('mobile-menu-open');
    }
    // Restore the overflow too, not just the class: unmounting while the menu
    // is open otherwise leaves the page permanently unscrollable.
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.classList.remove('mobile-menu-open');
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (activeDropdown) {
        const trigger = triggerRefs.current[activeDropdown];
        setActiveDropdown(null);
        trigger?.focus();
      } else if (isOpen) {
        setIsOpen(false);
      } else if (activeMobileDropdown) {
        setActiveMobileDropdown(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeDropdown, isOpen, activeMobileDropdown]);

  // Vaayu product — the Business Intelligence console and its capability modules.
  // (These mirror the dashboard panels: Leads, Funnel, ROI, Conversations.)
  const productGroups: ServiceGroup[] = [
    {
      label: 'Vaayu',
      items: [
        { title: 'Vaayu — A Business Intelligence', desc: 'AI chat that captures leads & proves ROI', price: 'Live', href: '/vaayu' },
        { title: 'Lead Capture & Scoring', desc: 'Turn conversations into qualified leads', price: 'Included', href: '/vaayu#leads' },
        { title: 'Conversion Funnel', desc: 'See where visitors drop off & convert', price: 'Included', href: '/vaayu#funnel' },
        { title: 'ROI & Attribution', desc: 'Revenue traced back to every chat', price: 'Included', href: '/vaayu#roi' },
        { title: 'Conversations & Insights', desc: 'What customers ask, auto-summarized', price: 'Included', href: '/vaayu#conversations' },
      ],
    },
  ];

  // Sapybase agency services — the company layer (parent of Vaayu).
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

  // Shared config for both nav dropdowns. Product = Vaayu (animated, hero);
  // Services = Sapybase agency (static, calm). Same UI, driven by this map.
  const dropdownConfig: Record<DropdownKey, {
    heading: string;
    pitch?: string;
    items: ServiceItem[];
    icon: string;
    itemHref: string;
    animated: boolean;
    cta: { label: string; href: string };
  }> = {
    product: {
      heading: 'Vaayu — A Business Intelligence',
      items: productGroups.flatMap((g) => g.items),
      icon: '/vaayu_logo.svg',
      itemHref: '/vaayu', // dedicated Vaayu product page (per-item anchors below)
      animated: true,
      cta: { label: 'See pricing', href: '/pricing' },
    },
    services: {
      heading: 'Engineering digital excellence',
      pitch: 'From code to cloud — custom AI, web apps & infrastructure, built by Sapybase.',
      items: serviceGroups.flatMap((g) => g.items),
      icon: '/logo2-straight.svg',
      itemHref: '/services',
      animated: false,
      cta: { label: 'See all services', href: '/services' },
    },
  };

  const navLinks: NavLink[] = [
    { name: 'Home', href: '/#home', id: 'home', borderRadius: 'rounded-tl-[28px] rounded-bl-[28px] rounded-tr-[4px] rounded-br-[4px]' },
    { name: 'Vaayu', href: '/vaayu', id: 'product', borderRadius: 'rounded-full' },
    { name: 'Services', href: '/services', id: 'services', dropdown: true, dropdownType: 'services', borderRadius: 'rounded-tl-[24px] rounded-br-[24px] rounded-tr-none rounded-bl-none' },
    { name: 'Docs', href: '/docs', id: 'docs', borderRadius: 'rounded-tl-[16px] rounded-tr-[30px] rounded-bl-[4px] rounded-br-[4px]' },
    { name: 'Blog', href: '/blog', id: 'blog', borderRadius: 'rounded-tl-[30px] rounded-bl-[16px] rounded-tr-[4px] rounded-br-[4px]' },
    { name: 'About', href: '/about', id: 'about', borderRadius: 'rounded-tr-[28px] rounded-br-[28px] rounded-tl-[4px] rounded-bl-[4px]' },
  ];

  const handleLinkClick = (e: React.MouseEvent, href: string) => {
    setIsOpen(false);
    setActiveDropdown(null);
    setActiveMobileDropdown(null);

    const [basePath, hash] = href.split('#');
    const targetPath = basePath || '/';

    if (hash && pathname === targetPath) {
      e.preventDefault();
      const targetElement = document.querySelector(`#${hash}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  // The bar retracts into its arrow pill when scrolled down on desktop, and only
  // unfurls at the top of the page. The remaining terms are guards, not triggers:
  // focus inside the nav, an open dropdown, or the open mobile menu all stop the
  // bar retracting out from under the user mid-interaction. forceExpanded keeps the
  // bar open after a click, until the user scrolls again.
  const collapsed = scrolled && !focusWithin && !activeDropdown && !isOpen && !forceExpanded;

  // Expand the navbar in place without scrolling the page. The forceExpanded state
  // keeps it open until the user scrolls, then auto-collapse/expand logic resumes.
  const handleRevealClick = () => {
    setForceExpanded(true);
  };

  return (
    <>
      <header
        className={`fixed z-50 pointer-events-none top-0 left-0 w-full overflow-hidden lg:w-[calc(100%-32px)] lg:max-w-[1400px] lg:left-1/2 lg:-translate-x-1/2 transition-[height] duration-500 ease-[var(--nav-ease)] ${isOpen ? 'h-dvh lg:h-[80px]' : activeDropdown ? 'h-[80px] lg:h-[440px]' : 'h-[80px]'
          }`}
      >
        {/* Glass surface with rounded bottom corners on mobile. */}
        <div
          aria-hidden
          className={`nav-shell__layer nav-shell__layer--inner absolute top-0 left-0 right-0 bottom-0 pointer-events-none backdrop-blur-xl saturate-150 rounded-2xl lg:rounded-[27px] border-none shadow-sm transition-colors duration-500 ${isDarkNav
            ? 'bg-[#0B0F19]/80'
            : 'bg-white/75'
            } ${mounted ? 'nav-shell__layer--animated' : ''
            } ${collapsed ? 'nav-shell__layer--collapsed' : ''}`}
        />

        {/* Collapsed-pill control: marks where the nav is and scrolls back to the
            top. `invisible` while expanded so it cannot swallow nav-link clicks. */}
        <button
          type="button"
          onClick={handleRevealClick}
          tabIndex={collapsed ? 0 : -1}
          aria-label="Back to top and show navigation"
          className={`hidden lg:flex absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[30px] items-center justify-center cursor-pointer transition-[opacity,visibility] ease-[var(--nav-ease)] motion-reduce:transition-none ${mounted ? '' : 'transition-none'
            } ${collapsed
              ? 'opacity-100 visible pointer-events-auto duration-200 delay-[380ms]'
              : 'opacity-0 invisible pointer-events-none duration-[120ms]'
            }`}
        >
          <ArrowDownIcon size={14} className={`transition-colors duration-300 ${isDarkNav ? 'text-slate-300' : 'text-slate-900'}`} />
        </button>

        {/* Focus tracking lives here, not on the <header>: the pill button is a
            sibling, so focusing it must not expand the bar in place. */}
        <div
          onFocusCapture={() => setFocusWithin(true)}
          onBlurCapture={() => setFocusWithin(false)}
          className={`relative w-full max-w-screen-2xl mx-auto h-[80px] flex items-center justify-between pointer-events-auto transition-[opacity,visibility,transform] ease-[var(--nav-ease)] motion-reduce:transition-none ${mounted ? '' : 'transition-none'
            } ${collapsed
              ? 'opacity-100 visible translate-y-0 duration-200 lg:opacity-0 lg:invisible lg:-translate-y-3'
              : 'opacity-100 visible translate-y-0 duration-300 delay-[260ms]'
            }`}>

          {/* Cell 1: Logo */}
          <div className="px-6 h-full flex items-center shrink-0 min-w-fit">
            <Link href="/#home" onClick={(e) => handleLinkClick(e, '/#home')} className="flex items-center">
              <Logo className="h-10 w-auto" />
            </Link>
          </div>

          {/* Cell 2: Desktop Navigation Links (md+) */}
          <div ref={dropdownRef} className="hidden lg:flex flex-1 items-center justify-center gap-1.5 xl:gap-2 px-2 h-full">
            {navLinks.map((link) => {
              const itemRadius = link.borderRadius || 'rounded-full';
              return (
                <div
                  key={`nav-desk-${link.id || link.name}`}
                  className="relative text-base xl:text-lg font-newsreader font-normal antialiased h-full flex items-center"
                  onMouseEnter={() => {
                    if (link.dropdown && link.dropdownType) {
                      handleMouseEnterDropdown(link.dropdownType);
                    }
                  }}
                  onMouseLeave={() => {
                    if (link.dropdown && link.dropdownType) {
                      handleMouseLeaveDropdown();
                    }
                  }}
                >
                  {link.dropdown && link.dropdownType ? (() => {
                    const cfg = dropdownConfig[link.dropdownType];
                    const key = link.dropdownType;
                    const isActive = activeDropdown === key;
                    return (
                      <>
                        <button
                          ref={(el) => { triggerRefs.current[key] = el; }}
                          onClick={() => setActiveDropdown(isActive ? null : key)}
                          onMouseEnter={() => handleMouseEnterDropdown(key)}
                          onMouseLeave={handleMouseLeaveDropdown}
                          aria-expanded={isActive}
                          aria-haspopup="true"
                          aria-controls={`nav-dropdown-${key}`}
                          className={`text-base xl:text-lg font-newsreader font-normal antialiased transition-all duration-200 flex items-center justify-center gap-1.5 group cursor-pointer px-6 xl:px-7 min-h-[56px] h-[56px] pt-[0.2em] select-none ${itemRadius} ${isActive
                            ? isDarkNav
                              ? 'bg-white/15 text-white shadow-sm'
                              : 'bg-slate-900/15 text-slate-950 shadow-sm'
                            : isDarkNav
                              ? 'bg-white/[0.05] text-slate-100 hover:text-white hover:bg-white/10'
                              : 'bg-slate-900/[0.04] text-slate-900 hover:text-slate-950 hover:bg-slate-900/[0.08]'
                            }`}
                        >
                          <span>{link.name}</span>
                          <ArrowDownIcon
                            size={12}
                            className={`transition-transform duration-200 ${isDarkNav
                              ? 'text-slate-100 group-hover:text-white'
                              : 'text-slate-900 group-hover:text-slate-950'
                              } ${isActive ? 'rotate-180' : ''}`}
                          />
                        </button>

                        {/* Desktop Dropdown */}
                        <div
                          id={`nav-dropdown-${key}`}
                          className={`absolute top-[80px] left-1/2 -translate-x-1/2 w-[760px] max-w-[calc(100vw-2rem)] border-none transition-all duration-300 ease-[var(--nav-ease)] motion-reduce:transition-none z-50 origin-top overflow-hidden ${isActive
                              ? 'opacity-100 translate-y-0 scale-100 delay-150 ease-out pointer-events-auto'
                              : 'opacity-0 -translate-y-2 scale-95 delay-0 duration-150 ease-in pointer-events-none'
                            }`}
                          onMouseEnter={() => handleMouseEnterDropdown(key)}
                          onMouseLeave={handleMouseLeaveDropdown}
                        >
                          {/* Invisible hover bridge sealing top-[76px] to top-[80px]. Only
                              live while open - otherwise this 760px strip sits under the
                              neighbouring nav links and opens the panel from their hover. */}
                          <div className={`absolute -top-4 left-0 w-full h-4 bg-transparent ${isActive ? 'pointer-events-auto' : 'pointer-events-none'}`} />
                          <div className="flex p-8">
                            {/* Left Content */}
                            <div className="w-1/2 pr-12 flex flex-col items-start justify-between">
                              <div>
                                <h3 className={`text-2xl font-google font-medium leading-tight mb-6 tracking-tight transition-colors ${isDarkNav ? 'text-white' : 'text-slate-900'
                                  }`}>
                                  {cfg.heading}
                                </h3>

                                {/* Left visual: animated canvas (Product) or static gradient (Services) */}
                                <div className="relative w-full h-48 overflow-hidden rounded-2xl">
                                  {cfg.animated ? (
                                    renderCanvas && isActive && !prefersReducedMotion && (
                                      <AntigravityBackground
                                        effectStyle="water_drop"
                                        particleCount={100}
                                        particleType="dot"
                                        particleSize={0.07}
                                        colorPalette={['#3730A3', '#4F46E5', '#3B82F6', '#1D4ED8']}
                                        particleSeparation={0.6}
                                        speed={1}
                                        cameraPosition={[0, 0, 26]}
                                        parallaxBaseY={0}
                                        parallaxX={0}
                                        parallaxY={0}
                                        fog={null}
                                        containerClassName="absolute inset-0 pointer-events-none"
                                      />
                                    )
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center p-5">
                                      <p className={`text-sm font-google leading-relaxed text-center transition-colors ${isDarkNav ? 'text-slate-400' : 'text-slate-600'
                                        }`}>
                                        {cfg.pitch}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Link href={cfg.cta.href} onClick={() => setActiveDropdown(null)} className={`px-5 py-2.5 border text-sm font-google font-medium rounded-full transition-colors ${isDarkNav
                                ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-white'
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200/50 text-slate-900'
                                }`}>
                                {cfg.cta.label}
                              </Link>
                            </div>

                            {/* Right Content - Item List */}
                            <div className={`w-1/2 flex flex-col divide-y ${isDarkNav ? 'divide-slate-800/70' : 'divide-slate-200/70'
                              }`}>
                              {cfg.items.map((service, idx) => {
                                return (
                                  <Link
                                    key={`${link.dropdownType}-drop-${idx}`}
                                    href={service.href ?? cfg.itemHref}
                                    onClick={() => setActiveDropdown(null)}
                                    className={`group/item flex items-center justify-between px-4 py-3 rounded-2xl transition-colors ${isDarkNav ? 'hover:bg-slate-900/50' : 'hover:bg-slate-50'
                                      }`}
                                  >
                                    <div className="flex items-center gap-4">
                                      <img src={cfg.icon} alt="" decoding="async" className="w-5 h-auto opacity-70 group-hover/item:opacity-100 transition-opacity" />
                                      <span className={`text-[15px] font-google transition-colors ${isDarkNav
                                        ? 'text-slate-300 group-hover/item:text-slate-100'
                                        : 'text-slate-700 group-hover/item:text-slate-900'
                                        }`}>
                                        {service.title}
                                      </span>
                                    </div>
                                    <span className={`material-symbols-outlined text-[16px] transition-all duration-300 ease-out group-hover/item:translate-x-0.5 group-hover/item:-translate-y-0.5 ${isDarkNav
                                      ? 'text-slate-500 group-hover/item:text-blue-400'
                                      : 'text-slate-400 group-hover/item:text-blue-600'
                                      }`}>
                                      arrow_outward
                                    </span>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })() : (
                    <Link
                      href={link.href}
                      onClick={(e) => handleLinkClick(e, link.href)}
                      className={`text-base xl:text-lg font-newsreader font-normal antialiased transition-all duration-200 px-6 xl:px-7 min-h-[56px] h-[56px] pt-[0.2em] cursor-pointer select-none flex items-center justify-center ${itemRadius} ${isDarkNav
                        ? 'bg-white/[0.05] text-slate-100 hover:text-white hover:bg-white/10'
                        : 'bg-slate-900/[0.04] text-slate-900 hover:text-slate-950 hover:bg-slate-900/[0.08]'
                        }`}
                    >
                      <span>{link.name}</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cell 3: Auth & Account (Desktop md+) */}
          <div className="hidden lg:flex items-center h-full overflow-hidden shrink-0">
            <Show when="signed-out">
              <div className="h-full flex items-center px-1 xl:px-4 transition-colors duration-500">
                <SignInButton mode="redirect">
                  <button className={`text-base xl:text-lg font-newsreader font-normal transition-all duration-200 px-6 xl:px-7 min-h-[56px] h-[56px] pt-[0.2em] cursor-pointer rounded-l-[28px] rounded-r-[20px] select-none flex items-center justify-center ${isDarkNav
                    ? 'bg-white/[0.05] text-slate-100 hover:text-white hover:bg-white/10'
                    : 'bg-slate-900/[0.04] text-slate-900 hover:text-slate-950 hover:bg-slate-900/[0.08]'
                    }`}>
                    <span>Login</span>
                  </button>
                </SignInButton>
              </div>
            </Show>
            <Show when="signed-in">
              <div className="h-full flex items-center px-3 lg:px-6 gap-6 transition-[background-color] duration-500 bg-transparent">
                <Link
                  href="/dashboard"
                  className={`text-base font-google font-normal transition-all ease-in-out duration-300 flex items-center gap-2 px-4 py-2 ${isDarkNav ? 'text-slate-100' : 'text-slate-900'
                    } hover:text-transparent bg-clip-text bg-linear-to-r from-green-600 to-blue-600`}
                >
                  <span className="material-symbols-outlined ">dashboard</span>
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
          <div className="flex items-center lg:hidden h-full">
            <Show when="signed-in">
              <div className="h-16 w-16 flex items-center justify-center overflow-hidden transition-[background-color] duration-500 bg-transparent">
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
              className={`h-16 w-16 flex items-center justify-center rounded-none transition-colors bg-transparent ${isDarkNav
                ? 'text-slate-100 active:bg-slate-900'
                : 'text-slate-900 active:bg-slate-50'
                }`}
              aria-label="Toggle Menu"
              aria-expanded={isOpen}
              aria-controls="mobile-nav-menu"
            >
              {isOpen ? <span className="material-symbols-outlined text-[20px]">close</span> : <span className="material-symbols-outlined text-[20px]">menu</span>}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu - Integrated seamlessly into the expanded header glass shell */}
        <div
          id="mobile-nav-menu"
          className={`absolute top-[80px] left-0 right-0 bottom-0 z-40 transition-all duration-300 ease-in-out lg:hidden flex flex-col pointer-events-auto bg-transparent overflow-hidden ${isOpen
            ? 'opacity-100 translate-y-0 delay-150 ease-out'
            : 'opacity-0 -translate-y-2 delay-0 duration-150 ease-in pointer-events-none'
            }`}
          style={{ touchAction: 'pan-y' }}
        >
          {/* Scrollable Nav Items */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="flex flex-col bg-transparent">
              {navLinks.map((link, navIdx) => (
                <div key={`nav-mob-${link.id || link.name}`}>
                  {link.dropdown && link.dropdownType ? (() => {
                    const cfg = dropdownConfig[link.dropdownType];
                    const isOpenMob = activeMobileDropdown === link.dropdownType;
                    return (
                      <div>
                        {/* Dropdown toggle row */}
                        <button
                          onClick={() => setActiveMobileDropdown(isOpenMob ? null : link.dropdownType!)}
                          aria-expanded={isOpenMob}
                          aria-controls={`mob-dropdown-${link.dropdownType}`}
                          className={`w-full px-8 py-6 flex items-center justify-between text-xl font-newsreader font-normal transition-colors ${isDarkNav
                            ? 'text-slate-100 hover:bg-slate-900/50'
                            : 'text-slate-800 hover:bg-slate-50/50'
                            }`}
                        >
                          <span>{link.name}</span>
                          <span
                            className={`material-symbols-outlined text-[18px] opacity-40 transition-transform duration-300 ${isOpenMob ? 'rotate-180' : ''}`}
                          >
                            expand_more
                          </span>
                        </button>

                        {/* Dropdown sub-items */}
                        <div id={`mob-dropdown-${link.dropdownType}`} className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[var(--nav-ease)] motion-reduce:transition-none ${isOpenMob ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="overflow-y-auto max-h-[50vh]" style={{ touchAction: 'pan-y' }}>
                            <div className="px-6 pb-8 flex flex-col gap-1">

                              {/* Header (mirrors desktop) */}
                              <div className="px-2 py-4 mb-2">
                                <h4 className={`text-xl font-google font-medium leading-tight mb-2 tracking-tight transition-colors ${isDarkNav ? 'text-white' : 'text-slate-900'
                                  }`}>
                                  {cfg.heading}
                                </h4>
                              </div>

                              {cfg.items.map((service, idx) => {
                                return (
                                  <Link
                                    key={`mob-${link.dropdownType}-${idx}`}
                                    href={service.href ?? cfg.itemHref}
                                    onClick={() => {
                                      setIsOpen(false);
                                      setActiveMobileDropdown(null);
                                    }}
                                    className={`group/item flex items-center justify-between px-4 py-4 rounded-2xl transition-all duration-300 ${isDarkNav
                                      ? 'bg-slate-900/30 hover:bg-slate-800/50'
                                      : 'bg-slate-50/50 hover:bg-slate-100'
                                      }`}
                                  >
                                    <div className="flex items-center gap-4">
                                      <img src={cfg.icon} alt="" decoding="async" className="w-5 h-auto opacity-40 group-hover/item:opacity-80 transition-opacity" />
                                      <div className="flex flex-col">
                                        <span className={`text-[15px] font-google font-medium transition-colors ${isDarkNav ? 'text-slate-200' : 'text-slate-700'
                                          }`}>
                                          {service.title}
                                        </span>
                                        <span className="text-xs font-google text-slate-500">
                                          {service.price}
                                        </span>
                                      </div>
                                    </div>
                                    <span className={`material-symbols-outlined text-[16px] transition-colors ${isDarkNav ? 'text-slate-600 group-hover/item:text-blue-400' : 'text-slate-300 group-hover/item:text-blue-600'
                                      }`}>
                                      chevron_right
                                    </span>
                                  </Link>
                                );
                              })}

                              <Link
                                href={cfg.cta.href}
                                onClick={() => setIsOpen(false)}
                                className={`mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded-full text-sm font-google font-medium transition-colors ${isDarkNav ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'
                                  }`}
                              >
                                {cfg.cta.label}
                                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })() : (
                    <Link
                      href={link.href}
                      onClick={(e) => handleLinkClick(e, link.href)}
                      className={`w-full px-8 py-6 flex items-center justify-between text-xl font-newsreader font-normal transition-colors ${isDarkNav
                        ? 'text-slate-100 hover:bg-slate-900/50'
                        : 'text-slate-800 hover:bg-slate-50/50'
                        }`}
                    >
                      <span>{link.name}</span>
                      <span className="material-symbols-outlined text-[18px] opacity-40">chevron_right</span>
                    </Link>
                  )}

                  {/* Padded divider line under navlinks except the last one */}
                  {navIdx !== navLinks.length - 1 && (
                    <div className={`mx-8 h-px ${isDarkNav ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Bottom CTA Section */}
          <div className="p-6 sm:p-8 bg-transparent space-y-4 border-none shrink-0">
            <Show when="signed-out">
              <div className="flex flex-row gap-3">
                <SignUpButton mode="redirect">
                  <button className="flex-1 bg-slate-800 dark:bg-slate-900 text-white py-3 text-sm font-google font-medium hover:bg-slate-700 dark:hover:bg-slate-800 transition-all rounded-full">
                    Start Free Trial
                  </button>
                </SignUpButton>
                <SignInButton mode="redirect">
                  <button className="flex-1 text-slate-900 dark:text-slate-200 py-3 text-sm font-google font-medium rounded-full hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors border-none bg-slate-100 dark:bg-slate-800">
                    Login to System
                  </button>
                </SignInButton>
              </div>
            </Show>

            <Show when="signed-in">
              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className="w-full bg-slate-900 dark:bg-blue-600 text-white py-3 text-sm font-google  font-medium hover:bg-slate-800 dark:hover:bg-blue-500 transition-all rounded-full flex items-center justify-center gap-2 tracking-wider"
              >
                <span className='material-symbols-outlined text-sm text-white'>dashboard</span> Dashboard
              </Link>
            </Show>
          </div>
        </div>
      </header>
    </>
  );
}

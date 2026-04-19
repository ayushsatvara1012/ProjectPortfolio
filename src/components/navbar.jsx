import { useState, useEffect, useRef } from "react";
import { Menu, X, ArrowRight, Bot, Code2, Globe as GlobeIcon, Activity, ChevronDown, Cloud, Zap, BrainCircuit } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { UserButton, SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/clerk-react";
import Logo from "./Logo";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "unset";
      document.body.style.overflow = "unset";
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsServicesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const serviceGroups = [
    {
      label: "Build",
      items: [
        { title: "Custom AI Chatbot", desc: "LLM-powered support & sales agents", price: "From $3,000", icon: <Bot size={15} /> },
        { title: "RAG Pipeline Architecture", desc: "pgvector · document retrieval · FastAPI", price: "From $2,500", icon: <BrainCircuit size={15} /> },
        { title: "Full-Stack Web App", desc: "React · FastAPI · PostgreSQL · AWS", price: "From $2,500", icon: <Code2 size={15} /> },
      ],
    },
    {
      label: "Optimize",
      items: [
        { title: "AI Integration & LLM Consulting", desc: "Embed AI into existing products", price: "Custom", icon: <Zap size={15} /> },
        { title: "Performance & SEO", desc: "Core Web Vitals · Technical SEO", price: "From $300", icon: <GlobeIcon size={15} /> },
        { title: "Cloud Infrastructure", desc: "AWS · S3 · EC2 · Route53 · Lambda", price: "From $400", icon: <Cloud size={15} /> },
      ],
    },
  ];

  const navLinks = [
    { name: "Home", href: "#home", id: "home" },
    { name: "Projects", href: "/about#projects", id: "projects" },
    { name: "Services", href: "#services", id: "services", dropdown: true },
    { name: "Docs", href: "/docs", id: "docs" },
    { name: "Contact", href: "/contact", id: "contact" },
    { name: "About", href: "/about", id: "about" },
  ];

  const handleLinkClick = (e, href) => {
    e.preventDefault();
    setIsOpen(false);
    setIsServicesOpen(false);

    if (href.startsWith("#")) {
      if (location.pathname === "/") {
        const targetElement = document.querySelector(href);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: "smooth" });
        }
      } else {
        navigate("/");
        setTimeout(() => {
          const targetElement = document.querySelector(href);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: "smooth" });
          }
        }, 100);
      }
    } else {
      navigate(href);
    }
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-white dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 h-16 transition-colors duration-500">
        <div className="max-w-screen mx-2 h-full flex items-center justify-between divide-x divide-gray-200 dark:divide-slate-800 border-x border-gray-200 dark:border-slate-800 transition-colors duration-500">

          {/* Cell 1: Logo */}
          <div className="px-6 h-full flex items-center shrink-0 min-w-fit">
            <a href="#home" onClick={(e) => handleLinkClick(e, '#home')} className="flex items-center">
              <Logo className="h-10 w-auto" />
            </a>
          </div>

          {/* Cell 2: Desktop Navigation Links (md+) */}
          <div className="hidden lg:flex flex-1 te items-center gap-4 lg:gap-8 xl:gap-10 px-6 lg:px-10 h-full">
            {navLinks.map((link) => (
              <div key={`nav-desk-${link.id || link.name}`} className="relative text-md font-display tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors h-full flex items-center" ref={link.dropdown ? dropdownRef : null}>
                {link.dropdown ? (
                  <button
                    onMouseEnter={() => setIsServicesOpen(true)}
                    onClick={() => setIsServicesOpen(!isServicesOpen)}
                    className="text-md font-display tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors h-full flex items-center gap-1.5 group"
                  >
                    {link.name}
                    <ChevronDown size={12} className={`opacity-40 transition-transform duration-200 ${isServicesOpen ? 'rotate-180' : ''}`} />

                    {/* Desktop Dropdown */}
                    <div
                      className={`absolute top-full left-0 w-[640px] bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 shadow-xl transition-all duration-200 z-50 ${isServicesOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'}`}
                      onMouseLeave={() => setIsServicesOpen(false)}
                    >
                      {/* Header strip */}
                      <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-widest font-bold font-display text-slate-400 dark:text-slate-500">Services</span>
                        <span className="text-[10px] uppercase tracking-widest font-bold font-display text-slate-300 dark:text-slate-600">6 modules</span>
                      </div>

                      {/* Two-column partitioned grid */}
                      <div className="grid grid-cols-2 gap-px bg-gray-100 dark:bg-slate-800">
                        {serviceGroups.map((group) => (
                          <div key={group.label} className="flex flex-col gap-px bg-gray-100 dark:bg-slate-800">
                            {/* Partition label */}
                            <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2">
                              <span className="text-[9px] uppercase tracking-widest font-bold font-display text-slate-400 dark:text-slate-500">{group.label}</span>
                            </div>
                            {group.items.map((service, idx) => (
                              <a
                                key={`service-drop-${group.label}-${idx}`}
                                href="#services"
                                onClick={(e) => handleLinkClick(e, '#services')}
                                className="bg-white dark:bg-slate-950 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-start gap-3 group/item"
                              >
                                <div className="w-7 h-7 mt-0.5 shrink-0 border border-gray-200 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover/item:border-blue-200 dark:group-hover/item:border-blue-800 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors">
                                  {service.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-display font-bold text-slate-900 dark:text-slate-200 leading-tight">{service.title}</p>
                                  <p className="text-[11px] font-google text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{service.desc}</p>
                                  <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors mt-1 inline-block">{service.price}</span>
                                </div>
                              </a>
                            ))}
                          </div>
                        ))}
                      </div>

                      {/* View all footer */}
                      <Link
                        to="/services"
                        onClick={() => setIsServicesOpen(false)}
                        className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group/footer"
                      >
                        <span className="text-xs font-display font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 group-hover/footer:text-blue-600 dark:group-hover/footer:text-blue-400 transition-colors">View All Services</span>
                        <ArrowRight size={12} className="text-slate-400 group-hover/footer:text-blue-600 dark:group-hover/footer:text-blue-400 transition-colors" />
                      </Link>
                    </div>
                  </button>
                ) : (
                  <a
                    href={link.href}
                    onClick={(e) => handleLinkClick(e, link.href)}
                    className="text-md font-display tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors py-2 relative group"
                  >
                    {link.name}
                    <div className="absolute -bottom-1 left-0 w-full h-px bg-slate-900 dark:bg-slate-200 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* Cell 3: Auth & Account (Desktop md+) */}
          <div className="hidden lg:flex items-center gap-px bg-gray-200 dark:bg-slate-800 h-full overflow-hidden shrink-0 transition-colors duration-500">
            <SignedOut>
              <div className="h-full bg-white dark:bg-slate-950 flex items-center px-2 lg:px-4 transition-colors duration-500">
                <SignInButton mode="modal">
                  <button className="font-display text-md tracking-widest text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors px-4 py-3">
                    Login
                  </button>
                </SignInButton>
              </div>
              <div className="h-full bg-slate-950 flex items-center transition-colors duration-500">
                <SignUpButton mode="modal">
                  <button className="bg-slate-900 tracking-widest text-white font-display text-md px-4 lg:px-6 xl:px-8 py-5 h-full transition-all rounded-none shrink-0 duration-500 group">
                    <span className="group-hover:text-transparent bg-clip-text bg-linear-to-r from-green-600 to-blue-600 transition-all duration-500">
                      Get_Started
                    </span>
                  </button>
                </SignUpButton>
              </div>
            </SignedOut>
            <SignedIn>
              <div className="h-full bg-white dark:bg-slate-950 flex items-center px-3 lg:px-6 gap-6 transition-colors duration-500">
                <Link
                  to="/app"
                  className="text-md text-slate-900 dark:text-slate-200 font-display hover:text-transparent bg-clip-text bg-linear-to-r from-green-600 to-blue-600 transition-all ease-in-out duration-300 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">dashboard</span>
                  Dashboard
                </Link>
                <div className="h-10 w-10 group/user p-0 flex items-center justify-center">
                  <UserButton
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        avatarBox: "w-8 h-8 rounded-none",
                        userButtonTrigger: "rounded-none"
                      }
                    }}

                  />
                </div>
              </div>
            </SignedIn>
          </div>

          {/* Mobile Actions (Hamburger & Auth) */}
          <div className="flex items-center lg:hidden h-full gap-px bg-gray-200 dark:bg-slate-800 transition-colors duration-500">
            <SignedIn>
              <div className="h-16 w-16 bg-white dark:bg-slate-950 flex items-center justify-center border-l border-gray-200 dark:border-slate-800 overflow-hidden transition-colors duration-500">
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "w-9 h-9 rounded-none",
                      userButtonTrigger: "p-0 rounded-none w-full h-full"
                    }
                  }}
                />
              </div>
            </SignedIn>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="h-16 w-16 bg-white dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-slate-200 active:bg-slate-50 dark:active:bg-slate-900 transition-colors border-l border-gray-200 dark:border-slate-800 rounded-none"
              aria-label="Toggle Menu"
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Zero-Scroll Mobile Dropdown Menu */}
      <div
        className={`fixed top-16 left-0 w-full h-[calc(100vh-64px)] z-40 bg-white dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 transition-all duration-500 ease-in-out lg:hidden flex flex-col overflow-hidden ${isOpen ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
          }`}
      >
        <div className="flex-1 flex flex-col h-full overflow-y-auto">
          <div className="flex flex-col bg-white dark:bg-slate-950">
            {navLinks.map((link) => (
              link.dropdown ? (
                <div key={`nav-mob-${link.id}`} className="border-b border-gray-100 dark:border-slate-800">
                  {/* Services toggle row */}
                  <button
                    onClick={() => setIsServicesOpen(p => !p)}
                    className="w-full px-8 py-5 flex items-center justify-between text-md font-display uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                  >
                    <span>{link.name}</span>
                    <ChevronDown size={16} className={`opacity-40 transition-transform duration-200 ${isServicesOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Services sub-items */}
                  <div className={`overflow-hidden transition-all duration-300 ${isServicesOpen ? 'max-h-[600px]' : 'max-h-0'}`}>
                    <div className="border-t border-gray-100 dark:border-slate-800">
                      {serviceGroups.map((group) => (
                        <div key={group.label}>
                          {/* Partition label */}
                          <div className="px-8 py-2 bg-slate-50 dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
                            <span className="text-[9px] uppercase tracking-widest font-bold font-display text-slate-400 dark:text-slate-500">{group.label}</span>
                          </div>
                          {group.items.map((service, idx) => (
                            <a
                              key={`mob-svc-${group.label}-${idx}`}
                              href="#services"
                              onClick={(e) => handleLinkClick(e, '#services')}
                              className="flex items-center gap-4 px-8 py-3.5 border-b border-gray-50 dark:border-slate-800/60 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                            >
                              <div className="w-7 h-7 shrink-0 border border-gray-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
                                {service.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-display font-bold text-slate-800 dark:text-slate-200 leading-tight">{service.title}</p>
                                <p className="text-[11px] font-google text-slate-500 dark:text-slate-400 truncate mt-0.5">{service.desc}</p>
                              </div>
                              <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 shrink-0">{service.price}</span>
                            </a>
                          ))}
                        </div>
                      ))}
                      <Link
                        to="/services"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-between px-8 py-4 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <span className="text-xs font-display font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">View All Services</span>
                        <ArrowRight size={12} className="text-blue-600 dark:text-blue-400" />
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <a
                  key={`nav-mob-${link.id || link.name}`}
                  href={link.href}
                  onClick={(e) => handleLinkClick(e, link.href)}
                  className="w-full border-b border-gray-100 dark:border-slate-800 px-8 py-5 sm:py-6 flex items-center justify-between text-md font-display uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                  <span>{link.name}</span>
                  <ArrowRight size={18} className="opacity-40" />
                </a>
              )
            ))}
          </div>

          {/* Mobile Bottom CTA Section */}
          <div className="p-6 sm:p-8 bg-white dark:bg-slate-950 mt-auto border-t border-gray-200 dark:border-slate-800 space-y-4">
            <SignedOut>
              <SignUpButton mode="modal">
                <button className="w-full bg-slate-800 dark:bg-slate-900 text-white py-6 text-md font-display tracking-widest font-bold hover:bg-slate-700 dark:hover:bg-slate-800 transition-all rounded-none mb-3 border-4 border-l-green-500 dark:border-y-slate-950 dark:border-r-slate-950">
                  Start_Free_Trial
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button className="w-full border border-gray-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 py-6 text-md font-display tracking-widest font-bold rounded-none hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                  Login_to_System
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <Link
                to="/app"
                onClick={() => setIsOpen(false)}
                className="w-full bg-slate-900 dark:bg-indigo-600 text-white py-6 text-md font-display tracking-widest font-bold hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all rounded-none block text-center"
              >
                SYSTEM_DASHBOARD
              </Link>
            </SignedIn>

            <div className="pt-8 flex items-center justify-between text-slate-600 dark:text-slate-400">
              <div className="flex gap-6 text-[10px] uppercase tracking-widest font-bold font-sans">
                <a href="https://github.com/ayushsatvara1012" target="_blank" rel="noreferrer" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">GIT</a>
                <a href="https://www.linkedin.com/in/ayushsatvara" target="_blank" rel="noreferrer" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">LNK</a>
              </div>
              <div className="flex items-center gap-2">
                <Activity size={12} className="text-emerald-500 animate-pulse" />
                <span className="text-[10px] uppercase tracking-widest font-bold font-sans">Uptime: 99.99%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
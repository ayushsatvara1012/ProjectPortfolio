import React, { useState, useEffect, useRef } from "react";
import { Menu, X, ArrowRight, Bot, Code2, CloudCog, Globe as GlobeIcon, Activity, ChevronDown, Monitor, Smartphone, Layout, Settings } from "lucide-react";
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

  const services = [
    { title: "AI Integration", desc: "RAG-optimized LLM nodes", icon: <Bot size={18} /> },
    { title: "Web Engines", desc: "Sub-200ms TTFB stack", icon: <Code2 size={18} /> },
    { title: "Cloud Systems", desc: "AWS Lambda & Serverless", icon: <CloudCog size={18} /> },
    { title: "Global Sync", desc: "CDN-first edge sync", icon: <GlobeIcon size={18} /> },
    { title: "UI Engineering", desc: "Pixel-perfect architectural UI", icon: <Layout size={18} /> },
    { title: "System Ops", desc: "CI/CD & Kubernetes", icon: <Settings size={18} /> },
  ];

  const navLinks = [
    { name: "Home", href: "#home", id: "home" },
    { name: "Projects", href: "#projects", id: "projects" },
    { name: "Services", href: "#services", id: "services", dropdown: true },
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
      <header className="fixed top-0 w-full z-50 bg-white border-b border-gray-200 h-16">
        <div className="max-w-screen mx-2 h-full flex items-center justify-between divide-x divide-gray-200 border-x border-gray-200">

          {/* Cell 1: Logo */}
          <div className="px-6 h-full flex items-center shrink-0 min-w-fit">
            <a href="#home" onClick={(e) => handleLinkClick(e, '#home')} className="flex items-center">
              <Logo className="h-10 w-auto" />
            </a>
          </div>

          {/* Cell 2: Desktop Navigation Links (md+) */}
          <div className="hidden lg:flex flex-1 te items-center gap-4 lg:gap-8 xl:gap-10 px-6 lg:px-10 h-full">
            {navLinks.map((link) => (
              <div key={`nav-desk-${link.id || link.name}`} className="relative text-md font-display tracking-widest text-slate-500 hover:text-slate-900 transition-colors h-full flex items-center" ref={link.dropdown ? dropdownRef : null}>
                {link.dropdown ? (
                  <button
                    onMouseEnter={() => setIsServicesOpen(true)}
                    onClick={() => setIsServicesOpen(!isServicesOpen)}
                    className="text-md font-display tracking-widest text-slate-500 hover:text-slate-900 transition-colors h-full flex items-center gap-2 group"
                  >
                    {link.name}
                    <ChevronDown size={12} className={`opacity-40 transition-transform ${isServicesOpen ? 'rotate-180' : ''}`} />
                    
                    {/* Desktop Dropdown - Architectural Blueprint */}
                    <div 
                      className={`absolute top-16 left-0 w-[480px] bg-gray-200 p-0 border border-gray-200 shadow-2xl transition-all duration-300 z-50 grid grid-cols-2 gap-px ${
                        isServicesOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                      }`}
                      onMouseLeave={() => setIsServicesOpen(false)}
                    >
                      {services.map((service, idx) => (
                        <a 
                          key={`service-drop-${idx}`}
                          href="#services"
                          onClick={(e) => handleLinkClick(e, '#services')}
                          className="bg-white p-6 hover:bg-slate-50 transition-all flex items-start gap-4 group/item"
                        >
                          <div className="w-10 h-10 border border-gray-100 flex items-center justify-center text-slate-600 group-hover/item:border-indigo-200 group-hover/item:text-indigo-600 transition-all">
                            {service.icon}
                          </div>
                          <div className="text-left">
                            <h4 className="text-md font-display tracking-widest text-slate-900 mb-1">{service.title}</h4>
                            <p className="text-sm font-sans font-medium tracking-widest text-slate-600">{service.desc}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </button>
                ) : (
                  <a
                    href={link.href}
                    onClick={(e) => handleLinkClick(e, link.href)}
                    className="text-md font-display tracking-widest text-slate-500 hover:text-slate-900 transition-colors py-2 relative group"
                  >
                    {link.name}
                    <div className="absolute -bottom-1 left-0 w-full h-px bg-slate-900 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* Cell 3: Auth & Account (Desktop md+) */}
          <div className="hidden lg:flex items-center gap-px bg-gray-200 h-full overflow-hidden shrink-0">
            <SignedOut>
              <div className="h-full bg-white flex items-center px-2 lg:px-4">
                <SignInButton mode="modal">
                  <button className="font-display text-md tracking-widest text-slate-600 hover:text-slate-900 transition-colors px-4 py-3">
                    Login
                  </button>
                </SignInButton>
              </div>
              <div className="h-full bg-white flex items-center">
                <SignUpButton mode="modal">
                  <button className="bg-slate-900 tracking-widest text-white font-display text-md px-4 lg:px-6 xl:px-8 py-5 h-full hover:bg-indigo-600 transition-all rounded-none shrink-0">
                    Get_Started
                  </button>
                </SignUpButton>
              </div>
            </SignedOut>
            <SignedIn>
              <div className="h-full bg-white flex items-center px-3 lg:px-6 gap-6">
                <Link
                  to="/app/pricing"
                  className="text-md text-slate-900 font-display hover:text-indigo-600 transition-colors"
                >
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
          <div className="flex items-center lg:hidden h-full gap-px bg-gray-200">
            <SignedIn>
                <div className="h-16 w-16 bg-white flex items-center justify-center border-l border-gray-200 overflow-hidden">
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
              className="h-16 w-16 bg-white flex items-center justify-center text-slate-900 active:bg-slate-50 transition-colors border-l border-gray-200 rounded-none"
              aria-label="Toggle Menu"
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Zero-Scroll Mobile Dropdown Menu */}
      <div
        className={`fixed top-16 left-0 w-full h-[calc(100vh-64px)] z-40 bg-white border-b border-gray-200 transition-all duration-500 ease-in-out lg:hidden flex flex-col overflow-hidden ${
          isOpen ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex-1 flex flex-col h-full">
          <div className="flex flex-col bg-white">
            {navLinks.map((link) => (
              <a
                key={`nav-mob-${link.id || link.name}`}
                href={link.href}
                onClick={(e) => handleLinkClick(e, link.href)}
                className="w-full border-b border-gray-100 px-8 py-5 sm:py-6 flex items-center justify-between text-[10px] uppercase tracking-widest font-bold text-slate-600 font-sans hover:text-indigo-600 hover:bg-slate-50 transition-colors"
              >
                <span>{link.name}</span>
                <ArrowRight size={14} className="opacity-40" />
              </a>
            ))}
          </div>

          {/* Mobile Bottom CTA Section */}
          <div className="p-6 sm:p-8 bg-white mt-auto border-t border-gray-200 space-y-4">
            <SignedOut>
              <SignUpButton mode="modal">
                <button className="w-full bg-slate-900 text-white py-6 text-[10px] uppercase tracking-widest font-bold font-sans hover:bg-slate-800 transition-all rounded-none mb-3">
                  Start_Free_Trial
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                  <button className="w-full border border-gray-200 text-slate-900 py-6 text-[10px] uppercase tracking-widest font-bold font-sans rounded-none">
                    Login_to_System
                  </button>
              </SignInButton>
            </SignedOut>
            
            <SignedIn>
                <Link
                  to="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="w-full bg-slate-900 text-white py-6 text-[10px] uppercase tracking-widest font-bold font-sans hover:bg-slate-800 transition-all rounded-none block text-center"
                >
                  SYSTEM_DASHBOARD
                </Link>
            </SignedIn>

            <div className="pt-8 flex items-center justify-between text-slate-600">
                <div className="flex gap-6 text-[10px] uppercase tracking-widest font-bold font-sans">
                    <a href="https://github.com/ayushsatvara1012" target="_blank" rel="noreferrer">GIT</a>
                    <a href="https://www.linkedin.com/in/ayushsatvara" target="_blank" rel="noreferrer">LNK</a>
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
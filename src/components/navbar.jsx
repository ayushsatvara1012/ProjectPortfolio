import React, { useState, useEffect, useRef } from "react";
import { Menu, X, ArrowRight, ChevronDown, BrainCircuit, Code2, CloudCog, Globe as GlobeIcon, Bot, ScanSearch, LayoutDashboard, Key, ShieldCheck, LogIn, UserPlus } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth, UserButton, SignInButton, SignUpButton, SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import Logo from "./Logo";
import { useUserRole } from "../context/UserContext";


const Navbar = () => {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { userRole, isLoading: isContextLoading } = useUserRole();
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktopServicesOpen, setIsDesktopServicesOpen] = useState(false);
  const [isMobileServicesOpen, setIsMobileServicesOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDesktopServicesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Role fetching logic removed; now using global useUserRole()

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isOpen]);

  const services = [
    {
      title: "AI & Neural Integration",
      desc: "RAG-optimized LLMs",
      icon: <Bot size={18} />,
      href: "#services"
    },
    {
      title: "Ultra-Fast Web Engines",
      desc: "React/Vite apps with sub-200ms TTFB.",
      icon: <Code2 size={18} />,
      href: "#services"
    },
    {
      title: "Cloud Architecture",
      desc: "AWS Serverless & High-concurrency systems.",
      icon: <CloudCog size={18} />,
      href: "#services"
    },
    {
      title: "Global Connectivity",
      desc: "CDN-first deployment for global audiences.",
      icon: <GlobeIcon size={18} />,
      href: "#services"
    },
    {
      title: "SEO Optimization",
      desc: "SEO Optimized for search engines.",
      icon: <BrainCircuit size={18} />,
      href: "#services"
    },
    {
      title: "AI Engine Optimization / GEO",
      desc: "AI Engine Optimization for search engines.",
      icon: <ScanSearch size={18} />,
      href: "#services"
    },
  ];

  const navLinks = [
    { name: "Home", href: "#home", id: "home" },
    { name: "Projects", href: "#projects", id: "projects" },
    { name: "Services", href: "#services", id: "services" },
    { name: "Contact", href: "/contact", id: "contact" },
    { name: "About", href: "/about", id: "about" },
  ];

  const handleLinkClick = (e, href) => {
    e.preventDefault();
    setIsOpen(false);
    setIsDesktopServicesOpen(false);

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
      {/* Mobile-First Header */}
      <header className="fixed top-0 w-full z-50 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <a href="#home" onClick={(e) => handleLinkClick(e, '#home')} aria-label="SaPyBase Home" className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
              <Logo className="w-24 sm:w-auto h-10 sm:h-12 object-contain" />
            </a>
          </div>
          {/* Desktop Links (Hidden by default, shown on md+) */}
          <div className="hidden md:flex lg:ml-28 items-center gap-10">
            {navLinks.map((link) => (
              <div key={`nav-desk-${link.id || link.name}`} className="relative group" ref={link.name === "Services" ? dropdownRef : null}>
                {link.name === "Services" ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setIsDesktopServicesOpen(!isDesktopServicesOpen);
                      }}
                      onMouseEnter={() => setIsDesktopServicesOpen(true)}
                      className={`flex items-center gap-1 text-slate-600 dark:text-slate-300 transition-colors font-questrial py-3 cursor-pointer ${isDesktopServicesOpen ? 'text-slate-900 dark:text-white' : ''} group-hover:text-slate-900 dark:group-hover:text-white`}
                    >
                      {link.name}
                      <ChevronDown size={14} className={`${isDesktopServicesOpen ? 'rotate-180' : ''} group-hover:rotate-180 transition-transform duration-300`} />
                    </button>

                    {/* Desktop Dropdown */}
                    <div
                      className={`absolute top-full left-1/2 -translate-x-1/2 pt-4 transition-all duration-300 ease-out z-70 
                      ${isDesktopServicesOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}
                      onMouseEnter={() => setIsDesktopServicesOpen(true)}
                      onMouseLeave={() => setIsDesktopServicesOpen(false)}
                    >
                      <div className="w-[640px] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 grid grid-cols-2 gap-4">
                        {services.map((service, idx) => (
                          <a
                            key={`service-desk-${idx}-${service.title}`}
                            href={service.href}
                            onClick={(e) => handleLinkClick(e, service.href)}
                            className="group/item p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 group-hover/item:scale-110 transition-transform">
                                {service.icon}
                              </div>
                              <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{service.title}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pl-1">
                              {service.desc}
                            </p>
                          </a>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <a
                    href={link.href}
                    onClick={(e) => handleLinkClick(e, link.href)}
                    className="relative text-slate-600 dark:text-slate-300 transition-colors font-questrial py-3 group-hover:text-slate-900 dark:group-hover:text-white"
                  >
                    {link.name}
                    <span className="absolute bottom-0 left-0 w-full h-[1.5px] bg-indigo-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-in-out origin-left" />
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Auth Section */}
          <div className="hidden md:flex items-center gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors px-4 py-2">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-95 flex items-center gap-2">
                  <UserPlus size={16} />
                  Get Started
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <div className="flex items-center gap-4">
                <Link
                  to="/dashboard"
                  className="text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "w-10 h-10 rounded-xl border-2 border-slate-200 dark:border-slate-800"
                    }
                  }}
                />
              </div>
            </SignedIn>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <SignedIn>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-9 h-9 sm:w-10 sm:h-10 rounded-xl"
                  }
                }}
              />
            </SignedIn>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-200 active:scale-95 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center border border-transparent dark:border-slate-800"
              aria-label="Toggle Menu"
            >
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-40 bg-white dark:bg-[#020617] transition-transform duration-500 ease-in-out md:hidden overflow-hidden ${isOpen ? "translate-y-0" : "-translate-y-full"
          }`}
      >
        <div className="flex flex-col h-full pt-20 px-4 sm:px-6 pb-8 overflow-y-auto overflow-x-hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((link, index) => (
              <div key={`nav-mob-${link.id || link.name}-${index}`} className="space-y-1">
                {link.name === "Services" ? (
                  <>
                    <button
                      onClick={() => setIsMobileServicesOpen(!isMobileServicesOpen)}
                      className={`w-full flex items-center justify-between text-xl font-bold text-slate-700 dark:text-slate-200 transition-all duration-300 py-3 ${isOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"
                        }`}
                      style={{ transitionDelay: `${index * 100}ms` }}
                    >
                      {link.name}
                      <ChevronDown size={24} className={`text-slate-400 dark:text-slate-400 transition-transform duration-300 ${isMobileServicesOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {/* Mobile Services Accordion - Simplified and Professional */}
                    <div className={`grid gap-2 overflow-hidden transition-all duration-500 ease-in-out ${isMobileServicesOpen ? 'max-h-[800px] opacity-100 mt-2 mb-4' : 'max-h-0 opacity-0'}`}>
                      {services.map((service, sIndex) => (
                        <a
                          key={`service-mob-${sIndex}-${service.title}`}
                          href={service.href}
                          onClick={(e) => {
                            handleLinkClick(e, service.href);
                            setIsMobileServicesOpen(false);
                          }}
                          className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
                        >
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm shrink-0">
                            {React.cloneElement(service.icon, { size: 16 })}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200 leading-none mb-1">{service.title}</h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{service.desc}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </>
                ) : (
                  <a
                    href={link.href}
                    onClick={(e) => handleLinkClick(e, link.href)}
                    className={`flex items-center justify-between text-xl font-bold text-slate-700 dark:text-slate-200 transition-all duration-300 py-3 ${isOpen
                      ? "opacity-100 translate-x-0"
                      : "opacity-0 -translate-x-10"
                      }`}
                    style={{ transitionDelay: `${index * 100}ms` }}
                  >
                    {link.name}
                    <ArrowRight className="text-slate-400 dark:text-slate-400 w-6 h-6" href={link.href}
                      onClick={(e) => handleLinkClick(e, link.href)} />
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-900 flex flex-col gap-6">
            <SignedOut>
              <div className="grid grid-cols-2 gap-3">
                <SignInButton mode="modal">
                  <button className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white font-bold transition-all active:scale-95 text-sm sm:text-base border border-transparent dark:border-slate-800">
                    <LogIn size={18} />
                    Login
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-600 text-white font-bold transition-all active:scale-95 text-sm sm:text-base shadow-lg shadow-indigo-600/20">
                    <UserPlus size={18} />
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
            </SignedOut>

            <button
              onClick={() => {
                navigate('/register');
                setIsOpen(false);
              }}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 sm:py-5 rounded-xl text-base sm:text-lg font-bold hover:bg-slate-800 dark:hover:bg-slate-50 transition-all active:scale-95 shadow-xl shadow-slate-900/10 dark:shadow-none"
            >
              Start Free Trial
            </button>
            <div className="mt-8 flex gap-8 text-slate-500 text-sm items-center justify-center">
              <a href="https://www.linkedin.com/in/ayushsatvara/" className="p-2 cursor-pointer hover:text-indigo-600 transition-colors">LinkedIn</a>
              <a href="https://github.com/ayushsatvara1012" className="p-2 cursor-pointer hover:text-indigo-600 transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
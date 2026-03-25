import React, { useState, useEffect } from "react";
import { Menu, X, ArrowRight, ChevronDown, BrainCircuit, Code2, CloudCog, Globe as GlobeIcon, Bot, ScanSearch, LayoutDashboard, Key, ShieldCheck, LogIn, UserPlus } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth, UserButton, SignInButton, SignUpButton, SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import Logo from "./Logo";


const Navbar = () => {
  const { getToken, isLoaded: isAuthLoaded } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileServicesOpen, setIsMobileServicesOpen] = useState(false);
  const [userRole, setUserRole] = useState('USER');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!isAuthLoaded) return;
      try {
        const token = await getToken();
        const baseUrl = import.meta.env.VITE_API_URL
          ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}`
          : '';
        
        const response = await fetch(`${baseUrl}/api/company/details`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.role) {
          setUserRole(data.role);
        }
      } catch (err) {
        console.error("Navbar role fetch error:", err);
      }
    };
    fetchUserRole();
  }, [isAuthLoaded, getToken]);

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
    {
      title: "Register Company",
      desc: "Get your API key and join SaPyBase.",
      icon: <Key size={18} />,
      href: "/register"
    },
    {
      title: "Client Dashboard",
      desc: "Train your AI and manage knowledge.",
      icon: <LayoutDashboard size={18} />,
      href: "/dashboard"
    },
    ...(userRole === 'ADMIN' && user?.primaryEmailAddress?.emailAddress === import.meta.env.VITE_ADMIN_EMAIL ? [{
      title: "Super Admin Panel",
      desc: "Manage platform users and companies.",
      icon: <ShieldCheck size={18} className="text-orange-500" />,
      href: "/admin"
    }] : [])
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
      <header className="fixed top-0 w-full z-60 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a href="#home" onClick={(e) => handleLinkClick(e, '#home')} aria-label="SaPyBase Home" className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
              <Logo className="w-auto h-16 md:h-20 md:mb-4 object-cover" />
            </a>
          </div>
          {/* Desktop Links (Hidden by default, shown on md+) */}
          <div className="hidden md:flex items-center gap-16 mr-10">
            {navLinks.map((link) => (
              <div key={`nav-desk-${link.id || link.name}`} className="relative group">
                {link.name === "Services" ? (
                  <>
                    <button
                      onClick={(e) => handleLinkClick(e, link.href)}
                      className="flex items-center gap-1 text-slate-600 dark:text-slate-300 transition-colors font-questrial py-3 cursor-pointer group-hover:text-slate-900 dark:group-hover:text-white"
                    >
                      {link.name}
                      <ChevronDown size={14} className="group-hover:rotate-180 transition-transform duration-300" />
                    </button>

                    {/* Desktop Dropdown */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300 ease-out z-70">
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

          {/* Mobile Toggle - Visible on small screens */}
          <div className="flex items-center gap-3 md:hidden">
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-200 active:scale-95 transition-all min-w-[48px] min-h-[48px] flex items-center justify-center"
              aria-label="Toggle Menu"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Full-Screen Overlay (Tree of Thought: Mobile UX) */}
      <div
        className={`fixed inset-0 z-55 bg-white dark:bg-slate-950 transition-transform duration-500 ease-in-out md:hidden ${isOpen ? "translate-y-0" : "-translate-y-full"
          }`}
      >
        <div className="flex flex-col h-full pt-24 px-8 pb-10 overflow-y-auto">
          <div className="space-y-4">
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

          <div className="mt-auto pt-8 border-t border-slate-100 dark:border-slate-900">
            <SignedOut>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <SignInButton mode="modal">
                  <button className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white font-bold transition-all active:scale-95">
                    <LogIn size={20} />
                    Login
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-indigo-600 text-white font-bold transition-all active:scale-95 shadow-lg shadow-indigo-200 dark:shadow-none">
                    <UserPlus size={20} />
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
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-2xl text-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-50 transition-all active:scale-95 shadow-xl shadow-slate-200/50 dark:shadow-none"
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
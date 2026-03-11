import React, { useState, useEffect } from "react";
import { Menu, X, ArrowRight, Terminal, ChevronDown, BrainCircuit, Code2, CloudCog, Globe as GlobeIcon, Bot, ScanSearch } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileServicesOpen, setIsMobileServicesOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

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
    }
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
          {/* Logo - Always visible */}
          <div className="flex items-center gap-2">
            <div className="bg-white dark:bg-slate-900/70 dark:border-slate-800 p-2 rounded-xl border border-slate-200">
              <Terminal className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-smokewhite dark:text-white font-glook">
              Sa
              <span className="font-glook">Py</span>
              <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-violet-500 font-glook tracking-wide ">Base</span>
            </span>
          </div>

          {/* Desktop Links (Hidden by default, shown on md+) */}
          <div className="hidden md:flex items-center gap-16 mr-10">
            {navLinks.map((link) => (
              <div key={link.name} className="relative group">
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
                            key={idx}
                            href={service.href}
                            onClick={(e) => handleLinkClick(e, service.href)}
                            className="group/item p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 group-hover/item:scale-110 transition-transform">
                                {service.icon}
                              </div>
                              <span className="font-bold text-sm text-slate-800 dark:text-white">{service.title}</span>
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

          {/* Mobile Toggle - Visible on small screens */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white active:scale-95 transition-all min-w-[48px] min-h-[48px] flex items-center justify-center"
            aria-label="Toggle Menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
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
              <div key={link.name} className="space-y-1">
                {link.name === "Services" ? (
                  <>
                    <button
                      onClick={() => setIsMobileServicesOpen(!isMobileServicesOpen)}
                      className={`w-full flex items-center justify-between text-xl font-bold text-slate-700 dark:text-white transition-all duration-300 py-3 ${isOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"
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
                          key={sIndex}
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
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-none mb-1">{service.title}</h4>
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
                    className={`flex items-center justify-between text-xl font-bold text-slate-700 dark:text-white transition-all duration-300 py-3 ${isOpen
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

          <div className="mt-auto pt-5">
            <button 
              onClick={() => {
                navigate('/services');
                setIsOpen(false);
              }}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-2xl text-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-50 transition-all active:scale-95 shadow-xl shadow-slate-200/50 dark:shadow-none"
            >
              Let's Build Something
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
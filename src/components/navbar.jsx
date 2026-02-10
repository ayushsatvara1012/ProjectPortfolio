import React, { useState, useEffect } from "react";
import { Menu, X, ArrowRight, Terminal } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isOpen]);

  const navLinks = [
    { name: "Home", href: "#home", id: "home" },
    { name: "Projects", href: "#projects", id: "projects" },
    { name: "Services", href: "#services", id: "services" },
    { name: "Contact", href: "/contact", id: "contact" },
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
      <nav className="fixed top-0 w-full z-60 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="px-5 h-16 flex items-center justify-between">
          {/* Logo - Always visible */}
          <div className="flex items-center gap-2">
            <div className="bg-white p-2 rounded-xl border border-slate-200">
              <Terminal className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-smokewhite dark:text-white font-glook antialiased">
              Sa
              <span className="font-glook antialiased">Py</span>
              <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-violet-500 font-glook tracking-wide antialiased">Base</span>
            </span>
          </div>

          {/* Desktop Links (Hidden by default, shown on md+) */}
          <div className="hidden md:flex items-center gap-16 mr-10">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => handleLinkClick(e, link.href)}
                className="relative group text-slate-600 dark:text-slate-300 transition-colors font-questrial antialiased py-1"
              >
                {/* The Text */}
                <span className="group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                  {link.name}
                </span>

                {/* The Animated Underline */}
                <span className="absolute bottom-0 left-0 w-full h-[1.5px] bg-indigo-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-in-out origin-left" />
              </a>
            ))}
          </div>

          {/* Mobile Toggle - Visible on small screens */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white active:scale-95 transition-all"
            aria-label="Toggle Menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Full-Screen Overlay (Tree of Thought: Mobile UX) */}
      <div
        className={`fixed inset-0 z-55 bg-white dark:bg-slate-950 transition-transform duration-500 ease-in-out md:hidden ${
          isOpen ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="flex flex-col h-full pt-24 px-8 pb-10">
          <div className="space-y-6">
            {navLinks.map((link, index) => (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => handleLinkClick(e, link.href)}
                className={`flex items-center justify-between text-xl font-bold text-slate-700 dark:text-white transition-all duration-300 ${
                  isOpen
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-10"
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                {link.name}
                <ArrowRight className="text-indigo-600 w-8 h-8" />
              </a>
            ))}
          </div>

          <div className="mt-auto">
            <button className="w-full bg-indigo-600 text-white py-5 rounded-2xl text-xl font-bold">
              Let's Build Something
            </button>
            <div className="mt-8 flex gap-6 text-slate-500 text-sm items-center justify-center">
              <span>Our Stack</span>
              <span>LinkedIn</span>
              <span>GitHub</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
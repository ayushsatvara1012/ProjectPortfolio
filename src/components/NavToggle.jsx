import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Key, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserRole } from '../context/UserContext';

const NavToggle = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { userRole, isLoading } = useUserRole();

    // Only show on specific platform pages
    const showOnPaths = ['/app', '/app/register', '/app/settings/admin'];
    const shouldShow = showOnPaths.includes(location.pathname);

    if (!shouldShow) return null;

    const navItems = [
        { name: 'Dashboard', path: '/app', icon: LayoutDashboard },
        { name: 'Register', path: '/app/register', icon: Key },
        ...(userRole === 'SUPER_ADMIN' ? [{ name: 'Platform', path: '/app/settings/admin', icon: ShieldCheck }] : [])
    ];

    return (
        <div className="fixed top-17 left-4 right-4 z-40 w-fit mx-auto">
            <div className="flex items-center justify-center gap-1 sm:gap-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-1 rounded-full border border-slate-200/50 dark:border-slate-800/50 shadow-lg shadow-slate-200/20 dark:shadow-none">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`relative flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-full text-[10px] sm:text-[12px] font-bold uppercase tracking-widest transition-all duration-300 min-h-[34px] sm:min-h-[38px] flex-1 sm:flex-none ${
                                isActive 
                                ? 'text-blue-700 dark:text-white' 
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                            }`}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="nav-pill"
                                    className="absolute inset-0 bg-slate-100 dark:bg-indigo-600 rounded-full z-0"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <item.icon className="relative z-10 w-4 h-4 sm:w-3.5 sm:h-3.5" />
                            <span className="relative z-10 hidden sm:inline">{item.name}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default NavToggle;

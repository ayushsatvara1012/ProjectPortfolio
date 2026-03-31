import { Outlet, ScrollRestoration } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import Navbar from "./components/navbar";
import Footer from "./components/footer";
import ChatWidget from './components/chatWidget';
import NavToggle from './components/NavToggle';
import useInactivityTimeout from './hooks/useInactivityTimeout';
import { useState, useEffect } from "react";
import UpgradePrompt from './components/UpgradePrompt';

function App() {
  // Automatically logout user after 30 minutes of inactivity
  useInactivityTimeout(30);

  const [globalUpgradeError, setGlobalUpgradeError] = useState(null);

  useEffect(() => {
    const handler = (e) => setGlobalUpgradeError(e.detail);
    window.addEventListener('sapybase:upgrade-required', handler);
    return () => window.removeEventListener('sapybase:upgrade-required', handler);
  }, []);

  return (
    <div className="flex flex-col">
      <ScrollRestoration getKey={(location) => {
          // Standard: Each history entry has its own unique scroll position
          // This is the default behavior if you don't provide getKey
          return location.key;}}/>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-999 focus:px-6 focus:py-3 focus:bg-indigo-600 focus:text-white focus:rounded-xl focus:font-bold focus:shadow-2xl transition-all">
        Skip to content
      </a>
      <Navbar />
      <NavToggle />
      <main id="main-content">
        <Outlet />
      </main>
      <Footer />
      <Analytics />
      <ChatWidget apiKey={import.meta.env.VITE_SAPYBASE_API_KEY}/>
      {globalUpgradeError && (
        <UpgradePrompt
          mode="modal"
          code={globalUpgradeError.code}
          tier={globalUpgradeError.tier}
          current={globalUpgradeError.current}
          limit={globalUpgradeError.limit}
          onDismiss={() => setGlobalUpgradeError(null)}
        />
      )}
    </div>
  );
}

export default App;

import { Outlet,ScrollRestoration } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import Navbar from "./components/navbar";
import Footer from "./components/footer";

function App() {
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
      <main id="main-content">
        <Outlet />
      </main>
      <Footer />
      <Analytics />
    </div>
  );
}

export default App;

import Navbar from '../components/Navbar';
import NavToggle from '../components/NavToggle';
import Footer from '../components/Footer';
import SmoothScroll from '../smooth-scroll';
import ClientEffects from '../client-effects';
import FloatingBotWidget from '../components/FloatingBotWidget';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-999 focus:px-6 focus:py-3 focus:bg-indigo-600 focus:text-white focus:rounded-xl focus:font-bold focus:shadow-2xl transition-all"
      >
        Skip to content
      </a>
      <Navbar />
      <NavToggle />
      <main id="main-content">{children}</main>
      <Footer />
      <SmoothScroll />
      <ClientEffects />
      <FloatingBotWidget />
    </div>
  );
}

import Navbar from '@/src/app/components/Navbar';
import Footer from '@/src/app/components/Footer';
import ClientEffects from '@/src/app/client-effects';
import FloatingBotWidget from '@/src/app/components/FloatingBotWidget';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-col min-h-screen overflow-x-clip">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-999 focus:px-6 focus:py-3 focus:bg-indigo-600 focus:text-white focus:rounded-xl focus:font-bold focus:shadow-2xl transition-all"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main-content">{children}</main>
      <Footer />
      <ClientEffects />
      <FloatingBotWidget />
    </div>
  );
}

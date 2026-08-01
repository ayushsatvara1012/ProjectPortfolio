import Link from 'next/link';
import SapybaseWordmark from './SapybaseWordmark';

type FooterLink = { name: string; href: string; external?: boolean };
type FooterColumn = { heading: string; links: FooterLink[] };

const footerColumns: FooterColumn[] = [
  {
    heading: 'Product',
    links: [
      { name: 'Vaayu', href: '/vaayu' },
      { name: 'Pricing', href: '/pricing' },
      { name: 'Explore', href: '/explore' },
      { name: 'Try Demo', href: '/demo/train' },
    ],
  },
  {
    heading: 'Solutions',
    links: [
      { name: 'Custom AI Chatbot', href: '/services' },
      { name: 'RAG Pipeline Architecture', href: '/services' },
      { name: 'AI Integration & LLM Consulting', href: '/services' },
      { name: 'Cloud Infrastructure', href: '/services' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { name: 'Docs', href: '/docs' },
      { name: 'Blog', href: '/blog' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { name: 'About', href: '/about' },
      { name: 'Contact', href: '/contact' },
      { name: 'Privacy Policy', href: '/privacy-policy' },
      { name: 'Terms and Conditions', href: '/terms-and-conditions' },
    ],
  },
  {
    heading: 'Connect',
    links: [
      { name: 'ayushsatvara1012', href: 'https://github.com/ayushsatvara1012', external: true },
      { name: 'LinkedIn', href: 'https://www.linkedin.com/in/ayushsatvara', external: true },
      { name: 'ayush@sapybase.com', href: 'mailto:ayush@sapybase.com' },
      { name: '+1 562 668 1855', href: 'tel:+15626681855' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#FAFAFC] dark:bg-[#0B0F19]">
      <div className="max-w-8xl mx-auto px-6 min-[1011px]:px-12 pt-16 pb-10 min-[1011px]:pt-20">
        {/* Plain link directory: bold heading, stacked plain links — no icons,
            no borders, no CTAs. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 min-[1011px]:grid-cols-5 gap-x-8 gap-y-12">
          {footerColumns.map((column) => (
            <div key={column.heading} className="space-y-5">
              <h3 className="text-sm font-google font-semibold text-slate-900 dark:text-slate-100">
                {column.heading}
              </h3>
              <ul className="space-y-3">
                {column.links.map((link) => {
                  const linkClassName = 'text-sm font-google text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors';
                  return (
                    <li key={link.name}>
                      {link.href.startsWith('/') ? (
                        <Link href={link.href} className={linkClassName}>
                          {link.name}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                          className={linkClassName}
                        >
                          {link.name}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar — just copyright now; status and the launch badge were
            dropped, social lives in the Connect column above. */}
        <div className="mt-16 min-[1011px]:mt-20 text-sm font-google text-slate-500 dark:text-slate-400 text-center min-[1011px]:text-left">
          <p>© 2026 Sapybase LLC</p>
        </div>
      </div>

      {/* Giant brand wordmark, reserved in normal flow instead of overlaid —
          this box adds real height to the footer, so the mark sits below the
          content instead of behind it. The box's own height is exactly 80%
          of the SVG's natural height (from its 55:11 viewBox), so the SVG's
          bottom 20% overflows past the box and is clipped by its own
          overflow-hidden. The mask fades that same last stretch (60%→80% of
          the SVG's height) to transparent, so it fades out right as it
          reaches the clip line instead of ending on a hard edge. */}
      <div
        aria-hidden
        className="pointer-events-none select-none relative mt-2 w-full overflow-hidden"
        style={{ aspectRatio: '25 / 4' }}
      >
        <div
          className="absolute inset-x-0 top-0 flex justify-center"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 80%)',
            maskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 80%)',
          }}
        >
          <SapybaseWordmark className="w-[95vw] max-w-[1800px] text-slate-900/[0.08] dark:text-white/[0.08]" />
        </div>
      </div>
    </footer>
  );
}

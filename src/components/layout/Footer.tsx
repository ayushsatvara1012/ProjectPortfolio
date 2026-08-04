import Link from 'next/link';

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
        {/* Plain link directory: bold heading, stacked plain links in a 3x2 grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-12">
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

          {/* Copyright text position inline with Row 2 (beside Connect) */}
          <div className="flex items-start lg:items-center min-[1011px]:pt-6">
            <p className="text-sm font-google text-slate-500 dark:text-slate-400">
              © 2026 Sapybase LLC | All rights reserved
            </p>
          </div>
        </div>
      </div>

      {/* Footer SVG - responsive, edge-to-edge with no padding */}
      <div
        aria-hidden
        className="pointer-events-none select-none relative w-full overflow-hidden flex flex-col justify-end items-center"
      >
        {/* Wordmark SVG (black container split background is natively embedded inside the SVG) */}
        <div className="relative z-10 w-full grid">
          <img
            src="/footer.svg"
            alt="Sapybase Footer"
            className="w-full h-auto translate-y-20"
          />
         
        </div>
      </div>
    </footer>
  );
}


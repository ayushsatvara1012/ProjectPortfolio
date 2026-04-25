
import type { Metadata, Viewport } from 'next';
import {
  Bricolage_Grotesque,
  Darker_Grotesque,
} from 'next/font/google';
import './globals.css';
import Providers from './providers';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

const darker = Darker_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Sapybase | Autonomous AI Chatbots for Modern Business',
  description:
    'Automate your customer support and sales with Sapybase AI agents. Connect your documents and databases to deploy custom AI chatbots in minutes. Built for modern businesses seeking intelligent automation.',
  authors: [{ name: 'Sapybase Engineering' }],
  robots: 'index, follow',
  metadataBase: new URL('https://www.sapybase.com'),
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: 'https://www.sapybase.com',
    title: 'Sapybase | Autonomous AI Chatbots for Modern Business',
    description:
      'Automate your customer support and sales with Sapybase AI agents. Connect your documents and databases to deploy custom AI chatbots in minutes.',
    images: ['https://www.sapybase.com/SB_Brand-removebg.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/SB_Brand-removebg.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/favicon_180.svg', sizes: '180x180' }],
  },
  verification: {
    google: 'S8as-_oCchRHJndxzd8KPrTXfEfjWoL2U6Rpanr5HIA',
  },
};

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${bricolage.variable} ${darker.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,200,0..1,-50..200"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

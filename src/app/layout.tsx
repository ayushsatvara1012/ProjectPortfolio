import type { Metadata, Viewport } from 'next';
import {
  Bricolage_Grotesque,
  Darker_Grotesque,
} from 'next/font/google';
import './globals.css';

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

// A fallback minimal metadata in case a route misses it.
export const metadata: Metadata = {
  title: 'Sapybase',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/SB_Brand-removebg.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/favicon_180.svg', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
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
        {children}
      </body>
    </html>
  );
}

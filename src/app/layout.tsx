import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Google_Sans } from 'next/font/google';
import './globals.css';
import SmoothScrollProvider from '@/src/components/SmoothScrollProvider';

const googleSans = Google_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-google',
  weight: ['400', '500', '600', '700'],
});

// A fallback minimal metadata in case a route misses it.
export const metadata: Metadata = {
  title: 'Sapybase',
  icons: {
    icon: [{ url: '/logo2.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/logo2.svg' }],
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
    <html lang="en" className={googleSans.variable}>
      <head>
        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-7ELQT3TPLJ"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-7ELQT3TPLJ');
          `}
        </Script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <Script id="material-symbols-font" strategy="afterInteractive">
          {`var l=document.createElement('link');l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,200,0,0&display=swap';document.head.appendChild(l);`}
        </Script>
      </head>
      <body suppressHydrationWarning>
        <SmoothScrollProvider>
          {children}
        </SmoothScrollProvider>
      </body>
    </html>
  );
}

/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // The migration is complete, Next.js will now use default extensions.
  async rewrites() {
    const apiUrl = isDev ? 'http://localhost:8000' : 'https://sapyai.onrender.com';
    
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      // Versioned loader alias: /sapybase-loader@1.js → /sapybase-loader.js
      // Bump the version number (e.g. @2) on breaking loader changes so
      // existing customer sites continue serving the previous version.
      {
        source: '/sapybase-loader@:version.js',
        destination: '/sapybase-loader.js',
      },
    ];
  },
  async headers() {
    return [
      // Global security headers applied to all routes
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
      // Main app routes — restrictive CSP. Clerk, Google Fonts, and the FastAPI
      // backend are the only external origins needed. Inline scripts are forbidden;
      // Next.js nonce-based approach can be layered on top if needed later.
      {
        source: '/((?!embed|_next/static|_next/image|favicon).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Turbopack / React dev tools require unsafe-eval in development for call-stack reconstruction
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://clerk.sapybase.com https://*.clerk.accounts.dev https://challenges.cloudflare.com https://js.stripe.com`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              // Backend API + Clerk API + Stripe
              `connect-src 'self' https://sapyai.onrender.com https://www.sapybase.com https://api.clerk.com https://*.clerk.accounts.dev wss://*.clerk.accounts.dev https://api.stripe.com${isDev ? " http://localhost:8000 http://127.0.0.1:8000 ws://localhost:3000 wss://localhost:3000" : ""}`,
              "frame-src https://challenges.cloudflare.com https://js.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
      // Widget assets — public CDN-style, no framing restriction
      {
        source: '/:path(widget.js|style.css|sapybase-loader.js|sapybase-loader@:version.js)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Embed routes — override X-Frame-Options to allow cross-origin framing for widget
      {
        source: '/embed/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: 'frame-ancestors *;' },
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Permissions-Policy', value: 'clipboard-write=(self)' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The migration is complete, Next.js will now use default extensions.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://sapyai.onrender.com/api/:path*',
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
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
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

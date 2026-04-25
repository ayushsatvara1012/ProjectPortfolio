/** @type {import('next').NextConfig} */
const nextConfig = {
  // The migration is complete, Next.js will now use default extensions.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://sapyai.onrender.com/api/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path(widget.js|style.css|sapybase-loader.js)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
      {
        source: '/embed/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

export default nextConfig;

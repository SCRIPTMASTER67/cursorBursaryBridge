import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * pdfjs-dist is loaded by Node, not bundled. It resolves its worker through a
   * dynamic import at runtime, and a bundler rewrites that path to one that
   * does not exist, so reading a PDF on the server fails with "Setting up fake
   * worker failed". Leaving it external lets Node resolve it normally.
   */
  serverExternalPackages: ['pdfjs-dist'],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  devIndicators: false,
  serverExternalPackages: ['pg'],
  async rewrites() {
    return { beforeFiles: [{ source: '/auth/:path*', destination: '/api/auth/:path*' }] };
  },
};

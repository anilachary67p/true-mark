/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@truemark/shared'],
};

module.exports = nextConfig;

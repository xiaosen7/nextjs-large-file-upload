/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: process.env.BASE_PATH,
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-ignore - Valid Next.js config but types might be strict locally
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

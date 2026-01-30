import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-expect-error - Valid Next.js config but types might be strict
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

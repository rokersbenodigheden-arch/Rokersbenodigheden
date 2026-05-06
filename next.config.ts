import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.uegholland.com" },
      { protocol: "https", hostname: "uegholland.com" },
    ],
  },
};

export default nextConfig;

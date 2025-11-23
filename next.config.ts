import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    API_SECRET_TOKEN: process.env.API_SECRET_TOKEN,
    NEXT_PUBLIC_GOOGLE_ANALYTICS_ID:
      process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID,
  },
  images: {
    remotePatterns: [
      {
        hostname: "localhost",
        protocol: "http",
        port: "3000",
      },
      {
        hostname: "anicards.alpha49.com",
        protocol: "https",
      },
    ],
    qualities: [100, 75],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    API_SECRET_TOKEN: process.env.API_SECRET_TOKEN,
  },
  images: {
    remotePatterns: [
      {
        hostname: "localhost",
        protocol: "http",
        port: "3000",
      },
    ],
  },
};

export default nextConfig;

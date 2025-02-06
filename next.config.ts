import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    MONGODB_URI: process.env.MONGODB_URI,
    API_SECRET_TOKEN: process.env.API_SECRET_TOKEN
  }
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '127.0.0.1:3000',
        'mscsrmap.edu.in',
        '*.mscsrmap.edu.in',
        'msc-srmap.web.app',
        '*.msc-srmap.web.app',
      ],
    },
  },
};

export default nextConfig;

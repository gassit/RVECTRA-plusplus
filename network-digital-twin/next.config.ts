import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: [
    '@antv/g6',
    '@prisma/client',
    '@prisma/adapter-libsql',
    '@libsql/client',
  ],
};

export default nextConfig;

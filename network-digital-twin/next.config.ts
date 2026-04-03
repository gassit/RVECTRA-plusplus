import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: [
    'preview-chat-f9c4d025-568c-4d3d-bdae-f424f2b34359.space.z.ai',
  ],
};

export default nextConfig;

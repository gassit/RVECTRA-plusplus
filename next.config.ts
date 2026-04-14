import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'preview-chat-f9c4d025-568c-4d3d-bdae-f424f2b34359.space.z.ai',
    '.space.z.ai',
  ],
  // Пустая конфигурация turbopack для отключения ошибки webpack
  turbopack: {},
  serverExternalPackages: ['@antv/g6'],
};

export default nextConfig;

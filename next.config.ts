import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {},
  allowedDevOrigins: [
    'preview-chat-f9c4d025-568c-4d3d-bdae-f424f2b34359.space.z.ai',
    '.space.z.ai',
    '.space.chatglm.site',
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        'preview-chat-f9c4d025-568c-4d3d-bdae-f424f2b34359.space.z.ai',
        '*.space.z.ai',
        '*.space.chatglm.site',
      ],
    },
  },
  webpack: (config, { isServer }) => {
    // Настройка для Web Workers (AntV G6 layout)
    if (!isServer) {
      config.module.rules.push({
        test: /worker\.js$/,
        type: 'asset/resource',
        generator: {
          filename: 'static/chunks/[name].[hash][ext]',
        },
      });
    }
    return config;
  },
};

export default nextConfig;

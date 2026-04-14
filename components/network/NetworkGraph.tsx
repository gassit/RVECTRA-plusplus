'use client';

import dynamic from 'next/dynamic';

interface NetworkData {
  elements: Array<{
    id: string;
    elementId: string;
    name: string;
    type: string;
    posX?: number | null;
    posY?: number | null;
  }>;
  connections: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    source?: { elementId: string; name: string; type: string };
    target?: { elementId: string; name: string; type: string };
  }>;
}

interface NetworkGraphProps {
  data: NetworkData | null;
  onNodeClick?: (nodeId: string) => void;
}

// Динамический импорт G6 с отключением SSR
const NetworkGraphInner = dynamic(
  () => import('./NetworkGraphInner').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <span className="text-gray-500">Загрузка графа...</span>
        </div>
      </div>
    ),
  }
);

export default function NetworkGraph({ data, onNodeClick }: NetworkGraphProps) {
  return <NetworkGraphInner data={data} onNodeClick={onNodeClick} />;
}

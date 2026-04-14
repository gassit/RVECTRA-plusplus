'use client';

import { useEffect, useState } from 'react';

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

interface GraphComponentProps {
  data: NetworkData | null;
  onNodeClick?: (nodeId: string) => void;
}

export default function NetworkGraph({ data, onNodeClick }: NetworkGraphProps) {
  const [GraphComponent, setGraphComponent] = useState<React.ComponentType<GraphComponentProps> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Динамический импорт G6 только на клиенте
    import('./NetworkGraphInner')
      .then((mod) => {
        setGraphComponent(() => mod.default);
      })
      .catch((err) => {
        console.error('Failed to load G6:', err);
        setError('Не удалось загрузить библиотеку визуализации');
      });
  }, []);

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">⚠️ Ошибка загрузки</div>
          <div className="text-gray-500 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  if (!GraphComponent) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <span className="text-gray-500">Загрузка графа...</span>
        </div>
      </div>
    );
  }

  return <GraphComponent data={data} onNodeClick={onNodeClick} />;
}

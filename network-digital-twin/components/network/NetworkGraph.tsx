'use client';

import { useEffect, useState, useMemo } from 'react';

interface NetworkData {
  elements: Array<{
    id: string;
    elementId: string;
    name: string;
    type: string;
  }>;
  connections: Array<{
    id: string;
    sourceId: string;
    targetId: string;
  }>;
}

interface NetworkGraphProps {
  data: NetworkData | null;
  onNodeClick?: (nodeId: string) => void;
}

const COLORS: Record<string, { bg: string; border: string; text: string }> = {
  source: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-500', text: 'text-yellow-800 dark:text-yellow-200' },
  breaker: { bg: 'bg-gray-100 dark:bg-gray-700', border: 'border-gray-500', text: 'text-gray-800 dark:text-gray-200' },
  load: { bg: 'bg-gray-800 dark:bg-gray-600', border: 'border-gray-400', text: 'text-white' },
  meter: { bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-500', text: 'text-blue-800 dark:text-blue-200' },
  bus: { bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-600', text: 'text-amber-800 dark:text-amber-200' },
  junction: { bg: 'bg-gray-200 dark:bg-gray-600', border: 'border-gray-400', text: 'text-gray-700 dark:text-gray-200' },
  cabinet: { bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-500', text: 'text-purple-800 dark:text-purple-200' },
};

export default function NetworkGraph({ data, onNodeClick }: NetworkGraphProps) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const elements = useMemo(() => {
    if (!data?.elements) return [];
    return data.elements.slice(0, 100);
  }, [data]);

  if (!data?.elements?.length) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <span className="text-gray-500">Загрузка...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 bg-gray-100 dark:bg-gray-900">
      <div className="mb-4 text-sm text-gray-500">
        {data.elements.length} элементов | {data.connections.length} связей
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {elements.map(el => {
          const c = COLORS[el.type] || COLORS.junction;
          return (
            <div
              key={el.id}
              onClick={() => onNodeClick?.(el.id)}
              className={`p-2 rounded border-2 ${c.bg} ${c.border} ${c.text} cursor-pointer hover:opacity-80 text-xs`}
              title={el.name}
            >
              <div className="font-medium truncate">{el.name || el.elementId}</div>
              <div className="text-xs opacity-70">{el.type}</div>
            </div>
          );
        })}
      </div>
      {data.elements.length > 100 && (
        <div className="mt-4 text-center text-sm text-gray-400">
          Показано 100 из {data.elements.length} элементов
        </div>
      )}
    </div>
  );
}

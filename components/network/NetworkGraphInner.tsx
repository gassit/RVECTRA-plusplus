'use client';

interface NetworkData {
  elements: Array<{ id: string; elementId: string; name: string; type: string; posX?: number | null; posY?: number | null }>;
  connections: Array<{ id: string; sourceId: string; targetId: string }>;
}

interface Props {
  data: NetworkData | null;
  onNodeClick?: (id: string) => void;
}

export default function NetworkGraphInner({ data, onNodeClick }: Props) {
  if (!data?.elements?.length) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-4xl mb-4">📊</div>
          <div className="text-lg">Нет данных</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto p-4 bg-gray-50 dark:bg-gray-900">
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {data.elements.length} элементов, {data.connections.length} связей
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {data.elements.map((el) => (
          <div
            key={el.id}
            onClick={() => onNodeClick?.(el.id)}
            className="p-2 rounded-lg border text-xs cursor-pointer hover:shadow-md transition-shadow"
            style={{
              borderColor: el.type === 'source' ? '#f59e0b' :
                          el.type === 'breaker' ? '#1f2937' :
                          el.type === 'load' ? '#374151' :
                          el.type === 'meter' ? '#3b82f6' :
                          el.type === 'bus' ? '#d97706' : '#6b7280',
              backgroundColor: el.type === 'load' ? '#374151' :
                              el.type === 'breaker' ? '#fff' :
                              el.type === 'source' ? '#fef3c7' :
                              el.type === 'meter' ? '#dbeafe' :
                              el.type === 'bus' ? '#fcd34d' : '#f3f4f6',
              color: el.type === 'load' ? '#fff' : '#1f2937',
            }}
          >
            <div className="font-medium truncate">{el.name}</div>
            <div className="text-gray-500">{el.type}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

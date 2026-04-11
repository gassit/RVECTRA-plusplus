'use client';

import { useEffect, useRef, useState } from 'react';
import { Graph } from '@antv/g6';

interface NetworkData {
  elements: Array<{ id: string; elementId: string; name: string; type: string }>;
  connections: Array<{ id: string; sourceId: string; targetId: string }>;
}

interface Props {
  data: NetworkData | null;
  onNodeClick?: (id: string) => void;
}

const COLORS: Record<string, string> = {
  source: '#fef3c7', breaker: '#e5e7eb', load: '#4b5563',
  meter: '#dbeafe', bus: '#fef3c7', junction: '#d1d5db', cabinet: '#e9d5ff',
};

export default function NetworkGraphInner({ data, onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [status, setStatus] = useState('init');
  const [error, setError] = useState<string | null>(null);

  // Log data changes
  useEffect(() => {
    console.log('NetworkGraphInner data:', data ? `${data.elements?.length} elements, ${data.connections?.length} connections` : 'null');
  }, [data]);

  useEffect(() => {
    if (!data?.elements?.length) {
      setStatus('no-data');
      return;
    }

    // Wait for container to be ready
    const timer = setTimeout(() => {
      if (!containerRef.current) {
        setError('Контейнер не найден');
        return;
      }

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();

      if (rect.width < 10 || rect.height < 10) {
        setError(`Контейнер мал: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
        return;
      }

      setStatus('creating');
      setError(null);

      // Cleanup old graph
      if (graphRef.current) {
        try { graphRef.current.destroy(); } catch { /* ignore */ }
        graphRef.current = null;
      }

      const ids = new Set(data.elements.map(e => e.id));
      const nodes = data.elements.map((e, i) => ({
        id: e.id,
        style: {
          x: 50 + (i % 15) * 100,
          y: 50 + Math.floor(i / 15) * 50,
          fill: COLORS[e.type] || '#e5e7eb',
          labelText: (e.name || e.elementId || e.id).substring(0, 12),
        },
      }));

      const edges = data.connections
        .filter(c => ids.has(c.sourceId) && ids.has(c.targetId))
        .slice(0, 300)
        .map((c, i) => ({
          id: `edge-${i}`,
          source: c.sourceId,
          target: c.targetId,
        }));

      console.log(`Creating graph: ${nodes.length} nodes, ${edges.length} edges`);

      try {
        const graph = new Graph({
          container,
          width: rect.width,
          height: rect.height,
          data: { nodes, edges },
          autoFit: 'view',
          padding: 20,
          behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
          node: {
            type: 'rect',
            style: {
              size: [80, 28],
              fill: (d: { style?: { fill?: string } }) => d.style?.fill || '#e5e7eb',
              stroke: '#6b7280',
              lineWidth: 1,
              radius: 4,
              labelText: (d: { style?: { labelText?: string } }) => d.style?.labelText || '',
              labelFontSize: 10,
              labelFill: '#374151',
            },
          },
          edge: {
            type: 'line',
            style: {
              stroke: '#9ca3af',
              lineWidth: 1.5,
            },
          },
        });

        graphRef.current = graph;

        graph.on('node:click', (evt: { itemId?: string }) => {
          console.log('Node click:', evt.itemId);
          if (onNodeClick && evt.itemId) onNodeClick(evt.itemId);
        });

        graph.render()
          .then(() => {
            console.log('Graph rendered successfully');
            setStatus('ready');
            setTimeout(() => {
              try {
                graph.fitView(20);
              } catch { /* ignore */ }
            }, 100);
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('Render error:', msg);
            setError('Ошибка рендеринга: ' + msg);
            setStatus('error');
          });

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Init error:', msg);
        setError('Ошибка инициализации: ' + msg);
        setStatus('error');
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (graphRef.current) {
        try { graphRef.current.destroy(); } catch { /* ignore */ }
        graphRef.current = null;
      }
    };
  }, [data, onNodeClick]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (graphRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 10 && rect.height > 10) {
          try {
            graphRef.current.resize(rect.width, rect.height);
          } catch { /* ignore */ }
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!data?.elements?.length) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Нет данных для отображения
      </div>
    );
  }

  return (
    <div className="h-full w-full relative" style={{ background: '#f1f5f9' }}>
      {/* Status indicator */}
      <div className="absolute top-2 left-2 z-10 px-3 py-1.5 bg-white/90 rounded-lg shadow text-xs font-medium">
        {status === 'ready' ? (
          <span className="text-green-600">✓ {data.elements.length} узлов, {data.connections.length} связей</span>
        ) : status === 'error' ? (
          <span className="text-red-600">✗ Ошибка</span>
        ) : (
          <span className="text-blue-600">⏳ {status}...</span>
        )}
      </div>

      {/* Fit button */}
      {status === 'ready' && (
        <button
          onClick={() => graphRef.current?.fitView(20)}
          className="absolute top-2 right-2 z-10 px-3 py-1.5 bg-white/90 rounded-lg shadow text-xs font-medium hover:bg-white"
        >
          Fit View
        </button>
      )}

      {/* Error display */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50/90 z-20">
          <div className="text-center p-6 bg-white rounded-xl shadow-lg max-w-md">
            <div className="text-red-600 font-bold text-lg mb-2">Ошибка графа</div>
            <div className="text-red-500 text-sm">{error}</div>
          </div>
        </div>
      )}

      {/* Graph container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0
        }}
      />
    </div>
  );
}

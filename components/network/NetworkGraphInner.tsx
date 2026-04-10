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
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !data?.elements?.length) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    if (rect.width < 10 || rect.height < 10) {
      setError('Контейнер слишком мал: ' + rect.width + 'x' + rect.height);
      return;
    }

    setError(null);
    setReady(false);

    // Cleanup
    if (graphRef.current) {
      try { graphRef.current.destroy(); } catch { /* ignore */ }
      graphRef.current = null;
    }

    const ids = new Set(data.elements.map(e => e.id));
    const nodes = data.elements.map((e, i) => ({
      id: e.id,
      style: {
        x: 50 + (i % 12) * 90,
        y: 50 + Math.floor(i / 12) * 45,
        fill: COLORS[e.type] || '#e5e7eb',
        labelText: (e.name || e.elementId || e.id).substring(0, 15),
      },
    }));

    const edges = data.connections
      .filter(c => ids.has(c.sourceId) && ids.has(c.targetId))
      .slice(0, 300)
      .map((c, i) => ({
        id: `e${i}`,
        source: c.sourceId,
        target: c.targetId,
      }));

    try {
      const graph = new Graph({
        container,
        width: rect.width,
        height: rect.height,
        data: { nodes, edges },
        autoFit: 'view',
        padding: 10,
        behaviors: ['drag-canvas', 'zoom-canvas'],
        node: {
          type: 'rect',
          style: {
            size: [75, 24],
            fill: (d: { style?: { fill?: string } }) => d.style?.fill || '#e5e7eb',
            stroke: '#6b7280',
            lineWidth: 1,
            radius: 3,
            labelText: (d: { style?: { labelText?: string } }) => d.style?.labelText || '',
            labelFontSize: 9,
          },
        },
        edge: {
          type: 'line',
          style: { stroke: '#9ca3af', lineWidth: 1 },
        },
      });

      graphRef.current = graph;

      graph.on('node:click', (evt: { itemId?: string }) => {
        if (onNodeClick && evt.itemId) onNodeClick(evt.itemId);
      });

      graph.render()
        .then(() => {
          setReady(true);
          setTimeout(() => graph.fitView(10), 50);
        })
        .catch((err: unknown) => {
          setError('Render: ' + (err instanceof Error ? err.message : String(err)));
        });

    } catch (err: unknown) {
      setError('Init: ' + (err instanceof Error ? err.message : String(err)));
    }

    const onResize = () => {
      if (graphRef.current && container) {
        const r = container.getBoundingClientRect();
        if (r.width > 10 && r.height > 10) {
          graphRef.current.resize(r.width, r.height);
        }
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (graphRef.current) {
        try { graphRef.current.destroy(); } catch { /* ignore */ }
        graphRef.current = null;
      }
    };
  }, [data, onNodeClick]);

  if (!data?.elements?.length) {
    return <div className="h-full flex items-center justify-center text-gray-400">Нет данных</div>;
  }

  return (
    <div className="h-full w-full relative" style={{ background: '#f8fafc' }}>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-20">
          <div className="text-center p-4">
            <div className="text-red-600 font-bold">Ошибка G6</div>
            <div className="text-red-500 text-sm mt-1">{error}</div>
          </div>
        </div>
      )}

      <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-white rounded shadow text-xs">
        {ready ? `✓ ${data.elements.length} узлов, ${data.connections.length} связей` : '⏳ Загрузка...'}
      </div>

      {ready && (
        <button
          onClick={() => graphRef.current?.fitView(10)}
          className="absolute top-2 right-2 z-10 px-2 py-1 bg-white rounded shadow text-xs"
        >
          Fit
        </button>
      )}

      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute' }} />
    </div>
  );
}

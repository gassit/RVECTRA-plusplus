'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Graph } from '@antv/g6';

interface NetworkData {
  elements: Array<{ id: string; elementId: string; name: string; type: string; posX?: number | null; posY?: number | null }>;
  connections: Array<{ id: string; sourceId: string; targetId: string }>;
}

interface Props {
  data: NetworkData | null;
  onNodeClick?: (id: string) => void;
}

// Цвета согласно правилам PROJECT_CONTEXT.md
const NODE_STYLES: Record<string, { fill: string; stroke: string; shape: string; size: number }> = {
  source: { fill: '#fef3c7', stroke: '#f59e0b', shape: 'hexagon', size: 50 },
  breaker: { fill: '#ffffff', stroke: '#1f2937', shape: 'rect', size: 30 },
  load: { fill: '#374151', stroke: '#1f2937', shape: 'rect', size: 30 },
  meter: { fill: '#dbeafe', stroke: '#3b82f6', shape: 'diamond', size: 35 },
  bus: { fill: '#fcd34d', stroke: '#d97706', shape: 'rect', size: 60 },
  junction: { fill: '#d1d5db', stroke: '#6b7280', shape: 'circle', size: 15 },
  cabinet: { fill: '#e9d5ff', stroke: '#7c3aed', shape: 'rect', size: 40 },
};

/**
 * BFS алгоритм для размещения узлов по уровням
 */
function calculateNodePositions(
  elements: NetworkData['elements'],
  connections: NetworkData['connections'],
  width: number,
  height: number
): Map<string, { x: number; y: number; level: number }> {
  const positions = new Map<string, { x: number; y: number; level: number }>();

  if (!elements.length) return positions;

  const elementMap = new Map(elements.map(e => [e.id, e]));
  const elementIds = new Set(elements.map(e => e.id));

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  elements.forEach(e => {
    outgoing.set(e.id, []);
    incoming.set(e.id, []);
  });

  connections.forEach(c => {
    if (elementIds.has(c.sourceId) && elementIds.has(c.targetId)) {
      outgoing.get(c.sourceId)?.push(c.targetId);
      incoming.get(c.targetId)?.push(c.sourceId);
    }
  });

  const levels = new Map<string, number>();
  const queue: string[] = [];

  elements.forEach(e => {
    if (e.type === 'source') {
      levels.set(e.id, 0);
      queue.push(e.id);
    }
  });

  if (queue.length === 0) {
    elements.forEach(e => {
      const inc = incoming.get(e.id) || [];
      if (inc.length === 0) {
        levels.set(e.id, 0);
        queue.push(e.id);
      }
    });
  }

  let maxLevel = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current) || 0;
    const nextLevel = currentLevel + 1;

    const targets = outgoing.get(current) || [];
    targets.forEach(target => {
      const existingLevel = levels.get(target);
      if (existingLevel === undefined || existingLevel < nextLevel) {
        levels.set(target, nextLevel);
        maxLevel = Math.max(maxLevel, nextLevel);
        queue.push(target);
      }
    });
  }

  const defaultLevel = Math.ceil(maxLevel / 2);
  elements.forEach(e => {
    if (!levels.has(e.id)) {
      if (e.type === 'load') {
        levels.set(e.id, maxLevel + 1);
      } else if (e.type === 'source') {
        levels.set(e.id, 0);
      } else {
        levels.set(e.id, defaultLevel);
      }
    }
  });

  maxLevel = Math.max(...Array.from(levels.values()), 0);

  const levelGroups = new Map<number, string[]>();
  levels.forEach((level, id) => {
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push(id);
  });

  const levelHeight = Math.max(80, height / (maxLevel + 2));
  const startY = 100;

  levelGroups.forEach((nodeIds, level) => {
    const y = startY + level * levelHeight;
    const count = nodeIds.length;
    const groupWidth = Math.min(width - 200, count * 120);
    const startX = (width - groupWidth) / 2;
    const spacing = count > 1 ? groupWidth / (count - 1) : 0;

    nodeIds.forEach((id, index) => {
      const element = elementMap.get(id);
      let x: number;

      if (count === 1) {
        x = width / 2;
      } else {
        x = startX + index * spacing;
      }

      if (element?.type === 'bus') {
        x = Math.max(80, Math.min(width - 80, x));
      }

      positions.set(id, { x, y, level });
    });
  });

  return positions;
}

export default function NetworkGraphInner({ data, onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [status, setStatus] = useState('init');
  const [error, setError] = useState<string | null>(null);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (onNodeClick) {
      onNodeClick(nodeId);
    }
  }, [onNodeClick]);

  useEffect(() => {
    if (!data?.elements?.length) {
      setStatus('no-data');
      return;
    }

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

      const positions = calculateNodePositions(
        data.elements,
        data.connections,
        rect.width,
        rect.height
      );

      const ids = new Set(data.elements.map(e => e.id));

      // G6 v5 формат данных
      const nodes = data.elements.map(e => {
        const style = NODE_STYLES[e.type] || NODE_STYLES.junction;
        const pos = positions.get(e.id) || { x: 100, y: 100 };
        const label = (e.name || e.elementId || e.id).substring(0, 12);

        return {
          id: e.id,
          data: {
            label,
            nodeType: e.type,
            fill: style.fill,
            stroke: style.stroke,
            size: style.size,
            shape: style.shape,
          },
          style: {
            x: pos.x,
            y: pos.y,
          },
        };
      });

      const edges = data.connections
        .filter(c => ids.has(c.sourceId) && ids.has(c.targetId))
        .map((c, i) => ({
          id: `edge-${i}`,
          source: c.sourceId,
          target: c.targetId,
          data: {},
        }));

      console.log(`Creating G6 v5 graph: ${nodes.length} nodes, ${edges.length} edges`);

      try {
        const graph = new Graph({
          container,
          width: rect.width,
          height: rect.height,
          data: { nodes, edges },
          autoFit: 'view',
          padding: 40,
          behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
          node: {
            type: (model: { data?: { shape?: string } }) => {
              return model.data?.shape || 'circle';
            },
            style: {
              size: (model: { data?: { size?: number } }) => model.data?.size || 20,
              fill: (model: { data?: { fill?: string } }) => model.data?.fill || '#d1d5db',
              stroke: (model: { data?: { stroke?: string } }) => model.data?.stroke || '#6b7280',
              lineWidth: 2,
              radius: 4,
              labelText: (model: { data?: { label?: string } }) => model.data?.label || '',
              labelFontSize: 10,
              labelFill: '#374151',
              labelPlacement: 'bottom',
              labelOffsetY: 8,
            },
            state: {
              selected: {
                stroke: '#3b82f6',
                lineWidth: 3,
              },
              hover: {
                stroke: '#60a5fa',
                lineWidth: 2,
              },
            },
          },
          edge: {
            type: 'line',
            style: {
              stroke: '#9ca3af',
              lineWidth: 2,
              endArrow: true,
            },
          },
        });

        graphRef.current = graph;

        graph.on('node:click', (evt: { target: { id?: string }; itemId?: string }) => {
          const nodeId = evt.itemId || evt.target?.id;
          console.log('Node click:', nodeId);
          if (nodeId) {
            handleNodeClick(nodeId);
          }
        });

        graph.render()
          .then(() => {
            console.log('G6 v5 graph rendered successfully');
            setStatus('ready');
            setTimeout(() => {
              try {
                graph.fitView(40);
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
    }, 150);

    return () => {
      clearTimeout(timer);
      if (graphRef.current) {
        try { graphRef.current.destroy(); } catch { /* ignore */ }
        graphRef.current = null;
      }
    };
  }, [data, handleNodeClick]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (graphRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 10 && rect.height > 10) {
          try {
            graphRef.current.resize(rect.width, rect.height);
            graphRef.current.fitView(40);
          } catch { /* ignore */ }
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!data?.elements?.length) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-4xl mb-4">📊</div>
          <div className="text-lg">Нет данных для отображения</div>
          <div className="text-sm text-gray-400 mt-2">База данных пуста</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative" style={{ background: '#f8fafc' }}>
      {/* Status indicator */}
      <div className="absolute top-2 left-2 z-10 px-3 py-1.5 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow text-xs font-medium">
        {status === 'ready' ? (
          <span className="text-green-600 dark:text-green-400">✓ {data.elements.length} узлов, {data.connections.length} связей (G6 v5)</span>
        ) : status === 'error' ? (
          <span className="text-red-600 dark:text-red-400">✗ Ошибка</span>
        ) : (
          <span className="text-blue-600 dark:text-blue-400">⏳ {status}...</span>
        )}
      </div>

      {/* Fit button */}
      {status === 'ready' && (
        <button
          onClick={() => {
            try {
              graphRef.current?.fitView(40);
            } catch { /* ignore */ }
          }}
          className="absolute top-2 right-2 z-10 px-3 py-1.5 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow text-xs font-medium hover:bg-white dark:hover:bg-gray-700 transition-colors"
        >
          Fit View
        </button>
      )}

      {/* Legend */}
      {status === 'ready' && (
        <div className="absolute bottom-2 left-2 z-10 p-3 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow text-xs">
          <div className="grid grid-cols-3 gap-2 text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full" style={{ background: '#fef3c7', border: '2px solid #f59e0b' }}></div>
              <span>Source</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-2 rounded" style={{ background: '#fff', border: '1px solid #1f2937' }}></div>
              <span>Breaker</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-2 rounded" style={{ background: '#374151' }}></div>
              <span>Load</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rotate-45" style={{ background: '#dbeafe', border: '1px solid #3b82f6' }}></div>
              <span>Meter</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-5 h-2 rounded" style={{ background: '#fcd34d', border: '1px solid #d97706' }}></div>
              <span>Bus</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ background: '#d1d5db', border: '1px solid #6b7280' }}></div>
              <span>Junction</span>
            </div>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50/90 dark:bg-red-900/20 z-20">
          <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-md">
            <div className="text-red-600 dark:text-red-400 font-bold text-lg mb-2">Ошибка графа</div>
            <div className="text-red-500 dark:text-red-300 text-sm">{error}</div>
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

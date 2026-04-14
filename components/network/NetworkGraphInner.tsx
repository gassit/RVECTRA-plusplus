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

const NODE_COLORS: Record<string, { fill: string; stroke: string }> = {
  source: { fill: '#fef3c7', stroke: '#f59e0b' },
  breaker: { fill: '#ffffff', stroke: '#1f2937' },
  load: { fill: '#374151', stroke: '#1f2937' },
  meter: { fill: '#dbeafe', stroke: '#3b82f6' },
  bus: { fill: '#fcd34d', stroke: '#d97706' },
  junction: { fill: '#d1d5db', stroke: '#6b7280' },
};

function calculatePositions(
  elements: NetworkData['elements'],
  connections: NetworkData['connections'],
  width: number,
  height: number
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (!elements.length) return positions;

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
      if ((incoming.get(e.id) || []).length === 0) {
        levels.set(e.id, 0);
        queue.push(e.id);
      }
    });
  }

  let maxLevel = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current) || 0;
    (outgoing.get(current) || []).forEach(target => {
      const existing = levels.get(target);
      if (existing === undefined || existing < currentLevel + 1) {
        levels.set(target, currentLevel + 1);
        maxLevel = Math.max(maxLevel, currentLevel + 1);
        queue.push(target);
      }
    });
  }

  const defaultLevel = Math.ceil(maxLevel / 2);
  elements.forEach(e => {
    if (!levels.has(e.id)) {
      levels.set(e.id, e.type === 'load' ? maxLevel + 1 : defaultLevel);
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
      const x = count === 1 ? width / 2 : startX + index * spacing;
      positions.set(id, { x: Math.max(60, Math.min(width - 60, x)), y });
    });
  });

  return positions;
}

export default function NetworkGraphInner({ data, onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const handleClick = useCallback((nodeId: string) => {
    onNodeClick?.(nodeId);
  }, [onNodeClick]);

  useEffect(() => {
    if (!data?.elements?.length) {
      setStatus('loading');
      return;
    }

    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;

      if (graphRef.current) {
        try { graphRef.current.destroy(); } catch {}
        graphRef.current = null;
      }

      const positions = calculatePositions(data.elements, data.connections, rect.width, rect.height);
      const ids = new Set(data.elements.map(e => e.id));

      const nodes = data.elements.map(e => {
        const colors = NODE_COLORS[e.type] || NODE_COLORS.junction;
        const pos = positions.get(e.id) || { x: 100, y: 100 };
        return {
          id: e.id,
          data: {
            label: (e.name || e.elementId || e.id).substring(0, 12),
            nodeType: e.type,
            fill: colors.fill,
            stroke: colors.stroke,
          },
          style: { x: pos.x, y: pos.y },
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
            type: (m: { data?: { nodeType?: string } }) => {
              const t = m.data?.nodeType;
              if (t === 'source') return 'hexagon';
              if (t === 'meter') return 'diamond';
              if (t === 'junction') return 'circle';
              return 'rect';
            },
            style: {
              size: (m: { data?: { nodeType?: string } }) => {
                const t = m.data?.nodeType;
                if (t === 'source') return 50;
                if (t === 'bus') return 60;
                if (t === 'junction') return 15;
                if (t === 'meter') return 35;
                return 30;
              },
              fill: (m: { data?: { fill?: string } }) => m.data?.fill || '#d1d5db',
              stroke: (m: { data?: { stroke?: string } }) => m.data?.stroke || '#6b7280',
              lineWidth: 2,
              radius: 4,
              labelText: (m: { data?: { label?: string } }) => m.data?.label || '',
              labelFontSize: 10,
              labelFill: '#374151',
              labelPlacement: 'bottom',
              labelOffsetY: 8,
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

        graph.on('node:click', (evt: { itemId?: string }) => {
          if (evt.itemId) handleClick(evt.itemId);
        });

        graph.render()
          .then(() => {
            setStatus('ready');
            setTimeout(() => graph.fitView?.(40), 100);
          })
          .catch(() => setStatus('error'));

      } catch {
        setStatus('error');
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      if (graphRef.current) {
        try { graphRef.current.destroy(); } catch {}
        graphRef.current = null;
      }
    };
  }, [data, handleClick]);

  useEffect(() => {
    const onResize = () => {
      if (graphRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 10 && rect.height > 10) {
          try {
            graphRef.current.resize?.(rect.width, rect.height);
            graphRef.current.fitView?.(40);
          } catch {}
        }
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!data?.elements?.length) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-4xl mb-4">📊</div>
          <div>Нет данных</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative bg-gray-50 dark:bg-gray-900">
      {status === 'ready' && (
        <div className="absolute top-2 left-2 z-10 px-3 py-1.5 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow text-xs font-medium text-green-600">
          ✓ {data.elements.length} узлов, {data.connections.length} связей (G6 v5)
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

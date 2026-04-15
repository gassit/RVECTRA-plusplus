'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Graph } from '@antv/g6';
import type { ElectricalStatus, OperationalStatus } from '@/types';

interface NetworkData {
  elements: Array<{
    id: string;
    elementId: string;
    name: string;
    type: string;
    posX?: number | null;
    posY?: number | null;
    parentId?: string | null;
    electricalStatus: ElectricalStatus;
    operationalStatus: OperationalStatus;
  }>;
  connections: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    electricalStatus: ElectricalStatus;
    operationalStatus: OperationalStatus;
  }>;
}

interface Props {
  data: NetworkData | null;
  onNodeClick?: (id: string) => void;
}

// Типовые цвета элементов (базовые)
const NODE_TYPE_COLORS: Record<string, { fill: string; stroke: string }> = {
  source: { fill: '#fef3c7', stroke: '#f59e0b' },
  breaker: { fill: '#ffffff', stroke: '#1f2937' },
  load: { fill: '#374151', stroke: '#1f2937' },
  meter: { fill: '#dbeafe', stroke: '#3b82f6' },
  bus: { fill: '#fcd34d', stroke: '#d97706' },
  junction: { fill: '#d1d5db', stroke: '#6b7280' },
  cabinet: { fill: '#e5e7eb', stroke: '#9ca3af' },
};

/**
 * Вычисляет стили узла на основе статусов
 */
function getNodeStyles(
  type: string,
  electricalStatus: ElectricalStatus,
  operationalStatus: OperationalStatus
): { fill: string; stroke: string; opacity: number; lineWidth: number } {
  const baseColors = NODE_TYPE_COLORS[type] || NODE_TYPE_COLORS.junction;

  // OFF элемент - красная обводка и пониженная прозрачность
  if (operationalStatus === 'OFF') {
    return {
      fill: baseColors.fill,
      stroke: '#ef4444', // красный
      opacity: 0.35,
      lineWidth: 3,
    };
  }

  // LIVE элемент - типовой цвет + зелёная обводка
  if (electricalStatus === 'LIVE') {
    return {
      fill: baseColors.fill,
      stroke: '#22c55e', // зелёный
      opacity: 1.0,
      lineWidth: 2,
    };
  }

  // DEAD элемент - серый, прозрачный
  return {
    fill: '#374151', // серый
    stroke: '#6b7280', // тёмно-серый
    opacity: 0.5,
    lineWidth: 1,
  };
}

/**
 * Вычисляет стили ребра на основе статусов
 */
function getEdgeStyles(
  electricalStatus: ElectricalStatus,
  operationalStatus: OperationalStatus
): { stroke: string; lineWidth: number; opacity: number; lineDash?: number[] } {
  // OFF связь - красная пунктирная
  if (operationalStatus === 'OFF') {
    return {
      stroke: '#ef4444',
      lineWidth: 2,
      opacity: 0.8,
      lineDash: [6, 4],
    };
  }

  // LIVE связь - зелёная
  if (electricalStatus === 'LIVE') {
    return {
      stroke: '#22c55e',
      lineWidth: 2,
      opacity: 0.8,
    };
  }

  // DEAD связь - серая
  return {
    stroke: '#6b7280',
    lineWidth: 1,
    opacity: 0.3,
  };
}

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

      // Подсчёт статистики
      let liveCount = 0;
      let deadCount = 0;
      let offCount = 0;

      const nodes = data.elements.map(e => {
        const pos = positions.get(e.id) || { x: 100, y: 100 };
        const styles = getNodeStyles(e.type, e.electricalStatus, e.operationalStatus);

        // Статистика
        if (e.operationalStatus === 'OFF') offCount++;
        else if (e.electricalStatus === 'LIVE') liveCount++;
        else deadCount++;

        return {
          id: e.id,
          data: {
            label: (e.name || e.elementId || e.id).substring(0, 12),
            nodeType: e.type,
            electricalStatus: e.electricalStatus,
            operationalStatus: e.operationalStatus,
            ...styles,
          },
          style: { x: pos.x, y: pos.y },
        };
      });

      const edges = data.connections
        .filter(c => ids.has(c.sourceId) && ids.has(c.targetId))
        .map((c, i) => {
          const styles = getEdgeStyles(c.electricalStatus, c.operationalStatus);
          return {
            id: `edge-${i}`,
            source: c.sourceId,
            target: c.targetId,
            data: {
              electricalStatus: c.electricalStatus,
              operationalStatus: c.operationalStatus,
            },
            style: {
              stroke: styles.stroke,
              lineWidth: styles.lineWidth,
              opacity: styles.opacity,
              endArrow: true,
              ...(styles.lineDash ? { lineDash: styles.lineDash } : {}),
            },
          };
        });

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
              lineWidth: (m: { data?: { lineWidth?: number } }) => m.data?.lineWidth || 2,
              opacity: (m: { data?: { opacity?: number } }) => m.data?.opacity || 1,
              radius: 4,
              labelText: (m: { data?: { label?: string; operationalStatus?: string } }) => {
                const baseLabel = m.data?.label || '';
                if (m.data?.operationalStatus === 'OFF') {
                  return `● ${baseLabel}`;
                }
                return baseLabel;
              },
              labelFontSize: 10,
              labelFill: (m: { data?: { operationalStatus?: string } }) => {
                if (m.data?.operationalStatus === 'OFF') {
                  return '#ef4444';
                }
                return '#374151';
              },
              labelPlacement: 'bottom',
              labelOffsetY: 8,
            },
          },
          edge: {
            type: 'line',
            style: {
              stroke: '#9ca3af',
              lineWidth: 2,
              opacity: 0.8,
              endArrow: true,
            },
          },
        });

        graphRef.current = graph;

        graph.on('node:click', (evt: any) => {
          if (evt.itemId) handleClick(evt.itemId);
        });

        graph.render()
          .then(() => {
            setStatus('ready');
            setTimeout(() => graph.fitView?.(), 100);
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
            graphRef.current.fitView?.();
          } catch {}
        }
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Подсчёт статистики для отображения
  const stats = {
    live: data?.elements?.filter(e => e.operationalStatus === 'ON' && e.electricalStatus === 'LIVE').length || 0,
    dead: data?.elements?.filter(e => e.electricalStatus === 'DEAD').length || 0,
    off: data?.elements?.filter(e => e.operationalStatus === 'OFF').length || 0,
  };

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
      {/* Статус */}
      {status === 'ready' && (
        <div className="absolute top-2 left-2 z-10 px-3 py-1.5 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow text-xs font-medium text-green-600">
          ✓ {data.elements.length} узлов, {data.connections.length} связей (G6 v5)
        </div>
      )}

      {/* Легенда */}
      <div className="absolute top-2 right-2 z-10 px-3 py-2 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow text-xs">
        <div className="font-semibold mb-1.5 text-gray-700 dark:text-gray-300">Статусы:</div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 border-2 border-green-600"></span>
            <span className="text-gray-600 dark:text-gray-400">LIVE ({stats.live})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-400 border-2 border-gray-500 opacity-50"></span>
            <span className="text-gray-600 dark:text-gray-400">DEAD ({stats.dead})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-300 border-2 border-red-500 opacity-35"></span>
            <span className="text-red-500">OFF ({stats.off})</span>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

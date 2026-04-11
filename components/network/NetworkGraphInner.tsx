'use client';

import { useEffect, useRef, useState } from 'react';
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
const NODE_STYLES: Record<string, { fill: string; stroke: string; shape: string; size: number[] }> = {
  source: { fill: '#fef3c7', stroke: '#f59e0b', shape: 'hexagon', size: [70, 70] },      // Октагон (приближение hexagon), жёлтый
  breaker: { fill: '#ffffff', stroke: '#1f2937', shape: 'rect', size: [60, 24] },        // Белый, RoundRectangle
  load: { fill: '#374151', stroke: '#1f2937', shape: 'rect', size: [60, 24] },           // Чёрный, Rectangle
  meter: { fill: '#dbeafe', stroke: '#3b82f6', shape: 'diamond', size: [40, 40] },       // Синий, Diamond
  bus: { fill: '#fcd34d', stroke: '#d97706', shape: 'rect', size: [120, 20] },           // Медный/янтарный, удлинённый
  junction: { fill: '#d1d5db', stroke: '#6b7280', shape: 'circle', size: [24, 24] },     // Серый, Ellipse
  cabinet: { fill: '#e9d5ff', stroke: '#7c3aed', shape: 'rect', size: [60, 30] },        // Фиолетовый (дополнительный)
};

/**
 * BFS алгоритм для размещения узлов по уровням
 * Правила:
 * 1. source - вверху схемы (уровень 0)
 * 2. load - внизу схемы (максимальный уровень)
 * 3. Элементы "to" от Bus - на одном уровне под Bus
 * 4. Элементы "from" питающие Bus - над Bus
 * 5. load под breaker при связи breaker→load
 */
function calculateNodePositions(
  elements: NetworkData['elements'],
  connections: NetworkData['connections'],
  width: number,
  height: number
): Map<string, { x: number; y: number; level: number }> {
  const positions = new Map<string, { x: number; y: number; level: number }>();
  
  if (!elements.length) return positions;

  // Создаём карты для быстрого доступа
  const elementMap = new Map(elements.map(e => [e.id, e]));
  const elementIds = new Set(elements.map(e => e.id));

  // Строим граф связей (направленный: source -> target)
  const outgoing = new Map<string, string[]>();  // Куда идут связи от узла
  const incoming = new Map<string, string[]>();  // Откуда приходят связи к узлу

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

  // Определяем уровень каждого узла через BFS от источников
  const levels = new Map<string, number>();
  const queue: string[] = [];

  // Находим все источники (source) - они на уровне 0
  elements.forEach(e => {
    if (e.type === 'source') {
      levels.set(e.id, 0);
      queue.push(e.id);
    }
  });

  // Если нет source, начинаем с узлов без входящих связей
  if (queue.length === 0) {
    elements.forEach(e => {
      const inc = incoming.get(e.id) || [];
      if (inc.length === 0) {
        levels.set(e.id, 0);
        queue.push(e.id);
      }
    });
  }

  // BFS для определения уровней
  let maxLevel = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current) || 0;
    const nextLevel = currentLevel + 1;

    // Обходим все исходящие связи
    const targets = outgoing.get(current) || [];
    targets.forEach(target => {
      const existingLevel = levels.get(target);
      // Устанавливаем уровень, если узел ещё не посещён или нашли более длинный путь
      if (existingLevel === undefined || existingLevel < nextLevel) {
        levels.set(target, nextLevel);
        maxLevel = Math.max(maxLevel, nextLevel);
        queue.push(target);
      }
    });
  }

  // Для узлов без уровня (изолированные) ставим средний уровень
  const defaultLevel = Math.ceil(maxLevel / 2);
  elements.forEach(e => {
    if (!levels.has(e.id)) {
      // Изолированные узлы размещаем по типу
      if (e.type === 'load') {
        levels.set(e.id, maxLevel + 1);
      } else if (e.type === 'source') {
        levels.set(e.id, 0);
      } else {
        levels.set(e.id, defaultLevel);
      }
    }
  });

  // Обновляем maxLevel
  maxLevel = Math.max(...Array.from(levels.values()), 0);

  // Группируем узлы по уровням
  const levelGroups = new Map<number, string[]>();
  levels.forEach((level, id) => {
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push(id);
  });

  // Параметры размещения
  const levelHeight = Math.max(60, height / (maxLevel + 2));
  const startY = 80;  // Отступ сверху

  // Размещаем узлы по уровням
  levelGroups.forEach((nodeIds, level) => {
    const y = startY + level * levelHeight;
    const count = nodeIds.length;
    const groupWidth = Math.min(width - 100, count * 100);
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

      // Специальная обработка для bus - центрируем по горизонтали
      if (element?.type === 'bus') {
        // Bus шире, корректируем позицию
        x = Math.max(70, Math.min(width - 70, x));
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

  useEffect(() => {
    console.log('NetworkGraphInner data:', data ? `${data.elements?.length} elements, ${data.connections?.length} connections` : 'null');
  }, [data]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!data?.elements?.length) {
        setStatus('no-data');
        return;
      }
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

      // Вычисляем позиции узлов по правилам
      const positions = calculateNodePositions(
        data.elements,
        data.connections,
        rect.width,
        rect.height
      );

      // Создаём узлы с правильными стилями
      const ids = new Set(data.elements.map(e => e.id));
      const nodes = data.elements.map(e => {
        const style = NODE_STYLES[e.type] || NODE_STYLES.junction;
        const pos = positions.get(e.id) || { x: 100, y: 100 };
        const label = (e.name || e.elementId || e.id).substring(0, 15);

        return {
          id: e.id,
          data: {
            type: e.type,
            label,
          },
          style: {
            x: pos.x,
            y: pos.y,
            fill: style.fill,
            stroke: style.stroke,
            size: style.size,
            labelText: label,
          },
        };
      });

      // Создаём рёбра
      const edges = data.connections
        .filter(c => ids.has(c.sourceId) && ids.has(c.targetId))
        .map((c, i) => ({
          id: `edge-${i}`,
          source: c.sourceId,
          target: c.targetId,
        }));

      console.log(`Creating graph: ${nodes.length} nodes, ${edges.length} edges (BFS layout)`);

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
            type: (d: { data?: { type?: string } }) => {
              const nodeType = d.data?.type || 'junction';
              const shape = NODE_STYLES[nodeType]?.shape || 'rect';
              return shape;
            },
            style: {
              fill: (d: { style?: { fill?: string } }) => d.style?.fill || '#d1d5db',
              stroke: (d: { style?: { stroke?: string } }) => d.style?.stroke || '#6b7280',
              lineWidth: 2,
              radius: (d: { data?: { type?: string } }) => {
                const nodeType = d.data?.type;
                // breaker имеет скруглённые углы
                return nodeType === 'breaker' ? 6 : 2;
              },
              size: (d: { style?: { size?: number[] } }) => d.style?.size || [60, 24],
              labelText: (d: { style?: { labelText?: string } }) => d.style?.labelText || '',
              labelFontSize: 9,
              labelFill: (d: { data?: { type?: string } }) => {
                const nodeType = d.data?.type;
                // load имеет белый текст на чёрном фоне
                return nodeType === 'load' ? '#f3f4f6' : '#374151';
              },
              labelPlacement: 'bottom',
              labelOffsetY: 4,
            },
          },
          edge: {
            type: 'line',
            style: {
              stroke: '#9ca3af',
              lineWidth: 1.5,
              endArrow: true,
              arrowSize: 4,
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
            console.log('Graph rendered successfully with BFS layout');
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
    <div className="h-full w-full relative" style={{ background: '#f8fafc' }}>
      {/* Status indicator */}
      <div className="absolute top-2 left-2 z-10 px-3 py-1.5 bg-white/90 rounded-lg shadow text-xs font-medium">
        {status === 'ready' ? (
          <span className="text-green-600">✓ {data.elements.length} узлов, {data.connections.length} связей (BFS layout)</span>
        ) : status === 'error' ? (
          <span className="text-red-600">✗ Ошибка</span>
        ) : (
          <span className="text-blue-600">⏳ {status}...</span>
        )}
      </div>

      {/* Fit button */}
      {status === 'ready' && (
        <button
          onClick={() => graphRef.current?.fitView(40)}
          className="absolute top-2 right-2 z-10 px-3 py-1.5 bg-white/90 rounded-lg shadow text-xs font-medium hover:bg-white"
        >
          Fit View
        </button>
      )}

      {/* Legend */}
      {status === 'ready' && (
        <div className="absolute bottom-2 left-2 z-10 p-3 bg-white/90 rounded-lg shadow text-xs">
          <div className="grid grid-cols-3 gap-2">
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

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
  conflictElementIds?: string[];
  cabinetBounds?: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

interface Props {
  data: NetworkData | null;
  isDark?: boolean;
  onNodeClick?: (id: string) => void;
}

// ============== 1. Формы узлов ==============
function getNodeShape(type: string): string {
  switch (type) {
    case 'source': return 'hexagon';
    case 'meter': return 'diamond';
    case 'junction': return 'circle';
    case 'breaker':
    case 'load':
    case 'bus':
    case 'cabinet':
    default: return 'rect';
  }
}

// ============== 2. Размеры узлов ==============
function getNodeSize(type: string): number | [number, number] {
  switch (type) {
    case 'source': return [70, 50];
    case 'breaker': return [50, 34];
    case 'load': return [60, 36];
    case 'meter': return [44, 44];
    case 'bus': return [120, 24];
    case 'cabinet': return [80, 50];
    case 'junction': return 20;
    default: return [50, 30];
  }
}

// ============== 3. Скругление узлов ==============
function getNodeRadius(type: string): number {
  switch (type) {
    case 'breaker': return 8;
    case 'load': return 4;
    case 'bus': return 12;
    case 'cabinet': return 12;
    default: return 0;
  }
}

// ============== 4. Базовые цвета узлов ==============
interface BaseNodeStyle {
  fill: string;
  stroke: string;
  lineWidth: number;
  labelFill: string;
  labelFontSize: number;
  labelFontWeight: 'bold' | 'normal' | 'bolder' | 'lighter';
}

function getBaseNodeStyle(type: string, isDark: boolean): BaseNodeStyle {
  const baseStyle: BaseNodeStyle = {
    fill: '#d1d5db',
    stroke: '#6b7280',
    lineWidth: 2,
    labelFill: '#000000',
    labelFontSize: 11,
    labelFontWeight: 'normal',
  };

  switch (type) {
    case 'source':
      return {
        fill: isDark ? '#1f2937' : '#fef9c3',
        stroke: '#15803d',
        lineWidth: 2,
        labelFill: '#000000',
        labelFontSize: 12,
        labelFontWeight: 'bold',
      };
    case 'breaker':
      return {
        fill: isDark ? '#1e293b' : '#ffffff',
        stroke: isDark ? '#64748b' : '#94a3b8',
        lineWidth: 2,
        labelFill: '#000000',
        labelFontSize: 11,
        labelFontWeight: 'normal',
      };
    case 'load':
      return {
        fill: '#e5e7eb',
        stroke: '#6b7280',
        lineWidth: 2,
        labelFill: '#000000',
        labelFontSize: 10,
        labelFontWeight: 'normal',
      };
    case 'meter':
      return {
        fill: '#bfdbfe',
        stroke: '#3b82f6',
        lineWidth: 2,
        labelFill: '#000000',
        labelFontSize: 9,
        labelFontWeight: 'normal',
      };
    case 'bus':
      return {
        fill: '#fde68a',
        stroke: '#d97706',
        lineWidth: 2,
        labelFill: '#000000',
        labelFontSize: 10,
        labelFontWeight: 'bold',
      };
    case 'cabinet':
      return {
        fill: isDark ? '#064e3b' : '#ecfdf5',
        stroke: '#059669',
        lineWidth: 3,
        labelFill: '#000000',
        labelFontSize: 11,
        labelFontWeight: 'bold',
      };
    case 'junction':
      return {
        fill: '#d1d5db',
        stroke: '#6b7280',
        lineWidth: 2,
        labelFill: '#000000',
        labelFontSize: 8,
        labelFontWeight: 'normal',
      };
    default:
      return baseStyle;
  }
}

// ============== 5. Применение статусов к узлу ==============
interface NodeStyle extends BaseNodeStyle {
  opacity: number;
  shadowColor?: string;
  shadowBlur?: number;
  badgeText?: string;
  badgePosition?: string;
  badgeFill?: string;
}

function applyStatusToNodeStyle(
  baseStyle: BaseNodeStyle,
  electricalStatus: ElectricalStatus,
  operationalStatus: OperationalStatus,
  hasConflict: boolean
): NodeStyle {
  const result: NodeStyle = { ...baseStyle, opacity: 1.0 };

  // Приоритет: OFF > DOUBLE_FEED > DEAD > LIVE

  // 1. OFF - применяется ВСЕГДА
  if (operationalStatus === 'OFF') {
    return {
      ...baseStyle,
      stroke: '#ef4444',
      lineWidth: 3,
      opacity: 0.35,
      badgeText: '●',
      badgePosition: 'topRight',
      badgeFill: '#ef4444',
    };
  }

  // 2. DOUBLE_FEED (конфликт двойного питания)
  if (hasConflict) {
    return {
      ...baseStyle,
      stroke: '#f97316',
      lineWidth: 3,
      opacity: 1.0,
      shadowColor: 'rgba(249,115,22,0.6)',
      shadowBlur: 12,
      badgeText: '⚠',
      badgePosition: 'topRight',
      badgeFill: '#f97316',
    };
  }

  // 3. DEAD
  if (electricalStatus !== 'LIVE') {
    return {
      ...baseStyle,
      fill: '#374151',
      stroke: '#6b7280',
      opacity: 0.5,
    };
  }

  // 4. LIVE
  return {
    ...baseStyle,
    stroke: '#22c55e',
    opacity: 1.0,
  };
}

// ============== 6. Стили рёбер ==============
function getEdgeStyle(
  isDark: boolean,
  electricalStatus: ElectricalStatus,
  operationalStatus: OperationalStatus
): Record<string, unknown> {
  // OFF связь
  if (operationalStatus === 'OFF') {
    return {
      stroke: '#ef4444',
      lineWidth: 2,
      opacity: 0.6,
      lineDash: [6, 4],
      endArrow: true,
      endArrowSize: 8,
    };
  }

  // LIVE связь
  if (electricalStatus === 'LIVE') {
    return {
      stroke: '#22c55e',
      lineWidth: 2,
      opacity: 0.8,
      endArrow: true,
      endArrowSize: 8,
    };
  }

  // DEAD связь
  return {
    stroke: isDark ? '#4b5563' : '#6b7280',
    lineWidth: 1,
    opacity: 0.3,
    endArrow: true,
    endArrowSize: 8,
  };
}

// ============== Основной компонент ==============
export default function NetworkGraphInner({ data, isDark = false, onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const selectedNodeRef = useRef<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const handleClick = useCallback((nodeId: string) => {
    onNodeClick?.(nodeId);
  }, [onNodeClick]);

  useEffect(() => {
    if (!data?.elements?.length) {
      setStatus('loading');
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) {
      return;
    }

    // Уничтожаем старый граф
    if (graphRef.current) {
      try { graphRef.current.destroy(); } catch { /* ignore */ }
      graphRef.current = null;
    }

    const conflictIds = new Set(data.conflictElementIds || []);

    // Проверяем, есть ли рассчитанные позиции
    const hasPositions = data.elements.some(e => e.posX != null && e.posY != null);

    // Создаём узлы
    const nodes = data.elements.map(e => {
      const baseStyle = getBaseNodeStyle(e.type, isDark);
      const hasConflict = conflictIds.has(e.id);
      const nodeStyle = applyStatusToNodeStyle(
        baseStyle,
        e.electricalStatus,
        e.operationalStatus,
        hasConflict
      );

      const node: any = {
        id: e.id,
        data: {
          label: (e.name || e.elementId || e.id).substring(0, 20),
          nodeType: e.type,
          electricalStatus: e.electricalStatus,
          operationalStatus: e.operationalStatus,
          hasConflict,
          ...nodeStyle,
        },
      };

      // Добавляем позицию если есть
      if (e.posX != null && e.posY != null) {
        node.style = {
          ...node.style,
          x: e.posX,
          y: e.posY,
        };
      }

      return node;
    });

    // Создаём рёбра с ортогональной маршрутизацией
    const ids = new Set(data.elements.map(e => e.id));
    const edges = data.connections
      .filter(c => ids.has(c.sourceId) && ids.has(c.targetId))
      .map((c, i) => {
        const edgeStyle = getEdgeStyle(isDark, c.electricalStatus, c.operationalStatus);
        return {
          id: `edge-${i}`,
          source: c.sourceId,
          target: c.targetId,
          data: {
            electricalStatus: c.electricalStatus,
            operationalStatus: c.operationalStatus,
          },
          style: {
            ...edgeStyle,
            // Ортогональная маршрутизация
            type: 'orthogonal',
            router: {
              type: 'orth',
              offset: 20,
            },
          },
        };
      });

    // Добавляем узлы для границ Cabinet (прямоугольники пунктиром)
    const cabinetBounds = data.cabinetBounds || [];
    const cabinetNodes = cabinetBounds.map((cb, i) => ({
      id: `cabinet-bound-${i}`,
      data: {
        label: cb.name,
        nodeType: 'cabinet-bound',
      },
      style: {
        x: cb.x + cb.width / 2,
        y: cb.y + cb.height / 2,
        size: [cb.width, cb.height],
        fill: 'transparent',
        stroke: '#374151',
        lineWidth: 1,
        lineDash: [8, 4],
        opacity: 0.6,
        labelFill: '#6b7280',
        labelFontSize: 10,
        labelPlacement: 'top',
        labelOffsetY: -cb.height / 2 - 5,
        zIndex: -1,
      },
    }));

    try {
      // Конфигурация графа
      const graphConfig: any = {
        container,
        width: rect.width,
        height: rect.height,
        data: { nodes: [...cabinetNodes, ...nodes], edges },
        autoFit: 'view',
        padding: [50, 50, 50, 50],
        behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
        transforms: ['process-parallel-edges'],
      };

      // Если есть рассчитанные позиции - используем их, иначе dagre layout
      if (hasPositions) {
        graphConfig.layout = false;
      } else {
        graphConfig.layout = {
          type: 'dagre',
          rankdir: 'TB',
          nodesep: 60,
          ranksep: 80,
          controlPoints: true,
        };
      }

      const graph = new Graph({
        ...graphConfig,
        node: {
          type: (m: { data?: { nodeType?: string } }) => {
            const nodeType = m.data?.nodeType || '';
            if (nodeType === 'cabinet-bound') return 'rect';
            return getNodeShape(nodeType);
          },
          style: {
            size: (m: { data?: { nodeType?: string }; style?: { size?: number | [number, number] } }) => {
              const nodeType = m.data?.nodeType || '';
              if (nodeType === 'cabinet-bound') {
                return m.style?.size || [200, 150];
              }
              return getNodeSize(nodeType);
            },
            fill: (m: { data?: { fill?: string }; style?: { fill?: string } }) => {
              if (m.style?.fill !== undefined) return m.style.fill;
              return m.data?.fill || '#d1d5db';
            },
            stroke: (m: { data?: { stroke?: string }; style?: { stroke?: string } }) => {
              if (m.style?.stroke !== undefined) return m.style.stroke;
              return m.data?.stroke || '#6b7280';
            },
            lineWidth: (m: { data?: { lineWidth?: number }; style?: { lineWidth?: number } }) => {
              if (m.style?.lineWidth !== undefined) return m.style.lineWidth;
              return m.data?.lineWidth || 2;
            },
            opacity: (m: { data?: { opacity?: number }; style?: { opacity?: number } }) => {
              if (m.style?.opacity !== undefined) return m.style.opacity;
              return m.data?.opacity || 1;
            },
            lineDash: (m: { style?: { lineDash?: number[] } }) => {
              return m.style?.lineDash || [];
            },
            radius: (m: { data?: { nodeType?: string } }) => {
              return getNodeRadius(m.data?.nodeType || '');
            },
            shadowColor: (m: { data?: { shadowColor?: string } }) => m.data?.shadowColor,
            shadowBlur: (m: { data?: { shadowBlur?: number } }) => m.data?.shadowBlur,
            labelText: (m: { data?: { label?: string } }) => m.data?.label || '',
            labelFontSize: (m: { data?: { labelFontSize?: number }; style?: { labelFontSize?: number } }) => {
              return m.style?.labelFontSize || m.data?.labelFontSize || 11;
            },
            labelFill: (m: { data?: { labelFill?: string }; style?: { labelFill?: string } }) => {
              return m.style?.labelFill || m.data?.labelFill || '#374151';
            },
            labelFontWeight: (m: { data?: { labelFontWeight?: 'bold' | 'normal' | 'bolder' | 'lighter' } }) => m.data?.labelFontWeight || 'normal',
            labelPlacement: (m: { data?: { nodeType?: string }; style?: { labelPlacement?: string } }) => {
              if (m.style?.labelPlacement) return m.style.labelPlacement;
              return m.data?.nodeType === 'junction' ? 'center' : 'bottom';
            },
            labelOffsetY: (m: { data?: { nodeType?: string }; style?: { labelOffsetY?: number } }) => {
              if (m.style?.labelOffsetY !== undefined) return m.style.labelOffsetY;
              return m.data?.nodeType === 'junction' ? 0 : 6;
            },
            labelFontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
            badgeText: (m: { data?: { badgeText?: string } }) => m.data?.badgeText,
            badgePosition: (m: { data?: { badgePosition?: string } }) => m.data?.badgePosition,
            badgeFill: (m: { data?: { badgeFill?: string } }) => m.data?.badgeFill,
            badgeFontSize: 14,
            zIndex: (m: { data?: { nodeType?: string } }) => {
              return m.data?.nodeType === 'cabinet-bound' ? -1 : 0;
            },
          },
        },
        edge: {
          type: 'polyline',
          style: {
            stroke: '#9ca3af',
            lineWidth: 2,
            opacity: 0.8,
            endArrow: true,
            endArrowSize: 8,
            router: {
              type: 'orth',
              offset: 20,
            },
          },
        },
      });

      graphRef.current = graph;

      // Клик по узлу - выделение
      graph.on('node:click', (evt: any) => {
        if (graphRef.current !== graph) return;
        
        const clickedId = evt.itemId;
        if (!clickedId || clickedId.startsWith('cabinet-bound-')) return;

        handleClick(clickedId);

        // Снимаем выделение с предыдущего
        if (selectedNodeRef.current && selectedNodeRef.current !== clickedId) {
          const prevNode = data.elements.find(e => e.id === selectedNodeRef.current);
          if (prevNode) {
            const baseStyle = getBaseNodeStyle(prevNode.type, isDark);
            const hasConflict = conflictIds.has(prevNode.id);
            const nodeStyle = applyStatusToNodeStyle(
              baseStyle,
              prevNode.electricalStatus,
              prevNode.operationalStatus,
              hasConflict
            );
            try {
              graph.updateNodeData([{
                id: selectedNodeRef.current,
                style: {
                  stroke: nodeStyle.stroke,
                  lineWidth: nodeStyle.lineWidth,
                  shadowColor: undefined,
                  shadowBlur: undefined,
                },
              }]);
            } catch { /* graph destroyed */ }
          }
        }

        // Выделяем текущий
        try {
          graph.updateNodeData([{
            id: clickedId,
            style: {
              stroke: '#3b82f6',
              lineWidth: 4,
              shadowColor: 'rgba(59,130,246,0.4)',
              shadowBlur: 10,
            },
          }]);
        } catch { /* graph destroyed */ }

        selectedNodeRef.current = clickedId;
      });

      // Клик по канвасу - снять выделение
      graph.on('canvas:click', () => {
        if (graphRef.current !== graph) return;
        
        if (selectedNodeRef.current) {
          const prevNode = data.elements.find(e => e.id === selectedNodeRef.current);
          if (prevNode) {
            const baseStyle = getBaseNodeStyle(prevNode.type, isDark);
            const hasConflict = conflictIds.has(prevNode.id);
            const nodeStyle = applyStatusToNodeStyle(
              baseStyle,
              prevNode.electricalStatus,
              prevNode.operationalStatus,
              hasConflict
            );
            try {
              graph.updateNodeData([{
                id: selectedNodeRef.current,
                style: {
                  stroke: nodeStyle.stroke,
                  lineWidth: nodeStyle.lineWidth,
                  shadowColor: undefined,
                  shadowBlur: undefined,
                },
              }]);
            } catch { /* graph destroyed */ }
          }
          selectedNodeRef.current = null;
        }
      });

      graph.render()
        .then(() => {
          if (graphRef.current === graph) {
            setStatus('ready');
            setTimeout(() => {
              if (graphRef.current === graph) {
                graph.fitView?.();
              }
            }, 600);
          }
        })
        .catch(() => setStatus('error'));

    } catch {
      setStatus('error');
    }

    return () => {
      if (graphRef.current) {
        try { graphRef.current.destroy(); } catch { /* ignore */ }
        graphRef.current = null;
      }
    };
  }, [data, isDark, handleClick]);

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (graphRef.current && width > 10 && height > 10) {
          try {
            graphRef.current.resize?.(width, height);
            graphRef.current.fitView?.();
          } catch { /* ignore */ }
        }
      }
    });

    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Статистика
  const stats = {
    live: data?.elements?.filter(e => e.operationalStatus === 'ON' && e.electricalStatus === 'LIVE').length || 0,
    dead: data?.elements?.filter(e => e.electricalStatus === 'DEAD').length || 0,
    off: data?.elements?.filter(e => e.operationalStatus === 'OFF').length || 0,
    conflicts: data?.conflictElementIds?.length || 0,
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
        <div className="absolute top-2 left-2 z-10 px-3 py-1.5 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow text-xs font-medium text-green-600 dark:text-green-400">
          ✓ {data.elements.length} узлов, {data.connections.length} связей
        </div>
      )}

      {/* Легенда */}
      <div className="absolute top-2 right-2 z-10 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-md p-2 text-[10px]">
        {/* Статусы узлов */}
        <div className="mb-1.5 pb-1.5 border-b border-gray-200 dark:border-gray-700">
          <div className="text-[9px] text-gray-400 mb-1">Узлы:</div>
          <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 border border-green-600"></span>
              <span className="text-gray-600 dark:text-gray-400">LIVE</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400 border border-gray-500 opacity-50"></span>
              <span className="text-gray-600 dark:text-gray-400">DEAD</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-300 border border-red-500 opacity-35"></span>
              <span className="text-red-500">OFF</span>
            </div>
          </div>
        </div>

        {/* Конфликты */}
        {stats.conflicts > 0 && (
          <div className="mb-1.5 pb-1.5 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1">
              <span className="text-orange-500 font-bold text-xs">⚠</span>
              <span className="text-orange-500">Двойное питание ({stats.conflicts})</span>
            </div>
          </div>
        )}

        {/* Связи */}
        <div>
          <div className="text-[9px] text-gray-400 mb-1">Связи:</div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-green-500"></div>
              <span className="text-gray-600 dark:text-gray-400">LIVE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-gray-400 opacity-50"></div>
              <span className="text-gray-600 dark:text-gray-400">DEAD</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-red-500" style={{ background: 'repeating-linear-gradient(90deg, #ef4444, #ef4444 2px, transparent 2px, transparent 4px)' }}></div>
              <span className="text-gray-600 dark:text-gray-400">OFF</span>
            </div>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

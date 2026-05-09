'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Graph } from '@antv/g6';

interface NetworkData {
  elements: Array<{
    id: string;
    elementId: string;
    name: string;
    type: string;
    posX?: number | null;
    posY?: number | null;
    electricalStatus?: string;
    operationalStatus?: string;
  }>;
  connections: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    electricalStatus?: string;
    operationalStatus?: string;
    source: { elementId: string; name: string; type: string };
    target: { elementId: string; name: string; type: string };
  }>;
}

interface NetworkGraphProps {
  data: NetworkData | null;
  onNodeClick?: (nodeId: string) => void;
}

// ============================================================================
// БАЗОВЫЕ СТИЛИ УЗЛОВ ПО ТИПУ
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getBaseNodeStyle(type: string, isDark: boolean): Record<string, any> {
  switch (type) {
    case 'source':
      return {
        size: [70, 50],
        fill: isDark ? '#1f2937' : '#fef9c3',
        stroke: '#15803d',
        lineWidth: 2,
        labelFill: isDark ? '#fbbf24' : '#15803d',
        labelFontSize: 12,
        labelFontWeight: 'bold' as const,
      };
    case 'breaker':
      return {
        size: [50, 34],
        fill: isDark ? '#1e293b' : '#ffffff',
        stroke: isDark ? '#64748b' : '#94a3b8',
        lineWidth: 2,
        radius: 8,
        labelFill: isDark ? '#f8fafc' : '#1e2937',
      };
    case 'load':
      return {
        size: [60, 36],
        fill: isDark ? '#1f2937' : '#111827',
        stroke: isDark ? '#374151' : '#6b7280',
        lineWidth: 2,
        radius: 4,
        labelFill: '#f9fafb',
        labelFontSize: 10,
      };
    case 'meter':
      return {
        size: [44, 44],
        fill: '#3b82f6',
        stroke: '#1d4ed8',
        lineWidth: 2,
        labelFill: '#ffffff',
        labelFontSize: 9,
      };
    case 'bus':
      return {
        size: [120, 24],
        fill: '#d97706',
        stroke: '#b45309',
        lineWidth: 2,
        radius: 12,
        labelFill: '#ffffff',
        labelFontSize: 10,
        labelFontWeight: 'bold' as const,
      };
    case 'cabinet':
      return {
        size: [80, 50],
        fill: isDark ? '#064e3b' : '#ecfdf5',
        stroke: '#059669',
        lineWidth: 3,
        radius: 12,
        labelFill: isDark ? '#6ee7b7' : '#065f46',
        labelFontSize: 11,
        labelFontWeight: 'bold' as const,
      };
    case 'junction':
      return {
        size: 20,
        fill: '#9ca3af',
        stroke: '#6b7280',
        lineWidth: 2,
        labelFill: '#ffffff',
        labelFontSize: 8,
      };
    default:
      return {
        size: [50, 30],
        fill: isDark ? '#374151' : '#e5e7eb',
        stroke: isDark ? '#6b7280' : '#9ca3af',
        lineWidth: 1,
      };
  }
}

function getNodeShape(type: string): 'octagon' | 'diamond' | 'circle' | 'rect' {
  switch (type) {
    case 'source': return 'octagon';
    case 'meter': return 'diamond';
    case 'junction': return 'circle';
    default: return 'rect';
  }
}

// ============================================================================
// ПРИМЕНЕНИЕ ЭЛЕКТРИЧЕСКОГО И ОПЕРАТИВНОГО СТАТУСА К СТИЛЯМ УЗЛА
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyStatusToNodeStyle(baseStyle: Record<string, any>, electricalStatus: string | undefined, operationalStatus: string | undefined): Record<string, any> {
  const style = { ...baseStyle };
  const isLive = electricalStatus === 'LIVE';
  const isOff = operationalStatus === 'OFF';

  if (isOff) {
    // OFF overlay: красная подсветка, пониженная прозрачность
    style.stroke = '#ef4444';
    style.lineWidth = 3;
    style.opacity = 0.35;
    // Добавляем красный маркер через badge
    style.badge = {
      text: '\u25CF', // красный круг
      position: 'topRight' as const,
      color: '#ef4444',
      size: [16, 16],
    };
  } else if (!isLive) {
    // DEAD: серый, полупрозрачный
    style.fill = '#374151';
    style.stroke = '#6b7280';
    style.opacity = 0.5;
  } else {
    // LIVE: зелёная обводка
    style.stroke = '#22c55e';
    style.opacity = 1.0;
  }

  return style;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyStatusToEdgeStyle(isDark: boolean, electricalStatus: string | undefined, operationalStatus: string | undefined): Record<string, any> {
  const isLive = electricalStatus === 'LIVE';
  const isOff = operationalStatus === 'OFF';

  if (isOff) {
    return {
      stroke: '#ef4444',
      lineWidth: 2,
      lineDash: [6, 4],
      opacity: 0.6,
      endArrow: true,
      endArrowSize: 8,
    };
  } else if (isLive) {
    return {
      stroke: '#22c55e',
      lineWidth: 2,
      opacity: 0.8,
      endArrow: true,
      endArrowSize: 8,
    };
  } else {
    // DEAD
    return {
      stroke: '#6b7280',
      lineWidth: 1,
      opacity: 0.3,
      endArrow: true,
      endArrowSize: 8,
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clearSelection(graph: any, prevSelectedId: string | null) {
  if (!prevSelectedId) return;
  const nodeData = graph.getNodeData([prevSelectedId]);
  if (nodeData && nodeData.length > 0) {
    const node = nodeData[0];
    graph.updateNodeData([{ id: prevSelectedId, style: node.style }]);
  }
}

export default function NetworkGraph({ data, onNodeClick }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const selectedNodeRef = useRef<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;

  useEffect(() => {
    if (!containerRef.current || !data || data.elements.length === 0) return;

    if (graphRef.current) {
      graphRef.current.destroy();
      graphRef.current = null;
    }

    const textColor = isDark ? '#e5e7eb' : '#374151';

    // Подготовка узлов с учётом статусов
    const nodes = data.elements.map((el) => {
      const nodeType = (el.type || '').toLowerCase();
      const baseStyle = getBaseNodeStyle(nodeType, isDark);
      const statusStyle = applyStatusToNodeStyle(
        baseStyle,
        el.electricalStatus,
        el.operationalStatus
      );

      return {
        id: el.id,
        data: {
          label: el.name || el.elementId,
          type: nodeType,
          electricalStatus: el.electricalStatus,
          operationalStatus: el.operationalStatus,
        },
        style: {
          ...statusStyle,
          shape: getNodeShape(nodeType),
          labelText: el.name || el.elementId,
          labelPlacement: (nodeType === 'junction' ? 'center' : 'bottom') as 'top' | 'bottom' | 'left' | 'right' | 'center',
          labelOffsetY: nodeType === 'junction' ? 0 : 6,
          labelFill: statusStyle.labelFill || textColor,
          labelFontSize: statusStyle.labelFontSize || 11,
          labelFontWeight: statusStyle.labelFontWeight || 'normal',
          labelFontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
        },
      };
    });

    // Подготовка рёбер с учётом статусов
    const edges = data.connections.map((conn) => {
      const edgeStyle = applyStatusToEdgeStyle(
        isDark,
        conn.electricalStatus,
        conn.operationalStatus
      );

      return {
        id: `edge-${conn.id}`,
        source: conn.sourceId,
        target: conn.targetId,
        style: edgeStyle,
      };
    });

    const rect = containerRef.current.getBoundingClientRect();
    const containerW = rect.width || window.innerWidth;
    const containerH = rect.height || (window.innerHeight - 50);

    const graph = new Graph({
      container: containerRef.current,
      width: containerW,
      height: containerH,
      autoFit: 'view',
      padding: [50, 50, 50, 50],
      node: {
        style: {
          size: [50, 30],
          labelText: (d: any) => d.data?.label || '',
          labelPlacement: 'bottom',
          labelFill: textColor,
          labelFontSize: 11,
        },
      },
      edge: {
        style: {
          stroke: isDark ? '#4b5563' : '#9ca3af',
          lineWidth: 2,
          endArrow: true,
          endArrowSize: 8,
        },
      },
      layout: {
        type: 'dagre',
        rankdir: 'TB',
        nodesep: 60,
        ranksep: 80,
        controlPoints: true,
      },
      behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
      transforms: ['process-parallel-edges'],
    });

    graph.addData({ nodes, edges });
    graph.render();

    // Подгонка после рендера
    setTimeout(() => {
      graph.fitView();
    }, 600);

    // Клик по узлу — выделение + callback
    graph.on('node:click', (evt: any) => {
      const clickedId = evt.target.id;

      // Снимаем выделение с предыдущего
      if (selectedNodeRef.current && selectedNodeRef.current !== clickedId) {
        clearSelection(graph, selectedNodeRef.current);
      }

      // Выделяем текущий
      selectedNodeRef.current = clickedId;
      graph.updateNodeData([{
        id: clickedId,
        style: {
          stroke: '#3b82f6',
          lineWidth: 4,
          shadowColor: 'rgba(59,130,246,0.4)',
          shadowBlur: 10,
        },
      }]);

      if (onNodeClickRef.current) onNodeClickRef.current(clickedId);
    });

    // Клик по канвасу — снять выделение
    graph.on('canvas:click', () => {
      if (selectedNodeRef.current) {
        clearSelection(graph, selectedNodeRef.current);
        selectedNodeRef.current = null;
      }
    });

    // Ресайз
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setTimeout(() => {
            graph.resize(width, height);
            graph.fitView();
          }, 150);
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    graphRef.current = graph;
    selectedNodeRef.current = null;

    return () => {
      resizeObserver.disconnect();
      if (graphRef.current) {
        graphRef.current.destroy();
        graphRef.current = null;
      }
    };
  }, [data, isDark]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Загрузка данных сети...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Легенда */}
      <div className="absolute top-3 right-3 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 text-xs space-y-1.5 border border-gray-200 dark:border-gray-700">
        <div className="font-bold text-gray-700 dark:text-gray-300 mb-1">Легенда</div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded border-2 border-green-500 bg-green-100 dark:bg-green-900/30" />
          <span className="text-gray-600 dark:text-gray-400">LIVE — под напряжением</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded border-2 border-gray-500 bg-gray-300 dark:bg-gray-600 opacity-50" />
          <span className="text-gray-600 dark:text-gray-400">DEAD — без напряжения</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded border-2 border-red-500 bg-red-100 dark:bg-red-900/30 opacity-40" />
          <span className="text-gray-600 dark:text-gray-400">OFF — отключен</span>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-600 mt-2 pt-1.5">
          <div className="font-bold text-gray-700 dark:text-gray-300 mb-1">Связи</div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-6 h-0.5 bg-green-500" />
            <span className="text-gray-600 dark:text-gray-400">LIVE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-6 h-0.5 bg-gray-400 opacity-30" />
            <span className="text-gray-600 dark:text-gray-400">DEAD</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-6 h-0 bg-red-500 border-t-2 border-dashed border-red-500" />
            <span className="text-gray-600 dark:text-gray-400">OFF</span>
          </div>
        </div>
      </div>

      {/* Граф */}
      <div
        ref={containerRef}
        className="w-full h-full bg-white dark:bg-gray-900"
        style={{ zIndex: 0, minHeight: '400px' }}
      />
    </div>
  );
}

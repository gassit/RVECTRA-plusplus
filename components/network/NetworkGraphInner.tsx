'use client';

import { useEffect, useRef, useState } from 'react';
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

function getNodeShape(type: string): string {
  switch (type) {
    case 'source': return 'hexagon';
    case 'meter': return 'diamond';
    case 'junction': return 'circle';
    default: return 'rect';
  }
}

function getNodeSize(type: string): [number, number] {
  switch (type) {
    case 'source': return [70, 50];
    case 'breaker': return [50, 34];
    case 'load': return [60, 36];
    case 'meter': return [44, 44];
    case 'bus': return [120, 24];
    case 'cabinet': return [80, 50];
    case 'junction': return [16, 16];
    default: return [50, 30];
  }
}

function getNodeColors(type: string, electricalStatus: ElectricalStatus, operationalStatus: OperationalStatus, hasConflict: boolean) {
  let fill = '#d1d5db';
  let stroke = '#6b7280';
  let opacity = 1;

  switch (type) {
    case 'source': fill = '#fef9c3'; stroke = '#15803d'; break;
    case 'breaker': fill = '#ffffff'; stroke = '#94a3b8'; break;
    case 'load': fill = '#e5e7eb'; stroke = '#6b7280'; break;
    case 'meter': fill = '#bfdbfe'; stroke = '#3b82f6'; break;
    case 'bus': fill = '#fde68a'; stroke = '#d97706'; break;
    case 'cabinet': fill = '#ecfdf5'; stroke = '#059669'; break;
    case 'junction': fill = '#9ca3af'; stroke = '#6b7280'; break;
  }

  if (operationalStatus === 'OFF') {
    stroke = '#ef4444'; opacity = 0.35;
  } else if (hasConflict) {
    stroke = '#f97316';
  } else if (electricalStatus !== 'LIVE') {
    fill = '#374151'; stroke = '#6b7280'; opacity = 0.5;
  } else {
    stroke = '#22c55e';
  }

  return { fill, stroke, opacity };
}

function getEdgeColor(electricalStatus: ElectricalStatus, operationalStatus: OperationalStatus): string {
  if (operationalStatus === 'OFF') return '#ef4444';
  if (electricalStatus === 'LIVE') return '#22c55e';
  return '#6b7280';
}

export default function NetworkGraphInner({ data, isDark = false, onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const isDraggingNode = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [graphReady, setGraphReady] = useState(false);

  // Initialize graph once on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initGraph = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) {
        setTimeout(initGraph, 100);
        return;
      }

      if (graphRef.current) return; // Already initialized

      try {
        const graph = new Graph({
          container,
          width: rect.width,
          height: rect.height,
          autoFit: 'view',
          padding: 50,
          behaviors: [
            {
              type: 'drag-canvas',
              enable: () => {
                // Отключаем drag-canvas если перетаскиваем узел
                return !isDraggingNode.current;
              }
            },
            { type: 'zoom-canvas', enable: true, minZoom: 0.25, maxZoom: 3, sensitivity: 1 },
            { type: 'drag-element', enable: true },
            { type: 'collapse-expand', enable: true },
          ],
          node: {
            type: (m: any) => getNodeShape(m.data?.nodeType || ''),
            style: {
              size: (m: any) => m.data?.size || [50, 30],
              fill: (m: any) => m.data?.fill || '#d1d5db',
              stroke: (m: any) => m.data?.stroke || '#6b7280',
              lineWidth: 2,
              opacity: (m: any) => m.data?.opacity ?? 1,
              labelText: (m: any) => m.data?.label || '',
              labelFontSize: 10,
              labelFill: '#374151',
            },
          },
          edge: {
            type: 'line',
            style: { stroke: '#9ca3af', lineWidth: 2, endArrow: true },
          },
          combo: {
            type: 'rect',
            style: {
              fill: '#f0fdf4',
              stroke: '#22c55e',
              lineWidth: 2,
              lineDash: [5, 5],
              opacity: 0.3,
              labelText: (m: any) => m.data?.label || '',
              labelFontSize: 12,
              labelFill: '#166534',
              labelPosition: 'top-left',
              padding: [30, 20, 20, 20],
            },
          },
        });

        graph.on('node:click', (evt: any) => {
          const id = evt.itemId;
          if (id && !id.startsWith('cabinet-bound-')) {
            onNodeClick?.(id);
          }
        });

        // Отслеживаем перетаскивание узла
        graph.on('node:pointerdown', () => {
          isDraggingNode.current = true;
        });

        graph.on('node:pointerup', () => {
          isDraggingNode.current = false;
        });

        graph.on('node:dragend', () => {
          isDraggingNode.current = false;
        });

        // Также сбрасываем при уходе курсора
        graph.on('canvas:pointerup', () => {
          isDraggingNode.current = false;
        });

        graph.on('viewport:zoom', () => {
          try {
            const g = graphRef.current;
            if (g && !(g as any).destroyed) {
              setZoom(Math.round(g.getZoom() * 100) / 100);
            }
          } catch {}
        });

        graphRef.current = graph;
        setGraphReady(true);
        console.log('[G6] Graph initialized');
      } catch (e) {
        console.error('[G6] Init error:', e);
      }
    };

    initGraph();

    return () => {
      const g = graphRef.current;
      if (g) {
        try { g.off(); } catch {}
        try { g.destroy(); } catch {}
        graphRef.current = null;
        setGraphReady(false);
        console.log('[G6] Graph destroyed');
      }
    };
  }, [onNodeClick]);

  // Update data when data prop changes
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !graphReady || !data?.elements?.length) return;
    if ((graph as any).destroyed) return;

    console.log('[G6] Updating data:', data.elements.length, 'elements');

    const conflictIds = new Set(data.conflictElementIds || []);
    const hasPositions = data.elements.some(e => e.posX != null);

    // Build nodes with combo assignment
    const cabinetElements = data.elements.filter(e => e.type.toLowerCase() === 'cabinet');
    const cabinetMap = new Map(cabinetElements.map(c => [c.id, c]));
    
    const nodes: any[] = data.elements
      .filter(e => e.type.toLowerCase() !== 'cabinet') // Exclude cabinet elements from nodes
      .map(e => {
        const colors = getNodeColors(e.type, e.electricalStatus, e.operationalStatus, conflictIds.has(e.id));
        const size = getNodeSize(e.type);
        
        const node: any = {
          id: e.id,
          data: {
            nodeType: e.type,
            label: e.name?.substring(0, 12) || e.id.substring(0, 8),
            size: size,
            fill: colors.fill,
            stroke: colors.stroke,
            opacity: colors.opacity,
          },
        };
        
        // Assign to combo if has parentId (cabinet)
        if (e.parentId && cabinetMap.has(e.parentId)) {
          node.combo = e.parentId;
        }
        
        if (e.posX != null && e.posY != null) {
          node.x = e.posX;
          node.y = e.posY;
        }
        
        return node;
      });

    // Build combos from cabinet elements
    const combos: any[] = cabinetElements.map(c => {
      const colors = getNodeColors('cabinet', c.electricalStatus, c.operationalStatus, false);
      return {
        id: c.id,
        data: {
          label: c.name?.substring(0, 20) || c.id.substring(0, 8),
          fill: colors.fill,
          stroke: colors.stroke,
          opacity: 0.3,
        },
      };
    });

    // Build edges
    const ids = new Set(data.elements.map(e => e.id));
    const edges: any[] = data.connections
      .filter(c => ids.has(c.sourceId) && ids.has(c.targetId))
      .map((c, i) => ({
        id: `edge-${i}`,
        source: c.sourceId,
        target: c.targetId,
        data: { stroke: getEdgeColor(c.electricalStatus, c.operationalStatus) },
      }));

    setNodeCount(nodes.length);
    setEdgeCount(edges.length);

    console.log('[G6] Nodes:', nodes.length, 'Edges:', edges.length, 'Combos:', combos.length);

    try {
      graph.clear();
      graph.setData({ nodes, edges, combos });
      
      if (!hasPositions) {
        graph.setLayout({ type: 'dagre', rankdir: 'TB', nodesep: 60, ranksep: 80 } as any);
      }
      
      graph.render().then(() => {
        console.log('[G6] Render complete');
        setTimeout(() => {
          const g = graphRef.current;
          if (g && !(g as any).destroyed) {
            try {
              g.fitView();
              setZoom(g.getZoom());
            } catch (e) {
              console.error('[G6] fitView error:', e);
            }
          }
        }, 100);
      }).catch((e: any) => {
        console.error('[G6] Render error:', e);
      });
    } catch (e) {
      console.error('[G6] Data update error:', e);
    }
  }, [data, isDark, graphReady]);

  // Resize handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let timeout: NodeJS.Timeout;
    const observer = new ResizeObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const g = graphRef.current;
        if (g && !(g as any).destroyed) {
          const rect = container.getBoundingClientRect();
          if (rect.width > 10 && rect.height > 10) {
            try {
              g.resize(rect.width, rect.height);
              g.fitView();
            } catch {}
          }
        }
      }, 150);
    });

    observer.observe(container);
    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, []);

  // Zoom controls
  const handleZoomIn = () => {
    const g = graphRef.current;
    if (!g || (g as any).destroyed) return;
    const newZoom = Math.min(zoom * 1.2, 4);
    setZoom(newZoom);
    try {
      const result = g.zoomTo(newZoom);
      if (result?.catch) result.catch(() => {});
    } catch {}
  };

  const handleZoomOut = () => {
    const g = graphRef.current;
    if (!g || (g as any).destroyed) return;
    const newZoom = Math.max(zoom / 1.2, 0.1);
    setZoom(newZoom);
    try {
      const result = g.zoomTo(newZoom);
      if (result?.catch) result.catch(() => {});
    } catch {}
  };

  const handleFitView = () => {
    const g = graphRef.current;
    if (!g || (g as any).destroyed) return;
    try {
      const result = g.fitView();
      if (result?.catch) result.catch(() => {});
      setZoom(g.getZoom());
    } catch {}
  };

  const handleResetZoom = () => {
    const g = graphRef.current;
    if (!g || (g as any).destroyed) return;
    setZoom(1);
    try {
      const result = g.zoomTo(1);
      if (result?.catch) result.catch(() => {});
    } catch {}
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
      {/* Status badge */}
      {nodeCount > 0 && (
        <div className="absolute top-2 left-2 z-10 px-3 py-1.5 bg-white/95 dark:bg-gray-800/95 rounded-lg shadow text-xs font-medium text-green-600">
          ✓ {nodeCount} узлов, {edgeCount} связей
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 bg-white/95 dark:bg-gray-800/95 rounded-lg shadow-lg p-1">
        <button onClick={handleZoomIn} className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors" title="Увеличить">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        
        <button onClick={handleZoomOut} className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors" title="Уменьшить">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        
        <div className="h-px bg-gray-200 dark:bg-gray-600 my-1" />
        
        <button onClick={handleResetZoom} className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors" title="100%">
          <span className="text-xs font-medium">{Math.round(zoom * 100)}%</span>
        </button>
        
        <button onClick={handleFitView} className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors" title="По размеру">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>

      {/* Gesture hint */}
      <div className="absolute bottom-2 right-2 z-10 px-2 py-1 bg-black/50 rounded text-xs text-white/70">
        🖱️ Перетаскивание • 🔄 Колесо для зума
      </div>

      {/* Graph container */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

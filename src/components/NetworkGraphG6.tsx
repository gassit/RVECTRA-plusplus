'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Graph } from '@antv/g6';
import type { GraphData, GraphNode, GraphEdge, ElementType } from '@/types';

interface NetworkGraphG6Props {
  data: GraphData | null;
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onEmptyClick?: () => void;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  collapsedTypes?: Set<string>;
  onCollapsedTypesChange?: (types: Set<string>) => void;
  // Режим редактирования
  editMode?: boolean;
  selectedElementType?: ElementType | null;
  onCanvasClick?: (x: number, y: number) => void;
  onNodeDrop?: (nodeId: string, x: number, y: number) => void;
  // Режим создания связи
  connectionMode?: boolean;
  connectionStartId?: string | null;
  onConnectionCreated?: (sourceId: string, targetId: string) => void;
}

// ============================================================================
// КОНСТАНТЫ ДИЗАЙНА
// ============================================================================

// Цвета заголовков по типам элементов
const TYPE_COLORS: Record<string, { primary: string; gradient: string }> = {
  source: { primary: '#fbbf24', gradient: 'l(0) 0:#eab308 0.5:#22c55e 1:#ef4444' },
  bus: { primary: '#B87333', gradient: 'l(0) 0:#B87333 0.5:#CD7F32 1:#B87333' },
  junction: { primary: '#9ca3af', gradient: 'l(0) 0:#9ca3af 1:#6b7280' },
  breaker: { primary: '#1f2937', gradient: 'l(0) 0:#1f2937 1:#111827' },
  meter: { primary: '#3b82f6', gradient: 'l(0) 0:#3b82f6 1:#2563eb' },
  load: { primary: '#ffffff', gradient: 'l(0) 0:#ffffff 1:#f3f4f6' },
  cabinet: { primary: '#d97706', gradient: 'l(0) 0:#B87333 0.5:#CD7F32 1:#B87333' },
};

// ============================================================================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================================================================

export default function NetworkGraphG6({
  data,
  onNodeClick,
  onEdgeClick,
  onEmptyClick,
  selectedNodeId,
  selectedEdgeId,
  zoom: externalZoom,
  onZoomChange,
  editMode = false,
  selectedElementType,
  onCanvasClick,
  onNodeDrop,
  connectionMode = false,
  onConnectionCreated,
}: NetworkGraphG6Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [pendingConnectionStart, setPendingConnectionStart] = useState<string | null>(null);

  // Refs для актуальных значений режимов (чтобы не пересоздавать граф)
  const editModeRef = useRef(editMode);
  const connectionModeRef = useRef(connectionMode);
  const selectedElementTypeRef = useRef(selectedElementType);
  const pendingConnectionRef = useRef<string | null>(null);

  // Обновляем refs при изменении props
  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);

  useEffect(() => {
    connectionModeRef.current = connectionMode;
  }, [connectionMode]);

  useEffect(() => {
    selectedElementTypeRef.current = selectedElementType;
  }, [selectedElementType]);

  useEffect(() => {
    pendingConnectionRef.current = pendingConnectionStart;
  }, [pendingConnectionStart]);

  // Инициализация графа (только один раз)
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Создаём граф G6
    const graph = new Graph({
      container,
      width,
      height,
      autoFit: 'view',
      padding: [100, 100, 100, 100],
      behaviors: [
        'drag-canvas',
        'zoom-canvas',
        {
          type: 'click-select',
          trigger: 'click',
          multiple: false,
        },
        {
          type: 'collapse-expand',
          trigger: 'dblclick',
        },
        // Drag element - включаем всегда, но управляем через enable
        {
          type: 'drag-element',
          enable: () => editModeRef.current && !connectionModeRef.current,
        },
      ],
      layout: {
        type: 'dagre',
        rankdir: 'TB',
        nodesep: 60,
        ranksep: 100,
        preventOverlap: true,
        nodeSize: [160, 80],
      },
      node: {
        type: 'rect',
        style: {
          size: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            if (nodeType === 'cabinet') {
              return [180, 40];
            }
            return [160, 80];
          },
          radius: 6,
          fill: '#ffffff',
          stroke: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            const hasCritical = d.data?.criticalIssues > 0;
            if (hasCritical) return '#ef4444';
            return TYPE_COLORS[nodeType]?.primary || '#e2e8f0';
          },
          lineWidth: 2,
          shadowColor: 'rgba(0, 0, 0, 0.15)',
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowOffsetY: 4,
          cursor: 'pointer',
          // Основной текст - название
          labelText: (d: any) => {
            const name = d.data?.name || d.id;
            const nodeType = (d.data?.type || 'load').toLowerCase();
            if (nodeType === 'cabinet') {
              return name.length > 14 ? name.slice(0, 14) + '...' : name;
            }
            return name.length > 18 ? name.slice(0, 18) + '...' : name;
          },
          labelFill: '#000000',
          labelFontSize: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            return nodeType === 'cabinet' ? 17 : 12;
          },
          labelFontWeight: 'bold',
          labelPlacement: 'center',
          labelOffsetY: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            return nodeType === 'cabinet' ? 0 : -15;
          },
          labelMaxWidth: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            return nodeType === 'cabinet' ? 160 : 140;
          },
        },
        state: {
          selected: {
            stroke: '#3b82f6',
            lineWidth: 4,
            shadowColor: 'rgba(59, 130, 246, 0.4)',
            shadowBlur: 20,
          },
          hover: {
            stroke: '#60a5fa',
            lineWidth: 3,
            shadowColor: 'rgba(96, 165, 250, 0.3)',
            shadowBlur: 15,
          },
          // Состояние для начала связи
          connectionSource: {
            stroke: '#22c55e',
            lineWidth: 4,
            shadowColor: 'rgba(34, 197, 94, 0.5)',
            shadowBlur: 20,
          },
          // Состояние для потенциальной цели связи
          connectionTarget: {
            stroke: '#f59e0b',
            lineWidth: 3,
            shadowColor: 'rgba(245, 158, 11, 0.4)',
            shadowBlur: 15,
          },
        },
      },
      edge: {
        type: 'cubic-vertical',
        style: {
          stroke: (d: any) => {
            const lifeStatus = d.data?.lifeStatus;
            return lifeStatus === 'LIVE' ? '#22c55e' : '#94a3b8';
          },
          lineWidth: 2,
          endArrow: false,
          opacity: (d: any) => {
            const status = d.data?.status;
            return status === 'OFF' ? 0.4 : 1;
          },
          // Подпись кабеля
          labelText: (d: any) => {
            const wireType = d.data?.wireType;
            const wireSize = d.data?.wireSize;
            if (wireType && wireSize) {
              const length = d.data?.length;
              const text = `${wireType} ${wireSize}мм²`;
              return length ? `${text} ${length}м` : text;
            }
            return '';
          },
          labelFill: '#64748b',
          labelFontSize: 9,
          labelBackground: true,
          labelBackgroundFill: '#ffffff',
          labelBackgroundOpacity: 0.95,
          labelBackgroundRadius: 4,
          labelPadding: [2, 4, 2, 4],
        },
        state: {
          selected: {
            stroke: '#3b82f6',
            lineWidth: 4,
          },
          hover: {
            stroke: '#60a5fa',
            lineWidth: 3,
          },
        },
      },
    });

    graphRef.current = graph;

    // Обработчики событий
    graph.on('node:click', (evt: any) => {
      const nodeId = evt.target.id;
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;

      // В режиме создания связи - используем refs
      if (connectionModeRef.current) {
        const pending = pendingConnectionRef.current;
        if (!pending) {
          // Начинаем связь
          setPendingConnectionStart(nodeId);
          try {
            graph.setElementState(nodeId, 'connectionSource', true);
          } catch (e) {
            // Element may not exist
          }
        } else if (pending !== nodeId) {
          // Завершаем связь
          onConnectionCreated?.(pending, nodeId);
          try {
            graph.setElementState(pending, 'connectionSource', false);
          } catch (e) {
            // Element may not exist
          }
          setPendingConnectionStart(null);
        }
        return;
      }

      onNodeClick?.(nodeId);
    });

    graph.on('node:pointerenter', (evt: any) => {
      const nodeId = evt.target.id;
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;

      const nodeData = data?.nodes.find(n => n.id === nodeId);
      setHoveredNode(nodeData || null);

      // В режиме связи подсвечиваем потенциальную цель
      if (connectionModeRef.current && pendingConnectionRef.current && pendingConnectionRef.current !== nodeId) {
        try {
          graph.setElementState(nodeId, 'connectionTarget', true);
        } catch (e) {
          // Element may not exist
        }
      } else {
        try {
          graph.setElementState(nodeId, 'hover', true);
        } catch (e) {
          // Element may not exist
        }
      }
    });

    graph.on('node:pointerleave', (evt: any) => {
      setHoveredNode(null);
      const nodeId = evt.target.id;
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;

      if (connectionModeRef.current && pendingConnectionRef.current) {
        try {
          graph.setElementState(nodeId, 'connectionTarget', false);
        } catch (e) {
          // Element may not exist
        }
      } else {
        try {
          graph.setElementState(nodeId, 'hover', false);
        } catch (e) {
          // Element may not exist
        }
      }
    });

    graph.on('edge:click', (evt: any) => {
      const edgeId = evt.target.id;
      onEdgeClick?.(edgeId);
    });

    // Клик по холсту - для добавления элемента
    graph.on('canvas:click', (evt: any) => {
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;

      // Отмена режима связи при клике на пустое место
      if (connectionModeRef.current && pendingConnectionRef.current) {
        try {
          graph.setElementState(pendingConnectionRef.current, 'connectionSource', false);
        } catch (e) {
          // Element may not exist
        }
        setPendingConnectionStart(null);
        return;
      }

      if (editModeRef.current && selectedElementTypeRef.current && onCanvasClick) {
        // Получаем координаты клика относительно холста
        const { x, y } = evt;
        onCanvasClick(x, y);
      } else {
        onEmptyClick?.();
      }
    });

    // Событие окончания перетаскивания узла
    graph.on('node:dragend', (evt: any) => {
      if (editModeRef.current && onNodeDrop) {
        const nodeId = evt.target.id;
        const { x, y } = evt;
        onNodeDrop(nodeId, x, y);
      }
    });

    // Zoom событие
    graph.on('viewport:zoom', () => {
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;
      const zoom = graph.getZoom();
      onZoomChange?.(zoom);
    });

    // Респонсив
    const resizeObserver = new ResizeObserver((entries) => {
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;
      const { width: newWidth, height: newHeight } = entries[0].contentRect;
      try {
        graph.resize(newWidth, newHeight);
      } catch (e) {
        // Graph may be destroyed
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (graph && !(graph as any).destroyed) {
        graph.destroy();
      }
    };
  }, []); // Пустой массив - граф создаётся только один раз!

  // Обновление данных
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !data || (graph as any).destroyed) return;

    try {
      // Преобразуем данные в формат G6
      const nodes = data.nodes.map(node => ({
        id: node.id,
        data: {
          ...node,
          type: node.type.toLowerCase(),
        },
      }));

      const edges = data.edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        data: edge as any,
      }));

      graph.setData({ nodes, edges: edges as any });
      graph.render();
    } catch (e) {
      // Graph may be destroyed
    }
  }, [data]);

  // Выделение выбранного узла
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    // Проверка что граф не уничтожен и готов к работе
    if ((graph as any).destroyed || !(graph as any).rendered) return;

    try {
      // Снимаем выделение со всех узлов через getData
      const nodeData = graph.getData();
      if (!nodeData || !nodeData.nodes) return;

      nodeData.nodes.forEach((node: any) => {
        if (node?.id && !(graph as any).destroyed) {
          try {
            graph.setElementState(node.id, 'selected', false);
          } catch {
            // Skip if element doesn't exist
          }
        }
      });

      // Выделяем выбранный
      if (selectedNodeId && !(graph as any).destroyed) {
        try {
          graph.setElementState(selectedNodeId, 'selected', true);
        } catch {
          // Skip if element doesn't exist
        }
      }
    } catch (e) {
      // Graph may be destroyed or data unavailable
    }
  }, [selectedNodeId]);

  // Выделение выбранного ребра
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    // Проверка что граф не уничтожен и готов к работе
    if ((graph as any).destroyed || !(graph as any).rendered) return;

    try {
      // Снимаем выделение со всех ребер
      const edgeData = graph.getData();
      if (!edgeData || !edgeData.edges) return;

      edgeData.edges.forEach((edge: any) => {
        if (edge?.id && !(graph as any).destroyed) {
          try {
            graph.setElementState(edge.id, 'selected', false);
          } catch {
            // Skip if element doesn't exist
          }
        }
      });

      // Выделяем выбранный
      if (selectedEdgeId && !(graph as any).destroyed) {
        try {
          graph.setElementState(selectedEdgeId, 'selected', true);
        } catch {
          // Skip if element doesn't exist
        }
      }
    } catch (e) {
      // Graph may be destroyed or data unavailable
    }
  }, [selectedEdgeId]);

  // Внешний zoom
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !externalZoom) return;

    if ((graph as any).destroyed || !(graph as any).rendered) return;

    try {
      graph.zoomTo(externalZoom);
    } catch (e) {
      // Graph may be destroyed
    }
  }, [externalZoom]);

  // Сброс состояния связи при выходе из режима
  useEffect(() => {
    const graph = graphRef.current;
    if (!connectionMode && pendingConnectionStart && graph) {
      if (!(graph as any).destroyed) {
        try {
          graph.setElementState(pendingConnectionStart, 'connectionSource', false);
        } catch {
          // Element may not exist
        }
      }
      setPendingConnectionStart(null);
    }
  }, [connectionMode, pendingConnectionStart]);

  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-950 relative">
      <div
        ref={containerRef}
        className="h-full w-full"
      />

      {/* Индикатор режима редактирования */}
      {editMode && (
        <div className="absolute top-4 left-4 px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg shadow-lg z-10">
          ✏️ Режим редактирования
        </div>
      )}

      {/* Индикатор режима связи */}
      {connectionMode && (
        <div className="absolute top-4 left-4 px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg shadow-lg z-10">
          🔗 {pendingConnectionStart ? 'Выберите целевой элемент' : 'Выберите начальный элемент'}
        </div>
      )}

      {/* Подсказка при наведении на узел */}
      {hoveredNode && (
        <div className="absolute bottom-4 right-4 p-3 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 text-sm max-w-xs z-20">
          <div className="space-y-1">
            <div className="font-medium text-slate-800 dark:text-slate-200">{hoveredNode.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">ID: {hoveredNode.id}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Тип: {hoveredNode.type.toLowerCase()}</div>
            {hoveredNode.devices?.[0]?.currentNom && (
              <div className="text-xs text-slate-600 dark:text-slate-300">Iном: {hoveredNode.devices[0].currentNom}А</div>
            )}
            {hoveredNode.devices?.[0]?.pKw && (
              <div className="text-xs text-slate-600 dark:text-slate-300">P: {hoveredNode.devices[0].pKw}кВт</div>
            )}
            {hoveredNode.criticalIssues > 0 && (
              <div className="text-xs text-red-500 dark:text-red-400 mt-1">
                {hoveredNode.criticalIssues} проблем
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

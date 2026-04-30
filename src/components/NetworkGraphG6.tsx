'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Graph } from '@antv/g6';
import type { GraphData, GraphNode, GraphEdge, ElementType } from '@/types';

interface NetworkGraphG6Props {
  data: GraphData | null;
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onEmptyClick?: () => void;
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
  // Удаление элемента
  onDeleteNode?: (nodeId: string) => void;
  // Обновление статуса элемента
  onUpdateNodeStatus?: (nodeId: string, operationalStatus: 'ON' | 'OFF') => void;
  // Принудительное обновление статусов (propagate)
  onPropagate?: () => void;
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

// Типы элементов, которые имеют operationalStatus (можно включить/выключить)
const SWITCHABLE_TYPES = ['SOURCE', 'BREAKER', 'LOAD', 'METER'];

// Проверка: элемент имеет operationalStatus
function isSwitchable(type: string): boolean {
  return SWITCHABLE_TYPES.includes(type.toUpperCase());
}

// ============================================================================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================================================================

export default function NetworkGraphG6({
  data,
  onNodeClick,
  onEdgeClick,
  onEmptyClick,
  zoom: externalZoom,
  onZoomChange,
  editMode = false,
  selectedElementType,
  onCanvasClick,
  onNodeDrop,
  connectionMode = false,
  onConnectionCreated,
  onDeleteNode,
  onUpdateNodeStatus,
  onPropagate,
}: NetworkGraphG6Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const destroyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdge | null>(null);
  const [pendingConnectionStart, setPendingConnectionStart] = useState<string | null>(null);
  // Закреплённые tooltip (не исчезают при уходе курсора)
  const [pinnedNode, setPinnedNode] = useState<GraphNode | null>(null);
  const [pinnedEdge, setPinnedEdge] = useState<GraphEdge | null>(null);

  // Refs для актуальных значений режимов (чтобы не пересоздавать граф)
  const editModeRef = useRef(editMode);
  const connectionModeRef = useRef(connectionMode);
  const selectedElementTypeRef = useRef(selectedElementType);
  const pendingConnectionRef = useRef<string | null>(null);
  const pinnedNodeRef = useRef<GraphNode | null>(null);
  const pinnedEdgeRef = useRef<GraphEdge | null>(null);

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

  useEffect(() => {
    pinnedNodeRef.current = pinnedNode;
  }, [pinnedNode]);

  useEffect(() => {
    pinnedEdgeRef.current = pinnedEdge;
  }, [pinnedEdge]);

  // Инициализация графа (только один раз)
  useEffect(() => {
    if (!containerRef.current) return;

    // Отменяем отложенное уничтожение (если компонент ремонтируется в StrictMode)
    if (destroyTimeoutRef.current) {
      clearTimeout(destroyTimeoutRef.current);
      destroyTimeoutRef.current = null;
    }

    // Проверяем, не существует ли уже граф (может быть создан при предыдущем mount в StrictMode)
    if (graphRef.current && !(graphRef.current as any).destroyed) {
      console.log('Graph already exists, reusing');
      return;
    }

    console.log('Creating new graph');
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
        // Drag combo - перетаскивание групп (cabinets)
        {
          type: 'drag-element',
          enable: (evt: any) => {
            // Разрешаем drag combo всегда в режиме редактирования
            return editModeRef.current && !connectionModeRef.current;
          },
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
      combo: {
        type: 'rect',
        style: {
          radius: 8,
          fill: '#f8fafc',
          stroke: '#d97706',
          lineWidth: 2,
          lineDash: [5, 5],
          opacity: 0.9,
          labelText: (d: any) => d.data?.name || '',
          labelFill: '#92400e',
          labelFontSize: 12,
          labelFontWeight: 'bold',
          labelPlacement: 'top',
          labelOffsetY: -5,
          padding: [30, 20, 20, 20],
        },
        state: {
          selected: {
            stroke: '#f59e0b',
            lineWidth: 3,
          },
          hover: {
            stroke: '#fbbf24',
            lineWidth: 2,
          },
          collapsed: {
            fill: '#fef3c7',
            lineDash: [],
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

      // Закрепляем tooltip при клике на узел
      const nodeData = data?.nodes.find(n => n.id === nodeId);
      if (nodeData) {
        setPinnedNode(nodeData);
        setPinnedEdge(null); // Снимаем закрепление с ребра
        setHoveredNode(null);
        setHoveredEdge(null);
      }

      onNodeClick?.(nodeId);
    });

    graph.on('node:pointerenter', (evt: any) => {
      const nodeId = evt.target.id;
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;

      // Отменяем отложенное скрытие tooltip если мышка вернулась
      if (tooltipHideTimeoutRef.current) {
        clearTimeout(tooltipHideTimeoutRef.current);
        tooltipHideTimeoutRef.current = null;
      }

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
      const nodeId = evt.target.id;
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;

      // Не скрываем hoveredNode если tooltip закреплён
      if (!pinnedNodeRef.current) {
        // В режиме редактирования добавляем задержку перед скрытием tooltip
        // чтобы пользователь мог нажать кнопку удаления
        if (editModeRef.current) {
          tooltipHideTimeoutRef.current = setTimeout(() => {
            setHoveredNode(null);
            tooltipHideTimeoutRef.current = null;
          }, 500); // 500мс задержка
        } else {
          setHoveredNode(null);
        }
      }

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
      
      // Закрепляем tooltip при клике на ребро
      const edgeData = data?.edges.find(e => e.id === edgeId);
      if (edgeData) {
        setPinnedEdge(edgeData);
        setPinnedNode(null); // Снимаем закрепление с узла
        setHoveredNode(null);
        setHoveredEdge(null);
      }
      
      onEdgeClick?.(edgeId);
    });

    // Наведение на ребро (связь)
    graph.on('edge:pointerenter', (evt: any) => {
      const edgeId = evt.target.id;
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;

      const edgeData = data?.edges.find(e => e.id === edgeId);
      if (edgeData) {
        setHoveredEdge(edgeData);
        setHoveredNode(null); // Скрываем tooltip узла
      }

      try {
        graph.setElementState(edgeId, 'hover', true);
      } catch (e) {
        // Element may not exist
      }
    });

    // Уход курсора с ребра
    graph.on('edge:pointerleave', (evt: any) => {
      const edgeId = evt.target.id;
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;

      // Не скрываем hoveredEdge если tooltip закреплён
      if (!pinnedEdgeRef.current) {
        setHoveredEdge(null);
      }

      try {
        graph.setElementState(edgeId, 'hover', false);
      } catch (e) {
        // Element may not exist
      }
    });

    // Клик по холсту - для добавления элемента
    graph.on('canvas:click', (evt: any) => {
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;

      // Снимаем закрепление tooltip при клике на пустое место
      setPinnedNode(null);
      setPinnedEdge(null);

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
        // Получаем координаты клика - пробуем разные варианты структуры события G6 v5
        let x = 0, y = 0;

        // Вариант 1: прямые свойства
        if (evt.x !== undefined && evt.y !== undefined) {
          x = evt.x;
          y = evt.y;
        }
        // Вариант 2: canvas свойства
        else if (evt.canvas) {
          x = evt.canvas.x ?? 0;
          y = evt.canvas.y ?? 0;
        }
        // Вариант 3: client координаты
        else if (evt.clientX !== undefined) {
          x = evt.clientX;
          y = evt.clientY;
        }
        // Вариант 4: fallback - используем центр
        else {
          x = 400;
          y = 300;
        }

        console.log('Canvas click coordinates:', { x, y, evt });
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

    // Не уничтожаем граф при cleanup - он будет переиспользован
    // Это важно для React StrictMode в development
    return () => {
      resizeObserver.disconnect();
      // Граф уничтожается только при размонтировании компонента
      // Но в StrictMode это вызывается дважды, поэтому проверяем ref
    };
  }, []); // Пустой массив - граф создаётся только один раз!

  // Кэш предыдущих данных для инкрементального обновления
  const prevDataRef = useRef<{ nodeIds: Set<string>; edgeIds: Set<string> } | null>(null);

  // Обновление данных
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !data) return;

    // Проверка что граф не уничтожен
    if ((graph as any).destroyed) return;

    try {
      // Преобразуем данные в формат G6
      const nodes = data.nodes.map(node => ({
        id: node.id,
        combo: (node as any).combo || undefined, // Привязка к combo (cabinet)
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

      // Преобразуем combos если есть
      const combos = data.combos?.map(combo => ({
        id: combo.id,
        data: combo.data,
      })) || [];

      // Первый рендер
      if (!(graph as any).rendered) {
        graph.setData({ nodes, edges: edges as any, combos });
        graph.render();
        (graph as any).rendered = true;
        prevDataRef.current = {
          nodeIds: new Set(nodes.map(n => n.id)),
          edgeIds: new Set(edges.map(e => e.id)),
        };
        return;
      }

      // Инкрементальное обновление
      const newNodeIds = new Set(nodes.map(n => n.id));
      const newEdgeIds = new Set(edges.map(e => e.id));
      const prevIds = prevDataRef.current;

      if (prevIds) {
        // Находим добавленные/удалённые элементы
        const addedNodes = nodes.filter(n => !prevIds.nodeIds.has(n.id));
        const removedNodeIds = [...prevIds.nodeIds].filter(id => !newNodeIds.has(id));
        const addedEdges = edges.filter(e => !prevIds.edgeIds.has(e.id));
        const removedEdgeIds = [...prevIds.edgeIds].filter(id => !newEdgeIds.has(id));

        // Если изменений немного - обновляем инкрементально
        const totalChanges = addedNodes.length + removedNodeIds.length + addedEdges.length + removedEdgeIds.length;
        const totalElements = nodes.length + edges.length;

        if (totalChanges <= 5 && totalElements > 20) {
          // Инкрементальное обновление без перерисовки layout
          if (removedNodeIds.length > 0) {
            graph.removeData('node', removedNodeIds);
          }
          if (removedEdgeIds.length > 0) {
            graph.removeData('edge', removedEdgeIds);
          }
          if (addedNodes.length > 0 || addedEdges.length > 0) {
            graph.addData({
              nodes: addedNodes,
              edges: addedEdges as any,
            });
          }
          // Обновляем данные существующих элементов без пересчёта layout
          graph.setData({ nodes, edges: edges as any, combos }, true);
        } else {
          // Много изменений - полный обновление с layout
          graph.setData({ nodes, edges: edges as any, combos });
          graph.layout();
        }
      } else {
        // Нет предыдущих данных - полный рендер
        graph.setData({ nodes, edges: edges as any, combos });
        graph.layout();
      }

      prevDataRef.current = {
        nodeIds: newNodeIds,
        edgeIds: newEdgeIds,
      };
    } catch (e) {
      console.error('Graph update error:', e);
    }
  }, [data]);



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

  // Финальный cleanup при размонтировании компонента
  useEffect(() => {
    return () => {
      const graph = graphRef.current;
      if (graph && !(graph as any).destroyed) {
        // Откладываем уничтожение на 100мс
        // Если компонент снова монтируется (StrictMode), уничтожение будет отменено
        destroyTimeoutRef.current = setTimeout(() => {
          if (graphRef.current && !(graphRef.current as any).destroyed) {
            console.log('Destroying graph on unmount');
            graphRef.current.destroy();
            graphRef.current = null;
          }
          destroyTimeoutRef.current = null;
        }, 100);
      }
    };
  }, []);

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

      {/* Подсказка при наведении на узел (или закреплённая) */}
      {(hoveredNode || pinnedNode) && (
        <div 
          className="absolute bottom-4 right-4 p-4 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 text-sm max-w-sm z-20"
          onMouseEnter={() => {
            // Отменяем скрытие если мышка наведена на tooltip
            if (tooltipHideTimeoutRef.current) {
              clearTimeout(tooltipHideTimeoutRef.current);
              tooltipHideTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            // Скрываем tooltip только если он не закреплён
            if (!pinnedNode) {
              setHoveredNode(null);
            }
          }}
        >
          <div className="space-y-2">
            {/* Заголовок */}
            <div className="border-b border-slate-200 dark:border-slate-700 pb-2 flex justify-between items-start">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 text-base">{(pinnedNode || hoveredNode)?.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">ID: {(pinnedNode || hoveredNode)?.id} | Тип: {(pinnedNode || hoveredNode)?.type.toLowerCase()}</div>
              </div>
              <div className="flex items-center gap-1">
                {/* Кнопка закрытия tooltip */}
                {pinnedNode && (
                  <button
                    onClick={() => setPinnedNode(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                    title="Закрыть"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {/* Кнопка удаления - только в режиме редактирования */}
                {editMode && (
                  <button
                    onClick={() => {
                      const node = pinnedNode || hoveredNode;
                      if (node && confirm(`Удалить элемент "${node.name}" и все связанные связи?`)) {
                        onDeleteNode?.(node.id);
                        setHoveredNode(null);
                        setPinnedNode(null);
                      }
                    }}
                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                    title="Удалить элемент"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            
            {/* Статусы */}
            <div className="flex flex-wrap gap-2">
              {/* Электрический статус - для всех элементов */}
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                (pinnedNode || hoveredNode)?.lifeStatus === 'LIVE' 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                {(pinnedNode || hoveredNode)?.lifeStatus === 'LIVE' ? '⚡ Под напряжением' : '⚪ Без напряжения'}
              </div>
              
              {/* Оперативный статус - только для коммутирующих элементов */}
              {isSwitchable((pinnedNode || hoveredNode)?.type || '') && (
                <div className="flex items-center gap-1">
                  {/* Кнопка переключения - всегда доступна */}
                  <button
                    onClick={() => {
                      const node = pinnedNode || hoveredNode;
                      if (node && onUpdateNodeStatus) {
                        const newStatus = node.status === 'OFF' ? 'ON' : 'OFF';
                        onUpdateNodeStatus(node.id, newStatus);
                      }
                    }}
                    className={`px-2 py-1 rounded text-xs font-medium cursor-pointer transition-all hover:ring-2 hover:ring-blue-400 ${
                      (pinnedNode || hoveredNode)?.status === 'OFF' 
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' 
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    }`}
                    title="Нажмите для переключения статуса"
                  >
                    {(pinnedNode || hoveredNode)?.status === 'OFF' ? '🔴 Отключен' : '🟢 Включен'}
                  </button>
                </div>
              )}
              
              {/* Кнопка обновления статусов */}
              {onPropagate && (
                <button
                  onClick={() => {
                    onPropagate();
                  }}
                  className="px-2 py-1 rounded text-xs font-medium cursor-pointer transition-all bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:ring-2 hover:ring-purple-400"
                  title="Пересчитать статусы по всей сети"
                >
                  🔄 Обновить статусы
                </button>
              )}
            </div>
            
            {/* Устройства */}
            {(pinnedNode || hoveredNode)?.devices && (pinnedNode || hoveredNode)!.devices!.length > 0 && (
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Устройства:</div>
                {(pinnedNode || hoveredNode)!.devices!.map((device, idx) => (
                  <div key={idx} className="text-xs text-slate-500 dark:text-slate-400 pl-2">
                    • {device.type}{device.model ? ` ${device.model}` : ''}
                    {device.currentNom && ` | Iном: ${device.currentNom}А`}
                    {device.pKw && ` | P: ${device.pKw}кВт`}
                    {device.breakerType && ` | Тип: ${device.breakerType}`}
                    {device.breakingCapacity && ` | Откл.способность: ${device.breakingCapacity}кА`}
                    {device.curve && ` | Характеристика: ${device.curve}`}
                    {device.leakageCurrent && ` | Iут: ${device.leakageCurrent}мА`}
                    {device.poles && ` | Полюсов: ${device.poles}`}
                  </div>
                ))}
              </div>
            )}
            
            {/* Напряжение */}
            {(pinnedNode || hoveredNode)?.voltageLevel && (
              <div className="text-xs text-slate-600 dark:text-slate-300">
                Напряжение: {(pinnedNode || hoveredNode)?.voltageLevel}В
              </div>
            )}
            
            {/* Проблемы */}
            {(pinnedNode || hoveredNode)?.criticalIssues && (pinnedNode || hoveredNode)!.criticalIssues > 0 && (
              <div className="border-t border-red-200 dark:border-red-800 pt-2">
                <div className="text-xs text-red-500 dark:text-red-400 font-medium">
                  ⚠️ {(pinnedNode || hoveredNode)?.criticalIssues} проблем(ы)
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Подсказка при наведении на ребро (связь) или закреплённая */}
      {(hoveredEdge || pinnedEdge) && (
        <div 
          className="absolute bottom-4 right-4 p-4 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 text-sm max-w-sm z-20"
          onMouseEnter={() => {
            // Отменяем скрытие если мышка наведена на tooltip
          }}
          onMouseLeave={() => {
            // Скрываем tooltip только если он не закреплён
            if (!pinnedEdge) {
              setHoveredEdge(null);
            }
          }}
        >
          <div className="space-y-2">
            {/* Заголовок */}
            <div className="border-b border-slate-200 dark:border-slate-700 pb-2 flex justify-between items-start">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                  🔗 Связь
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {(pinnedEdge || hoveredEdge)?.source} → {(pinnedEdge || hoveredEdge)?.target}
                </div>
              </div>
              {/* Кнопка закрытия tooltip */}
              {pinnedEdge && (
                <button
                  onClick={() => setPinnedEdge(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                  title="Закрыть"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Параметры кабеля */}
            <div className="space-y-1">
              {/* Марка и сечение */}
              {((pinnedEdge || hoveredEdge)?.wireType || (pinnedEdge || hoveredEdge)?.wireSize) && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Кабель:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {(pinnedEdge || hoveredEdge)?.wireType} {(pinnedEdge || hoveredEdge)?.wireSize}мм²
                  </span>
                </div>
              )}
              
              {/* Длина */}
              {(pinnedEdge || hoveredEdge)?.length && (pinnedEdge || hoveredEdge)!.length! > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Длина:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {(pinnedEdge || hoveredEdge)?.length} м
                  </span>
                </div>
              )}
              
              {/* Материал */}
              {((pinnedEdge || hoveredEdge) as any)?.cable?.material && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Материал:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {((pinnedEdge || hoveredEdge) as any).cable.material === 'copper' ? 'Медь' : 'Алюминий'}
                  </span>
                </div>
              )}
              
              {/* Допустимый ток */}
              {((pinnedEdge || hoveredEdge) as any)?.cable?.iDop && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Iдоп:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {((pinnedEdge || hoveredEdge) as any).cable.iDop} А
                  </span>
                </div>
              )}
              
              {/* Потеря напряжения */}
              {((pinnedEdge || hoveredEdge) as any)?.cable?.voltageDrop !== null && ((pinnedEdge || hoveredEdge) as any)?.cable?.voltageDrop !== undefined && (
                <div className="flex justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">ΔU (потеря):</span>
                  <span className={`font-medium ${
                    ((pinnedEdge || hoveredEdge) as any).cable.voltageDrop > 5 
                      ? 'text-red-600 dark:text-red-400' 
                      : ((pinnedEdge || hoveredEdge) as any).cable.voltageDrop > 3 
                        ? 'text-amber-600 dark:text-amber-400' 
                        : 'text-green-600 dark:text-green-400'
                  }`}>
                    {((pinnedEdge || hoveredEdge) as any).cable.voltageDrop.toFixed(2)}%
                    {((pinnedEdge || hoveredEdge) as any).cable.voltageDrop > 5 && ' ⚠️'}
                  </span>
                </div>
              )}
            </div>
            
            {/* Статусы */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                (pinnedEdge || hoveredEdge)?.lifeStatus === 'LIVE' 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                {(pinnedEdge || hoveredEdge)?.lifeStatus === 'LIVE' ? '⚡ Под напряжением' : '⚪ Без напряжения'}
              </div>
              
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                (pinnedEdge || hoveredEdge)?.status === 'OFF' 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' 
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              }`}>
                {(pinnedEdge || hoveredEdge)?.status === 'OFF' ? '🔴 Отключен' : '🟢 Включен'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

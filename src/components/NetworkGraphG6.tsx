'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Graph } from '@antv/g6';
import type { GraphData, GraphNode, GraphEdge, ElementType } from '@/types';
// Standalone ELK engine — G6 пассивный рендерер
import { computeElkLayout, NODE_SIZES } from '@/lib/elk-engine';

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
  onUpdateNodeStatus?: (nodeId: string, operationalStatus: 'ON' | 'OFF') => Promise<void>;
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
  const mountedRef = useRef(true); // Для отслеживания mounted состояния
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdge | null>(null);
  const [pendingConnectionStart, setPendingConnectionStart] = useState<string | null>(null);
  // Закреплённые tooltip (не исчезают при уходе курсора)
  const [pinnedNode, setPinnedNode] = useState<GraphNode | null>(null);
  const [pinnedEdge, setPinnedEdge] = useState<GraphEdge | null>(null);
  // Состояние загрузки для кнопки статуса
  const [updatingNodeId, setUpdatingNodeId] = useState<string | null>(null);

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

  // Получаем актуальные данные узлов из data (для обновления tooltip после refreshData)
  const actualPinnedNode = useMemo(() => {
    if (!pinnedNode || !data) return pinnedNode;
    return data.nodes.find(n => n.id === pinnedNode.id) || pinnedNode;
  }, [pinnedNode, data]);

  const actualHoveredNode = useMemo(() => {
    if (!hoveredNode || !data) return hoveredNode;
    return data.nodes.find(n => n.id === hoveredNode.id) || hoveredNode;
  }, [hoveredNode, data]);

  // Инициализация графа (только один раз)
  useEffect(() => {
    if (!containerRef.current) return;

    // Отменяем отложенное уничтожение (если компонент ремонтируется в StrictMode)
    if (destroyTimeoutRef.current) {
      clearTimeout(destroyTimeoutRef.current);
      destroyTimeoutRef.current = null;
    }

    // Проверяем, не существует ли уже граф и он не уничтожен
    const existingGraph = graphRef.current;
    if (existingGraph && !(existingGraph as any).destroyed) {
      console.log('Graph already exists, reusing');
      return;
    }

    // Если граф уничтожен - очищаем ссылку
    if (existingGraph && (existingGraph as any).destroyed) {
      console.log('Graph was destroyed, creating new one');
      graphRef.current = null;
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
        {
          type: 'zoom-canvas',
          key: 'zoom-wheel',
          trigger: ['wheel'],
          sensitivity: 1,
        },
        {
          type: 'zoom-canvas',
          key: 'zoom-pinch',
          trigger: ['pinch'],
          sensitivity: 1,
        },
        {
          type: 'click-select',
          trigger: 'click',
          multiple: false,
        },
        {
          type: 'collapse-expand',
          trigger: 'dblclick',
        },
        // Drag element с динамическим обновлением рёбер
        {
          type: 'drag-element',
          enable: () => editModeRef.current && !connectionModeRef.current,
          // Обновлять рёбра во время перетаскивания
          updateEdge: true,
        },
        // Drag combo - перетаскивание групп (cabinets)
        {
          type: 'drag-element',
          enable: (evt: any) => {
            return editModeRef.current && !connectionModeRef.current;
          },
          updateEdge: true,
        },
      ],
      // ============================================================
      // G6 — ПАССИВНЫЙ РЕНДЕРЕР
      // Layout рассчитывается ELK отдельно, координаты передаются через style.x/y
      // Свойство layout НЕ задано — G6 не запускает свой движок раскладки
      // ============================================================
      node: {
        type: 'rect',
        style: {
          // Размер узла: приоритет из style.size (задаётся ELK), иначе из data, иначе дефолт по типу
          size: (d: any) => {
            // Если size уже установлен в данных (из ELK адаптера)
            if (d.style?.size) return d.style.size;
            // Если width/height в data
            if (d.data?.width && d.data?.height) {
              return [d.data.width, d.data.height];
            }
            // Дефолтные размеры по типу
            const nodeType = (d.data?.type || 'load').toLowerCase();
            const sizes: Record<string, [number, number]> = {
              source: [160, 80],
              bus: [200, 40],
              breaker: [140, 70],
              meter: [140, 70],
              load: [160, 80],
              cabinet: [180, 50],
              junction: [40, 40],
              transformer: [140, 80],
            };
            return sizes[nodeType] || [160, 80];
          },
          // Размер читается из style.size (задаётся при создании узла)
          // или используется стандартный
          radius: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            // BUS - без скругления для инженерного вида
            return nodeType === 'bus' ? 0 : 6;
          },
          fill: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            // BUS - простая медная заливка без градиента
            if (nodeType === 'bus') {
              return '#CD7F32';
            }
            return '#ffffff';
          },
          stroke: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            const hasCritical = d.data?.criticalIssues > 0;
            if (hasCritical) return '#ef4444';
            // BUS - без дополнительной обводки (тот же цвет что и заливка)
            if (nodeType === 'bus') {
              return '#8B5A2B'; // тёмно-коричневый для контура
            }
            return TYPE_COLORS[nodeType]?.primary || '#e2e8f0';
          },
          lineWidth: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            // BUS - толстая линия
            return nodeType === 'bus' ? 3 : 2;
          },
          shadowColor: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            // BUS - без тени
            return nodeType === 'bus' ? 'transparent' : 'rgba(0, 0, 0, 0.15)';
          },
          shadowBlur: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            return nodeType === 'bus' ? 0 : 10;
          },
          shadowOffsetX: 0,
          shadowOffsetY: 4,
          cursor: 'pointer',
          zIndex: 1,              // Узлы поверх combos
          // Точки привязки для рёбер
          anchorPoints: [
            [0.5, 0],   // индекс 0: верхний центр (вход от источника)
            [0.5, 1],   // индекс 1: нижний центр (выход к нагрузке)
          ],
          // Порты для строгого вертикального подключения
          portR: 4,               // Радиус порта
          portLinkToCenter: true, // Соединять с центром узла
          // Основной текст - название
          labelText: (d: any) => {
            const name = d.data?.name || d.id;
            const nodeType = (d.data?.type || 'load').toLowerCase();
            if (nodeType === 'bus') {
              // BUS - название сбоку или не отображается
              return '';
            }
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
        // polyline с ортогональными мостиками
        type: 'polyline',
        style: {
          stroke: (d: any) => {
            const lifeStatus = d.data?.lifeStatus;
            return lifeStatus === 'LIVE' ? '#22c55e' : '#94a3b8';
          },
          lineWidth: 2,
          endArrow: false,
          radius: 0,          // Строго 90 градусов
          jumpOffset: 12,     // Мостик при пересечении линий
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
          // Позиция подписи по центру линии
          labelPlacement: 'center',
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
          zIndex: 0,              // Combos позади узлов
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

      setHoveredEdge(null); // Скрываем tooltip связи
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
        // Добавляем задержку перед скрытием tooltip
        // чтобы пользователь мог переместить курсор на tooltip
        tooltipHideTimeoutRef.current = setTimeout(() => {
          setHoveredNode(null);
          tooltipHideTimeoutRef.current = null;
        }, 300); // 300мс задержка
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
        // Добавляем задержку перед скрытием tooltip
        tooltipHideTimeoutRef.current = setTimeout(() => {
          setHoveredEdge(null);
          tooltipHideTimeoutRef.current = null;
        }, 300); // 300мс задержка
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
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;
      
      if (editModeRef.current) {
        const nodeId = evt.target.id;
        const { x, y } = evt;
        
        // Сохраняем позицию
        if (onNodeDrop) {
          onNodeDrop(nodeId, x, y);
        }
        
        // После перетаскивания не вызываем graph.layout() - это триггерит ошибку
        // 'preset is not registered'. Рёбра обновляются автоматически через updateEdge: true
      }
    });

    // Zoom событие
    graph.on('viewport:zoom', () => {
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;
      const zoom = graph.getZoom();
      onZoomChange?.(zoom);
    });

    // Отключаем passive touch listeners для корректной работы pinch-to-zoom
    const preventTouchDefaults = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    container.addEventListener('touchmove', preventTouchDefaults, { passive: false });
    container.addEventListener('touchstart', preventTouchDefaults, { passive: false });

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
      container.removeEventListener('touchmove', preventTouchDefaults);
      container.removeEventListener('touchstart', preventTouchDefaults);
      // Граф уничтожается только при размонтировании компонента
      // Но в StrictMode это вызывается дважды, поэтому проверяем ref
    };
  }, []); // Пустой массив - граф создаётся только один раз!

  // Кэш предыдущих данных для инкрементального обновления
  const prevDataRef = useRef<{ nodeIds: Set<string>; edgeIds: Set<string> } | null>(null);

  // Основной useEffect: загрузка данных через ELK layout plugin
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !data) return;

    if ((graph as any).destroyed) return;

    const processDataAndRender = async () => {
      try {
        console.log('[G6] ELK layout → passive render...');

        // Фильтруем рёбра с валидными source/target
        const nodeIds = new Set(data.nodes.map(n => n.id));
        const validEdges = data.edges.filter(edge => 
          nodeIds.has(edge.source) && nodeIds.has(edge.target)
        );

        // ============================================================
        // ШАГ 1: Рассчитываем layout через ELK (вне G6)
        // ============================================================
        const layoutResult = await computeElkLayout(
          data.nodes.map(n => ({
            id: n.id,
            type: n.type,
            data: n,
            combo: (n as any).combo,
          })),
          validEdges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            data: e,
          })),
        );

        // Маппинг: nodeId → ELK координаты
        const elkMap = new Map(layoutResult.nodes.map(n => [n.id, n]));
        const elkEdgeMap = new Map(layoutResult.edges.map(e => [e.id, e]));
        const elkComboMap = new Map((layoutResult.combos || []).map(c => [c.id, c]));

        // ============================================================
        // 🔍 ДИАГНОСТИКА: Проверяем, что ELK вернул данные
        // ============================================================
        console.log('[G6 DIAG] ELK вернул:', layoutResult.nodes.length, 'узлов,', layoutResult.edges.length, 'рёбер,', (layoutResult.combos || []).length, 'combos');
        console.log('[G6 DIAG] Узлы без ELK координат:', data.nodes.filter(n => !elkMap.has(n.id)).map(n => n.id));
        console.log('[G6 DIAG] Узлы с combo (parentId):', data.nodes.filter(n => (n as any).combo).map(n => ({ id: n.id, combo: (n as any).combo })));

        // ============================================================
        // ШАГ 2: Подготавливаем данные для G6 с готовыми координатами
        // ============================================================
        // ============================================================
        // ШАГ 2: Узлы для G6 — только обычные узлы (НЕ шкафы/комбо)
        // Шкафы передаются через combos, а не nodes.
        // ID не должны повторяться между nodes и combos!
        // ============================================================
        const comboIds = new Set((layoutResult.combos || []).map(c => c.id));

        const nodes = data.nodes
          .filter(node => !comboIds.has(node.id)) // Исключаем шкафы (они combos)
          .map(node => {
            const elk = elkMap.get(node.id);
            const type = (node.type || 'load').toLowerCase();
            const size = NODE_SIZES[type] || { width: 120, height: 60 };

            if (!elk) {
              console.warn(`[G6 DIAG] Узел "${node.id}" не найден в ELK результате!`);
            }

            return {
              id: node.id,
              combo: (node as any).combo || undefined,
              data: {
                ...node,
                type: type,
              },
              // Координаты от ELK — G6 просто рендерит
              style: {
                x: elk?.x ?? 0,
                y: elk?.y ?? 0,
                size: [elk?.width || size.width, elk?.height || size.height],
              },
            };
          });

        // ============================================================
        // ШАГ 2a: Рёбра — используем source/target из ELK
        // ELK возвращает source/target указывающие на обычные узлы
        // (представители шкафов), НЕ на комбо.
        // ============================================================
        const apiEdgeMap = new Map(validEdges.map(e => [e.id, e]));

        const edgesFromElk = (layoutResult.edges || []).map(elkEdge => {
          const apiEdge = apiEdgeMap.get(elkEdge.id);
          const edgeData: any = {
            id: elkEdge.id,
            source: elkEdge.source,
            target: elkEdge.target,
            data: (apiEdge as any)?.data || {},
          };

          // Контрольные точки от ELK → в style для polyline
          if (elkEdge.controlPoints?.length) {
            edgeData.style = {
              controlPoints: elkEdge.controlPoints,
            };
          }

          return edgeData;
        });

        // Финальная валидация: рёбра должны ссылаться только на существующие узлы
        const finalNodeIds = new Set(nodes.map(n => n.id));
        const validFinalEdges = edgesFromElk.filter(e => {
          const ok = finalNodeIds.has(e.source) && finalNodeIds.has(e.target);
          if (!ok) {
            console.warn(`[G6 DIAG] Ребро "${e.id}" пропущено: source=${e.source}(${finalNodeIds.has(e.source) ? 'ok' : 'MISSING'}), target=${e.target}(${finalNodeIds.has(e.target) ? 'ok' : 'MISSING'})`);
          }
          return ok;
        });

        console.log(`[G6 DIAG] Рёбра: ${validFinalEdges.length} валидных из ${edgesFromElk.length} от ELK (входило ${validEdges.length} из API)`);
        console.log('[G6 DIAG] Рёбра для G6:', validFinalEdges.map(e => `${e.source} -> ${e.target} (${e.style?.controlPoints?.length || 0}pts)`).join(', '));

        // ============================================================
        // ШАГ 2b: Combos из ELK результатов (НЕ из API!)
        // API combos не содержат позиций и размеров.
        // ELK рассчитывает позицию и размер каждого шкафа.
        // ============================================================
        const combos = (layoutResult.combos || []).map(cabinet => ({
          id: cabinet.id,
          data: {
            name: cabinet.label,
            type: 'CABINET',
            label: cabinet.label,
          },
          style: {
            x: cabinet.x - cabinet.width / 2,  // G6 combo: x,y — верхний левый угол
            y: cabinet.y - cabinet.height / 2,
            width: cabinet.width,
            height: cabinet.height,
          },
        }));

        console.log('[G6 DIAG] Combos для G6:', combos.map(c => ({ id: c.id, x: c.style?.x, y: c.style?.y, w: c.style?.width, h: c.style?.height })));

        // Если ELK не вернул combos (откат), используем combos из API
        const finalCombos = combos.length > 0 ? combos : (data.combos?.map(combo => ({
          id: combo.id,
          data: combo.data,
        })) || []);

        console.log('[G6 DIAG] Итого: nodes=', nodes.length, 'edges=', validFinalEdges.length, 'combos=', finalCombos.length);

        // ============================================================
        // ШАГ 3: G6 — только рендер (без layout движка)
        // Рёбра НЕ ссылаются на комбо — только на обычные узлы.
        // ============================================================
        graph.setData({
          nodes: nodes as any,
          edges: validFinalEdges as any,
          combos: finalCombos,
        });

        if (!(graph as any).rendered) {
          await graph.render();
          (graph as any).rendered = true;
        }

        graph.fitView();
        console.log('[G6] Passive render complete — ELK coordinates applied');

      } catch (error) {
        console.error('[G6] ELK/Render error:', error);

        // Fallback — сетка
        const nodes = data.nodes.map((node, index) => {
          const type = (node.type || 'load').toLowerCase();
          const size = NODE_SIZES[type] || { width: 120, height: 60 };
          return {
            id: node.id,
            style: {
              x: size.width / 2 + 100 + (index % 10) * 150,
              y: size.height / 2 + 100 + Math.floor(index / 10) * 100,
              size: [size.width, size.height],
            },
            combo: (node as any).combo || undefined,
            data: {
              ...node,
              type: type,
            },
          };
        });

        const edges = data.edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          data: edge as any,
        }));

        const fallbackCombos = data.combos?.map(combo => ({
          id: combo.id,
          data: combo.data,
        })) || [];

        graph.setData({ nodes: nodes as any, edges: edges as any, combos: fallbackCombos });

        if (!(graph as any).rendered) {
          await graph.render();
          (graph as any).rendered = true;
        }
        graph.fitView();
      }
    };

    processDataAndRender();
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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const graph = graphRef.current;
      if (graph) {
        if (!(graph as any).destroyed) {
          // Откладываем уничтожение на 100мс
          // Если компонент снова монтируется (StrictMode), уничтожение будет отменено
          destroyTimeoutRef.current = setTimeout(() => {
            const g = graphRef.current;
            if (g && !(g as any).destroyed) {
              console.log('Destroying graph on unmount');
              try {
                g.destroy();
              } catch (e) {
                console.warn('Error destroying graph:', e);
              }
            }
            graphRef.current = null;
            destroyTimeoutRef.current = null;
          }, 100);
        } else {
          // Граф уже уничтожен - просто очищаем ссылку
          graphRef.current = null;
        }
      }
    };
  }, []);

  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-950 relative">
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ touchAction: 'none' }}
      />

      {/* Кнопки зума */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-20">
        <button
          onClick={() => {
            const graph = graphRef.current;
            if (graph && !(graph as any).destroyed) {
              const currentZoom = graph.getZoom();
              graph.zoomTo(currentZoom * 1.2);
            }
          }}
          className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-xl font-bold"
          title="Увеличить"
        >
          +
        </button>
        <button
          onClick={() => {
            const graph = graphRef.current;
            if (graph && !(graph as any).destroyed) {
              const currentZoom = graph.getZoom();
              graph.zoomTo(currentZoom / 1.2);
            }
          }}
          className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-xl font-bold"
          title="Уменьшить"
        >
          −
        </button>
        <button
          onClick={() => {
            const graph = graphRef.current;
            if (graph && !(graph as any).destroyed) {
              graph.fitView();
            }
          }}
          className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          title="Вписать в экран"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>

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
          onMouseDown={(e) => {
            // Предотвращаем скрытие tooltip при клике внутри него
            e.stopPropagation();
          }}
          onClick={(e) => {
            // Предотвращаем всплытие клика к canvas
            e.stopPropagation();
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
                <div className="font-semibold text-slate-900 dark:text-slate-100 text-base">{(actualPinnedNode || actualHoveredNode)?.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">ID: {(actualPinnedNode || actualHoveredNode)?.id} | Тип: {(actualPinnedNode || actualHoveredNode)?.type.toLowerCase()}</div>
              </div>
              <div className="flex items-center gap-1">
                {/* Кнопка закрытия tooltip */}
                {actualPinnedNode && (
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
                      const node = actualPinnedNode || actualHoveredNode;
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
                (actualPinnedNode || actualHoveredNode)?.lifeStatus === 'LIVE' 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                {(actualPinnedNode || actualHoveredNode)?.lifeStatus === 'LIVE' ? '⚡ Под напряжением' : '⚪ Без напряжения'}
              </div>
              
              {/* Оперативный статус - только для коммутирующих элементов */}
              {isSwitchable((actualPinnedNode || actualHoveredNode)?.type || '') && (
                <div className="flex items-center gap-1">
                  {/* Кнопка переключения - всегда доступна */}
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const node = actualPinnedNode || actualHoveredNode;
                      if (node && onUpdateNodeStatus) {
                        const newStatus = node.status === 'OFF' ? 'ON' : 'OFF';
                        setUpdatingNodeId(node.id);
                        try {
                          await onUpdateNodeStatus(node.id, newStatus);
                          // После обновления статуса вызываем propagate
                          onPropagate?.();
                        } finally {
                          setUpdatingNodeId(null);
                        }
                      }
                    }}
                    disabled={updatingNodeId === (actualPinnedNode || actualHoveredNode)?.id}
                    className={`px-2 py-1 rounded text-xs font-medium cursor-pointer transition-all hover:ring-2 hover:ring-blue-400 disabled:opacity-50 disabled:cursor-wait ${
                      (actualPinnedNode || actualHoveredNode)?.status === 'OFF' 
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' 
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    }`}
                    title="Нажмите для переключения статуса"
                  >
                    {updatingNodeId === (actualPinnedNode || actualHoveredNode)?.id ? (
                      <span className="flex items-center gap-1">
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>...</span>
                      </span>
                    ) : (
                      (actualPinnedNode || actualHoveredNode)?.status === 'OFF' ? '🔴 Отключен' : '🟢 Включен'
                    )}
                  </button>
                </div>
              )}
              

            </div>

            {/* Мощности */}
            {(() => {
              const node = actualPinnedNode || actualHoveredNode;
              if (!node) return null;

              // Для LOAD показываем Pуст, Ки, Pрасч из устройства
              if (node.type?.toUpperCase() === 'LOAD' && node.devices?.[0]) {
                const device = node.devices[0];
                const pUst = device.pKw || 0;
                const ki = device.usageFactor || 0.8;
                const pRasch = pUst * ki;
                return (
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Мощность:</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 pl-2 space-y-0.5 grid grid-cols-2 gap-x-2">
                      <><span className="text-slate-400">Pуст:</span><span>{pUst.toFixed(2)} кВт</span></>
                      <><span className="text-slate-400">Ки:</span><span>{ki.toFixed(2)}</span></>
                      <><span className="text-slate-400">Pрасч:</span><span>{pRasch.toFixed(2)} кВт</span></>
                    </div>
                  </div>
                );
              }

              // Для остальных элементов показываем суммарные мощности (всегда, даже если 0)
              return (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Суммарная мощность:</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 pl-2 grid grid-cols-2 gap-x-2">
                    <><span className="text-slate-400">Σ Pуст:</span><span>{(node.sumPInstalled || 0).toFixed(2)} кВт</span></>
                    <><span className="text-slate-400">Σ Pрасч:</span><span>{(node.sumPCalculated || 0).toFixed(2)} кВт</span></>
                  </div>
                </div>
              );
            })()}

            {/* Устройства */}
            {(actualPinnedNode || actualHoveredNode)?.devices && (actualPinnedNode || actualHoveredNode)!.devices!.length > 0 && (
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Устройства:</div>
                {(actualPinnedNode || actualHoveredNode)!.devices!.map((device, idx) => (
                  <div key={idx} className="text-xs text-slate-500 dark:text-slate-400 pl-2 space-y-0.5">
                    <div className="font-medium text-slate-600 dark:text-slate-300">• {device.type}{device.model ? ` ${device.model}` : ''}</div>
                    <div className="grid grid-cols-2 gap-x-2 pl-2">
                      {device.currentNom && <><span className="text-slate-400">Iном:</span><span>{device.currentNom} А</span></>}
                      {device.pKw && <><span className="text-slate-400">Pуст:</span><span>{device.pKw} кВт</span></>}
                      {device.breakerType && <><span className="text-slate-400">Тип:</span><span>{device.breakerType}</span></>}
                      {device.breakingCapacity && <><span className="text-slate-400">Откл.спос.:</span><span>{device.breakingCapacity} кА</span></>}
                      {device.curve && <><span className="text-slate-400">Хар-ка:</span><span>{device.curve}</span></>}
                      {device.leakageCurrent && <><span className="text-slate-400">Iут:</span><span>{device.leakageCurrent} мА</span></>}
                      {device.poles && <><span className="text-slate-400">Полюсов:</span><span>{device.poles}</span></>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Напряжение */}
            {(actualPinnedNode || actualHoveredNode)?.voltageLevel && (
              <div className="text-xs text-slate-600 dark:text-slate-300 flex justify-between">
                <span className="text-slate-400">Напряжение:</span>
                <span>{((actualPinnedNode || actualHoveredNode)?.voltageLevel || 0) < 1 
                  ? `${((actualPinnedNode || actualHoveredNode)?.voltageLevel || 0) * 1000} В`
                  : `${(actualPinnedNode || actualHoveredNode)?.voltageLevel} кВ`}</span>
              </div>
            )}
            
            {/* Проблемы */}
            {((actualPinnedNode || actualHoveredNode)?.criticalIssues ?? 0) > 0 && (
              <div className="border-t border-red-200 dark:border-red-800 pt-2">
                <div className="text-xs text-red-500 dark:text-red-400 font-medium">
                  ⚠️ {(actualPinnedNode || actualHoveredNode)?.criticalIssues} проблем(ы)
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
            if (tooltipHideTimeoutRef.current) {
              clearTimeout(tooltipHideTimeoutRef.current);
              tooltipHideTimeoutRef.current = null;
            }
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
              {/* Марка и сечение - показываем только если есть реальные данные */}
              {((pinnedEdge || hoveredEdge)?.wireType || ((pinnedEdge || hoveredEdge)?.wireSize && (pinnedEdge || hoveredEdge)!.wireSize! > 0)) && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Кабель:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {(pinnedEdge || hoveredEdge)?.wireType} {((pinnedEdge || hoveredEdge)?.wireSize && (pinnedEdge || hoveredEdge)!.wireSize! > 0) ? `${(pinnedEdge || hoveredEdge)?.wireSize}мм²` : ''}
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

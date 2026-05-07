'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Graph } from '@antv/g6';
import type { GraphData, GraphNode, GraphEdge, ElementType } from '@/types';
import { performElkLayout } from '@/lib/elk-layout';

interface NetworkGraphG6Props {
  data: GraphData | null;
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onEmptyClick?: () => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  collapsedTypes?: Set<string>;
  onCollapsedTypesChange?: (types: Set<string>) => void;
  editMode?: boolean;
  selectedElementType?: ElementType | null;
  onCanvasClick?: (x: number, y: number) => void;
  onNodeDrop?: (nodeId: string, x: number, y: number) => void;
  connectionMode?: boolean;
  connectionStartId?: string | null;
  onConnectionCreated?: (sourceId: string, targetId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onUpdateNodeStatus?: (nodeId: string, operationalStatus: 'ON' | 'OFF') => Promise<void>;
  onPropagate?: () => void;
  useElkLayout?: boolean;
}

// ============================================================================
// КОНСТАНТЫ ДИЗАЙНА
// ============================================================================

const TYPE_COLORS: Record<string, { primary: string; gradient: string }> = {
  source: { primary: '#fbbf24', gradient: 'l(0) 0:#eab308 0.5:#22c55e 1:#ef4444' },
  bus: { primary: '#B87333', gradient: 'l(0) 0:#B87333 0.5:#CD7F32 1:#B87333' },
  junction: { primary: '#9ca3af', gradient: 'l(0) 0:#9ca3af 1:#6b7280' },
  breaker: { primary: '#1f2937', gradient: 'l(0) 0:#1f2937 1:#111827' },
  meter: { primary: '#3b82f6', gradient: 'l(0) 0:#3b82f6 1:#2563eb' },
  load: { primary: '#ffffff', gradient: 'l(0) 0:#ffffff 1:#f3f4f6' },
  cabinet: { primary: '#d97706', gradient: 'l(0) 0:#B87333 0.5:#CD7F32 1:#B87333' },
};

const SWITCHABLE_TYPES = ['SOURCE', 'BREAKER', 'LOAD', 'METER'];

function isSwitchable(type: string): boolean {
  return SWITCHABLE_TYPES.includes(type.toUpperCase());
}

// ============================================================================
// РАЗМЕРЫ УЗЛОВ ПО ТИПАМ (для ELK)
// ============================================================================

const NODE_SIZES: Record<string, [number, number]> = {
  source: [160, 80],
  bus: [200, 40],      // Будет расширяться динамически
  breaker: [140, 70],
  meter: [140, 70],
  load: [160, 80],
  cabinet: [180, 50],
  junction: [40, 40],
  transformer: [140, 80],
  default: [160, 80],
};

// ============================================================================
// ПРЕОБРАЗОВАНИЕ ДАННЫХ ДЛЯ ELK
// ============================================================================

interface ProcessedNode {
  id: string;
  combo?: string;
  data: any;
  width: number;
  height: number;
  ports?: Array<{ id: string; side: string }>;
}

interface ProcessedEdge {
  id: string;
  source: string;
  target: string;
  sourcePort?: string;
  targetPort?: string;
  data: any;
}

/**
 * Преобразует данные графа в формат для G6 + ELK
 * Добавляет размеры, порты для FIXED_SIDE
 */
function processDataForElk(data: GraphData): {
  nodes: ProcessedNode[];
  edges: ProcessedEdge[];
  combos: any[];
} {
  // Считаем входящие/исходящие рёбра для каждого узла
  const incomingCount = new Map<string, number>();
  const outgoingCount = new Map<string, number>();
  const incomingEdges = new Map<string, Array<{ id: string; source: string }>>();
  const outgoingEdges = new Map<string, Array<{ id: string; target: string }>>();

  data.nodes.forEach(n => {
    incomingCount.set(n.id, 0);
    outgoingCount.set(n.id, 0);
    incomingEdges.set(n.id, []);
    outgoingEdges.set(n.id, []);
  });

  data.edges.forEach(edge => {
    if (incomingCount.has(edge.target)) {
      incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
      incomingEdges.get(edge.target)?.push({ id: edge.id, source: edge.source });
    }
    if (outgoingCount.has(edge.source)) {
      outgoingCount.set(edge.source, (outgoingCount.get(edge.source) || 0) + 1);
      outgoingEdges.get(edge.source)?.push({ id: edge.id, target: edge.target });
    }
  });

  // Создаём Set существующих ID узлов
  const nodeIds = new Set(data.nodes.map(n => n.id));

  // Обрабатываем узлы
  const nodes: ProcessedNode[] = data.nodes.map(node => {
    const nodeType = (node.type || 'default').toLowerCase();
    const isBus = nodeType === 'bus';
    const isSource = nodeType === 'source';
    const isLoad = nodeType === 'load';
    const isJunction = nodeType === 'junction';

    // Размер по умолчанию
    const defaultSize = NODE_SIZES[nodeType] || NODE_SIZES.default;
    let width = defaultSize[0];
    let height = defaultSize[1];

    // Порты для FIXED_SIDE
    let ports: Array<{ id: string; side: string }> = [];

    if (isBus) {
      // BUS - ширина по количеству подключений
      const total = Math.max(
        incomingCount.get(node.id) || 0,
        outgoingCount.get(node.id) || 0
      );
      width = Math.max(200, total * 60 + 80);

      // Порты для BUS: вход сверху (NORTH), выход снизу (SOUTH)
      const nodeIncoming = incomingEdges.get(node.id) || [];
      const nodeOutgoing = outgoingEdges.get(node.id) || [];

      nodeIncoming.forEach((edge, idx) => {
        ports.push({ id: `${node.id}_IN_${idx}`, side: 'NORTH' });
      });
      nodeOutgoing.forEach((edge, idx) => {
        ports.push({ id: `${node.id}_OUT_${idx}`, side: 'SOUTH' });
      });
    } else if (isSource) {
      // Источник - только выход (SOUTH)
      ports = [{ id: `${node.id}_OUT`, side: 'SOUTH' }];
    } else if (isLoad) {
      // Нагрузка - только вход (NORTH)
      ports = [{ id: `${node.id}_IN`, side: 'NORTH' }];
    } else {
      // Промежуточные узлы - вход сверху (NORTH), выход снизу (SOUTH)
      ports = [
        { id: `${node.id}_IN`, side: 'NORTH' },
        { id: `${node.id}_OUT`, side: 'SOUTH' },
      ];
    }

    return {
      id: node.id,
      combo: (node as any).combo || undefined,
      data: {
        ...node,
        type: nodeType,
        calculatedWidth: isBus ? width : undefined,
        calculatedHeight: isBus ? height : undefined,
      },
      width,
      height,
      // ports ВРЕМЕННО УДАЛЕНЫ для диагностики
    };
  });

  // Обрабатываем рёбра - БЕЗ портов для диагностики
  const edges: ProcessedEdge[] = data.edges
    .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map(edge => {
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        // sourcePort и targetPort ВРЕМЕННО ОТКЛЮЧЕНЫ для диагностики
        data: edge,
      };
    });

  // Combos
  const combos = data.combos?.map(combo => ({
    id: combo.id,
    data: combo.data,
  })) || [];

  return { nodes, edges, combos };
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
  useElkLayout = true,
}: NetworkGraphG6Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const destroyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdge | null>(null);
  const [pendingConnectionStart, setPendingConnectionStart] = useState<string | null>(null);
  const [pinnedNode, setPinnedNode] = useState<GraphNode | null>(null);
  const [pinnedEdge, setPinnedEdge] = useState<GraphEdge | null>(null);
  const [updatingNodeId, setUpdatingNodeId] = useState<string | null>(null);

  const editModeRef = useRef(editMode);
  const connectionModeRef = useRef(connectionMode);
  const selectedElementTypeRef = useRef(selectedElementType);
  const pendingConnectionRef = useRef<string | null>(null);
  const pinnedNodeRef = useRef<GraphNode | null>(null);
  const pinnedEdgeRef = useRef<GraphEdge | null>(null);
  const useElkLayoutRef = useRef(useElkLayout);

  useEffect(() => { editModeRef.current = editMode; }, [editMode]);
  useEffect(() => { connectionModeRef.current = connectionMode; }, [connectionMode]);
  useEffect(() => { selectedElementTypeRef.current = selectedElementType; }, [selectedElementType]);
  useEffect(() => { pendingConnectionRef.current = pendingConnectionStart; }, [pendingConnectionStart]);
  useEffect(() => { pinnedNodeRef.current = pinnedNode; }, [pinnedNode]);
  useEffect(() => { pinnedEdgeRef.current = pinnedEdge; }, [pinnedEdge]);
  useEffect(() => { useElkLayoutRef.current = useElkLayout; }, [useElkLayout]);

  const actualPinnedNode = useMemo(() => {
    if (!pinnedNode || !data) return pinnedNode;
    return data.nodes.find(n => n.id === pinnedNode.id) || pinnedNode;
  }, [pinnedNode, data]);

  const actualHoveredNode = useMemo(() => {
    if (!hoveredNode || !data) return hoveredNode;
    return data.nodes.find(n => n.id === hoveredNode.id) || hoveredNode;
  }, [hoveredNode, data]);

  // Инициализация графа
  useEffect(() => {
    if (!containerRef.current) return;

    if (destroyTimeoutRef.current) {
      clearTimeout(destroyTimeoutRef.current);
      destroyTimeoutRef.current = null;
    }

    const existingGraph = graphRef.current;
    if (existingGraph && !(existingGraph as any).destroyed) {
      console.log('Graph already exists, reusing');
      return;
    }

    if (existingGraph && (existingGraph as any).destroyed) {
      console.log('Graph was destroyed, creating new one');
      graphRef.current = null;
    }

    console.log('Creating new graph with ELK layout');
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

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
        {
          type: 'drag-element',
          enable: () => editModeRef.current && !connectionModeRef.current,
          updateEdge: true,
        },
      ],
      // ELK layout применяется отдельно через elkjs (не встроенный в G6)
      // @antv/layout 2.0.0 НЕ содержит ELK
      node: {
        type: 'rect',
        style: {
          // КРИТИЧЕСКИ ВАЖНО: размер читается из style.width/height (G6 v6)
          // или из корня для обратной совместимости
          size: (d: any) => {
            // В G6 v6 данные приходят в d.style или в корне
            const w = d.style?.width || d.width || 160;
            const h = d.style?.height || d.height || 80;
            return [w, h];
          },
          radius: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            return nodeType === 'bus' ? 0 : 6;
          },
          fill: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            if (nodeType === 'bus') return '#CD7F32';
            return '#ffffff';
          },
          stroke: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            const hasCritical = d.data?.criticalIssues > 0;
            if (hasCritical) return '#ef4444';
            if (nodeType === 'bus') return '#8B5A2B';
            return TYPE_COLORS[nodeType]?.primary || '#e2e8f0';
          },
          lineWidth: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            return nodeType === 'bus' ? 3 : 2;
          },
          shadowColor: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            return nodeType === 'bus' ? 'transparent' : 'rgba(0, 0, 0, 0.15)';
          },
          shadowBlur: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            return nodeType === 'bus' ? 0 : 10;
          },
          shadowOffsetX: 0,
          shadowOffsetY: 4,
          cursor: 'pointer',
          anchorPoints: [
            [0.5, 0],
            [0.5, 1],
          ],
          portR: 4,
          portLinkToCenter: true,
          labelText: (d: any) => {
            const name = d.data?.name || d.id;
            const nodeType = (d.data?.type || 'load').toLowerCase();
            if (nodeType === 'bus') return '';
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
          connectionSource: {
            stroke: '#22c55e',
            lineWidth: 4,
            shadowColor: 'rgba(34, 197, 94, 0.5)',
            shadowBlur: 20,
          },
          connectionTarget: {
            stroke: '#f59e0b',
            lineWidth: 3,
            shadowColor: 'rgba(245, 158, 11, 0.4)',
            shadowBlur: 15,
          },
        },
      },
      edge: {
        type: 'polyline',
        style: {
          stroke: (d: any) => {
            const lifeStatus = d.data?.lifeStatus;
            return lifeStatus === 'LIVE' ? '#22c55e' : '#94a3b8';
          },
          lineWidth: 2,
          endArrow: false,
          radius: 8,
          offset: 40,
          loopOffset: 50,
          sourceAnchor: 1,
          targetAnchor: 0,
          opacity: (d: any) => {
            const status = d.data?.status;
            return status === 'OFF' ? 0.4 : 1;
          },
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

      if (connectionModeRef.current) {
        const pending = pendingConnectionRef.current;
        if (!pending) {
          setPendingConnectionStart(nodeId);
          try {
            graph.setElementState(nodeId, 'connectionSource', true);
          } catch (e) {}
        } else if (pending !== nodeId) {
          onConnectionCreated?.(pending, nodeId);
          try {
            graph.setElementState(pending, 'connectionSource', false);
          } catch (e) {}
          setPendingConnectionStart(null);
        }
        return;
      }

      const nodeData = data?.nodes.find(n => n.id === nodeId);
      if (nodeData) {
        setPinnedNode(nodeData);
        setPinnedEdge(null);
        setHoveredNode(null);
        setHoveredEdge(null);
      }

      onNodeClick?.(nodeId);
    });

    graph.on('node:pointerenter', (evt: any) => {
      const nodeId = evt.target.id;
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;

      if (tooltipHideTimeoutRef.current) {
        clearTimeout(tooltipHideTimeoutRef.current);
        tooltipHideTimeoutRef.current = null;
      }

      setHoveredEdge(null);
      const nodeData = data?.nodes.find(n => n.id === nodeId);
      setHoveredNode(nodeData || null);

      if (connectionModeRef.current && pendingConnectionRef.current && pendingConnectionRef.current !== nodeId) {
        try {
          graph.setElementState(nodeId, 'connectionTarget', true);
        } catch (e) {}
      } else {
        try {
          graph.setElementState(nodeId, 'hover', true);
        } catch (e) {}
      }
    });

    graph.on('node:pointerleave', (evt: any) => {
      const nodeId = evt.target.id;
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;

      if (!pinnedNodeRef.current) {
        tooltipHideTimeoutRef.current = setTimeout(() => {
          setHoveredNode(null);
          tooltipHideTimeoutRef.current = null;
        }, 300);
      }

      if (connectionModeRef.current && pendingConnectionRef.current) {
        try {
          graph.setElementState(nodeId, 'connectionTarget', false);
        } catch (e) {}
      } else {
        try {
          graph.setElementState(nodeId, 'hover', false);
        } catch (e) {}
      }
    });

    graph.on('edge:click', (evt: any) => {
      const edgeId = evt.target.id;
      const edgeData = data?.edges.find(e => e.id === edgeId);
      if (edgeData) {
        setPinnedEdge(edgeData);
        setPinnedNode(null);
        setHoveredNode(null);
        setHoveredEdge(null);
      }
      onEdgeClick?.(edgeId);
    });

    graph.on('edge:pointerenter', (evt: any) => {
      const edgeId = evt.target.id;
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;

      const edgeData = data?.edges.find(e => e.id === edgeId);
      if (edgeData) {
        setHoveredEdge(edgeData);
        setHoveredNode(null);
      }

      try {
        graph.setElementState(edgeId, 'hover', true);
      } catch (e) {}
    });

    graph.on('edge:pointerleave', (evt: any) => {
      const edgeId = evt.target.id;
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;

      if (!pinnedEdgeRef.current) {
        tooltipHideTimeoutRef.current = setTimeout(() => {
          setHoveredEdge(null);
          tooltipHideTimeoutRef.current = null;
        }, 300);
      }

      try {
        graph.setElementState(edgeId, 'hover', false);
      } catch (e) {}
    });

    graph.on('canvas:click', (evt: any) => {
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;

      setPinnedNode(null);
      setPinnedEdge(null);

      if (connectionModeRef.current && pendingConnectionRef.current) {
        try {
          graph.setElementState(pendingConnectionRef.current, 'connectionSource', false);
        } catch (e) {}
        setPendingConnectionStart(null);
        return;
      }

      if (editModeRef.current && selectedElementTypeRef.current && onCanvasClick) {
        let x = 0, y = 0;

        if (evt.x !== undefined && evt.y !== undefined) {
          x = evt.x;
          y = evt.y;
        } else if (evt.canvas) {
          x = evt.canvas.x ?? 0;
          y = evt.canvas.y ?? 0;
        } else if (evt.clientX !== undefined) {
          x = evt.clientX;
          y = evt.clientY;
        } else {
          x = 400;
          y = 300;
        }

        console.log('Canvas click coordinates:', { x, y, evt });
        onCanvasClick(x, y);
      } else {
        onEmptyClick?.();
      }
    });

    graph.on('node:dragend', (evt: any) => {
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;

      if (editModeRef.current) {
        const nodeId = evt.target.id;
        const { x, y } = evt;

        if (onNodeDrop) {
          onNodeDrop(nodeId, x, y);
        }

        if (typeof graph.layout === 'function') {
          graph.layout();
        }
      }
    });

    graph.on('viewport:zoom', () => {
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;
      const zoom = graph.getZoom();
      onZoomChange?.(zoom);
    });

    const resizeObserver = new ResizeObserver((entries) => {
      const graph = graphRef.current;
      if (!graph || (graph as any).destroyed) return;
      const { width: newWidth, height: newHeight } = entries[0].contentRect;
      try {
        graph.resize(newWidth, newHeight);
      } catch (e) {}
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []); // Граф создаётся один раз

  // Единый эффект: обработка данных + ELK layout + рендер
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !data) return;

    if ((graph as any).destroyed) return;

    const processDataAndLayout = async () => {
      try {
        console.log('[G6] Processing data and applying ELK layout...');

        // ===== ШАГ 1: Пре-процессинг данных =====
        const { nodes, edges, combos } = processDataForElk(data);
        console.log('[G6] Processed nodes:', nodes.length, 'edges:', edges.length);

        // ===== ШАГ 2: Выполняем ELK layout =====
        const elkNodes = nodes.map(node => ({
          id: node.id,
          type: node.data?.type,
        }));

        const elkEdges = edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
        }));

        const elkResult = await performElkLayout(elkNodes, elkEdges);

        // ===== ШАГ 3: Подготавливаем данные для рёбер с маршрутами =====
        const edgesData = edges.map(edge => {
          const route = elkResult?.edges.get(edge.id);
          if (route && route.points.length >= 2) {
            return {
              id: edge.id,
              source: edge.source,
              target: edge.target,
              data: edge.data,
              style: {
                controlPoints: route.points,
              },
            };
          }
          return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            data: edge.data,
          };
        });

        // ===== ШАГ 4: Применяем к графу =====
        if ((graph as any).destroyed) return;

        const isFirstRender = !(graph as any).rendered;

        // Подготавливаем данные узлов БЕЗ позиций (позиции установим через API)
        const nodesData = nodes.map(node => ({
          id: node.id,
          data: node.data,
          combo: node.combo,
          style: {
            width: node.width,
            height: node.height,
          },
        }));

        if (isFirstRender) {
          // Первый раз - setData + render
          graph.setData({
            nodes: nodesData as any,
            edges: edgesData as any,
            combos,
          });
          graph.render();
          (graph as any).rendered = true;
          console.log('[G6] First render done');
        } else {
          // Инкрементальное обновление
          graph.setData({
            nodes: nodesData as any,
            edges: edgesData as any,
            combos,
          });
          console.log('[G6] Data updated');
        }

        // ===== ШАГ 5: Устанавливаем позиции через API =====
        // translateNodeTo - правильный метод для перемещения узлов в G6 v6
        // Используем (graph as any) т.к. метод не экспортируется в типах
        let movedCount = 0;
        for (const node of nodes) {
          const pos = elkResult?.nodes.get(node.id);
          if (pos) {
            try {
              (graph as any).translateNodeTo(node.id, { x: pos.x, y: pos.y });
              movedCount++;
            } catch (e) {
              // Игнорируем ошибки
            }
          }
        }

        console.log('[G6] Nodes moved via translateNodeTo:', movedCount);

        // Фит к экрану
        graph.fitView();
        console.log('[G6] Layout complete, fitView applied');

      } catch (error) {
        console.error('[G6] Process error:', error);
      }
    };

    processDataAndLayout();

  }, [data]);

  // Внешний zoom
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !externalZoom) return;

    if ((graph as any).destroyed || !(graph as any).rendered) return;

    try {
      graph.zoomTo(externalZoom);
    } catch (e) {}
  }, [externalZoom]);

  // Сброс состояния связи
  useEffect(() => {
    const graph = graphRef.current;
    if (!connectionMode && pendingConnectionStart && graph) {
      if (!(graph as any).destroyed) {
        try {
          graph.setElementState(pendingConnectionStart, 'connectionSource', false);
        } catch {}
      }
      setPendingConnectionStart(null);
    }
  }, [connectionMode, pendingConnectionStart]);

  // Финальный cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const graph = graphRef.current;
      if (graph) {
        if (!(graph as any).destroyed) {
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
      />

      {editMode && (
        <div className="absolute top-4 left-4 px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg shadow-lg z-10">
          ✏️ Режим редактирования
        </div>
      )}

      {connectionMode && (
        <div className="absolute top-4 left-4 px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg shadow-lg z-10">
          🔗 {pendingConnectionStart ? 'Выберите целевой элемент' : 'Выберите начальный элемент'}
        </div>
      )}

      {(hoveredNode || pinnedNode) && (
        <div
          className="absolute bottom-4 right-4 p-4 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 text-sm max-w-sm z-20"
          onMouseEnter={() => {
            if (tooltipHideTimeoutRef.current) {
              clearTimeout(tooltipHideTimeoutRef.current);
              tooltipHideTimeoutRef.current = null;
            }
          }}
          onMouseDown={(e) => { e.stopPropagation(); }}
          onClick={(e) => { e.stopPropagation(); }}
          onMouseLeave={() => {
            if (!pinnedNode) {
              setHoveredNode(null);
            }
          }}
        >
          <div className="space-y-2">
            <div className="border-b border-slate-200 dark:border-slate-700 pb-2 flex justify-between items-start">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 text-base">{(actualPinnedNode || actualHoveredNode)?.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">ID: {(actualPinnedNode || actualHoveredNode)?.id} | Тип: {(actualPinnedNode || actualHoveredNode)?.type.toLowerCase()}</div>
              </div>
              {actualPinnedNode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinnedNode(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

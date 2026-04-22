'use client';

import { useEffect, useRef, useState } from 'react';
import { Graph } from '@antv/g6';
import type { GraphData, GraphNode, GraphEdge } from '@/types';

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

// Английские названия типов
const TYPE_LABELS: Record<string, string> = {
  source: 'SOURCE',
  breaker: 'BREAKER',
  load: 'LOAD',
  meter: 'METER',
  bus: 'BUS',
  junction: 'JUNCTION',
  cabinet: 'CABINET',
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
}: NetworkGraphG6Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  // Инициализация графа
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
      onNodeClick?.(nodeId);
    });

    graph.on('node:pointerenter', (evt: any) => {
      const nodeId = evt.target.id;
      const nodeData = data?.nodes.find(n => n.id === nodeId);
      setHoveredNode(nodeData || null);
      graph.setElementState(nodeId, 'hover', true);
    });

    graph.on('node:pointerleave', (evt: any) => {
      setHoveredNode(null);
      const nodeId = evt.target.id;
      graph.setElementState(nodeId, 'hover', false);
    });

    graph.on('edge:click', (evt: any) => {
      const edgeId = evt.target.id;
      onEdgeClick?.(edgeId);
    });

    graph.on('canvas:click', () => {
      onEmptyClick?.();
    });

    // Zoom событие
    graph.on('viewport:zoom', () => {
      const zoom = graph.getZoom();
      onZoomChange?.(zoom);
    });

    // Респонсив
    const resizeObserver = new ResizeObserver((entries) => {
      const { width: newWidth, height: newHeight } = entries[0].contentRect;
      graph.resize(newWidth, newHeight);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      graph.destroy();
    };
  }, []);

  // Обновление данных
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !data) return;

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
      data: edge,
    }));

    graph.setData({ nodes, edges });
    graph.render();
  }, [data]);

  // Выделение выбранного узла
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    // Снимаем выделение со всех
    graph.getNodes().forEach(node => {
      graph.setElementState(node.id, 'selected', false);
    });

    // Выделяем выбранный
    if (selectedNodeId) {
      graph.setElementState(selectedNodeId, 'selected', true);
    }
  }, [selectedNodeId]);

  // Выделение выбранного ребра
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    // Снимаем выделение со всех
    graph.getEdges().forEach(edge => {
      graph.setElementState(edge.id, 'selected', false);
    });

    // Выделяем выбранный
    if (selectedEdgeId) {
      graph.setElementState(selectedEdgeId, 'selected', true);
    }
  }, [selectedEdgeId]);

  // Внешний zoom
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !externalZoom) return;

    graph.zoomTo(externalZoom);
  }, [externalZoom]);

  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-950 relative">
      <div
        ref={containerRef}
        className="h-full w-full"
      />

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

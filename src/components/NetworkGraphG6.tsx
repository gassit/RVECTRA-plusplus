'use client';

import { useEffect, useRef } from 'react';
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
}

// ============================================================================
// КОНСТАНТЫ ДИЗАЙНА
// ============================================================================

// Цвета заголовков по типам элементов (медный градиент)
const TYPE_COLORS: Record<string, { primary: string; gradient: string }> = {
  source: { primary: '#22c55e', gradient: 'l(0) 0:#22c55e 1:#16a34a' },
  bus: { primary: '#B87333', gradient: 'l(0) 0:#B87333 0.5:#CD7F32 1:#B87333' },
  junction: { primary: '#9ca3af', gradient: 'l(0) 0:#9ca3af 1:#6b7280' },
  breaker: { primary: '#1f2937', gradient: 'l(0) 0:#1f2937 1:#111827' },
  meter: { primary: '#3b82f6', gradient: 'l(0) 0:#3b82f6 1:#2563eb' },
  load: { primary: '#f3f4f6', gradient: 'l(0) 0:#ffffff 1:#f3f4f6' },
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
      padding: [80, 80, 80, 80],
      behaviors: [
        'drag-canvas',
        'zoom-canvas',
        {
          type: 'click-select',
          trigger: 'click',
          multiple: false,
        },
      ],
      layout: {
        type: 'dagre',
        rankdir: 'TB',
        nodesep: 80,
        ranksep: 120,
        preventOverlap: true,
      },
      node: {
        type: 'rect',
        style: {
          size: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            if (nodeType === 'cabinet') {
              return [180, 45];
            }
            return [150, 80];
          },
          radius: 8,
          fill: '#ffffff',
          stroke: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            return TYPE_COLORS[nodeType]?.primary || '#e2e8f0';
          },
          lineWidth: 2,
          shadowColor: 'rgba(0, 0, 0, 0.1)',
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowOffsetY: 4,
          // Основной текст - название
          labelText: (d: any) => d.data?.name || d.id,
          labelFill: '#000000',
          labelFontSize: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            return nodeType === 'cabinet' ? 17 : 11;
          },
          labelFontWeight: 'bold',
          labelPlacement: 'center',
          labelOffsetY: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            return nodeType === 'cabinet' ? 0 : -10;
          },
          labelMaxWidth: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            return nodeType === 'cabinet' ? 160 : 130;
          },
          // Badge - тип элемента
          badgeText: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            return TYPE_LABELS[nodeType] || '';
          },
          badgeFill: (d: any) => {
            const nodeType = (d.data?.type || 'load').toLowerCase();
            return TYPE_COLORS[nodeType]?.primary || '#9ca3af';
          },
          badgeFontSize: 9,
          badgeFontWeight: 'bold',
          badgeFillOpacity: 0.9,
          badgePadding: [4, 8, 4, 8],
          badgeRadius: 4,
          badgeOffsetX: 0,
          badgeOffsetY: -45,
          // Второй badge - статус LIVE/DEAD
          badgeText2: (d: any) => {
            const lifeStatus = d.data?.lifeStatus;
            return lifeStatus === 'LIVE' ? 'LIVE' : 'DEAD';
          },
          badgeFill2: (d: any) => {
            const lifeStatus = d.data?.lifeStatus;
            return lifeStatus === 'LIVE' ? '#22c55e' : '#6b7280';
          },
          badgeFontSize2: 8,
          badgePadding2: [2, 6, 2, 6],
          badgeRadius2: 3,
          badgeOffsetX2: 50,
          badgeOffsetY2: 25,
          // Третий badge - статус ON/OFF
          badgeText3: (d: any) => {
            const status = d.data?.status;
            return status === 'OFF' ? 'OFF' : 'ON';
          },
          badgeFill3: (d: any) => {
            const status = d.data?.status;
            return status === 'OFF' ? '#ef4444' : '#3b82f6';
          },
          badgeFontSize3: 8,
          badgePadding3: [2, 6, 2, 6],
          badgeRadius3: 3,
          badgeOffsetX3: -50,
          badgeOffsetY3: 25,
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
              return `${wireType} ${wireSize}мм²`;
            }
            return '';
          },
          labelFill: '#64748b',
          labelFontSize: 8,
          labelBackground: true,
          labelBackgroundFill: '#ffffff',
          labelBackgroundOpacity: 0.95,
          labelBackgroundRadius: 4,
          labelPadding: [2, 4, 2, 4],
          // Индикатор статуса на ребре
          badgeText: (d: any) => {
            const lifeStatus = d.data?.lifeStatus;
            return lifeStatus === 'LIVE' ? '●' : '○';
          },
          badgeFill: (d: any) => {
            const lifeStatus = d.data?.lifeStatus;
            return lifeStatus === 'LIVE' ? '#22c55e' : '#94a3b8';
          },
          badgeFontSize: 10,
          badgeOffsetY: -15,
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

    graph.on('edge:click', (evt: any) => {
      const edgeId = evt.target.id;
      onEdgeClick?.(edgeId);
    });

    graph.on('canvas:click', () => {
      onEmptyClick?.();
    });

    // Zoom событие
    graph.on('viewport:zoom', (evt: any) => {
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
    <div
      ref={containerRef}
      className="h-full w-full bg-slate-100 dark:bg-slate-950"
    />
  );
}

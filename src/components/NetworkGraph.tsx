'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { Zap } from 'lucide-react';
import type { GraphData, GraphNode, GraphEdge } from '@/types';

interface NetworkGraphProps {
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
const TYPE_HEADER_COLORS: Record<string, { primary: string; secondary: string; gradient: string }> = {
  source: {
    primary: '#fbbf24',
    secondary: '#22c55e',
    gradient: 'url(#sourceGradient)'
  },
  bus: {
    primary: '#d97706',
    secondary: '#b45309',
    gradient: 'url(#busGradient)'
  },
  junction: {
    primary: '#9ca3af',
    secondary: '#6b7280',
    gradient: 'url(#junctionGradient)'
  },
  breaker: {
    primary: '#1f2937',
    secondary: '#111827',
    gradient: 'url(#breakerGradient)'
  },
  meter: {
    primary: '#3b82f6',
    secondary: '#2563eb',
    gradient: 'url(#meterGradient)'
  },
  load: {
    primary: '#ffffff',
    secondary: '#f3f4f6',
    gradient: 'url(#loadGradient)'
  },
  cabinet: {
    primary: '#d97706',
    secondary: '#b45309',
    gradient: 'url(#busGradient)'
  },
};

// Пути к иконкам для каждого типа
const TYPE_ICONS: Record<string, string> = {
  source: '/source.jpg',
  breaker: '/breaker.jpg',
  load: '/load.jpg',
  meter: '/meter.jpg',
  junction: '/junction.jpg',
  bus: '',
  cabinet: '',
};

// Английские названия типов для отображения
const TYPE_LABELS: Record<string, string> = {
  source: 'SOURCE',
  breaker: 'BREAKER',
  load: 'LOAD',
  meter: 'METER',
  bus: 'BUS',
  junction: 'JUNCTION',
  cabinet: 'CABINET',
};

// Цвета иконок в круге
const TYPE_ICON_COLORS: Record<string, string> = {
  source: '#fbbf24',
  bus: '#d97706',
  junction: '#9ca3af',
  breaker: '#1f2937',
  meter: '#3b82f6',
  load: '#ffffff',
  cabinet: '#d97706',
};

// ============================================================================
// ТИПЫ ДЛЯ ЛЭЙАУТА
// ============================================================================

// Локальный уровень элемента
type LocalLevel = 'TOP' | 'DISTRIBUTION' | 'CONSUMER';

// Информация о позиции узла
interface NodeLayoutInfo {
  node: GraphNode;
  localLevel: LocalLevel;
  sourceId: string;           // ID источника, к которому принадлежит
  branchIndex: number;        // Индекс ветки (для ветвления от BUS/JUNCTION)
  depthInLevel: number;       // Глубина внутри уровня
  column: number;             // Колонка (для параллельных веток)
  x: number;
  y: number;
}

// Дерево источника
interface SourceTree {
  sourceId: string;
  sourceNode: GraphNode;
  branches: Branch[];         // Ветки от источника
}

// Ветка от источника или узла ветвления
interface Branch {
  id: string;
  parentId: string;           // ID элемента, от которого идёт ветка
  nodes: GraphNode[];         // Узлы в ветке (упорядочены сверху вниз)
  childBranches: Branch[];    // Дочерние ветки (от BUS/JUNCTION)
}

// ============================================================================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================================================================

export default function NetworkGraph({
  data,
  onNodeClick,
  onEdgeClick,
  onEmptyClick,
  selectedNodeId,
  selectedEdgeId,
  zoom: externalZoom,
  onZoomChange,
  collapsedTypes: externalCollapsedTypes,
  onCollapsedTypesChange
}: NetworkGraphProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  const [internalZoom, setInternalZoom] = useState(1);
  const zoom = externalZoom ?? internalZoom;
  const setZoom = onZoomChange ?? setInternalZoom;

  const [internalCollapsedTypes, setInternalCollapsedTypes] = useState<Set<string>>(new Set());
  const collapsedTypes = externalCollapsedTypes ?? internalCollapsedTypes;
  const setCollapsedTypes = onCollapsedTypesChange ?? setInternalCollapsedTypes;

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ========================================================================
  // АЛГОРИТМ ЛЭЙАУТА С ЛОКАЛЬНОЙ ТРЁХУРОВНЕВОЙ ИЕРАРХИЕЙ
  // ========================================================================

  const layoutData = useMemo(() => {
    if (!data || data.nodes.length === 0) return null;

    // Размеры узлов
    const NODE_WIDTH = 140;
    const NODE_HEIGHT = 70;
    const HORIZONTAL_GAP = 40;
    const VERTICAL_GAP = 80;
    const BRANCH_GAP = 60;
    const START_X = 100;
    const START_Y = 80;

    // Создаём граф связности
    const adjacencyList: Map<string, string[]> = new Map();
    const reverseAdjacency: Map<string, string[]> = new Map();
    const nodeMap: Map<string, GraphNode> = new Map();

    data.nodes.forEach(node => {
      adjacencyList.set(node.id, []);
      reverseAdjacency.set(node.id, []);
      nodeMap.set(node.id, node);
    });

    data.edges.forEach(edge => {
      adjacencyList.get(edge.source)?.push(edge.target);
      reverseAdjacency.get(edge.target)?.push(edge.source);
    });

    // Определяем локальный уровень для элемента
    const getLocalLevel = (node: GraphNode, pathFromSource: GraphNode[]): LocalLevel => {
      const type = node.type.toLowerCase();

      // LOAD всегда на Consumer Level
      if (type === 'load') return 'CONSUMER';

      // Проверяем, была ли уже BUS на пути
      const hasBus = pathFromSource.some(n => n.type.toLowerCase() === 'bus');

      if (type === 'bus') {
        return 'DISTRIBUTION';
      }

      if (hasBus) {
        // После BUS - Distribution или Consumer
        if (type === 'junction') return 'DISTRIBUTION';
        if (type === 'meter') return 'DISTRIBUTION';
        if (type === 'breaker') return 'DISTRIBUTION';
        return 'CONSUMER';
      } else {
        // До первой BUS - Top Level
        return 'TOP';
      }
    };

    // Находим все источники (SOURCE)
    const sources = data.nodes.filter(n => n.type.toLowerCase() === 'source');

    // Если источников нет, ищем узлы без входящих связей
    const rootNodes = sources.length > 0 ? sources :
      data.nodes.filter(n => (reverseAdjacency.get(n.id)?.length ?? 0) === 0);

    // Строим деревья от каждого источника
    const buildBranch = (
      startNodeId: string,
      parentId: string,
      visited: Set<string>,
      pathFromSource: GraphNode[]
    ): { nodes: GraphNode[], childBranches: Branch[] } => {
      const nodes: GraphNode[] = [];
      const childBranches: Branch[] = [];
      const queue: string[] = [startNodeId];
      let currentNodeId = startNodeId;

      while (currentNodeId && !visited.has(currentNodeId)) {
        visited.add(currentNodeId);
        const node = nodeMap.get(currentNodeId);
        if (!node) break;

        nodes.push(node);
        const currentType = node.type.toLowerCase();

        // Точки ветвления: BUS и JUNCTION
        if (currentType === 'bus' || currentType === 'junction') {
          // Находим все исходящие связи (кроме уже посещённых)
          const children = (adjacencyList.get(currentNodeId) || [])
            .filter(id => !visited.has(id));

          if (children.length > 1) {
            // Ветвление - создаём дочерние ветки
            children.forEach((childId, idx) => {
              const childVisited = new Set(visited);
              const childBranch = buildBranch(
                childId,
                currentNodeId,
                childVisited,
                [...pathFromSource, node]
              );
              childBranches.push({
                id: `${currentNodeId}-branch-${idx}`,
                parentId: currentNodeId,
                nodes: childBranch.nodes,
                childBranches: childBranch.childBranches
              });
            });
            break; // Прерываем текущую ветку
          } else if (children.length === 1) {
            currentNodeId = children[0];
            pathFromSource = [...pathFromSource, node];
          } else {
            break;
          }
        } else if (currentType === 'load') {
          // LOAD - конец ветки
          break;
        } else {
          // Продолжаем вниз
          const children = (adjacencyList.get(currentNodeId) || [])
            .filter(id => !visited.has(id));

          if (children.length > 0) {
            currentNodeId = children[0];
            pathFromSource = [...pathFromSource, node];
            // Если есть ещё дети - создаём ветки
            if (children.length > 1) {
              for (let i = 1; i < children.length; i++) {
                const childVisited = new Set(visited);
                const childBranch = buildBranch(
                  children[i],
                  currentNodeId,
                  childVisited,
                  [...pathFromSource, node]
                );
                childBranches.push({
                  id: `${currentNodeId}-branch-${i}`,
                  parentId: currentNodeId,
                  nodes: childBranch.nodes,
                  childBranches: childBranch.childBranches
                });
              }
            }
          } else {
            break;
          }
        }
      }

      return { nodes, childBranches };
    };

    // Вычисляем ширину ветки с учётом всех дочерних веток
    const calculateBranchWidth = (branch: Branch): number => {
      if (branch.childBranches.length === 0) {
        return NODE_WIDTH;
      }
      const childrenWidth = branch.childBranches.reduce(
        (sum, child) => sum + calculateBranchWidth(child) + BRANCH_GAP,
        -BRANCH_GAP
      );
      return Math.max(NODE_WIDTH, childrenWidth);
    };

    // Размещаем ветку рекурсивно
    const layoutBranch = (
      branch: Branch,
      startX: number,
      startY: number,
      sourceId: string,
      branchIndex: number,
      positionedNodes: NodeLayoutInfo[]
    ): { maxX: number; maxY: number } => {
      let currentY = startY;
      let currentX = startX;
      let maxWidth = NODE_WIDTH;

      // Размещаем узлы ветки
      branch.nodes.forEach((node, idx) => {
        const pathFromSource: GraphNode[] = [];
        const localLevel = getLocalLevel(node, pathFromSource);

        const layoutInfo: NodeLayoutInfo = {
          node,
          localLevel,
          sourceId,
          branchIndex,
          depthInLevel: idx,
          column: 0,
          x: currentX,
          y: currentY
        };
        positionedNodes.push(layoutInfo);
        currentY += NODE_HEIGHT + VERTICAL_GAP;
      });

      const lastNodeY = currentY - VERTICAL_GAP - NODE_HEIGHT;

      // Размещаем дочерние ветки
      if (branch.childBranches.length > 0) {
        const totalWidth = branch.childBranches.reduce(
          (sum, child) => sum + calculateBranchWidth(child) + BRANCH_GAP,
          -BRANCH_GAP
        );

        // Центрируем относительно родительской ветки
        let childX = startX + (NODE_WIDTH - totalWidth) / 2;

        branch.childBranches.forEach((childBranch, childIdx) => {
          const childWidth = calculateBranchWidth(childBranch);
          const result = layoutBranch(
            childBranch,
            childX,
            currentY,
            sourceId,
            childIdx,
            positionedNodes
          );
          childX += childWidth + BRANCH_GAP;
          if (result.maxY > currentY) currentY = result.maxY;
          if (result.maxX > maxWidth) maxWidth = result.maxX;
        });
      }

      return {
        maxX: startX + maxWidth,
        maxY: currentY
      };
    };

    // Строим и размещаем деревья от каждого источника
    const positionedNodes: NodeLayoutInfo[] = [];
    let currentSourceX = START_X;
    let maxY = START_Y;

    rootNodes.forEach((sourceNode, sourceIdx) => {
      const visited = new Set<string>();

      // Строем главную ветку от источника
      const { nodes, childBranches } = buildBranch(
        sourceNode.id,
        '',
        visited,
        []
      );

      const mainBranch: Branch = {
        id: `source-${sourceNode.id}`,
        parentId: '',
        nodes,
        childBranches
      };

      // Размещаем дерево источника
      const result = layoutBranch(
        mainBranch,
        currentSourceX,
        START_Y,
        sourceNode.id,
        0,
        positionedNodes
      );

      // Обновляем позицию для следующего источника
      const treeWidth = calculateBranchWidth(mainBranch);
      currentSourceX += treeWidth + HORIZONTAL_GAP * 3;
      if (result.maxY > maxY) maxY = result.maxY;
    });

    // Преобразуем в формат для рендеринга
    const finalNodes: GraphNode[] = positionedNodes.map(info => ({
      ...info.node,
      posX: info.x,
      posY: info.y
    }));

    // Создаём рёбра для отрисовки (с учётом позиций)
    const positionedNodeMap = new Map(positionedNodes.map(n => [n.node.id, n]));

    return {
      nodes: finalNodes,
      edges: data.edges,
      positionedNodes,
      nodeMap: positionedNodeMap
    };
  }, [data, collapsedTypes]);

  // ========================================================================
  // ВЫЧИСЛЕНИЕ ГРАНИЦ ГРАФА
  // ========================================================================

  const bounds = useMemo(() => {
    if (!layoutData || layoutData.nodes.length === 0) {
      return {
        minX: 0, maxX: 1200, minY: 0, maxY: 800,
        width: 1200, height: 800,
      };
    }

    const padding = 200;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    layoutData.nodes.forEach(node => {
      if (node.posX < minX) minX = node.posX;
      if (node.posX > maxX) maxX = node.posX;
      if (node.posY < minY) minY = node.posY;
      if (node.posY > maxY) maxY = node.posY;
    });

    return {
      minX: minX - padding,
      maxX: maxX + padding + 140,
      minY: minY - padding,
      maxY: maxY + padding,
      width: maxX - minX + padding * 2 + 140,
      height: maxY - minY + padding * 2,
    };
  }, [layoutData]);

  // ========================================================================
  // ОБРАБОТЧИКИ СОБЫТИЙ
  // ========================================================================

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(Math.max(0.25, Math.min(3, zoom + delta)));
  }, [zoom, setZoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && e.target === e.currentTarget) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ========================================================================
  // РЕНДЕРИНГ
  // ========================================================================

  if (!layoutData || layoutData.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="text-center">
          <Zap className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-700 mb-4" />
          <p className="text-slate-500 dark:text-slate-400">Нет данных для отображения</p>
          <p className="text-sm text-slate-400 dark:text-slate-600 mt-1">Нажмите "Импорт" для загрузки данных</p>
        </div>
      </div>
    );
  }

  const transformX = (x: number) => x - bounds.minX;
  const transformY = (y: number) => y - bounds.minY;

  const svgWidth = Math.max(1200, bounds.width) * zoom;
  const svgHeight = Math.max(800, bounds.height) * zoom;

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#020617' : '#f1f5f9';
  const nodeBgColor = isDark ? '#1e293b' : '#ffffff';
  const nodeBorderColor = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const mutedTextColor = isDark ? '#64748b' : '#94a3b8';
  const edgeColor = isDark ? '#3b82f6' : '#60a5fa';
  const edgeInactiveColor = isDark ? '#64748b' : '#94a3b8';

  const handleSvgClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onEmptyClick?.();
    }
  };

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col bg-slate-100 dark:bg-slate-950 relative overflow-hidden"
    >
      {/* SVG граф с pan/zoom */}
      <div
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          width="100%"
          height="100%"
          style={{
            backgroundColor: bgColor,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
          onClick={handleSvgClick}
        >
          <defs>
            {/* Градиент для Source (желтый-зеленый-красный) */}
            <linearGradient id="sourceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#eab308" />
              <stop offset="50%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>

            {/* Градиент для Bus (медный цвет) */}
            <linearGradient id="busGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#B87333" />
              <stop offset="50%" stopColor="#CD7F32" />
              <stop offset="100%" stopColor="#B87333" />
            </linearGradient>

            {/* Градиент для Breaker (черный) */}
            <linearGradient id="breakerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1f2937" />
              <stop offset="100%" stopColor="#111827" />
            </linearGradient>

            {/* Градиент для Meter (синий) */}
            <linearGradient id="meterGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>

            {/* Градиент для Load (белый) */}
            <linearGradient id="loadGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f3f4f6" />
            </linearGradient>

            {/* Градиент для Junction (серый) */}
            <linearGradient id="junctionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#9ca3af" />
              <stop offset="100%" stopColor="#6b7280" />
            </linearGradient>

            {/* Фильтр тени для блоков */}
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2"/>
            </filter>

            {/* Градиент для Live статуса */}
            <linearGradient id="liveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
          </defs>

          <g onClick={handleSvgClick}>
            {/* Рёбра (связи) - вертикальные линии */}
            <g className="edges">
              {layoutData.edges.map(edge => {
                const sourceInfo = layoutData.nodeMap.get(edge.source);
                const targetInfo = layoutData.nodeMap.get(edge.target);
                if (!sourceInfo || !targetInfo) return null;

                const sourceNode = sourceInfo.node;
                const targetNode = targetInfo.node;

                // Координаты центров узлов
                const x1 = transformX(sourceNode.posX) + 70;
                const y1 = transformY(sourceNode.posY) + 70;
                const x2 = transformX(targetNode.posX) + 70;
                const y2 = transformY(targetNode.posY);

                const isHovered = edge.id === hoveredEdge;
                const isSelected = edge.id === selectedEdgeId;
                const isLive = edge.lifeStatus === 'LIVE';
                const isOn = edge.status === 'ON';

                // Определяем тип соединения для стиля линии
                const isBusbar = edge.type === 'BUSBAR';
                const isJumper = edge.type === 'JUMPER';

                return (
                  <g
                    key={edge.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdgeClick?.(edge.id);
                    }}
                    onMouseEnter={() => setHoveredEdge(edge.id)}
                    onMouseLeave={() => setHoveredEdge(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Вертикальная линия связи */}
                    {!isBusbar && (
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={isLive ? edgeColor : edgeInactiveColor}
                        strokeWidth={isHovered || isSelected ? 3 : 2}
                        strokeDasharray={isJumper ? '5,5' : 'none'}
                        opacity={isOn ? 1 : 0.4}
                        className="transition-all duration-200"
                      />
                    )}

                    {/* Горизонтальная шина (если BUSBAR) */}
                    {isBusbar && (
                      <line
                        x1={Math.min(x1, x2)}
                        y1={(y1 + y2) / 2}
                        x2={Math.max(x1, x2)}
                        y2={(y1 + y2) / 2}
                        stroke="#B87333"
                        strokeWidth={isHovered || isSelected ? 6 : 4}
                        opacity={isOn ? 1 : 0.4}
                        className="transition-all duration-200"
                      />
                    )}

                    {/* Подсветка при наведении */}
                    {isHovered && !isBusbar && (
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={edgeColor}
                        strokeWidth={8}
                        opacity={0.2}
                      />
                    )}

                    {/* Подпись кабеля */}
                    {edge.wireType && edge.wireSize && !isBusbar && (
                      <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`}>
                        <rect
                          x={-35}
                          y={-8}
                          width={70}
                          height={16}
                          rx={3}
                          fill={isDark ? '#1e293b' : '#ffffff'}
                          opacity={0.95}
                          stroke={nodeBorderColor}
                          strokeWidth={0.5}
                        />
                        <text
                          fontSize={8}
                          fill={mutedTextColor}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {edge.wireType} {edge.wireSize}мм²
                          {edge.length && ` ${edge.length}м`}
                        </text>
                      </g>
                    )}

                    {/* Индикатор статуса на линии */}
                    <circle
                      cx={(x1 + x2) / 2}
                      cy={(y1 + y2) / 2 - 15}
                      r={4}
                      fill={isLive ? '#22c55e' : '#6b7280'}
                      opacity={isOn ? 1 : 0.4}
                    />
                  </g>
                );
              })}
            </g>

            {/* Узлы */}
            <g className="nodes">
              {layoutData.nodes.map(node => {
                const x = transformX(node.posX);
                const y = transformY(node.posY);
                const isSelected = node.id === selectedNodeId;
                const isHovered = node.id === hoveredNode;
                const nodeType = node.type.toLowerCase();
                const headerColors = TYPE_HEADER_COLORS[nodeType] || TYPE_HEADER_COLORS.bus;
                const iconColor = TYPE_ICON_COLORS[nodeType] || '#B87333';
                const isOn = node.status !== 'OFF';
                const isLive = node.lifeStatus === 'LIVE';
                const hasCritical = node.criticalIssues > 0;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${x}, ${y})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNodeClick?.(node.id);
                    }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ cursor: 'pointer' }}
                    filter={isHovered || isSelected ? 'url(#shadow)' : undefined}
                  >
                    {/* Тень под блоком */}
                    <rect
                      x={2}
                      y={4}
                      width={140}
                      height={70}
                      rx={6}
                      fill="#000"
                      opacity={isDark ? 0.3 : 0.1}
                    />

                    {/* Основной фон блока */}
                    <rect
                      width={140}
                      height={70}
                      rx={6}
                      fill={nodeBgColor}
                      stroke={isSelected ? '#3b82f6' : hasCritical ? '#ef4444' : nodeBorderColor}
                      strokeWidth={isSelected || hasCritical ? 2 : 1}
                      className="transition-all duration-200"
                    />

                    {/* Цветная полоса сверху (по типу элемента) */}
                    <rect
                      width={140}
                      height={4}
                      rx={6}
                      fill={headerColors.gradient}
                      opacity={isOn ? 1 : 0.4}
                    />
                    <rect
                      x={0}
                      y={2}
                      width={140}
                      height={4}
                      fill={headerColors.gradient}
                      opacity={isOn ? 1 : 0.4}
                    />

                    {/* Иконка типа в круге с изображением */}
                    <g transform="translate(10, 14)" opacity={isOn ? 1 : 0.5}>
                      <circle
                        r={10}
                        cx={10}
                        cy={10}
                        fill={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                        stroke={iconColor}
                        strokeWidth={1.5}
                      />
                      {TYPE_ICONS[nodeType] && (
                        <image
                          href={TYPE_ICONS[nodeType]}
                          x={3}
                          y={3}
                          width={14}
                          height={14}
                          clipPath="circle(7px at 10px 10px)"
                        />
                      )}
                      {!TYPE_ICONS[nodeType] && (
                        <text
                          x={10}
                          y={13}
                          fontSize={10}
                          fontWeight="bold"
                          fill={iconColor}
                          textAnchor="middle"
                        >
                          {nodeType.charAt(0).toUpperCase()}
                        </text>
                      )}
                    </g>

                    {/* Название типа (на английском) */}
                    <text
                      x={34}
                      y={24}
                      fontSize={10}
                      fontWeight="600"
                      fill={iconColor}
                      opacity={isOn ? 1 : 0.5}
                    >
                      {TYPE_LABELS[nodeType] || nodeType.toUpperCase()}
                    </text>

                    {/* Название элемента */}
                    <text
                      x={10}
                      y={44}
                      fontSize={9}
                      fontWeight="600"
                      fill={textColor}
                      opacity={isOn ? 1 : 0.5}
                    >
                      {node.name.length > 18 ? node.name.slice(0, 18) + '...' : node.name}
                    </text>

                    {/* ID элемента */}
                    <text
                      x={10}
                      y={56}
                      fontSize={7}
                      fill={mutedTextColor}
                    >
                      {node.id.length > 22 ? node.id.slice(0, 22) + '...' : node.id}
                    </text>

                    {/* Напряжение */}
                    <text
                      x={10}
                      y={66}
                      fontSize={7}
                      fill={mutedTextColor}
                    >
                      {(node.voltageLevel || 0.4).toFixed(1)} kV
                    </text>

                    {/* Статус LIVE/DEAD */}
                    <g transform="translate(90, 56)">
                      <circle
                        r={5}
                        cx={5}
                        cy={5}
                        fill={isLive ? 'url(#liveGradient)' : '#6b7280'}
                      />
                      <text
                        x={14}
                        y={8}
                        fontSize={7}
                        fontWeight="bold"
                        fill={isLive ? '#22c55e' : mutedTextColor}
                      >
                        {isLive ? 'LIVE' : 'DEAD'}
                      </text>
                    </g>

                    {/* Статус ON/OFF */}
                    <g transform="translate(90, 12)">
                      <circle
                        r={5}
                        cx={5}
                        cy={5}
                        fill={isOn ? '#3b82f6' : '#ef4444'}
                        opacity={0.9}
                      />
                      <text
                        x={14}
                        y={8}
                        fontSize={7}
                        fontWeight="bold"
                        fill={isOn ? '#3b82f6' : '#ef4444'}
                      >
                        {isOn ? 'ON' : 'OFF'}
                      </text>
                    </g>

                    {/* Индикатор проблем */}
                    {hasCritical && (
                      <g transform="translate(120, 28)">
                        <circle
                          r={8}
                          cx={8}
                          cy={8}
                          fill="#ef4444"
                        />
                        <text
                          x={8}
                          y={11}
                          fontSize={8}
                          fontWeight="bold"
                          fill="#fff"
                          textAnchor="middle"
                        >
                          !
                        </text>
                      </g>
                    )}

                    {/* Подсветка при наведении */}
                    {isHovered && (
                      <rect
                        x={-2}
                        y={-2}
                        width={144}
                        height={74}
                        rx={8}
                        fill="none"
                        stroke={edgeColor}
                        strokeWidth={2}
                        opacity={0.5}
                      />
                    )}
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
      </div>

      {/* Подсказка при наведении на узел */}
      {hoveredNode && (
        <div className="absolute bottom-4 right-4 p-3 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 text-sm max-w-xs z-20">
          {(() => {
            const node = layoutData.nodes.find(n => n.id === hoveredNode);
            if (!node) return null;
            const device = node.devices?.[0];
            return (
              <div className="space-y-1">
                <div className="font-medium text-slate-800 dark:text-slate-200">{node.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">ID: {node.id}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Тип: {node.type.toLowerCase()}</div>
                {device?.currentNom && (
                  <div className="text-xs text-slate-600 dark:text-slate-300">Iном: {device.currentNom}А</div>
                )}
                {device?.pKw && (
                  <div className="text-xs text-slate-600 dark:text-slate-300">P: {device.pKw}кВт</div>
                )}
                {node.criticalIssues > 0 && (
                  <div className="text-xs text-red-500 dark:text-red-400 mt-1">
                    {node.criticalIssues} проблем
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Подсказка при наведении на кабель */}
      {hoveredEdge && (
        <div className="absolute bottom-4 right-4 p-3 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 text-sm max-w-xs z-20">
          {(() => {
            const edge = layoutData.edges.find(e => e.id === hoveredEdge);
            if (!edge) return null;
            return (
              <div className="space-y-1">
                <div className="font-medium text-slate-800 dark:text-slate-200">
                  {edge.type === 'CABLE' ? 'Кабель' : edge.type === 'BUSBAR' ? 'Шина' : 'Перемычка'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">ID: {edge.id}</div>
                {edge.wireType && edge.wireSize && (
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {edge.wireType} {edge.wireSize}мм²
                    {edge.core && ` ${edge.core}`}
                  </div>
                )}
                {edge.length && (
                  <div className="text-xs text-slate-600 dark:text-slate-300">Длина: {edge.length}м</div>
                )}
                {edge.currentCapacity && (
                  <div className="text-xs text-slate-600 dark:text-slate-300">Iдоп: {edge.currentCapacity}А</div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs ${edge.status === 'ON' ? 'text-blue-500' : 'text-red-500'}`}>
                    {edge.status === 'ON' ? '● ON' : '○ OFF'}
                  </span>
                  <span className={`text-xs ${edge.lifeStatus === 'LIVE' ? 'text-green-500' : 'text-gray-400'}`}>
                    {edge.lifeStatus === 'LIVE' ? '● LIVE' : '○ DEAD'}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Панель управления группировкой */}
      {data && data.nodes.length > 100 && (
        <div className="absolute top-4 left-4 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3 z-20">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Группировка</div>
          <div className="flex flex-col gap-1">
            {['breaker', 'load', 'junction'].map(type => {
              const count = data.nodes.filter(n => n.type.toLowerCase() === type).length;
              const isCollapsed = collapsedTypes.has(type);
              return (
                <button
                  key={type}
                  onClick={() => {
                    const newSet = new Set(collapsedTypes);
                    if (isCollapsed) {
                      newSet.delete(type);
                    } else {
                      newSet.add(type);
                    }
                    setCollapsedTypes(newSet);
                  }}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                    isCollapsed
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isCollapsed ? 'bg-blue-500' : 'bg-slate-400'}`} />
                  <span>{TYPE_LABELS[type]}</span>
                  <span className="text-slate-400">({count})</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => {
                if (collapsedTypes.size > 0) {
                  setCollapsedTypes(new Set());
                } else {
                  setCollapsedTypes(new Set(['breaker', 'load', 'junction', 'meter', 'bus']));
                }
              }}
              className="w-full text-xs text-center py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              {collapsedTypes.size > 0 ? 'Развернуть все' : 'Свернуть все'}
            </button>
          </div>
        </div>
      )}

      {/* Информация о размере холста */}
      <div className="absolute bottom-4 left-4 text-xs text-slate-400 dark:text-slate-600 z-10">
        {layoutData.nodes.length} узлов | {Math.round(bounds.width)}×{Math.round(bounds.height)}px
      </div>
    </div>
  );
}

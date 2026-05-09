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
}

// Цвета заголовков по типам элементов
// source: сочетание желтого, зеленого и красного
// breaker: зеленый
// load: зеленый
// meter: синий
// bus/junction: медный цвет (copper)
const TYPE_HEADER_COLORS: Record<string, { primary: string; secondary: string; gradient: string }> = {
  source: { 
    primary: '#eab308', // yellow-500
    secondary: '#22c55e', // green-500
    gradient: 'url(#sourceGradient)' 
  },
  bus: { 
    primary: '#B87333', // copper color
    secondary: '#CD7F32', // bronze
    gradient: 'url(#busGradient)' 
  },
  junction: { 
    primary: '#B87333', // copper color
    secondary: '#CD7F32', 
    gradient: 'url(#busGradient)' 
  },
  breaker: { 
    primary: '#22c55e', // green-500
    secondary: '#16a34a', // green-600
    gradient: 'url(#breakerGradient)' 
  },
  meter: { 
    primary: '#3b82f6', // blue-500
    secondary: '#2563eb', // blue-600
    gradient: 'url(#meterGradient)' 
  },
  load: { 
    primary: '#22c55e', // green-500
    secondary: '#16a34a', // green-600
    gradient: 'url(#loadGradient)' 
  },
  cabinet: { 
    primary: '#B87333', // copper for bus-related
    secondary: '#CD7F32', 
    gradient: 'url(#busGradient)' 
  },
};

// Цвета иконок в круге (соответствуют верхним границами)
const TYPE_ICON_COLORS: Record<string, string> = {
  source: '#eab308', // yellow (с желтым акцентом)
  bus: '#B87333', // copper
  junction: '#B87333', // copper
  breaker: '#22c55e', // green
  meter: '#3b82f6', // blue
  load: '#22c55e', // green
  cabinet: '#B87333', // copper
};

export default function NetworkGraph({ 
  data, 
  onNodeClick, 
  onEdgeClick,
  onEmptyClick,
  selectedNodeId,
  selectedEdgeId,
  zoom: externalZoom,
  onZoomChange
}: NetworkGraphProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  
  // Внутренний zoom если внешний не передан
  const [internalZoom, setInternalZoom] = useState(1);
  const zoom = externalZoom ?? internalZoom;
  const setZoom = onZoomChange ?? setInternalZoom;
  
  // Pan/drag state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Touch state (pinch-to-zoom + swipe)
  const touchRef = useRef({
    lastCenter: { x: 0, y: 0 },
    lastDistance: 0,
    isPinching: false,
    isSwiping: false,
    startPan: { x: 0, y: 0 },
    startTouch: { x: 0, y: 0 },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Отслеживаем размер контейнера
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Обработчик колесика мыши для зума
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(Math.max(0.25, Math.min(3, zoom + delta)));
  }, [zoom, setZoom]);

  // Начало перетаскивания
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && e.target === e.currentTarget) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  // Перетаскивание
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [isDragging, dragStart]);

  // Конец перетаскивания
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ========== Touch: Pinch-to-zoom + Swipe ==========
  const getTouchDistance = (t1: Touch, t2: Touch) =>
    Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

  const getTouchCenter = (t1: Touch, t2: Touch) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

  // Refs для callback-based touch handling (non-passive)
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;

  // Non-passive touch listeners — e.preventDefault() работает без предупреждений
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const svgEl = el.querySelector('.touch-area') as HTMLElement;
    if (!svgEl) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t = touchRef.current;
        t.isPinching = true;
        t.isSwiping = false;
        t.lastDistance = getTouchDistance(e.touches[0], e.touches[1]);
        t.lastCenter = getTouchCenter(e.touches[0], e.touches[1]);
      } else if (e.touches.length === 1) {
        const t = touchRef.current;
        t.isSwiping = true;
        t.isPinching = false;
        t.startTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        t.startPan = { ...panRef.current };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = touchRef.current;

      if (e.touches.length === 2 && t.isPinching) {
        e.preventDefault();
        e.stopPropagation();
        const dist = getTouchDistance(e.touches[0], e.touches[1]);
        const scale = dist / t.lastDistance;
        const newZoom = Math.max(0.25, Math.min(3, zoomRef.current * scale));
        setZoom(newZoom);
        t.lastDistance = dist;
        const center = getTouchCenter(e.touches[0], e.touches[1]);
        const dx = center.x - t.lastCenter.x;
        const dy = center.y - t.lastCenter.y;
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        t.lastCenter = center;
      } else if (e.touches.length === 1 && t.isSwiping) {
        e.preventDefault();
        e.stopPropagation();
        const dx = e.touches[0].clientX - t.startTouch.x;
        const dy = e.touches[0].clientY - t.startTouch.y;
        setPan({ x: t.startPan.x + dx, y: t.startPan.y + dy });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const t = touchRef.current;
      if (e.touches.length < 2) t.isPinching = false;
      if (e.touches.length === 0) t.isSwiping = false;
    };

    svgEl.addEventListener('touchstart', onTouchStart, { passive: true });
    svgEl.addEventListener('touchmove', onTouchMove, { passive: false });
    svgEl.addEventListener('touchend', onTouchEnd, { passive: true });
    svgEl.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      svgEl.removeEventListener('touchstart', onTouchStart);
      svgEl.removeEventListener('touchmove', onTouchMove);
      svgEl.removeEventListener('touchend', onTouchEnd);
      svgEl.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [setZoom]);

  // Zoom +/- кнопки
  const handleZoomIn = useCallback(() => {
    setZoom(Math.min(3, zoom + 0.15));
  }, [zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(Math.max(0.25, zoom - 0.15));
  }, [zoom, setZoom]);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    autoFitRef.current = true;
  }, [setZoom]);

  // Иерархический лэйаут: Source сверху -> Load снизу
  // Связанные элементы располагаются рядом
  const layoutData = useMemo(() => {
    if (!data || data.nodes.length === 0) return null;

    // Создаём граф связности для определения уровней
    const adjacencyList: Map<string, string[]> = new Map();
    const reverseAdjacency: Map<string, string[]> = new Map();
    
    data.nodes.forEach(node => {
      adjacencyList.set(node.id, []);
      reverseAdjacency.set(node.id, []);
    });
    
    data.edges.forEach(edge => {
      adjacencyList.get(edge.source)?.push(edge.target);
      reverseAdjacency.get(edge.target)?.push(edge.source);
    });

    // Определяем уровень каждого узла (BFS от источников)
    const levels: Map<string, number> = new Map();
    const typePriority: Record<string, number> = {
      'source': 0,
      'bus': 1,
      'breaker': 2,
      'meter': 3,
      'cabinet': 4,
      'junction': 5,
      'load': 6
    };

    // Находим все источники (узлы без входящих связей или типа SOURCE)
    const sources = data.nodes.filter(n => 
      n.type.toLowerCase() === 'source' || 
      (reverseAdjacency.get(n.id)?.length === 0)
    );

    // BFS для определения уровней
    const queue: { id: string; level: number }[] = [];
    sources.forEach(s => queue.push({ id: s.id, level: 0 }));

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      
      if (levels.has(id)) continue;
      levels.set(id, level);

      const neighbors = adjacencyList.get(id) || [];
      neighbors.forEach(neighborId => {
        if (!levels.has(neighborId)) {
          queue.push({ id: neighborId, level: level + 1 });
        }
      });
    }

    // Для узлов без определённого уровня используем тип
    data.nodes.forEach(node => {
      if (!levels.has(node.id)) {
        const typeLevel = typePriority[node.type.toLowerCase()] ?? 3;
        levels.set(node.id, typeLevel);
      }
    });

    // Группируем узлы по уровням
    const nodesByLevel: Map<number, GraphNode[]> = new Map();
    data.nodes.forEach(node => {
      const level = levels.get(node.id) || 0;
      if (!nodesByLevel.has(level)) nodesByLevel.set(level, []);
      nodesByLevel.get(level)!.push(node);
    });

    // Параметры лэйаута
    const nodeWidth = 140;
    const nodeHeight = 70;
    const horizontalGap = 60;
    const verticalGap = 120;
    const startX = 100;
    const startY = 100;

    // Сортируем уровни
    const sortedLevels = Array.from(nodesByLevel.keys()).sort((a, b) => a - b);

    // Размещаем узлы по уровням
    const positionedNodes: GraphNode[] = [];
    
    sortedLevels.forEach(level => {
      const nodesAtLevel = nodesByLevel.get(level)!;
      
      // Сортируем узлы внутри уровня по связям
      nodesAtLevel.sort((a, b) => {
        // Группируем связанные узлы вместе
        const aConnections = (adjacencyList.get(a.id) || []).length + (reverseAdjacency.get(a.id) || []).length;
        const bConnections = (adjacencyList.get(b.id) || []).length + (reverseAdjacency.get(b.id) || []).length;
        return bConnections - aConnections;
      });

      // Вычисляем ширину уровня
      const levelWidth = nodesAtLevel.length * (nodeWidth + horizontalGap);
      const centerX = startX + (Math.max(800, levelWidth) - levelWidth) / 2;

      nodesAtLevel.forEach((node, index) => {
        positionedNodes.push({
          ...node,
          posX: centerX + index * (nodeWidth + horizontalGap),
          posY: startY + level * (nodeHeight + verticalGap)
        });
      });
    });

    return {
      nodes: positionedNodes,
      edges: data.edges
    };
  }, [data]);

  // Вычисляем границы графа
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
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }, [layoutData]);

  // Автоподгонка: вычисляем viewBox чтобы вместить все элементы
  const autoFitRef = useRef(true);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1200, h: 800 });
  
  useEffect(() => {
    if (!containerSize.width || !containerSize.height || !bounds.width || !bounds.height) return;
    if (!autoFitRef.current) return;
    autoFitRef.current = false;

    // ViewBox показывает всю область bounds
    setViewBox({ x: bounds.minX, y: bounds.minY, w: bounds.width, h: bounds.height });
    // Сбрасываем zoom и pan
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [containerSize.width, containerSize.height, bounds.width, bounds.height, bounds.minX, bounds.minY, setZoom]);

  // Вычисляем текущий viewBox с учётом zoom и pan
  const currentViewBox = useMemo(() => {
    const vbW = viewBox.w / zoom;
    const vbH = viewBox.h / zoom;
    const vbX = viewBox.x + (viewBox.w - vbW) / 2 + pan.x / zoom;
    const vbY = viewBox.y + (viewBox.h - vbH) / 2 + pan.y / zoom;
    return `${vbX} ${vbY} ${vbW} ${vbH}`;
  }, [viewBox, zoom, pan]);

  // Если данных нет
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

  // Преобразуем координаты
  const transformX = (x: number) => x - bounds.minX;
  const transformY = (y: number) => y - bounds.minY;

  const svgWidth = Math.max(1200, bounds.width) * zoom;
  const svgHeight = Math.max(800, bounds.height) * zoom;

  // Цвета в зависимости от темы
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#020617' : '#f1f5f9';
  const nodeBgColor = isDark ? '#1e293b' : '#ffffff';
  const nodeBorderColor = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const mutedTextColor = isDark ? '#64748b' : '#94a3b8';
  const edgeColor = isDark ? '#3b82f6' : '#60a5fa';
  const edgeInactiveColor = isDark ? '#64748b' : '#94a3b8';

  // Обработчик клика на пустую область
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
      {/* SVG граф с pan/zoom + touch (non-passive listeners через useEffect) */}
      <div 
        className="touch-area flex-1 overflow-hidden cursor-grab active:cursor-grabbing touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={currentViewBox}
          preserveAspectRatio="xMidYMid meet"
          style={{
            backgroundColor: bgColor,
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
            
            {/* Градиент для Breaker (зеленый) */}
            <linearGradient id="breakerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
            
            {/* Градиент для Meter (синий) */}
            <linearGradient id="meterGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
            
            {/* Градиент для Load (зеленый) */}
            <linearGradient id="loadGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#16a34a" />
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
            {/* Рёбра (связи) - кабели и шины */}
            <g className="edges">
              {layoutData.edges.map(edge => {
                const sourceNode = layoutData.nodes.find(n => n.id === edge.source);
                const targetNode = layoutData.nodes.find(n => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                const x1 = transformX(sourceNode.posX) + 70;
                const y1 = transformY(sourceNode.posY) + 35;
                const x2 = transformX(targetNode.posX) + 70;
                const y2 = transformY(targetNode.posY) + 35;

                const isHovered = edge.id === hoveredEdge;
                const isSelected = edge.id === selectedEdgeId;
                const isLive = edge.lifeStatus === 'LIVE';
                const isOn = edge.status === 'ON';

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
                    {/* Линия связи */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isLive ? edgeColor : edgeInactiveColor}
                      strokeWidth={isHovered || isSelected ? 3 : 2}
                      strokeDasharray={edge.type === 'BUSBAR' ? 'none' : edge.type === 'JUMPER' ? '5,5' : 'none'}
                      opacity={isOn ? 1 : 0.4}
                      className="transition-all duration-200"
                    />
                    
                    {/* Подсветка при наведении */}
                    {isHovered && (
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
                    {edge.wireType && edge.wireSize && (
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
                    {/* Скругляем нижние углы */}
                    <rect
                      x={0}
                      y={2}
                      width={140}
                      height={4}
                      fill={headerColors.gradient}
                      opacity={isOn ? 1 : 0.4}
                    />

                    {/* Иконка типа в круге */}
                    <g transform="translate(10, 14)" opacity={isOn ? 1 : 0.5}>
                      <circle
                        r={10}
                        cx={10}
                        cy={10}
                        fill={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                      />
                      <circle
                        r={8}
                        cx={10}
                        cy={10}
                        fill={iconColor}
                        opacity={0.2}
                      />
                      {/* Текст иконки - первая буква типа */}
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
                      {nodeType}
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

      {/* Подсказка при наведении на узел (левый нижний угол — не перекрывает кнопки зума) */}
      {hoveredNode && (
        <div className="absolute bottom-4 left-4 p-3 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 text-sm max-w-xs z-20">
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

      {/* ========== Кнопки управления зумом (справа внизу) ========== */}
      <div className="absolute bottom-4 right-4 flex flex-col items-center gap-2 z-30">
        <button
          onClick={handleZoomIn}
          className="w-10 h-10 rounded-full bg-white/90 dark:bg-slate-800/90 shadow-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all"
          title="Увеличить"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <button
          onClick={handleZoomReset}
          className="w-10 h-10 rounded-full bg-white/90 dark:bg-slate-800/90 shadow-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all text-xs font-bold"
          title="Сбросить"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 1 3.3-6.9" /><polyline points="3 2 3 7 8 7" /></svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="w-10 h-10 rounded-full bg-white/90 dark:bg-slate-800/90 shadow-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all"
          title="Уменьшить"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
      </div>

      {/* Подсказка при наведении на кабель (левый нижний угол) */}
      {hoveredEdge && (
        <div className="absolute bottom-4 left-4 p-3 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 text-sm max-w-xs z-20">
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
    </div>
  );
}

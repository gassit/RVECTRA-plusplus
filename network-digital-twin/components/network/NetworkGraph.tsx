'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import cytoscape from 'cytoscape';

interface NetworkData {
  elements: Array<{
    id: string;
    elementId: string;
    name: string;
    type: string;
    posX?: number | null;
    posY?: number | null;
  }>;
  connections: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    source: { elementId: string; name: string; type: string };
    target: { elementId: string; name: string; type: string };
  }>;
}

type NodeType = 'source' | 'bus' | 'breaker' | 'meter' | 'junction' | 'load';

interface NetworkGraphProps {
  data: NetworkData | null;
  onNodeClick?: (nodeId: string) => void;
}

// Иконки для типов узлов
const NODE_ICONS: Record<NodeType, string> = {
  source: '/icons/source.jpg',
  breaker: '/icons/breaker.jpg',
  load: '/icons/load.jpg',
  meter: '/icons/meter.jpg',
  junction: '/icons/Точрасп.jpg',
  bus: '', // Шина без иконки
};

// Цвета верхнего контура по типам
const NODE_COLORS: Record<NodeType, { border: string; bg: string; text: string }> = {
  source: { border: '#fbbf24', bg: '#fef3c7', text: '#92400e' }, // Жёлтый
  breaker: { border: '#1f2937', bg: '#f9fafb', text: '#1f2937' }, // Чёрный
  load: { border: '#ffffff', bg: '#374151', text: '#f9fafb' }, // Белый контур, тёмный фон
  meter: { border: '#3b82f6', bg: '#dbeafe', text: '#1e40af' }, // Синий
  bus: { border: '#d97706', bg: '#fef3c7', text: '#92400e' }, // Медный
  junction: { border: '#9ca3af', bg: '#f3f4f6', text: '#374151' }, // Серый
};

// Английские названия типов
const NODE_LABELS: Record<NodeType, string> = {
  source: 'SOURCE',
  breaker: 'BREAKER',
  load: 'LOAD',
  meter: 'METER',
  bus: 'BUS',
  junction: 'JUNCTION',
};

// Уровни для размещения узлов
const NODE_LAYERS: Record<NodeType, number> = {
  source: 0,
  bus: 1,
  breaker: 2,
  meter: 3,
  junction: 4,
  load: 5,
};

// Вычисление layout с учётом иерархии и масштабируемости
function calculateLayout(
  data: NetworkData,
  containerWidth: number,
  containerHeight: number
) {
  const padding = 100;
  const nodeWidth = 120;
  const nodeHeight = 70;
  const horizontalSpacing = 40;
  const verticalSpacing = 80;

  // Создаём граф связей
  const adjacencyList = new Map<string, Set<string>>();
  const reverseAdjacency = new Map<string, Set<string>>();

  data.connections.forEach(conn => {
    if (!adjacencyList.has(conn.sourceId)) {
      adjacencyList.set(conn.sourceId, new Set());
    }
    adjacencyList.get(conn.sourceId)!.add(conn.targetId);

    if (!reverseAdjacency.has(conn.targetId)) {
      reverseAdjacency.set(conn.targetId, new Set());
    }
    reverseAdjacency.get(conn.targetId)!.add(conn.sourceId);
  });

  // Группируем узлы по типам
  const nodesByType: Record<string, typeof data.elements> = {
    source: [],
    bus: [],
    breaker: [],
    meter: [],
    junction: [],
    load: [],
  };

  data.elements.forEach(el => {
    const type = el.type as NodeType;
    if (nodesByType[type]) {
      nodesByType[type].push(el);
    } else {
      nodesByType.junction.push(el);
    }
  });

  // Вычисляем уровни по топологии
  const nodeLevels = new Map<string, number>();
  const processed = new Set<string>();
  const queue: string[] = [];

  // Источники на уровне 0
  nodesByType.source.forEach(el => {
    nodeLevels.set(el.id, 0);
    processed.add(el.id);
    queue.push(el.id);
  });

  // BFS для определения уровней
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentLevel = nodeLevels.get(currentId) || 0;

    const children = adjacencyList.get(currentId) || new Set();
    children.forEach(childId => {
      const childEl = data.elements.find(e => e.id === childId);
      if (!childEl) return;

      const childType = childEl.type as NodeType;
      let childLevel = Math.max(currentLevel + 1, NODE_LAYERS[childType] ?? 4);

      const existingLevel = nodeLevels.get(childId);
      if (existingLevel === undefined || childLevel > existingLevel) {
        nodeLevels.set(childId, childLevel);
      }

      if (!processed.has(childId)) {
        processed.add(childId);
        queue.push(childId);
      }
    });
  }

  // Убеждаемся что все узлы имеют уровень
  data.elements.forEach(el => {
    if (!nodeLevels.has(el.id)) {
      const type = el.type as NodeType;
      nodeLevels.set(el.id, NODE_LAYERS[type] ?? 4);
    }
  });

  // Группируем по уровням
  const levelGroups = new Map<number, typeof data.elements>();
  data.elements.forEach(el => {
    const level = Math.floor(nodeLevels.get(el.id) || 0);
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)!.push(el);
  });

  const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => a - b);
  const numLevels = sortedLevels.length;

  // Вычисляем необходимый размер холста
  let maxNodesInLevel = 0;
  levelGroups.forEach(nodes => {
    if (nodes.length > maxNodesInLevel) {
      maxNodesInLevel = nodes.length;
    }
  });

  const requiredWidth = Math.max(
    containerWidth,
    maxNodesInLevel * (nodeWidth + horizontalSpacing) + 2 * padding
  );
  const requiredHeight = Math.max(
    containerHeight,
    numLevels * (nodeHeight + verticalSpacing) + 2 * padding
  );

  // Вычисляем позиции
  const positions = new Map<string, { x: number; y: number }>();

  sortedLevels.forEach((level, levelIndex) => {
    const nodes = levelGroups.get(level)!;
    const y = padding + levelIndex * (nodeHeight + verticalSpacing);

    // Распределяем узлы по горизонтали
    const totalWidth = nodes.length * nodeWidth + (nodes.length - 1) * horizontalSpacing;
    let startX = (requiredWidth - totalWidth) / 2;

    nodes.forEach((node, idx) => {
      positions.set(node.id, {
        x: startX + idx * (nodeWidth + horizontalSpacing) + nodeWidth / 2,
        y: y + nodeHeight / 2
      });
    });
  });

  return { positions, width: requiredWidth, height: requiredHeight };
}

// Создание SVG для узла с иконкой
function createNodeSVG(type: NodeType, label: string, elementId: string, isDark: boolean): string {
  const colors = NODE_COLORS[type];
  const nodeLabel = NODE_LABELS[type];
  const iconPath = NODE_ICONS[type];

  // Размеры узла
  const width = 120;
  const height = 70;
  const borderWidth = 4;

  // Определяем цвета для темы
  const bgColor = isDark && type !== 'load' ? '#1f2937' : colors.bg;
  const textColor = isDark && type !== 'load' ? '#f3f4f6' : colors.text;
  const borderColor = colors.border;

  // SVG шаблон
  let svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <clipPath id="clip-${type}">
          <rect x="${borderWidth}" y="${borderWidth}" width="${width - borderWidth * 2}" height="${height - borderWidth}"/>
        </clipPath>
      </defs>

      <!-- Фон с верхним цветным контуром -->
      <rect x="0" y="0" width="${width}" height="${height}" rx="4" ry="4"
            fill="${bgColor}" stroke="${borderColor}" stroke-width="${borderWidth}"/>

      <!-- Верхняя цветная полоса -->
      <rect x="${borderWidth}" y="${borderWidth}" width="${width - borderWidth * 2}" height="6"
            fill="${borderColor}" rx="0"/>

      <!-- Иконка (круг с картинкой) -->
      <circle cx="30" cy="40" r="16" fill="${isDark ? '#374151' : '#e5e7eb'}" stroke="${borderColor}" stroke-width="1"/>
  `;

  // Добавляем тип узла
  svg += `
      <!-- Тип узла -->
      <text x="60" y="30" font-family="Arial, sans-serif" font-size="10" font-weight="bold"
            fill="${textColor}" text-anchor="middle">${nodeLabel}</text>

      <!-- ID элемента -->
      <text x="60" y="45" font-family="Arial, sans-serif" font-size="8"
            fill="${isDark ? '#9ca3af' : '#6b7280'}" text-anchor="middle">${elementId}</text>

      <!-- Название -->
      <text x="60" y="58" font-family="Arial, sans-serif" font-size="7"
            fill="${isDark ? '#d1d5db' : '#9ca3af'}" text-anchor="middle">${label.substring(0, 15)}${label.length > 15 ? '...' : ''}</text>
    </svg>
  `;

  return svg;
}

export default function NetworkGraph({ data, onNodeClick }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [scale, setScale] = useState(1);

  // Проверка темы
  useEffect(() => {
    const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Отслеживание размеров контейнера
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Вычисляем layout
  const layoutResult = useMemo(() => {
    if (!data) return { positions: new Map(), width: 1200, height: 800 };
    return calculateLayout(data, dimensions.width, dimensions.height);
  }, [data, dimensions]);

  // Группировка элементов для масштабирования
  const groupedData = useMemo(() => {
    if (!data) return { nodes: [], edges: [], groups: [] };

    // Группируем по родительским элементам (например, шкафы)
    const groups = new Map<string, typeof data.elements>();
    const standaloneNodes: typeof data.elements = [];

    data.elements.forEach(el => {
      // Простой алгоритм группировки: объединяем узлы одного типа в группы по 20
      const type = el.type as NodeType;
      const groupKey = `group-${type}`;

      // Если больше 20 элементов типа - группируем
      if (data.elements.filter(e => e.type === type).length > 20 && collapsedGroups.has(groupKey)) {
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(el);
      } else {
        standaloneNodes.push(el);
      }
    });

    // Создаём узлы-группы
    const groupNodes = Array.from(groups.entries()).map(([key, nodes]) => ({
      data: {
        id: key,
        label: `${NODE_LABELS[nodes[0].type as NodeType]} (${nodes.length})`,
        type: 'group',
        nodeCount: nodes.length,
        nodeType: nodes[0].type,
      },
      position: layoutResult.positions.get(nodes[0].id) || { x: 0, y: 0 },
    }));

    // Создаём обычные узлы
    const nodes = standaloneNodes.map(el => {
      const pos = layoutResult.positions.get(el.id);
      return {
        data: {
          id: el.id,
          label: el.name || el.elementId,
          type: el.type,
          elementId: el.elementId,
        },
        position: pos || { x: Math.random() * 500, y: Math.random() * 500 },
      };
    });

    // Фильтруем рёбра для групп
    const edges = data.connections
      .filter(conn => {
        const sourceCollapsed = collapsedGroups.has(`group-${data.elements.find(e => e.id === conn.sourceId)?.type}`);
        const targetCollapsed = collapsedGroups.has(`group-${data.elements.find(e => e.id === conn.targetId)?.type}`);
        return !sourceCollapsed && !targetCollapsed;
      })
      .map(conn => ({
        data: {
          id: `edge-${conn.id}`,
          source: conn.sourceId,
          target: conn.targetId,
        },
      }));

    return { nodes: [...nodes, ...groupNodes], edges, groups: Array.from(groups.keys()) };
  }, [data, layoutResult, collapsedGroups]);

  // Инициализация Cytoscape
  useEffect(() => {
    if (!containerRef.current || !data) return;

    // Уничтожаем предыдущий экземпляр
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const bgColor = isDark ? '#111827' : '#ffffff';
    const edgeColor = isDark ? '#4b5563' : '#d1d5db';

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...groupedData.nodes, ...groupedData.edges],
      style: [
        // Базовый стиль узлов - прямоугольники
        {
          selector: 'node',
          style: {
            'shape': 'roundrectangle',
            'width': 120,
            'height': 70,
            'background-color': isDark ? '#1f2937' : '#ffffff',
            'border-width': 3,
            'border-color': '#9ca3af',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': 10,
            'color': isDark ? '#f3f4f6' : '#1f2937',
            'text-wrap': 'wrap',
            'text-max-width': 100,
          } as any,
        },
        // Источник - жёлтый контур
        {
          selector: 'node[type="source"]',
          style: {
            'border-color': '#fbbf24',
            'border-width': 4,
            'background-color': isDark ? '#422006' : '#fef3c7',
            'color': isDark ? '#fcd34d' : '#92400e',
          } as any,
        },
        // Автомат - чёрный контур
        {
          selector: 'node[type="breaker"]',
          style: {
            'border-color': '#1f2937',
            'border-width': 4,
            'background-color': isDark ? '#1f2937' : '#f9fafb',
            'color': isDark ? '#f9fafb' : '#1f2937',
          } as any,
        },
        // Нагрузка - белый контур, тёмный фон
        {
          selector: 'node[type="load"]',
          style: {
            'border-color': '#ffffff',
            'border-width': 4,
            'background-color': isDark ? '#374151' : '#374151',
            'color': '#f9fafb',
          } as any,
        },
        // Счётчик - синий контур
        {
          selector: 'node[type="meter"]',
          style: {
            'border-color': '#3b82f6',
            'border-width': 4,
            'background-color': isDark ? '#1e3a5f' : '#dbeafe',
            'color': isDark ? '#93c5fd' : '#1e40af',
          } as any,
        },
        // Шина - медный контур
        {
          selector: 'node[type="bus"]',
          style: {
            'shape': 'roundrectangle',
            'width': 150,
            'height': 35,
            'border-color': '#d97706',
            'border-width': 4,
            'background-color': isDark ? '#78350f' : '#fef3c7',
            'color': isDark ? '#fcd34d' : '#92400e',
          } as any,
        },
        // Узел - серый
        {
          selector: 'node[type="junction"]',
          style: {
            'shape': 'ellipse',
            'width': 40,
            'height': 40,
            'border-color': '#9ca3af',
            'border-width': 3,
            'background-color': isDark ? '#4b5563' : '#f3f4f6',
          } as any,
        },
        // Группа (свёрнутые узлы)
        {
          selector: 'node[type="group"]',
          style: {
            'width': 140,
            'height': 80,
            'border-color': '#6366f1',
            'border-width': 4,
            'border-style': 'dashed',
            'background-color': isDark ? '#312e81' : '#e0e7ff',
            'color': isDark ? '#a5b4fc' : '#4338ca',
            'label': 'data(label)',
          } as any,
        },
        // Выбранный узел
        {
          selector: 'node:selected',
          style: {
            'border-width': 5,
            'border-color': '#3b82f6',
          },
        },
        // Рёбра
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': edgeColor,
            'target-arrow-color': edgeColor,
            'target-arrow-shape': 'triangle',
            'curve-style': 'taxi',
            'taxi-direction': 'vertical',
            'taxi-turn': 30,
          } as any,
        },
      ],
      layout: {
        name: 'preset',
        fit: false,
      },
      minZoom: 0.1,
      maxZoom: 4,
      wheelSensitivity: 0.3,
    });

    // Обработка кликов
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const nodeId = node.id();
      const nodeType = node.data('type');

      // Если клик на группу - разворачиваем
      if (nodeType === 'group') {
        setCollapsedGroups(prev => {
          const newSet = new Set(prev);
          if (newSet.has(nodeId)) {
            newSet.delete(nodeId);
          } else {
            newSet.add(nodeId);
          }
          return newSet;
        });
      } else if (onNodeClick) {
        onNodeClick(nodeId);
      }
    });

    // Фит при первой загрузке
    cy.fit(undefined, 50);

    cyRef.current = cy;

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [data, isDark, groupedData, onNodeClick]);

  // Управление масштабом
  const handleZoomIn = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 1.2);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() / 1.2);
    }
  }, []);

  const handleFit = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 50);
    }
  }, []);

  // Переключение группировки для производительности
  const toggleAllGroups = useCallback((collapse: boolean) => {
    if (!data) return;

    const types = new Set(data.elements.map(el => el.type));
    const groupKeys = Array.from(types).map(t => `group-${t}`);

    if (collapse) {
      setCollapsedGroups(new Set(groupKeys));
    } else {
      setCollapsedGroups(new Set());
    }
  }, [data]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Загрузка данных сети...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Canvas с динамическим размером */}
      <div
        ref={containerRef}
        className="w-full h-full bg-white dark:bg-gray-900"
        style={{
          minWidth: layoutResult.width,
          minHeight: layoutResult.height,
        }}
      />

      {/* Панель управления */}
      <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
        {/* Zoom controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col">
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg text-gray-600 dark:text-gray-300"
            title="Приблизить"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700" />
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            title="Отдалить"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700" />
          <button
            onClick={handleFit}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg text-gray-600 dark:text-gray-300"
            title="По размеру"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Панель группировки */}
      <div className="absolute top-3 right-3 flex gap-2 z-10">
        <button
          onClick={() => toggleAllGroups(true)}
          className="px-3 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Свернуть все группы"
        >
          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Свернуть
        </button>
        <button
          onClick={() => toggleAllGroups(false)}
          className="px-3 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Развернуть все группы"
        >
          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          Развернуть
        </button>
      </div>

      {/* Информация о размере */}
      <div className="absolute bottom-3 right-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded px-2 py-1 text-xs text-gray-500 dark:text-gray-400 z-10">
        {data.elements.length} элементов | {layoutResult.width}×{layoutResult.height}px
      </div>
    </div>
  );
}

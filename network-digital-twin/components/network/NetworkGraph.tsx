'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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

// Цвета узлов по типам
const NODE_COLORS: Record<NodeType, { border: string; bg: string; text: string }> = {
  source: { border: '#fbbf24', bg: '#fef3c7', text: '#92400e' },
  breaker: { border: '#1f2937', bg: '#f9fafb', text: '#1f2937' },
  load: { border: '#ffffff', bg: '#374151', text: '#f9fafb' },
  meter: { border: '#3b82f6', bg: '#dbeafe', text: '#1e40af' },
  bus: { border: '#d97706', bg: '#fef3c7', text: '#92400e' },
  junction: { border: '#9ca3af', bg: '#f3f4f6', text: '#374151' },
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

export default function NetworkGraph({ data, onNodeClick }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Проверка темы
  useEffect(() => {
    const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Инициализация Cytoscape при появлении данных
  useEffect(() => {
    if (!containerRef.current || !data || data.elements.length === 0) {
      console.log('NetworkGraph: Waiting for data or container...');
      return;
    }

    console.log('NetworkGraph: Initializing with', data.elements.length, 'elements');

    // Уничтожаем предыдущий экземпляр
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    // Создаём граф связей для layout
    const adjacencyList = new Map<string, Set<string>>();
    data.connections.forEach(conn => {
      if (!adjacencyList.has(conn.sourceId)) {
        adjacencyList.set(conn.sourceId, new Set());
      }
      adjacencyList.get(conn.sourceId)!.add(conn.targetId);
    });

    // Вычисляем уровни по топологии (BFS)
    const nodeLevels = new Map<string, number>();
    const processed = new Set<string>();
    const queue: string[] = [];

    // Источники на уровне 0
    data.elements.filter(el => el.type === 'source').forEach(el => {
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
        const childLevel = Math.max(currentLevel + 1, NODE_LAYERS[childType] ?? 4);

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

    // Вычисляем позиции
    const nodeWidth = 140;
    const nodeHeight = 50;
    const horizontalSpacing = 30;
    const verticalSpacing = 60;
    const padding = 80;

    let maxNodesInLevel = 0;
    levelGroups.forEach(nodes => {
      if (nodes.length > maxNodesInLevel) maxNodesInLevel = nodes.length;
    });

    const canvasWidth = Math.max(1400, maxNodesInLevel * (nodeWidth + horizontalSpacing) + 2 * padding);
    const canvasHeight = sortedLevels.length * (nodeHeight + verticalSpacing) + 2 * padding;

    console.log('NetworkGraph: Canvas size', canvasWidth, 'x', canvasHeight);

    // Создаём элементы для Cytoscape
    const nodes = data.elements.map(el => {
      const level = nodeLevels.get(el.id) || 0;
      const levelIndex = sortedLevels.indexOf(level);
      const nodesInLevel = levelGroups.get(level) || [];
      const indexInLevel = nodesInLevel.indexOf(el);

      const y = padding + levelIndex * (nodeHeight + verticalSpacing) + nodeHeight / 2;
      const totalWidth = nodesInLevel.length * nodeWidth + (nodesInLevel.length - 1) * horizontalSpacing;
      const startX = (canvasWidth - totalWidth) / 2;
      const x = startX + indexInLevel * (nodeWidth + horizontalSpacing) + nodeWidth / 2;

      return {
        data: {
          id: el.id,
          label: el.name || el.elementId,
          type: el.type,
          elementId: el.elementId,
        },
        position: { x, y }
      };
    });

    const edges = data.connections.map(conn => ({
      data: {
        id: `edge-${conn.id}`,
        source: conn.sourceId,
        target: conn.targetId,
      }
    }));

    console.log('NetworkGraph: Created', nodes.length, 'nodes and', edges.length, 'edges');

    const bgColor = isDark ? '#111827' : '#ffffff';
    const edgeColor = isDark ? '#4b5563' : '#d1d5db';

    try {
      const cy = cytoscape({
        container: containerRef.current,
        elements: [...nodes, ...edges],
        style: [
          {
            selector: 'node',
            style: {
              'shape': 'roundrectangle',
              'width': nodeWidth,
              'height': nodeHeight,
              'background-color': isDark ? '#1f2937' : '#ffffff',
              'border-width': 3,
              'border-color': '#9ca3af',
              'label': 'data(label)',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': 9,
              'color': isDark ? '#f3f4f6' : '#1f2937',
              'text-wrap': 'wrap',
              'text-max-width': nodeWidth - 10,
            } as any,
          },
          {
            selector: 'node[type="source"]',
            style: {
              'border-color': '#fbbf24',
              'border-width': 4,
              'background-color': isDark ? '#422006' : '#fef3c7',
              'color': isDark ? '#fcd34d' : '#92400e',
            } as any,
          },
          {
            selector: 'node[type="breaker"]',
            style: {
              'border-color': '#1f2937',
              'border-width': 4,
              'background-color': isDark ? '#1f2937' : '#f9fafb',
              'color': isDark ? '#f9fafb' : '#1f2937',
            } as any,
          },
          {
            selector: 'node[type="load"]',
            style: {
              'border-color': '#ffffff',
              'border-width': 4,
              'background-color': '#374151',
              'color': '#f9fafb',
            } as any,
          },
          {
            selector: 'node[type="meter"]',
            style: {
              'border-color': '#3b82f6',
              'border-width': 4,
              'background-color': isDark ? '#1e3a5f' : '#dbeafe',
              'color': isDark ? '#93c5fd' : '#1e40af',
            } as any,
          },
          {
            selector: 'node[type="bus"]',
            style: {
              'width': 180,
              'height': 35,
              'border-color': '#d97706',
              'border-width': 4,
              'background-color': isDark ? '#78350f' : '#fef3c7',
              'color': isDark ? '#fcd34d' : '#92400e',
            } as any,
          },
          {
            selector: 'node[type="junction"]',
            style: {
              'shape': 'ellipse',
              'width': 50,
              'height': 50,
              'border-color': '#9ca3af',
              'border-width': 3,
              'background-color': isDark ? '#4b5563' : '#f3f4f6',
              'label': '', // Без текста для junction
            } as any,
          },
          {
            selector: 'node:selected',
            style: {
              'border-width': 5,
              'border-color': '#3b82f6',
            },
          },
          {
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': edgeColor,
              'target-arrow-color': edgeColor,
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
            } as any,
          },
        ],
        layout: {
          name: 'preset',
          fit: false,
        },
        minZoom: 0.1,
        maxZoom: 4,
      });

      // Обработка кликов
      cy.on('tap', 'node', (evt) => {
        const node = evt.target;
        const nodeId = node.id();
        if (onNodeClick) {
          onNodeClick(nodeId);
        }
        console.log('Clicked node:', nodeId, node.data('type'));
      });

      // Фит к экрану
      cy.fit(undefined, 50);

      cyRef.current = cy;
      setIsReady(true);
      console.log('NetworkGraph: Initialization complete');

      return () => {
        if (cyRef.current) {
          cyRef.current.destroy();
          cyRef.current = null;
        }
      };
    } catch (error) {
      console.error('NetworkGraph: Cytoscape initialization error:', error);
    }
  }, [data, isDark, onNodeClick]);

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

  if (!data || data.elements.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Загрузка данных сети...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full bg-white dark:bg-gray-900"
        style={{ minHeight: '600px' }}
      />

      {/* Панель управления масштабом */}
      <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
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

      {/* Информация */}
      <div className="absolute bottom-3 right-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded px-3 py-2 text-xs text-gray-500 dark:text-gray-400 z-10">
        {data.elements.length} элементов | {data.connections.length} связей
        {isReady && ' | ✓ готово'}
      </div>

      {/* Легенда */}
      <div className="absolute bottom-3 left-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-xs z-10">
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 rounded border-2 border-yellow-400 bg-yellow-50"></div>
            <span className="text-gray-600 dark:text-gray-400">SOURCE</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 rounded border-2 border-gray-800 bg-white"></div>
            <span className="text-gray-600 dark:text-gray-400">BREAKER</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 rounded border-2 border-blue-500 bg-blue-50"></div>
            <span className="text-gray-600 dark:text-gray-400">METER</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-2 rounded border-2 border-amber-600 bg-amber-50"></div>
            <span className="text-gray-600 dark:text-gray-400">BUS</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2 border-gray-400 bg-gray-100"></div>
            <span className="text-gray-600 dark:text-gray-400">JUNCTION</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 rounded border-2 border-white bg-gray-700"></div>
            <span className="text-gray-600 dark:text-gray-400">LOAD</span>
          </div>
        </div>
      </div>
    </div>
  );
}

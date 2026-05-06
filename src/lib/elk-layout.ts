/**
 * ELK Layout Integration for G6
 * Профессиональная ортогональная маршрутизация рёбер с обходом препятствий
 */

import { useRef } from 'react';
import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs';

// Типы для ELK
type ElkNodeType = ElkNode;
type ElkEdgeType = ElkExtendedEdge;

interface ElkEdgeSection {
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  bendPoints?: { x: number; y: number }[];
}

interface LayoutResult {
  nodes: Map<string, { x: number; y: number }>;
  edges: Map<string, { points: { x: number; y: number }[] }>;
}

// Singleton ELK instance
let elkInstance: InstanceType<typeof ELK> | null = null;

function getElk(): InstanceType<typeof ELK> {
  if (!elkInstance) {
    elkInstance = new ELK();
  }
  return elkInstance;
}

/**
 * Конвертирует данные графа в формат ELK
 */
function convertToElkGraph(
  nodes: Array<{ id: string; type?: string; size?: [number, number] }>,
  edges: Array<{ id: string; source: string; target: string }>
): ElkNodeType {
  const elkNodes = nodes.map(node => {
    const width = node.size?.[0] || 160;
    const height = node.size?.[1] || 80;
    
    return {
      id: node.id,
      width,
      height,
      // Фиксируем source узлы вверху
      ...(node.type?.toLowerCase() === 'source' && {
        layoutOptions: {
          'org.eclipse.elk.fixed': 'true'
        }
      })
    };
  });

  const elkEdges: ElkEdgeType[] = edges.map(edge => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target]
  }));

  return {
    id: 'root',
    children: elkNodes,
    edges: elkEdges
  };
}

/**
 * Основные опции ELK для ортогональной маршрутизации
 */
const ELK_OPTIONS: Record<string, string> = {
  // Иерархический алгоритм
  'elk.algorithm': 'layered',
  // Направление сверху вниз
  'elk.direction': 'DOWN',
  // Ортогональная маршрутизация рёбер (углы 90°)
  'elk.edgeRouting': 'ORTHOGONAL',
  // Расстояние между узлами на одном уровне
  'elk.spacing.nodeNode': '100',
  // Расстояние между слоями
  'elk.layered.spacing.nodeNodeBetweenLayers': '150',
  // Отступ от узла до ребра
  'elk.spacing.edgeNode': '25',
  // Расстояние между параллельными рёбрами
  'elk.spacing.edgeEdge': '20',
  // Минимизация пересечений рёбер
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.crossingMinimization.semiInteractiveCrossingMinimization': 'true',
  // Оптимальное размещение узлов
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  // Учитывать порты (точки подключения)
  'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES',
  // Радиус скругления углов (для визуализации)
  'elk.layered.edgeRouting.orthogonalEdges.routingStrategy': 'ORTHOGONAL',
  // Отступы для рёбер
  'elk.layered.edgeRouting.orthogonalEdges.edgeSpacing': '20',
};

/**
 * Выполняет layout с помощью ELK
 */
export async function performElkLayout(
  nodes: Array<{ id: string; type?: string; size?: [number, number] }>,
  edges: Array<{ id: string; source: string; target: string }>
): Promise<LayoutResult | null> {
  try {
    // Валидация: создаём Set существующих ID узлов
    const nodeIds = new Set(nodes.map(n => n.id));
    
    // Фильтруем рёбра - оставляем только те, у которых source и target существуют
    const validEdges = edges.filter(edge => {
      const sourceExists = nodeIds.has(edge.source);
      const targetExists = nodeIds.has(edge.target);
      if (!sourceExists || !targetExists) {
        console.warn(`[ELK] Edge ${edge.id} references missing node(s): source=${edge.source}(${sourceExists}), target=${edge.target}(${targetExists})`);
        return false;
      }
      return true;
    });
    
    if (nodes.length === 0) {
      console.warn('[ELK] No nodes to layout');
      return null;
    }
    
    console.log('[ELK] Valid nodes:', nodes.length, ', valid edges:', validEdges.length);
    
    const elk = getElk();
    const elkGraph = convertToElkGraph(nodes, validEdges);

    // Выполняем layout
    const layoutedGraph = await elk.layout(elkGraph, {
      layoutOptions: ELK_OPTIONS
    });

    if (!layoutedGraph) {
      console.error('[ELK] Layout returned null');
      return null;
    }

    // Извлекаем позиции узлов
    const nodePositions = new Map<string, { x: number; y: number }>();
    
    if (layoutedGraph.children) {
      for (const node of layoutedGraph.children) {
        if (node.x !== undefined && node.y !== undefined) {
          nodePositions.set(node.id, { 
            x: node.x + (node.width || 160) / 2, 
            y: node.y + (node.height || 80) / 2 
          });
        }
      }
    }

    // Извлекаем точки перегиба рёбер (controlPoints)
    const edgeRoutes = new Map<string, { points: { x: number; y: number }[] }>();
    
    if (layoutedGraph.edges) {
      for (const edge of layoutedGraph.edges) {
        if (edge.sections && edge.sections.length > 0) {
          const section = edge.sections[0];
          const points: { x: number; y: number }[] = [];
          
          // Начальная точка
          points.push(section.startPoint);
          
          // Точки перегиба (bend points)
          if (section.bendPoints) {
            points.push(...section.bendPoints);
          }
          
          // Конечная точка
          points.push(section.endPoint);
          
          edgeRoutes.set(edge.id, { points });
        }
      }
    }

    console.log('[ELK] Layout complete:', nodePositions.size, 'nodes,', edgeRoutes.size, 'edges');
    
    return {
      nodes: nodePositions,
      edges: edgeRoutes
    };
  } catch (error) {
    console.error('[ELK] Layout error:', error);
    return null;
  }
}

/**
 * Применяет результаты ELK layout к данным G6
 */
export function applyElkLayoutToG6Data(
  g6Nodes: any[],
  g6Edges: any[],
  layoutResult: LayoutResult
): { nodes: any[]; edges: any[] } {
  // Применяем позиции к узлам
  const nodesWithPositions = g6Nodes.map(node => {
    const position = layoutResult.nodes.get(node.id);
    if (position) {
      return {
        ...node,
        x: position.x,
        y: position.y,
        data: {
          ...node.data,
          elkPositioned: true
        }
      };
    }
    return node;
  });

  // Применяем controlPoints к рёбрам
  const edgesWithRoutes = g6Edges.map(edge => {
    const route = layoutResult.edges.get(edge.id);
    if (route && route.points.length >= 2) {
      return {
        ...edge,
        data: {
          ...edge.data,
          controlPoints: route.points,
          elkRouted: true
        }
      };
    }
    return edge;
  });

  return {
    nodes: nodesWithPositions,
    edges: edgesWithRoutes
  };
}

/**
 * Хук для использования ELK layout в React компоненте
 */
export function useElkLayout() {
  const layoutRef = useRef<{
    perform: typeof performElkLayout;
    apply: typeof applyElkLayoutToG6Data;
  } | null>(null);

  if (!layoutRef.current) {
    layoutRef.current = {
      perform: performElkLayout,
      apply: applyElkLayoutToG6Data
    };
  }

  return layoutRef.current;
}

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
 * Добавляет порты для вертикального подключения рёбер
 */
function convertToElkGraph(
  nodes: Array<{ id: string; type?: string; size?: [number, number] }>,
  edges: Array<{ id: string; source: string; target: string }>
): ElkNodeType {
  const elkNodes = nodes.map(node => {
    const width = node.size?.[0] || 160;
    const height = node.size?.[1] || 80;
    const isSource = node.type?.toLowerCase() === 'source';
    
    // Создаём порты для каждого узла
    // Порт TOP (вход) - индекс 0
    // Порт BOTTOM (выход) - индекс 1
    const ports = [
      {
        id: `${node.id}_TOP`,
        layoutOptions: {
          'org.eclipse.elk.port.side': 'NORTH',  // Север = верх
        }
      },
      {
        id: `${node.id}_BOTTOM`,
        layoutOptions: {
          'org.eclipse.elk.port.side': 'SOUTH',  // Юг = низ
        }
      }
    ];
    
    return {
      id: node.id,
      width,
      height,
      // Добавляем порты для вертикального подключения
      ports,
      // Фиксируем source узлы вверху схемы
      ...(isSource && {
        layoutOptions: {
          'org.eclipse.elk.fixed': 'true',
          'org.eclipse.elk.layered.layerConstraint': 'FIRST',  // Первый слой (верх)
        }
      })
    };
  });

  // Рёбра с указанием портов в формате ELK (nodeId:portId)
  const elkEdges: ElkEdgeType[] = edges.map(edge => ({
    id: edge.id,
    // Формат для указания порта: источник:порт
    sources: [`${edge.source}:${edge.source}_BOTTOM`],  // Выход из нижнего порта
    targets: [`${edge.target}:${edge.target}_TOP`],     // Вход в верхний порт
  }));

  return {
    id: 'root',
    children: elkNodes,
    edges: elkEdges
  };
}

/**
 * Основные опции ELK для ортогональной маршрутизации
 * Оптимизировано для однолинейных электрических схем
 */
const ELK_OPTIONS: Record<string, string> = {
  // ===== АЛГОРИТМ =====
  'elk.algorithm': 'layered',
  
  // ===== НАПРАВЛЕНИЕ =====
  'elk.direction': 'DOWN',  // Ток течёт сверху вниз
  
  // ===== МАРШРУТИЗАЦИЯ РЁБЕР =====
  'elk.edgeRouting': 'ORTHOGONAL',  // Строго 90° углы
  'elk.layered.edgeRouting.orthogonalEdges.routingStrategy': 'ORTHOGONAL',
  
  // ===== РАССТОЯНИЯ - УВЕЛИЧЕНЫ ДЛЯ РАЗДЕЛЕНИЯ ЛИНИЙ =====
  'elk.spacing.nodeNode': '120',           // Расстояние между узлами на одном уровне
  'elk.layered.spacing.nodeNodeBetweenLayers': '180',  // Расстояние между слоями
  'elk.spacing.edgeNode': '40',             // Отступ ребра от узла
  'elk.spacing.edgeEdge': '40',            // Расстояние между параллельными рёбрами - КЛЮЧЕВОЙ ПАРАМЕТР
  'elk.layered.edgeRouting.orthogonalEdges.edgeSpacing': '40',
  
  // ===== МИНИМИЗАЦИЯ ПЕРЕСЕЧЕНИЙ =====
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.crossingMinimization.semiInteractiveCrossingMinimization': 'true',
  'elk.layered.crossingMinimization.horizontalConstraint': 'BALANCED',
  
  // ===== РАЗМЕЩЕНИЕ УЗЛОВ =====
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',  // Оптимальное выравнивание
  'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
  
  // ===== ПОРТЫ И ТОЧКИ ПОДКЛЮЧЕНИЯ =====
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.portConstraints': 'FIXED_SIDE',     // Порты фиксируются на сторонах
  
  // ===== РАЗДЕЛЕНИЕ КОМПОНЕНТОВ =====
  'elk.separateConnectedComponents': 'true',
  'elk.spacing.componentComponent': '80',  // Расстояние между компонентами
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

/**
 * ELK Layout Integration for G6
 * Профессиональная ортогональная маршрутизация рёбер с обходом препятствий
 * Автоматический расчёт размера BUS по количеству портов
 */

import { useRef } from 'react';
import ELK, { type ElkNode, type ElkExtendedEdge, type ElkPort } from 'elkjs';

// Типы для ELK
type ElkNodeType = ElkNode;
type ElkEdgeType = ElkExtendedEdge;

interface ElkEdgeSection {
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  bendPoints?: { x: number; y: number }[];
}

interface LayoutResult {
  nodes: Map<string, { x: number; y: number; width?: number; height?: number }>;
  edges: Map<string, { points: { x: number; y: number }[] }>;
}

// Минимальная ширина BUS
const BUS_MIN_WIDTH = 200;
// Расстояние между портами на BUS
const PORT_SPACING = 60;
// Минимальный отступ от края BUS до порта
const BUS_PORT_MARGIN = 40;

// Singleton ELK instance
let elkInstance: InstanceType<typeof ELK> | null = null;

function getElk(): InstanceType<typeof ELK> {
  if (!elkInstance) {
    elkInstance = new ELK();
  }
  return elkInstance;
}

/**
 * Определяет порты для BUS узла на основе подключённых рёбер
 * Порты распределяются по длине BUS автоматически
 */
function createBusPorts(
  nodeId: string,
  incomingEdges: Array<{ id: string; source: string }>,
  outgoingEdges: Array<{ id: string; target: string }>
): { ports: ElkPort[]; calculatedWidth: number } {
  const ports: ElkPort[] = [];
  
  // Входящие порты (сверху - NORTH) - от источников питания
  incomingEdges.forEach((edge, idx) => {
    ports.push({
      id: `${nodeId}_IN_${idx}`,
      layoutOptions: {
        'org.eclipse.elk.port.side': 'NORTH',
        // Порядок порта для распределения слева направо
        'org.eclipse.elk.port.index': String(idx),
      }
    });
  });
  
  // Выходящие порты (снизу - SOUTH) - к нагрузкам
  outgoingEdges.forEach((edge, idx) => {
    ports.push({
      id: `${nodeId}_OUT_${idx}`,
      layoutOptions: {
        'org.eclipse.elk.port.side': 'SOUTH',
        'org.eclipse.elk.port.index': String(idx + incomingEdges.length),
      }
    });
  });
  
  // Вычисляем ширину BUS на основе количества портов
  const totalPorts = Math.max(incomingEdges.length, outgoingEdges.length);
  const calculatedWidth = Math.max(
    BUS_MIN_WIDTH,
    totalPorts * PORT_SPACING + BUS_PORT_MARGIN * 2
  );
  
  return { ports, calculatedWidth };
}

/**
 * Конвертирует данные графа в формат ELK
 * Добавляет порты для вертикального подключения рёбер
 * BUS узлы автоматически расширяются по количеству портов
 */
function convertToElkGraph(
  nodes: Array<{ id: string; type?: string; size?: [number, number] }>,
  edges: Array<{ id: string; source: string; target: string }>
): ElkNodeType {
  // Создаём мапы для быстрого поиска входящих/исходящих рёбер
  const incomingEdges = new Map<string, Array<{ id: string; source: string }>>();
  const outgoingEdges = new Map<string, Array<{ id: string; target: string }>>();
  
  nodes.forEach(node => {
    incomingEdges.set(node.id, []);
    outgoingEdges.set(node.id, []);
  });
  
  edges.forEach(edge => {
    incomingEdges.get(edge.target)?.push({ id: edge.id, source: edge.source });
    outgoingEdges.get(edge.source)?.push({ id: edge.id, target: edge.target });
  });
  
  // Мапа для хранения портов по ID ребра
  const edgeSourcePort = new Map<string, string>();
  const edgeTargetPort = new Map<string, string>();
  
  const elkNodes = nodes.map(node => {
    const isBus = node.type?.toLowerCase() === 'bus';
    const isSource = node.type?.toLowerCase() === 'source';
    const isJunction = node.type?.toLowerCase() === 'junction';
    
    const nodeIncoming = incomingEdges.get(node.id) || [];
    const nodeOutgoing = outgoingEdges.get(node.id) || [];
    
    let width = node.size?.[0] || 160;
    let height = node.size?.[1] || 80;
    let ports: ElkPort[] = [];
    let portConstraints = 'FIXED_SIDE';
    
    if (isBus) {
      // BUS узел - порты создаются динамически по количеству подключений
      const busResult = createBusPorts(node.id, nodeIncoming, nodeOutgoing);
      ports = busResult.ports;
      width = busResult.calculatedWidth;
      height = 40; // BUS тонкий и широкий
      portConstraints = 'FIXED_ORDER'; // Порты распределяются по порядку
      
      // Сохраняем связь ребро -> порт
      nodeIncoming.forEach((edge, idx) => {
        edgeTargetPort.set(edge.id, `${node.id}_IN_${idx}`);
      });
      nodeOutgoing.forEach((edge, idx) => {
        edgeSourcePort.set(edge.id, `${node.id}_OUT_${idx}`);
      });
      
      console.log(`[ELK] BUS ${node.id}: ${nodeIncoming.length} in, ${nodeOutgoing.length} out, width=${width}`);
    } else {
      // Обычный узел - стандартные порты TOP/BOTTOM
      ports = [
        {
          id: `${node.id}_TOP`,
          layoutOptions: {
            'org.eclipse.elk.port.side': 'NORTH',
          }
        },
        {
          id: `${node.id}_BOTTOM`,
          layoutOptions: {
            'org.eclipse.elk.port.side': 'SOUTH',
          }
        }
      ];
      
      // Стандартное сопоставление ребро -> порт
      nodeIncoming.forEach(edge => {
        edgeTargetPort.set(edge.id, `${node.id}_TOP`);
      });
      nodeOutgoing.forEach(edge => {
        edgeSourcePort.set(edge.id, `${node.id}_BOTTOM`);
      });
    }
    
    return {
      id: node.id,
      width,
      height,
      ports,
      layoutOptions: {
        'org.eclipse.elk.portConstraints': portConstraints,
        // Для BUS - позволяем ELK вычислять размер по портам
        ...(isBus && {
          'org.eclipse.elk.nodeSize.constraints': 'PORTS',
          'org.eclipse.elk.nodeSize.minimum': `(${width}, ${height})`,
        }),
        // Фиксируем source узлы вверху схемы
        ...(isSource && {
          'org.eclipse.elk.fixed': 'true',
          'org.eclipse.elk.layered.layerConstraint': 'FIRST',
        }),
        // Junction - компактный размер
        ...(isJunction && {
          'org.eclipse.elk.nodeSize.constraints': 'MINIMUM_SIZE',
          'org.eclipse.elk.nodeSize.minimum': '(40, 40)',
        }),
      }
    };
  });

  // Рёбра с указанием портов
  const elkEdges: ElkEdgeType[] = edges.map(edge => {
    const sourcePort = edgeSourcePort.get(edge.id) || `${edge.source}_BOTTOM`;
    const targetPort = edgeTargetPort.get(edge.id) || `${edge.target}_TOP`;
    
    return {
      id: edge.id,
      sources: [`${edge.source}:${sourcePort}`],
      targets: [`${edge.target}:${targetPort}`],
    };
  });

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

    // Извлекаем позиции узлов и их размеры
    const nodePositions = new Map<string, { x: number; y: number; width?: number; height?: number }>();
    
    if (layoutedGraph.children) {
      for (const node of layoutedGraph.children) {
        if (node.x !== undefined && node.y !== undefined) {
          nodePositions.set(node.id, { 
            x: node.x + (node.width || 160) / 2, 
            y: node.y + (node.height || 80) / 2,
            width: node.width,
            height: node.height,
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
  // Применяем позиции к узлам (включая вычисленные размеры для BUS)
  const nodesWithPositions = g6Nodes.map(node => {
    const position = layoutResult.nodes.get(node.id);
    if (position) {
      const isBus = node.data?.type?.toLowerCase() === 'bus';
      return {
        ...node,
        x: position.x,
        y: position.y,
        data: {
          ...node.data,
          elkPositioned: true,
          // Сохраняем вычисленный размер для BUS в data (не в style!)
          ...(isBus && position.width && {
            calculatedWidth: position.width,
            calculatedHeight: position.height || 40,
          }),
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

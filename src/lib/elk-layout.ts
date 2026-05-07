/**
 * ELK Layout - использует elkjs напрямую для профессиональной раскладки
 * @antv/layout 2.0.0 НЕ содержит ELK, поэтому используем elkjs
 */

import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs';

// Singleton ELK instance
let elkInstance: InstanceType<typeof ELK> | null = null;

function getElk(): InstanceType<typeof ELK> {
  if (!elkInstance) {
    elkInstance = new ELK();
  }
  return elkInstance;
}

// Размеры узлов по типам
const NODE_SIZES: Record<string, [number, number]> = {
  source: [160, 80],
  bus: [200, 40],
  breaker: [140, 70],
  meter: [140, 70],
  load: [160, 80],
  cabinet: [180, 50],
  junction: [40, 40],
  transformer: [140, 80],
  default: [160, 80],
};

export interface ElkLayoutResult {
  nodes: Map<string, { x: number; y: number; width: number; height: number }>;
  edges: Map<string, { points: { x: number; y: number }[] }>;
}

/**
 * Выполняет ELK layout и возвращает позиции узлов и маршруты рёбер
 */
export async function performElkLayout(
  nodes: Array<{ id: string; type?: string }>,
  edges: Array<{ id: string; source: string; target: string }>
): Promise<ElkLayoutResult | null> {
  if (nodes.length === 0) {
    console.warn('[ELK] No nodes to layout');
    return null;
  }

  try {
    const elk = getElk();

    // Считаем подключения для BUS
    const incomingCount = new Map<string, number>();
    const outgoingCount = new Map<string, number>();
    nodes.forEach(n => {
      incomingCount.set(n.id, 0);
      outgoingCount.set(n.id, 0);
    });
    edges.forEach(edge => {
      if (incomingCount.has(edge.target)) {
        incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
      }
      if (outgoingCount.has(edge.source)) {
        outgoingCount.set(edge.source, (outgoingCount.get(edge.source) || 0) + 1);
      }
    });

    // Создаём узлы ELK с явными размерами
    const elkNodes: ElkNode[] = nodes.map(node => {
      const nodeType = (node.type || 'default').toLowerCase();
      const defaultSize = NODE_SIZES[nodeType] || NODE_SIZES.default;
      let width = defaultSize[0];
      let height = defaultSize[1];

      // BUS - расширяется по количеству подключений
      if (nodeType === 'bus') {
        const total = Math.max(
          incomingCount.get(node.id) || 0,
          outgoingCount.get(node.id) || 0
        );
        width = Math.max(200, total * 60 + 80);
      }

      return {
        id: node.id,
        width,
        height,
      };
    });

    // Создаём рёбра ELK
    const elkEdges: ElkExtendedEdge[] = edges.map(edge => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    }));

    // Граф для ELK
    const elkGraph: ElkNode = {
      id: 'root',
      children: elkNodes,
      edges: elkEdges,
    };

    // Конфигурация ELK - ВСЕ ЗНАЧЕНИЯ КАК СТРОКИ
    const layoutOptions: Record<string, string> = {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '100',
      'elk.layered.spacing.nodeNodeBetweenLayers': '150',
      'elk.spacing.edgeNode': '50',
      'elk.spacing.edgeEdge': '20',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    };

    console.log('[ELK] Starting layout with options:', layoutOptions);
    console.log('[ELK] Nodes:', elkNodes.length, 'Edges:', elkEdges.length);

    // Выполняем layout
    const layoutedGraph = await elk.layout(elkGraph, { layoutOptions });

    if (!layoutedGraph) {
      console.error('[ELK] Layout returned null');
      return null;
    }

    // Извлекаем позиции узлов
    const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();

    if (layoutedGraph.children) {
      for (const node of layoutedGraph.children) {
        if (node.x !== undefined && node.y !== undefined) {
          nodePositions.set(node.id, {
            x: node.x + (node.width || 0) / 2, // Центр узла
            y: node.y + (node.height || 0) / 2,
            width: node.width || 160,
            height: node.height || 80,
          });
        }
      }
    }

    // Извлекаем маршруты рёбер
    const edgeRoutes = new Map<string, { points: { x: number; y: number }[] }>();

    if (layoutedGraph.edges) {
      for (const edge of layoutedGraph.edges) {
        if (edge.sections && edge.sections.length > 0) {
          const section = edge.sections[0];
          const points: { x: number; y: number }[] = [];

          points.push(section.startPoint);

          if (section.bendPoints) {
            points.push(...section.bendPoints);
          }

          points.push(section.endPoint);

          edgeRoutes.set(edge.id, { points });
        }
      }
    }

    console.log('[ELK] Layout complete:', nodePositions.size, 'nodes,', edgeRoutes.size, 'edges with routes');

    return {
      nodes: nodePositions,
      edges: edgeRoutes,
    };
  } catch (error) {
    console.error('[ELK] Layout error:', error);
    return null;
  }
}

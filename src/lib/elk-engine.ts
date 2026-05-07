/**
 * Standalone ELK Layout Engine
 * Вычисляет координаты узлов и контрольные точки рёбер БЕЗ привязки к G6.
 * G6 используется как пассивный рендерер — только рисует то, что рассчитал ELK.
 */

import ELK from 'elkjs/lib/elk.bundled.js';

// Конфигурация ELK для электрической схемы
const ELK_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  // Сохраняем порядок узлов и связей
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.cycleBreaking.strategy': 'MODEL_ORDER',
  // Каждый уровень обрабатывается независимо
  'elk.hierarchyHandling': 'SEPARATE_CHILDREN',
  // Оптимальное размещение
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  // Отступы
  'elk.spacing.nodeNode': '20',
  'elk.layered.spacing.nodeNodeBetweenLayers': '50',
  'elk.spacing.edgeEdge': '8',
  // Ортогональная маршрутизация
  'elk.edgeRouting': 'ORTHOGONAL',
  // Убираем лишние изгибы
  'elk.layered.unnecessaryBendpoints': 'true',
};

// Размеры узлов по типам (должны совпадать с NetworkGraphG6)
export const NODE_SIZES: Record<string, { width: number; height: number }> = {
  source: { width: 120, height: 60 },
  bus: { width: 150, height: 30 },
  breaker: { width: 100, height: 50 },
  meter: { width: 100, height: 50 },
  load: { width: 120, height: 60 },
  cabinet: { width: 140, height: 40 },
  junction: { width: 30, height: 30 },
  transformer: { width: 100, height: 60 },
};

interface LayoutNode {
  id: string;
  type?: string;
  data?: any;
  combo?: string;
}

interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  data?: any;
}

interface LayoutResult {
  nodes: Array<{
    id: string;
    x: number;      // center x
    y: number;      // center y
    width: number;
    height: number;
  }>;
  edges: Array<{
    id: string;
    controlPoints?: Array<{ x: number; y: number }>;
    startPoint?: { x: number; y: number };
    endPoint?: { x: number; y: number };
  }>;
}

let elkInstance: InstanceType<typeof ELK> | null = null;

function getElk(): InstanceType<typeof ELK> {
  if (!elkInstance) {
    elkInstance = new ELK();
  }
  return elkInstance;
}

/**
 * Рассчитать layout через ELK.
 * Принимает сырые данные (nodes/edges), возвращает готовые координаты.
 */
export async function computeElkLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): Promise<LayoutResult> {
  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  console.log('[ELK Engine] Computing layout for', nodes.length, 'nodes,', edges.length, 'edges');

  const elk = getElk();

  // Подготавливаем узлы для ELK
  const elkNodes = nodes.map((node, index) => {
    const type = (node.data?.type || node.type || 'load').toLowerCase();
    const size = NODE_SIZES[type] || { width: 120, height: 60 };

    // Порты для ортогональных соединений
    const ports = type === 'source'
      ? [{ id: `${node.id}_out`, properties: { 'port.side': 'SOUTH' } }]
      : type === 'load'
      ? [{ id: `${node.id}_in`, properties: { 'port.side': 'NORTH' } }]
      : [
        { id: `${node.id}_in`, properties: { 'port.side': 'NORTH' } },
        { id: `${node.id}_out`, properties: { 'port.side': 'SOUTH' } },
      ];

    return {
      id: node.id,
      width: size.width,
      height: size.height,
      ports,
      properties: {
        'portConstraints': 'FIXED_ORDER',
      },
      // Сохраняем исходный порядок
      layoutOptions: {
        'elk.position': `(x=${index * 200})`,
      },
    };
  });

  // Подготавливаем рёбра
  const nodeIds = new Set(nodes.map(n => n.id));
  const validEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

  const elkEdges = validEdges.map(edge => ({
    id: edge.id || `${edge.source}-${edge.target}`,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const elkGraph = {
    id: 'root',
    layoutOptions: ELK_OPTIONS,
    children: elkNodes,
    edges: elkEdges,
  };

  try {
    const layoutedGraph = await elk.layout(elkGraph);

    if (!layoutedGraph.children) {
      throw new Error('ELK returned empty layout');
    }

    console.log('[ELK Engine] Layout complete:', layoutedGraph.children.length, 'nodes');

    // Преобразуем: ELK top-left → G6 center
    const resultNodes = layoutedGraph.children.map((n: any) => ({
      id: n.id,
      x: (n.x ?? 0) + (n.width ?? 0) / 2,
      y: (n.y ?? 0) + (n.height ?? 0) / 2,
      width: n.width || 120,
      height: n.height || 60,
    }));

    // Контрольные точки рёбер
    const layoutedEdgesMap = new Map(
      (layoutedGraph.edges || []).map((e: any) => [e.id, e])
    );

    const resultEdges = validEdges.map(edge => {
      const elkEdge = layoutedEdgesMap.get(edge.id || `${edge.source}-${edge.target}`);
      if (!elkEdge) return { id: edge.id };

      const section = elkEdge.sections?.[0];
      if (!section) return { id: edge.id };

      // Стартовая и конечная точки (порты)
      const result: any = { id: edge.id };
      if (section.startPoint) {
        result.startPoint = { x: section.startPoint.x, y: section.startPoint.y };
      }
      if (section.endPoint) {
        result.endPoint = { x: section.endPoint.x, y: section.endPoint.y };
      }

      // Bend points
      if (section.bendPoints?.length) {
        result.controlPoints = section.bendPoints.map((bp: any) => ({
          x: bp.x,
          y: bp.y,
        }));
      }

      return result;
    });

    return { nodes: resultNodes, edges: resultEdges };

  } catch (error) {
    console.error('[ELK Engine] Error:', error);

    // Fallback — сетка
    const fallbackNodes = nodes.map((node, index) => {
      const type = (node.data?.type || node.type || 'load').toLowerCase();
      const size = NODE_SIZES[type] || { width: 120, height: 60 };
      return {
        id: node.id,
        x: size.width / 2 + 100 + (index % 10) * 150,
        y: size.height / 2 + 100 + Math.floor(index / 10) * 100,
        width: size.width,
        height: size.height,
      };
    });

    return { nodes: fallbackNodes, edges: [] };
  }
}

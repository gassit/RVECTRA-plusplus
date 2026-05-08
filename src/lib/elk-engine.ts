/**
 * Standalone ELK Layout Engine
 * Вычисляет координаты узлов и рёбер БЕЗ привязки к G6.
 * G6 используется как пассивный рендерер — только рисует то, что рассчитал ELK.
 *
 * Плоский список узлов (без вложенности Cabinet).
 */

import ELK from 'elkjs/lib/elk.bundled.js';

// ============================================================================
// НАСТРОЙКИ ELK
// ============================================================================
const ELK_OPTIONS: Record<string, string> = {
  // Алгоритм: иерархическая послойная раскладка
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',

  // Учитываем порядок узлов и связей из входных данных
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',

  // Разрыв циклов: INTERACTIVE — минимальное искажение при кольцевании
  'elk.cycleBreaking.strategy': 'INTERACTIVE',

  // Обратные связи рисуются огибающим контуром, не ломая иерархию
  'elk.layered.feedbackEdges': 'true',

  // Иерархия: каждый уровень обрабатывается независимо
  'elk.hierarchyHandling': 'SEPARATE_CHILDREN',

  // Оптимальное размещение узлов
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',

  // Отступы (критично для читаемости)
  'elk.spacing.nodeNode': '80',
  'elk.layered.spacing.nodeNodeBetweenLayers': '150',
  'elk.spacing.edgeEdge': '8',

  // Ортогональная маршрутизация — прямые углы
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.portConstraints': 'FIXED_SIDE',

  // Убираем лишние изгибы
  'elk.layered.unnecessaryBendpoints': 'true',
};

// ============================================================================
// РАЗМЕРЫ УЗЛОВ ПО ТИПАМ
// ============================================================================
export const NODE_SIZES: Record<string, { width: number; height: number }> = {
  source:      { width: 120, height: 60 },
  bus:         { width: 150, height: 30 },
  breaker:     { width: 100, height: 50 },
  meter:       { width: 100, height: 50 },
  load:        { width: 120, height: 60 },
  cabinet:     { width: 140, height: 40 },
  junction:    { width: 30,  height: 30 },
  transformer: { width: 100, height: 60 },
};

// ============================================================================
// ТИПЫ
// ============================================================================
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
  }>;
}

// ============================================================================
// ELK SINGLETON
// ============================================================================
let elkInstance: InstanceType<typeof ELK> | null = null;

function getElk(): InstanceType<typeof ELK> {
  if (!elkInstance) {
    elkInstance = new ELK();
  }
  return elkInstance;
}

// ============================================================================
// ПОСТРОЕНИЕ ПОРТОВ
// ============================================================================
function buildPorts(nodeId: string, type: string): Array<{ id: string; properties: Record<string, string> }> {
  switch (type) {
    case 'source':
      return [{ id: `${nodeId}_out`, properties: { 'port.side': 'SOUTH' } }];
    case 'load':
      return [{ id: `${nodeId}_in`, properties: { 'port.side': 'NORTH' } }];
    default:
      return [
        { id: `${nodeId}_in`,  properties: { 'port.side': 'NORTH' } },
        { id: `${nodeId}_out`, properties: { 'port.side': 'SOUTH' } },
      ];
  }
}

// ============================================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================================
export async function computeElkLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): Promise<LayoutResult> {
  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  console.log('[ELK Engine] Computing layout for', nodes.length, 'nodes,', edges.length, 'edges');

  const elk = getElk();

  // Подготавливаем узлы для ELK (плоский список)
  const elkNodes = nodes.map((node, index) => {
    const type = (node.data?.type || node.type || 'load').toLowerCase();
    const size = NODE_SIZES[type] || { width: 120, height: 60 };

    const nodeLayoutOptions: Record<string, string> = {
      'elk.position': `(x=${index * 200})`,
    };

    // Источники: минимальный ранг — всегда наверху
    if (type === 'source') {
      nodeLayoutOptions['elk.layering.layerConstraint'] = 'FIRST_SEPARATE';
    }

    return {
      id: node.id,
      width: size.width,
      height: size.height,
      ports: buildPorts(node.id, type),
      properties: {
        'portConstraints': 'FIXED_ORDER',
      },
      layoutOptions: nodeLayoutOptions,
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

    const resultEdges = validEdges.map(edge => ({ id: edge.id }));

    console.log('[ELK Engine] Result:', resultNodes.length, 'nodes,', resultEdges.length, 'edges');

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

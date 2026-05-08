/**
 * Standalone ELK Layout Engine
 * Вычисляет координаты узлов и контрольные точки рёбер БЕЗ привязки к G6.
 * G6 используется как пассивный рендерер — только рисует то, что рассчитал ELK.
 *
 * Ключевые особенности:
 * - Иерархическая вложенность: Cabinet содержит дочерние элементы (children)
 * - Ортогональная маршрутизация с прямыми углами 90°
 * - Обратные связи (feedback edges) для кольцевания
 * - Источники зафиксированы наверху
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

  // Отступы
  'elk.spacing.nodeNode': '20',
  'elk.layered.spacing.nodeNodeBetweenLayers': '50',
  'elk.spacing.edgeEdge': '8',

  // Ортогональная маршрутизация — прямые углы
  'elk.edgeRouting': 'ORTHOGONAL',

  // Убираем лишние изгибы
  'elk.layered.unnecessaryBendpoints': 'true',
};

// ============================================================================
// РАЗМЕРЫ УЗЛОВ ПО ТИПАМ
// ============================================================================
export const NODE_SIZES: Record<string, { width: number; height: number }> = {
  source:     { width: 120, height: 60 },
  bus:        { width: 150, height: 30 },
  breaker:    { width: 100, height: 50 },
  meter:      { width: 100, height: 50 },
  load:       { width: 120, height: 60 },
  cabinet:    { width: 180, height: 50 },  // Увеличен для заголовка
  junction:   { width: 30,  height: 30 },
  transformer: { width: 100, height: 60 },
};

// ============================================================================
// ТИПЫ
// ============================================================================
interface LayoutNode {
  id: string;
  type?: string;
  data?: any;
  combo?: string;  // parentId — ссылка на cabinet
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
    parentId?: string;  // для G6 combo
  }>;
  edges: Array<{
    id: string;
    controlPoints?: Array<{ x: number; y: number }>;
    startPoint?: { x: number; y: number };
    endPoint?: { x: number; y: number };
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
// ИЗВЛЕЧЕНИЕ ВСЕХ УЗЛОВ ИЗ ВЛОЖЕННОГО ГРАФА (рекурсия)
// ============================================================================
function flattenNodes(elkChildren: any[], parentId?: string): LayoutResult['nodes'] {
  const result: LayoutResult['nodes'] = [];
  for (const child of elkChildren) {
    if (child.children) {
      // Это cabinet — сам становится узлом + рекурсия по детям
      result.push({
        id: child.id,
        x: (child.x ?? 0) + (child.width ?? 0) / 2,
        y: (child.y ?? 0) + (child.height ?? 0) / 2,
        width: child.width || 180,
        height: child.height || 50,
      });
      result.push(...flattenNodes(child.children, child.id));
    } else {
      // Обычный узел
      result.push({
        id: child.id,
        x: (child.x ?? 0) + (child.width ?? 0) / 2,
        y: (child.y ?? 0) + (child.height ?? 0) / 2,
        width: child.width || 120,
        height: child.height || 60,
        parentId,
      });
    }
  }
  return result;
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
  const nodeIds = new Set(nodes.map(n => n.id));

  // ================================================================
  // ШАГ 1: Разделяем узлы на cabinets и обычные
  // ================================================================
  const cabinets = nodes.filter(n => {
    const t = (n.data?.type || n.type || '').toLowerCase();
    return t === 'cabinet';
  });

  const cabinetIds = new Set(cabinets.map(c => c.id));

  // Обычные узлы — НЕ cabinet
  const regularNodes = nodes.filter(n => !cabinetIds.has(n.id));

  // Дочерние узлы каждого cabinet (по combo === parentId)
  const childrenOf = new Map<string, LayoutNode[]>();
  for (const node of regularNodes) {
    const parent = node.combo;
    if (parent && cabinetIds.has(parent)) {
      if (!childrenOf.has(parent)) childrenOf.set(parent, []);
      childrenOf.get(parent)!.push(node);
    }
  }

  // Корневые узлы (не привязаны к cabinet или привязаны к несуществующему)
  const rootNodes = regularNodes.filter(n => {
    const parent = n.combo;
    return !parent || !cabinetIds.has(parent);
  });

  console.log('[ELK Engine] Cabinets:', cabinets.length,
    '| Root nodes:', rootNodes.length,
    '| Nested children:', regularNodes.length - rootNodes.length);

  // ================================================================
  // ШАГ 2: Собираем ELK граф с иерархией (children)
  // ================================================================

  // Функция для создания ELK-узла
  const makeElkNode = (node: LayoutNode, index: number): any => {
    const type = (node.data?.type || node.type || 'load').toLowerCase();
    const size = NODE_SIZES[type] || { width: 120, height: 60 };

    const nodeLayoutOptions: Record<string, string> = {
      'elk.position': `(x=${index * 200})`,
    };

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
  };

  // Строим детей для каждого cabinet
  const elkChildren: any[] = [];

  // Корневые узлы (без parent)
  rootNodes.forEach((node, i) => {
    elkChildren.push(makeElkNode(node, i));
  });

  // Cabinets с вложенными детьми
  cabinets.forEach((cabinet, i) => {
    const cabinetType = (cabinet.data?.type || cabinet.type || 'cabinet').toLowerCase();
    const cabinetSize = NODE_SIZES[cabinetType] || { width: 180, height: 50 };
    const children = childrenOf.get(cabinet.id) || [];

    // Рассчитываем размер cabinet по детям
    const childCount = children.length;
    const cabinetHeight = Math.max(
      cabinetSize.height,
      50 + childCount * 70  // padding + высота детей
    );
    const cabinetWidth = Math.max(
      cabinetSize.width,
      children.length > 0 ? 200 : cabinetSize.width
    );

    elkChildren.push({
      id: cabinet.id,
      width: cabinetWidth,
      height: cabinetHeight,
      ports: [
        { id: `${cabinet.id}_in`,  properties: { 'port.side': 'NORTH' } },
        { id: `${cabinet.id}_out`, properties: { 'port.side': 'SOUTH' } },
      ],
      properties: {
        'portConstraints': 'FIXED_ORDER',
      },
      layoutOptions: {
        'elk.padding': '[top=30,left=20,bottom=20,right=20]',
        'elk.spacing.nodeNode': '30',
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.edgeRouting': 'ORTHOGONAL',
      },
      // ВЛОЖЕННОСТЬ — дети внутри cabinet
      children: children.map((child, ci) => {
        const childType = (child.data?.type || child.type || 'load').toLowerCase();
        const childSize = NODE_SIZES[childType] || { width: 120, height: 60 };

        return {
          id: child.id,
          width: childSize.width,
          height: childSize.height,
          ports: buildPorts(child.id, childType),
          properties: {
            'portConstraints': 'FIXED_ORDER',
          },
          layoutOptions: {
            'elk.position': `(x=${ci * 200})`,
          },
        };
      }),
    });
  });

  // ================================================================
  // ШАГ 3: Подготавливаем рёбра
  // ================================================================
  const validEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

  const elkEdges = validEdges.map(edge => ({
    id: edge.id || `${edge.source}-${edge.target}`,
    sources: [edge.source],
    targets: [edge.target],
  }));

  // ================================================================
  // ШАГ 4: Вызываем ELK
  // ================================================================
  const elkGraph = {
    id: 'root',
    layoutOptions: ELK_OPTIONS,
    children: elkChildren,
    edges: elkEdges,
  };

  try {
    const layoutedGraph = await elk.layout(elkGraph);

    if (!layoutedGraph.children) {
      throw new Error('ELK returned empty layout');
    }

    console.log('[ELK Engine] Layout complete:', layoutedGraph.children.length, 'top-level elements');

    // Извлекаем ВСЕ узлы (рекурсивно из вложенных cabinet)
    const resultNodes = flattenNodes(layoutedGraph.children);

    // Контрольные точки рёбер
    const layoutedEdgesMap = new Map(
      (layoutedGraph.edges || []).map((e: any) => [e.id, e])
    );

    const resultEdges = validEdges.map(edge => {
      const elkEdge = layoutedEdgesMap.get(edge.id || `${edge.source}-${edge.target}`);
      if (!elkEdge) return { id: edge.id };

      const section = elkEdge.sections?.[0];
      if (!section) return { id: edge.id };

      const result: any = { id: edge.id };
      if (section.startPoint) {
        result.startPoint = { x: section.startPoint.x, y: section.startPoint.y };
      }
      if (section.endPoint) {
        result.endPoint = { x: section.endPoint.x, y: section.endPoint.y };
      }
      if (section.bendPoints?.length) {
        result.controlPoints = section.bendPoints.map((bp: any) => ({
          x: bp.x,
          y: bp.y,
        }));
      }

      return result;
    });

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

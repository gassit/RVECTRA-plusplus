/**
 * Standalone ELK Layout Engine — двухэтапная раскладка
 *
 * Этап 1: Раскладка внутренностей каждого шкафа (локальные координаты)
 * Этап 2: Раскладка шкафов и корневых узлов как единых блоков
 *
 * G6 — пассивный рендерер, только рисует то, что рассчитал ELK.
 */

import ELK from 'elkjs/lib/elk.bundled.js';

// ============================================================================
// РАЗМЕРЫ УЗЛОВ ПО ТИПАМ
// ============================================================================
export const NODE_SIZES: Record<string, { width: number; height: number }> = {
  source:      { width: 120, height: 60 },
  bus:         { width: 150, height: 30 },
  breaker:     { width: 100, height: 50 },
  meter:       { width: 100, height: 50 },
  load:        { width: 120, height: 60 },
  cabinet:     { width: 250, height: 200 },
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
  combo?: string; // parentId — ссылка на cabinet
}

interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  data?: any;
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutResult {
  nodes: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  edges: Array<{
    id: string;
    controlPoints?: Array<{ x: number; y: number }>;
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
// ИЗВЛЕЧЕНИЕ КОНТРОЛЬНЫХ ТОЧЕК ИЗ РЁБРА ELK
// ============================================================================
function getControlPoints(elkEdge: any, offsetX = 0, offsetY = 0): Array<{ x: number; y: number }> {
  if (!elkEdge?.sections?.[0]) return [];
  const section = elkEdge.sections[0];
  const points: Array<{ x: number; y: number }> = [];

  if (section.startPoint) {
    points.push({ x: section.startPoint.x + offsetX, y: section.startPoint.y + offsetY });
  }
  if (section.bendPoints) {
    for (const bp of section.bendPoints) {
      points.push({ x: bp.x + offsetX, y: bp.y + offsetY });
    }
  }
  if (section.endPoint) {
    points.push({ x: section.endPoint.x + offsetX, y: section.endPoint.y + offsetY });
  }

  // Убираем первую и последнюю точку — G6 сам соединит source/target
  if (points.length > 2) {
    points.shift();
    points.pop();
  }

  return points;
}

// ============================================================================
// ОСНОВНАЯ ФУНКЦИЯ — ДВУХЭТАПНАЯ РАСКЛАДКА
// ============================================================================
export async function computeElkLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): Promise<LayoutResult> {
  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  console.log('[ELK Engine] Two-phase layout for', nodes.length, 'nodes,', edges.length, 'edges');

  const elk = getElk();

  // ================================================================
  // ПОДГОТОВКА: группировка по parentId (combo)
  // ================================================================
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const nodeIds = new Set(nodeMap.keys());

  const childrenOf = new Map<string, LayoutNode[]>(); // parentId → children
  const rootNodes: LayoutNode[] = [];

  for (const node of nodes) {
    const parentId = node.combo;
    if (parentId) {
      if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
      childrenOf.get(parentId)!.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  const cabinetIds = new Set(childrenOf.keys());

  console.log('[ELK Engine] Cabinets:', cabinetIds.size,
    '| Root nodes:', rootNodes.length,
    '| Nested:', nodes.length - rootNodes.length);

  // ================================================================
  // ЭТАП 1: Раскладка внутри каждого шкафа
  // ================================================================
  const cabinetInternalLayout = new Map<string, any>();
  const cabinetSizes = new Map<string, { width: number; height: number }>();

  for (const [cabinetId, childrenNodes] of childrenOf.entries()) {
    const cabinetNode = nodeMap.get(cabinetId);
    if (!cabinetNode) continue;

    // Рёбра внутри шкафа
    const internalEdges = edges.filter(e => {
      const srcParent = nodeMap.get(e.source)?.combo;
      const tgtParent = nodeMap.get(e.target)?.combo;
      return srcParent === cabinetId && tgtParent === cabinetId;
    });

    const subGraph: any = {
      id: cabinetId,
      width: 250,
      height: 200,
      children: childrenNodes.map(child => {
        const type = (child.data?.type || child.type || 'load').toLowerCase();
        const size = NODE_SIZES[type] || { width: 100, height: 50 };
        return {
          id: child.id,
          width: size.width,
          height: size.height,
          ports: buildPorts(child.id, type),
          properties: { 'portConstraints': 'FIXED_SIDE' },
        };
      }),
      edges: internalEdges.map(e => ({
        id: e.id || `${e.source}-${e.target}`,
        sources: [e.source],
        targets: [e.target],
      })),
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.spacing.nodeNode': '30',
        'elk.layered.spacing.nodeNodeBetweenLayers': '50',
        'elk.hierarchyHandling': 'SEPARATE_CHILDREN',
      },
    };

    try {
      const layoutedSub = await elk.layout(subGraph);
      cabinetInternalLayout.set(cabinetId, layoutedSub);

      // Вычисляем реальные размеры шкафа по раскладке детей
      let maxX = 0, maxY = 0;
      for (const child of layoutedSub.children || []) {
        maxX = Math.max(maxX, (child.x || 0) + (child.width || 0));
        maxY = Math.max(maxY, (child.y || 0) + (child.height || 0));
      }
      cabinetSizes.set(cabinetId, {
        width: maxX + 40,
        height: maxY + 40,
      });
    } catch (err) {
      console.error(`[ELK Engine] Cabinet ${cabinetId} layout error:`, err);
      cabinetSizes.set(cabinetId, { width: 250, height: 200 });
    }
  }

  // ================================================================
  // ЭТАП 2: Раскладка шкафов и корневых узлов
  // ================================================================
  const rootGraphChildren: any[] = [];

  // Шкафы как единые блоки
  for (const [cabinetId, size] of cabinetSizes.entries()) {
    const cabinetNode = nodeMap.get(cabinetId);
    const type = (cabinetNode?.data?.type || cabinetNode?.type || 'cabinet').toLowerCase();

    rootGraphChildren.push({
      id: cabinetId,
      width: size.width,
      height: size.height,
      ports: buildPorts(cabinetId, type),
      properties: { 'portConstraints': 'FIXED_ORDER' },
      layoutOptions: {
        'elk.layering.layerConstraint': 'FIRST_SEPARATE',
      },
    });
  }

  // Корневые узлы (не внутри шкафов и не сами шкафы)
  for (const node of rootNodes) {
    if (cabinetIds.has(node.id)) continue; // skip cabinet nodes themselves
    const type = (node.data?.type || node.type || 'load').toLowerCase();
    const size = NODE_SIZES[type] || { width: 120, height: 60 };

    const nodeOpts: any = {
      id: node.id,
      width: size.width,
      height: size.height,
      ports: buildPorts(node.id, type),
      properties: { 'portConstraints': 'FIXED_ORDER' },
    };

    // Источники — наверх
    if (type === 'source') {
      nodeOpts.layoutOptions = {
        'elk.layering.layerConstraint': 'FIRST_SEPARATE',
      };
    }

    rootGraphChildren.push(nodeOpts);
  }

  // Внешние рёбра (между шкафами и корневыми узлами)
  const externalEdges = edges.filter(e => {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) return false;
    const srcParent = nodeMap.get(e.source)?.combo;
    const tgtParent = nodeMap.get(e.target)?.combo;
    // Внутренние рёбра шкафов уже обработаны
    if (srcParent && tgtParent && srcParent === tgtParent) return false;
    return true;
  });

  const rootGraph: any = {
    id: 'root',
    children: rootGraphChildren,
    edges: externalEdges.map(e => ({
      id: e.id || `${e.source}-${e.target}`,
      sources: [e.source],
      targets: [e.target],
    })),
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.cycleBreaking.strategy': 'INTERACTIVE',
      'elk.layered.feedbackEdges': 'true',
      'elk.hierarchyHandling': 'SEPARATE_CHILDREN',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.nodeNodeBetweenLayers': '150',
      'elk.spacing.edgeEdge': '8',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.portConstraints': 'FIXED_SIDE',
      'elk.layered.unnecessaryBendpoints': 'true',
    },
  };

  let layoutedRoot: any;
  try {
    layoutedRoot = await elk.layout(rootGraph);
  } catch (error) {
    console.error('[ELK Engine] Root layout error:', error);
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

  if (!layoutedRoot.children) {
    throw new Error('ELK returned empty layout');
  }

  // ================================================================
  // СБОР ИТОГОВЫХ КООРДИНАТ
  // ================================================================
  const finalPositions = new Map<string, NodePosition>();

  // Позиции корневых элементов из layoutedRoot
  const rootPositions = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const child of layoutedRoot.children || []) {
    rootPositions.set(child.id, {
      x: child.x || 0,
      y: child.y || 0,
      width: child.width || 120,
      height: child.height || 60,
    });
  }

  // Корневые узлы (не шкафы)
  for (const [id, pos] of rootPositions.entries()) {
    if (!cabinetIds.has(id)) {
      finalPositions.set(id, {
        x: pos.x + pos.width / 2,
        y: pos.y + pos.height / 2,
        width: pos.width,
        height: pos.height,
      });
    }
  }

  // Внутренности шкафов: локальные координаты + смещение позиции шкафа
  for (const [cabinetId, cabinetLayout] of cabinetInternalLayout.entries()) {
    const rootPos = rootPositions.get(cabinetId);
    if (!rootPos) continue;

    const cabinetAbsX = rootPos.x;
    const cabinetAbsY = rootPos.y;

    // Позиция самого шкафа
    finalPositions.set(cabinetId, {
      x: cabinetAbsX + rootPos.width / 2,
      y: cabinetAbsY + rootPos.height / 2,
      width: rootPos.width,
      height: rootPos.height,
    });

    // Дочерние узлы — локальные координаты + смещение шкафа
    for (const child of cabinetLayout.children || []) {
      if (child.id === cabinetId) continue;
      finalPositions.set(child.id, {
        x: cabinetAbsX + (child.x || 0) + (child.width || 0) / 2,
        y: cabinetAbsY + (child.y || 0) + (child.height || 0) / 2,
        width: child.width || 100,
        height: child.height || 50,
      });
    }
  }

  // ================================================================
  // СБОР РЁБЕР С КОНТРОЛЬНЫМИ ТОЧКАМИ
  // ================================================================
  const resultEdges: LayoutResult['edges'] = [];

  // Внешние рёбра (из корневого графа)
  const rootEdgesMap = new Map(
    (layoutedRoot.edges || []).map((e: any) => [e.id, e])
  );

  for (const edge of externalEdges) {
    const edgeId = edge.id || `${edge.source}-${edge.target}`;
    const elkEdge = rootEdgesMap.get(edgeId);
    const controlPoints = elkEdge ? getControlPoints(elkEdge) : [];
    resultEdges.push({ id: edgeId, ...(controlPoints.length ? { controlPoints } : {}) });
  }

  // Внутренние рёбра (из шкафов) — смещаем точки на позицию шкафа
  for (const [cabinetId, cabinetLayout] of cabinetInternalLayout.entries()) {
    const rootPos = rootPositions.get(cabinetId);
    if (!rootPos) continue;

    for (const elkEdge of cabinetLayout.edges || []) {
      const controlPoints = getControlPoints(elkEdge, rootPos.x, rootPos.y);
      resultEdges.push({
        id: elkEdge.id,
        ...(controlPoints.length ? { controlPoints } : {}),
      });
    }
  }

  // ================================================================
  // ФОРМИРОВАНИЕ РЕЗУЛЬТАТА
  // ================================================================
  const resultNodes: LayoutResult['nodes'] = [];
  for (const [id, pos] of finalPositions.entries()) {
    resultNodes.push({ id, x: pos.x, y: pos.y, width: pos.width, height: pos.height });
  }

  console.log('[ELK Engine] Result:', resultNodes.length, 'nodes,', resultEdges.length, 'edges');

  return { nodes: resultNodes, edges: resultEdges };
}

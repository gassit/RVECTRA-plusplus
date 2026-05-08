/**
 * Standalone ELK Layout Engine — единый вызов ELK
 *
 * Все узлы (включая дочерние шкафов) участвуют в одном вызове ELK.
 * Cabinet НЕ участвует в маршрутизации рёбер — это только combo (визуальная рамка).
 * Рёбра идут напрямую между элементами.
 *
 * Порты:
 * - Source/Breaker/Bus/Load/Meter: фиксированные NORTH (вход) + SOUTH (выход)
 * - Junction: свободные порты (ELK решает автоматически)
 *
 * G6 — пассивный рендерер, только рисует то, что рассчитал ELK.
 */

import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

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
  combo?: string;
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

export interface LayoutResult {
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    controlPoints?: Array<{ x: number; y: number }>;
  }>;
  combos: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
  }>;
}

// ============================================================================
// ПОРТЫ
// Source/Breaker/Bus/Load/Meter — фиксированные NORTH + SOUTH
// Junction — без портов (ELK решает автоматически)
// ============================================================================
const FIXED_PORT_TYPES = new Set(['source', 'breaker', 'bus', 'meter', 'load']);

function buildPortsForNode(nodeId: string, type: string): any[] {
  if (FIXED_PORT_TYPES.has(type)) {
    return [
      { id: `${nodeId}_NORTH`, properties: { 'port.side': 'NORTH' } },
      { id: `${nodeId}_SOUTH`, properties: { 'port.side': 'SOUTH' } },
    ];
  }
  return [];
}

// ============================================================================
// КОНТРОЛЬНЫЕ ТОЧКИ
// G6 polyline controlPoints — ТОЛЬКО bendPoints (без startPoint/endPoint)
// ============================================================================
function getControlPoints(elkEdge: any): Array<{ x: number; y: number }> {
  if (!elkEdge?.sections?.length) return [];
  const points: Array<{ x: number; y: number }> = [];
  for (const section of elkEdge.sections) {
    if (section.bendPoints) {
      for (const bp of section.bendPoints) {
        points.push({ x: bp.x, y: bp.y });
      }
    }
  }
  return points;
}

// ============================================================================
// ОСНОВНАЯ ФУНКЦИЯ — ЕДИНЫЙ ВЫЗОВ ELK
// ============================================================================
export async function computeElkLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): Promise<LayoutResult> {
  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges: [], combos: [] };
  }

  console.log('[ELK] Layout for', nodes.length, 'nodes,', edges.length, 'edges');

  // ================================================================
  // 1. ГРУППИРОВКА
  // ================================================================
  const nodeMap = new Map<string, LayoutNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const childrenByParent = new Map<string, LayoutNode[]>();
  for (const node of nodes) {
    const parentId = node.combo;
    if (parentId) {
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId)!.push(node);
    }
  }

  const cabinetIds = new Set(childrenByParent.keys());

  // ================================================================
  // 2. ФИЛЬТРАЦИЯ РЁБЕР
  // ================================================================
  const validEdges = edges.filter(edge => {
    if (!nodeMap.has(edge.source)) {
      console.warn(`[ELK] Edge "${edge.id}": source=${edge.source} not found, skipped`);
      return false;
    }
    if (!nodeMap.has(edge.target)) {
      console.warn(`[ELK] Edge "${edge.id}": target=${edge.target} not found, skipped`);
      return false;
    }
    return true;
  });

  // ================================================================
  // 3. ПОСТРОЕНИЕ ELK ГРАФА
  //    Cabinet НЕ добавляется как узел — только его дочерние элементы.
  //    Рёбра идут напрямую элемент→элемент.
  // ================================================================
  const elkNodes = nodes
    .filter(node => !cabinetIds.has(node.id))
    .map(node => {
      const type = (node.type || node.data?.type || 'load').toLowerCase();
      const size = NODE_SIZES[type] || { width: 80, height: 40 };
      const isFixed = FIXED_PORT_TYPES.has(type);

      return {
        id: node.id,
        width: size.width,
        height: size.height,
        labels: node.data?.name ? [{ text: node.data.name }] : [],
        ports: buildPortsForNode(node.id, type),
        properties: isFixed
          ? { 'portConstraints': 'FIXED_SIDE' }
          : {},
      };
    });

  const elkEdges = validEdges.map(edge => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  console.log(`[ELK] Graph: ${elkNodes.length} nodes, ${elkEdges.length} edges`);

  const elkGraph: any = {
    id: 'root',
    children: elkNodes,
    edges: elkEdges,
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
      'elk.hierarchyHandling': 'SEPARATE_CHILDREN',
      'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.portConstraints': 'FIXED_ORDER',
    },
  };

  // ================================================================
  // 4. ВЫЗОВ ELK
  // ================================================================
  let layoutedGraph: any;
  try {
    layoutedGraph = await elk.layout(elkGraph);
  } catch (error) {
    console.error('[ELK] Layout error:', error);
    // Fallback — сетка
    const fallbackNodes = nodes
      .filter(n => !cabinetIds.has(n.id))
      .map((node, index) => {
        const type = (node.type || node.data?.type || 'load').toLowerCase();
        const size = NODE_SIZES[type] || { width: 120, height: 60 };
        return {
          id: node.id,
          x: size.width / 2 + 100 + (index % 10) * 150,
          y: size.height / 2 + 100 + Math.floor(index / 10) * 100,
          width: size.width,
          height: size.height,
        };
      });
    return { nodes: fallbackNodes, edges: [], combos: [] };
  }

  // ================================================================
  // 5. СБОР КООРДИНАТ (ELK top-left → G6 center)
  // ================================================================
  const resultNodes: LayoutResult['nodes'] = [];
  for (const child of layoutedGraph.children || []) {
    resultNodes.push({
      id: child.id,
      x: (child.x || 0) + (child.width || 0) / 2,   // центр
      y: (child.y || 0) + (child.height || 0) / 2,   // центр
      width: child.width || 0,
      height: child.height || 0,
    });
  }

  console.log(`[ELK] Positioned ${resultNodes.length} nodes`);

  // ================================================================
  // 6. СБОР РЁБЕР С КОНТРОЛЬНЫМИ ТОЧКАМИ
  // ================================================================
  const finalEdges: LayoutResult['edges'] = [];
  for (const edge of layoutedGraph.edges || []) {
    const source = edge.sources?.[0] || '';
    const target = edge.targets?.[0] || '';
    if (source === target) continue; // петля

    const points = getControlPoints(edge);
    finalEdges.push({
      id: edge.id,
      source,
      target,
      ...(points.length ? { controlPoints: points } : {}),
    });
  }

  console.log(`[ELK] Edges: ${finalEdges.length}`);

  // ================================================================
  // 7. COMBOS — bounding box вокруг дочерних элементов
  // ================================================================
  const posMap = new Map(resultNodes.map(n => [n.id, n]));
  const resultCombos: LayoutResult['combos'] = [];

  for (const [cabinetId, children] of childrenByParent.entries()) {
    const childPositions: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (const child of children) {
      const pos = posMap.get(child.id);
      if (pos) {
        childPositions.push({
          x: pos.x - pos.width / 2,   // top-left
          y: pos.y - pos.height / 2,
          w: pos.width,
          h: pos.height,
        });
      }
    }

    if (childPositions.length === 0) continue;

    const pad = 40;
    const minX = Math.min(...childPositions.map(p => p.x)) - pad;
    const minY = Math.min(...childPositions.map(p => p.y)) - pad;
    const maxX = Math.max(...childPositions.map(p => p.x + p.w)) + pad;
    const maxY = Math.max(...childPositions.map(p => p.y + p.h)) + pad;

    const cabinetNode = nodeMap.get(cabinetId);
    resultCombos.push({
      id: cabinetId,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      label: cabinetNode?.data?.name || cabinetNode?.data?.label || cabinetId,
    });
  }

  console.log(`[ELK] Result: ${resultNodes.length} nodes, ${finalEdges.length} edges, ${resultCombos.length} combos`);

  return { nodes: resultNodes, edges: finalEdges, combos: resultCombos };
}

/**
 * Standalone ELK Layout Engine — двухэтапная раскладка
 *
 * Этап 1: Раскладка внутренностей каждого шкафа (DOWN, локальные координаты)
 * Этап 2: Раскладка шкафов + корневых узлов как единых блоков (RIGHT, слева направо)
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
  edges: Array<{ id: string; controlPoints?: Array<{ x: number; y: number }> }>;
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
// ПОСТРОЕНИЕ ПОРТОВ ДЛЯ УЗЛОВ
// ============================================================================
function buildPortsForDirection(nodeId: string, type: string, direction: 'DOWN' | 'RIGHT'): any[] {
  if (direction === 'DOWN') {
    // Вертикальная раскладка: порты сверху и снизу
    switch (type) {
      case 'source':
        return [{ id: `${nodeId}_out`, properties: { 'port.side': 'SOUTH' } }];
      case 'load':
        return [{ id: `${nodeId}_in`, properties: { 'port.side': 'NORTH' } }];
      default:
        return [
          { id: `${nodeId}_in`, properties: { 'port.side': 'NORTH' } },
          { id: `${nodeId}_out`, properties: { 'port.side': 'SOUTH' } },
        ];
    }
  } else {
    // Горизонтальная раскладка: порты слева и справа
    switch (type) {
      case 'source':
        return [{ id: `${nodeId}_out`, properties: { 'port.side': 'EAST' } }];
      case 'load':
        return [{ id: `${nodeId}_in`, properties: { 'port.side': 'WEST' } }];
      default:
        return [
          { id: `${nodeId}_in`, properties: { 'port.side': 'WEST' } },
          { id: `${nodeId}_out`, properties: { 'port.side': 'EAST' } },
        ];
    }
  }
}

// ============================================================================
// ИЗВЛЕЧЕНИЕ КОНТРОЛЬНЫХ ТОЧЕК ИЗ РЁБРА ELK
// ============================================================================
function getControlPoints(elkEdge: any, offsetX = 0, offsetY = 0): Array<{ x: number; y: number }> {
  if (!elkEdge?.sections?.length) return [];
  const points: Array<{ x: number; y: number }> = [];
  for (const section of elkEdge.sections) {
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
    return { nodes: [], edges: [], combos: [] };
  }

  console.log('[ELK Engine] Two-phase layout for', nodes.length, 'nodes,', edges.length, 'edges');

  // ================================================================
  // 1. ГРУППИРОВКА УЗЛОВ ПО РОДИТЕЛЯМ
  // ================================================================
  const nodeMap = new Map<string, LayoutNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const childrenByParent = new Map<string, LayoutNode[]>();
  const rootNodes: LayoutNode[] = [];

  for (const node of nodes) {
    const parentId = node.combo;
    if (parentId && parentId !== null) {
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId)!.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  const cabinetIds = new Set(childrenByParent.keys());

  console.log('[ELK DIAG] Cabinets:', [...cabinetIds], '| Root:', rootNodes.length, '| Nested:', nodes.length - rootNodes.length);

  // ================================================================
  // 2. ЭТАП 1 — РАСКЛАДКА ВНУТРИ КАЖДОГО ШКАФА (DOWN)
  // ================================================================
  const cabinetBounds = new Map<string, { width: number; height: number }>();
  const localChildPositions = new Map<string, NodePosition>();
  const cabinetLayoutResults = new Map<string, any>();
  const cabinetLabels = new Map<string, string>();

  for (const [cabinetId, children] of childrenByParent.entries()) {
    const cabinetNode = nodeMap.get(cabinetId);
    cabinetLabels.set(cabinetId, cabinetNode?.data?.name || cabinetNode?.data?.label || cabinetId);

    const subNodes = children.map(child => {
      const type = (child.type || child.data?.type || 'load').toLowerCase();
      const size = NODE_SIZES[type] || { width: 80, height: 40 };
      return {
        id: child.id,
        width: size.width,
        height: size.height,
        labels: child.data?.name ? [{ text: child.data.name }] : [],
        ports: buildPortsForDirection(child.id, type, 'DOWN'),
        properties: { 'portConstraints': 'FIXED_SIDE' },
      };
    });

    const subEdges = edges
      .filter(edge => {
        const sourceParent = nodeMap.get(edge.source)?.combo;
        const targetParent = nodeMap.get(edge.target)?.combo;
        return sourceParent === cabinetId && targetParent === cabinetId;
      })
      .map(edge => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      }));

    if (subNodes.length === 0) {
      cabinetBounds.set(cabinetId, { width: 200, height: 120 });
      continue;
    }

    const subGraph: any = {
      id: cabinetId,
      children: subNodes,
      edges: subEdges,
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.spacing.nodeNode': '40',
        'elk.layered.spacing.nodeNodeBetweenLayers': '60',
        'elk.hierarchyHandling': 'SEPARATE_CHILDREN',
        'elk.portConstraints': 'FIXED_SIDE',
      },
    };

    try {
      const layoutedSub = await elk.layout(subGraph);
      cabinetLayoutResults.set(cabinetId, layoutedSub);

      // 🔍 Логируем рёбра внутри шкафа
      console.log(`[ELK DIAG] Шкаф "${cabinetId}": ${layoutedSub.edges?.length || 0} рёбер от ELK (входило ${subEdges.length})`);
      layoutedSub.edges?.forEach((e: any) => {
        console.log(`    edge "${e.id}": sources=${e.sources} targets=${e.targets} sections=${e.sections?.length || 0}`);
      });

      let maxX = 0, maxY = 0;
      for (const child of layoutedSub.children || []) {
        maxX = Math.max(maxX, (child.x || 0) + (child.width || 0));
        maxY = Math.max(maxY, (child.y || 0) + (child.height || 0));
      }
      const padding = 60;
      cabinetBounds.set(cabinetId, {
        width: Math.max(maxX + padding, 200),
        height: Math.max(maxY + padding, 120),
      });

      for (const child of layoutedSub.children || []) {
        localChildPositions.set(child.id, {
          x: (child.x || 0) + (child.width || 0) / 2,
          y: (child.y || 0) + (child.height || 0) / 2,
          width: child.width || 0,
          height: child.height || 0,
        });
      }
    } catch (err) {
      console.error(`[ELK Engine] Cabinet ${cabinetId} layout error:`, err);
      cabinetBounds.set(cabinetId, { width: 200, height: 120 });
    }
  }

  // ================================================================
  // 3. ЭТАП 2 — РАСКЛАДКА ВЕРХНЕГО УРОВНЯ (шкафы + корневые узлы)
  //    Направление: RIGHT (шкафы слева направо)
  //    Корневые узлы: FIRST_SEPARATE (фиксация в первом слое)
  //    Шкафы: с портами EAST/WEST + FIXED_SIDE
  // ================================================================
  const topLevelNodes: any[] = [];

  // Шкафы как единые блоки С ПОРТАМИ
  for (const [cabinetId, bounds] of cabinetBounds.entries()) {
    topLevelNodes.push({
      id: cabinetId,
      width: bounds.width,
      height: bounds.height,
      labels: cabinetLabels.has(cabinetId) ? [{ text: cabinetLabels.get(cabinetId)! }] : [],
      // Порты для шкафов: WEST (вход), EAST (выход)
      ports: [
        { id: `${cabinetId}_IN`, properties: { 'port.side': 'WEST' } },
        { id: `${cabinetId}_OUT`, properties: { 'port.side': 'EAST' } },
      ],
      properties: { 'portConstraints': 'FIXED_SIDE' },
      layoutOptions: {
        'org.eclipse.elk.layered.nodePlacement.bk.fixedAlignment': 'LEFT',
      },
    });
  }

  // Корневые узлы (не внутри шкафов) С ПОРТАМИ
  for (const node of rootNodes) {
    if (cabinetIds.has(node.id)) continue;
    const type = (node.type || node.data?.type || 'load').toLowerCase();
    const size = NODE_SIZES[type] || { width: 80, height: 40 };

    const nodeOpts: any = {
      id: node.id,
      width: size.width,
      height: size.height,
      labels: node.data?.name ? [{ text: node.data.name }] : [],
      ports: buildPortsForDirection(node.id, type, 'RIGHT'),
      properties: { 'portConstraints': 'FIXED_SIDE' },
    };

    topLevelNodes.push(nodeOpts);
  }

  // Рёбра верхнего уровня
  const topLevelEdges = edges.filter(edge => {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) return false;
    const sourceParent = nodeMap.get(edge.source)?.combo;
    const targetParent = nodeMap.get(edge.target)?.combo;
    // Внутренние рёбра шкафов уже обработаны
    if (sourceParent && targetParent && sourceParent === targetParent) return false;
    // Рёбра где хотя бы один конец вложен в шкаф — внешние
    return true;
  });

  // Подменяем source/target дочерних элементов на ID шкафа
  const topLevelEdgesMapped = topLevelEdges.map(edge => {
    const sourceParent = nodeMap.get(edge.source)?.combo;
    const targetParent = nodeMap.get(edge.target)?.combo;

    let source = edge.source;
    let target = edge.target;

    if (sourceParent && cabinetIds.has(sourceParent)) {
      source = sourceParent;
    }
    if (targetParent && cabinetIds.has(targetParent)) {
      target = targetParent;
    }

    return {
      id: edge.id,
      sources: [source],
      targets: [target],
      layoutOptions: {
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.edgeRouting.polylines.jumpBetweenEdges': 'true',
      },
    };
  });

  console.log('[ELK DIAG] Верхний уровень:', topLevelNodes.length, 'узлов,', topLevelEdgesMapped.length, 'рёбер');
  console.log('  Nodes:', topLevelNodes.map(n => `${n.id}`).join(', '));
  console.log('  Edges:', topLevelEdgesMapped.map(e => `${e.id}: ${e.sources}->${e.targets}`).join(', '));

  const topGraph: any = {
    id: 'root',
    children: topLevelNodes,
    edges: topLevelEdgesMapped,
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.nodeNodeBetweenLayers': '150',
      'elk.hierarchyHandling': 'SEPARATE_CHILDREN',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.portConstraints': 'FIXED_SIDE',
      'org.eclipse.elk.layered.nodePlacement.bk.fixedAlignment': 'LEFT',
    },
  };

  let layoutedTop: any;
  try {
    layoutedTop = await elk.layout(topGraph);
  } catch (error) {
    console.error('[ELK Engine] Root layout error:', error);
    const fallbackNodes = nodes.map((node, index) => {
      const type = (node.type || node.data?.type || 'load').toLowerCase();
      const size = NODE_SIZES[type] || { width: 120, height: 60 };
      return { id: node.id, x: size.width / 2 + 100 + (index % 10) * 150, y: size.height / 2 + 100 + Math.floor(index / 10) * 100, width: size.width, height: size.height };
    });
    return { nodes: fallbackNodes, edges: [], combos: [] };
  }

  // ================================================================
  // 🔍 ДИАГНОСТИКА: Рёбра верхнего уровня от ELK
  // ================================================================
  console.log('[ELK DIAG] Top level edges от ELK:', layoutedTop.edges?.length || 0);
  layoutedTop.edges?.forEach((e: any) => {
    console.log(`  edge "${e.id}": sources=${e.sources} targets=${e.targets} sections=${e.sections?.length || 0}`);
    if (e.sections?.length) {
      e.sections.forEach((s: any, i: number) => {
        console.log(`    section[${i}]: start=${JSON.stringify(s.startPoint)} bends=${s.bendPoints?.length || 0} end=${JSON.stringify(s.endPoint)}`);
      });
    }
  });

  // ================================================================
  // 4. СБОР АБСОЛЮТНЫХ КООРДИНАТ
  // ================================================================
  const absolutePositions = new Map<string, NodePosition>();

  function collectTopPositions(elkNode: any, parentX = 0, parentY = 0) {
    if (elkNode.id !== 'root') {
      const nodeX = (elkNode.x || 0) + parentX;
      const nodeY = (elkNode.y || 0) + parentY;
      absolutePositions.set(elkNode.id, {
        x: nodeX + (elkNode.width || 0) / 2,
        y: nodeY + (elkNode.height || 0) / 2,
        width: elkNode.width || 0,
        height: elkNode.height || 0,
      });
    }
    if (elkNode.children) {
      for (const child of elkNode.children) {
        collectTopPositions(child, parentX + (elkNode.x || 0), parentY + (elkNode.y || 0));
      }
    }
  }
  collectTopPositions(layoutedTop);

  // Добавляем дочерние элементы шкафов
  for (const [cabinetId] of childrenByParent.entries()) {
    const cabinetPos = absolutePositions.get(cabinetId);
    if (!cabinetPos) continue;

    const cabinetTopLeftX = cabinetPos.x - cabinetPos.width / 2;
    const cabinetTopLeftY = cabinetPos.y - cabinetPos.height / 2;

    for (const child of childrenByParent.get(cabinetId) || []) {
      const local = localChildPositions.get(child.id);
      if (local) {
        absolutePositions.set(child.id, {
          x: cabinetTopLeftX + local.x,
          y: cabinetTopLeftY + local.y,
          width: local.width,
          height: local.height,
        });
      }
    }
  }

  // ================================================================
  // 5. СБОР РЁБЕР С КОНТРОЛЬНЫМИ ТОЧКАМИ
  // ================================================================
  const finalEdges: LayoutResult['edges'] = [];

  // Внешние рёбра
  for (const edge of layoutedTop.edges || []) {
    const points = getControlPoints(edge);
    finalEdges.push({ id: edge.id, ...(points.length ? { controlPoints: points } : {}) });
  }

  // Внутренние рёбра шкафов
  for (const [cabinetId] of childrenByParent.entries()) {
    const cabinetPos = absolutePositions.get(cabinetId);
    if (!cabinetPos) continue;

    const offsetX = cabinetPos.x - cabinetPos.width / 2;
    const offsetY = cabinetPos.y - cabinetPos.height / 2;
    const layoutedSub = cabinetLayoutResults.get(cabinetId);
    if (!layoutedSub) continue;

    for (const elkEdge of layoutedSub.edges || []) {
      const points = getControlPoints(elkEdge, offsetX, offsetY);
      finalEdges.push({ id: elkEdge.id, ...(points.length ? { controlPoints: points } : {}) });
    }
  }

  // ================================================================
  // 6. ФОРМИРОВАНИЕ РЕЗУЛЬТАТА
  // ================================================================
  const resultNodes: LayoutResult['nodes'] = [];
  for (const [id, pos] of absolutePositions.entries()) {
    resultNodes.push({ id, x: pos.x, y: pos.y, width: pos.width, height: pos.height });
  }

  const resultCombos: LayoutResult['combos'] = [];
  for (const cabinetId of cabinetIds) {
    const pos = absolutePositions.get(cabinetId);
    if (pos) {
      resultCombos.push({
        id: cabinetId,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        label: cabinetLabels.get(cabinetId) || cabinetId,
      });
    }
  }

  console.log('[ELK Engine] Result:', resultNodes.length, 'nodes,', finalEdges.length, 'edges,', resultCombos.length, 'combos');

  return { nodes: resultNodes, edges: finalEdges, combos: resultCombos };
}

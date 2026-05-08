/**
 * Standalone ELK Layout Engine — двухэтапная раскладка
 *
 * Этап 1: Раскладка внутренностей каждого шкафа (DOWN, локальные координаты)
 * Этап 2: Раскладка шкафов + корневых узлов как единых блоков (DOWN, сверху вниз)
 *
 * G6 — пассивный рендерер, только рисует то, что рассчитал ELK.
 *
 * Порты:
 * - Source/Breaker/Bus/Load/Meter: фиксированные NORTH (вход) + SOUTH (выход)
 * - Junction: свободные порты (ELK решает автоматически)
 *
 * Cabinet НЕ участвует в маршрутизации рёбер напрямую — это только combo (визуальная рамка).
 * Рёбра в финальном результате ссылаются на обычные узлы, НЕ на комбо (шкафы).
 * Для каждого шкафа выбирается представитель (JUNCTION > BREAKER > any),
 * и внешние рёбра ELK перенаправляются на него, но в финале — element→element.
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
// Source/Breaker/Bus/Load/Meter — фиксированные NORTH (вход) + SOUTH (выход)
// Junction — без портов (ELK решает автоматически, FREE)
// ============================================================================
const FIXED_PORT_TYPES = new Set(['source', 'breaker', 'bus', 'meter', 'load']);

function buildPortsForNode(nodeId: string, type: string): any[] {
  if (FIXED_PORT_TYPES.has(type)) {
    return [
      { id: `${nodeId}_NORTH`, properties: { 'port.side': 'NORTH' } },
      { id: `${nodeId}_SOUTH`, properties: { 'port.side': 'SOUTH' } },
    ];
  }
  // Junction и другие — без портов, ELK решает автоматически
  return [];
}

function getPortConstraints(type: string): string {
  if (FIXED_PORT_TYPES.has(type)) {
    return 'FIXED_SIDE';
  }
  return 'FIXED_ORDER'; // FREE для Junction
}

// ============================================================================
// ИЗВЛЕЧЕНИЕ КОНТРОЛЬНЫХ ТОЧЕК ИЗ РЁБРА ELK
// G6 polyline controlPoints — ТОЛЬКО промежуточные точки изгиба (bendPoints),
// без startPoint и endPoint (G6 сам соединяет source → bends → target).
// ============================================================================
function getControlPoints(elkEdge: any, offsetX = 0, offsetY = 0): Array<{ x: number; y: number }> {
  if (!elkEdge?.sections?.length) return [];
  const points: Array<{ x: number; y: number }> = [];
  for (const section of elkEdge.sections) {
    if (section.bendPoints) {
      for (const bp of section.bendPoints) {
        points.push({ x: bp.x + offsetX, y: bp.y + offsetY });
      }
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
  // 1.5 ВЫБОР ПРЕДСТАВИТЕЛЯ ДЛЯ КАЖДОГО ШКАФА
  //     Приоритет: JUNCTION > BREAKER > первый дочерний
  //     Используется для перенаправления внешних рёбер на конкретный
  //     узел внутри шкафа (чтобы G6 не ссылался на комбо).
  // ================================================================
  const cabinetRepresentative = new Map<string, string>();
  const emptyCabinetIds = new Set<string>();

  for (const [cabinetId, children] of childrenByParent.entries()) {
    if (children.length === 0) {
      console.warn(`[ELK DIAG] Шкаф "${cabinetId}" пуст — рёбра к нему будут пропущены`);
      emptyCabinetIds.add(cabinetId);
      continue;
    }

    const typeOf = (c: LayoutNode) => (c.type || c.data?.type || '').toUpperCase();
    const rep =
      children.find(c => typeOf(c) === 'JUNCTION')?.id ||
      children.find(c => typeOf(c) === 'BREAKER')?.id ||
      children[0].id;

    if (rep) {
      cabinetRepresentative.set(cabinetId, rep);
      console.log(`[ELK] Представитель шкафа "${cabinetId}" -> "${rep}" (${typeOf(children.find(c => c.id === rep)!)})`);
    }
  }

  // ================================================================
  // 1.6 Предварительная фильтрация: рёбра к пустым шкафам пропускаем
  // ================================================================
  const edgesFilteredEmptyCab = edges.filter(edge => {
    if (emptyCabinetIds.has(edge.source)) {
      console.warn(`[ELK DIAG] Ребро "${edge.id}": source=${edge.source} — пустой шкаф, пропущено`);
      return false;
    }
    if (emptyCabinetIds.has(edge.target)) {
      console.warn(`[ELK DIAG] Ребро "${edge.id}": target=${edge.target} — пустой шкаф, пропущено`);
      return false;
    }
    return true;
  });

  console.log(`[ELK DIAG] После фильтрации пустых шкафов: ${edgesFilteredEmptyCab.length} рёбер из ${edges.length}`);

  // ================================================================
  // 2. ЭТАП 1 — РАСКЛАДКА ВНУТРИ КАЖДОГО ШКАФА (DOWN)
  //     Порты: FIXED_SIDE для Source/Breaker/Bus/Load/Meter,
  //     FIXED_ORDER (FREE) для Junction.
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
        ports: buildPortsForNode(child.id, type),
        properties: { 'portConstraints': getPortConstraints(type) },
      };
    });

    // Внутренние рёбра шкафа
    const subEdges = edgesFilteredEmptyCab
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
        'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.portConstraints': 'FIXED_ORDER',
      },
    };

    try {
      const layoutedSub = await elk.layout(subGraph);
      cabinetLayoutResults.set(cabinetId, layoutedSub);

      console.log(`[ELK DIAG] Шкаф "${cabinetId}": ${layoutedSub.edges?.length || 0} рёбер от ELK (входило ${subEdges.length})`);

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
  //    Направление: DOWN (сверху вниз по потоку связей)
  //    Шкафы: единые блоки с портами NORTH/SOUTH.
  //    Корневые узлы: с портами по типу.
  // ================================================================
  const topLevelNodes: any[] = [];

  // Шкафы как единые блоки с портами NORTH/SOUTH
  for (const [cabinetId, bounds] of cabinetBounds.entries()) {
    topLevelNodes.push({
      id: cabinetId,
      width: bounds.width,
      height: bounds.height,
      labels: cabinetLabels.has(cabinetId) ? [{ text: cabinetLabels.get(cabinetId)! }] : [],
      ports: [
        { id: `${cabinetId}_IN`, properties: { 'port.side': 'NORTH' } },
        { id: `${cabinetId}_OUT`, properties: { 'port.side': 'SOUTH' } },
      ],
      properties: { 'portConstraints': 'FIXED_SIDE' },
    });
  }

  // Корневые узлы (не внутри шкафов) с портами по типу
  for (const node of rootNodes) {
    if (cabinetIds.has(node.id)) continue;
    const type = (node.type || node.data?.type || 'load').toLowerCase();
    const size = NODE_SIZES[type] || { width: 80, height: 40 };

    topLevelNodes.push({
      id: node.id,
      width: size.width,
      height: size.height,
      labels: node.data?.name ? [{ text: node.data.name }] : [],
      ports: buildPortsForNode(node.id, type),
      properties: { 'portConstraints': getPortConstraints(type) },
    });
  }

  // ================================================================
  // 3.1 ВНЕШНИЕ РЁБРА — маппинг на шкафы для ELK (только для маршрутизации)
  //     В финальном результате рёбра будут element→element,
  //     но ELK маршрутизирует через блоки шкафов.
  // ================================================================
  const externalEdges = edgesFilteredEmptyCab.filter(edge => {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) return false;
    const sourceParent = nodeMap.get(edge.source)?.combo;
    const targetParent = nodeMap.get(edge.target)?.combo;
    // Внутренние рёбра шкафов уже обработаны на этапе 1
    if (sourceParent && targetParent && sourceParent === targetParent) return false;
    return true;
  });

  // Маппинг: сохраняем оригинальные source/target для каждого ребра
  const edgeOriginalIds = new Map<string, { source: string; target: string }>();

  const topLevelEdgesMapped = externalEdges.map(edge => {
    const sourceParent = nodeMap.get(edge.source)?.combo;
    const targetParent = nodeMap.get(edge.target)?.combo;

    let source = edge.source;
    let target = edge.target;

    // Если конец внутри шкафа — подменяем на ID шкафа для ELK (маршрутизация)
    if (sourceParent && cabinetIds.has(sourceParent)) {
      source = sourceParent;
    }
    if (targetParent && cabinetIds.has(targetParent)) {
      target = targetParent;
    }

    // Сохраняем оригинальные element→element ID
    edgeOriginalIds.set(edge.id, { source: edge.source, target: edge.target });

    return {
      id: edge.id,
      sources: [source],
      targets: [target],
      layoutOptions: {
        'elk.edgeRouting': 'ORTHOGONAL',
      },
    };
  });

  console.log('[ELK DIAG] Верхний уровень:', topLevelNodes.length, 'узлов,', topLevelEdgesMapped.length, 'рёбер');
  console.log('  Nodes:', topLevelNodes.map(n => n.id).join(', '));
  console.log('  Edges:', topLevelEdgesMapped.map(e => `${e.id}: ${e.sources}->${e.targets}`).join(', '));

  const topGraph: any = {
    id: 'root',
    children: topLevelNodes,
    edges: topLevelEdgesMapped,
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
      'elk.hierarchyHandling': 'SEPARATE_CHILDREN',
      'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.portConstraints': 'FIXED_SIDE',
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

  // Добавляем дочерние элементы шкафов с абсолютными координатами
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
  //     Критическое правило: source/target ссылаются ТОЛЬКО на обычные узлы,
  //     НЕ на комбо (шкафы). Рёбра element→element.
  // ================================================================
  const finalEdges: LayoutResult['edges'] = [];

  // 5a. Внешние рёбра (межшкафные + корень↔шкаф)
  for (const edge of layoutedTop.edges || []) {
    const original = edgeOriginalIds.get(edge.id);
    // Используем оригинальные element→element ID
    let source = original?.source || edge.sources?.[0] || '';
    let target = original?.target || edge.targets?.[0] || '';

    // Если оригинальный source/target — это ID шкафа (edge к самому шкафу),
    // подменяем на представителя
    if (cabinetIds.has(source)) {
      const rep = cabinetRepresentative.get(source);
      if (rep) {
        console.log(`[ELK DIAG] Ребро "${edge.id}": source ${source} -> представитель ${rep}`);
        source = rep;
      } else {
        console.warn(`[ELK DIAG] Ребро "${edge.id}": нет представителя для шкафа ${source}, пропущено`);
        continue;
      }
    }
    if (cabinetIds.has(target)) {
      const rep = cabinetRepresentative.get(target);
      if (rep) {
        console.log(`[ELK DIAG] Ребро "${edge.id}": target ${target} -> представитель ${rep}`);
        target = rep;
      } else {
        console.warn(`[ELK DIAG] Ребро "${edge.id}": нет представителя для шкафа ${target}, пропущено`);
        continue;
      }
    }

    // Избегаем петель
    if (source === target) {
      console.warn(`[ELK DIAG] Ребро "${edge.id}": петля (${source}), пропущено`);
      continue;
    }

    const points = getControlPoints(edge);
    finalEdges.push({
      id: edge.id,
      source,
      target,
      ...(points.length ? { controlPoints: points } : {}),
    });
  }

  // 5b. Внутренние рёбра шкафов (element→element напрямую)
  for (const [cabinetId] of childrenByParent.entries()) {
    const cabinetPos = absolutePositions.get(cabinetId);
    if (!cabinetPos) continue;

    const offsetX = cabinetPos.x - cabinetPos.width / 2;
    const offsetY = cabinetPos.y - cabinetPos.height / 2;
    const layoutedSub = cabinetLayoutResults.get(cabinetId);
    if (!layoutedSub) continue;

    for (const elkEdge of layoutedSub.edges || []) {
      const source = elkEdge.sources?.[0] || '';
      const target = elkEdge.targets?.[0] || '';

      const points = getControlPoints(elkEdge, offsetX, offsetY);
      finalEdges.push({
        id: elkEdge.id,
        source,
        target,
        ...(points.length ? { controlPoints: points } : {}),
      });
    }
  }

  // ================================================================
  // 6. ФОРМИРОВАНИЕ РЕЗУЛЬТАТА
  //     В nodes НЕ включаем шкафы — они передаются через combos.
  //     G6 требует, чтобы ID не повторялись между nodes и combos.
  // ================================================================
  const resultNodes: LayoutResult['nodes'] = [];
  for (const [id, pos] of absolutePositions.entries()) {
    if (cabinetIds.has(id)) continue; // Шкафы — только в combos
    resultNodes.push({ id, x: pos.x, y: pos.y, width: pos.width, height: pos.height });
  }

  // Комбо: x, y — левый верхний угол (НЕ центр!), как ожидает G6
  const resultCombos: LayoutResult['combos'] = [];
  for (const cabinetId of cabinetIds) {
    const pos = absolutePositions.get(cabinetId);
    if (pos) {
      resultCombos.push({
        id: cabinetId,
        x: pos.x - pos.width / 2,   // левый верхний угол
        y: pos.y - pos.height / 2,   // левый верхний угол
        width: pos.width,
        height: pos.height,
        label: cabinetLabels.get(cabinetId) || cabinetId,
      });
    }
  }

  console.log(`[ELK Engine] Result: ${resultNodes.length} nodes, ${finalEdges.length} edges, ${resultCombos.length} combos`);

  // Диагностика рёбер
  console.log('[ELK DIAG] Финальные рёбра:');
  finalEdges.forEach(e => {
    console.log(`  "${e.id}": ${e.source} -> ${e.target} (${e.controlPoints?.length || 0} pts)`);
  });

  return { nodes: resultNodes, edges: finalEdges, combos: resultCombos };
}

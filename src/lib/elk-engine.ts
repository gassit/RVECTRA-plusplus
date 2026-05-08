/**
 * Standalone ELK Layout Engine — двухэтапная раскладка
 *
 * Этап 1: Раскладка внутренностей каждого шкафа (DOWN, локальные координаты)
 * Этап 2: Раскладка шкафов + корневых узлов как единых блоков (RIGHT, слева направо)
 *
 * G6 — пассивный рендерер, только рисует то, что рассчитал ELK.
 * Контрольные точки (bendPoints) извлекаются из ELK sections и передаются в G6 polyline.
 *
 * ВАЖНО: Шкафы (CABINET) могут НЕ присутствовать в массиве nodes — они отфильтрованы
 * в page.tsx. Поэтому мы группируем детей по combo (parentId) даже если parentId
 * отсутствует в nodeMap. Шкафы создаются виртуально на этапе 2.
 */

import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

// ============================================================================
// РАЗМЕРЫ УЗЛОВ ПО ТИПАМ (используется также в NetworkGraphG6.tsx)
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

export interface LayoutResult {
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  edges: Array<{ id: string; controlPoints?: Array<{ x: number; y: number }> }>;
  /** Комбos (шкафы) с позициями и размерами от ELK — для G6 */
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
  // 🔍 ДИАГНОСТИКА 1: Входные данные — parentId / combo у каждого узла
  // ================================================================
  console.log('[ELK DIAG] Входные узлы:');
  for (const n of nodes) {
    console.log(`  id=${n.id}  type=${n.type || n.data?.type || '?'}  combo(parentId)=${n.combo || 'null'}`);
  }
  console.log('[ELK DIAG] Входные рёбра:');
  for (const e of edges) {
    console.log(`  ${e.id}: ${e.source} → ${e.target}`);
  }

  // ================================================================
  // 1. ГРУППИРОВКА УЗЛОВ ПО РОДИТЕЛЯМ (combo → parentId)
  // ================================================================
  const nodeMap = new Map<string, LayoutNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const childrenByParent = new Map<string, LayoutNode[]>(); // parentId → дочерние узлы
  const rootNodes: LayoutNode[] = []; // узлы без parentId

  // Собираем все уникальные parentId (cabinet IDs) из combo-полей
  const allParentIds = new Set<string>();

  for (const node of nodes) {
    const parentId = node.combo;
    if (parentId && parentId !== null) {
      // 🔧 ИСПРАВЛЕНИЕ: НЕ проверяем nodeMap.has(parentId)!
      // Шкафы могут отсутствовать в nodes (отфильтрованы в page.tsx)
      allParentIds.add(parentId);
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId)!.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  const cabinetIds = new Set(childrenByParent.keys()); // ID всех шкафов

  console.log('[ELK DIAG] Группировка:');
  console.log('  Cabinet IDs:', [...cabinetIds]);
  console.log('  Root nodes:', rootNodes.length, '| Nested children:', nodes.length - rootNodes.length);
  for (const [cabinetId, children] of childrenByParent.entries()) {
    const cabinetInMap = nodeMap.has(cabinetId);
    console.log(`  Шкаф "${cabinetId}" (в nodeMap: ${cabinetInMap}): ${children.length} детей → [${children.map(c => c.id).join(', ')}]`);
  }

  // ================================================================
  // 2. ЭТАП 1 — РАСКЛАДКА ВНУТРИ КАЖДОГО ШКАФА (локальные координаты)
  // ================================================================
  const cabinetBounds = new Map<string, { width: number; height: number }>();
  const localChildPositions = new Map<string, NodePosition>();
  const cabinetLayoutResults = new Map<string, any>();
  const cabinetLabels = new Map<string, string>();

  for (const [cabinetId, children] of childrenByParent.entries()) {
    // 🔧 ИСПРАВЛЕНИЕ: НЕ требуем cabinetNode в nodeMap
    const cabinetNode = nodeMap.get(cabinetId);
    const cabinetLabel = cabinetNode?.data?.name
      || cabinetNode?.data?.label
      || cabinetId;
    cabinetLabels.set(cabinetId, cabinetLabel);

    // Узлы внутри шкафа
    const subNodes = children.map(child => {
      const type = (child.type || child.data?.type || 'load').toLowerCase();
      const size = NODE_SIZES[type] || { width: 80, height: 40 };
      return {
        id: child.id,
        width: size.width,
        height: size.height,
        labels: child.data?.name ? [{ text: child.data.name }] : [],
      };
    });

    // Рёбра внутри шкафа (оба конца с combo === cabinetId)
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
      console.log(`[ELK DIAG] Шкаф "${cabinetId}": пустой, размеры по умолчанию 200x120`);
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
      },
    };

    try {
      const layoutedSub = await elk.layout(subGraph);
      cabinetLayoutResults.set(cabinetId, layoutedSub);

      // Вычисляем размеры шкафа по раскладке детей + отступ
      let maxX = 0, maxY = 0;
      for (const child of layoutedSub.children || []) {
        const cx = (child.x || 0) + (child.width || 0);
        const cy = (child.y || 0) + (child.height || 0);
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;
      }
      const padding = 60;
      const width = Math.max(maxX + padding, 200);
      const height = Math.max(maxY + padding, 120);
      cabinetBounds.set(cabinetId, { width, height });

      console.log(`[ELK DIAG] Шкаф "${cabinetId}": ${children.length} детей, ${subEdges.length} внутренних рёбер, ELK размер=${width}x${height}`);

      // Сохраняем локальные координаты детей (центры узлов)
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
  // ================================================================
  const topLevelNodes: any[] = [];

  // Шкафы как единые блоки
  for (const [cabinetId, bounds] of cabinetBounds.entries()) {
    const cabinetNode = nodeMap.get(cabinetId);
    topLevelNodes.push({
      id: cabinetId,
      width: bounds.width,
      height: bounds.height,
      labels: cabinetLabels.has(cabinetId) ? [{ text: cabinetLabels.get(cabinetId)! }] : [],
      layoutOptions: {
        'org.eclipse.elk.layered.nodePlacement.bk.fixedAlignment': 'LEFT',
      },
    });
  }

  // Корневые узлы (не внутри шкафов и не сами шкафы)
  for (const node of rootNodes) {
    if (cabinetIds.has(node.id)) continue;
    const type = (node.type || node.data?.type || 'load').toLowerCase();
    const size = NODE_SIZES[type] || { width: 80, height: 40 };
    topLevelNodes.push({
      id: node.id,
      width: size.width,
      height: size.height,
      labels: node.data?.name ? [{ text: node.data.name }] : [],
    });
  }

  // Рёбра верхнего уровня
  const topLevelEdges = edges.filter(edge => {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) return false;
    const sourceParent = nodeMap.get(edge.source)?.combo;
    const targetParent = nodeMap.get(edge.target)?.combo;

    // Внутренние рёбра шкафов уже обработаны на этапе 1
    if (sourceParent && targetParent && sourceParent === targetParent) return false;

    // Рёбра, где один из концов — дочерний элемент шкафа
    const sourceIsNested = sourceParent && cabinetIds.has(sourceParent);
    const targetIsNested = targetParent && cabinetIds.has(targetParent);

    if (sourceIsNested || targetIsNested) {
      // Превращаем ребро от/к дочернему элементу в ребро от/к шкафу
      return true;
    }

    // Корневые рёбра
    return !sourceParent && !targetParent;
  });

  // Для рёбер от/к дочерним элементам, подменяем source/target на ID шкафа
  const topLevelEdgesMapped = topLevelEdges.map(edge => {
    const sourceParent = nodeMap.get(edge.source)?.combo;
    const targetParent = nodeMap.get(edge.target)?.combo;

    let source = edge.source;
    let target = edge.target;

    // Если source — дочерний элемент шкафа, подменяем на ID шкафа
    if (sourceParent && cabinetIds.has(sourceParent)) {
      source = sourceParent;
    }
    // Если target — дочерний элемент шкафа, подменяем на ID шкафа
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
  console.log('  Top-level nodes:', topLevelNodes.map(n => `${n.id} (${n.width}x${n.height})`).join(', '));

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

  // 🔍 ДИАГНОСТИКА 2: Позиции шкафов от ELK
  console.log('[ELK DIAG] Позиции шкафов (ELK, абсолютные, центры):');
  for (const cabinetId of cabinetIds) {
    const pos = absolutePositions.get(cabinetId);
    if (pos) {
      console.log(`  "${cabinetId}": x=${pos.x.toFixed(1)}, y=${pos.y.toFixed(1)}, w=${pos.width}, h=${pos.height}`);
    } else {
      console.log(`  "${cabinetId}": НЕ НАЙДЕН в absolutePositions!`);
    }
  }

  // Добавляем дочерние элементы шкафов: локальные координаты + позиция шкафа
  for (const [cabinetId] of childrenByParent.entries()) {
    const cabinetPos = absolutePositions.get(cabinetId);
    if (!cabinetPos) {
      console.warn(`[ELK DIAG] Шкаф "${cabinetId}" не получил позицию от ELK — дочерние узлы не будут позиционированы`);
      continue;
    }

    const cabinetTopLeftX = cabinetPos.x - cabinetPos.width / 2;
    const cabinetTopLeftY = cabinetPos.y - cabinetPos.height / 2;

    // 🔍 ДИАГНОСТИКА 3: Дочерние координаты
    console.log(`[ELK DIAG] Дочерние элементы шкафа "${cabinetId}" (верхний левый угол: ${cabinetTopLeftX.toFixed(1)}, ${cabinetTopLeftY.toFixed(1)}):`);

    for (const child of childrenByParent.get(cabinetId) || []) {
      const local = localChildPositions.get(child.id);
      if (local) {
        const absX = cabinetTopLeftX + local.x;
        const absY = cabinetTopLeftY + local.y;
        absolutePositions.set(child.id, {
          x: absX,
          y: absY,
          width: local.width,
          height: local.height,
        });
        console.log(`  "${child.id}": local=(${local.x.toFixed(1)}, ${local.y.toFixed(1)}) → abs=(${absX.toFixed(1)}, ${absY.toFixed(1)})`);
      } else {
        console.warn(`  "${child.id}": НЕТ локальных координат от ELK!`);
      }
    }

    // Проверяем, что дочерние координаты находятся внутри диапазона шкафа
    const cabinetRight = cabinetPos.x + cabinetPos.width / 2;
    const cabinetBottom = cabinetPos.y + cabinetPos.height / 2;
    for (const child of childrenByParent.get(cabinetId) || []) {
      const pos = absolutePositions.get(child.id);
      if (pos) {
        const inRange = pos.x >= cabinetTopLeftX && pos.x <= cabinetRight
                     && pos.y >= cabinetTopLeftY && pos.y <= cabinetBottom;
        if (!inRange) {
          console.warn(`[ELK DIAG] ⚠️ "${child.id}" ВНЕ диапазона шкафа "${cabinetId}"! pos=(${pos.x.toFixed(1)},${pos.y.toFixed(1)}), range=[${cabinetTopLeftX.toFixed(1)},${cabinetRight.toFixed(1)}] x [${cabinetTopLeftY.toFixed(1)},${cabinetBottom.toFixed(1)}]`);
        }
      }
    }
  }

  // ================================================================
  // 5. СБОР РЁБЕР С КОНТРОЛЬНЫМИ ТОЧКАМИ
  // ================================================================
  const finalEdges: LayoutResult['edges'] = [];

  // Внешние рёбра (из корневого графа, уже в абсолютных координатах)
  for (const edge of layoutedTop.edges || []) {
    const originalEdge = edges.find(e => e.id === edge.id);
    if (originalEdge) {
      const points = getControlPoints(edge);
      finalEdges.push({ id: edge.id, ...(points.length ? { controlPoints: points } : {}) });
    }
  }

  // Внутренние рёбра шкафов (смещаем точки на позицию шкафа)
  for (const [cabinetId] of childrenByParent.entries()) {
    const cabinetPos = absolutePositions.get(cabinetId);
    if (!cabinetPos) continue;

    const cabinetTopLeftX = cabinetPos.x - cabinetPos.width / 2;
    const cabinetTopLeftY = cabinetPos.y - cabinetPos.height / 2;

    const layoutedSub = cabinetLayoutResults.get(cabinetId);
    if (!layoutedSub) continue;

    for (const elkEdge of layoutedSub.edges || []) {
      const originalEdge = edges.find(e => e.id === elkEdge.id);
      if (originalEdge) {
        const points = getControlPoints(elkEdge, cabinetTopLeftX, cabinetTopLeftY);
        finalEdges.push({ id: elkEdge.id, ...(points.length ? { controlPoints: points } : {}) });
      }
    }
  }

  // ================================================================
  // 6. ФОРМИРОВАНИЕ ИТОГОВОГО РЕЗУЛЬТАТА
  // ================================================================
  const resultNodes: LayoutResult['nodes'] = [];
  for (const [id, pos] of absolutePositions.entries()) {
    resultNodes.push({ id, x: pos.x, y: pos.y, width: pos.width, height: pos.height });
  }

  // Формируем combos (шкафы) для G6 с позициями и размерами
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
  console.log('[ELK DIAG] Combos для G6:');
  for (const combo of resultCombos) {
    console.log(`  "${combo.id}": center=(${combo.x.toFixed(1)}, ${combo.y.toFixed(1)}), size=${combo.width}x${combo.height}, label="${combo.label}"`);
  }

  return { nodes: resultNodes, edges: finalEdges, combos: resultCombos };
}

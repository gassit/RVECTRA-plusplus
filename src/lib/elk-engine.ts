/**
 * ELK Layout Engine — чистая интеграция с G6 v5
 *
 * Один вызов ELK с нативной иерархией (INCLUDE_CHILDREN).
 * Cabinet = ELK группа с children внутри.
 * Рёбра element→element напрямую.
 *
 * Координаты: ELK возвращает top-left → конвертируем в G6 center.
 * Маршрутизация рёбер: G6 v5 builtin router: { type: 'orth' }.
 * ELK отвечает только за позиции нод.
 *
 * ВАЖНО: NODE_SIZES должны точно совпадать с размерами в G6!
 * Иначе маршрутизация рёбер пройдёт сквозь ноды.
 */

import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

// ============================================================================
// Размеры узлов по типам — ДОЛЖНЫ СОВПАДАТЬ с G6 node style.size!
// ============================================================================
export const NODE_SIZES: Record<string, { width: number; height: number }> = {
  source:      { width: 160, height: 80 },
  bus:         { width: 200, height: 40 },
  breaker:     { width: 140, height: 70 },
  meter:       { width: 140, height: 70 },
  load:        { width: 160, height: 80 },
  junction:    { width: 40,  height: 40 },
  transformer: { width: 140, height: 80 },
};

// ============================================================================
// Типы
// ============================================================================
interface LayoutNode {
  id: string;
  type?: string;
  data?: any;
  parentId?: string;  // ID родительского шкафа (из GraphNode.parentId)
}

interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  data?: any;
}

export interface LayoutResult {
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  edges: Array<{ id: string; source: string; target: string }>;
  // Combos больше не используются G6 — только для расчёта bounding box
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
// Конвертация координат: ELK top-left → G6 center
// ============================================================================
function elkToG6(elkX: number, elkY: number, w: number, h: number) {
  return { x: elkX + w / 2, y: elkY + h / 2 };
}

// ============================================================================
// Основная функция — один вызов ELK с иерархией
// ============================================================================
export async function computeElkLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): Promise<LayoutResult> {
  if (!nodes?.length) return { nodes: [], edges: [], combos: [] };

  // --- 1. Группировка по parentId ---
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const childrenByParent = new Map<string, LayoutNode[]>();
  const rootNodes: LayoutNode[] = [];

  // Определяем какие ID — это шкафы (типы cabinet/в верхнем регистре)
  const cabinetIds = new Set<string>();

  for (const node of nodes) {
    const nodeType = (node.type || node.data?.type || '').toUpperCase();
    const isCabinet = nodeType === 'CABINET';

    if (isCabinet) {
      cabinetIds.add(node.id);
    }

    // Группируем детей по parentId
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parentType = (nodeMap.get(node.parentId)?.type || '').toUpperCase();
      // Родитель должен быть шкафом
      if (parentType === 'CABINET' || cabinetIds.has(node.parentId)) {
        if (!childrenByParent.has(node.parentId)) childrenByParent.set(node.parentId, []);
        childrenByParent.get(node.parentId)!.push(node);
        continue;
      }
    }

    // Корневые узлы: без parentId, или родитель не шкаф, или сам шкаф
    if (!isCabinet) {
      rootNodes.push(node);
    }
  }

  // --- 2. Фильтрация рёбер ---
  // Рёбра должны ссылаться на существующие узлы (не на шкафы)
  const validEdges = edges.filter(e => {
    const srcOk = nodeMap.has(e.source);
    const tgtOk = nodeMap.has(e.target);
    if (!srcOk) console.warn(`[ELK] Edge ${e.id}: source ${e.source} not found`);
    if (!tgtOk) console.warn(`[ELK] Edge ${e.id}: target ${e.target} not found`);
    return srcOk && tgtOk;
  });

  // --- 3. Построение ELK графа с иерархией ---
  const elkGroups: any[] = [];

  for (const [cabinetId, children] of childrenByParent) {
    const cabinetNode = nodeMap.get(cabinetId);
    const label = cabinetNode?.data?.name || cabinetNode?.data?.label || cabinetId;

    elkGroups.push({
      id: cabinetId,
      labels: [{ text: label }],
      children: children.map(child => {
        const type = (child.type || child.data?.type || 'load').toLowerCase();
        const size = NODE_SIZES[type] || { width: 160, height: 80 };
        return {
          id: child.id,
          width: size.width,
          height: size.height,
          labels: child.data?.name ? [{ text: child.data.name }] : [],
        };
      }),
      layoutOptions: {
        'elk.spacing.nodeNode': '40',
        'elk.layered.spacing.nodeNodeBetweenLayers': '70',
        'elk.layered.spacing.edgeNode': '35',
        'elk.layered.spacing.edgeEdge': '20',
        'elk.padding': '[top=30,left=30,bottom=30,right=30]',
      },
    });
  }

  // --- 3a. Добавляем пустые Cabinet (без детей) как минимальные группы ---
  const emptyCabinetIds: string[] = [];
  for (const cabinetId of cabinetIds) {
    if (!childrenByParent.has(cabinetId)) {
      const cabinetNode = nodeMap.get(cabinetId);
      const label = cabinetNode?.data?.name || cabinetNode?.data?.label || cabinetId;
      emptyCabinetIds.push(cabinetId);
      
      elkGroups.push({
        id: cabinetId,
        labels: [{ text: label }],
        children: [],  // Пустой шкаф — будет иметь минимальный размер
        width: 200,
        height: 100,
        layoutOptions: {
          'elk.spacing.nodeNode': '40',
          'elk.padding': '[top=30,left=30,bottom=30,right=30]',
        },
      });
      
      console.log(`[ELK] Empty cabinet added: ${cabinetId} (${label})`);
    }
  }

  const elkRootChildren: any[] = rootNodes
    .filter(n => !cabinetIds.has(n.id))
    .map(node => {
      const type = (node.type || node.data?.type || 'load').toLowerCase();
      const size = NODE_SIZES[type] || { width: 160, height: 80 };
      return {
        id: node.id,
        width: size.width,
        height: size.height,
        labels: node.data?.name ? [{ text: node.data.name }] : [],
      };
    });

  // Каждый edge получает уникальный ID для предотвращения слияния в гипердуги
  const elkEdges = validEdges.map(edge => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const elkGraph = {
    id: 'root',
    children: [...elkRootChildren, ...elkGroups],
    edges: elkEdges,
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      // Пространственные отступы — раздвигаем элементы для предотвращения пересечений
      'elk.spacing.nodeNode': '50',                    // Увеличен отступ между узлами
      'elk.layered.spacing.nodeNodeBetweenLayers': '80', // Увеличен отступ между слоями
      'elk.layered.spacing.edgeNode': '40',            // Увеличен отступ рёбер от узлов
      'elk.layered.spacing.edgeEdge': '20',            // Отступ между рёбрами
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.spacing.componentComponent': '60',          // Отступ между компонентами
      // Минимизация пересечений рёбер
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.crossingMinimization.semiInteractiveCrossingCounter': 'true',
      // Размещение узлов для компактности
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      // Дополнительные параметры для ортогональной маршрутизации
      'elk.orthogonalEdgeRoutingSpacing': '20',
      'elk.layered.edgeRouting.orthogonalEdges': 'true',
      // Улучшение читаемости схемы
      'elk.layered.thoroughness': '10',                // Больше итераций для лучшего результата
      'elk.layered.feedbackEdges': 'false',            // Запрет обратных рёбер
    },
  };

  // --- 4. Вызов ELK ---
  let layoutedGraph: any;
  try {
    layoutedGraph = await elk.layout(elkGraph);
  } catch (error) {
    console.error('[ELK] Layout error:', error);
    return fallbackLayout(nodes);
  }

  // --- 5. Сбор координат из иерархии ELK ---
  const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
  const comboPositions = new Map<string, { x: number; y: number; width: number; height: number }>();

  for (const child of layoutedGraph.children || []) {
    const cx = child.x || 0;
    const cy = child.y || 0;
    const cw = child.width || 0;
    const ch = child.height || 0;

    if (cabinetIds.has(child.id)) {
      // Группа — сохраняем top-left (нужно для bounding box)
      comboPositions.set(child.id, { x: cx, y: cy, width: cw, height: ch });

      // Дочерние узлы внутри группы
      for (const gc of child.children || []) {
        const gw = gc.width || 0;
        const gh = gc.height || 0;
        const pos = elkToG6(cx + (gc.x || 0), cy + (gc.y || 0), gw, gh);
        nodePositions.set(gc.id, { ...pos, width: gw, height: gh });
      }
    } else {
      // Корневой узел
      const pos = elkToG6(cx, cy, cw, ch);
      nodePositions.set(child.id, { ...pos, width: cw, height: ch });
    }
  }

  // --- 6. Сбор рёбер ---
  // G6 v5 сам рассчитывает маршрутизацию через router: { type: 'orth' }.
  // Нам нужны только source/target. ELK может сливать рёбра в гипердуги.
  const originalEdgeMap = new Map(validEdges.map(e => [e.id, e]));
  const finalEdges: LayoutResult['edges'] = [];
  const usedOriginalIds = new Set<string>();

  for (const elkEdge of layoutedGraph.edges || []) {
    const sources: string[] = elkEdge.sources || [];
    const targets: string[] = elkEdge.targets || [];
    if (!sources.length || !targets.length) continue;

    if (sources.length === 1 && targets.length === 1) {
      const s = sources[0], t = targets[0];
      if (s === t) continue;
      finalEdges.push({ id: elkEdge.id, source: s, target: t });
      usedOriginalIds.add(elkEdge.id);
    } else {
      // Гипердуга — разворачиваем обратно
      for (let si = 0; si < sources.length; si++) {
        for (let ti = 0; ti < targets.length; ti++) {
          const s = sources[si], t = targets[ti];
          if (s === t) continue;
          const origId = findOriginalEdgeId(originalEdgeMap, usedOriginalIds, s, t);
          finalEdges.push({ id: origId || `edge_${s}_${t}`, source: s, target: t });
          if (origId) usedOriginalIds.add(origId);
        }
      }
    }
  }

  // Добавляем рёбра, которые ELK не вернул
  for (const [id, orig] of originalEdgeMap) {
    if (usedOriginalIds.has(id)) continue;
    finalEdges.push({ id, source: orig.source, target: orig.target });
  }

  // --- 7. Формирование результата ---
  const resultNodes = [...nodePositions.entries()].map(([id, p]) => ({
    id, x: p.x, y: p.y, width: p.width, height: p.height,
  }));

  // Combos — сохраняем для расчёта bounding box в NetworkGraphG6
  const resultCombos = [...comboPositions.entries()].map(([id, p]) => ({
    id,
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
    label: nodeMap.get(id)?.data?.name || nodeMap.get(id)?.data?.label || id,
  }));

  console.log(`[ELK] ${resultNodes.length} nodes, ${finalEdges.length} edges, ${resultCombos.length} cabinets`);
  return { nodes: resultNodes, edges: finalEdges, combos: resultCombos };
}

// ============================================================================
// Вспомогательные функции
// ============================================================================

/** Найти оригинальное ребро по source/target */
function findOriginalEdgeId(
  map: Map<string, LayoutEdge>,
  used: Set<string>,
  source: string,
  target: string,
): string | undefined {
  for (const [id, edge] of map) {
    if (!used.has(id) && edge.source === source && edge.target === target) return id;
  }
  return undefined;
}

/** Fallback раскладка — сетка */
function fallbackLayout(nodes: LayoutNode[]): LayoutResult {
  const resultNodes = nodes.map((node, i) => {
    const type = (node.type || node.data?.type || 'load').toLowerCase();
    const size = NODE_SIZES[type] || { width: 160, height: 80 };
    return {
      id: node.id,
      x: size.width / 2 + 100 + (i % 10) * 200,
      y: size.height / 2 + 100 + Math.floor(i / 10) * 120,
      width: size.width,
      height: size.height,
    };
  });
  return { nodes: resultNodes, edges: [], combos: [] };
}

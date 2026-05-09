/**
 * ELK Layout Engine — чистая интеграция с G6
 *
 * Один вызов ELK с нативной иерархией (INCLUDE_CHILDREN).
 * Cabinet = ELK группа с children внутри.
 * Рёбра element→element напрямую.
 *
 * Координаты: ELK возвращает top-left → конвертируем в G6 center.
 * Порты: FREE — ELK создаёт столько портов, сколько нужно.
 */

import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

// ============================================================================
// Размеры узлов по типам
// ============================================================================
export const NODE_SIZES: Record<string, { width: number; height: number }> = {
  source:      { width: 120, height: 60 },
  bus:         { width: 150, height: 30 },
  breaker:     { width: 100, height: 50 },
  meter:       { width: 100, height: 50 },
  load:        { width: 120, height: 60 },
  junction:    { width: 30,  height: 30 },
  transformer: { width: 100, height: 60 },
};

// ============================================================================
// Типы
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

  // --- 1. Группировка ---
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const childrenByParent = new Map<string, LayoutNode[]>();
  const rootNodes: LayoutNode[] = [];

  for (const node of nodes) {
    if (node.combo) {
      if (!childrenByParent.has(node.combo)) childrenByParent.set(node.combo, []);
      childrenByParent.get(node.combo)!.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  const cabinetIds = new Set(childrenByParent.keys());

  // --- 2. Фильтрация рёбер ---
  const validEdges = edges.filter(e => nodeMap.has(e.source) && nodeMap.has(e.target));

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
        const size = NODE_SIZES[type] || { width: 80, height: 40 };
        return {
          id: child.id,
          width: size.width,
          height: size.height,
          labels: child.data?.name ? [{ text: child.data.name }] : [],
        };
      }),
      layoutOptions: {
        'elk.spacing.nodeNode': '25',
        'elk.layered.spacing.nodeNodeBetweenLayers': '40',
        'elk.padding': '[top=20,left=20,bottom=20,right=20]',
      },
    });
  }

  const elkRootChildren: any[] = rootNodes
    .filter(n => !cabinetIds.has(n.id))
    .map(node => {
      const type = (node.type || node.data?.type || 'load').toLowerCase();
      const size = NODE_SIZES[type] || { width: 80, height: 40 };
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
      'elk.edgeRouting': 'SPLINES',
      'elk.spacing.nodeNode': '25',
      'elk.layered.spacing.nodeNodeBetweenLayers': '50',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.spacing.componentComponent': '40',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
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
      // Группа — сохраняем top-left для G6 combo
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

  // --- 6. Сбор рёбер с контрольными точками ---
  // ELK может вернуть гипердугу (несколько sources/targets) для рёбер
  // с одинаковыми source и target. Разворачиваем обратно.
  const originalEdgeMap = new Map(validEdges.map(e => [e.id, e]));
  const finalEdges: LayoutResult['edges'] = [];
  const usedOriginalIds = new Set<string>();

  for (const elkEdge of layoutedGraph.edges || []) {
    const sources: string[] = elkEdge.sources || [];
    const targets: string[] = elkEdge.targets || [];
    if (!sources.length || !targets.length) continue;

    const cp = extractControlPoints(elkEdge);

    if (sources.length === 1 && targets.length === 1) {
      const s = sources[0], t = targets[0];
      if (s === t) continue;
      finalEdges.push({ id: elkEdge.id, source: s, target: t, ...cp });
      usedOriginalIds.add(elkEdge.id);
    } else {
      // Гипердуга — разворачиваем
      for (let si = 0; si < sources.length; si++) {
        for (let ti = 0; ti < targets.length; ti++) {
          const s = sources[si], t = targets[ti];
          if (s === t) continue;
          // Ищем оригинальное ребро
          const origId = findOriginalEdgeId(originalEdgeMap, usedOriginalIds, s, t);
          finalEdges.push({ id: origId || `edge_${s}_${t}`, source: s, target: t, ...cp });
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

  const resultCombos = [...comboPositions.entries()].map(([id, p]) => ({
    id,
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
    label: nodeMap.get(id)?.data?.name || nodeMap.get(id)?.data?.label || id,
  }));

  console.log(`[ELK] ${resultNodes.length} nodes, ${finalEdges.length} edges, ${resultCombos.length} combos`);
  return { nodes: resultNodes, edges: finalEdges, combos: resultCombos };
}

// ============================================================================
// Вспомогательные функции
// ============================================================================

/** Извлечь controlPoints из ELK edge (только bendPoints, без start/end) */
function extractControlPoints(elkEdge: any): { controlPoints?: Array<{ x: number; y: number }> } {
  const points: Array<{ x: number; y: number }> = [];
  for (const section of elkEdge.sections || []) {
    for (const bp of section.bendPoints || []) {
      points.push({ x: bp.x, y: bp.y });
    }
  }
  return points.length ? { controlPoints: points } : {};
}

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
    const size = NODE_SIZES[type] || { width: 120, height: 60 };
    return {
      id: node.id,
      x: size.width / 2 + 100 + (i % 10) * 150,
      y: size.height / 2 + 100 + Math.floor(i / 10) * 100,
      width: size.width,
      height: size.height,
    };
  });
  return { nodes: resultNodes, edges: [], combos: [] };
}

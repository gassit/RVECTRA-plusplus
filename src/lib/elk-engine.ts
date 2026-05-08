/**
 * Standalone ELK Layout Engine — один вызов ELK с иерархией групп
 *
 * Cabinet = ELK группа (с children внутри).
 * ELK сам раскладывает элементы внутри групп и группы между собой.
 * Все рёбра element→element напрямую — контрольные точки правильные.
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
// Source/Breaker/Bus/Load/Meter — фиксированные NORTH (вход) + SOUTH (выход)
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

function getPortConstraints(type: string): string {
  return FIXED_PORT_TYPES.has(type) ? 'FIXED_SIDE' : 'FIXED_ORDER';
}

// ============================================================================
// КОНТРОЛЬНЫЕ ТОЧКИ — только bendPoints (без startPoint/endPoint)
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
// ОСНОВНАЯ ФУНКЦИЯ — ОДИН ВЫЗОВ ELK С ИЕРАРХИЕЙ
// ============================================================================
export async function computeElkLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): Promise<LayoutResult> {
  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges: [], combos: [] };
  }

  console.log('[ELK] Single-call hierarchical layout for', nodes.length, 'nodes,', edges.length, 'edges');

  // ================================================================
  // 1. ГРУППИРОВКА
  // ================================================================
  const nodeMap = new Map<string, LayoutNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const childrenByParent = new Map<string, LayoutNode[]>();
  const rootNodes: LayoutNode[] = [];

  for (const node of nodes) {
    const parentId = node.combo;
    if (parentId) {
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId)!.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  const cabinetIds = new Set(childrenByParent.keys());

  console.log('[ELK] Cabinets:', [...cabinetIds].length, '| Root nodes:', rootNodes.length, '| Nested:', nodes.length - rootNodes.length);

  // ================================================================
  // 2. ФИЛЬТРАЦИЯ РЁБЕР — только валидные element→element
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
  // 3. ПОСТРОЕНИЕ ELK ГРАФА С ИЕРАРХИЕЙ
  //    Cabinet = группа с children внутри.
  //    Корневые узлы — прямо в root.
  //    Рёбра element→element напрямую.
  // ================================================================

  // Группы шкафов
  const elkGroups: any[] = [];
  for (const [cabinetId, children] of childrenByParent.entries()) {
    const cabinetNode = nodeMap.get(cabinetId);
    const label = cabinetNode?.data?.name || cabinetNode?.data?.label || cabinetId;

    const elkChildren = children.map(child => {
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

    elkGroups.push({
      id: cabinetId,
      labels: [{ text: label }],
      children: elkChildren,
      layoutOptions: {
        'elk.spacing.nodeNode': '25',
        'elk.layered.spacing.nodeNodeBetweenLayers': '40',
        // Отступы внутри группы
        'elk.padding': '[top=20,left=20,bottom=20,right=20]',
      },
    });
  }

  // Корневые узлы (не внутри шкафов)
  const elkRootChildren: any[] = [];
  for (const node of rootNodes) {
    if (cabinetIds.has(node.id)) continue;
    const type = (node.type || node.data?.type || 'load').toLowerCase();
    const size = NODE_SIZES[type] || { width: 80, height: 40 };
    elkRootChildren.push({
      id: node.id,
      width: size.width,
      height: size.height,
      labels: node.data?.name ? [{ text: node.data.name }] : [],
      ports: buildPortsForNode(node.id, type),
      properties: { 'portConstraints': getPortConstraints(type) },
    });
  }

  const elkGraph: any = {
    id: 'root',
    children: [...elkRootChildren, ...elkGroups],
    edges: validEdges.map(edge => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'SPLINES',
      'elk.spacing.nodeNode': '25',
      'elk.layered.spacing.nodeNodeBetweenLayers': '40',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.layered.cycleBreaking.strategy': 'GREEDY',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.crossingMinimization.semiInteractive': 'true',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.portConstraints': 'FIXED_ORDER',
      // Отступы между группами
      'elk.spacing.componentComponent': '40',
    },
  };

  console.log(`[ELK] Graph: ${elkRootChildren.length} root nodes, ${elkGroups.length} groups, ${validEdges.length} edges IN`);

  // Сохраняем все оригинальные рёбра для восстановления
  const edgeOriginalMap = new Map<string, LayoutEdge>();
  for (const edge of validEdges) {
    edgeOriginalMap.set(edge.id, edge);
  }

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
  // 5. СБОР КООРДИНАТ — рекурсивный обход иерархии ELK
  //    ELK даёт координаты относительно родителя.
  //    Накапливаем offsetX/offsetY для абсолютных координат.
  // ================================================================
  const nodePositions = new Map<string, NodePosition>();
  const comboPositions = new Map<string, NodePosition>();

  function collectPositions(elkNode: any, offsetX: number, offsetY: number, depth: number) {
    const nodeX = (elkNode.x || 0) + offsetX;
    const nodeY = (elkNode.y || 0) + offsetY;
    const w = elkNode.width || 0;
    const h = elkNode.height || 0;

    if (depth > 0 && cabinetIds.has(elkNode.id)) {
      // Группа (cabinet) — сохраняем как combo (левый верхний угол)
      comboPositions.set(elkNode.id, { x: nodeX, y: nodeY, width: w, height: h });
    }

    // Собираем дочерние узлы
    if (elkNode.children) {
      for (const child of elkNode.children) {
        if (cabinetIds.has(child.id)) {
          // Это группа — рекурсивно обходим
          collectPositions(child, nodeX, nodeY, depth + 1);
        } else {
          // Обычный узел — сохраняем (центр)
          nodePositions.set(child.id, {
            x: nodeX + (child.x || 0) + (child.width || 0) / 2,
            y: nodeY + (child.y || 0) + (child.height || 0) / 2,
            width: child.width || 0,
            height: child.height || 0,
          });
        }
      }
    }
  }

  // root — это контейнер, его children на верхнем уровне
  if (layoutedGraph.children) {
    for (const child of layoutedGraph.children) {
      if (cabinetIds.has(child.id)) {
        // Группа — рекурсивно обходим внутри
        comboPositions.set(child.id, {
          x: child.x || 0,
          y: child.y || 0,
          width: child.width || 0,
          height: child.height || 0,
        });
        if (child.children) {
          for (const grandchild of child.children) {
            nodePositions.set(grandchild.id, {
              x: (child.x || 0) + (grandchild.x || 0) + (grandchild.width || 0) / 2,
              y: (child.y || 0) + (grandchild.y || 0) + (grandchild.height || 0) / 2,
              width: grandchild.width || 0,
              height: grandchild.height || 0,
            });
          }
        }
      } else {
        // Корневой узел (не в группе)
        nodePositions.set(child.id, {
          x: (child.x || 0) + (child.width || 0) / 2,
          y: (child.y || 0) + (child.height || 0) / 2,
          width: child.width || 0,
          height: child.height || 0,
        });
      }
    }
  }

  console.log(`[ELK] Positioned: ${nodePositions.size} nodes, ${comboPositions.size} combos`);

  // ================================================================
  // 6. СБОР РЁБЕР С КОНТРОЛЬНЫМИ ТОЧКАМИ
  //    ELK может слить рёбра с одинаковыми source/target в гипердугу.
  //    Разворачиваем обратно: sources[i] → targets[i].
  // ================================================================
  const finalEdges: LayoutResult['edges'] = [];

  // Множество уже добавленных ID чтобы не дублировать
  const addedEdgeIds = new Set<string>();

  for (const edge of layoutedGraph.edges || []) {
    const sources = edge.sources || [];
    const targets = edge.targets || [];
    if (sources.length === 0 || targets.length === 0) continue;

    // Сколько уникальных пар source→target
    if (sources.length === 1 && targets.length === 1) {
      // Обычное ребро
      const source = sources[0];
      const target = targets[0];
      if (source === target) continue;

      const edgeId = edge.id || `${source}->${target}`;
      const points = getControlPoints(edge);

      // Если ELK вернул с таким ID — берём данные из оригинала
      const original = edgeOriginalMap.get(edgeId);
      finalEdges.push({
        id: edgeId,
        source,
        target,
        ...(points.length ? { controlPoints: points } : {}),
        ...(original?.data ? { data: original.data } : {}),
      });
      addedEdgeIds.add(edgeId);
    } else {
      // Гипердуга — разворачиваем в отдельные рёбра
      for (let si = 0; si < sources.length; si++) {
        for (let ti = 0; ti < targets.length; ti++) {
          const source = sources[si];
          const target = targets[ti];
          if (source === target) continue;

          // Ищем оригинальное ребро с этим source→target
          let foundId: string | undefined;
          for (const [origId, origEdge] of edgeOriginalMap.entries()) {
            if (origEdge.source === source && origEdge.target === target && !addedEdgeIds.has(origId)) {
              foundId = origId;
              break;
            }
          }

          const edgeId = foundId || `hyper_${source}_${target}_${si}_${ti}`;
          const points = getControlPoints(edge);
          const original = foundId ? edgeOriginalMap.get(foundId) : undefined;

          finalEdges.push({
            id: edgeId,
            source,
            target,
            ...(points.length ? { controlPoints: points } : {}),
            ...(original?.data ? { data: original.data } : {}),
          });
          addedEdgeIds.add(edgeId);
        }
      }
    }
  }

  // Добавляем рёбра, которые ELK вообще не вернул (пропущенные)
  for (const [edgeId, origEdge] of edgeOriginalMap.entries()) {
    if (addedEdgeIds.has(edgeId)) continue;
    console.warn(`[ELK] Edge "${edgeId}" (${origEdge.source}->${origEdge.target}) not returned by ELK, adding without controlPoints`);
    finalEdges.push({
      id: edgeId,
      source: origEdge.source,
      target: origEdge.target,
    });
  }

  // ================================================================
  // 7. ФОРМИРОВАНИЕ РЕЗУЛЬТАТА
  // ================================================================
  const resultNodes: LayoutResult['nodes'] = [];
  for (const [id, pos] of nodePositions.entries()) {
    resultNodes.push({ id, x: pos.x, y: pos.y, width: pos.width, height: pos.height });
  }

  // Комбо: x, y — левый верхний угол (как ожидает G6)
  const resultCombos: LayoutResult['combos'] = [];
  for (const [cabinetId] of childrenByParent.entries()) {
    const pos = comboPositions.get(cabinetId);
    if (pos) {
      const cabinetNode = nodeMap.get(cabinetId);
      resultCombos.push({
        id: cabinetId,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        label: cabinetNode?.data?.name || cabinetNode?.data?.label || cabinetId,
      });
    }
  }

  console.log(`[ELK] Result: ${resultNodes.length} nodes, ${finalEdges.length} edges, ${resultCombos.length} combos`);

  return { nodes: resultNodes, edges: finalEdges, combos: resultCombos };
}

/**
 * ELK Layout Engine Adapter
 * Адаптер для преобразования данных между G6 и ELK форматами
 * Автоматически добавляет порты и размеры, необходимые для FIXED_SIDE
 */

import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

// Конфигурация для однолинейной электрической схемы
// КЛЮЧЕВЫЕ НАСТРОЙКИ ДЛЯ КОМПАКТНОСТИ:
const ELK_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN', // Сверху вниз (Источник -> Потребитель)
  
  // Расстояния - уменьшаем для компактности
  'elk.layered.spacing.nodeNodeBetweenLayers': '80',  // было 150 - вертикальное расстояние
  'elk.spacing.nodeNode': '40',  // было 80 - горизонтальное расстояние
  'elk.spacing.edgeEdge': '10',  // было 20 - между параллельными линиями
  'elk.spacing.portPort': '5',   // расстояние между портами
  
  // Компактность
  'elk.layered.compaction.postCompaction.strategy': 'LEFT',  // сжимаем влево
  'elk.layered.compaction.connectedComponents': 'true',      // сжимать компоненты
  'elk.layered.unnecessaryBendpoints': 'true',
  
  // Оптимизация для вертикальной схемы
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.cycleBreaking.strategy': 'GREEDY',
  
  // Порты
  'elk.portConstraints': 'FIXED_SIDE',
};

interface RawNode {
  id: string;
  type?: string;
  width?: number;
  height?: number;
  [key: string]: any;
}

interface RawEdge {
  id?: string;
  source: string;
  target: string;
  sourcePort?: string;
  targetPort?: string;
  [key: string]: any;
}

interface LayoutResult {
  nodes: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    [key: string]: any;
  }>;
  edges: Array<{
    id?: string;
    source: string;
    target: string;
    controlPoints: Array<{ x: number; y: number }>;
    [key: string]: any;
  }>;
}

/**
 * Определяет размеры узла по типу
 */
function getNodeSize(node: RawNode): { width: number; height: number } {
  const type = (node.type || '').toLowerCase();

  // Стандартные размеры по типам
  const sizes: Record<string, { width: number; height: number }> = {
    source: { width: 160, height: 80 },
    bus: { width: 200, height: 40 },
    breaker: { width: 140, height: 70 },
    meter: { width: 140, height: 70 },
    load: { width: 160, height: 80 },
    cabinet: { width: 180, height: 50 },
    junction: { width: 40, height: 40 },
    transformer: { width: 140, height: 80 },
  };

  return sizes[type] || { width: 160, height: 80 };
}

/**
 * Определяет порты для узла по типу
 * Источники - только выход (SOUTH)
 * Нагрузки - только вход (NORTH)
 * Остальные - вход и выход
 */
function getNodePorts(node: RawNode): Array<{ id: string; properties: Record<string, string> }> {
  const type = (node.type || '').toLowerCase();
  const ports: Array<{ id: string; properties: Record<string, string> }> = [];

  if (type === 'source') {
    // Источник - только выход снизу
    ports.push({
      id: `${node.id}_port_out`,
      properties: { 'port.side': 'SOUTH' },
    });
  } else if (type === 'load') {
    // Нагрузка - только вход сверху
    ports.push({
      id: `${node.id}_port_in`,
      properties: { 'port.side': 'NORTH' },
    });
  } else {
    // Остальные узлы - вход сверху, выход снизу
    ports.push({
      id: `${node.id}_port_in`,
      properties: { 'port.side': 'NORTH' },
    });
    ports.push({
      id: `${node.id}_port_out`,
      properties: { 'port.side': 'SOUTH' },
    });
  }

  return ports;
}

/**
 * Выполняет ELK layout и возвращает координаты для G6
 */
export async function applyElkLayout(
  nodes: RawNode[],
  edges: RawEdge[]
): Promise<LayoutResult> {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Валидация: создаём Set существующих ID узлов
  const nodeIds = new Set(nodes.map(n => n.id));

  // Фильтруем рёбра - оставляем только те, у которых source и target существуют
  const validEdges = edges.filter(edge => {
    const sourceExists = nodeIds.has(edge.source);
    const targetExists = nodeIds.has(edge.target);
    if (!sourceExists || !targetExists) {
      console.warn(`[ELK] Edge ${edge.id || edge.source + '-' + edge.target} references missing node(s)`);
      return false;
    }
    return true;
  });

  // 1. Подготовка узлов: добавляем размеры и порты
  const elkNodes = nodes.map((node) => {
    const size = getNodeSize(node);
    const width = node.width || size.width;
    const height = node.height || size.height;
    const ports = getNodePorts(node);

    return {
      id: node.id,
      width,
      height,
      ports,
      layoutOptions: {
        'portConstraints': 'FIXED_SIDE',
      },
    };
  });

  // 2. Подготовка рёбер: привязываем к созданным портам
  const elkEdges = validEdges.map((edge) => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    const sourceType = (sourceNode?.type || '').toLowerCase();
    const targetType = (targetNode?.type || '').toLowerCase();

    // Определяем порты в зависимости от типа узла
    let sourcePort: string;
    let targetPort: string;

    if (sourceType === 'source') {
      sourcePort = `${edge.source}_port_out`;
    } else {
      sourcePort = edge.sourcePort || `${edge.source}_port_out`;
    }

    if (targetType === 'load') {
      targetPort = `${edge.target}_port_in`;
    } else {
      targetPort = edge.targetPort || `${edge.target}_port_in`;
    }

    return {
      id: edge.id || `${edge.source}-${edge.target}`,
      sources: [edge.source],
      targets: [edge.target],
      sourcePort,
      targetPort,
    };
  });

  // 3. Формирование графа для ELK
  const graph = {
    id: 'root',
    layoutOptions: ELK_OPTIONS,
    children: elkNodes,
    edges: elkEdges,
  };

  try {
    console.log('[ELK] Starting layout for', nodes.length, 'nodes,', validEdges.length, 'edges');
    console.log('[ELK] Input nodes sample:', nodes.slice(0, 3).map(n => ({ id: n.id, type: n.type })));

    // 4. Запуск расчета макета
    const layout = await elk.layout(graph);

    // ЛОГИРОВАНИЕ: сырой результат от ELK (до трансформации)
    console.log('[ELK] RAW layout result:');
    console.log('  - layout.children exists:', !!layout.children);
    console.log('  - layout.children length:', layout.children?.length);
    if (layout.children && layout.children.length > 0) {
      const sample = layout.children.slice(0, 3);
      console.log('  - RAW nodes sample (top-left coords from ELK):');
      sample.forEach((n: any) => {
        console.log(`    ${n.id}: x=${n.x}, y=${n.y}, w=${n.width}, h=${n.height}`);
      });
    }

    // 5. Преобразование результата обратно в формат G6
    if (!layout.children) {
      throw new Error('ELK returned empty layout');
    }

    const newNodes = layout.children.map((node: any) => {
      const originalNode = nodes.find(n => n.id === node.id);

      // ВАЖНО: spread оператор первым, чтобы width/height не были перезаписаны
      // ELK возвращает координаты верхнего левого угла (top-left)
      // G6 ожидает координаты центра узла, поэтому добавляем width/2 и height/2
      return {
        ...originalNode,
        id: node.id,
        x: node.x + node.width / 2, // G6 использует центр узла
        y: node.y + node.height / 2,
        width: node.width,
        height: node.height,
      };
    });

    // ЛОГИРОВАНИЕ: результат после трансформации (center coords for G6)
    console.log('[ELK] TRANSFORMED nodes (center coords for G6):');
    newNodes.slice(0, 3).forEach((n: any) => {
      console.log(`  ${n.id}: x=${n.x?.toFixed(1)}, y=${n.y?.toFixed(1)}, w=${n.width}, h=${n.height}`);
    });
    // Проверка на NaN или undefined
    const invalidNodes = newNodes.filter((n: any) => 
      typeof n.x !== 'number' || typeof n.y !== 'number' || isNaN(n.x) || isNaN(n.y)
    );
    if (invalidNodes.length > 0) {
      console.error('[ELK] INVALID nodes found:', invalidNodes.length);
      invalidNodes.slice(0, 5).forEach((n: any) => {
        console.error(`  ${n.id}: x=${n.x}, y=${n.y}`);
      });
    }

    // Обработка контрольных точек для рёбер (ортогональная маршрутизация)
    const newEdges = (layout.edges || []).map((edge: any) => {
      const originalEdge = validEdges.find(e =>
        (e.id && e.id === edge.id) ||
        (e.source === edge.sources[0] && e.target === edge.targets[0])
      );

      const sections = edge.sections?.[0];
      const controlPoints: Array<{ x: number; y: number }> = [];

      // Добавляем точки изгиба (bendPoints) для ортогональной маршрутизации
      if (sections?.bendPoints) {
        controlPoints.push(...sections.bendPoints.map((bp: any) => ({ x: bp.x, y: bp.y })));
      }

      // ВАЖНО: spread оператор первым, чтобы id/source/target не были перезаписаны
      return {
        ...originalEdge,
        id: edge.id,
        source: edge.sources[0],
        target: edge.targets[0],
        controlPoints,
      };
    });

    // Вычисляем bounds схемы
    const bounds = newNodes.reduce((acc: any, n: any) => ({
      minX: Math.min(acc.minX, n.x - n.width / 2),
      maxX: Math.max(acc.maxX, n.x + n.width / 2),
      minY: Math.min(acc.minY, n.y - n.height / 2),
      maxY: Math.max(acc.maxY, n.y + n.height / 2),
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

    console.log('[ELK] Layout complete:', newNodes.length, 'nodes,', newEdges.length, 'edges');
    console.log('[ELK] Schema bounds: width=' + Math.round(bounds.maxX - bounds.minX) + 
                ', height=' + Math.round(bounds.maxY - bounds.minY) +
                ' | minX=' + Math.round(bounds.minX) + ', minY=' + Math.round(bounds.minY));

    return { nodes: newNodes, edges: newEdges };
  } catch (error) {
    console.error('[ELK] Layout Error:', error);

    // В случае ошибки возвращаем исходные данные с дефолтными позициями
    const fallbackNodes = nodes.map((node, index) => {
      const size = getNodeSize(node);
      return {
        ...node,
        x: 100 + (index % 10) * 150,
        y: 100 + Math.floor(index / 10) * 100,
        width: size.width,
        height: size.height,
      };
    });

    return { nodes: fallbackNodes, edges: validEdges as any };
  }
}

/**
 * Проверяет, доступен ли ELK
 */
export async function isElkAvailable(): Promise<boolean> {
  try {
    const testGraph = {
      id: 'test',
      children: [{ id: 'n1', width: 100, height: 50 }],
      edges: [],
    };
    await elk.layout(testGraph);
    return true;
  } catch {
    return false;
  }
}

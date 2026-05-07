/**
 * ELK Layout Engine Adapter
 * Адаптер для преобразования данных между G6 и ELK форматами
 * Автоматически добавляет порты и размеры, необходимые для FIXED_SIDE
 */

import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

// Конфигурация для однолинейной электрической схемы
const ELK_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN', // Сверху вниз (Источник -> Потребитель)
  'elk.layered.spacing.nodeNodeBetweenLayers': '150', // Расстояние по вертикали
  'elk.spacing.nodeNode': '80', // Расстояние по горизонтали
  'elk.spacing.edgeEdge': '20', // Расстояние между параллельными линиями
  'elk.layered.unnecessaryBendpoints': 'true',
  'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
  'elk.portConstraints': 'FIXED_SIDE',
  'elk.alignment': 'CENTER',
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

    // 4. Запуск расчета макета
    const layout = await elk.layout(graph);

    // 5. Преобразование результата обратно в формат G6
    if (!layout.children) {
      throw new Error('ELK returned empty layout');
    }

    const newNodes = layout.children.map((node: any) => {
      const originalNode = nodes.find(n => n.id === node.id);

      return {
        id: node.id,
        x: node.x + node.width / 2, // G6 использует центр узла
        y: node.y + node.height / 2,
        width: node.width,
        height: node.height,
        // Сохраняем оригинальные данные
        ...originalNode,
      };
    });

    // Обработка контрольных точек для рёбер (ортогональная маршрутизация)
    const newEdges = (layout.edges || []).map((edge: any) => {
      const originalEdge = validEdges.find(e =>
        (e.id && e.id === edge.id) ||
        (e.source === edge.sources[0] && e.target === edge.targets[0])
      );

      const sections = edge.sections?.[0];
      const controlPoints: Array<{ x: number; y: number }> = [];

      // Добавляем точки изгиба (bendPoints)
      if (sections?.bendPoints) {
        controlPoints.push(...sections.bendPoints.map((bp: any) => ({ x: bp.x, y: bp.y })));
      }

      return {
        id: edge.id,
        source: edge.sources[0],
        target: edge.targets[0],
        controlPoints,
        // Сохраняем оригинальные данные
        ...originalEdge,
      };
    });

    console.log('[ELK] Layout complete:', newNodes.length, 'nodes,', newEdges.length, 'edges');

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

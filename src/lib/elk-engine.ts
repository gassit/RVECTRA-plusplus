/**
 * ELK Layout Engine
 * Рассчитывает координаты узлов для G6
 */

import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

// Компактная конфигурация для электрической схемы
const ELK_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '60',  // уменьшено
  'elk.spacing.nodeNode': '30',                        // уменьшено
  'elk.spacing.edgeEdge': '8',
  'elk.layered.compaction.postCompaction.strategy': 'LEFT',
  'elk.layered.compaction.connectedComponents': 'true',
  'elk.layered.unnecessaryBendpoints': 'true',
};

// Размеры узлов по типам
const NODE_SIZES: Record<string, { width: number; height: number }> = {
  source: { width: 120, height: 60 },
  bus: { width: 150, height: 30 },
  breaker: { width: 100, height: 50 },
  meter: { width: 100, height: 50 },
  load: { width: 120, height: 60 },
  cabinet: { width: 140, height: 40 },
  junction: { width: 30, height: 30 },
  transformer: { width: 100, height: 60 },
};

interface ElkNode {
  id: string;
  type?: string;
}

interface ElkEdge {
  id?: string;
  source: string;
  target: string;
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
    source: string;
    target: string;
    controlPoints: Array<{ x: number; y: number }>;
  }>;
}

/**
 * Рассчитывает layout через ELK
 */
export async function applyElkLayout(
  nodes: ElkNode[],
  edges: ElkEdge[]
): Promise<LayoutResult> {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodeIds = new Set(nodes.map(n => n.id));
  const validEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

  // Подготавливаем узлы для ELK
  const elkNodes = nodes.map(node => {
    const type = (node.type || 'load').toLowerCase();
    const size = NODE_SIZES[type] || { width: 120, height: 60 };
    
    return {
      id: node.id,
      width: size.width,
      height: size.height,
      // Порты для ортогональных соединений
      ports: type === 'source' 
        ? [{ id: `${node.id}_out`, properties: { 'port.side': 'SOUTH' } }]
        : type === 'load'
        ? [{ id: `${node.id}_in`, properties: { 'port.side': 'NORTH' } }]
        : [
          { id: `${node.id}_in`, properties: { 'port.side': 'NORTH' } },
          { id: `${node.id}_out`, properties: { 'port.side': 'SOUTH' } },
        ],
    };
  });

  // Подготавливаем рёбра для ELK
  const elkEdges = validEdges.map(edge => ({
    id: edge.id || `${edge.source}-${edge.target}`,
    sources: [edge.source],
    targets: [edge.target],
    sourcePort: `${edge.source}_out`,
    targetPort: `${edge.target}_in`,
  }));

  const graph = {
    id: 'root',
    layoutOptions: ELK_OPTIONS,
    children: elkNodes,
    edges: elkEdges,
  };

  try {
    console.log('[ELK] Starting layout for', nodes.length, 'nodes');
    
    const layout = await elk.layout(graph);
    
    if (!layout.children) {
      throw new Error('ELK returned empty layout');
    }

    // Преобразуем результат - top-left to center
    const newNodes = layout.children.map((node: any) => ({
      id: node.id,
      x: node.x + node.width / 2,
      y: node.y + node.height / 2,
      width: node.width,
      height: node.height,
    }));

    // Извлекаем контрольные точки для ортогональных рёбер
    const newEdges = (layout.edges || []).map((edge: any) => {
      const controlPoints: Array<{ x: number; y: number }> = [];
      
      if (edge.sections?.[0]?.bendPoints) {
        controlPoints.push(...edge.sections[0].bendPoints.map((bp: any) => ({
          x: bp.x,
          y: bp.y,
        })));
      }

      return {
        id: edge.id,
        source: edge.sources[0],
        target: edge.targets[0],
        controlPoints,
      };
    });

    // Логируем bounds схемы
    const bounds = newNodes.reduce((acc, n) => ({
      minX: Math.min(acc.minX, n.x - n.width / 2),
      maxX: Math.max(acc.maxX, n.x + n.width / 2),
      minY: Math.min(acc.minY, n.y - n.height / 2),
      maxY: Math.max(acc.maxY, n.y + n.height / 2),
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

    console.log('[ELK] Layout complete. Bounds:', {
      width: Math.round(bounds.maxX - bounds.minX),
      height: Math.round(bounds.maxY - bounds.minY),
    });

    return { nodes: newNodes, edges: newEdges };
    
  } catch (error) {
    console.error('[ELK] Error:', error);
    
    // Fallback - простая сетка
    const fallbackNodes = nodes.map((node, i) => {
      const type = (node.type || 'load').toLowerCase();
      const size = NODE_SIZES[type] || { width: 120, height: 60 };
      return {
        id: node.id,
        x: 100 + (i % 10) * 150,
        y: 100 + Math.floor(i / 10) * 100,
        width: size.width,
        height: size.height,
      };
    });
    
    return { nodes: fallbackNodes, edges: validEdges as any };
  }
}

export { NODE_SIZES };

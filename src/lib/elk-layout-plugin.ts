/**
 * ELK Layout Plugin for G6 v5
 * Правильная интеграция через BaseLayout
 */

import { BaseLayout, ExtensionCategory, register } from '@antv/g6';
import type { GraphData } from '@antv/g6';
import ELK from 'elkjs/lib/elk.bundled.js';

// Конфигурация ELK для электрической схемы
// Ключевая идея: сохраняем порядок узлов и связей как во входных данных
const ELK_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',  // Поток энергии сверху вниз
  // КРИТИЧНО: сохраняем порядок узлов и связей
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.cycleBreaking.strategy': 'MODEL_ORDER',
  // Иерархия: каждый уровень обрабатывается независимо
  'elk.hierarchyHandling': 'SEPARATE_CHILDREN',
  // Размещение узлов
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  // Отступы
  'elk.spacing.nodeNode': '20',
  'elk.layered.spacing.nodeNodeBetweenLayers': '50',
  'elk.spacing.edgeEdge': '8',
  // Ортогональная маршрутизация рёбер
  'elk.edgeRouting': 'ORTHOGONAL',
  // Убираем лишние точки изгиба
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

interface ElkLayoutOptions {
  nodeSize?: { width: number; height: number };
  spacing?: number;
}

class ElkLayout extends BaseLayout {
  id = 'elk-layout';
  private elk: InstanceType<typeof ELK>;

  constructor(context: any) {
    super(context);
    this.elk = new ELK();
  }

  async execute(model: GraphData, options?: ElkLayoutOptions): Promise<GraphData> {
    if (!model.nodes || model.nodes.length === 0) {
      return model;
    }

    console.log('[ElkLayout] Starting layout for', model.nodes.length, 'nodes');

    // Подготавливаем узлы для ELK
    const elkNodes = model.nodes.map((node: any, index: number) => {
      const type = (node.data?.type || node.type || 'load').toLowerCase();
      const size = NODE_SIZES[type] || { width: 120, height: 60 };

      // Порты для ортогональных соединений
      // FIXED_ORDER гарантирует что ELK не перемешивает порты
      const ports = type === 'source'
        ? [{ id: `${node.id}_out`, properties: { 'port.side': 'SOUTH' } }]
        : type === 'load'
        ? [{ id: `${node.id}_in`, properties: { 'port.side': 'NORTH' } }]
        : [
          { id: `${node.id}_in`, properties: { 'port.side': 'NORTH' } },
          { id: `${node.id}_out`, properties: { 'port.side': 'SOUTH' } },
        ];

      return {
        id: node.id,
        width: size.width,
        height: size.height,
        // Фиксированный порядок портов
        ports,
        properties: {
          'portConstraints': 'FIXED_ORDER',
        },
        // Сохраняем исходный индекс для considerModelOrder
        layoutOptions: {
          'elk.position': `(x=${index * 200})`,
        },
      };
    });

    // Подготавливаем рёбра для ELK
    const nodeIds = new Set(model.nodes.map((n: any) => n.id));
    const validEdges = (model.edges || []).filter((edge: any) =>
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    const elkEdges = validEdges.map((edge: any) => ({
      id: edge.id || `${edge.source}-${edge.target}`,
      sources: [edge.source],
      targets: [edge.target],
    }));

    const elkGraph = {
      id: 'root',
      layoutOptions: ELK_OPTIONS,
      children: elkNodes,
      edges: elkEdges,
    };

    try {
      // Выполняем layout
      const layoutedGraph = await this.elk.layout(elkGraph);

      if (!layoutedGraph.children) {
        throw new Error('ELK returned empty layout');
      }

      console.log('[ElkLayout] ELK returned', layoutedGraph.children.length, 'nodes');

      // Преобразуем результат ELK в формат G6
      const layoutedNodes = (layoutedGraph.children || []) as any[];

      const updatedNodes = model.nodes.map((node: any) => {
        const elkNode = layoutedNodes.find((n: any) => n.id === node.id);

        if (elkNode) {
          // ELK использует top-left координаты, преобразуем в center
          const x = (elkNode.x ?? 0) + (elkNode.width ?? 0) / 2;
          const y = (elkNode.y ?? 0) + (elkNode.height ?? 0) / 2;

          return {
            ...node,
            style: {
              ...node.style,
              x,
              y,
              size: [elkNode.width || 120, elkNode.height || 60],
            },
          };
        }

        return node;
      });

      // Извлекаем контрольные точки для рёбер
      const layoutedEdges = (layoutedGraph.edges || []) as any[];
      const updatedEdges = (model.edges || []).map((edge: any) => {
        const elkEdge = layoutedEdges.find((e: any) => e.id === edge.id);

        if (elkEdge?.sections?.[0]?.bendPoints) {
          return {
            ...edge,
            style: {
              ...edge.style,
              controlPoints: elkEdge.sections[0].bendPoints.map((bp: any) => ({
                x: bp.x,
                y: bp.y,
              })),
            },
          };
        }

        return edge;
      });

      console.log('[ElkLayout] Layout complete');

      return {
        ...model,
        nodes: updatedNodes,
        edges: updatedEdges,
      };

    } catch (error) {
      console.error('[ElkLayout] Error:', error);

      // Fallback - сетка
      const fallbackNodes = model.nodes.map((node: any, index: number) => {
        const type = (node.data?.type || node.type || 'load').toLowerCase();
        const size = NODE_SIZES[type] || { width: 120, height: 60 };

        return {
          ...node,
          style: {
            ...node.style,
            x: 100 + (index % 10) * 150,
            y: 100 + Math.floor(index / 10) * 100,
            size: [size.width, size.height],
          },
        };
      });

      return {
        ...model,
        nodes: fallbackNodes,
      };
    }
  }
}

// Регистрируем layout в G6
register(ExtensionCategory.LAYOUT, 'elk-layout', ElkLayout);

export { ElkLayout, NODE_SIZES };

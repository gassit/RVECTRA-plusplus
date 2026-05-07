/**
 * ELK Layout Plugin для AntV G6 v5
 * Правильная интеграция через механизм расширений G6 (BaseLayout)
 * 
 * Использование:
 *   register(ExtensionCategory.LAYOUT, 'elk-layout', ELKLayout);
 *   new Graph({ layout: { type: 'elk-layout' } })
 */

import { BaseLayout, register, ExtensionCategory, type GraphData, type RuntimeContext } from '@antv/g6';
import type { BaseLayoutOptions } from '@antv/g6/lib/layouts/types';
import ELK from 'elkjs/lib/elk.bundled.js';

// Конфигурация для однолинейной электрической схемы
const DEFAULT_ELK_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '80',
  'elk.spacing.nodeNode': '40',
  'elk.spacing.edgeEdge': '10',
  'elk.spacing.portPort': '5',
  'elk.layered.compaction.postCompaction.strategy': 'LEFT',
  'elk.layered.compaction.connectedComponents': 'true',
  'elk.layered.unnecessaryBendpoints': 'true',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.cycleBreaking.strategy': 'GREEDY',
  'elk.portConstraints': 'FIXED_SIDE',
};

// Размеры узлов по типам
const NODE_SIZES: Record<string, [number, number]> = {
  source: [160, 80],
  bus: [200, 40],
  breaker: [140, 70],
  meter: [140, 70],
  load: [160, 80],
  cabinet: [180, 50],
  junction: [40, 40],
  transformer: [140, 80],
};

interface ELKLayoutOptions extends BaseLayoutOptions {
  elkOptions?: Record<string, string>;
  nodeSizes?: Record<string, [number, number]>;
}

/**
 * ELK Layout Plugin для G6 v5
 */
export class ELKLayout extends BaseLayout<ELKLayoutOptions> {
  id = 'elk-layout';
  
  private elk: typeof ELK.prototype;
  private elkOptions: Record<string, string>;
  private nodeSizes: Record<string, [number, number]>;

  constructor(context: RuntimeContext, options: ELKLayoutOptions = {} as ELKLayoutOptions) {
    super(context, options);
    this.elk = new ELK();
    this.elkOptions = options.elkOptions || DEFAULT_ELK_OPTIONS;
    this.nodeSizes = options.nodeSizes || NODE_SIZES;
  }

  /**
   * Основной метод - вызывается G6 для расчёта layout
   */
  async execute(model: GraphData, options?: ELKLayoutOptions): Promise<GraphData> {
    if (!model.nodes || model.nodes.length === 0) {
      return model;
    }

    console.log('[ELK-Plugin] Starting layout for', model.nodes.length, 'nodes');

    try {
      // 1. Конвертируем данные G6 в формат ELK
      const elkGraph = this.convertToElkFormat(model);

      // 2. Запускаем расчёт ELK
      const layoutedGraph = await this.elk.layout(elkGraph);

      // 3. Конвертируем результат обратно в формат G6
      const result = this.convertToG6Format(layoutedGraph, model);

      console.log('[ELK-Plugin] Layout complete');
      return result;
    } catch (error) {
      console.error('[ELK-Plugin] Error:', error);
      return model;
    }
  }

  /**
   * Конвертация G6 -> ELK формат
   */
  private convertToElkFormat(data: GraphData): any {
    const nodeIds = new Set(data.nodes!.map(n => n.id));

    // Фильтруем рёбра
    const validEdges = (data.edges || []).filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    // Подготавливаем узлы
    const elkNodes = data.nodes!.map(node => {
      const nodeType = ((node.data as any)?.type || 'load').toString().toLowerCase();
      const size = this.nodeSizes[nodeType] || [160, 80] as [number, number];
      const ports = this.getPortsForNode(node.id, nodeType);

      return {
        id: node.id,
        width: size[0],
        height: size[1],
        ports,
        layoutOptions: { 'portConstraints': 'FIXED_SIDE' },
      };
    });

    // Подготавливаем рёбра
    const elkEdges = validEdges.map(edge => ({
      id: edge.id || `${edge.source}-${edge.target}`,
      sources: [edge.source],
      targets: [edge.target],
      sourcePort: `${edge.source}_out`,
      targetPort: `${edge.target}_in`,
    }));

    return {
      id: 'root',
      layoutOptions: this.elkOptions,
      children: elkNodes,
      edges: elkEdges,
    };
  }

  /**
   * Определяет порты для узла
   */
  private getPortsForNode(nodeId: string, nodeType: string): any[] {
    if (nodeType === 'source') {
      return [{ id: `${nodeId}_out`, properties: { 'port.side': 'SOUTH' } }];
    }
    if (nodeType === 'load') {
      return [{ id: `${nodeId}_in`, properties: { 'port.side': 'NORTH' } }];
    }
    return [
      { id: `${nodeId}_in`, properties: { 'port.side': 'NORTH' } },
      { id: `${nodeId}_out`, properties: { 'port.side': 'SOUTH' } },
    ];
  }

  /**
   * Конвертация ELK -> G6 формат
   * КРИТИЧНО: G6 v5 ожидает координаты в style.x, style.y
   */
  private convertToG6Format(layoutedGraph: any, originalData: GraphData): GraphData {
    const layoutedNodes: any[] = layoutedGraph.children || [];
    const layoutedEdges: any[] = layoutedGraph.edges || [];
    
    // Логируем сырой результат ELK для отладки
    console.log('[ELK-Plugin] RAW result sample:', layoutedNodes.slice(0, 3).map((n: any) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
    })));
    
    const nodeMap = new Map(layoutedNodes.map((n) => [n.id, n]));

    // Обновляем узлы - КРИТИЧНО: x,y в style для G6 v5
    const updatedNodes = originalData.nodes!.map((originalNode, index) => {
      const layoutedNode = nodeMap.get(originalNode.id);
      
      if (layoutedNode && typeof layoutedNode.x === 'number' && typeof layoutedNode.y === 'number') {
        // ELK возвращает top-left, G6 ожидает center
        const centerX = layoutedNode.x + layoutedNode.width / 2;
        const centerY = layoutedNode.y + layoutedNode.height / 2;

        return {
          ...originalNode,
          // КРИТИЧНО для G6 v5: координаты в style
          style: {
            ...(originalNode.style as any || {}),
            x: centerX,
            y: centerY,
            size: [layoutedNode.width, layoutedNode.height] as [number, number],
          },
          data: {
            ...(originalNode.data as any || {}),
            width: layoutedNode.width,
            height: layoutedNode.height,
          },
        };
      }
      
      // Fallback если ELK не вернул координаты
      console.warn('[ELK-Plugin] No coords for node:', originalNode.id);
      return {
        ...originalNode,
        style: {
          ...(originalNode.style as any || {}),
          x: 100 * (index % 10),
          y: 100 * Math.floor(index / 10),
        },
      };
    });

    // Обновляем рёбра
    const updatedEdges = originalData.edges?.map(originalEdge => {
      const layoutedEdge = layoutedEdges.find((e) => 
        e.id === originalEdge.id ||
        (e.sources[0] === originalEdge.source && e.targets[0] === originalEdge.target)
      );

      if (layoutedEdge?.sections?.[0]?.bendPoints) {
        return {
          ...originalEdge,
          style: {
            ...(originalEdge.style as any || {}),
            controlPoints: layoutedEdge.sections[0].bendPoints.map((bp: any) => ({
              x: bp.x,
              y: bp.y,
            })),
          },
        };
      }
      return originalEdge;
    }) || [];

    console.log('[ELK-Plugin] Transformed nodes sample:', updatedNodes.slice(0, 3).map((n: any) => ({
      id: n.id,
      styleX: n.style?.x,
      styleY: n.style?.y,
    })));

    return { ...originalData, nodes: updatedNodes, edges: updatedEdges };
  }
}

// Регистрация layout
export function registerELKLayout() {
  register(ExtensionCategory.LAYOUT, 'elk-layout', ELKLayout);
  console.log('[ELK-Plugin] Registered as "elk-layout"');
}

export default ELKLayout;

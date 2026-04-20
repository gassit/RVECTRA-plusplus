import cytoscape from 'cytoscape';

declare module 'cytoscape-elk' {
  interface ElKLayoutOptions {
    name: 'elk';
    elk?: {
      'elk.algorithm'?: string;
      'elk.direction'?: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
      'elk.edgeRouting'?: 'ORTHOGONAL' | 'POLYLINE' | 'SPLINES' | 'UNDEFINED';
      'elk.nodePlacement.strategy'?: string;
      'elk.padding'?: string;
      'elk.spacing.nodeNode'?: number;
      'elk.spacing.nodeNodeBetweenLayers'?: number;
      'elk.spacing.edgeNode'?: number;
      'elk.spacing.edgeEdge'?: number;
      'elk.alignment.hierarchical'?: 'LEFT' | 'CENTER' | 'RIGHT';
      'elk.crossingMinimization.strategy'?: string;
      'elk.crossingMinimization.semiInteractive'?: boolean;
      'elk.compaction.postCompaction.strategy'?: string;
      'elk.hierarchyHandling'?: string;
      'elk.layered.nodePlacement.bk.fixedAlignment'?: string;
      'elk.nesting.ignored'?: boolean;
      'elk.layered.edgeRouting.orthogonalEdges'?: boolean;
      [key: string]: any;
    };
    fit?: boolean;
    padding?: number;
    animate?: boolean;
    animationDuration?: number;
    animationEasing?: string;
    ready?: () => void;
    stop?: () => void;
  }

  function elkLayout(cytoscape: cytoscape.Cytoscape): void;

  export = elkLayout;
  export as namespace elkLayout;
}

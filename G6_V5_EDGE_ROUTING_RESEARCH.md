# AntV G6 v5 Edge Routing - Comprehensive Research Report

## Executive Summary

This report documents comprehensive research on AntV G6 v5 edge routing mechanisms, including edge routers, anchor points, port configuration, and techniques for creating electrical schematic-style diagrams.

---

## 1. Edge Routing Mechanisms in G6 v5

### 1.1 Built-in Edge Types

G6 v5 provides several built-in edge types suitable for different routing needs:

| Edge Type | Description | Use Case |
|-----------|-------------|----------|
| `line` | Straight line between nodes | Simple connections |
| `polyline` | Multi-segment line with routing | Orthogonal routing |
| `quadratic` | Quadratic Bézier curve | Smooth curved connections |
| `cubic` | Cubic Bézier curve | Flow diagrams |
| `cubic-horizontal` | Horizontal cubic curve | Left-to-right flows |
| `cubic-vertical` | Vertical cubic curve | Top-to-bottom flows |

### 1.2 Router Configuration

G6 v5 supports router configuration within edge style:

```typescript
edge: {
  type: 'polyline',
  style: {
    router: { type: 'orth' },  // Orthogonal routing
    // ... other style properties
  }
}
```

**Available Router Types:**
- `orth` - Orthogonal routing (90° angles)
- `polyline` - Simple polyline routing

### 1.3 Complete Edge Configuration Example

```typescript
edge: {
  type: 'polyline',
  style: {
    // Router for orthogonal routing
    router: { type: 'orth' },
    
    // Basic styling
    stroke: '#94a3b8',
    lineWidth: 2,
    endArrow: false,
    opacity: 1,
    
    // Edge label configuration
    labelText: (d: any) => d.data?.label || '',
    labelFill: '#64748b',
    labelFontSize: 9,
    labelBackground: true,
    labelBackgroundFill: '#ffffff',
    labelBackgroundOpacity: 0.95,
    labelBackgroundRadius: 4,
    labelPadding: [2, 4, 2, 4],
    labelPlacement: 'center',
    
    // Z-index for layering (edges behind nodes)
    zIndex: 1,
  },
  state: {
    selected: {
      stroke: '#3b82f6',
      lineWidth: 4,
    },
    hover: {
      stroke: '#60a5fa',
      lineWidth: 3,
    },
  },
}
```

---

## 2. Polyline Edge Type and Control Points

### 2.1 Basic Polyline Configuration

```typescript
edge: {
  type: 'polyline',
  style: {
    // The router calculates control points automatically
    router: { type: 'orth' },
    
    // Optional: specify control points manually
    // controlPoints: [[x1, y1], [x2, y2], ...],
  }
}
```

### 2.2 How Polyline Routing Works

1. **Automatic Routing**: When `router: { type: 'orth' }` is specified, G6 calculates the optimal path with 90° angles
2. **Obstacle Avoidance**: The router attempts to route edges around nodes
3. **Anchor Points**: Edges connect to specific anchor points on nodes

### 2.3 Key Properties for Polyline Edges

```typescript
edge: {
  type: 'polyline',
  style: {
    router: { type: 'orth' },
    
    // Minimum distance from node to first bend
    // offset: 20,
    
    // Maximum number of bends (approximate)
    // max bends controlled by router algorithm
    
    // Radius for rounded corners at bends
    radius: 4,
  }
}
```

---

## 3. Anchor Points on Nodes

### 3.1 Defining Anchor Points

Anchor points define where edges can connect to a node. They are specified as relative coordinates [0-1, 0-1]:

```typescript
node: {
  style: {
    // Define anchor points
    anchorPoints: [
      [0.5, 0],   // Index 0: Top center
      [0.5, 1],   // Index 1: Bottom center
      [0, 0.5],   // Index 2: Left center
      [1, 0.5],   // Index 3: Right center
    ],
  }
}
```

### 3.2 Anchor Point Coordinate System

| Coordinate | Position | Description |
|------------|----------|-------------|
| `[0, 0]` | Top-left | Corner of node |
| `[0.5, 0]` | Top-center | Top middle |
| `[1, 0]` | Top-right | Corner of node |
| `[0, 0.5]` | Middle-left | Left side |
| `[0.5, 0.5]` | Center | Node center |
| `[1, 0.5]` | Middle-right | Right side |
| `[0, 1]` | Bottom-left | Corner of node |
| `[0.5, 1]` | Bottom-center | Bottom middle |
| `[1, 1]` | Bottom-right | Corner of node |

### 3.3 Anchor Points for Electrical Schematic Style

For vertical flow (electrical schematic style):

```typescript
node: {
  style: {
    anchorPoints: [
      [0.5, 0],   // Index 0: Top - for incoming connections (from source)
      [0.5, 1],   // Index 1: Bottom - for outgoing connections (to load)
    ],
  }
}
```

---

## 4. Specifying Edge Connection Side

### 4.1 Using sourceAnchor and targetAnchor

Edges can specify which anchor point to use:

```typescript
// In edge data
{
  id: 'edge-1',
  source: 'node-source',
  target: 'node-load',
  style: {
    // Specify anchor indices
    sourceAnchor: 1,  // Use anchor index 1 on source (bottom)
    targetAnchor: 0,  // Use anchor index 0 on target (top)
  }
}
```

### 4.2 Using Ports for Precise Control

For more precise control, use port configuration:

```typescript
// Node with ports
node: {
  style: {
    // Port radius
    portR: 4,
    
    // Connect port to node center
    portLinkToCenter: true,
    
    // Port positions are derived from anchorPoints
    anchorPoints: [
      [0.5, 0],   // Top port
      [0.5, 1],   // Bottom port
    ],
  }
}

// Edge referencing ports
edge: {
  source: 'node-1',
  target: 'node-2',
  sourcePort: 'top',     // Port key or ID
  targetPort: 'bottom',
}
```

---

## 5. Port Configuration in G6 v5

### 5.1 Basic Port Configuration

```typescript
node: {
  style: {
    // Port appearance
    portR: 4,                    // Port radius
    portFill: '#3b82f6',         // Port fill color
    portStroke: '#1e40af',       // Port stroke color
    portLineWidth: 1,            // Port stroke width
    
    // Port connection behavior
    portLinkToCenter: true,      // Connect port to node center
    
    // Define ports via anchorPoints
    anchorPoints: [
      [0.5, 0],   // Top
      [0.5, 1],   // Bottom
      [0, 0.5],   // Left
      [1, 0.5],   // Right
    ],
  }
}
```

### 5.2 Custom Port Definition

For more control, define ports explicitly:

```typescript
// In node data
{
  id: 'node-1',
  data: {
    ports: [
      { id: 'port-top', key: 'top', x: 0.5, y: 0 },
      { id: 'port-bottom', key: 'bottom', x: 0.5, y: 1 },
    ]
  }
}
```

### 5.3 Port-to-Parent Remapping

When using external layout engines (like ELK), ports may be returned as edge endpoints. Remapping is needed:

```typescript
// Build port-to-parent map for remapping
const portToParent = new Map<string, { nodeId: string; portKey: string }>();
data.nodes.forEach(node => {
  const ports = node.ports;
  if (Array.isArray(ports)) {
    ports.forEach((port) => {
      const portId = port.id || port.key;
      if (portId) {
        portToParent.set(portId, {
          nodeId: node.id,
          portKey: port.key || port.id,
        });
      }
    });
  }
});

// Remap edge endpoints
edges.map(edge => {
  let source = edge.source;
  let target = edge.target;
  
  // If source is a port ID, remap to parent node
  const srcPort = portToParent.get(source);
  if (srcPort) {
    source = srcPort.nodeId;
  }
  
  // If target is a port ID, remap to parent node  
  const tgtPort = portToParent.get(target);
  if (tgtPort) {
    target = tgtPort.nodeId;
  }
  
  return { ...edge, source, target };
});
```

---

## 6. Creating Electrical Schematic Style Diagrams

### 6.1 Key Design Principles

1. **Vertical Flow**: Power flows from top to bottom
2. **Orthogonal Routing**: All edges use 90° angles
3. **Consistent Anchor Points**: Top for input, bottom for output
4. **Clear Visual Hierarchy**: Source → Bus → Breaker → Load

### 6.2 Complete Configuration Example

```typescript
import { Graph } from '@antv/g6';

const graph = new Graph({
  container: document.getElementById('container'),
  width: 800,
  height: 600,
  autoFit: 'view',
  padding: [100, 100, 100, 100],
  
  node: {
    type: 'rect',
    style: {
      // Dynamic sizing based on node type
      size: (d: any) => {
        const type = d.data?.type || 'load';
        const sizes: Record<string, [number, number]> = {
          source: [160, 80],
          bus: [200, 40],
          breaker: [140, 70],
          meter: [140, 70],
          load: [160, 80],
          junction: [40, 40],
        };
        return sizes[type] || [160, 80];
      },
      
      // Visual styling
      fill: '#ffffff',
      stroke: '#e2e8f0',
      lineWidth: 2,
      radius: 6,
      
      // Critical: Anchor points for vertical flow
      anchorPoints: [
        [0.5, 0],   // Index 0: Top (input from source)
        [0.5, 1],   // Index 1: Bottom (output to load)
      ],
      
      // Port configuration
      portR: 4,
      portLinkToCenter: true,
      
      // Label
      labelText: (d: any) => d.data?.name || d.id,
      labelFill: '#000000',
      labelFontSize: 12,
      labelPlacement: 'center',
    },
  },
  
  edge: {
    type: 'polyline',
    style: {
      // Orthogonal routing for schematic style
      router: { type: 'orth' },
      
      // Styling
      stroke: '#94a3b8',
      lineWidth: 2,
      endArrow: false,
      
      // Labels for wire info
      labelText: (d: any) => {
        const wire = d.data?.wireType;
        const size = d.data?.wireSize;
        return wire && size ? `${wire} ${size}mm²` : '';
      },
      labelFill: '#64748b',
      labelFontSize: 9,
      labelBackground: true,
      labelBackgroundFill: '#ffffff',
      labelPlacement: 'center',
      
      // Layering
      zIndex: 1,
    },
  },
});
```

### 6.3 Integration with ELK Layout Engine

For automatic layout with proper edge routing:

```typescript
import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

async function computeLayout(nodes: any[], edges: any[]) {
  const elkGraph = {
    id: 'root',
    children: nodes.map(n => ({
      id: n.id,
      width: n.width || 160,
      height: n.height || 80,
    })),
    edges: edges.map(e => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',              // Top-to-bottom flow
      'elk.edgeRouting': 'ORTHOGONAL',      // 90° angle routing
      'elk.spacing.nodeNode': '30',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
    },
  };
  
  const result = await elk.layout(elkGraph);
  
  // Convert ELK top-left coordinates to G6 center coordinates
  const g6Nodes = result.children.map(child => ({
    id: child.id,
    style: {
      x: (child.x || 0) + (child.width || 0) / 2,
      y: (child.y || 0) + (child.height || 0) / 2,
    },
  }));
  
  return { nodes: g6Nodes, edges: result.edges };
}
```

---

## 7. Important Notes and Best Practices

### 7.1 G6 v5 vs v4 API Changes

G6 v5 has significant API changes from v4:

| v4 API | v5 API |
|--------|--------|
| `graph.findById()` | `graph.getNodeData()` / `graph.getEdgeData()` |
| `graph.updateItem()` | `graph.updateNodeData()` / `graph.updateEdgeData()` |
| `item.getModel()` | Direct data access via `getNodeData()` |
| `graph.refreshItem()` | Automatic - no manual refresh needed |

### 7.2 Node Size Consistency

**Critical**: Node sizes in layout engine (ELK) must match G6 node sizes exactly. Otherwise, edge routing may pass through nodes.

```typescript
// Define sizes in one place and use everywhere
export const NODE_SIZES: Record<string, { width: number; height: number }> = {
  source: { width: 160, height: 80 },
  bus: { width: 200, height: 40 },
  // ...
};
```

### 7.3 Edge Routing Limitations

1. **Router Algorithm**: G6 v5's built-in `orth` router handles basic orthogonal routing but doesn't do full pathfinding around obstacles
2. **For Complex Routing**: Consider using ELK for both node positioning AND edge routing
3. **Performance**: Large graphs with many edges may benefit from external layout calculation

### 7.4 Debugging Tips

```typescript
// Log edge data to debug routing issues
graph.on('edge:click', (evt) => {
  const edgeData = graph.getEdgeData(evt.target.id);
  console.log('Edge data:', edgeData);
});

// Visualize anchor points
node: {
  style: {
    anchorPoints: [[0.5, 0], [0.5, 1]],
    // Show ports for debugging
    portR: 6,
    portFill: 'red',
  }
}
```

---

## 8. References

- Official G6 v5 Documentation: https://g6.antv.antgroup.com/
- G6 GitHub Repository: https://github.com/antvis/G6
- ELK Layout Documentation: https://www.eclipse.org/elk/documentation.html
- DeepWiki G6 Documentation: https://deepwiki.com/antvis/G6

---

## 9. Summary

For electrical schematic-style diagrams in G6 v5:

1. **Use `polyline` edge type with `router: { type: 'orth' }`** for 90° angle routing
2. **Define anchor points** on nodes: top for input, bottom for output
3. **Configure ports** for precise edge connections
4. **Integrate with ELK** for automatic hierarchical layout with orthogonal edge routing
5. **Ensure size consistency** between layout engine and G6 rendering
6. **Use v5 APIs** (`getNodeData`, `getEdgeData`) instead of v4 APIs (`findById`, `getElementById`)

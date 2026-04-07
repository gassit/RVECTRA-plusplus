'use client';

import { useEffect, useRef, useState } from 'react';
import { Graph } from '@antv/g6';

export default function TestG6Page() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('init');

  useEffect(() => {
    if (!containerRef.current) return;

    setStatus('creating...');
    const container = containerRef.current;

    try {
      const graph = new Graph({
        container,
        width: 600,
        height: 400,
        data: {
          nodes: [
            { id: 'n1', style: { x: 100, y: 150, labelText: 'Node 1' } },
            { id: 'n2', style: { x: 300, y: 150, labelText: 'Node 2' } },
            { id: 'n3', style: { x: 200, y: 250, labelText: 'Node 3' } },
          ],
          edges: [
            { id: 'e1', source: 'n1', target: 'n2' },
            { id: 'e2', source: 'n2', target: 'n3' },
          ],
        },
        node: {
          type: 'circle',
          style: {
            size: 40,
            fill: '#91d5ff',
            stroke: '#1890ff',
            lineWidth: 2,
            labelText: (d: any) => d.style?.labelText || '',
          },
        },
        edge: {
          type: 'line',
          style: { stroke: '#1890ff', lineWidth: 2 },
        },
        behaviors: ['drag-canvas', 'zoom-canvas'],
      });

      graph.render()
        .then(() => setStatus('OK - Graph rendered!'))
        .catch((e: any) => setStatus('ERROR: ' + e.message));

    } catch (e: any) {
      setStatus('INIT ERROR: ' + e.message);
    }
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-lg font-bold mb-2">G6 v5 Test</h1>
      <div className="mb-2 text-sm">Status: {status}</div>
      <div
        ref={containerRef}
        style={{ width: 600, height: 400, border: '1px solid #ccc', background: '#fafafa' }}
      />
    </div>
  );
}

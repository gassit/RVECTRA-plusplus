/**
 * Прямой тест: ELK layout → G6 render (без браузера, с jsdom)
 * Цель: поймать точную ошибку рендеринга
 */
import { JSDOM } from 'jsdom';
import { PrismaClient } from '@prisma/client';
import { computeElkLayout } from '../src/lib/elk-engine.ts';
import { Graph } from '@antv/g6';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Загрузка данных из БД ===');
  
  const elements = await prisma.element.findMany({
    include: { DeviceSlot: { include: { Device: true } } }
  });
  const connections = await prisma.connection.findMany({
    include: { Cable: true }
  });
  
  console.log(`Элементов: ${elements.length}, Связей: ${connections.length}`);
  
  // ---- Трансформация как в page.tsx ----
  const cabinets = elements.filter(e => e.type === 'CABINET');
  const nonCabinetElements = elements.filter(e => e.type !== 'CABINET');
  
  const combos = cabinets.map(c => ({
    id: c.id,  // UUID!
    data: { name: c.name, type: 'cabinet', label: c.name }
  }));
  
  const nodes = nonCabinetElements.map(e => ({
    id: e.id,  // UUID! (не elementId!)
    type: e.type,
    name: e.name,
    combo: e.parentId || undefined,
    data: { ...e, type: e.type, name: e.name }
  }));
  
  const edges = connections.map(c => ({
    id: c.id,
    source: c.sourceId,   // UUID
    target: c.targetId,   // UUID
    data: {
      wireType: c.Cable?.name,
      wireSize: c.Cable?.section,
      length: c.Cable?.length,
    }
  }));
  
  console.log(`Nodes: ${nodes.length}, Edges: ${edges.length}, Combos: ${combos.length}`);
  
  const nodeIds = new Set(nodes.map(n => n.id));
  const validEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
  console.log(`Valid edges: ${validEdges.length} из ${edges.length}`);
  if (validEdges.length < edges.length) {
    const missingSources = edges.filter(e => !nodeIds.has(e.source)).map(e => e.source);
    const missingTargets = edges.filter(e => !nodeIds.has(e.target)).map(e => e.target);
    console.log(`  Missing sources: ${missingSources.length}, Missing targets: ${missingTargets.length}`);
    if (missingSources.length <= 5) console.log('  Sources:', missingSources);
    if (missingTargets.length <= 5) console.log('  Targets:', missingTargets);
  }
  
  // ---- ELK Layout ----
  console.log('\n=== ELK Layout ===');
  const layoutResult = await computeElkLayout(
    nodes.map(n => ({ id: n.id, type: n.type, data: n.data, combo: n.combo })),
    validEdges.map(e => ({ id: e.id, source: e.source, target: e.target, data: e.data }))
  );
  
  console.log(`ELK result: ${layoutResult.nodes.length} nodes, ${layoutResult.edges.length} edges, ${layoutResult.combos.length} combos`);
  
  // ---- Трансформация для G6 (как в NetworkGraphG6.tsx) ----
  const comboIds = new Set((layoutResult.combos || []).map(c => c.id));
  const elkMap = new Map(layoutResult.nodes.map(n => [n.id, n]));
  
  const g6Nodes = nodes
    .filter(node => !comboIds.has(node.id))
    .map(node => {
      const elk = elkMap.get(node.id);
      const type = (node.type || 'load').toLowerCase();
      const nx = elk?.x ?? 0;
      const ny = elk?.y ?? 0;
      const nw = elk?.width || 120;
      const nh = elk?.height || 60;
      return {
        id: node.id,
        x: nx,
        y: ny,
        combo: node.combo || undefined,
        data: { ...node.data, type },
        style: { size: [nw, nh] },
      };
    });
  
  const finalNodeIds = new Set(g6Nodes.map(n => n.id));
  
  // ВРЕМЕННО: type 'line' для диагностики (без polyline)
  const g6Edges = layoutResult.edges
    .filter(e => finalNodeIds.has(e.source) && finalNodeIds.has(e.target))
    .map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'line',
      data: {},
    }));
  
  const g6Combos = (layoutResult.combos || []).map(c => ({
    id: c.id,
    data: { name: c.label, type: 'CABINET', label: c.label },
    style: { x: c.x, y: c.y, width: c.width, height: c.height },
  }));
  
  console.log(`\n=== G6 Data ===`);
  console.log(`Nodes: ${g6Nodes.length}, Edges: ${g6Edges.length}, Combos: ${g6Combos.length}`);
  
  // Проверка координат
  const noCoords = g6Nodes.filter(n => !n.x || !n.y || (n.x === 0 && n.y === 0));
  console.log(`Nodes with (0,0): ${noCoords.length}`);
  
  // ---- G6: создаём граф с jsdom ----
  console.log('\n=== G6 Render Test (jsdom) ===');
  
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="container" style="width:1920px;height:1080px;"></div></body></html>');
  globalThis.DOMParser = dom.window.DOMParser;
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement;
  globalThis.CanvasRenderingContext2D = dom.window.CanvasRenderingContext2D;
  globalThis.Event = dom.window.Event;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.TouchEvent = dom.window.TouchEvent;
  globalThis.WheelEvent = dom.window.WheelEvent;
  globalThis.PointerEvent = dom.window.PointerEvent;
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  globalThis.cancelAnimationFrame = clearTimeout;
  globalThis.ResizeObserver = class ResizeObserver {
    constructor(cb) {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.IntersectionObserver = class IntersectionObserver {
    constructor(cb) {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.MutationObserver = class MutationObserver {
    constructor(cb) {}
    observe() {}
    disconnect() {}
  };
  globalThis.self = globalThis;
  globalThis.top = globalThis;
  globalThis.parent = globalThis;
  globalThis.frames = [];
  globalThis.length = 0;
  globalThis.navigator = { userAgent: 'node' };
  globalThis.location = { href: 'http://localhost' };
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.SVGElement = dom.window.SVGElement;
  globalThis.Image = dom.window.Image;
  globalThis.AudioContext = class {};
  globalThis.WebGLRenderingContext = class {};
  
  // Mock getComputedStyle
  globalThis.getComputedStyle = (el) => ({
    getPropertyValue: () => '',
    setProperty: () => '',
  });
  
  const container = dom.window.document.getElementById('container');
  
  try {
    const graph = new Graph({
      container: container,
      width: 1920,
      height: 1080,
      autoFit: 'view',
      padding: [100, 100, 100, 100],
      node: {
        type: 'rect',
        style: {
          size: (d) => d.style?.size || [120, 60],
          fill: '#ffffff',
          stroke: '#e2e8f0',
          lineWidth: 2,
          labelText: (d) => d.data?.name || d.id,
          labelPlacement: 'center',
          radius: 6,
        },
      },
      edge: {
        type: 'line',
        style: {
          stroke: '#94a3b8',
          lineWidth: 2,
        },
      },
      combo: {
        type: 'rect',
        style: {
          radius: 8,
          fill: '#f8fafc',
          stroke: '#d97706',
          lineWidth: 2,
          lineDash: [5, 5],
          labelText: (d) => d.data?.name || '',
          labelPlacement: 'top',
        },
      },
    });
    
    console.log('Graph created');
    
    // setData
    console.log('\n--- setData ---');
    try {
      graph.setData({
        nodes: g6Nodes,
        edges: g6Edges,
        combos: g6Combos,
      });
      console.log('✅ setData OK');
    } catch (e) {
      console.error('❌ setData FAILED:');
      console.error('  message:', e?.message);
      console.error('  stack:', e?.stack?.split('\n').slice(0, 10).join('\n'));
      console.error('  type:', typeof e);
      console.error('  name:', e?.constructor?.name);
      if (e && typeof e === 'object') console.error('  keys:', Object.keys(e));
      throw e;
    }
    
    // render
    console.log('\n--- render ---');
    try {
      await graph.render();
      console.log('✅ render OK');
    } catch (e) {
      console.error('❌ render FAILED:');
      console.error('  message:', e?.message);
      console.error('  stack:', e?.stack?.split('\n').slice(0, 15).join('\n'));
      console.error('  type:', typeof e);
      console.error('  name:', e?.constructor?.name);
      if (e && typeof e === 'object') console.error('  keys:', Object.keys(e));
      throw e;
    }
    
    // fitView
    console.log('\n--- fitView ---');
    try {
      graph.fitView();
      console.log('✅ fitView OK');
    } catch (e) {
      console.warn('⚠️ fitView warning:', e?.message);
    }
    
    console.log('\n=== SUCCESS ===');
    graph.destroy();
    
  } catch (err) {
    console.error('\n=== FATAL ERROR ===');
    console.error('Full error:', err);
    if (err instanceof Error) {
      console.error('Stack:', err.stack);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Top-level error:', e);
  prisma.$disconnect();
  process.exit(1);
});

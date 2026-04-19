/**
 * Служба расчета позиций элементов на схеме
 * 
 * СТРУКТУРА ВНУТРИ ШКАФА:
 * - ВВОДНЫЕ над шинами
 * - ШИНЫ на одной линии
 * - ОТХОДЯЩИЕ колонкой под шиной
 */

interface LayoutElement {
  id: string;
  elementId: string;
  name: string;
  type: string;
  parentId: string | null;
}

interface LayoutConnection {
  id: string;
  sourceId: string;
  targetId: string;
}

interface Position { x: number; y: number; }

interface EdgeOffset {
  connectionId: string;
  offset: number;
  controlPoints: Array<{ x: number; y: number }>;
}

interface LayoutResult {
  positions: Map<string, Position>;
  cabinetBounds: Map<string, { x: number; y: number; width: number; height: number; name: string }>;
  edgeOffsets: Map<string, EdgeOffset>;
}

const GRID = 40;
const NODE_W = 80;
const H_SPACING = 60;
const V_SPACING = 90;
const BUS_W = 120;
const BUS_GAP = 180;
const CABINET_PAD = 80;           // Увеличен для большего отступа внутри
const CABINET_GAP = 100;          // Увеличен для большего расстояния между шкафами
const MARGIN = 80;

function isType(type: string, check: string): boolean {
  return type.toLowerCase() === check.toLowerCase();
}

function extractBusSection(name: string): string | null {
  const match = name.match(/(\d+)\s*с\.ш\./i);
  return match ? match[1] : null;
}

function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

function calcCP(sx: number, sy: number, tx: number, ty: number, offset: number) {
  const midY = Math.min(sy, ty) + Math.abs(ty - sy) / 2;
  return [
    { x: sx, y: sy },
    { x: sx, y: midY + offset },
    { x: tx, y: midY + offset },
    { x: tx, y: ty },
  ];
}

export function calculateLayout(elements: LayoutElement[], connections: LayoutConnection[]): LayoutResult {
  const positions = new Map<string, Position>();
  const cabinetBounds = new Map<string, { x: number; y: number; width: number; height: number; name: string }>();
  const edgeOffsets = new Map<string, EdgeOffset>();

  const cabinets = elements.filter(e => isType(e.type, 'cabinet'));
  const nonCabinets = elements.filter(e => !isType(e.type, 'cabinet'));
  const sources = nonCabinets.filter(e => isType(e.type, 'source'));
  const cabinetNames = new Map(cabinets.map(c => [c.id, c.name]));

  const groups = new Map<string | null, LayoutElement[]>();
  for (const el of nonCabinets) {
    if (!groups.has(el.parentId)) groups.set(el.parentId, []);
    groups.get(el.parentId)!.push(el);
  }

  let currentX = MARGIN, currentY = MARGIN;

  // SOURCE
  for (let i = 0; i < sources.length; i++) {
    positions.set(sources[i].id, { x: snap(currentX + i * (NODE_W + H_SPACING)), y: snap(currentY) });
  }
  if (sources.length > 0) currentY += V_SPACING * 2;

  // ШКАФ
  function layoutCabinet(elems: LayoutElement[], startX: number, startY: number) {
    // Локальные позиции только для этого шкафа
    const localPositions = new Map<string, Position>();
    
    const buses = elems.filter(e => isType(e.type, 'bus')).sort((a, b) => a.name.localeCompare(b.name));
    const breakers = elems.filter(e => isType(e.type, 'breaker'));
    const meters = elems.filter(e => isType(e.type, 'meter'));
    const junctions = elems.filter(e => isType(e.type, 'junction'));
    const loads = elems.filter(e => isType(e.type, 'load'));
    const others = elems.filter(e => !['bus', 'breaker', 'meter', 'junction', 'load', 'source'].some(t => isType(e.type, t)));

    const busIds = new Set(buses.map(b => b.id));

    // === ШИНЫ ===
    const yBus = startY + V_SPACING;
    const busPos = new Map<string, Position>();
    
    let x = startX;
    for (const bus of buses) {
      const pos = { x: snap(x), y: snap(yBus) };
      localPositions.set(bus.id, pos);
      positions.set(bus.id, pos);
      busPos.set(bus.id, pos);
      x += BUS_W + BUS_GAP;
    }
    const maxX_bus = x;

    // === ВВОДНЫЕ (по связям к шинам) ===
    const yInc = yBus - V_SPACING;
    const incByBus = new Map<string, LayoutElement[]>();
    
    for (const bus of buses) incByBus.set(bus.id, []);
    
    for (const br of breakers) {
      const conn = connections.find(c => c.sourceId === br.id && busIds.has(c.targetId));
      if (conn) {
        incByBus.get(conn.targetId)!.push(br);
      }
    }

    for (const bus of buses) {
      const bp = busPos.get(bus.id)!;
      const incs = (incByBus.get(bus.id) || []).sort((a, b) => a.name.localeCompare(b.name));
      
      const totalW = incs.length * (NODE_W + H_SPACING * 0.5) - H_SPACING * 0.5;
      let startX = bp.x - totalW / 2;
      
      for (let i = 0; i < incs.length; i++) {
        const pos = { x: snap(startX + i * (NODE_W + H_SPACING * 0.5)), y: snap(yInc) };
        localPositions.set(incs[i].id, pos);
        positions.set(incs[i].id, pos);
      }
    }

    // === ОТХОДЯЩИЕ (по связям ОТ шин) ===
    const yOut = yBus + V_SPACING;
    const outByBus = new Map<string, LayoutElement[]>();
    
    for (const bus of buses) outByBus.set(bus.id, []);
    
    for (const br of breakers) {
      if (localPositions.has(br.id)) continue;
      const conn = connections.find(c => c.targetId === br.id && busIds.has(c.sourceId));
      if (conn) {
        outByBus.get(conn.sourceId)!.push(br);
      } else {
        // По имени секции
        const sec = extractBusSection(br.name);
        const bus = buses.find(b => extractBusSection(b.name) === sec);
        if (bus) outByBus.get(bus.id)!.push(br);
      }
    }
    
    for (const m of meters) {
      const sec = extractBusSection(m.name);
      const bus = buses.find(b => extractBusSection(b.name) === sec);
      if (bus) outByBus.get(bus.id)!.push(m);
    }
    
    for (const j of junctions) {
      const sec = extractBusSection(j.name);
      const bus = buses.find(b => extractBusSection(b.name) === sec);
      if (bus) outByBus.get(bus.id)!.push(j);
    }

    // Размещаем отходящие колонкой под шиной
    let maxY = yBus;
    
    for (const bus of buses) {
      const bp = busPos.get(bus.id)!;
      const outs = (outByBus.get(bus.id) || [])
        .filter(e => !localPositions.has(e.id))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      let outY = yOut;
      
      for (const el of outs) {
        const pos = { x: bp.x, y: snap(outY) };
        localPositions.set(el.id, pos);
        positions.set(el.id, pos);
        outY += V_SPACING * 0.7;
      }
      
      maxY = Math.max(maxY, outY);
    }

    // LOAD и прочие
    let yOther = maxY + V_SPACING;
    let xOther = startX;
    
    for (const el of [...loads, ...others]) {
      if (!localPositions.has(el.id)) {
        const pos = { x: snap(xOther), y: snap(yOther) };
        localPositions.set(el.id, pos);
        positions.set(el.id, pos);
        xOther += NODE_W + H_SPACING;
      }
    }

    // Вычисляем границы ТОЛЬКО по локальным позициям
    const allX = Array.from(localPositions.values()).map(p => p.x);
    const allY = Array.from(localPositions.values()).map(p => p.y);
    
    const minX = Math.min(...allX, startX);
    const maxX = Math.max(...allX, maxX_bus) + NODE_W;
    const minY = Math.min(...allY, yInc);
    const finalMaxY = Math.max(...allY, maxY) + V_SPACING;

    return { 
      minX,
      maxX, 
      minY,
      maxY: finalMaxY,
      width: maxX - minX + CABINET_PAD,
      height: finalMaxY - minY + CABINET_PAD
    };
  }

  // КОРНЕВЫЕ
  const roots = groups.get(null) || [];
  groups.delete(null);
  
  const sortedRoots = roots.filter(e => !positions.has(e.id)).sort((a, b) => {
    const o: Record<string, number> = { source: 0, junction: 1, breaker: 2, bus: 3, meter: 4, load: 5 };
    return (o[a.type.toLowerCase()] || 6) - (o[b.type.toLowerCase()] || 6);
  });

  if (sortedRoots.length > 0) {
    let x = currentX, y = currentY;
    for (const el of sortedRoots) {
      positions.set(el.id, { x: snap(x), y: snap(y) });
      x += NODE_W + H_SPACING;
      if (x > 800) { x = currentX; y += V_SPACING; }
    }
    currentY = y + V_SPACING * 2;
  }

  // ШКАФЫ
  const sortedCabs = [...groups.entries()]
    .filter((e): e is [string, LayoutElement[]] => e[0] !== null)
    .sort((a, b) => (cabinetNames.get(a[0]) || '').localeCompare(cabinetNames.get(b[0]) || ''));

  let globalMaxY = currentY;

  for (const [cid, celems] of sortedCabs) {
    const res = layoutCabinet(celems, currentX, currentY);
    
    cabinetBounds.set(cid, {
      x: res.minX - CABINET_PAD / 2,
      y: res.minY - CABINET_PAD / 2,
      width: res.width,
      height: res.height,
      name: cabinetNames.get(cid) || 'Cabinet'
    });

    globalMaxY = Math.max(globalMaxY, res.maxY);
    currentX = res.maxX + CABINET_GAP;  // Следующий шкаф начинается после границ текущего

    if (currentX > 1400) {
      currentX = MARGIN;
      currentY = globalMaxY + CABINET_GAP;
    }
  }

  // ORPHANS
  const orphans = nonCabinets.filter(e => !positions.has(e.id));
  if (orphans.length > 0) {
    let x = MARGIN, y = globalMaxY + V_SPACING * 2;
    for (const el of orphans) {
      positions.set(el.id, { x: snap(x), y: snap(y) });
      x += NODE_W + H_SPACING;
      if (x > 1000) { x = MARGIN; y += V_SPACING; }
    }
  }

  // EDGES
  const edgeGroups = new Map<string, LayoutConnection[]>();
  for (const c of connections) {
    const k = `${c.sourceId}-${c.targetId}`;
    if (!edgeGroups.has(k)) edgeGroups.set(k, []);
    edgeGroups.get(k)!.push(c);
  }

  for (const [, conns] of edgeGroups) {
    conns.forEach((c, i) => {
      const offset = (i - (conns.length - 1) / 2) * 20;
      const s = positions.get(c.sourceId), t = positions.get(c.targetId);
      if (s && t) {
        edgeOffsets.set(c.id, { connectionId: c.id, offset, controlPoints: calcCP(s.x, s.y, t.x, t.y, offset) });
      }
    });
  }

  return { positions, cabinetBounds, edgeOffsets };
}

export async function saveLayoutPositions(positions: Map<string, Position>, prisma: any): Promise<number> {
  let u = 0;
  const ups: Promise<void>[] = [];
  for (const [id, p] of positions) {
    ups.push(prisma.element.update({ where: { id }, data: { posX: p.x, posY: p.y } }).then(() => u++).catch(() => {}));
    if (ups.length >= 50) { await Promise.all(ups); ups.length = 0; }
  }
  await Promise.all(ups);
  return u;
}

export function getLayoutRules(): string {
  return '# Вводные над шинами, Шины на линии, Отходящие колонкой';
}

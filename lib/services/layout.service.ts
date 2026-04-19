/**
 * Служба расчета позиций элементов на схеме
 * 
 * ПРАВИЛА ПОЗИЦИОНИРОВАНИЯ (по промту однолинейной схемы):
 * ====================================
 * 
 * 1. ГЛОБАЛЬНАЯ СТРУКТУРА:
 *    - SOURCE (желтые шестиугольники) — только на самом верху схемы
 *    - CABINET (пунктирные прямоугольники) — основная часть
 *    - LOAD — в нижней части схемы
 * 
 * 2. ТОПОЛОГИЯ ВНУТРИ ШКАФА (CABINET):
 *    - Уровень Шин: BUS на одной горизонтальной линии (центр шкафа)
 *    - Над шинами: вводные BREAKER
 *    - Под шинами: отходящие BREAKER, METER, JUNCTION
 *    - Секционные BREAKER: горизонтально между соседними шинами
 * 
 * 3. ГРУППИРОВКА:
 *    - Автоматы группируются по имени шины (1 с.ш., 2 с.ш. и т.д.)
 *    - Плотная компоновка внутри шкафов
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

interface Position {
  x: number;
  y: number;
}

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

// ============== КОНСТАНТЫ ==============
const GRID = 40;                   // Шаг сетки
const NODE_W = 80;                 // Ширина узла
const NODE_H = 50;                 // Высота узла
const H_SPACING = 60;              // Горизонтальный отступ (увеличен)
const V_SPACING = 90;              // Вертикальный отступ (увеличен)
const BUS_W = 120;                 // Ширина шины
const BUS_H = 25;                  // Высота шины
const BUS_GAP = 180;               // Отступ между шинами (увеличен для колонок)
const CABINET_PAD = 60;            // Отступ внутри шкафа (увеличен)
const CABINET_GAP = 80;            // Отступ между шкафами (увеличен)
const MARGIN = 60;                 // Отступ от краёв

/**
 * Проверка типа элемента
 */
function isType(type: string, checkType: string): boolean {
  return type.toLowerCase() === checkType.toLowerCase();
}

/**
 * Извлечь номер секции/шины из названия элемента
 * Например: "QF1.1 1 с.ш. ГРЩ1" -> "1"
 */
function extractBusSection(name: string): string | null {
  const match = name.match(/(\d+)\s*с\.ш\./i);
  return match ? match[1] : null;
}

/**
 * Вычислить контрольные точки для ортогональной линии
 */
function calculateControlPoints(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
  offset: number
): Array<{ x: number; y: number }> {
  const midY = Math.min(sourceY, targetY) + Math.abs(targetY - sourceY) / 2;
  
  return [
    { x: sourceX, y: sourceY },
    { x: sourceX, y: midY + offset },
    { x: targetX, y: midY + offset },
    { x: targetX, y: targetY },
  ];
}

/**
 * Главная функция расчета позиций для всех элементов
 */
export function calculateLayout(
  elements: LayoutElement[],
  connections: LayoutConnection[]
): LayoutResult {
  const positions = new Map<string, Position>();
  const cabinetBounds = new Map<string, { x: number; y: number; width: number; height: number; name: string }>();
  const edgeOffsets = new Map<string, EdgeOffset>();

  // Разделяем элементы
  const cabinets = elements.filter(e => isType(e.type, 'cabinet'));
  const nonCabinets = elements.filter(e => !isType(e.type, 'cabinet'));
  const sources = nonCabinets.filter(e => isType(e.type, 'source'));
  
  const cabinetNames = new Map(cabinets.map(c => [c.id, c.name]));
  const cabinetIds = new Set(cabinets.map(c => c.id));

  // Группируем по parentId
  const groups = new Map<string | null, LayoutElement[]>();
  for (const el of nonCabinets) {
    const key = el.parentId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(el);
  }

  let currentX = MARGIN;
  let currentY = MARGIN;

  // ================== SOURCE (вверху) ==================
  if (sources.length > 0) {
    for (let i = 0; i < sources.length; i++) {
      positions.set(sources[i].id, {
        x: Math.round((currentX + i * (NODE_W + H_SPACING)) / GRID) * GRID,
        y: Math.round(currentY / GRID) * GRID
      });
    }
    currentY += V_SPACING * 2;
  }

  // ================== ФУНКЦИЯ РАЗМЕЩЕНИЯ ШКАФА ==================
  function layoutCabinet(
    cabinetElements: LayoutElement[],
    startX: number,
    startY: number
  ): { maxX: number; maxY: number } {
    
    const buses = cabinetElements.filter(e => isType(e.type, 'bus'));
    const breakers = cabinetElements.filter(e => isType(e.type, 'breaker'));
    const meters = cabinetElements.filter(e => isType(e.type, 'meter'));
    const junctions = cabinetElements.filter(e => isType(e.type, 'junction'));
    const loads = cabinetElements.filter(e => isType(e.type, 'load'));
    const others = cabinetElements.filter(e => 
      !isType(e.type, 'bus') && !isType(e.type, 'breaker') && 
      !isType(e.type, 'meter') && !isType(e.type, 'junction') && 
      !isType(e.type, 'load') && !isType(e.type, 'source')
    );

    // ===== 1. ШИНЫ - на одной линии =====
    const busY = startY + V_SPACING;
    const sortedBuses = [...buses].sort((a, b) => {
      const sA = extractBusSection(a.name) || '0';
      const sB = extractBusSection(b.name) || '0';
      return sA.localeCompare(sB);
    });
    
    let busX = startX;
    const busPositions = new Map<string, Position>();
    const busSections = new Map<string, string>(); // id -> section
    
    for (const bus of sortedBuses) {
      const section = extractBusSection(bus.name) || '0';
      busSections.set(bus.id, section);
      
      const pos = {
        x: Math.round(busX / GRID) * GRID,
        y: Math.round(busY / GRID) * GRID
      };
      positions.set(bus.id, pos);
      busPositions.set(bus.id, pos);
      busX += BUS_W + BUS_GAP;
    }

    // ===== 2. ГРУППИРУЕМ ЭЛЕМЕНТЫ ПО СЕКЦИЯМ ШИН =====
    const bySection = new Map<string, { incoming: LayoutElement[]; outgoing: LayoutElement[] }>();
    
    // Инициализируем секции
    for (const bus of sortedBuses) {
      const section = busSections.get(bus.id)!;
      bySection.set(section, { incoming: [], outgoing: [] });
    }
    bySection.set('unknown', { incoming: [], outgoing: [] });

    // Функция определения секции элемента
    function getSection(el: LayoutElement): string {
      const nameSection = extractBusSection(el.name);
      if (nameSection && bySection.has(nameSection)) {
        return nameSection;
      }
      return 'unknown';
    }

    // Распределяем выключатели
    for (const br of breakers) {
      const section = getSection(br);
      const name = br.name.toLowerCase();
      
      // Определяем тип: вводной (QF1, QF2, QF3 на верхнем уровне) или отходящий
      const isIncoming = name.includes('qf1 ') || name.includes('qf2 ') || name.includes('qf3 ') ||
                         name.match(/^qf[123]\s/i) || name.includes('вводной');
      
      if (isIncoming) {
        bySection.get(section)!.incoming.push(br);
      } else {
        bySection.get(section)!.outgoing.push(br);
      }
    }

    // Распределяем meters и junctions
    for (const m of meters) {
      const section = getSection(m);
      bySection.get(section)!.outgoing.push(m);
    }
    
    for (const j of junctions) {
      const section = getSection(j);
      bySection.get(section)!.outgoing.push(j);
    }

    // ===== 3. РАЗМЕЩАЕМ ВВОДНЫЕ (над шинами) =====
    const incomingY = busY - V_SPACING;
    
    for (const bus of sortedBuses) {
      const section = busSections.get(bus.id)!;
      const busPos = busPositions.get(bus.id)!;
      const incoming = bySection.get(section)!.incoming.sort((a, b) => a.name.localeCompare(b.name));
      
      let x = busPos.x - (incoming.length - 1) * (NODE_W + H_SPACING * 0.5) / 2;
      
      for (const el of incoming) {
        positions.set(el.id, {
          x: Math.round(x / GRID) * GRID,
          y: Math.round(incomingY / GRID) * GRID
        });
        x += NODE_W + H_SPACING * 0.5;
      }
    }

    // ===== 4. РАЗМЕЩАЕМ ОТХОДЯЩИЕ (под шинами) =====
    const outgoingY = busY + V_SPACING;
    
    for (const bus of sortedBuses) {
      const section = busSections.get(bus.id)!;
      const busPos = busPositions.get(bus.id)!;
      const outgoing = bySection.get(section)!.outgoing.sort((a, b) => a.name.localeCompare(b.name));
      
      // Размещаем в несколько рядов если много элементов
      const perRow = Math.ceil(Math.sqrt(outgoing.length));
      let x = busPos.x - (Math.min(outgoing.length, perRow) - 1) * (NODE_W + H_SPACING * 0.3) / 2;
      let y = outgoingY;
      let count = 0;
      
      for (const el of outgoing) {
        positions.set(el.id, {
          x: Math.round(x / GRID) * GRID,
          y: Math.round(y / GRID) * GRID
        });
        x += NODE_W + H_SPACING * 0.3;
        count++;
        
        if (count >= perRow) {
          count = 0;
          x = busPos.x - (Math.min(outgoing.length - count, perRow) - 1) * (NODE_W + H_SPACING * 0.3) / 2;
          y += V_SPACING;
        }
      }
    }

    // ===== 5. РАЗМЕЩАЕМ LOAD =====
    const loadY = outgoingY + V_SPACING * 3;
    let loadX = startX;
    
    for (const load of loads) {
      if (!positions.has(load.id)) {
        positions.set(load.id, {
          x: Math.round(loadX / GRID) * GRID,
          y: Math.round(loadY / GRID) * GRID
        });
        loadX += NODE_W + H_SPACING;
      }
    }

    // ===== 6. РАЗМЕЩАЕМ ПРОЧИЕ =====
    const otherY = loadY + V_SPACING;
    let otherX = startX;
    
    for (const el of others) {
      if (!positions.has(el.id)) {
        positions.set(el.id, {
          x: Math.round(otherX / GRID) * GRID,
          y: Math.round(otherY / GRID) * GRID
        });
        otherX += NODE_W + H_SPACING;
      }
    }

    // Вычисляем границы
    const allX = Array.from(positions.values()).map(p => p.x);
    const allY = Array.from(positions.values()).map(p => p.y);
    
    const maxX = Math.max(...allX, busX) + NODE_W + CABINET_PAD;
    const maxY = Math.max(...allY, outgoingY + V_SPACING * 2) + CABINET_PAD;

    return { maxX, maxY };
  }

  // ================== КОРНЕВЫЕ ЭЛЕМЕНТЫ ==================
  const rootElements = groups.get(null) || [];
  groups.delete(null);

  // Сортируем root элементы по типу
  const sortedRoots = rootElements
    .filter(e => !positions.has(e.id))
    .sort((a, b) => {
      const order = { source: 0, junction: 1, breaker: 2, bus: 3, meter: 4, load: 5 };
      const oA = order[a.type.toLowerCase() as keyof typeof order] ?? 6;
      const oB = order[b.type.toLowerCase() as keyof typeof order] ?? 6;
      return oA - oB;
    });

  if (sortedRoots.length > 0) {
    let x = currentX;
    let y = currentY;
    
    for (const el of sortedRoots) {
      positions.set(el.id, {
        x: Math.round(x / GRID) * GRID,
        y: Math.round(y / GRID) * GRID
      });
      x += NODE_W + H_SPACING;
      
      if (x > 800) {
        x = currentX;
        y += V_SPACING;
      }
    }
    currentY = y + V_SPACING * 2;
  }

  // ================== РАЗМЕЩАЕМ ШКАФЫ ==================
  const sortedCabinets = [...groups.entries()]
    .filter((entry): entry is [string, LayoutElement[]] => entry[0] !== null)
    .sort((a, b) => {
      const nameA = cabinetNames.get(a[0]) || '';
      const nameB = cabinetNames.get(b[0]) || '';
      return nameA.localeCompare(nameB);
    });

  let globalMaxY = currentY;

  for (const [cabinetId, cabinetElements] of sortedCabinets) {
    const result = layoutCabinet(cabinetElements, currentX, currentY);
    
    const cabinetName = cabinetNames.get(cabinetId) || 'Cabinet';
    cabinetBounds.set(cabinetId, {
      x: currentX - CABINET_PAD / 2,
      y: currentY - CABINET_PAD / 2,
      width: result.maxX - currentX + CABINET_PAD,
      height: result.maxY - currentY + CABINET_PAD,
      name: cabinetName
    });

    globalMaxY = Math.max(globalMaxY, result.maxY);
    currentX = result.maxX + CABINET_GAP;

    if (currentX > 1200) {
      currentX = MARGIN;
      currentY = globalMaxY + CABINET_GAP;
    }
  }

  // ================== LOAD ВНЕ ШКАФОВ ==================
  const orphanLoads = nonCabinets.filter(e => isType(e.type, 'load') && !positions.has(e.id));
  if (orphanLoads.length > 0) {
    let x = MARGIN;
    const y = globalMaxY + V_SPACING;
    
    for (const load of orphanLoads) {
      positions.set(load.id, {
        x: Math.round(x / GRID) * GRID,
        y: Math.round(y / GRID) * GRID
      });
      x += NODE_W + H_SPACING;
    }
    globalMaxY = y + V_SPACING;
  }

  // ================== НЕРАЗМЕЩЁННЫЕ ==================
  const unpositioned = nonCabinets.filter(e => !positions.has(e.id));
  if (unpositioned.length > 0) {
    let x = MARGIN;
    let y = globalMaxY + V_SPACING * 2;
    
    for (const el of unpositioned) {
      positions.set(el.id, {
        x: Math.round(x / GRID) * GRID,
        y: Math.round(y / GRID) * GRID
      });
      x += NODE_W + H_SPACING;
      if (x > 1000) {
        x = MARGIN;
        y += V_SPACING;
      }
    }
  }

  // ================== СМЕЩЕНИЯ ДЛЯ ЛИНИЙ ==================
  const edgeGroups = new Map<string, LayoutConnection[]>();
  for (const conn of connections) {
    const key = `${conn.sourceId}-${conn.targetId}`;
    if (!edgeGroups.has(key)) edgeGroups.set(key, []);
    edgeGroups.get(key)!.push(conn);
  }

  for (const [, conns] of edgeGroups) {
    conns.forEach((conn, index) => {
      const offset = (index - (conns.length - 1) / 2) * 20;
      const sourcePos = positions.get(conn.sourceId);
      const targetPos = positions.get(conn.targetId);
      
      if (sourcePos && targetPos) {
        edgeOffsets.set(conn.id, {
          connectionId: conn.id,
          offset,
          controlPoints: calculateControlPoints(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y, offset)
        });
      }
    });
  }

  return { positions, cabinetBounds, edgeOffsets };
}

/**
 * Сохранение позиций в БД
 */
export async function saveLayoutPositions(
  positions: Map<string, Position>,
  prisma: any
): Promise<number> {
  let updated = 0;
  const updates = [];
  
  for (const [id, pos] of positions) {
    updates.push(
      prisma.element.update({
        where: { id },
        data: { posX: pos.x, posY: pos.y }
      }).then(() => { updated++; })
      .catch((e: Error) => console.error(`Failed to update ${id}:`, e.message))
    );

    if (updates.length >= 50) {
      await Promise.all(updates);
      updates.length = 0;
    }
  }

  await Promise.all(updates);
  return updated;
}

/**
 * Экспорт правил
 */
export function getLayoutRules(): string {
  return `
# ПРАВИЛА ПОЗИЦИОНИРОВАНИЯ

## Глобальная структура
- SOURCE (вверху) → CABINET (центр) → LOAD (низ)

## Внутри шкафа
- BUS на одной горизонтальной линии
- Вводные BREAKER над шинами
- Отходящие BREAKER/METER/JUNCTION под шинами
- Группировка по секциям шин (1 с.ш., 2 с.ш. и т.д.)
`;
}

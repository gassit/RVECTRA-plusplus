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
 *    - Под шинами: отходящие BREAKER, METER
 *    - Секционные BREAKER: горизонтально между соседними шинами
 * 
 * 3. ГРУППИРОВКА:
 *    - Автоматы, питающие одну шину, сгруппированы вплотную
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
const GRID_STEP = 60;
const NODE_WIDTH = 100;
const NODE_HEIGHT = 60;
const NODE_SPACING = 50;
const BUS_WIDTH = 150;
const BUS_HEIGHT = 30;
const BUS_SPACING = 100;
const LAYER_VERTICAL = 120;
const CABINET_PADDING = 60;
const CABINET_MARGIN = 80;
const CANVAS_MARGIN = 100;
const EDGE_SPACING = 30;

/**
 * Проверка типа элемента
 */
function isType(type: string, checkType: string): boolean {
  return type.toLowerCase() === checkType.toLowerCase();
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
 * Определить роль выключателя на основе связей
 */
type BreakerRole = 'INCOMING' | 'SECTIONAL' | 'OUTGOING' | 'UNKNOWN';

function getBreakerRole(
  breaker: LayoutElement,
  busElements: LayoutElement[],
  connections: LayoutConnection[],
  allElements: LayoutElement[],
  positions: Map<string, Position>
): BreakerRole {
  const busIds = new Set(busElements.map(b => b.id));
  
  // Находим все связи выключателя
  const sourcesToBreaker = connections.filter(c => c.targetId === breaker.id).map(c => c.sourceId);
  const targetsFromBreaker = connections.filter(c => c.sourceId === breaker.id).map(c => c.targetId);
  
  // Проверяем, соединяет ли выключатель две шины (секционный)
  const sourceIsBus = sourcesToBreaker.some(id => busIds.has(id));
  const targetIsBus = targetsFromBreaker.some(id => busIds.has(id));
  
  if (sourceIsBus && targetIsBus) {
    return 'SECTIONAL';
  }
  
  // Проверяем по уровню в схеме
  // Если связь идет от SOURCE или от элемента без позиции - вводной
  const hasSourceConnection = sourcesToBreaker.some(id => {
    const el = allElements.find(e => e.id === id);
    return el && isType(el.type, 'source');
  });
  
  if (hasSourceConnection) {
    return 'INCOMING';
  }
  
  // Если связь идет от шины - отходящий
  if (sourceIsBus) {
    return 'OUTGOING';
  }
  
  // Если связь идет к шине - вводной
  if (targetIsBus) {
    return 'INCOMING';
  }
  
  // Если от выключателя идут связи к нагрузкам - отходящий
  const hasLoadConnection = targetsFromBreaker.some(id => {
    const el = allElements.find(e => e.id === id);
    return el && (isType(el.type, 'load') || isType(el.type, 'meter'));
  });
  
  if (hasLoadConnection) {
    return 'OUTGOING';
  }
  
  return 'UNKNOWN';
}

/**
 * Найти шину, которую питает элемент
 */
function findConnectedBus(
  elementId: string,
  connections: LayoutConnection[],
  busElements: LayoutElement[],
  direction: 'upstream' | 'downstream' = 'downstream'
): LayoutElement | null {
  const busIds = new Set(busElements.map(b => b.id));
  
  if (direction === 'downstream') {
    // Ищем связь от элемента к шине
    for (const conn of connections) {
      if (conn.sourceId === elementId && busIds.has(conn.targetId)) {
        return busElements.find(b => b.id === conn.targetId) || null;
      }
    }
  } else {
    // Ищем связь от шины к элементу
    for (const conn of connections) {
      if (conn.targetId === elementId && busIds.has(conn.sourceId)) {
        return busElements.find(b => b.id === conn.sourceId) || null;
      }
    }
  }
  
  return null;
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

  // Разделяем элементы по типам
  const cabinets = elements.filter(e => isType(e.type, 'cabinet'));
  const nonCabinets = elements.filter(e => !isType(e.type, 'cabinet'));
  const sources = nonCabinets.filter(e => isType(e.type, 'source'));
  
  const cabinetNames = new Map(cabinets.map(c => [c.id, c.name]));

  // Группируем элементы по parentId (Cabinet)
  const groups = new Map<string | null, LayoutElement[]>();
  for (const el of nonCabinets) {
    const key = el.parentId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(el);
  }

  // Строим граф связей
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  const elementIds = new Set(elements.map(e => e.id));
  
  for (const conn of connections) {
    if (!elementIds.has(conn.sourceId) || !elementIds.has(conn.targetId)) continue;
    
    if (!outgoing.has(conn.sourceId)) outgoing.set(conn.sourceId, []);
    outgoing.get(conn.sourceId)!.push(conn.targetId);
    
    if (!incoming.has(conn.targetId)) incoming.set(conn.targetId, []);
    incoming.get(conn.targetId)!.push(conn.sourceId);
  }

  // Вычисляем уровни на основе связей (топологическая сортировка)
  const levels = new Map<string, number>();
  
  function computeLevel(id: string, visited: Set<string>): number {
    if (levels.has(id)) return levels.get(id)!;
    if (visited.has(id)) return 0;
    visited.add(id);

    const element = nonCabinets.find(e => e.id === id);
    
    // SOURCE всегда на уровне 0
    if (element && isType(element.type, 'source')) {
      levels.set(id, 0);
      return 0;
    }

    const parents = incoming.get(id) || [];
    
    if (parents.length === 0) {
      // Нет входящих - определяем по типу
      const typeLevels: Record<string, number> = {
        'source': 0,
        'junction': 1,
        'breaker': 2,
        'bus': 3,
        'meter': 4,
        'load': 5,
      };
      const typeLevel = element ? (typeLevels[element.type.toLowerCase()] ?? 3) : 3;
      levels.set(id, typeLevel);
      return typeLevel;
    }

    const maxParentLevel = Math.max(...parents.map(p => computeLevel(p, visited)));
    const level = maxParentLevel + 1;
    
    levels.set(id, level);
    return level;
  }

  for (const el of nonCabinets) {
    computeLevel(el.id, new Set());
  }

  let currentX = CANVAS_MARGIN;
  let currentY = CANVAS_MARGIN;

  // ================== РАЗМЕЩЕНИЕ SOURCE (вверху схемы) ==================
  if (sources.length > 0) {
    const sourceY = currentY;
    let sourceX = currentX;
    
    for (const source of sources) {
      positions.set(source.id, {
        x: Math.round(sourceX / GRID_STEP) * GRID_STEP,
        y: Math.round(sourceY / GRID_STEP) * GRID_STEP
      });
      sourceX += NODE_WIDTH + NODE_SPACING;
    }
    
    currentY += LAYER_VERTICAL * 2;
  }

  // ================== ФУНКЦИЯ РАЗМЕЩЕНИЯ ЭЛЕМЕНТОВ ВНУТРИ CABINET ==================
  function layoutCabinet(
    cabinetElements: LayoutElement[],
    startX: number,
    startY: number
  ): { maxX: number; maxY: number } {
    
    // Разделяем элементы по типам
    const buses = cabinetElements.filter(e => isType(e.type, 'bus'));
    const breakers = cabinetElements.filter(e => isType(e.type, 'breaker'));
    const meters = cabinetElements.filter(e => isType(e.type, 'meter'));
    const junctions = cabinetElements.filter(e => isType(e.type, 'junction'));
    const loads = cabinetElements.filter(e => isType(e.type, 'load'));
    const others = cabinetElements.filter(e => 
      !isType(e.type, 'bus') && 
      !isType(e.type, 'breaker') && 
      !isType(e.type, 'meter') &&
      !isType(e.type, 'junction') &&
      !isType(e.type, 'load') &&
      !isType(e.type, 'source')
    );

    // ===== УРОВЕНЬ 0: Элементы без связей к шинам (над шинами) =====
    // Элементы с уровнем 0-1 по топологии
    const topElements = cabinetElements.filter(e => {
      const level = levels.get(e.id) ?? 3;
      return level <= 1 && !isType(e.type, 'bus') && !isType(e.type, 'source');
    });
    
    let topY = startY;
    let topX = startX;
    
    for (const el of topElements) {
      if (!positions.has(el.id)) {
        positions.set(el.id, {
          x: Math.round(topX / GRID_STEP) * GRID_STEP,
          y: Math.round(topY / GRID_STEP) * GRID_STEP
        });
        topX += NODE_WIDTH + NODE_SPACING;
      }
    }
    
    if (topElements.length > 0) {
      topY += LAYER_VERTICAL;
    }

    // ===== УРОВЕНЬ 1: ШИНЫ (BUS) - на одной горизонтальной линии =====
    const busY = Math.max(topY + LAYER_VERTICAL, startY + LAYER_VERTICAL);
    let busX = startX;
    const busPositions = new Map<string, Position>();
    
    // Сортируем шины по имени
    const sortedBuses = [...buses].sort((a, b) => a.name.localeCompare(b.name));
    
    for (const bus of sortedBuses) {
      const pos = {
        x: Math.round(busX / GRID_STEP) * GRID_STEP,
        y: Math.round(busY / GRID_STEP) * GRID_STEP
      };
      positions.set(bus.id, pos);
      busPositions.set(bus.id, pos);
      busX += BUS_WIDTH + BUS_SPACING;
    }

    // ===== КЛАССИФИКАЦИЯ BREAKER =====
    const breakerRoles = new Map<string, BreakerRole>();
    
    for (const breaker of breakers) {
      const role = getBreakerRole(breaker, buses, connections, cabinetElements, positions);
      breakerRoles.set(breaker.id, role);
    }

    // ===== УРОВЕНЬ -1: ВВОДНЫЕ BREAKER (над шинами) =====
    const incomingBreakers = breakers.filter(b => breakerRoles.get(b.id) === 'INCOMING');
    const incomingY = busY - LAYER_VERTICAL;
    
    // Группируем вводные по шинам
    const incomingByBus = new Map<string, LayoutElement[]>();
    for (const breaker of incomingBreakers) {
      const bus = findConnectedBus(breaker.id, connections, buses, 'downstream');
      const key = bus?.id || 'default';
      if (!incomingByBus.has(key)) incomingByBus.set(key, []);
      incomingByBus.get(key)!.push(breaker);
    }
    
    for (const bus of sortedBuses) {
      const busPos = busPositions.get(bus.id)!;
      const busIncoming = incomingByBus.get(bus.id) || [];
      busIncoming.sort((a, b) => a.name.localeCompare(b.name));
      
      let incX = busPos.x - (busIncoming.length - 1) * (NODE_WIDTH + NODE_SPACING / 2) / 2;
      
      for (const breaker of busIncoming) {
        if (!positions.has(breaker.id)) {
          positions.set(breaker.id, {
            x: Math.round(incX / GRID_STEP) * GRID_STEP,
            y: Math.round(incomingY / GRID_STEP) * GRID_STEP
          });
        }
        incX += NODE_WIDTH + NODE_SPACING / 2;
      }
    }

    // ===== УРОВЕНЬ 0: СЕКЦИОННЫЕ BREAKER (горизонтально между шинами) =====
    const sectionalBreakers = breakers.filter(b => breakerRoles.get(b.id) === 'SECTIONAL');
    
    for (let i = 0; i < sortedBuses.length - 1; i++) {
      const bus1 = sortedBuses[i];
      const bus2 = sortedBuses[i + 1];
      const pos1 = busPositions.get(bus1.id)!;
      const pos2 = busPositions.get(bus2.id)!;
      
      const sectional = sectionalBreakers.find(b => {
        const connectedBus = findConnectedBus(b.id, connections, buses, 'downstream') ||
                            findConnectedBus(b.id, connections, buses, 'upstream');
        return connectedBus && (connectedBus.id === bus1.id || connectedBus.id === bus2.id);
      });
      
      if (sectional && !positions.has(sectional.id)) {
        const midX = (pos1.x + pos2.x) / 2;
        positions.set(sectional.id, {
          x: Math.round(midX / GRID_STEP) * GRID_STEP,
          y: Math.round(busY / GRID_STEP) * GRID_STEP
        });
      }
    }

    // ===== УРОВЕНЬ +1: ОТХОДЯЩИЕ BREAKER, METER, JUNCTION (под шинами) =====
    const outgoingY = busY + LAYER_VERTICAL;
    const elementsBelowBus: LayoutElement[] = [];
    
    // Отходящие выключатели
    elementsBelowBus.push(...breakers.filter(b => breakerRoles.get(b.id) === 'OUTGOING'));
    // Мeters
    elementsBelowBus.push(...meters);
    // Junctions
    elementsBelowBus.push(...junctions);
    // Неизвестные выключатели
    elementsBelowBus.push(...breakers.filter(b => breakerRoles.get(b.id) === 'UNKNOWN'));
    
    // Группируем по шинам
    const belowByBus = new Map<string, LayoutElement[]>();
    
    for (const el of elementsBelowBus) {
      const bus = findConnectedBus(el.id, connections, buses, 'upstream');
      const key = bus?.id || 'default';
      if (!belowByBus.has(key)) belowByBus.set(key, []);
      belowByBus.get(key)!.push(el);
    }
    
    // Размещаем под каждой шиной
    for (const bus of sortedBuses) {
      const busPos = busPositions.get(bus.id)!;
      const busBelow = belowByBus.get(bus.id) || [];
      busBelow.sort((a, b) => a.name.localeCompare(b.name));
      
      let belowX = busPos.x - (busBelow.length - 1) * (NODE_WIDTH + NODE_SPACING / 3) / 2;
      
      for (const el of busBelow) {
        if (!positions.has(el.id)) {
          positions.set(el.id, {
            x: Math.round(belowX / GRID_STEP) * GRID_STEP,
            y: Math.round(outgoingY / GRID_STEP) * GRID_STEP
          });
        }
        belowX += NODE_WIDTH + NODE_SPACING / 3;
      }
    }

    // ===== УРОВЕНЬ +2: LOAD (ещё ниже) =====
    const loadY = outgoingY + LAYER_VERTICAL;
    let loadX = startX;
    
    for (const load of loads) {
      if (!positions.has(load.id)) {
        positions.set(load.id, {
          x: Math.round(loadX / GRID_STEP) * GRID_STEP,
          y: Math.round(loadY / GRID_STEP) * GRID_STEP
        });
        loadX += NODE_WIDTH + NODE_SPACING;
      }
    }

    // ===== УРОВЕНЬ +3: Прочие элементы =====
    const otherY = loadY + LAYER_VERTICAL;
    let otherX = startX;
    
    for (const el of others) {
      if (!positions.has(el.id)) {
        positions.set(el.id, {
          x: Math.round(otherX / GRID_STEP) * GRID_STEP,
          y: Math.round(otherY / GRID_STEP) * GRID_STEP
        });
        otherX += NODE_WIDTH + NODE_SPACING;
      }
    }

    // Вычисляем границы шкафа
    const allX = Array.from(positions.values()).map(p => p.x);
    const allY = Array.from(positions.values()).map(p => p.y);
    
    const maxX = (allX.length > 0 ? Math.max(...allX) : startX) + NODE_WIDTH + CABINET_PADDING;
    const maxY = (allY.length > 0 ? Math.max(...allY) : startY) + LAYER_VERTICAL;

    return { maxX, maxY };
  }

  // ================== РАЗМЕЩЕНИЕ КОРНЕВЫХ ЭЛЕМЕНТОВ (без parentId) ==================
  const rootElements = groups.get(null) || [];
  groups.delete(null);

  // Сортируем корневые: SOURCE уже размещены, остальные по уровню
  const sortedRootElements = rootElements
    .filter(e => !positions.has(e.id))
    .sort((a, b) => {
      const levelA = levels.get(a.id) ?? 3;
      const levelB = levels.get(b.id) ?? 3;
      return levelA - levelB;
    });

  if (sortedRootElements.length > 0) {
    // Группируем по уровням
    const byLevel = new Map<number, LayoutElement[]>();
    for (const el of sortedRootElements) {
      const level = levels.get(el.id) ?? 3;
      if (!byLevel.has(level)) byLevel.set(level, []);
      byLevel.get(level)!.push(el);
    }
    
    let rootY = currentY;
    const rootStartX = currentX;
    
    for (const [level, levelElements] of byLevel) {
      const y = currentY + level * LAYER_VERTICAL;
      let x = rootStartX;
      
      for (const el of levelElements) {
        positions.set(el.id, {
          x: Math.round(x / GRID_STEP) * GRID_STEP,
          y: Math.round(y / GRID_STEP) * GRID_STEP
        });
        x += NODE_WIDTH + NODE_SPACING;
      }
      
      rootY = Math.max(rootY, y);
    }
    
    currentY = rootY + LAYER_VERTICAL * 2;
  }

  // ================== РАЗМЕЩЕНИЕ КАЖДОГО CABINET ==================
  const sortedCabinetEntries = [...groups.entries()]
    .filter((entry): entry is [string, LayoutElement[]] => entry[0] !== null)
    .sort((a, b) => {
      const nameA = cabinetNames.get(a[0]) || '';
      const nameB = cabinetNames.get(b[0]) || '';
      return nameA.localeCompare(nameB);
    });

  let globalMaxY = currentY;

  for (const [cabinetId, cabinetElements] of sortedCabinetEntries) {
    if (!cabinetId) continue;

    const result = layoutCabinet(cabinetElements, currentX, currentY);
    
    // Сохраняем границы Cabinet
    const cabinetName = cabinetNames.get(cabinetId) || 'Cabinet';
    const cabinetWidth = result.maxX - currentX + CABINET_PADDING;
    const cabinetHeight = result.maxY - currentY + CABINET_PADDING;
    
    cabinetBounds.set(cabinetId, {
      x: currentX - CABINET_PADDING / 2,
      y: currentY - CABINET_PADDING / 2,
      width: cabinetWidth,
      height: cabinetHeight,
      name: cabinetName
    });

    globalMaxY = Math.max(globalMaxY, result.maxY);
    
    // Переходим к следующему шкафу
    currentX = result.maxX + CABINET_MARGIN;

    // Перенос на новую строку если слишком широко
    if (currentX > 1400) {
      currentX = CANVAS_MARGIN;
      currentY = globalMaxY + CABINET_MARGIN;
    }
  }

  // ================== РАЗМЕЩЕНИЕ LOAD ВНЕ ШКАФОВ ==================
  const orphanLoads = nonCabinets.filter(e => 
    isType(e.type, 'load') && !positions.has(e.id)
  );
  
  if (orphanLoads.length > 0) {
    let loadX = CANVAS_MARGIN;
    const loadY = globalMaxY + LAYER_VERTICAL;
    
    for (const load of orphanLoads) {
      positions.set(load.id, {
        x: Math.round(loadX / GRID_STEP) * GRID_STEP,
        y: Math.round(loadY / GRID_STEP) * GRID_STEP
      });
      loadX += NODE_WIDTH + NODE_SPACING;
    }
    globalMaxY = loadY + LAYER_VERTICAL;
  }

  // ================== НЕРАЗМЕЩЁННЫЕ ЭЛЕМЕНТЫ ==================
  // Размещаем все оставшиеся элементы
  const unpositioned = nonCabinets.filter(e => !positions.has(e.id));
  if (unpositioned.length > 0) {
    let unX = CANVAS_MARGIN;
    let unY = globalMaxY + LAYER_VERTICAL * 2;
    
    for (const el of unpositioned) {
      positions.set(el.id, {
        x: Math.round(unX / GRID_STEP) * GRID_STEP,
        y: Math.round(unY / GRID_STEP) * GRID_STEP
      });
      unX += NODE_WIDTH + NODE_SPACING;
      
      if (unX > 1200) {
        unX = CANVAS_MARGIN;
        unY += LAYER_VERTICAL;
      }
    }
  }

  // ================== РАСЧЁТ OFFSETS ДЛЯ ЛИНИЙ ==================
  const edgeGroups = new Map<string, LayoutConnection[]>();
  for (const conn of connections) {
    const key = `${conn.sourceId}-${conn.targetId}`;
    if (!edgeGroups.has(key)) edgeGroups.set(key, []);
    edgeGroups.get(key)!.push(conn);
  }

  for (const [, conns] of edgeGroups) {
    conns.forEach((conn, index) => {
      const offset = (index - (conns.length - 1) / 2) * EDGE_SPACING;
      
      const sourcePos = positions.get(conn.sourceId);
      const targetPos = positions.get(conn.targetId);
      
      if (sourcePos && targetPos) {
        const controlPoints = calculateControlPoints(
          sourcePos.x, sourcePos.y,
          targetPos.x, targetPos.y,
          offset
        );
        
        edgeOffsets.set(conn.id, {
          connectionId: conn.id,
          offset,
          controlPoints,
        });
      }
    });
  }

  return { positions, cabinetBounds, edgeOffsets };
}

/**
 * Сохранение рассчитанных позиций в базу данных
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
 * Экспорт правил позиционирования (для документации)
 */
export function getLayoutRules(): string {
  return `
# ПРАВИЛА ПОЗИЦИОНИРОВАНИЯ ЭЛЕМЕНТОВ НА СХЕМЕ

## 1. Глобальная структура

| Уровень | Тип элемента | Описание |
|---------|--------------|----------|
| Верх | SOURCE | Источники питания (желтые шестиугольники) |
| Центр | CABINET | Шкафы с оборудованием (пунктирные прямоугольники) |
| Низ | LOAD | Потребители |

## 2. Топология внутри шкафа (CABINET)

- **Уровень Шин:** BUS (узкие горизонтальные прямоугольники) на одной горизонтальной линии
- **Над шинами:** Вводные автоматические выключатели (BREAKER)
- **На уровне шин:** Секционные выключатели (горизонтально между соседними шинами)
- **Под шинами:** Отходящие автоматические выключатели (BREAKER), счётчики (METER)

## 3. Группировка

- Автоматы, питающие одну шину, сгруппированы вплотную друг к другу
- Плотная компоновка внутри шкафов

## 4. Иерархия питания

SOURCE → BREAKER (вводной) → BUS → BREAKER (отходящий) → METER → LOAD
                    ↓
              BREAKER (секционный) → BUS (соседняя секция)
`;
}

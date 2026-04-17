/**
 * Служба расчета позиций элементов на схеме
 *
 * Правила размещения:
 * 1. Все линии горизонтальные или вертикальные
 * 2. SOURCE питающие JUNCTION - над ними по вертикали
 * 3. JUNCTION питающие BREAKER - над одним из них, другой BREAKER горизонтально с первым
 * 4. BREAKER расположенные до BUS - над ними на одной вертикальной линии
 * 5. BUS с одним Cabinet - на одном уровне по горизонтали
 * 6. METER (УЗЛОВ) с одним Cabinet - на одном уровне
 * 7. Все элементы в горизонтальной или вертикальной сетке
 * 8. Элементы с одним Cabinet внутри области Cabinet (границы пунктиром)
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

interface LayoutResult {
  positions: Map<string, Position>;
  cabinetBounds: Map<string, { x: number; y: number; width: number; height: number }>;
}

// Размеры сетки
const GRID_STEP = 40; // Шаг сетки
const LAYER_HEIGHT = 120; // Высота слоя между уровнями
const NODE_WIDTH = 80; // Ширина узла по умолчанию
const NODE_HEIGHT = 50; // Высота узла по умолчанию
const CABINET_PADDING = 60; // Отступ внутри Cabinet

/**
 * Получить порядок типа элемента для вертикального размещения
 * Меньшее значение = выше на схеме
 */
function getTypeOrder(type: string): number {
  const orders: Record<string, number> = {
    'source': 0,
    'junction': 1,
    'breaker': 2,
    'bus': 3,
    'meter': 4,
    'load': 5,
    'cabinet': 6,
  };
  return orders[type.toLowerCase()] ?? 7;
}

/**
 * Группировка элементов по Cabinet (parentId)
 */
function groupByCabinet(elements: LayoutElement[]): Map<string | null, LayoutElement[]> {
  const groups = new Map<string | null, LayoutElement[]>();

  for (const el of elements) {
    const key = el.parentId;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(el);
  }

  return groups;
}

/**
 * Построение графа связей (кто кого питает)
 */
function buildConnectionGraph(
  elements: LayoutElement[],
  connections: LayoutConnection[]
): {
  outgoing: Map<string, string[]>;  // откуда -> [куда]
  incoming: Map<string, string[]>;  // куда -> [откуда]
} {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  const elementIds = new Set(elements.map(e => e.id));

  for (const conn of connections) {
    if (!elementIds.has(conn.sourceId) || !elementIds.has(conn.targetId)) continue;

    if (!outgoing.has(conn.sourceId)) {
      outgoing.set(conn.sourceId, []);
    }
    outgoing.get(conn.sourceId)!.push(conn.targetId);

    if (!incoming.has(conn.targetId)) {
      incoming.set(conn.targetId, []);
    }
    incoming.get(conn.targetId)!.push(conn.sourceId);
  }

  return { outgoing, incoming };
}

/**
 * Топологическая сортировка элементов по связям
 */
function topologicalSort(
  elements: LayoutElement[],
  connections: LayoutConnection[]
): LayoutElement[] {
  const { incoming } = buildConnectionGraph(elements, connections);

  // Создаем карту элементов по id
  const elementMap = new Map(elements.map(e => [e.id, e]));

  // Вычисляем уровень каждого элемента
  const levels = new Map<string, number>();
  const visited = new Set<string>();

  function computeLevel(id: string): number {
    if (levels.has(id)) return levels.get(id)!;
    if (visited.has(id)) return 0; // Цикл

    visited.add(id);

    const parents = incoming.get(id) || [];
    if (parents.length === 0) {
      levels.set(id, 0);
      return 0;
    }

    const maxParentLevel = Math.max(...parents.map(p => computeLevel(p)));
    const level = maxParentLevel + 1;
    levels.set(id, level);
    return level;
  }

  // Вычисляем уровни для всех элементов
  for (const el of elements) {
    computeLevel(el.id);
  }

  // Сортируем по уровню, затем по типу
  const sorted = [...elements].sort((a, b) => {
    const levelDiff = (levels.get(a.id) || 0) - (levels.get(b.id) || 0);
    if (levelDiff !== 0) return levelDiff;

    const typeDiff = getTypeOrder(a.type) - getTypeOrder(b.type);
    if (typeDiff !== 0) return typeDiff;

    return a.name.localeCompare(b.name);
  });

  return sorted;
}

/**
 * Расчет позиций для группы элементов внутри одного Cabinet
 */
function layoutCabinetGroup(
  elements: LayoutElement[],
  connections: LayoutConnection[],
  startX: number,
  startY: number
): {
  positions: Map<string, Position>;
  width: number;
  height: number;
} {
  const positions = new Map<string, Position>();

  if (elements.length === 0) {
    return { positions, width: 0, height: 0 };
  }

  // Сортируем элементы
  const sorted = topologicalSort(elements, connections);

  // Группируем по типам
  const byType = new Map<string, LayoutElement[]>();
  for (const el of sorted) {
    const type = el.type.toLowerCase();
    if (!byType.has(type)) {
      byType.set(type, []);
    }
    byType.get(type)!.push(el);
  }

  // Определяем уровни Y для каждого типа
  const typeYOffsets: Record<string, number> = {
    'source': 0,
    'junction': LAYER_HEIGHT,
    'breaker': LAYER_HEIGHT * 2,
    'bus': LAYER_HEIGHT * 3,
    'meter': LAYER_HEIGHT * 3.5,
    'load': LAYER_HEIGHT * 4,
  };

  // Размещаем элементы
  let maxWidth = 0;
  const typeXCounters = new Map<string, number>();

  for (const el of sorted) {
    const type = el.type.toLowerCase();
    const yOffset = typeYOffsets[type] ?? LAYER_HEIGHT * 5;

    if (!typeXCounters.has(type)) {
      typeXCounters.set(type, 0);
    }

    const xCounter = typeXCounters.get(type)!;

    // Вычисляем X позицию
    // Для BUS и METER размещаем на одном уровне по горизонтали
    let xPos: number;

    if (type === 'bus' || type === 'meter') {
      // Шины и счетчики в ряд
      xPos = startX + xCounter * (NODE_WIDTH + GRID_STEP);
    } else if (type === 'breaker') {
      // Выключатели могут быть в 2 ряда
      const row = Math.floor(xCounter / 4);
      const col = xCounter % 4;
      xPos = startX + col * (NODE_WIDTH + GRID_STEP);
      const yPos = startY + yOffset + row * (NODE_HEIGHT + GRID_STEP);
      positions.set(el.id, { x: xPos, y: yPos });
      typeXCounters.set(type, xCounter + 1);
      maxWidth = Math.max(maxWidth, xPos + NODE_WIDTH);
      continue;
    } else {
      xPos = startX + xCounter * (NODE_WIDTH + GRID_STEP);
    }

    const yPos = startY + yOffset;

    positions.set(el.id, { x: xPos, y: yPos });
    typeXCounters.set(type, xCounter + 1);

    maxWidth = Math.max(maxWidth, xPos + NODE_WIDTH);
  }

  // Вычисляем высоту
  const maxY = Math.max(...Array.from(positions.values()).map(p => p.y), 0);
  const height = maxY + NODE_HEIGHT + CABINET_PADDING;

  return {
    positions,
    width: maxWidth + CABINET_PADDING,
    height
  };
}

/**
 * Главная функция расчета позиций для всех элементов
 */
export function calculateLayout(
  elements: LayoutElement[],
  connections: LayoutConnection[]
): LayoutResult {
  const positions = new Map<string, Position>();
  const cabinetBounds = new Map<string, { x: number; y: number; width: number; height: number }>();

  // Отделяем Cabinet от остальных элементов
  const cabinets = elements.filter(e => e.type.toLowerCase() === 'cabinet');
  const nonCabinets = elements.filter(e => e.type.toLowerCase() !== 'cabinet');

  // Группируем элементы по parentId (Cabinet)
  const groups = groupByCabinet(nonCabinets);

  // Элементы без Cabinet (parentId = null) - корневые
  const rootElements = groups.get(null) || [];
  groups.delete(null);

  // Размещаем корневые элементы (обычно SOURCE)
  let currentX = CABINET_PADDING;
  let currentY = CABINET_PADDING;

  if (rootElements.length > 0) {
    const result = layoutCabinetGroup(rootElements, connections, currentX, currentY);
    result.positions.forEach((pos, id) => positions.set(id, pos));
    currentY += result.height + LAYER_HEIGHT;
  }

  // Размещаем элементы внутри каждого Cabinet
  for (const [cabinetId, cabinetElements] of groups) {
    const cabinet = cabinets.find(c => c.id === cabinetId);

    // Расчет позиций для группы
    const result = layoutCabinetGroup(cabinetElements, connections, currentX, currentY);
    result.positions.forEach((pos, id) => positions.set(id, pos));

    // Сохраняем границы Cabinet
    cabinetBounds.set(cabinetId, {
      x: currentX - CABINET_PADDING / 2,
      y: currentY - CABINET_PADDING / 2,
      width: result.width + CABINET_PADDING,
      height: result.height + CABINET_PADDING
    });

    // Обновляем позицию Cabinet
    if (cabinet) {
      positions.set(cabinet.id, {
        x: currentX + result.width / 2,
        y: currentY - CABINET_PADDING / 4
      });
    }

    // Переходим к следующему столбцу Cabinet
    currentX += result.width + GRID_STEP * 2;

    // Если слишком широко, переходим на новую строку
    if (currentX > 1500) {
      currentX = CABINET_PADDING;
      currentY += result.height + LAYER_HEIGHT;
    }
  }

  // Выравниваем связи - делаем их ортогональными
  alignConnections(positions, connections);

  return { positions, cabinetBounds };
}

/**
 * Выравнивание связей для ортогональности
 * Корректирует позиции так, чтобы связи были горизонтальными или вертикальными
 */
function alignConnections(
  positions: Map<string, Position>,
  connections: LayoutConnection[]
): void {
  // Для каждой связи проверяем, можно ли выровнять элементы
  for (const conn of connections) {
    const sourcePos = positions.get(conn.sourceId);
    const targetPos = positions.get(conn.targetId);

    if (!sourcePos || !targetPos) continue;

    const dx = Math.abs(targetPos.x - sourcePos.x);
    const dy = Math.abs(targetPos.y - sourcePos.y);

    // Если связь уже почти вертикальная или горизонтальная - выравниваем
    if (dx < dy * 0.5) {
      // Вертикальная связь - выравниваем X
      const avgX = Math.round((sourcePos.x + targetPos.x) / 2 / GRID_STEP) * GRID_STEP;
      sourcePos.x = avgX;
      targetPos.x = avgX;
    } else if (dy < dx * 0.5) {
      // Горизонтальная связь - выравниваем Y
      const avgY = Math.round((sourcePos.y + targetPos.y) / 2 / GRID_STEP) * GRID_STEP;
      sourcePos.y = avgY;
      targetPos.y = avgY;
    }
    // Для диагональных связей - оставляем как есть (ортогональная маршрутизация будет в G6)
  }

  // Округляем все позиции до сетки
  positions.forEach((pos) => {
    pos.x = Math.round(pos.x / GRID_STEP) * GRID_STEP;
    pos.y = Math.round(pos.y / GRID_STEP) * GRID_STEP;
  });
}

/**
 * Сохранение рассчитанных позиций в базу данных
 */
export async function saveLayoutPositions(
  positions: Map<string, Position>,
  prisma: any
): Promise<number> {
  let updated = 0;

  for (const [id, pos] of positions) {
    try {
      await prisma.element.update({
        where: { id },
        data: {
          posX: pos.x,
          posY: pos.y
        }
      });
      updated++;
    } catch (error) {
      console.error(`Failed to update position for element ${id}:`, error);
    }
  }

  return updated;
}

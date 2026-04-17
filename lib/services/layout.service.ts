/**
 * Служба расчета позиций элементов на схеме
 * Упрощенная версия для тестирования
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
  cabinetBounds: Map<string, { x: number; y: number; width: number; height: number; name: string }>;
}

// Размеры
const GRID_STEP = 60;
const LAYER_HEIGHT = 100;
const NODE_WIDTH = 100;
const CABINET_PADDING = 50;

/**
 * Получить порядок типа элемента для вертикального размещения
 */
function getTypeOrder(type: string): number {
  const orders: Record<string, number> = {
    'source': 0,
    'junction': 1,
    'breaker': 2,
    'bus': 3,
    'meter': 3.5,
    'load': 4,
    'cabinet': 5,
  };
  return orders[type.toLowerCase()] ?? 6;
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

  // Отделяем Cabinet от остальных элементов
  const cabinets = elements.filter(e => e.type.toLowerCase() === 'cabinet');
  const nonCabinets = elements.filter(e => e.type.toLowerCase() !== 'cabinet');

  // Создаем мапу cabinet names
  const cabinetNames = new Map(cabinets.map(c => [c.id, c.name]));

  // Группируем элементы по parentId (Cabinet)
  const groups = new Map<string | null, LayoutElement[]>();
  for (const el of nonCabinets) {
    const key = el.parentId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(el);
  }

  // Вычисляем уровни на основе связей
  const levels = new Map<string, number>();
  const elementIds = new Set(elements.map(e => e.id));

  // Строим граф входящих связей
  const incoming = new Map<string, string[]>();
  for (const conn of connections) {
    if (!elementIds.has(conn.sourceId) || !elementIds.has(conn.targetId)) continue;
    if (!incoming.has(conn.targetId)) incoming.set(conn.targetId, []);
    incoming.get(conn.targetId)!.push(conn.sourceId);
  }

  // Функция для вычисления уровня элемента
  function computeLevel(id: string, visited: Set<string>): number {
    if (levels.has(id)) return levels.get(id)!;
    if (visited.has(id)) return 0;
    visited.add(id);

    const parents = incoming.get(id) || [];
    if (parents.length === 0) {
      levels.set(id, 0);
      return 0;
    }

    const maxParentLevel = Math.max(...parents.map(p => computeLevel(p, visited)));
    const level = maxParentLevel + 1;
    levels.set(id, level);
    return level;
  }

  // Вычисляем уровни для всех элементов
  for (const el of nonCabinets) {
    computeLevel(el.id, new Set());
  }

  // Размещаем элементы без Cabinet (корневые)
  const rootElements = groups.get(null) || [];
  groups.delete(null);

  let currentX = CABINET_PADDING;
  let currentY = CABINET_PADDING;

  // Функция размещения группы элементов
  function layoutGroup(elements: LayoutElement[], startX: number, startY: number): number {
    // Сортируем по уровню, затем по типу
    const sorted = [...elements].sort((a, b) => {
      const levelA = levels.get(a.id) || 0;
      const levelB = levels.get(b.id) || 0;
      if (levelA !== levelB) return levelA - levelB;
      return getTypeOrder(a.type) - getTypeOrder(b.type);
    });

    // Группируем по уровням
    const byLevel = new Map<number, LayoutElement[]>();
    for (const el of sorted) {
      const level = levels.get(el.id) || 0;
      if (!byLevel.has(level)) byLevel.set(level, []);
      byLevel.get(level)!.push(el);
    }

    let maxX = startX;

    // Размещаем элементы по уровням
    for (const [level, levelElements] of byLevel) {
      const y = startY + level * LAYER_HEIGHT;
      let x = startX;

      for (const el of levelElements) {
        positions.set(el.id, {
          x: Math.round(x / GRID_STEP) * GRID_STEP,
          y: Math.round(y / GRID_STEP) * GRID_STEP
        });
        x += NODE_WIDTH + GRID_STEP;
        maxX = Math.max(maxX, x);
      }
    }

    return maxX;
  }

  // Размещаем корневые элементы
  if (rootElements.length > 0) {
    layoutGroup(rootElements, currentX, currentY);
    currentY += (Math.max(...rootElements.map(e => levels.get(e.id) || 0)) + 2) * LAYER_HEIGHT;
  }

  // Размещаем элементы внутри каждого Cabinet
  for (const [cabinetId, cabinetElements] of groups) {
    if (!cabinetId) continue;

    const maxX = layoutGroup(cabinetElements, currentX, currentY);
    const maxLevel = Math.max(...cabinetElements.map(e => levels.get(e.id) || 0));

    // Сохраняем границы Cabinet
    const cabinetName = cabinetNames.get(cabinetId) || 'Cabinet';
    cabinetBounds.set(cabinetId, {
      x: currentX - CABINET_PADDING / 2,
      y: currentY - CABINET_PADDING / 2,
      width: maxX - currentX + NODE_WIDTH + CABINET_PADDING,
      height: (maxLevel + 2) * LAYER_HEIGHT + CABINET_PADDING,
      name: cabinetName
    });

    // Переходим к следующему столбцу Cabinet
    currentX = maxX + GRID_STEP * 2;

    // Если слишком широко, переходим на новую строку
    if (currentX > 1200) {
      currentX = CABINET_PADDING;
      currentY += (maxLevel + 3) * LAYER_HEIGHT;
    }
  }

  return { positions, cabinetBounds };
}

/**
 * Сохранение рассчитанных позиций в базу данных
 */
export async function saveLayoutPositions(
  positions: Map<string, Position>,
  prisma: any
): Promise<number> {
  let updated = 0;

  // Сохраняем позиции батчами
  const updates = [];
  for (const [id, pos] of positions) {
    updates.push(
      prisma.element.update({
        where: { id },
        data: { posX: pos.x, posY: pos.y }
      }).then(() => { updated++; })
      .catch((e: Error) => console.error(`Failed to update ${id}:`, e.message))
    );

    // Сохраняем по 50 элементов за раз
    if (updates.length >= 50) {
      await Promise.all(updates);
      updates.length = 0;
    }
  }

  await Promise.all(updates);
  return updated;
}

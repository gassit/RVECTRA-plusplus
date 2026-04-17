/**
 * Служба расчета позиций элементов на схеме
 * 
 * ПРАВИЛА ПОЗИЦИОНИРОВАНИЯ:
 * ====================================
 * 
 * 1. ВЕРТИКАЛЬНЫЕ УРОВНИ (сверху вниз):
 *    - Level 0: SOURCE (источники питания) - ВСЕГДА ВВЕРХУ
 *    - Level 1: JUNCTION (узлы/разветвления)
 *    - Level 2: BREAKER (автоматы)
 *    - Level 3: BUS (шины)
 *    - Level 4: METER (счётчики)
 *    - Level 5: LOAD (нагрузки) - ВСЕГДА ВНИЗУ
 * 
 * 2. ГОРИЗОНТАЛЬНОЕ РАЗМЕЩЕНИЕ:
 *    - Элементы одного уровня размещаются слева направо
 *    - Расстояние между элементами: MIN_SPACING = 150px
 *    - Ширина схемы увеличивается для размещения всех элементов
 * 
 * 3. ЛИНИИ CONNECTION:
 *    - Все линии ортогональные (только горизонтальные и вертикальные сегменты)
 *    - Параллельные линии имеют смещение (offset) относительно друг друга
 *    - Линии не должны пересекать элементы, к которым они не подключены
 *    - Расстояние между параллельными линиями: EDGE_SPACING = 30px
 * 
 * 4. ГРАНИЦЫ CABINET:
 *    - Элементы одного Cabinet размещаются в одной области
 *    - Границы Cabinet обозначаются пунктирной линией
 *    - Cabinet размещаются горизонтально слева направо
 * 
 * 5. ИЕРАРХИЯ:
 *    - SOURCE выше JUNCTION
 *    - JUNCTION выше BREAKER
 *    - BREAKER выше BUS
 *    - BUS выше METER
 *    - METER выше LOAD
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
  offset: number; // Смещение линии от центра (для параллельных связей)
  controlPoints: Array<{ x: number; y: number }>; // Точки перегиба для ортогональной линии
}

interface LayoutResult {
  positions: Map<string, Position>;
  cabinetBounds: Map<string, { x: number; y: number; width: number; height: number; name: string }>;
  edgeOffsets: Map<string, EdgeOffset>;
}

// ============== КОНСТАНТЫ ==============
const GRID_STEP = 60;           // Шаг сетки
const LAYER_HEIGHT = 180;       // Высота уровня (вертикальное расстояние между уровнями)
const NODE_WIDTH = 100;         // Базовая ширина узла
const NODE_HEIGHT = 60;         // Базовая высота узла
const MIN_SPACING = 150;        // Минимальное расстояние между элементами по горизонтали
const CABINET_PADDING = 80;     // Отступ внутри Cabinet
const EDGE_SPACING = 30;        // Расстояние между параллельными линиями
const CANVAS_MARGIN = 100;      // Отступ от краёв холста

/**
 * Получить строго определённый уровень типа элемента
 * SOURCE ВСЕГДА на уровне 0 (вверху схемы)
 */
function getTypeLevel(type: string): number {
  const levels: Record<string, number> = {
    'source': 0,      // ВСЕГДА ВВЕРХУ
    'junction': 1,    // Разветвления
    'breaker': 2,     // Автоматы
    'bus': 3,         // Шины
    'meter': 4,       // Счётчики
    'load': 5,        // ВСЕГДА ВНИЗУ
    'cabinet': 6,     // Границы шкафов
  };
  return levels[type.toLowerCase()] ?? 6;
}

/**
 * Проверка, является ли элемент SOURCE
 */
function isSource(type: string): boolean {
  return type.toLowerCase() === 'source';
}

/**
 * Вычислить контрольные точки для ортогональной линии
 * Линия идёт только горизонтально и вертикально
 */
function calculateControlPoints(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
  offset: number
): Array<{ x: number; y: number }> {
  const midY = Math.min(sourceY, targetY) + Math.abs(targetY - sourceY) / 2;
  
  // Ортогональный путь: source -> вниз -> вправо/влево -> вниз -> target
  // Смещение применяется к средней точке
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

  // Отделяем Cabinet от остальных элементов
  const cabinets = elements.filter(e => e.type.toLowerCase() === 'cabinet');
  const nonCabinets = elements.filter(e => e.type.toLowerCase() !== 'cabinet');

  // Создаём мапу cabinet names
  const cabinetNames = new Map(cabinets.map(c => [c.id, c.name]));

  // Группируем элементы по parentId (Cabinet)
  const groups = new Map<string | null, LayoutElement[]>();
  for (const el of nonCabinets) {
    const key = el.parentId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(el);
  }

  // Находим все SOURCE элементы
  const sourceElements = nonCabinets.filter(e => isSource(e.type));

  // Определяем уровни на основе типа элемента И связей
  const levels = new Map<string, number>();
  const elementIds = new Set(elements.map(e => e.id));

  // Строим граф связей
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const conn of connections) {
    if (!elementIds.has(conn.sourceId) || !elementIds.has(conn.targetId)) continue;
    
    if (!outgoing.has(conn.sourceId)) outgoing.set(conn.sourceId, []);
    outgoing.get(conn.sourceId)!.push(conn.targetId);
    
    if (!incoming.has(conn.targetId)) incoming.set(conn.targetId, []);
    incoming.get(conn.targetId)!.push(conn.sourceId);
  }

  // Функция для вычисления уровня элемента
  // SOURCE ВСЕГДА на уровне 0
  function computeLevel(id: string, visited: Set<string>): number {
    if (levels.has(id)) return levels.get(id)!;
    if (visited.has(id)) return 0;
    visited.add(id);

    const element = nonCabinets.find(e => e.id === id);
    
    // SOURCE ВСЕГДА на уровне 0 (верх схемы)
    if (element && isSource(element.type)) {
      levels.set(id, 0);
      return 0;
    }

    // Для остальных элементов вычисляем уровень на основе связей и типа
    const typeLevel = element ? getTypeLevel(element.type) : 6;
    const parents = incoming.get(id) || [];
    
    if (parents.length === 0) {
      // Нет входящих связей - используем уровень типа
      levels.set(id, typeLevel);
      return typeLevel;
    }

    // Уровень = максимум из уровня родителя + 1, но не меньше уровня типа
    const maxParentLevel = Math.max(...parents.map(p => computeLevel(p, visited)));
    const level = Math.max(maxParentLevel + 1, typeLevel);
    
    levels.set(id, level);
    return level;
  }

  // Вычисляем уровни для всех элементов
  for (const el of nonCabinets) {
    computeLevel(el.id, new Set());
  }

  // Группируем элементы по уровням для расчёта ширины
  const elementsByLevel = new Map<number, LayoutElement[]>();
  for (const el of nonCabinets) {
    const level = levels.get(el.id) || 0;
    if (!elementsByLevel.has(level)) elementsByLevel.set(level, []);
    elementsByLevel.get(level)!.push(el);
  }

  // Вычисляем максимальную ширину уровня
  let maxLevelWidth = 0;
  for (const [, levelElements] of elementsByLevel) {
    const levelWidth = levelElements.length * (NODE_WIDTH + MIN_SPACING);
    maxLevelWidth = Math.max(maxLevelWidth, levelWidth);
  }

  // Размещаем элементы без Cabinet (корневые) - СНАЧАЛА SOURCE!
  const rootElements = groups.get(null) || [];
  groups.delete(null);

  // Сортируем корневые элементы: SOURCE первыми!
  const sortedRootElements = [...rootElements].sort((a, b) => {
    const aIsSource = isSource(a.type);
    const bIsSource = isSource(b.type);
    if (aIsSource && !bIsSource) return -1;
    if (!aIsSource && bIsSource) return 1;
    
    const levelA = levels.get(a.id) || 0;
    const levelB = levels.get(b.id) || 0;
    return levelA - levelB;
  });

  let currentX = CANVAS_MARGIN;
  let currentY = CANVAS_MARGIN;

  /**
   * Функция размещения группы элементов
   * Возвращает maxX (правую границу)
   */
  function layoutGroup(elements: LayoutElement[], startX: number, startY: number): number {
    // Сортируем по уровню, затем SOURCE первыми
    const sorted = [...elements].sort((a, b) => {
      const aIsSource = isSource(a.type);
      const bIsSource = isSource(b.type);
      if (aIsSource && !bIsSource) return -1;
      if (!aIsSource && bIsSource) return 1;
      
      const levelA = levels.get(a.id) || 0;
      const levelB = levels.get(b.id) || 0;
      if (levelA !== levelB) return levelA - levelB;
      return getTypeLevel(a.type) - getTypeLevel(b.type);
    });

    // Группируем по уровням
    const byLevel = new Map<number, LayoutElement[]>();
    for (const el of sorted) {
      const level = levels.get(el.id) || 0;
      if (!byLevel.has(level)) byLevel.set(level, []);
      byLevel.get(level)!.push(el);
    }

    let maxX = startX;

    // Находим максимальное количество элементов на одном уровне
    let maxElementsInLevel = 0;
    for (const [, levelElements] of byLevel) {
      maxElementsInLevel = Math.max(maxElementsInLevel, levelElements.length);
    }

    // Размещаем элементы по уровням
    for (const [level, levelElements] of byLevel) {
      const y = startY + level * LAYER_HEIGHT;
      
      // Равномерно распределяем элементы по горизонтали
      const totalWidth = maxElementsInLevel * (NODE_WIDTH + MIN_SPACING);
      const startXForLevel = startX;
      
      let x = startXForLevel;
      
      // Сортируем элементы уровня для более логичного порядка
      const sortedLevelElements = [...levelElements].sort((a, b) => {
        // Элементы с одним parentId рядом
        if (a.parentId !== b.parentId) {
          return (a.parentId || '').localeCompare(b.parentId || '');
        }
        return a.name.localeCompare(b.name);
      });

      for (const el of sortedLevelElements) {
        positions.set(el.id, {
          x: Math.round(x / GRID_STEP) * GRID_STEP,
          y: Math.round(y / GRID_STEP) * GRID_STEP
        });
        x += NODE_WIDTH + MIN_SPACING;
        maxX = Math.max(maxX, x);
      }
    }

    return maxX;
  }

  // Размещаем корневые элементы (SOURCE будут первыми благодаря сортировке)
  let globalMaxX = CANVAS_MARGIN;
  
  if (sortedRootElements.length > 0) {
    const maxX = layoutGroup(sortedRootElements, currentX, currentY);
    globalMaxX = Math.max(globalMaxX, maxX);
    currentY += (Math.max(...sortedRootElements.map(e => levels.get(e.id) || 0)) + 2) * LAYER_HEIGHT;
  }

  // Размещаем элементы внутри каждого Cabinet
  // Сортируем кабинеты по названию для предсказуемого порядка
  const sortedCabinetEntries = [...groups.entries()]
    .filter((entry): entry is [string, LayoutElement[]] => entry[0] !== null)
    .sort((a, b) => {
      const nameA = cabinetNames.get(a[0]) || '';
      const nameB = cabinetNames.get(b[0]) || '';
      return nameA.localeCompare(nameB);
    });

  for (const [cabinetId, cabinetElements] of sortedCabinetEntries) {
    if (!cabinetId) continue;

    const maxX = layoutGroup(cabinetElements, currentX, currentY);
    const maxLevel = Math.max(...cabinetElements.map(e => levels.get(e.id) || 0));

    // Сохраняем границы Cabinet
    const cabinetName = cabinetNames.get(cabinetId) || 'Cabinet';
    const cabinetWidth = maxX - currentX + NODE_WIDTH + CABINET_PADDING;
    const cabinetHeight = (maxLevel + 2) * LAYER_HEIGHT + CABINET_PADDING;
    
    cabinetBounds.set(cabinetId, {
      x: currentX - CABINET_PADDING / 2,
      y: currentY - CABINET_PADDING / 2,
      width: cabinetWidth,
      height: cabinetHeight,
      name: cabinetName
    });

    globalMaxX = Math.max(globalMaxX, currentX + cabinetWidth);

    // Переходим к следующему Cabinet (горизонтально)
    currentX = maxX + GRID_STEP * 3;

    // Если слишком широко, переходим на новую строку
    if (currentX > 1500) {
      currentX = CANVAS_MARGIN;
      currentY += (maxLevel + 3) * LAYER_HEIGHT;
    }
  }

  // ============== РАСЧЁТ OFFSETS ДЛЯ ЛИНИЙ ==============
  // Группируем связи между одинаковыми парами узлов
  const edgeGroups = new Map<string, LayoutConnection[]>();
  for (const conn of connections) {
    const key = `${conn.sourceId}-${conn.targetId}`;
    if (!edgeGroups.has(key)) edgeGroups.set(key, []);
    edgeGroups.get(key)!.push(conn);
  }

  // Вычисляем смещение для каждой связи
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

  // Также обрабатываем связи между разными парами узлов, идущие параллельно
  // Группируем по уровням источника и приёмника
  const edgesByLevels = new Map<string, LayoutConnection[]>();
  for (const conn of connections) {
    const sourceLevel = levels.get(conn.sourceId) || 0;
    const targetLevel = levels.get(conn.targetId) || 0;
    const key = `${sourceLevel}-${targetLevel}`;
    if (!edgesByLevels.has(key)) edgesByLevels.set(key, []);
    edgesByLevels.get(key)!.push(conn);
  }

  // Добавляем дополнительные смещения для связей между одинаковыми уровнями
  for (const [, conns] of edgesByLevels) {
    if (conns.length > 1) {
      conns.forEach((conn, index) => {
        const existing = edgeOffsets.get(conn.id);
        if (existing) {
          // Добавляем дополнительное смещение для избежания пересечений
          existing.offset += (index - (conns.length - 1) / 2) * (EDGE_SPACING / 2);
        } else {
          const sourcePos = positions.get(conn.sourceId);
          const targetPos = positions.get(conn.targetId);
          
          if (sourcePos && targetPos) {
            const baseOffset = (index - (conns.length - 1) / 2) * EDGE_SPACING;
            const controlPoints = calculateControlPoints(
              sourcePos.x, sourcePos.y,
              targetPos.x, targetPos.y,
              baseOffset
            );
            
            edgeOffsets.set(conn.id, {
              connectionId: conn.id,
              offset: baseOffset,
              controlPoints,
            });
          }
        }
      });
    }
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

## 1. Вертикальные уровни (сверху вниз)

| Уровень | Тип элемента | Описание |
|---------|--------------|----------|
| 0 | SOURCE | Источники питания (ВСЕГДА ВВЕРХУ) |
| 1 | JUNCTION | Узлы разветвления |
| 2 | BREAKER | Автоматические выключатели |
| 3 | BUS | Шины распределения |
| 4 | METER | Счётчики учёта |
| 5 | LOAD | Потребители (ВСЕГДА ВНИЗУ) |

## 2. Горизонтальное размещение

- Элементы одного уровня размещаются слева направо
- Минимальное расстояние между элементами: ${MIN_SPACING}px
- Схема расширяется горизонтально для размещения всех элементов

## 3. Линии связей (Connections)

- Все линии ортогональные (горизонтальные и вертикальные сегменты)
- Параллельные линии имеют смещение друг от друга: ${EDGE_SPACING}px
- Линии не пересекают элементы, к которым они не подключены

## 4. Границы Cabinet

- Элементы одного Cabinet группируются в одной области
- Границы обозначаются пунктирной линией
- Cabinet размещаются слева направо

## 5. Иерархия питания

SOURCE → JUNCTION → BREAKER → BUS → METER → LOAD

Источники питания (SOURCE) всегда располагаются в верхней части схемы.
Потребители (LOAD) всегда располагаются в нижней части схемы.
`;
}

/**
 * ============================================================================
 * РАСЧЁТ МОЩНОСТЕЙ
 * ============================================================================
 *
 * ЛОГИКА:
 *
 * Для LOAD (нагрузка):
 *   - Pуст = powerP (установленная мощность)
 *   - Pрасч = Pуст × Ки (расчётная мощность)
 *   - Для ΔU используется Pуст
 *
 * Для остальных элементов (BREAKER, BUS, JUNCTION, CABINET):
 *   - sumPInstalled = Σ(Pуст всех нагрузок ниже)
 *   - sumPCalculated = Σ(Pрасч всех нагрузок ниже)
 *   - Для ΔU используется Pрасч
 *
 * SOURCE:
 *   - Не накапливает мощность, только генерирует
 *
 * Алгоритм:
 *   1. Топологическая сортировка по глубине от LOAD
 *   2. Обработка в порядке убывания глубины (сначала LOAD, потом родители)
 *   3. Гарантирует полную сумму мощности в junction с несколькими входами
 */

import { prisma } from './prisma';

export interface PowerResult {
  elementsUpdated: number;
  totalPInstalled: number;
  totalPCalculated: number;
  loadCount: number;
}

/**
 * Главная функция расчёта мощностей
 * Использует топологическую сортировку для корректного суммирования
 */
export async function calculatePower(): Promise<PowerResult> {
  // Получаем все элементы с устройствами
  const elements = await prisma.element.findMany({
    include: {
      DeviceSlot: {
        include: {
          Device: {
            include: {
              Load: true,
              Breaker: true,
              Meter: true,
              Transformer: true,
            },
          },
        },
      },
    },
  });

  const connections = await prisma.connection.findMany();

  // Мапы для быстрого доступа
  const elementMap = new Map<string, typeof elements[0]>();
  for (const el of elements) {
    elementMap.set(el.id, el);
  }

  // Мапа мощностей
  const powerMap = new Map<string, { pInstalled: number; pCalculated: number }>();

  // =========================================================================
  // Структуры связей
  // =========================================================================
  // outgoingConnections[elementId] = [connections где elementId является source]
  // Это связи, идущие ОТ этого элемента К нижестоящим (в направлении потока энергии)
  const outgoingConnections = new Map<string, string[]>();
  
  // incomingConnections[elementId] = [connections где elementId является target]
  // Это связи, идущие К этому элементу от вышестоящих
  const incomingConnections = new Map<string, string[]>();
  
  const connectionMap = new Map<string, typeof connections[0]>();

  for (const conn of connections) {
    connectionMap.set(conn.id, conn);

    // Исходящие связи (где элемент является source)
    if (!outgoingConnections.has(conn.sourceId)) {
      outgoingConnections.set(conn.sourceId, []);
    }
    outgoingConnections.get(conn.sourceId)!.push(conn.id);

    // Входящие связи (где элемент является target)
    if (!incomingConnections.has(conn.targetId)) {
      incomingConnections.set(conn.targetId, []);
    }
    incomingConnections.get(conn.targetId)!.push(conn.id);
  }

  // =========================================================================
  // ШАГ 1: Инициализация LOAD элементов
  // =========================================================================
  const loads = elements.filter(el => el.type.toLowerCase() === 'load');

  for (const load of loads) {
    // Находим устройство Load
    const deviceSlot = load.DeviceSlot?.[0];
    const device = deviceSlot?.Device?.[0];
    const loadData = device?.Load;

    // Pуст = установленная мощность
    const pInstalled = loadData?.powerP || 0;
    // Ки = коэффициент использования (по умолчанию 0.8)
    const usageFactor = loadData?.usageFactor || 0.8;
    // Pрасч = Pуст × Ки
    const pCalculated = pInstalled * usageFactor;

    powerMap.set(load.id, { pInstalled, pCalculated });
  }

  // =========================================================================
  // ШАГ 2: Вычисление глубины каждого элемента от LOAD
  // =========================================================================
  // Глубина = минимальное количество связей до ближайшей нагрузки
  // LOAD = глубина 0, элемент над LOAD = глубина 1, и т.д.
  
  const depthMap = new Map<string, number>();
  const queue: { id: string; depth: number }[] = [];

  // Начинаем с LOAD (глубина 0)
  for (const load of loads) {
    queue.push({ id: load.id, depth: 0 });
    depthMap.set(load.id, 0);
  }

  // BFS для вычисления глубин
  while (queue.length > 0) {
    const { id: currentId, depth } = queue.shift()!;
    const currentElement = elementMap.get(currentId);
    if (!currentElement) continue;

    // Получаем ВХОДЯЩИЕ связи (от вышестоящих элементов)
    const incoming = incomingConnections.get(currentId) || [];

    for (const connId of incoming) {
      const conn = connectionMap.get(connId);
      if (!conn) continue;

      // sourceId - это вышестоящий (родительский) элемент
      const parentId = conn.sourceId;
      
      // SOURCE не учитываем
      const parentElement = elementMap.get(parentId);
      if (!parentElement || parentElement.type.toLowerCase() === 'source') continue;

      // Если родитель ещё не имеет глубины или найден более короткий путь
      if (!depthMap.has(parentId) || depthMap.get(parentId)! > depth + 1) {
        depthMap.set(parentId, depth + 1);
        queue.push({ id: parentId, depth: depth + 1 });
      }
    }
  }

  // =========================================================================
  // ШАГ 3: Сортировка элементов по глубине (от меньшего к большему)
  // =========================================================================
  // Элементы с меньшей глубиной (ближе к LOAD) обрабатываются первыми
  // Это гарантирует, что все дети обработаны до родителей
  
  const sortedElements = Array.from(depthMap.entries())
    .filter(([id]) => {
      const el = elementMap.get(id);
      return el && el.type.toLowerCase() !== 'load'; // LOAD уже инициализирован
    })
    .sort((a, b) => a[1] - b[1]); // Сортировка по возрастанию глубины (сначала близкие к LOAD)

  // =========================================================================
  // ШАГ 4: Суммирование мощностей в топологическом порядке
  // =========================================================================
  // Для каждого элемента: суммируем мощности всех детей
  
  for (const [elementId] of sortedElements) {
    const element = elementMap.get(elementId);
    if (!element) continue;

    // Инициализируем мощность элемента
    if (!powerMap.has(elementId)) {
      powerMap.set(elementId, { pInstalled: 0, pCalculated: 0 });
    }

    // Получаем ИСХОДЯЩИЕ связи (к нижестоящим элементам = детям)
    const outgoing = outgoingConnections.get(elementId) || [];

    for (const connId of outgoing) {
      const conn = connectionMap.get(connId);
      if (!conn) continue;

      // Проверяем operationalStatus связи
      if (conn.operationalStatus === 'OFF') continue;

      const childId = conn.targetId;
      const childElement = elementMap.get(childId);
      if (!childElement) continue;

      // Проверяем operationalStatus ребёнка
      if (childElement.operationalStatus === 'OFF') continue;

      // Получаем мощность ребёнка
      const childPower = powerMap.get(childId);
      if (!childPower) continue;

      // Добавляем мощность ребёнка к текущему элементу
      const currentPower = powerMap.get(elementId)!;
      currentPower.pInstalled += childPower.pInstalled;
      currentPower.pCalculated += childPower.pCalculated;
    }
  }

  // =========================================================================
  // ШАГ 5: Сохранение в БД
  // =========================================================================
  let elementsUpdated = 0;

  for (const [id, power] of powerMap) {
    const element = elementMap.get(id);
    if (!element) continue;

    // Для LOAD не обновляем sumPInstalled/sumPCalculated (они хранятся в Load)
    if (element.type.toLowerCase() === 'load') continue;

    try {
      await prisma.element.update({
        where: { id },
        data: {
          sumPInstalled: power.pInstalled,
          sumPCalculated: power.pCalculated,
          updatedAt: new Date(),
        },
      });
      elementsUpdated++;
    } catch (e) {
      console.error(`Ошибка обновления элемента ${id}:`, e);
    }
  }

  // =========================================================================
  // Статистика
  // =========================================================================
  let totalPInstalled = 0;
  let totalPCalculated = 0;

  for (const load of loads) {
    const power = powerMap.get(load.id);
    if (power) {
      totalPInstalled += power.pInstalled;
      totalPCalculated += power.pCalculated;
    }
  }

  return {
    elementsUpdated,
    totalPInstalled,
    totalPCalculated,
    loadCount: loads.length,
  };
}

/**
 * Получить мощность для расчёта потерь напряжения
 * Для LOAD: Pуст
 * Для остальных: Pрасч
 */
export function getPowerForVoltageDrop(
  elementType: string,
  sumPInstalled: number | null,
  sumPCalculated: number | null,
  loadPowerP?: number
): number {
  const type = elementType.toLowerCase();

  if (type === 'load') {
    // Для нагрузки используем Pуст
    return loadPowerP || sumPInstalled || 0;
  }

  // Для остальных элементов используем Pрасч
  return sumPCalculated || 0;
}

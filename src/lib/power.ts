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
 *   1. Обратный BFS от LOAD вверх к SOURCE
 *   2. Учитываем operationalStatus - если элемент OFF, мощность не передаётся
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
 * Выполняет обратный BFS от нагрузок вверх к источникам
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

  // Структуры связей
  // incomingConnections[elementId] = [connections где elementId является target]
  // т.е. связи, идущие К этому элементу (от вышестоящих в направлении потока энергии)
  const incomingConnections = new Map<string, string[]>();
  const connectionMap = new Map<string, typeof connections[0]>();

  for (const conn of connections) {
    connectionMap.set(conn.id, conn);

    // Входящие связи (где этот элемент является target)
    if (!incomingConnections.has(conn.targetId)) {
      incomingConnections.set(conn.targetId, []);
    }
    incomingConnections.get(conn.targetId)!.push(conn.id);
  }

  // =========================================================================
  // ШАГ 1: Инициализация LOAD элементов
  // =========================================================================
  const loads = elements.filter(el => el.type.toLowerCase() === 'load');
  const queue: string[] = [];

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
    queue.push(load.id);
  }

  // =========================================================================
  // ШАГ 2: Обратный BFS - распространение мощности ВВЕРХ от LOAD к SOURCE
  // =========================================================================
  // Структура графа: SOURCE → (connection) → BREAKER → ... → LOAD
  // sourceId = вышестоящий элемент, targetId = нижестоящий элемент
  // Для обхода ВВЕРХ нужно использовать incomingConnections (где элемент = target)
  // и получать sourceId этой связи (родительский элемент)

  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentElement = elementMap.get(currentId);
    if (!currentElement) continue;

    // SOURCE не накапливает мощность
    if (currentElement.type.toLowerCase() === 'source') continue;

    // Получаем мощность текущего элемента
    const currentPower = powerMap.get(currentId) || { pInstalled: 0, pCalculated: 0 };

    // Получаем ВХОДЯЩИЕ связи (где currentId является target)
    // Это связи ОТ вышестоящих элементов К этому элементу
    const incoming = incomingConnections.get(currentId) || [];

    for (const connId of incoming) {
      const conn = connectionMap.get(connId);
      if (!conn) continue;

      // Проверяем operationalStatus связи
      if (conn.operationalStatus === 'OFF') continue;

      // Проверяем operationalStatus текущего элемента
      if (currentElement.operationalStatus === 'OFF') continue;

      // sourceId - это вышестоящий (родительский) элемент
      const parentId = conn.sourceId;
      const parentElement = elementMap.get(parentId);
      if (!parentElement) continue;

      // SOURCE не накапливает, пропускаем
      if (parentElement.type.toLowerCase() === 'source') continue;

      // Добавляем мощность текущего элемента к родительскому
      if (!powerMap.has(parentId)) {
        powerMap.set(parentId, { pInstalled: 0, pCalculated: 0 });
      }

      const parentPower = powerMap.get(parentId)!;
      parentPower.pInstalled += currentPower.pInstalled;
      parentPower.pCalculated += currentPower.pCalculated;

      // Добавляем родителя в очередь для дальнейшего распространения
      if (!visited.has(parentId)) {
        queue.push(parentId);
      }
    }
  }

  // =========================================================================
  // ШАГ 3: Сохранение в БД
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

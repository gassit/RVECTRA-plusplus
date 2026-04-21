/**
 * Сервис распространения электрических состояний
 *
 * Реализует алгоритм BFS для распространения статусов LIVE/DEAD от источников питания.
 *
 * Ключевые правила:
 * - ON ≠ LIVE: элемент может быть включен, но без напряжения
 * - OFF → всегда DEAD и блокирует downstream
 * - LIVE через OFF не проходит
 * - Множественные входы: LIVE если хотя бы один вход от LIVE
 * - CABINET = агрегация детей (не участвует в BFS)
 * 
 * АВР (Автоматический Ввод Резерва):
 * - Обрабатывается ПЕРЕД BFS
 * - АВР меняет operationalStatus выключателей
 * - BFS учитывает новые состояния
 */

import { prisma } from '@/lib/prisma';
import type { ElectricalStatus, OperationalStatus, PropagationResult } from '@/types';
import { processAVRs } from './avr.service';

/**
 * Распространяет электрические состояния от источников питания
 */
export async function propagateStates(): Promise<PropagationResult> {
  console.log('[propagateStates] Начало распространения состояний...');

  // === ЭТАП 1: Обработка АВР ===
  // АВР может менять operationalStatus элементов перед BFS
  console.log('[propagateStates] ЭТАП 1: Обработка АВР...');
  const avrResult = await processAVRs();
  console.log(`[propagateStates] АВР обработано: ${avrResult.processed}, переключений: ${avrResult.switchovers}`);

  // === ЭТАП 2: Инициализация ===
  // Установить ВСЕМ элементам и связям electricalStatus = "DEAD"

  const elements = await prisma.element.findMany();
  const connections = await prisma.connection.findMany();

  console.log(`[propagateStates] Найдено элементов: ${elements.length}`);
  console.log(`[propagateStates] Найдено связей: ${connections.length}`);

  // Создаем мапы для быстрого доступа
  const elementMap = new Map<string, typeof elements[0]>();
  const elementIdToDbId = new Map<string, string>();

  for (const el of elements) {
    elementMap.set(el.id, el);
    elementIdToDbId.set(el.elementId, el.id);
  }

  // Мапы для отслеживания состояний
  const electricalStatusMap = new Map<string, ElectricalStatus>();
  const operationalStatusMap = new Map<string, OperationalStatus>();

  // Инициализация: все элементы DEAD
  for (const el of elements) {
    electricalStatusMap.set(el.id, 'DEAD');
    operationalStatusMap.set(el.id, (el.operationalStatus as OperationalStatus) || 'ON');
  }

  // === ЭТАП 3: BFS от SOURCE downstream ===

  // Структуры для BFS
  const outgoingConnections = new Map<string, string[]>(); // elementId -> connection ids
  const connectionMap = new Map<string, typeof connections[0]>();

  for (const conn of connections) {
    connectionMap.set(conn.id, conn);

    if (!outgoingConnections.has(conn.sourceId)) {
      outgoingConnections.set(conn.sourceId, []);
    }
    outgoingConnections.get(conn.sourceId)!.push(conn.id);
  }

  // Найти все SOURCE элементы
  const sources = elements.filter(el => el.type.toLowerCase() === 'source');
  console.log(`[propagateStates] Найдено источников: ${sources.length}`);

  // Очередь BFS: пары (elementId, connectionId) - connectionId null для source
  const queue: Array<{ elementId: string; fromConnectionId: string | null }> = [];

  // Инициализация источников
  for (const source of sources) {
    const opStatus = operationalStatusMap.get(source.id) || 'ON';
    if (opStatus === 'ON') {
      electricalStatusMap.set(source.id, 'LIVE');
      console.log(`[propagateStates] SOURCE "${source.name}" -> LIVE`);
    } else {
      electricalStatusMap.set(source.id, 'DEAD');
      console.log(`[propagateStates] SOURCE "${source.name}" -> DEAD (OFF)`);
    }
    queue.push({ elementId: source.id, fromConnectionId: null });
  }

  // Множество посещенных элементов (для избежания повторной обработки)
  const visited = new Set<string>();

  // BFS
  while (queue.length > 0) {
    const { elementId, fromConnectionId } = queue.shift()!;

    // Получаем текущий элемент
    const currentElement = elementMap.get(elementId);
    if (!currentElement) continue;

    // Пропускаем CABINET при BFS (он обрабатывается на этапе пост-обработки)
    if (currentElement.type.toLowerCase() === 'cabinet') {
      continue;
    }

    // Определяем, является ли текущий элемент LIVE
    const currentElectrical = electricalStatusMap.get(elementId) || 'DEAD';
    const currentOperational = operationalStatusMap.get(elementId) || 'ON';

    // Обрабатываем исходящие связи
    const outgoing = outgoingConnections.get(elementId) || [];

    for (const connId of outgoing) {
      const conn = connectionMap.get(connId);
      if (!conn) continue;

      const targetId = conn.targetId;
      const targetElement = elementMap.get(targetId);

      if (!targetElement) continue;

      // Пропускаем CABINET в BFS
      if (targetElement.type.toLowerCase() === 'cabinet') {
        continue;
      }

      const connOperational = (conn.operationalStatus as OperationalStatus) || 'ON';
      const targetOperational = operationalStatusMap.get(targetId) || 'ON';

      // Проверяем условия для LIVE:
      // 1. source.electricalStatus === "LIVE"
      // 2. source.operationalStatus === "ON"
      // 3. connection.operationalStatus === "ON"
      // 4. target.operationalStatus === "ON" (для получения LIVE)

      if (currentElectrical === 'LIVE' && currentOperational === 'ON' && connOperational === 'ON') {
        // Связь получает LIVE
        // Целевой элемент получает LIVE только если он ON

        if (targetOperational === 'ON') {
          // Целевой элемент LIVE (если уже не LIVE от другого источника)
          const prevStatus = electricalStatusMap.get(targetId);
          if (prevStatus !== 'LIVE') {
            electricalStatusMap.set(targetId, 'LIVE');
            console.log(`[propagateStates] Element "${targetElement.name}" -> LIVE (from "${currentElement.name}")`);
          }
        } else {
          // Элемент OFF - он DEAD и блокирует downstream
          electricalStatusMap.set(targetId, 'DEAD');
          console.log(`[propagateStates] Element "${targetElement.name}" -> DEAD (OFF)`);
        }
      } else {
        // Связь DEAD
        // Целевой элемент остается DEAD (если не LIVE от другого источника)
        const existingStatus = electricalStatusMap.get(targetId);
        if (existingStatus !== 'LIVE') {
          electricalStatusMap.set(targetId, 'DEAD');
        }
      }

      // Добавляем в очередь если не посещен
      const visitKey = `${elementId}-${targetId}`;
      if (!visited.has(visitKey)) {
        visited.add(visitKey);
        queue.push({ elementId: targetId, fromConnectionId: connId });
      }
    }
  }

  // === ЭТАП 4: CABINET - пост-обработка ===
  // CABINET получает LIVE если хотя бы один дочерний элемент LIVE

  const cabinets = elements.filter(el => el.type.toLowerCase() === 'cabinet');
  console.log(`[propagateStates] Обработка CABINET: ${cabinets.length}`);

  for (const cabinet of cabinets) {
    // Найти все дочерние элементы
    const children = elements.filter(el => el.parentId === cabinet.id);

    if (children.length === 0) {
      // Нет дочерних элементов -> DEAD
      electricalStatusMap.set(cabinet.id, 'DEAD');
      console.log(`[propagateStates] CABINET "${cabinet.name}" -> DEAD (нет детей)`);
    } else {
      // Проверить, есть ли хотя бы один LIVE ребенок
      const hasLiveChild = children.some(child => electricalStatusMap.get(child.id) === 'LIVE');

      if (hasLiveChild) {
        electricalStatusMap.set(cabinet.id, 'LIVE');
        console.log(`[propagateStates] CABINET "${cabinet.name}" -> LIVE (есть LIVE дети)`);
      } else {
        electricalStatusMap.set(cabinet.id, 'DEAD');
        console.log(`[propagateStates] CABINET "${cabinet.name}" -> DEAD (все дети DEAD)`);
      }
    }
  }

  // === ЭТАП 5: Сохранение в БД ===

  // Обновляем элементы
  let elementsUpdated = 0;
  for (const [id, electricalStatus] of electricalStatusMap) {
    try {
      await prisma.element.update({
        where: { id },
        data: { electricalStatus }
      });
      elementsUpdated++;
    } catch (e) {
      console.error(`[propagateStates] Ошибка обновления элемента ${id}:`, e);
    }
  }

  // Обновляем связи (electricalStatus для связей)
  let connectionsUpdated = 0;
  for (const conn of connections) {
    const sourceElectrical = electricalStatusMap.get(conn.sourceId) || 'DEAD';
    const sourceOperational = operationalStatusMap.get(conn.sourceId) || 'ON';
    const connOperational = (conn.operationalStatus as OperationalStatus) || 'ON';

    // Связь LIVE если source LIVE и ON, и связь ON
    const connElectrical: ElectricalStatus =
      (sourceElectrical === 'LIVE' && sourceOperational === 'ON' && connOperational === 'ON')
        ? 'LIVE'
        : 'DEAD';

    try {
      await prisma.connection.update({
        where: { id: conn.id },
        data: { electricalStatus: connElectrical }
      });
      connectionsUpdated++;
    } catch (e) {
      console.error(`[propagateStates] Ошибка обновления связи ${conn.id}:`, e);
    }
  }

  // Подсчет статистики
  const liveElements = Array.from(electricalStatusMap.values()).filter(s => s === 'LIVE').length;
  const deadElements = electricalStatusMap.size - liveElements;
  const offElements = Array.from(operationalStatusMap.values()).filter(s => s === 'OFF').length;

  const result: PropagationResult = {
    elementsUpdated,
    connectionsUpdated,
    liveElements,
    deadElements,
    offElements
  };

  console.log(`[propagateStates] Завершено: ${liveElements} LIVE, ${deadElements} DEAD, ${offElements} OFF`);

  return result;
}

/**
 * Переключает оперативный статус элемента и перераспределяет состояния
 */
export async function toggleElementOperationalStatus(
  elementId: string,
  newStatus: OperationalStatus
): Promise<PropagationResult> {
  console.log(`[toggleOperationalStatus] Элемент ${elementId} -> ${newStatus}`);

  // Обновляем статус элемента
  await prisma.element.update({
    where: { id: elementId },
    data: { operationalStatus: newStatus }
  });

  // Перераспределяем состояния
  return propagateStates();
}

/**
 * Переключает оперативный статус связи и перераспределяет состояния
 */
export async function toggleConnectionOperationalStatus(
  connectionId: string,
  newStatus: OperationalStatus
): Promise<PropagationResult> {
  console.log(`[toggleOperationalStatus] Связь ${connectionId} -> ${newStatus}`);

  // Обновляем статус связи
  await prisma.connection.update({
    where: { id: connectionId },
    data: { operationalStatus: newStatus }
  });

  // Перераспределяем состояния
  return propagateStates();
}

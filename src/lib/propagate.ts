/**
 * ============================================================================
 * БИБЛИОТЕКА РАСПРОСТРАНЕНИЯ СОСТОЯНИЙ
 * ============================================================================
 *
 * ЛОГИКА:
 *
 * electricalStatus (LIVE/DEAD) - физическое наличие напряжения
 * operationalStatus (ON/OFF) - положение выключателя
 *
 * Типы элементов:
 * - SWITCHABLE (имеют operationalStatus): SOURCE, BREAKER, LOAD, METER
 * - PASS_THROUGH (всегда ON): BUS, JUNCTION
 * - CONTAINER: CABINET (статус от дочерних элементов)
 *
 * Правила:
 * 1. SOURCE: electricalStatus = LIVE если operationalStatus = ON
 * 2. CONNECTION: electricalStatus = LIVE если:
 *    - source.electricalStatus = LIVE
 *    - source IS SWITCHABLE AND source.operationalStatus = ON
 *      OR source IS PASS_THROUGH (всегда пропускает)
 *    - connection.operationalStatus = ON
 * 3. ELEMENT (не SOURCE): electricalStatus = connection.electricalStatus
 * 4. PASS_THROUGH элементы всегда пропускают (operationalStatus игнорируется)
 *
 * Пример:
 * SOURCE (ON | LIVE)
 *   └── Connection (ON | LIVE) ──→ BUS (LIVE) ──→ BREAKER (OFF | LIVE) ──→ LOAD (DEAD)
 *                                          ↑              ↑
 *                                     Пропускает    Под напряжением,
 *                                                   но не пропускает
 */

import { prisma } from './prisma';

export type ElectricalStatus = 'LIVE' | 'DEAD';
export type OperationalStatus = 'ON' | 'OFF';

// Типы элементов с operationalStatus (можно включить/выключить)
export const SWITCHABLE_TYPES = ['SOURCE', 'BREAKER', 'LOAD', 'METER'];

// Типы элементов без operationalStatus (всегда пропускают)
export const PASS_THROUGH_TYPES = ['BUS', 'JUNCTION', 'JUNCTIONBOX'];

// Проверка: элемент имеет operationalStatus
export function isSwitchable(type: string): boolean {
  return SWITCHABLE_TYPES.includes(type.toUpperCase());
}

// Проверка: элемент просто пропускает (не имеет operationalStatus)
export function isPassThrough(type: string): boolean {
  return PASS_THROUGH_TYPES.includes(type.toUpperCase());
}

export interface PropagationResult {
  elementsUpdated: number;
  connectionsUpdated: number;
  liveElements: number;
  deadElements: number;
  offElements: number;
  liveConnections: number;
}

/**
 * Основная функция распространения состояний
 * Выполняет полный пересчёт статусов по всей сети
 */
export async function propagateStates(): Promise<PropagationResult> {
  const elements = await prisma.element.findMany();
  const connections = await prisma.connection.findMany();

  // Мапы для быстрого доступа
  const elementMap = new Map<string, typeof elements[0]>();
  for (const el of elements) {
    elementMap.set(el.id, el);
  }

  // Мапы состояний
  const electricalStatusMap = new Map<string, ElectricalStatus>();
  const operationalStatusMap = new Map<string, OperationalStatus>();
  const connectionElectricalMap = new Map<string, ElectricalStatus>();

  // Инициализация
  for (const el of elements) {
    electricalStatusMap.set(el.id, 'DEAD');
    // PASS_THROUGH элементы всегда ON
    if (isPassThrough(el.type)) {
      operationalStatusMap.set(el.id, 'ON');
    } else {
      operationalStatusMap.set(el.id, (el.operationalStatus as OperationalStatus) || 'ON');
    }
  }

  // Структуры связей
  const outgoingConnections = new Map<string, string[]>();
  const connectionMap = new Map<string, typeof connections[0]>();

  for (const conn of connections) {
    connectionMap.set(conn.id, conn);
    if (!outgoingConnections.has(conn.sourceId)) {
      outgoingConnections.set(conn.sourceId, []);
    }
    outgoingConnections.get(conn.sourceId)!.push(conn.id);
  }

  // =========================================================================
  // ШАГ 1: Инициализация источников (SOURCE)
  // =========================================================================
  const sources = elements.filter(el => el.type.toLowerCase() === 'source');
  const queue: string[] = [];

  for (const source of sources) {
    const opStatus = operationalStatusMap.get(source.id) || 'ON';
    const electrical: ElectricalStatus = opStatus === 'ON' ? 'LIVE' : 'DEAD';
    electricalStatusMap.set(source.id, electrical);
    queue.push(source.id);
  }

  // =========================================================================
  // ШАГ 2: BFS распространение по связям
  // =========================================================================
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentElement = elementMap.get(currentId);
    if (!currentElement) continue;

    // Пропускаем CABINET в BFS
    if (currentElement.type.toLowerCase() === 'cabinet') continue;

    const currentElectrical = electricalStatusMap.get(currentId) || 'DEAD';
    const currentOperational = operationalStatusMap.get(currentId) || 'ON';

    const outgoing = outgoingConnections.get(currentId) || [];

    for (const connId of outgoing) {
      const conn = connectionMap.get(connId);
      if (!conn) continue;

      const targetId = conn.targetId;
      const targetElement = elementMap.get(targetId);
      if (!targetElement) continue;

      // Пропускаем CABINET
      if (targetElement.type.toLowerCase() === 'cabinet') continue;

      const connOperational = (conn.operationalStatus as OperationalStatus) || 'ON';

      // =========================================================================
      // КЛЮЧЕВАЯ ЛОГИКА:
      // Connection.electricalStatus зависит от SOURCE элемента
      // =========================================================================
      let elementPassesCurrent = false;

      if (currentElectrical === 'LIVE') {
        if (isPassThrough(currentElement.type)) {
          // PASS_THROUGH элементы (BUS, JUNCTION) всегда пропускают
          elementPassesCurrent = true;
        } else if (currentOperational === 'ON') {
          // SWITCHABLE элементы пропускают только если ON
          elementPassesCurrent = true;
        }
      }

      const connElectrical: ElectricalStatus =
        (elementPassesCurrent && connOperational === 'ON')
          ? 'LIVE'
          : 'DEAD';

      connectionElectricalMap.set(connId, connElectrical);

      // Element.electricalStatus наследуется от ВХОДЯЩЕЙ связи
      const targetElectrical = connElectrical;

      // Обновляем только если не был LIVE (множественные входы - приоритет LIVE)
      if (targetElectrical === 'LIVE' || electricalStatusMap.get(targetId) !== 'LIVE') {
        electricalStatusMap.set(targetId, targetElectrical);
      }

      const visitKey = `${currentId}-${targetId}`;
      if (!visited.has(visitKey)) {
        visited.add(visitKey);
        queue.push(targetId);
      }
    }
  }

  // =========================================================================
  // ШАГ 3: CABINET - пост-обработка
  // =========================================================================
  const cabinets = elements.filter(el => el.type.toLowerCase() === 'cabinet');

  for (const cabinet of cabinets) {
    const children = elements.filter(el => el.parentId === cabinet.id);
    const hasLiveChild = children.some(child => electricalStatusMap.get(child.id) === 'LIVE');
    electricalStatusMap.set(cabinet.id, hasLiveChild ? 'LIVE' : 'DEAD');
  }

  // =========================================================================
  // ШАГ 4: Сохранение в БД
  // =========================================================================
  let elementsUpdated = 0;
  let connectionsUpdated = 0;

  // Обновляем элементы
  for (const [id, electricalStatus] of electricalStatusMap) {
    try {
      await prisma.element.update({
        where: { id },
        data: { electricalStatus }
      });
      elementsUpdated++;
    } catch (e) {
      console.error(`Ошибка обновления элемента ${id}`);
    }
  }

  // Обновляем связи
  for (const [connId, electricalStatus] of connectionElectricalMap) {
    try {
      await prisma.connection.update({
        where: { id: connId },
        data: { electricalStatus }
      });
      connectionsUpdated++;
    } catch (e) {
      console.error(`Ошибка обновления связи ${connId}`);
    }
  }

  // Статистика
  const liveElements = Array.from(electricalStatusMap.values()).filter(s => s === 'LIVE').length;
  const offElements = Array.from(operationalStatusMap.values()).filter(s => s === 'OFF').length;
  const liveConnections = Array.from(connectionElectricalMap.values()).filter(s => s === 'LIVE').length;

  return {
    elementsUpdated,
    connectionsUpdated,
    liveElements,
    deadElements: elements.length - liveElements,
    offElements,
    liveConnections
  };
}

/**
 * Быстрое распространение для одного элемента
 * Используется при создании/обновлении элемента
 */
export async function propagateFromElement(elementId: string): Promise<void> {
  const element = await prisma.element.findUnique({
    where: { id: elementId },
    include: {
      Connection_Connection_sourceIdToElement: true,
      Connection_Connection_targetIdToElement: true
    }
  });

  if (!element) return;

  // Если это SOURCE - запускаем полное распространение
  if (element.type.toLowerCase() === 'source') {
    await propagateStates();
    return;
  }

  // Для обычных элементов - проверяем входящие связи
  const incomingConnections = element.Connection_Connection_targetIdToElement;

  let hasLiveInput = false;

  for (const conn of incomingConnections) {
    const connElectrical = conn.electricalStatus as ElectricalStatus;
    
    // Element.electricalStatus наследуется от ВХОДЯЩЕЙ связи
    if (connElectrical === 'LIVE') {
      hasLiveInput = true;
      break;
    }
  }

  // Устанавливаем статус элемента
  const newElectricalStatus: ElectricalStatus = hasLiveInput ? 'LIVE' : 'DEAD';

  await prisma.element.update({
    where: { id: elementId },
    data: { electricalStatus: newElectricalStatus }
  });

  // Распространяем дальше по исходящим связям
  const outgoingConnections = element.Connection_Connection_sourceIdToElement;
  const elementOperational = (element.operationalStatus as OperationalStatus) || 'ON';

  for (const conn of outgoingConnections) {
    const connOperational = (conn.operationalStatus as OperationalStatus) || 'ON';

    // Определяем, пропускает ли элемент ток
    let elementPassesCurrent = false;
    if (newElectricalStatus === 'LIVE') {
      if (isPassThrough(element.type)) {
        elementPassesCurrent = true;
      } else if (elementOperational === 'ON') {
        elementPassesCurrent = true;
      }
    }

    const connElectrical: ElectricalStatus =
      (elementPassesCurrent && connOperational === 'ON')
        ? 'LIVE'
        : 'DEAD';

    await prisma.connection.update({
      where: { id: conn.id },
      data: { electricalStatus: connElectrical }
    });

    // Рекурсивно обновляем следующие элементы
    await propagateFromElement(conn.targetId);
  }
}

/**
 * Быстрое распространение для одной связи
 * Используется при создании/обновлении связи
 */
export async function propagateFromConnection(connectionId: string): Promise<void> {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    include: {
      Element_Connection_sourceIdToElement: true
    }
  });

  if (!connection) return;

  const sourceElement = connection.Element_Connection_sourceIdToElement;
  const sourceElectrical = sourceElement.electricalStatus as ElectricalStatus;
  const sourceOperational = (sourceElement.operationalStatus as OperationalStatus) || 'ON';
  const connOperational = (connection.operationalStatus as OperationalStatus) || 'ON';

  // Определяем, пропускает ли source элемент ток
  let sourcePassesCurrent = false;
  if (sourceElectrical === 'LIVE') {
    if (isPassThrough(sourceElement.type)) {
      sourcePassesCurrent = true;
    } else if (sourceOperational === 'ON') {
      sourcePassesCurrent = true;
    }
  }

  const connElectrical: ElectricalStatus =
    (sourcePassesCurrent && connOperational === 'ON')
      ? 'LIVE'
      : 'DEAD';

  await prisma.connection.update({
    where: { id: connectionId },
    data: { electricalStatus: connElectrical }
  });

  // Распространяем на target элемент
  await propagateFromElement(connection.targetId);
}

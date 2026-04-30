/**
 * Скрипт для инициализации и распространения состояний в существующей базе данных
 *
 * Запуск: npx tsx scripts/propagate-states.ts
 *
 * ЛОГИКА РАСПРОСТРАНЕНИЯ:
 *
 * electricalStatus (LIVE/DEAD) - физическое наличие напряжения
 * operationalStatus (ON/OFF) - положение выключателя
 *
 * Правила:
 * 1. Element.electricalStatus наследуется от ВХОДЯЩЕЙ Connection
 * 2. Connection.electricalStatus = LIVE если:
 *    - Source.electricalStatus == LIVE
 *    - Source.operationalStatus == ON (элемент пропускает)
 *    - Connection.operationalStatus == ON
 * 3. operationalStatus элемента влияет на ИСХОДЯЩИЕ связи, не на себя
 *
 * Пример:
 * SOURCE (ON | LIVE)
 *   └── Connection (ON | LIVE) ──→ BREAKER (OFF | LIVE) ──→ LOAD (ON | DEAD)
 *                                         ↑
 *                                    BREAKER под напряжением,
 *                                    но не пропускает дальше
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type ElectricalStatus = 'LIVE' | 'DEAD';
type OperationalStatus = 'ON' | 'OFF';

// Мапы для хранения состояний
const electricalStatusMap = new Map<string, ElectricalStatus>();
const operationalStatusMap = new Map<string, OperationalStatus>();
const connectionElectricalMap = new Map<string, ElectricalStatus>();

/**
 * Алгоритм распространения состояний
 */
async function propagateStates(): Promise<void> {
  console.log('=== РАСПРОСТРАНЕНИЕ СОСТОЯНИЙ ===\n');

  const elements = await prisma.element.findMany();
  const connections = await prisma.connection.findMany();

  console.log(`Элементов: ${elements.length}`);
  console.log(`Связей: ${connections.length}\n`);

  // Создаем мапы для быстрого доступа
  const elementMap = new Map<string, typeof elements[0]>();
  for (const el of elements) {
    elementMap.set(el.id, el);
  }

  // Инициализация operationalStatus из БД
  for (const el of elements) {
    operationalStatusMap.set(el.id, (el.operationalStatus as OperationalStatus) || 'ON');
    electricalStatusMap.set(el.id, 'DEAD'); // по умолчанию DEAD
  }

  // Структуры для связей
  const outgoingConnections = new Map<string, string[]>();
  const incomingConnections = new Map<string, string[]>();
  const connectionMap = new Map<string, typeof connections[0]>();

  for (const conn of connections) {
    connectionMap.set(conn.id, conn);

    // Исходящие связи
    if (!outgoingConnections.has(conn.sourceId)) {
      outgoingConnections.set(conn.sourceId, []);
    }
    outgoingConnections.get(conn.sourceId)!.push(conn.id);

    // Входящие связи
    if (!incomingConnections.has(conn.targetId)) {
      incomingConnections.set(conn.targetId, []);
    }
    incomingConnections.get(conn.targetId)!.push(conn.id);
  }

  // =========================================================================
  // ШАГ 1: Инициализация источников (SOURCE)
  // =========================================================================
  const sources = elements.filter(el => el.type.toLowerCase() === 'source');
  console.log(`Источников: ${sources.length}\n`);

  for (const source of sources) {
    const opStatus = operationalStatusMap.get(source.id) || 'ON';
    // SOURCE сам задаёт свой electricalStatus
    const electrical: ElectricalStatus = opStatus === 'ON' ? 'LIVE' : 'DEAD';
    electricalStatusMap.set(source.id, electrical);
    console.log(`SOURCE "${source.name}" -> (${opStatus} | ${electrical})`);
  }

  // =========================================================================
  // ШАГ 2: BFS - распространение по связям
  // =========================================================================
  const queue: string[] = sources.map(s => s.id);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentElement = elementMap.get(currentId);
    if (!currentElement) continue;

    // Пропускаем CABINET в BFS
    if (currentElement.type.toLowerCase() === 'cabinet') continue;

    const currentElectrical = electricalStatusMap.get(currentId) || 'DEAD';
    const currentOperational = operationalStatusMap.get(currentId) || 'ON';

    // Обрабатываем все исходящие связи
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
      const connElectrical: ElectricalStatus =
        (currentElectrical === 'LIVE' && currentOperational === 'ON' && connOperational === 'ON')
          ? 'LIVE'
          : 'DEAD';

      connectionElectricalMap.set(connId, connElectrical);

      // =========================================================================
      // Element.electricalStatus наследуется от ВХОДЯЩЕЙ связи
      // =========================================================================
      // Элемент наследует electricalStatus от связи
      // operationalStatus элемента влияет на ДАЛЬНЕЙШИЕ связи, не на себя
      const targetElectrical = connElectrical; // наследуем от связи

      // Обновляем только если не был LIVE (множественные входы - приоритет LIVE)
      if (targetElectrical === 'LIVE' || electricalStatusMap.get(targetId) !== 'LIVE') {
        electricalStatusMap.set(targetId, targetElectrical);
      }

      console.log(`  ${currentElement.name} (${currentOperational}|${currentElectrical}) --[${connOperational}|${connElectrical}]--> ${targetElement.name} (?|${electricalStatusMap.get(targetId)})`);

      // Добавляем в очередь
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
  console.log(`\nCABINET элементов: ${cabinets.length}`);

  for (const cabinet of cabinets) {
    const children = elements.filter(el => el.parentId === cabinet.id);

    if (children.length === 0) {
      electricalStatusMap.set(cabinet.id, 'DEAD');
    } else {
      const hasLiveChild = children.some(child => electricalStatusMap.get(child.id) === 'LIVE');
      electricalStatusMap.set(cabinet.id, hasLiveChild ? 'LIVE' : 'DEAD');
    }
    console.log(`CABINET "${cabinet.name}" -> (?|${electricalStatusMap.get(cabinet.id)})`);
  }

  // =========================================================================
  // ШАГ 4: Сохранение в БД
  // =========================================================================
  console.log('\n=== СОХРАНЕНИЕ В БД ===');

  let elementsUpdated = 0;
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

  let connectionsUpdated = 0;
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

  // =========================================================================
  // СТАТИСТИКА
  // =========================================================================
  const liveElements = Array.from(electricalStatusMap.values()).filter(s => s === 'LIVE').length;
  const deadElements = Array.from(electricalStatusMap.values()).filter(s => s === 'DEAD').length;
  const offElements = Array.from(operationalStatusMap.values()).filter(s => s === 'OFF').length;
  const liveConnections = Array.from(connectionElectricalMap.values()).filter(s => s === 'LIVE').length;

  console.log('\n=== РЕЗУЛЬТАТ ===');
  console.log(`Обновлено элементов: ${elementsUpdated}`);
  console.log(`Обновлено связей: ${connectionsUpdated}`);
  console.log(`\nЭлементы:`);
  console.log(`  LIVE: ${liveElements}`);
  console.log(`  DEAD: ${deadElements}`);
  console.log(`  OFF (operational): ${offElements}`);
  console.log(`\nСвязи:`);
  console.log(`  LIVE: ${liveConnections}`);
  console.log(`  DEAD: ${connections.length - liveConnections}`);

  await prisma.$disconnect();
}

propagateStates()
  .catch((e) => {
    console.error('Критическая ошибка:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

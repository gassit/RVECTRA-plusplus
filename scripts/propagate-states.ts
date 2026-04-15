/**
 * Скрипт для инициализации и распространения состояний в существующей базе данных
 * 
 * Запуск: npx tsx scripts/propagate-states.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type ElectricalStatus = 'LIVE' | 'DEAD';
type OperationalStatus = 'ON' | 'OFF';

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

  // Мапы для отслеживания состояний
  const electricalStatusMap = new Map<string, ElectricalStatus>();
  const operationalStatusMap = new Map<string, OperationalStatus>();

  // Инициализация: все элементы DEAD
  for (const el of elements) {
    electricalStatusMap.set(el.id, 'DEAD');
    operationalStatusMap.set(el.id, (el.operationalStatus as OperationalStatus) || 'ON');
  }

  // Структуры для BFS
  const outgoingConnections = new Map<string, string[]>();
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
  console.log(`Источников: ${sources.length}\n`);

  // Очередь BFS
  const queue: Array<{ elementId: string }> = [];

  // Инициализация источников
  for (const source of sources) {
    const opStatus = operationalStatusMap.get(source.id) || 'ON';
    if (opStatus === 'ON') {
      electricalStatusMap.set(source.id, 'LIVE');
      console.log(`SOURCE "${source.name}" -> LIVE`);
    } else {
      electricalStatusMap.set(source.id, 'DEAD');
      console.log(`SOURCE "${source.name}" -> DEAD (OFF)`);
    }
    queue.push({ elementId: source.id });
  }

  // Множество посещенных
  const visited = new Set<string>();

  // BFS
  while (queue.length > 0) {
    const { elementId } = queue.shift()!;
    const currentElement = elementMap.get(elementId);
    if (!currentElement) continue;

    // Пропускаем CABINET при BFS
    if (currentElement.type.toLowerCase() === 'cabinet') continue;

    const currentElectrical = electricalStatusMap.get(elementId) || 'DEAD';
    const currentOperational = operationalStatusMap.get(elementId) || 'ON';

    const outgoing = outgoingConnections.get(elementId) || [];

    for (const connId of outgoing) {
      const conn = connectionMap.get(connId);
      if (!conn) continue;

      const targetId = conn.targetId;
      const targetElement = elementMap.get(targetId);
      if (!targetElement) continue;

      // Пропускаем CABINET в BFS
      if (targetElement.type.toLowerCase() === 'cabinet') continue;

      const connOperational = (conn.operationalStatus as OperationalStatus) || 'ON';
      const targetOperational = operationalStatusMap.get(targetId) || 'ON';

      if (currentElectrical === 'LIVE' && currentOperational === 'ON' && connOperational === 'ON') {
        if (targetOperational === 'ON') {
          const prevStatus = electricalStatusMap.get(targetId);
          if (prevStatus !== 'LIVE') {
            electricalStatusMap.set(targetId, 'LIVE');
            console.log(`"${targetElement.name}" -> LIVE (от "${currentElement.name}")`);
          }
        } else {
          electricalStatusMap.set(targetId, 'DEAD');
          console.log(`"${targetElement.name}" -> DEAD (OFF)`);
        }
      } else {
        const existingStatus = electricalStatusMap.get(targetId);
        if (existingStatus !== 'LIVE') {
          electricalStatusMap.set(targetId, 'DEAD');
        }
      }

      const visitKey = `${elementId}-${targetId}`;
      if (!visited.has(visitKey)) {
        visited.add(visitKey);
        queue.push({ elementId: targetId });
      }
    }
  }

  // CABINET - пост-обработка
  const cabinets = elements.filter(el => el.type.toLowerCase() === 'cabinet');
  console.log(`\nCABINET элементов: ${cabinets.length}`);

  for (const cabinet of cabinets) {
    const children = elements.filter(el => el.parentId === cabinet.id);

    if (children.length === 0) {
      electricalStatusMap.set(cabinet.id, 'DEAD');
    } else {
      const hasLiveChild = children.some(child => electricalStatusMap.get(child.id) === 'LIVE');
      electricalStatusMap.set(cabinet.id, hasLiveChild ? 'LIVE' : 'DEAD');
      console.log(`CABINET "${cabinet.name}" -> ${hasLiveChild ? 'LIVE' : 'DEAD'}`);
    }
  }

  // Обновляем элементы
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

  // Обновляем связи
  let connectionsUpdated = 0;
  for (const conn of connections) {
    const sourceElectrical = electricalStatusMap.get(conn.sourceId) || 'DEAD';
    const sourceOperational = operationalStatusMap.get(conn.sourceId) || 'ON';
    const connOperational = (conn.operationalStatus as OperationalStatus) || 'ON';

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
      console.error(`Ошибка обновления связи ${conn.id}`);
    }
  }

  // Статистика
  const liveElements = Array.from(electricalStatusMap.values()).filter(s => s === 'LIVE').length;
  const offElements = Array.from(operationalStatusMap.values()).filter(s => s === 'OFF').length;

  console.log('\n=== РЕЗУЛЬТАТ ===');
  console.log(`Обновлено элементов: ${elementsUpdated}`);
  console.log(`Обновлено связей: ${connectionsUpdated}`);
  console.log(`LIVE элементов: ${liveElements}`);
  console.log(`DEAD элементов: ${elements.length - liveElements}`);
  console.log(`OFF элементов: ${offElements}`);

  await prisma.$disconnect();
}

propagateStates()
  .catch((e) => {
    console.error('Критическая ошибка:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

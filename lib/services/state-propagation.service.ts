// ============================================================================
// СЕРВИС РАСПРОСТРАНЕНИЯ ЭЛЕКТРИЧЕСКИХ СОСТОЯНИЙ
// BFS от SOURCE downstream, CABINET — агрегация дочерних
// Обнаружение двойного питания (DOUBLE_FEED)
// ============================================================================

import { prisma } from '@/lib/prisma';
import type { PowerConflict, PropagationResult } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = prisma;

/**
 * Распространение электрических состояний по сети.
 *
 * Алгоритм:
 * 1. Инициализация: ВСЕ элементы и связи → DEAD
 * 2. BFS от SOURCE downstream (CABINET пропускается)
 *    — каждый элемент хранит множество ID источников, от которых получил LIVE
 * 3. POST-PROCESSING: CABINET = агрегация дочерних элементов
 * 4. Обнаружение конфликтов: элементы с >1 источником → DOUBLE_FEED
 * 5. Создание Alarm записей для конфликтов
 * 6. Сохранение в БД
 */
export async function propagateStates(): Promise<PropagationResult> {
  // ==========================================================================
  // ЭТАП 1 — Инициализация: все DEAD
  // ==========================================================================
  await db.element.updateMany({
    data: { electricalStatus: 'DEAD' },
  });

  await db.connection.updateMany({
    data: { electricalStatus: 'DEAD' },
  });

  // ==========================================================================
  // ЭТАП 2 — BFS от SOURCE downstream
  // ==========================================================================

  // Загружаем ВСЕ элементы и связи в память для быстрого обхода
  const allElements = await db.element.findMany({
    select: {
      id: true,
      elementId: true,
      name: true,
      type: true,
      operationalStatus: true,
      electricalStatus: true,
    },
  });

  const allConnections = await db.connection.findMany({
    select: {
      id: true,
      sourceId: true,
      targetId: true,
      operationalStatus: true,
    },
  });

  // Строим карту элементов
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementMap = new Map<string, any>();
  for (const el of allElements) {
    elementMap.set(el.id, { ...el, _electricalStatus: 'DEAD' });
  }

  // Строим adjacency list: sourceId → список исходящих связей
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adjacencyOut = new Map<string, any[]>();
  for (const el of allElements) {
    adjacencyOut.set(el.id, []);
  }
  for (const conn of allConnections) {
    const out = adjacencyOut.get(conn.sourceId);
    if (out) {
      out.push(conn);
    }
  }

  // ==========================================================================
  // ОТСЛЕЖИВАНИЕ ИСТОЧНИКОВ ПИТАНИЯ
  // Для каждого элемента храним множество ID источников, от которых пришёл LIVE
  // ==========================================================================
  const elementLiveSources = new Map<string, Set<string>>();

  // Собираем все SOURCE
  const sources = allElements.filter((el: { type: string }) => el.type === 'SOURCE');

  // Запускаем BFS
  const queue: string[] = [];

  for (const source of sources) {
    const el = elementMap.get(source.id);
    if (!el) continue;

    // SOURCE: ON → LIVE, OFF → DEAD
    if (el.operationalStatus === 'ON') {
      el._electricalStatus = 'LIVE';
      // Источник помечает сам себя
      const sourceSet = new Set<string>();
      sourceSet.add(source.id);
      elementLiveSources.set(source.id, sourceSet);
      queue.push(source.id);
    }
  }

  // BFS
  const visited = new Set<string>(queue);
  let head = 0;

  while (head < queue.length) {
    const currentId = queue[head++];
    const currentEl = elementMap.get(currentId);
    if (!currentEl) continue;

    // Текущие источники питания для текущего элемента
    const currentSources = elementLiveSources.get(currentId) || new Set<string>();

    const outConnections = adjacencyOut.get(currentId) || [];

    for (const conn of outConnections) {
      const targetEl = elementMap.get(conn.targetId);
      if (!targetEl) continue;

      // CABINET пропускается при BFS — не участвует как pass-through
      if (targetEl.type === 'CABINET') {
        // Соединение к CABINET: проверяем, доходит ли до него напряжение
        if (
          currentEl._electricalStatus === 'LIVE' &&
          currentEl.operationalStatus === 'ON' &&
          conn.operationalStatus === 'ON'
        ) {
          conn._electricalStatus = 'LIVE';
          // CABINET получает источники от текущего элемента
          const cabSources = elementLiveSources.get(conn.targetId) || new Set<string>();
          for (const srcId of currentSources) {
            cabSources.add(srcId);
          }
          elementLiveSources.set(conn.targetId, cabSources);
        } else {
          conn._electricalStatus = 'DEAD';
        }
        continue;
      }

      // Обычный элемент (не CABINET)
      if (
        currentEl._electricalStatus === 'LIVE' &&
        currentEl.operationalStatus === 'ON' &&
        conn.operationalStatus === 'ON'
      ) {
        // Напряжение проходит через связь
        conn._electricalStatus = 'LIVE';

        // Передаём источники питания дальше
        const targetSources = elementLiveSources.get(conn.targetId) || new Set<string>();
        for (const srcId of currentSources) {
          targetSources.add(srcId);
        }
        elementLiveSources.set(conn.targetId, targetSources);

        // Если target ON → он становится LIVE
        if (targetEl.operationalStatus === 'ON') {
          if (targetEl._electricalStatus !== 'LIVE') {
            targetEl._electricalStatus = 'LIVE';
            if (!visited.has(conn.targetId)) {
              visited.add(conn.targetId);
              queue.push(conn.targetId);
            }
          }
        }
        // Если target OFF — он остаётся DEAD, downstream не получает
      } else {
        conn._electricalStatus = 'DEAD';
      }
    }
  }

  // ==========================================================================
  // ЭТАП 3 — CABINET: POST-PROCESSING (агрегация дочерних)
  // ==========================================================================

  const cabinets = await db.element.findMany({
    where: { type: 'CABINET' },
    include: {
      children: {
        select: {
          id: true,
          electricalStatus: true,
        },
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cabinetUpdates: any[] = [];

  for (const cabinet of cabinets) {
    const children = cabinet.children || [];

    if (children.length === 0) {
      cabinetUpdates.push({
        id: cabinet.id,
        electricalStatus: 'DEAD',
      });
    } else {
      const hasLiveChild = children.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (child: any) => {
          const bfsResult = elementMap.get(child.id);
          if (bfsResult && bfsResult._electricalStatus === 'LIVE') return true;
          if (child.electricalStatus === 'LIVE') return true;
          return false;
        }
      );

      cabinetUpdates.push({
        id: cabinet.id,
        electricalStatus: hasLiveChild ? 'LIVE' : 'DEAD',
      });
    }
  }

  // ==========================================================================
  // ЭТАП 4 — Обнаружение конфликтов двойного питания
  // ==========================================================================

  const conflicts: PowerConflict[] = [];

  for (const [elementId, sources] of elementLiveSources) {
    if (sources.size > 1) {
      const element = elementMap.get(elementId);
      const sourceNames: string[] = [];

      for (const srcId of sources) {
        const src = elementMap.get(srcId);
        if (src) sourceNames.push(src.name || src.elementId || srcId);
      }

      conflicts.push({
        elementId,
        elementName: element?.name || element?.elementId || '',
        sources: sourceNames,
      });

      console.log(
        `[DOUBLE_FEED] "${element?.name || element?.elementId}" получает питание от ${sources.size} источников: ${sourceNames.join(', ')}`
      );
    }
  }

  // ==========================================================================
  // ЭТАП 5 — Создание Alarm записей для конфликтов
  // ==========================================================================

  // Сначала удаляем старые DOUBLE_FEED аварии (очистка при каждом пересчёте)
  await db.alarm.deleteMany({
    where: { type: 'DOUBLE_FEED' },
  });

  // Создаём новые Alarm для каждого конфликта
  for (const conflict of conflicts) {
    await db.alarm.create({
      data: {
        elementId: conflict.elementId,
        type: 'DOUBLE_FEED',
        message: `Двойное питание: элемент "${conflict.elementName}" получает питание от ${conflict.sources.length} источников: ${conflict.sources.join(', ')}`,
        severity: 'WARNING',
        acknowledged: false,
      },
    });
  }

  if (conflicts.length > 0) {
    console.log(`[ALARMS] Created ${conflicts.length} DOUBLE_FEED alarms`);
  }

  // ==========================================================================
  // ЭТАП 6 — Сохранение в БД (batch update)
  // ==========================================================================

  const elementUpdates: { id: string; electricalStatus: string }[] = [];

  for (const [id, el] of elementMap.entries()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedEl = el as any;
    elementUpdates.push({
      id,
      electricalStatus: typedEl._electricalStatus,
    });
  }

  // Добавляем CABINET обновления
  for (const cab of cabinetUpdates) {
    const idx = elementUpdates.findIndex((u) => u.id === cab.id);
    if (idx >= 0) {
      elementUpdates[idx].electricalStatus = cab.electricalStatus;
    } else {
      elementUpdates.push(cab);
    }
  }

  // Batch update элементов
  for (const update of elementUpdates) {
    await db.element.update({
      where: { id: update.id },
      data: { electricalStatus: update.electricalStatus },
    });
  }

  // Batch update связей
  for (const conn of allConnections) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedConn = conn as any;
    if (typedConn._electricalStatus !== undefined) {
      await db.connection.update({
        where: { id: typedConn.id },
        data: { electricalStatus: typedConn._electricalStatus },
      });
    }
  }

  // ==========================================================================
  // СТАТИСТИКА
  // ==========================================================================

  let liveCount = 0;
  let deadCount = 0;
  let offCount = 0;

  for (const [, el] of elementMap.entries()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedEl = el as any;
    if (typedEl.operationalStatus === 'OFF') {
      offCount++;
    } else if (typedEl._electricalStatus === 'LIVE') {
      liveCount++;
    } else {
      deadCount++;
    }
  }

  console.log(
    `State propagation complete: ${elementUpdates.length} elements, ${allConnections.length} connections, ${conflicts.length} double-feed conflicts`
  );

  return {
    elementsUpdated: elementUpdates.length,
    connectionsUpdated: allConnections.length,
    liveElements: liveCount,
    deadElements: deadCount,
    offElements: offCount,
    conflicts,
  };
}

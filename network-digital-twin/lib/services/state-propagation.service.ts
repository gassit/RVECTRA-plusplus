// ============================================================================
// СЕРВИС РАСПРОСТРАНЕНИЯ ЭЛЕКТРИЧЕСКИХ СОСТОЯНИЙ
// BFS от SOURCE downstream, CABINET — агрегация дочерних
// ============================================================================

import { prisma } from '@/lib/prisma';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = prisma;

/**
 * Распространение электрических состояний по сети.
 *
 * Алгоритм:
 * 1. Инициализация: ВСЕ элементы и связи → DEAD
 * 2. BFS от SOURCE downstream (CABINET пропускается)
 * 3. POST-PROCESSING: CABINET = агрегация дочерних элементов
 * 4. Сохранение в БД
 */
export async function propagateStates(): Promise<void> {
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

  // Строим карты для быстрого доступа
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
      queue.push(source.id);
    }
    // OFF остаётся DEAD (не добавляем в очередь)
  }

  // BFS
  const visited = new Set<string>(queue); // visited = были в очереди
  let head = 0;

  while (head < queue.length) {
    const currentId = queue[head++];
    const currentEl = elementMap.get(currentId);
    if (!currentEl) continue;

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
        // Напряжение не проходит
        conn._electricalStatus = 'DEAD';
        // target остаётся DEAD (уже установлен по умолчанию)
        // Но если target уже был LIVE от другого пути — не меняем (множественные входы)
      }
    }
  }

  // ==========================================================================
  // ЭТАП 3 — CABINET: POST-PROCESSING (агрегация дочерних)
  // ==========================================================================

  // Загружаем CABINET с дочерними элементами
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
      // Нет дочерних → DEAD
      cabinetUpdates.push({
        id: cabinet.id,
        electricalStatus: 'DEAD',
      });
    } else {
      // Проверяем дочерние: используем промежуточные данные из BFS
      const hasLiveChild = children.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (child: any) => {
          // Сначала проверяем промежуточный результат BFS
          const bfsResult = elementMap.get(child.id);
          if (bfsResult && bfsResult._electricalStatus === 'LIVE') return true;
          // Fallback на текущее значение в БД (до обновления)
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
  // ЭТАП 4 — Сохранение в БД (batch update)
  // ==========================================================================

  // Обновляем элементы (только те, у которых _electricalStatus отличается)
  const elementUpdates: { id: string; electricalStatus: string }[] = [];

  for (const [id, el] of elementMap.entries()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedEl = el as any;
    elementUpdates.push({
      id,
      electricalStatus: typedEl._electricalStatus,
    });
  }

  // Добавляем CABINET обновления (перезаписываем BFS результат для CABINET)
  for (const cab of cabinetUpdates) {
    const idx = elementUpdates.findIndex((u) => u.id === cab.id);
    if (idx >= 0) {
      elementUpdates[idx].electricalStatus = cab.electricalStatus;
    } else {
      elementUpdates.push(cab);
    }
  }

  // Batch update элементов (по одному — SQLite не поддерживает bulk with different values)
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

  console.log(`State propagation complete: ${elementUpdates.length} elements, ${allConnections.length} connections updated`);
}

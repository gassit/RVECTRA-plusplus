/**
 * Скрипт для расчета позиций элементов
 * Запуск: npx ts-node scripts/calculate-layout.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

// Размеры
const GRID_STEP = 60;
const LAYER_HEIGHT = 100;
const NODE_WIDTH = 100;
const CABINET_PADDING = 50;

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

async function main() {
  console.log('Loading elements...');
  const elements = await prisma.element.findMany({
    select: { id: true, elementId: true, name: true, type: true, parentId: true }
  });
  console.log(`Found ${elements.length} elements`);

  console.log('Loading connections...');
  const connections = await prisma.connection.findMany({
    select: { id: true, sourceId: true, targetId: true }
  });
  console.log(`Found ${connections.length} connections`);

  // Отделяем Cabinet от остальных элементов
  const cabinets = elements.filter(e => e.type.toLowerCase() === 'cabinet');
  const nonCabinets = elements.filter(e => e.type.toLowerCase() !== 'cabinet');
  const cabinetNames = new Map(cabinets.map(c => [c.id, c.name]));

  // Группируем элементы по parentId
  const groups = new Map<string | null, LayoutElement[]>();
  for (const el of nonCabinets) {
    const key = el.parentId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(el);
  }

  // Вычисляем уровни
  const levels = new Map<string, number>();
  const elementIds = new Set(elements.map(e => e.id));
  const incoming = new Map<string, string[]>();

  for (const conn of connections) {
    if (!elementIds.has(conn.sourceId) || !elementIds.has(conn.targetId)) continue;
    if (!incoming.has(conn.targetId)) incoming.set(conn.targetId, []);
    incoming.get(conn.targetId)!.push(conn.sourceId);
  }

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

  for (const el of nonCabinets) {
    computeLevel(el.id, new Set());
  }

  // Размещаем элементы
  const positions = new Map<string, { x: number; y: number }>();
  const rootElements = groups.get(null) || [];
  groups.delete(null);

  let currentX = CABINET_PADDING;
  let currentY = CABINET_PADDING;

  function layoutGroup(elems: LayoutElement[], startX: number, startY: number): number {
    const sorted = [...elems].sort((a, b) => {
      const levelA = levels.get(a.id) || 0;
      const levelB = levels.get(b.id) || 0;
      if (levelA !== levelB) return levelA - levelB;
      return getTypeOrder(a.type) - getTypeOrder(b.type);
    });

    const byLevel = new Map<number, LayoutElement[]>();
    for (const el of sorted) {
      const level = levels.get(el.id) || 0;
      if (!byLevel.has(level)) byLevel.set(level, []);
      byLevel.get(level)!.push(el);
    }

    let maxX = startX;

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

  // Размещаем элементы внутри Cabinet
  for (const [cabinetId, cabinetElements] of groups) {
    if (!cabinetId) continue;

    const maxX = layoutGroup(cabinetElements, currentX, currentY);
    const maxLevel = Math.max(...cabinetElements.map(e => levels.get(e.id) || 0));

    currentX = maxX + GRID_STEP * 2;

    if (currentX > 1200) {
      currentX = CABINET_PADDING;
      currentY += (maxLevel + 3) * LAYER_HEIGHT;
    }
  }

  console.log(`Calculated positions for ${positions.size} elements`);

  // Сохраняем позиции
  console.log('Saving positions...');
  let updated = 0;

  for (const [id, pos] of positions) {
    try {
      await prisma.element.update({
        where: { id },
        data: { posX: pos.x, posY: pos.y }
      });
      updated++;
    } catch (e) {
      console.error(`Failed to update ${id}`);
    }
  }

  console.log(`Updated ${updated} elements`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

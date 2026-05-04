/**
 * API для автоматического расчёта позиций элементов (layout)
 * POST /api/layout - запустить расчёт
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Константы для layout
const LAYOUT_CONFIG = {
  ranksep: 150,    // Расстояние между уровнями (вертикальное)
  nodesep: 100,    // Расстояние между узлами на одном уровне (горизонтальное)
  startX: 100,
  startY: 100,
};

interface LayoutNode {
  id: string;
  type: string;
  level: number;
  x: number;
  y: number;
}

/**
 * Простой алгоритм layout сверху-вниз (Source -> Load)
 * Использует BFS для определения уровней
 */
export async function POST() {
  try {
    // Получаем все элементы и связи
    const elements = await prisma.element.findMany({
      select: { id: true, type: true, posX: true, posY: true }
    });
    const connections = await prisma.connection.findMany({
      select: { sourceId: true, targetId: true }
    });

    // Структуры для BFS
    const elementMap = new Map(elements.map(e => [e.id, e]));
    const outgoingConnections = new Map<string, string[]>();
    const incomingConnections = new Map<string, string[]>();

    for (const conn of connections) {
      if (!outgoingConnections.has(conn.sourceId)) {
        outgoingConnections.set(conn.sourceId, []);
      }
      outgoingConnections.get(conn.sourceId)!.push(conn.targetId);

      if (!incomingConnections.has(conn.targetId)) {
        incomingConnections.set(conn.targetId, []);
      }
      incomingConnections.get(conn.targetId)!.push(conn.sourceId);
    }

    // Определяем уровни элементов (BFS от источников)
    const levels = new Map<string, number>();
    const queue: { id: string; level: number }[] = [];

    // Находим источники (SOURCE) и начинаем с них
    const sources = elements.filter(e => e.type.toLowerCase() === 'source');
    for (const source of sources) {
      queue.push({ id: source.id, level: 0 });
      levels.set(source.id, 0);
    }

    // BFS для определения уровней
    while (queue.length > 0) {
      const { id: currentId, level: currentLevel } = queue.shift()!;
      const outgoing = outgoingConnections.get(currentId) || [];

      for (const targetId of outgoing) {
        const existingLevel = levels.get(targetId);
        const newLevel = currentLevel + 1;

        // Если элемент ещё не имеет уровня или нашли более короткий путь
        if (existingLevel === undefined || newLevel < existingLevel) {
          levels.set(targetId, newLevel);
          queue.push({ id: targetId, level: newLevel });
        }
      }
    }

    // Группируем элементы по уровням
    const levelGroups = new Map<number, string[]>();
    for (const [id, level] of levels) {
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(id);
    }

    // Назначаем координаты
    const layoutNodes: LayoutNode[] = [];
    const sortedLevels = [...levelGroups.keys()].sort((a, b) => a - b);

    for (const level of sortedLevels) {
      const nodesAtLevel = levelGroups.get(level)!;
      const y = LAYOUT_CONFIG.startY + level * LAYOUT_CONFIG.ranksep;

      // Сортируем узлы по типу для лучшей визуализации
      nodesAtLevel.sort((a, b) => {
        const typeA = elementMap.get(a)?.type || '';
        const typeB = elementMap.get(b)?.type || '';
        return typeA.localeCompare(typeB);
      });

      // Размещаем узлы горизонтально
      const totalWidth = (nodesAtLevel.length - 1) * LAYOUT_CONFIG.nodesep;
      const startX = LAYOUT_CONFIG.startX;

      for (let i = 0; i < nodesAtLevel.length; i++) {
        const nodeId = nodesAtLevel[i];
        const x = startX + i * LAYOUT_CONFIG.nodesep;
        layoutNodes.push({
          id: nodeId,
          type: elementMap.get(nodeId)?.type || 'unknown',
          level,
          x,
          y
        });
      }
    }

    // Элементы без уровня (изолированные) размещаем внизу
    let isolatedY = LAYOUT_CONFIG.startY + (sortedLevels.length) * LAYOUT_CONFIG.ranksep;
    let isolatedX = LAYOUT_CONFIG.startX;

    for (const element of elements) {
      if (!levels.has(element.id)) {
        layoutNodes.push({
          id: element.id,
          type: element.type,
          level: -1,
          x: isolatedX,
          y: isolatedY
        });
        isolatedX += LAYOUT_CONFIG.nodesep;
      }
    }

    // Обновляем позиции в базе данных
    let updatedCount = 0;
    for (const node of layoutNodes) {
      try {
        await prisma.element.update({
          where: { id: node.id },
          data: {
            posX: node.x,
            posY: node.y,
            updatedAt: new Date()
          }
        });
        updatedCount++;
      } catch (e) {
        console.error(`Failed to update position for element ${node.id}:`, e);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Layout рассчитан: ${updatedCount} элементов`,
      data: {
        elementsUpdated: updatedCount,
        levels: sortedLevels.length,
        nodes: layoutNodes.length
      }
    });
  } catch (error) {
    console.error('Error calculating layout:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при расчёте layout' },
      { status: 500 }
    );
  }
}

/**
 * GET - получить текущие позиции элементов
 */
export async function GET() {
  try {
    const elements = await prisma.element.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        posX: true,
        posY: true
      }
    });

    const withPositions = elements.filter(e => e.posX !== null && e.posY !== null);

    return NextResponse.json({
      success: true,
      data: {
        total: elements.length,
        positioned: withPositions.length,
        elements: elements.map(e => ({
          id: e.id,
          name: e.name,
          type: e.type,
          x: e.posX,
          y: e.posY
        }))
      }
    });
  } catch (error) {
    console.error('Error getting layout:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при получении layout' },
      { status: 500 }
    );
  }
}

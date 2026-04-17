import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateLayout, saveLayoutPositions } from '@/lib/services/layout.service';

/**
 * POST /api/layout
 * Рассчитывает и сохраняет позиции элементов на схеме
 */
export async function POST(request: NextRequest) {
  try {
    // Получаем все элементы
    const elements = await prisma.element.findMany({
      select: {
        id: true,
        elementId: true,
        name: true,
        type: true,
        parentId: true,
      }
    });

    // Получаем все связи
    const connections = await prisma.connection.findMany({
      select: {
        id: true,
        sourceId: true,
        targetId: true,
      }
    });

    if (elements.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Нет элементов для размещения'
      });
    }

    // Рассчитываем позиции
    const { positions, cabinetBounds } = calculateLayout(elements, connections);

    // Сохраняем позиции в базу
    const updated = await saveLayoutPositions(positions, prisma);

    return NextResponse.json({
      success: true,
      message: `Рассчитаны позиции для ${positions.size} элементов, сохранено ${updated}`,
      stats: {
        elementsProcessed: elements.length,
        positionsCalculated: positions.size,
        positionsSaved: updated,
        cabinetsDetected: cabinetBounds.size
      },
      cabinetBounds: Object.fromEntries(cabinetBounds)
    });

  } catch (error) {
    console.error('Layout calculation error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET /api/layout
 * Возвращает текущие позиции элементов и границы Cabinet
 */
export async function GET() {
  try {
    const elements = await prisma.element.findMany({
      select: {
        id: true,
        elementId: true,
        name: true,
        type: true,
        parentId: true,
        posX: true,
        posY: true,
      }
    });

    const connections = await prisma.connection.findMany({
      select: {
        id: true,
        sourceId: true,
        targetId: true,
      }
    });

    // Собираем границы Cabinet
    const cabinetBounds: Array<{ id: string; name: string; x: number; y: number; width: number; height: number }> = [];

    // Группируем элементы по parentId
    const byParent = new Map<string | null, typeof elements>();

    for (const el of elements) {
      const key = el.parentId;
      if (!byParent.has(key)) {
        byParent.set(key, []);
      }
      byParent.get(key)!.push(el);
    }

    // Вычисляем границы для каждого Cabinet
    for (const [parentId, children] of byParent) {
      if (!parentId) continue;

      const cabinet = elements.find(e => e.id === parentId);
      const cabinetName = cabinet?.name || 'Cabinet';

      const childrenWithPositions = children.filter(e => e.posX != null && e.posY != null);
      if (childrenWithPositions.length === 0) continue;

      const minX = Math.min(...childrenWithPositions.map(e => e.posX!)) - 40;
      const maxX = Math.max(...childrenWithPositions.map(e => e.posX!)) + 100;
      const minY = Math.min(...childrenWithPositions.map(e => e.posY!)) - 40;
      const maxY = Math.max(...childrenWithPositions.map(e => e.posY!)) + 60;

      cabinetBounds.push({
        id: parentId,
        name: cabinetName,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      });
    }

    return NextResponse.json({
      success: true,
      elements: elements.map(e => ({
        id: e.id,
        elementId: e.elementId,
        name: e.name,
        type: e.type,
        parentId: e.parentId,
        posX: e.posX,
        posY: e.posY
      })),
      connections: connections.map(c => ({
        id: c.id,
        sourceId: c.sourceId,
        targetId: c.targetId
      })),
      cabinetBounds
    });

  } catch (error) {
    console.error('Layout fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

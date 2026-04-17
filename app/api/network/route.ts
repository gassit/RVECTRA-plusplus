import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface CabinetBound {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function GET() {
  try {
    // Получаем элементы со статусами
    const elements = await prisma.element.findMany({
      select: {
        id: true,
        elementId: true,
        name: true,
        type: true,
        posX: true,
        posY: true,
        parentId: true,
        electricalStatus: true,
        operationalStatus: true,
      }
    });

    // Получаем связи со статусами
    const connections = await prisma.connection.findMany({
      select: {
        id: true,
        sourceId: true,
        targetId: true,
        electricalStatus: true,
        operationalStatus: true,
      }
    });

    // Создаем мапу элементов для быстрого поиска
    const elementMap = new Map(elements.map(e => [e.id, e]));

    // Добавляем информацию об элементах в связи
    const connectionsWithInfo = connections.map(conn => ({
      id: conn.id,
      sourceId: conn.sourceId,
      targetId: conn.targetId,
      electricalStatus: conn.electricalStatus,
      operationalStatus: conn.operationalStatus,
      source: elementMap.get(conn.sourceId)
        ? {
            elementId: elementMap.get(conn.sourceId)!.elementId,
            name: elementMap.get(conn.sourceId)!.name,
            type: elementMap.get(conn.sourceId)!.type
          }
        : { elementId: '', name: 'Unknown', type: 'unknown' },
      target: elementMap.get(conn.targetId)
        ? {
            elementId: elementMap.get(conn.targetId)!.elementId,
            name: elementMap.get(conn.targetId)!.name,
            type: elementMap.get(conn.targetId)!.type
          }
        : { elementId: '', name: 'Unknown', type: 'unknown' },
    }));

    // Вычисляем границы Cabinet
    const cabinetBounds: CabinetBound[] = [];

    // Группируем элементы по parentId (Cabinet)
    const byParent = new Map<string | null, typeof elements>();
    for (const el of elements) {
      const key = el.parentId;
      if (!byParent.has(key)) {
        byParent.set(key, []);
      }
      byParent.get(key)!.push(el);
    }

    // Для каждого Cabinet вычисляем границы на основе позиций дочерних элементов
    for (const [parentId, children] of byParent) {
      if (!parentId) continue;

      const cabinet = elementMap.get(parentId);
      if (!cabinet) continue;

      const childrenWithPositions = children.filter(e => e.posX != null && e.posY != null);
      if (childrenWithPositions.length === 0) continue;

      const padding = 50;
      const minX = Math.min(...childrenWithPositions.map(e => e.posX!)) - padding;
      const maxX = Math.max(...childrenWithPositions.map(e => e.posX!)) + 120;
      const minY = Math.min(...childrenWithPositions.map(e => e.posY!)) - padding;
      const maxY = Math.max(...childrenWithPositions.map(e => e.posY!)) + 80;

      cabinetBounds.push({
        id: parentId,
        name: cabinet.name,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      });
    }

    return NextResponse.json({ 
      elements, 
      connections: connectionsWithInfo,
      cabinetBounds
    });
  } catch (error) {
    console.error('Error fetching network:', error);
    return NextResponse.json({ error: 'Failed to fetch network' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    return NextResponse.json({ 
      elements, 
      connections: connectionsWithInfo,
    });
  } catch (error) {
    console.error('Error fetching network:', error);
    return NextResponse.json({ error: 'Failed to fetch network' }, { status: 500 });
  }
}

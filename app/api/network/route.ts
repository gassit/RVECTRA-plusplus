import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Получаем элементы со статусами и устройствами
    const elements = await prisma.element.findMany({
      select: {
        id: true,
        elementId: true,
        name: true,
        type: true,
        posX: true,
        posY: true,
        parentId: true,
        voltageLevel: true,
        electricalStatus: true,
        operationalStatus: true,
        DeviceSlot: {
          include: {
            Device: {
              include: {
                Load: true,
                Breaker: true,
                Meter: true,
                Transformer: true,
              },
            },
          },
        },
      }
    });

    // Получаем связи со статусами и данными кабеля
    const connections = await prisma.connection.findMany({
      select: {
        id: true,
        sourceId: true,
        targetId: true,
        electricalStatus: true,
        operationalStatus: true,
        Cable: {
          select: {
            id: true,
            cableId: true,
            name: true,
            length: true,
            section: true,
            material: true,
            iDop: true,
            CableReference: {
              select: {
                r0: true,
                x0: true,
              },
            },
          },
        },
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
      // Данные кабеля
      cable: conn.Cable ? {
        id: conn.Cable.id,
        name: conn.Cable.name,
        length: conn.Cable.length,
        section: conn.Cable.section,
        material: conn.Cable.material,
        iDop: conn.Cable.iDop,
        // Справочные данные для точного расчёта
        r0: conn.Cable.CableReference?.r0 ?? null,
        x0: conn.Cable.CableReference?.x0 ?? null,
      } : null,
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

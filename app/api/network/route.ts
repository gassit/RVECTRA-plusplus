import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateLayout } from '@/lib/services/layout.service';

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

    // Вычисляем границы Cabinet и смещения для линий
    const cabinetBounds: CabinetBound[] = [];
    const edgeOffsets: Array<{
      connectionId: string;
      offset: number;
      controlPoints: Array<{ x: number; y: number }>;
    }> = [];

    // Проверяем, есть ли позиции у элементов
    const hasPositions = elements.some(e => e.posX != null && e.posY != null);

    if (hasPositions) {
      // Если позиции есть - вычисляем только границы Cabinet и смещения
      const byParent = new Map<string | null, typeof elements>();
      for (const el of elements) {
        const key = el.parentId;
        if (!byParent.has(key)) {
          byParent.set(key, []);
        }
        byParent.get(key)!.push(el);
      }

      // Границы Cabinet
      for (const [parentId, children] of byParent) {
        if (!parentId) continue;

        const cabinet = elementMap.get(parentId);
        if (!cabinet) continue;

        const childrenWithPositions = children.filter(e => e.posX != null && e.posY != null);
        if (childrenWithPositions.length === 0) continue;

        const padding = 60;
        const minX = Math.min(...childrenWithPositions.map(e => e.posX!)) - padding;
        const maxX = Math.max(...childrenWithPositions.map(e => e.posX!)) + 150;
        const minY = Math.min(...childrenWithPositions.map(e => e.posY!)) - padding;
        const maxY = Math.max(...childrenWithPositions.map(e => e.posY!)) + 100;

        cabinetBounds.push({
          id: parentId,
          name: cabinet.name,
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY
        });
      }

      // Смещения для параллельных линий
      const edgeCountByKey = new Map<string, number>();
      const edgeIndexByKey = new Map<string, number>();
      
      for (const c of connections) {
        const key = `${c.sourceId}-${c.targetId}`;
        edgeIndexByKey.set(c.id, edgeCountByKey.get(key) || 0);
        edgeCountByKey.set(key, (edgeCountByKey.get(key) || 0) + 1);
      }

      for (const c of connections) {
        const key = `${c.sourceId}-${c.targetId}`;
        const totalCount = edgeCountByKey.get(key) || 1;
        const myIndex = edgeIndexByKey.get(c.id) || 0;
        
        if (totalCount > 1) {
          const offset = (myIndex - (totalCount - 1) / 2) * 30;
          
          // Вычисляем контрольные точки для ортогональной линии
          const sourceEl = elementMap.get(c.sourceId);
          const targetEl = elementMap.get(c.targetId);
          
          if (sourceEl?.posX != null && sourceEl?.posY != null && 
              targetEl?.posX != null && targetEl?.posY != null) {
            const midY = Math.min(sourceEl.posY, targetEl.posY) + 
                         Math.abs(targetEl.posY - sourceEl.posY) / 2;
            
            edgeOffsets.push({
              connectionId: c.id,
              offset,
              controlPoints: [
                { x: sourceEl.posX, y: sourceEl.posY },
                { x: sourceEl.posX, y: midY + offset },
                { x: targetEl.posX, y: midY + offset },
                { x: targetEl.posX, y: targetEl.posY },
              ],
            });
          }
        }
      }
    } else {
      // Если позиций нет - запускаем полный расчёт layout
      const layoutElements = elements.map(e => ({
        id: e.id,
        elementId: e.elementId,
        name: e.name,
        type: e.type,
        parentId: e.parentId,
      }));

      const layoutConnections = connections.map(c => ({
        id: c.id,
        sourceId: c.sourceId,
        targetId: c.targetId,
      }));

      const layoutResult = calculateLayout(layoutElements, layoutConnections);

      // Добавляем границы Cabinet
      for (const [id, bounds] of layoutResult.cabinetBounds) {
        cabinetBounds.push({
          id,
          name: bounds.name,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        });
      }

      // Добавляем смещения для линий
      for (const [id, offset] of layoutResult.edgeOffsets) {
        edgeOffsets.push({
          connectionId: id,
          offset: offset.offset,
          controlPoints: offset.controlPoints,
        });
      }
    }

    return NextResponse.json({ 
      elements, 
      connections: connectionsWithInfo,
      cabinetBounds,
      edgeOffsets,
    });
  } catch (error) {
    console.error('Error fetching network:', error);
    return NextResponse.json({ error: 'Failed to fetch network' }, { status: 500 });
  }
}

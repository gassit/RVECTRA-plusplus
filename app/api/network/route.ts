import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ValidationResultData } from '@/types';

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
        sumPInstalled: true,
        sumPCalculated: true,
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
            cores: true,
            material: true,
            iDop: true,
            voltageDrop: true,
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

    // Получаем результаты валидации
    const validationResults = await prisma.validationResult.findMany({
      include: {
        ValidationRule: true,
      },
    });

    // Группируем результаты по elementId
    const resultsByElement = new Map<string, ValidationResultData[]>();
    for (const result of validationResults) {
      const elementId = result.elementId;
      if (!elementId) continue;
      
      if (!resultsByElement.has(elementId)) {
        resultsByElement.set(elementId, []);
      }
      
      resultsByElement.get(elementId)!.push({
        id: result.id,
        ruleCode: result.ValidationRule?.name || 'UNKNOWN',
        ruleName: result.ValidationRule?.description || 'Неизвестное правило',
        status: result.status as any,
        elementId: result.elementId || undefined,
        connectionId: result.connectionId || undefined,
        message: result.message,
        actualValue: result.value || undefined,
        expectedValue: result.limit || undefined,
        details: result.details as any,
      });
    }

    // Группируем результаты по connectionId (для кабелей/edges)
    const resultsByConnection = new Map<string, ValidationResultData[]>();
    for (const result of validationResults) {
      const connectionId = result.connectionId;
      if (!connectionId) continue;
      
      if (!resultsByConnection.has(connectionId)) {
        resultsByConnection.set(connectionId, []);
      }
      
      resultsByConnection.get(connectionId)!.push({
        id: result.id,
        ruleCode: result.ValidationRule?.name || 'UNKNOWN',
        ruleName: result.ValidationRule?.description || 'Неизвестное правило',
        status: result.status as any,
        elementId: result.elementId || undefined,
        connectionId: result.connectionId || undefined,
        message: result.message,
        actualValue: result.value || undefined,
        expectedValue: result.limit || undefined,
        details: result.details as any,
      });
    }

    // Создаем мапу элементов для быстрого поиска
    const elementMap = new Map(elements.map(e => [e.id, e]));

    // Формируем связи с данными кабеля
    const connectionsData = connections.map(conn => {
      const cable = conn.Cable;
      const sourceEl = elementMap.get(conn.sourceId);
      const targetEl = elementMap.get(conn.targetId);
      
      return {
        id: conn.id,
        sourceId: conn.sourceId,
        targetId: conn.targetId,
        electricalStatus: conn.electricalStatus,
        operationalStatus: conn.operationalStatus,
        cable: cable ? {
          id: cable.id,
          cableId: cable.cableId,
          name: cable.name,
          length: cable.length,
          section: cable.section,
          cores: cable.cores,
          material: cable.material,
          iDop: cable.iDop,
          voltageDrop: cable.voltageDrop,
        } : null,
        source: sourceEl ? {
          elementId: sourceEl.elementId,
          name: sourceEl.name,
          type: sourceEl.type,
        } : { elementId: '', name: '', type: '' },
        target: targetEl ? {
          elementId: targetEl.elementId,
          name: targetEl.name,
          type: targetEl.type,
        } : { elementId: '', name: '', type: '' },
      };
    });

    console.log(`[Network API] ${elements.length} elements, ${connections.length} connections, ${validationResults.length} validation results`);
    
    return NextResponse.json({ 
      elements,
      connections: connectionsData,
    });
  } catch (error) {
    console.error('Error fetching network:', error);
    return NextResponse.json({ error: 'Failed to fetch network' }, { status: 500 });
  }
}

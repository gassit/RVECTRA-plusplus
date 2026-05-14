import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { GraphData, GraphNode, GraphEdge, ValidationResultData } from '@/types';

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

    // Находим все cabinets для группировки (combo)
    const cabinets = elements.filter(e => e.type.toLowerCase() === 'cabinet');

    // Формируем узлы графа
    const nodes: GraphNode[] = elements.map(el => {
      const nodeResults = resultsByElement.get(el.id) || [];
      const criticalCount = nodeResults.filter(r => r.status === 'FAIL' || r.status === 'CRITICAL').length;
      
      return {
        id: el.id,
        type: el.type as GraphNode['type'],
        name: el.name,
        parentId: el.parentId || undefined,
        posX: el.posX || 0,
        posY: el.posY || 0,
        voltageLevel: el.voltageLevel || undefined,
        status: (el.operationalStatus === 'ON' ? 'ON' : el.operationalStatus === 'OFF' ? 'OFF' : 'UNKNOWN') as GraphNode['status'],
        lifeStatus: (el.electricalStatus === 'LIVE' ? 'LIVE' : el.electricalStatus === 'DEAD' ? 'DEAD' : 'UNKNOWN') as GraphNode['lifeStatus'],
        hasIssues: criticalCount > 0,
        criticalIssues: criticalCount,
        sumPInstalled: el.sumPInstalled || undefined,
        sumPCalculated: el.sumPCalculated || undefined,
        devices: (el.DeviceSlot || []).map((ds: any) => {
          const dev = ds.Device?.[0];
          return dev ? {
            id: dev.id,
            type: dev.deviceType as any,
            slotId: ds.slotId,
          } : undefined;
        }).filter(Boolean) as any,
        validationResults: nodeResults,
      };
    });

    // Формируем рёбра графа с результатами валидации
    const edges: GraphEdge[] = connections.map(conn => {
      const cable = conn.Cable;
      const edgeResults = resultsByConnection.get(conn.id) || [];
      
      return {
        id: conn.id,
        source: conn.sourceId,
        target: conn.targetId,
        type: 'CABLE' as GraphEdge['type'],
        length: cable?.length || undefined,
        wireType: cable?.material === 'copper' ? 'Cu' : cable?.material === 'aluminum' ? 'Al' : undefined,
        wireSize: cable?.section || undefined,
        cores: cable?.cores || undefined,
        currentCapacity: cable?.iDop || undefined,
        status: (conn.operationalStatus === 'ON' ? 'ON' : conn.operationalStatus === 'OFF' ? 'OFF' : 'UNKNOWN') as GraphEdge['status'],
        lifeStatus: (conn.electricalStatus === 'LIVE' ? 'LIVE' : conn.electricalStatus === 'DEAD' ? 'DEAD' : 'UNKNOWN') as GraphEdge['lifeStatus'],
        validationResults: edgeResults,
      };
    });

    // Формируем combos для G6 (cabinets как группы)
    const combos = cabinets.map(cabinet => ({
      id: cabinet.id,
      label: cabinet.name,
      data: {
        type: 'cabinet',
        name: cabinet.name,
      },
    }));

    const graphData: GraphData = { nodes, edges };

    console.log(`[Network API] ${nodes.length} nodes, ${edges.length} edges, ${validationResults.length} validation results`);
    
    return NextResponse.json({ 
      ...graphData,
      combos,
    });
  } catch (error) {
    console.error('Error fetching network:', error);
    return NextResponse.json({ error: 'Failed to fetch network' }, { status: 500 });
  }
}

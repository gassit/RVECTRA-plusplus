import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { GraphData, GraphNode, GraphEdge, ValidationResultData } from '@/types';

export async function GET() {
  try {
    // Получаем все элементы с device slots
    const elements = await db.element.findMany({
      include: {
        DeviceSlot: { include: { Device: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Получаем все связи с данными кабелей
    const connections = await db.connection.findMany({
      include: { Cable: true },
      orderBy: { createdAt: 'asc' },
    });

    // Получаем результаты валидации
    const validationResults = await db.validationResult.findMany({
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
            model: undefined,
            currentNom: undefined,
            pKw: undefined,
            qKvar: undefined,
            sKva: undefined,
            cosPhi: undefined,
          } : undefined;
        }).filter(Boolean) as any,
        validationResults: nodeResults,
      };
    });

    // Формируем рёбра графа — используем sourceId/targetId из Connection модели
    // Данные кабеля берем из связанной Cable таблицы
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
        // Добавляем результаты валидации для кабеля
        validationResults: edgeResults,
      };
    });

    const graphData: GraphData = { nodes, edges };

    console.log(`[Network API] ${nodes.length} nodes, ${edges.length} edges`);
    return NextResponse.json(graphData);
  } catch (error) {
    console.error('Network API error:', error);
    return NextResponse.json(
      { error: 'Ошибка получения данных сети' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { GraphData, GraphNode, GraphEdge } from '@/types';

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

    // Формируем узлы графа
    const nodes: GraphNode[] = elements.map(el => ({
      id: el.id,
      type: el.type as GraphNode['type'],
      name: el.name,
      parentId: el.parentId || undefined,
      posX: el.posX || 0,
      posY: el.posY || 0,
      voltageLevel: el.voltageLevel || undefined,
      status: (el.operationalStatus === 'ON' ? 'ON' : el.operationalStatus === 'OFF' ? 'OFF' : 'UNKNOWN') as GraphNode['status'],
      lifeStatus: (el.electricalStatus === 'LIVE' ? 'LIVE' : el.electricalStatus === 'DEAD' ? 'DEAD' : 'UNKNOWN') as GraphNode['lifeStatus'],
      hasIssues: false,
      criticalIssues: 0,
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
    }));

    // Формируем рёбра графа — используем sourceId/targetId из Connection модели
    // Данные кабеля берем из связанной Cable таблицы
    const edges: GraphEdge[] = connections.map(conn => {
      const cable = conn.Cable;
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

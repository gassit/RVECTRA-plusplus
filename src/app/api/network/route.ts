import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { GraphData, GraphNode, GraphEdge } from '@/types';

export async function GET() {
  try {
    // Получаем все элементы с устройствами и результатами валидации
    const elements = await db.element.findMany({
      include: {
        devices: true,
        validationResults: true,
      },
      orderBy: { created_at: 'asc' },
    });

    // Получаем все связи
    const connections = await db.connection.findMany();

    // Формируем узлы графа
    const nodes: GraphNode[] = elements.map(el => {
      const criticalIssues = el.validationResults.filter(
        vr => vr.status === 'CRITICAL'
      ).length;
      
      return {
        id: el.id,
        type: el.type as GraphNode['type'],
        name: el.name,
        posX: el.pos_x || 0,
        posY: el.pos_y || 0,
        hasIssues: el.validationResults.some(
          vr => vr.status === 'CRITICAL' || vr.status === 'FAIL'
        ),
        criticalIssues,
        devices: el.devices.map(d => ({
          id: d.id,
          type: d.type as any,
          slotId: d.slot_id,
          model: d.model || undefined,
          currentNom: d.current_nom || undefined,
          pKw: d.p_kw || undefined,
          qKvar: d.q_kvar || undefined,
          sKva: d.s_kva || undefined,
          cosPhi: d.cos_phi || undefined,
        })),
        validationResults: el.validationResults.map(vr => ({
          id: vr.id,
          ruleCode: '',
          ruleName: '',
          status: vr.status as any,
          elementId: el.id,
          message: vr.message,
          recommendation: vr.recommendation || undefined,
        })),
      };
    });

    // Формируем рёбра графа
    const edges: GraphEdge[] = connections.map(conn => ({
      id: conn.id,
      source: conn.from_id,
      target: conn.to_id,
      type: conn.type as GraphEdge['type'],
      length: conn.length || undefined,
      wireType: conn.wire_type || undefined,
      wireSize: conn.wire_size || undefined,
    }));

    const graphData: GraphData = { nodes, edges };

    return NextResponse.json(graphData);
  } catch (error) {
    console.error('Network API error:', error);
    return NextResponse.json(
      { error: 'Ошибка получения данных сети' },
      { status: 500 }
    );
  }
}

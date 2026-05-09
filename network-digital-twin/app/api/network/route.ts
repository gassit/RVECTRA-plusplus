import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = prisma;

export async function GET() {
  try {
    const selectFields = {
      id: true,
      elementId: true,
      name: true,
      type: true,
      posX: true,
      posY: true,
      electricalStatus: true,
      operationalStatus: true,
    };
    const elements = await db.element.findMany({ select: selectFields });

    const connSelectFields = {
      id: true,
      sourceId: true,
      targetId: true,
      electricalStatus: true,
      operationalStatus: true,
    };
    const connections = await db.connection.findMany({ select: connSelectFields });

    const elementMap = new Map<string, any>();
    for (const e of elements) {
      elementMap.set(e.id, e);
    }

    const connectionsWithInfo = connections.map((conn: any) => {
      const src = elementMap.get(conn.sourceId);
      const tgt = elementMap.get(conn.targetId);
      return {
        id: conn.id,
        sourceId: conn.sourceId,
        targetId: conn.targetId,
        electricalStatus: conn.electricalStatus,
        operationalStatus: conn.operationalStatus,
        source: src
          ? { elementId: src.elementId, name: src.name, type: src.type, electricalStatus: src.electricalStatus, operationalStatus: src.operationalStatus }
          : { elementId: '', name: 'Unknown', type: 'unknown', electricalStatus: 'DEAD', operationalStatus: 'ON' },
        target: tgt
          ? { elementId: tgt.elementId, name: tgt.name, type: tgt.type, electricalStatus: tgt.electricalStatus, operationalStatus: tgt.operationalStatus }
          : { elementId: '', name: 'Unknown', type: 'unknown', electricalStatus: 'DEAD', operationalStatus: 'ON' },
      };
    });

    return NextResponse.json({ elements, connections: connectionsWithInfo });
  } catch (error) {
    console.error('Error fetching network:', error);
    return NextResponse.json({ error: 'Failed to fetch network' }, { status: 500 });
  }
}

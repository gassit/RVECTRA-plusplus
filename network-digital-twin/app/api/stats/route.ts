import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = prisma;

export async function GET() {
  try {
    const elements: any[] = await db.element.findMany();

    const toLower = (t: string) => t.toLowerCase();

    const stats = {
      sources: elements.filter(e => toLower(e.type) === 'source').length,
      buses: elements.filter(e => toLower(e.type) === 'bus').length,
      breakers: elements.filter(e => toLower(e.type) === 'breaker').length,
      meters: elements.filter(e => toLower(e.type) === 'meter').length,
      loads: elements.filter(e => toLower(e.type) === 'load').length,
      junctions: elements.filter(e => toLower(e.type) === 'junction').length,
      cabinets: elements.filter(e => toLower(e.type) === 'cabinet').length,
      total: elements.length,
    };

    const loadDevices: any[] = await db.load.findMany();
    const totalPower = loadDevices.reduce((sum: number, l: any) => sum + l.powerP, 0);

    const transformers: any[] = await db.transformer.findMany();
    const sourcePower = transformers.reduce((sum: number, t: any) => sum + t.power, 0);

    const power = {
      total: sourcePower,
      consumed: totalPower,
      free: sourcePower - totalPower,
    };

    const connections = await db.connection.count();

    return NextResponse.json({
      elements: stats,
      power,
      connections,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

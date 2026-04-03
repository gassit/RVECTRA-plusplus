import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Подсчет элементов по типам
    const elements = await prisma.element.findMany();
    
    const stats = {
      sources: elements.filter(e => e.type === 'source').length,
      buses: elements.filter(e => e.type === 'bus').length,
      breakers: elements.filter(e => e.type === 'breaker').length,
      meters: elements.filter(e => e.type === 'meter').length,
      loads: elements.filter(e => e.type === 'load').length,
      junctions: elements.filter(e => e.type === 'junction').length,
      total: elements.length
    };

    // Подсчет мощности
    const loadDevices = await prisma.load.findMany();
    const totalPower = loadDevices.reduce((sum, l) => sum + l.powerP, 0);
    
    // Мощность источников (трансформаторов)
    const transformers = await prisma.transformer.findMany();
    const sourcePower = transformers.reduce((sum, t) => sum + t.power, 0);

    const power = {
      total: sourcePower,
      consumed: totalPower,
      free: sourcePower - totalPower
    };

    // Подсчет соединений
    const connections = await prisma.connection.count();

    return NextResponse.json({
      elements: stats,
      power,
      connections
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

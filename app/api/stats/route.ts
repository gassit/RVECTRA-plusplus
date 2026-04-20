import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Динамический импорт Prisma
    const { prisma } = await import('@/lib/prisma');
    
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

    // Если устройств нет - оцениваем мощность по элементам
    let calculatedSourcePower = sourcePower;
    let calculatedLoadPower = totalPower;
    
    if (sourcePower === 0 && stats.sources > 0) {
      // Оценка: 630 кВА на каждый источник (типичный трансформатор)
      calculatedSourcePower = stats.sources * 630;
    }
    
    if (totalPower === 0 && stats.loads > 0) {
      // Оценка: 15 кВт на каждую нагрузку
      calculatedLoadPower = stats.loads * 15;
    }

    const power = {
      total: calculatedSourcePower,
      consumed: calculatedLoadPower,
      free: Math.max(0, calculatedSourcePower - calculatedLoadPower),
      reserve: Math.max(0, calculatedSourcePower * 0.2) // 20% резерв
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

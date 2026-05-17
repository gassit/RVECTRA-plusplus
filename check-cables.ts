import { db } from './src/lib/db';

async function checkCables() {
  // Получаем кабели
  const cables = await db.cable.findMany({ take: 10 });
  
  console.log('=== Cable Data ===');
  cables.forEach(c => {
    console.log({
      id: c.id,
      cableId: c.cableId,
      length: c.length,
      section: c.section,
      material: c.material,
      cores: c.cores,
      iDop: c.iDop,
      currentA: c.currentA,
      voltageDrop: c.voltageDrop
    });
  });
  
  // Получаем связи с информацией о кабеле
  const connections = await db.connection.findMany({
    take: 10,
    include: {
      Cable: true,
      Element_Connection_sourceIdToElement: { select: { voltageLevel: true, name: true } },
      Element_Connection_targetIdToElement: { select: { voltageLevel: true, name: true } }
    }
  });
  
  console.log('\n=== Connections with Cable Data ===');
  connections.forEach(conn => {
    console.log({
      id: conn.id,
      source: conn.sourceId,
      target: conn.targetId,
      cableId: conn.cableId,
      cable: conn.Cable ? {
        length: conn.Cable.length,
        section: conn.Cable.section,
        material: conn.Cable.material,
        cores: conn.Cable.cores,
        iDop: conn.Cable.iDop,
        currentA: conn.Cable.currentA,
        voltageDrop: conn.Cable.voltageDrop
      } : null,
      sourceVoltage: conn.Element_Connection_sourceIdToElement?.voltageLevel,
      targetVoltage: conn.Element_Connection_targetIdToElement?.voltageLevel
    });
  });
  
  // Проверяем разные уровни напряжения у элементов
  const elements = await db.element.findMany({
    where: { voltageLevel: { not: null } },
    select: { id: true, name: true, voltageLevel: true, type: true }
  });
  
  console.log('\n=== Elements with Voltage Levels ===');
  const byVoltage: Record<number, number> = {};
  elements.forEach(e => {
    const v = e.voltageLevel || 0;
    byVoltage[v] = (byVoltage[v] || 0) + 1;
  });
  console.log('Voltage distribution:', byVoltage);
  console.log('Sample elements:');
  elements.slice(0, 10).forEach(e => console.log(e));
  
  await db.$disconnect();
}

checkCables().catch(console.error);

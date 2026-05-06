import { prisma } from '../src/lib/prisma';

async function main() {
  // Найти элементы по имени
  const elements = await prisma.element.findMany({
    where: {
      OR: [
        { name: { contains: 'Н-573' } },
        { name: { contains: 'Н-824' } },
        { name: { contains: '1 с.ш. ППУ-п' } },
        { name: { contains: 'QF1 ППУ-п' } },
        { name: { contains: '01а' } },
      ]
    },
    include: {
      DeviceSlot: {
        include: {
          Device: {
            include: { Load: true }
          }
        }
      }
    }
  });

  console.log('=== Найденные элементы ===\n');
  for (const el of elements) {
    const load = el.DeviceSlot?.[0]?.Device?.[0]?.Load;
    console.log(`${el.name}`);
    console.log(`  ID: ${el.id}`);
    console.log(`  Type: ${el.type}`);
    console.log(`  Status: ${el.operationalStatus}`);
    console.log(`  sumP: ${el.sumPInstalled} / ${el.sumPCalculated} кВт`);
    if (load) {
      console.log(`  Load: P=${load.powerP}, Ки=${load.usageFactor}`);
    }
    console.log();
  }

  // Найти связи для этих элементов
  const ids = elements.map(e => e.id);
  const connections = await prisma.connection.findMany({
    where: {
      OR: [
        { sourceId: { in: ids } },
        { targetId: { in: ids } }
      ]
    }
  });

  console.log('=== Связи ===\n');
  for (const conn of connections) {
    const source = elements.find(e => e.id === conn.sourceId);
    const target = elements.find(e => e.id === conn.targetId);
    if (source || target) {
      console.log(`${source?.name || conn.sourceId} → ${target?.name || conn.targetId}`);
      console.log(`  Status: ${conn.operationalStatus}`);
      console.log();
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

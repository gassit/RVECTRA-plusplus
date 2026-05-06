import { prisma } from '../src/lib/prisma';

async function main() {
  // Проверить КМ1 и КМ2
  const kms = await prisma.element.findMany({
    where: {
      name: { contains: 'КМ' }
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

  console.log('=== КМ элементы (детали) ===\n');

  for (const km of kms) {
    console.log(`${km.name}`);
    console.log(`  Type: ${km.type}`);
    console.log(`  sumP: ${km.sumPInstalled || 0} / ${km.sumPCalculated || 0} кВт`);
    
    const load = km.DeviceSlot?.[0]?.Device?.[0]?.Load;
    if (load) {
      console.log(`  Load.powerP: ${load.powerP}`);
      console.log(`  Load.usageFactor: ${load.usageFactor}`);
    } else {
      console.log(`  Load: НЕТ ЗАПИСИ В ТАБЛИЦЕ LOAD!`);
    }
    console.log();
  }

  // Проверить ШП5 цепочку
  console.log('=== Цепочка ШП5 ===\n');

  const shp5bus = await prisma.element.findFirst({
    where: { name: { contains: 'магистраль ШП5' } }
  });

  if (shp5bus) {
    console.log(`Шина: ${shp5bus.name}`);
    console.log(`  Type: ${shp5bus.type}`);
    console.log(`  sumP: ${shp5bus.sumPInstalled || 0} кВт`);

    // Найти исходящие связи
    const outgoing = await prisma.connection.findMany({
      where: { sourceId: shp5bus.id },
      include: {
        Element_Connection_targetIdToElement: {
          select: { name: true, type: true, sumPInstalled: true }
        }
      }
    });

    console.log(`  Исходящие:`);
    for (const c of outgoing) {
      const tgt = c.Element_Connection_targetIdToElement;
      console.log(`    → ${tgt?.name} [${tgt?.type}] P=${tgt?.sumPInstalled || 0}`);
    }
  }

  // Проверить нагрузки ШП5
  console.log('\n=== Нагрузки ШП5 ===\n');
  const shp5Loads = await prisma.element.findMany({
    where: { name: { contains: 'Шкаф отбора ШП5' } },
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

  for (const el of shp5Loads) {
    const load = el.DeviceSlot?.[0]?.Device?.[0]?.Load;
    console.log(`${el.name} [${el.type}]`);
    console.log(`  sumP: ${el.sumPInstalled || 0}`);
    if (load) {
      console.log(`  Load.powerP: ${load.powerP}`);
    }
    console.log();
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

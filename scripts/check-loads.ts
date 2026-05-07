import { prisma } from '../src/lib/prisma';

async function main() {
  // Найти все LOAD элементы
  const loads = await prisma.element.findMany({
    where: { type: 'load' },
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

  console.log('=== Все нагрузки (LOAD) ===\n');
  for (const load of loads) {
    const loadData = load.DeviceSlot?.[0]?.Device?.[0]?.Load;
    const p = loadData?.powerP || 0;
    const ki = loadData?.usageFactor || 0.8;
    if (p > 0) {
      console.log(`${load.name}`);
      console.log(`  ID: ${load.id}`);
      console.log(`  Pуст: ${p} кВт, Ки: ${ki}, Pрасч: ${(p * ki).toFixed(1)} кВт`);
      console.log();
    }
  }

  // Найти связи для нагрузок
  console.log('=== Связи нагрузок ===\n');
  for (const load of loads) {
    const loadData = load.DeviceSlot?.[0]?.Device?.[0]?.Load;
    const p = loadData?.powerP || 0;
    if (p > 0) {
      // Найти входящую связь (от родителя)
      const incoming = await prisma.connection.findFirst({
        where: { targetId: load.id }
      });
      if (incoming) {
        const parent = await prisma.element.findUnique({
          where: { id: incoming.sourceId }
        });
        console.log(`${parent?.name || incoming.sourceId} → ${load.name} (P=${p})`);
      } else {
        console.log(`НЕТ СВЯЗИ → ${load.name} (P=${p})`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

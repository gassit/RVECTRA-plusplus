import { prisma } from '../src/lib/prisma';

async function main() {
  const kms = ['КМ1 ППУ-п', 'КМ2 ППУ-п'];

  for (const kmName of kms) {
    const element = await prisma.element.findFirst({
      where: { name: kmName },
      include: {
        DeviceSlot: {
          include: {
            Device: {
              include: { Load: true, Breaker: true }
            }
          }
        }
      }
    });

    if (!element) {
      console.log(`${kmName}: НЕ НАЙДЕН`);
      continue;
    }

    console.log(`\n=== ${kmName} ===`);
    console.log(`Текущий тип: ${element.type}`);

    // Удаляем Load если есть
    for (const slot of element.DeviceSlot || []) {
      for (const device of slot.Device || []) {
        if (device.Load) {
          await prisma.load.delete({ where: { id: device.Load.id } });
          console.log(`  Удалена запись Load: ${device.Load.id}`);
        }
        
        // Создаём Breaker если нет
        if (!device.Breaker) {
          const breaker = await prisma.breaker.create({
            data: {
              id: crypto.randomUUID(),
              deviceId: device.id,
              breakerType: 'MCB',
              ratedCurrent: 63,
              updatedAt: new Date(),
            }
          });
          console.log(`  Создана запись Breaker: ${breaker.id}`);
        }
      }
    }

    // Меняем тип элемента
    await prisma.element.update({
      where: { id: element.id },
      data: { type: 'BREAKER' }
    });
    console.log(`  Тип изменён: LOAD → BREAKER`);
  }

  console.log('\n=== Готово ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());

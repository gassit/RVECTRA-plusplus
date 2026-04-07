import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const adapter = new PrismaLibSql({
  url: 'file:/home/z/my-project/db/custom.db'
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Справочник кабелей (ПУЭ)
  const cables = [
    { mark: 'ВВГнг-LS 3x1.5', section: 1.5, material: 'copper', voltage: 0.66, iDop: 21, r0: 12.1, x0: 0.096 },
    { mark: 'ВВГнг-LS 3x2.5', section: 2.5, material: 'copper', voltage: 0.66, iDop: 27, r0: 7.41, x0: 0.091 },
    { mark: 'ВВГнг-LS 3x4', section: 4, material: 'copper', voltage: 0.66, iDop: 36, r0: 4.61, x0: 0.087 },
    { mark: 'ВВГнг-LS 3x6', section: 6, material: 'copper', voltage: 0.66, iDop: 46, r0: 3.08, x0: 0.083 },
    { mark: 'ВВГнг-LS 3x10', section: 10, material: 'copper', voltage: 0.66, iDop: 63, r0: 1.83, x0: 0.078 },
    { mark: 'ВВГнг-LS 3x16', section: 16, material: 'copper', voltage: 0.66, iDop: 85, r0: 1.15, x0: 0.077 },
    { mark: 'ВВГнг-LS 3x25', section: 25, material: 'copper', voltage: 0.66, iDop: 112, r0: 0.727, x0: 0.073 },
    { mark: 'ВВГнг-LS 3x35', section: 35, material: 'copper', voltage: 0.66, iDop: 137, r0: 0.524, x0: 0.070 },
    { mark: 'ВВГнг-LS 3x50', section: 50, material: 'copper', voltage: 0.66, iDop: 167, r0: 0.387, x0: 0.067 },
    { mark: 'ВВГнг-LS 3x70', section: 70, material: 'copper', voltage: 0.66, iDop: 208, r0: 0.268, x0: 0.065 },
    { mark: 'ВВГнг-LS 3x95', section: 95, material: 'copper', voltage: 0.66, iDop: 253, r0: 0.193, x0: 0.062 },
    { mark: 'ВВГнг-LS 3x120', section: 120, material: 'copper', voltage: 0.66, iDop: 292, r0: 0.153, x0: 0.060 },
    { mark: 'ВВГнг-LS 3x150', section: 150, material: 'copper', voltage: 0.66, iDop: 333, r0: 0.124, x0: 0.060 },
    { mark: 'ВВГнг-LS 3x185', section: 185, material: 'copper', voltage: 0.66, iDop: 382, r0: 0.0991, x0: 0.058 },
    { mark: 'ВВГнг-LS 3x240', section: 240, material: 'copper', voltage: 0.66, iDop: 452, r0: 0.0754, x0: 0.056 },
    { mark: 'АВВГ 3x2.5', section: 2.5, material: 'aluminum', voltage: 0.66, iDop: 21, r0: 12.1, x0: 0.091 },
    { mark: 'АВВГ 3x4', section: 4, material: 'aluminum', voltage: 0.66, iDop: 27, r0: 7.41, x0: 0.087 },
    { mark: 'АВВГ 3x6', section: 6, material: 'aluminum', voltage: 0.66, iDop: 35, r0: 4.61, x0: 0.083 },
    { mark: 'АВВГ 3x10', section: 10, material: 'aluminum', voltage: 0.66, iDop: 46, r0: 3.08, x0: 0.078 },
    { mark: 'АВВГ 3x16', section: 16, material: 'aluminum', voltage: 0.66, iDop: 60, r0: 1.91, x0: 0.077 },
    { mark: 'АВВГ 3x25', section: 25, material: 'aluminum', voltage: 0.66, iDop: 80, r0: 1.2, x0: 0.073 },
    { mark: 'АВВГ 3x35', section: 35, material: 'aluminum', voltage: 0.66, iDop: 99, r0: 0.868, x0: 0.070 },
    { mark: 'АВВГ 3x50', section: 50, material: 'aluminum', voltage: 0.66, iDop: 121, r0: 0.641, x0: 0.067 },
    { mark: 'АВВГ 3x70', section: 70, material: 'aluminum', voltage: 0.66, iDop: 152, r0: 0.443, x0: 0.065 },
    { mark: 'АВВГ 3x95', section: 95, material: 'aluminum', voltage: 0.66, iDop: 185, r0: 0.32, x0: 0.062 },
    { mark: 'АВВГ 3x120', section: 120, material: 'aluminum', voltage: 0.66, iDop: 214, r0: 0.253, x0: 0.060 },
  ];

  for (const cable of cables) {
    await prisma.cableReference.upsert({
      where: { mark: cable.mark },
      update: cable,
      create: cable
    });
  }

  // Справочник автоматов
  const breakers = [
    { type: 'ВА47-29 1P 6A', ratedCurrent: 6, breakingCapacity: 4.5, curve: 'C', poles: 1 },
    { type: 'ВА47-29 1P 10A', ratedCurrent: 10, breakingCapacity: 4.5, curve: 'C', poles: 1 },
    { type: 'ВА47-29 1P 16A', ratedCurrent: 16, breakingCapacity: 4.5, curve: 'C', poles: 1 },
    { type: 'ВА47-29 1P 20A', ratedCurrent: 20, breakingCapacity: 4.5, curve: 'C', poles: 1 },
    { type: 'ВА47-29 1P 25A', ratedCurrent: 25, breakingCapacity: 4.5, curve: 'C', poles: 1 },
    { type: 'ВА47-29 1P 32A', ratedCurrent: 32, breakingCapacity: 4.5, curve: 'C', poles: 1 },
    { type: 'ВА47-29 1P 40A', ratedCurrent: 40, breakingCapacity: 4.5, curve: 'C', poles: 1 },
    { type: 'ВА47-29 1P 50A', ratedCurrent: 50, breakingCapacity: 4.5, curve: 'C', poles: 1 },
    { type: 'ВА47-29 1P 63A', ratedCurrent: 63, breakingCapacity: 4.5, curve: 'C', poles: 1 },
    { type: 'ВА47-29 3P 16A', ratedCurrent: 16, breakingCapacity: 4.5, curve: 'C', poles: 3 },
    { type: 'ВА47-29 3P 25A', ratedCurrent: 25, breakingCapacity: 4.5, curve: 'C', poles: 3 },
    { type: 'ВА47-29 3P 32A', ratedCurrent: 32, breakingCapacity: 4.5, curve: 'C', poles: 3 },
    { type: 'ВА47-29 3P 40A', ratedCurrent: 40, breakingCapacity: 4.5, curve: 'C', poles: 3 },
    { type: 'ВА47-29 3P 50A', ratedCurrent: 50, breakingCapacity: 4.5, curve: 'C', poles: 3 },
    { type: 'ВА47-29 3P 63A', ratedCurrent: 63, breakingCapacity: 4.5, curve: 'C', poles: 3 },
    { type: 'ВА47-29 3P 80A', ratedCurrent: 80, breakingCapacity: 4.5, curve: 'C', poles: 3 },
    { type: 'ВА47-29 3P 100A', ratedCurrent: 100, breakingCapacity: 4.5, curve: 'C', poles: 3 },
    { type: 'ВА55-41 160A', ratedCurrent: 160, breakingCapacity: 25, curve: 'C', poles: 3 },
    { type: 'ВА55-41 200A', ratedCurrent: 200, breakingCapacity: 25, curve: 'C', poles: 3 },
    { type: 'ВА55-41 250A', ratedCurrent: 250, breakingCapacity: 25, curve: 'C', poles: 3 },
    { type: 'ВА55-43 400A', ratedCurrent: 400, breakingCapacity: 35, curve: 'C', poles: 3 },
    { type: 'ВА55-43 500A', ratedCurrent: 500, breakingCapacity: 35, curve: 'C', poles: 3 },
    { type: 'ВА55-43 630A', ratedCurrent: 630, breakingCapacity: 35, curve: 'C', poles: 3 },
  ];

  for (const breaker of breakers) {
    await prisma.breakerReference.upsert({
      where: { type: breaker.type },
      update: breaker,
      create: breaker
    });
  }

  // Справочник трансформаторов
  const transformers = [
    { type: 'ТМ-25/10', power: 25, primaryKV: 10, secondaryKV: 0.4, ukz: 4.5, pkz: 0.6 },
    { type: 'ТМ-40/10', power: 40, primaryKV: 10, secondaryKV: 0.4, ukz: 4.5, pkz: 0.88 },
    { type: 'ТМ-63/10', power: 63, primaryKV: 10, secondaryKV: 0.4, ukz: 4.5, pkz: 1.28 },
    { type: 'ТМ-100/10', power: 100, primaryKV: 10, secondaryKV: 0.4, ukz: 4.5, pkz: 1.97 },
    { type: 'ТМ-160/10', power: 160, primaryKV: 10, secondaryKV: 0.4, ukz: 4.5, pkz: 2.65 },
    { type: 'ТМ-250/10', power: 250, primaryKV: 10, secondaryKV: 0.4, ukz: 4.5, pkz: 3.7 },
    { type: 'ТМ-400/10', power: 400, primaryKV: 10, secondaryKV: 0.4, ukz: 4.5, pkz: 5.5 },
    { type: 'ТМ-630/10', power: 630, primaryKV: 10, secondaryKV: 0.4, ukz: 5.5, pkz: 7.6 },
    { type: 'ТМ-1000/10', power: 1000, primaryKV: 10, secondaryKV: 0.4, ukz: 5.5, pkz: 10.8 },
    { type: 'ТМ-1600/10', power: 1600, primaryKV: 10, secondaryKV: 0.4, ukz: 5.5, pkz: 16.5 },
    { type: 'ТМ-2500/10', power: 2500, primaryKV: 10, secondaryKV: 0.4, ukz: 6, pkz: 23.5 },
    { type: 'ТМГ-400/10', power: 400, primaryKV: 10, secondaryKV: 0.4, ukz: 4.5, pkz: 4.3 },
    { type: 'ТМГ-630/10', power: 630, primaryKV: 10, secondaryKV: 0.4, ukz: 5.5, pkz: 6.5 },
    { type: 'ТМГ-1000/10', power: 1000, primaryKV: 10, secondaryKV: 0.4, ukz: 5.5, pkz: 9.2 },
    { type: 'ТМГ-1600/10', power: 1600, primaryKV: 10, secondaryKV: 0.4, ukz: 5.5, pkz: 13.0 },
  ];

  for (const transformer of transformers) {
    await prisma.transformerReference.upsert({
      where: { type: transformer.type },
      update: transformer,
      create: transformer
    });
  }

  console.log('Reference data seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

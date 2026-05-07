import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Сбрасываем voltageDrop во всех кабелях
  const result = await prisma.cable.updateMany({
    where: { voltageDrop: { not: null } },
    data: { voltageDrop: null }
  });
  console.log('Reset voltageDrop for', result.count, 'cables');
}

main().catch(console.error).finally(() => prisma.$disconnect());

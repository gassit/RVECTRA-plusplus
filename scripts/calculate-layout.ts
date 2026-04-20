/**
 * Скрипт для расчета позиций элементов
 * Правила построения удалены
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Правила построения удалены. Нет элементов для размещения.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

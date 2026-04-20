/**
 * Скрипт для пересчёта позиций всех элементов схемы
 * Правила построения удалены
 */

import { prisma } from '../lib/prisma';
import { calculateLayout, saveLayoutPositions } from '../lib/services/layout.service';

async function main() {
  console.log('Правила построения удалены. Пересчёт позиций не выполняется.');

  const result = calculateLayout([], []);

  console.log('Для добавления правил построения отредактируйте lib/services/layout.service.ts');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

/**
 * Скрипт для пересчёта позиций всех элементов схемы
 * Запуск: npx tsx scripts/recalculate-layout.ts
 */

import { prisma } from '../lib/prisma';
import { calculateLayout, saveLayoutPositions, getLayoutRules } from '../lib/services/layout.service';

async function main() {
  console.log('=== Пересчёт позиций элементов схемы ===\n');
  
  // Выводим правила
  console.log(getLayoutRules());
  console.log('\n');
  
  // Получаем все элементы
  const elements = await prisma.element.findMany({
    select: {
      id: true,
      elementId: true,
      name: true,
      type: true,
      parentId: true,
    }
  });
  
  console.log(`Загружено элементов: ${elements.length}`);
  
  // Получаем все связи
  const connections = await prisma.connection.findMany({
    select: {
      id: true,
      sourceId: true,
      targetId: true,
    }
  });
  
  console.log(`Загружено связей: ${connections.length}`);
  
  // Считаем элементы по типам
  const typeCount = new Map<string, number>();
  for (const el of elements) {
    const type = el.type.toLowerCase();
    typeCount.set(type, (typeCount.get(type) || 0) + 1);
  }
  
  console.log('\nЭлементы по типам:');
  for (const [type, count] of typeCount) {
    console.log(`  ${type}: ${count}`);
  }
  
  // Вычисляем layout
  console.log('\nВычисление позиций...');
  const result = calculateLayout(elements, connections);
  
  // Выводим статистику
  console.log(`\nРассчитано позиций: ${result.positions.size}`);
  console.log(`Границ Cabinet: ${result.cabinetBounds.size}`);
  console.log(`Смещений для линий: ${result.edgeOffsets.size}`);
  
  // Показываем позиции SOURCE элементов
  console.log('\nПозиции SOURCE элементов:');
  for (const el of elements) {
    if (el.type.toLowerCase() === 'source') {
      const pos = result.positions.get(el.id);
      console.log(`  ${el.name}: (${pos?.x}, ${pos?.y})`);
    }
  }
  
  // Показываем позиции LOAD элементов
  console.log('\nПозиции LOAD элементов (первые 5):');
  let loadCount = 0;
  for (const el of elements) {
    if (el.type.toLowerCase() === 'load' && loadCount < 5) {
      const pos = result.positions.get(el.id);
      console.log(`  ${el.name}: (${pos?.x}, ${pos?.y})`);
      loadCount++;
    }
  }
  
  // Сохраняем в БД
  console.log('\nСохранение позиций в базу данных...');
  const updated = await saveLayoutPositions(result.positions, prisma);
  console.log(`Обновлено записей: ${updated}`);
  
  console.log('\n=== Готово! ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

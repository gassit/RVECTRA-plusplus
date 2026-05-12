import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import * as xlsx from 'xlsx';

const adapter = new PrismaLibSql({
  url: 'file:/home/z/my-project/db/custom.db'
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma: any = new PrismaClient({ adapter });

// ============================================================================
// ОПРЕДЕЛЕНИЕ ТИПА ЭЛЕМЕНТА ПО ИМЕНИ
// ============================================================================
function detectElementType(name: string): string {
  const nameLower = name.toLowerCase();

  // ИСТОЧНИКИ
  if (/^т\d\s/.test(nameLower)) return 'source';
  if (nameLower.includes('трансформатор')) return 'source';
  if (/^т\d\s+тп/i.test(nameLower)) return 'source';
  if (nameLower.startsWith('пц')) return 'source';
  if (nameLower.startsWith('цп')) return 'source';
  if (nameLower.startsWith('дгу')) return 'source';
  if (nameLower.includes('ибп') && !nameLower.includes('точрасп')) return 'source';

  // ВЫКЛЮЧАТЕЛИ
  if (/^qf\d*[\.\d]*(\s|$)/i.test(nameLower)) return 'breaker';
  if (/^qf\s/i.test(nameLower)) return 'breaker';
  if (/^[1-9]qf\d*(\s|$)/i.test(nameLower)) return 'breaker';
  if (/^qs\d*(\s|$)/i.test(nameLower)) return 'breaker';
  if (/\dqs\d*(\s|$)/i.test(nameLower)) return 'breaker';
  if (/^км\d*/i.test(nameLower)) return 'breaker';
  if (nameLower.startsWith('автоматика')) return 'breaker';
  if (/^(\d*)fu\d*/i.test(nameLower)) return 'breaker';

  // ШКАФЫ
  if (/^щр\d*/i.test(nameLower)) return 'cabinet';
  if (/^шу\s/i.test(nameLower) || /^шу\d/i.test(nameLower)) return 'cabinet';
  if (/^вру/i.test(nameLower)) return 'cabinet';
  if (/^грщ/i.test(nameLower)) return 'cabinet';
  if (nameLower === 'авр' || /^авр\s/i.test(nameLower)) return 'cabinet';
  if (/^щао/i.test(nameLower)) return 'cabinet';
  if (/^\d*ш[удвз]/i.test(nameLower)) return 'cabinet';
  if (nameLower.startsWith('шкаф')) return 'cabinet';

  // УЗЛЫ/ТОЧКИ РАСПРЕДЕЛЕНИЯ
  if (nameLower.includes('точрасп') || nameLower.includes('точ расп')) return 'junction';
  if (nameLower.includes('точка распределения')) return 'junction';
  if (nameLower.includes('точка')) return 'junction';

  // УЧЁТ
  if (nameLower.startsWith('узел учета')) return 'meter';
  if (/^узуч/i.test(nameLower)) return 'meter';
  if (nameLower.includes('учет') || nameLower.includes('учёт')) return 'meter';

  // ШИНЫ (исключаем "точрасп")
  if (!nameLower.includes('точрасп')) {
    if (/\d*с\.ш\./.test(nameLower)) return 'bus';
    if (nameLower.includes('магистраль') || nameLower === 'шина') return 'bus';
    if (nameLower.includes('сборка')) return 'bus';
  }

  return 'load';
}

// ============================================================================
// ГЕНЕРАТОРЫ ID
// ============================================================================
let elementCounter = 0;
let connectionCounter = 0;

function generateElementId(type: string, name?: string): string {
  elementCounter++;
  const prefix = type.toUpperCase().slice(0, 3);
  const namePart = name ? `_${name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)}` : '';
  return `el_${prefix}_${elementCounter}${namePart}`;
}

function generateConnectionId(fromId: string, toId: string): string {
  connectionCounter++;
  return `conn_${fromId}_${toId}_${connectionCounter}`;
}

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ ИМПОРТА
// ============================================================================
async function main() {
  console.log('=== ИМПОРТ ДАННЫХ ИЗ EXCEL ===\n');

  const workbook = xlsx.readFile('/home/z/my-project/upload/input.xlsx');

  // Обработка листа Networkall - связи между элементами
  console.log('Обработка листа: Networkall');
  const networkSheet = workbook.Sheets['Networkall'];
  const networkData = xlsx.utils.sheet_to_json<Record<string, unknown>>(networkSheet);

  console.log(`Всего строк в Networkall: ${networkData.length}`);

  // Карта: оригинальное имя → сгенерированный ID
  const elementsMap = new Map<string, { id: string; name: string; type: string; parentId?: string }>();
  // Карта: имя шкафа → ID шкафа
  const cabinetMap = new Map<string, string>();
  // Связи для создания
  const pendingConnections: Array<{ fromName: string; toName: string; cabinet?: string }> = [];

  // ========================================
  // ПРОХОД 1: Собираем все элементы и шкафы
  // ========================================
  console.log('\n--- Проход 1: Сбор элементов ---');

  for (const row of networkData) {
    // Имена колонок из Excel
    const fromName = String(row['От (from)'] || '');
    const toName = String(row['До (to)'] || '');
    const cabinetName = String(row['Шкаф/сборка'] || '').trim();

    if (!fromName && !toName) continue;

    // Добавляем элементы
    for (const name of [fromName, toName]) {
      if (!name || elementsMap.has(name)) continue;

      const type = detectElementType(name);
      const id = generateElementId(type, name);
      elementsMap.set(name, { id, name, type });

      // Если элемент - шкаф, добавляем в карту шкафов
      if (type === 'cabinet') {
        cabinetMap.set(name, id);
        console.log(`  [Cabinet] ${name} → ${id}`);
      }
    }

    // Добавляем шкаф из колонки "Шкаф/сборка"
    if (cabinetName && !cabinetMap.has(cabinetName)) {
      const type = detectElementType(cabinetName);
      // Шкаф из колонки - это всегда cabinet (если не source/bus)
      if (type !== 'source' && type !== 'bus') {
        const id = generateElementId('cabinet', cabinetName);
        cabinetMap.set(cabinetName, id);
        elementsMap.set(cabinetName, { id, name: cabinetName, type: 'cabinet' });
        console.log(`  [Cabinet from column] ${cabinetName} → ${id}`);
      }
    }

    // Сохраняем связь
    if (fromName && toName) {
      pendingConnections.push({ fromName, toName, cabinet: cabinetName || undefined });
    }
  }

  console.log(`\nНайдено уникальных элементов: ${elementsMap.size}`);
  console.log(`Найдено шкафов: ${cabinetMap.size}`);
  console.log(`Связей для обработки: ${pendingConnections.length}`);

  // ========================================
  // ОПРЕДЕЛЯЕМ PARENT_ID ДЛЯ ЭЛЕМЕНТОВ
  // ========================================
  console.log('\n--- Определение parent_id ---');

  for (const [name, info] of elementsMap) {
    if (info.type === 'cabinet') continue; // Шкаф не может быть ребёнком

    const nameLower = name.toLowerCase();
    let bestMatch = '';
    let bestMatchId: string | undefined;

    // Ищем шкаф, чьё имя содержится в имени элемента
    for (const [cabName, cabId] of cabinetMap) {
      const cabLower = cabName.toLowerCase();
      if (nameLower.includes(cabLower) && cabLower.length > bestMatch.length) {
        bestMatch = cabLower;
        bestMatchId = cabId;
      }
    }

    if (bestMatchId) {
      info.parentId = bestMatchId;
    }
  }

  // Подсчитываем детей для каждого шкафа
  const cabinetChildren = new Map<string, number>();
  for (const [name, info] of elementsMap) {
    if (info.parentId) {
      const count = cabinetChildren.get(info.parentId) || 0;
      cabinetChildren.set(info.parentId, count + 1);
    }
  }

  console.log('Шкафы с детьми:');
  for (const [cabName, cabId] of cabinetMap) {
    const childCount = cabinetChildren.get(cabId) || 0;
    console.log(`  ${cabName}: ${childCount} детей`);
  }

  // ========================================
  // ОЧИЩАЕМ БАЗУ ДАННЫХ
  // ========================================
  console.log('\n--- Очистка базы данных ---');

  try {
    await prisma.connection.deleteMany({});
    await prisma.element.deleteMany({});
    console.log('База данных очищена');
  } catch (e) {
    console.log('Предупреждение при очистке:', e);
  }

  // ========================================
  // ПРОХОД 2: Создаём элементы в БД
  // ========================================
  console.log('\n--- Создание элементов ---');

  let elementsCreated = 0;
  let cabinetsCreated = 0;

  // Сначала создаём шкафы
  for (const [cabName, cabId] of cabinetMap) {
    try {
      await prisma.element.create({
        data: {
          elementId: cabId,
          name: cabName,
          type: 'cabinet',
          voltageLevel: 0.4
        }
      });
      cabinetsCreated++;
    } catch (e) {
      console.error(`Ошибка создания шкафа ${cabName}:`, e);
    }
  }
  console.log(`Создано шкафов: ${cabinetsCreated}`);

  // Затем создаём остальные элементы
  for (const [name, info] of elementsMap) {
    if (info.type === 'cabinet') continue; // Шкафы уже созданы

    try {
      await prisma.element.create({
        data: {
          elementId: info.id,
          name: info.name,
          type: info.type,
          voltageLevel: 0.4,
          parentId: info.parentId
        }
      });
      elementsCreated++;
    } catch (e) {
      console.error(`Ошибка создания элемента ${name}:`, e);
    }
  }
  console.log(`Создано элементов (не шкафов): ${elementsCreated}`);

  // ========================================
  // СОЗДАЁМ СВЯЗИ
  // ========================================
  console.log('\n--- Создание связей ---');

  let connectionsCreated = 0;
  let connectionsSkipped = 0;

  for (const conn of pendingConnections) {
    const fromInfo = elementsMap.get(conn.fromName);
    const toInfo = elementsMap.get(conn.toName);

    if (!fromInfo || !toInfo) {
      connectionsSkipped++;
      continue;
    }

    try {
      await prisma.connection.create({
        data: {
          id: generateConnectionId(fromInfo.id, toInfo.id),
          sourceId: fromInfo.id,
          targetId: toInfo.id,
          type: 'cable'
        }
      });
      connectionsCreated++;
    } catch (e) {
      // Связь уже существует
      connectionsSkipped++;
    }
  }

  console.log(`Создано связей: ${connectionsCreated}`);
  console.log(`Пропущено связей: ${connectionsSkipped}`);

  // ========================================
  // ИТОГИ
  // ========================================
  console.log('\n=== ИМПОРТ ЗАВЕРШЁН ===');
  console.log(`Элементов: ${elementsCreated + cabinetsCreated} (из них шкафов: ${cabinetsCreated})`);
  console.log(`Связей: ${connectionsCreated}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

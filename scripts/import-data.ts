import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import type { OperationalStatus } from '../types';
import { propagateStates } from '../lib/services/state-propagation.service.js';

const prisma = new PrismaClient();

// Определение типа элемента по названию
function detectElementType(name: string): string {
  const nameLower = name.toLowerCase();

  // Точки распределения (Точрасп) - проверяем ПЕРВЫМ, это соединения
  if (/точрасп/i.test(name)) {
    return 'junction';
  }

  // Счетчики - проверяем рано, т.к. могут содержать "с.ш."
  if (/узуч/i.test(name) || /счетчик/i.test(name) ||
      /счётчик/i.test(name) || /art-.*pqrs/i.test(name) ||
      /пум/i.test(name)) {
    return 'meter';
  }

  // Источники питания (трансформаторы, генераторы)
  if (/^т[0-9]\s/.test(name) || /трансформатор/i.test(name) ||
      /^т[0-9]\s+тп/i.test(name)) {
    return 'source';
  }

  // ДГУ - источники (но не Точрасп ДГУ)
  if (/^дгу/i.test(name)) {
    return 'source';
  }

  // Автоматические выключатели - проверяем ДО шин!
  // QF с номером (QF1, QF2, QF1.1, QF2.10, QF18 и т.д.)
  if (/^qf\d*[\.\d]*\s/i.test(name) || /^qf\s/i.test(name)) {
    return 'breaker';
  }

  // QS - разъединители (тоже breaker тип), включая 4QS
  if (/^qs\d*\s/i.test(name) || /\dqs\s/i.test(name)) {
    return 'breaker';
  }

  // 1QF, 2QF, 3QF, 4QF - автоматические выключатели
  if (/^[1-4]qf\s/i.test(name)) {
    return 'breaker';
  }

  // Шины и сборки - проверяем ПОСЛЕ выключателей
  if (/с\.ш\./.test(name) || /^шина$/i.test(name) || /сборка/i.test(name)) {
    return 'bus';
  }

  // Нагрузки
  if (/щр[-\d]/i.test(name) || /щао/i.test(name) ||
      /вру/i.test(name) || /чиллер/i.test(name) ||
      /нагрузка/i.test(name) || /эпу/i.test(name) ||
      /шус/i.test(name) || /шу\./i.test(name) ||
      /магистраль/i.test(name)) {
    return 'load';
  }

  // По умолчанию - junction
  return 'junction';
}

/**
 * Парсит оперативный статус из значения state
 * OFF: "off", "выкл", "0", "false", "Отключен"
 * ON: все остальные значения (включая "on", "вкл", "1", "true", "Включен", "Под напряжением", пустое)
 */
function parseOperationalStatus(stateValue: string | undefined | null): OperationalStatus {
  if (!stateValue) return 'ON';

  const state = String(stateValue).toLowerCase().trim();

  // Проверяем на OFF (case-insensitive, частичное совпадение)
  if (/off/.test(state) ||
      /выкл/.test(state) ||
      state === '0' ||
      /false/.test(state) ||
      /отключен/.test(state)) {
    return 'OFF';
  }

  // Все остальные случаи -> ON
  return 'ON';
}

// Поиск файла Excel в папке upload
function findExcelFile(): string | null {
  const uploadDir = '/home/z/my-project/upload';
  const files = fs.readdirSync(uploadDir);
  const excelFiles = files.filter(f =>
    f.endsWith('.xlsx') || f.endsWith('.xls')
  );

  if (excelFiles.length === 0) return null;

  // Приоритет: input.xlsx, затем ЭХОв.xlsx, затем любой xlsx файл
  if (excelFiles.includes('input.xlsx')) {
    return path.join(uploadDir, 'input.xlsx');
  }
  if (excelFiles.includes('ЭХОв.xlsx')) {
    return path.join(uploadDir, 'ЭХОв.xlsx');
  }

  return path.join(uploadDir, excelFiles[0]);
}



async function main() {
  console.log('=== ИМПОРТ ДАННЫХ ИЗ EXCEL ===\n');

  // Поиск файла Excel
  const filePath = findExcelFile();
  if (!filePath) {
    console.error('ОШИБКА: Файл Excel не найден в папке /home/z/my-project/upload/');
    process.exit(1);
  }
  console.log(`Файл: ${filePath}`);

  // Чтение Excel
  const workbook = xlsx.readFile(filePath);
  console.log(`Листы: ${workbook.SheetNames.join(', ')}`);

  // Чтение первого листа
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rawData = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet);

  console.log(`Строк данных: ${rawData.length}\n`);

  // Валидация структуры данных
  if (rawData.length === 0) {
    console.error('ОШИБКА: Лист пуст или не содержит данных');
    process.exit(1);
  }

  const firstRow = rawData[0];
  const columns = Object.keys(firstRow);
  console.log(`Колонки: ${columns.join(', ')}`);

  // Поиск колонок from и to (регистронезависимый)
  let fromCol: string | null = null;
  let toCol: string | null = null;
  let connectionCol: string | null = null;
  let stateCol: string | null = null;

  for (const col of columns) {
    const colLower = col.toLowerCase();
    if (colLower === 'from' || colLower.includes('от')) {
      fromCol = col;
    }
    if (colLower === 'to' || colLower.includes('до') || colLower.includes('к')) {
      toCol = col;
    }
    if (colLower === 'connection' || colLower.includes('соединение') || colLower.includes('кабель')) {
      connectionCol = col;
    }
    if (colLower === 'state' || colLower.includes('состояние') || colLower.includes('статус')) {
      stateCol = col;
    }
  }

  // Если не нашли по названию, пробуем по позиции (колонки C и E в ЭХОв.xlsx)
  if (!fromCol && columns[2]) fromCol = columns[2]; // колонка C (index 2)
  if (!toCol && columns[4]) toCol = columns[4];     // колонка E (index 4)
  if (!connectionCol && columns[3]) connectionCol = columns[3]; // колонка D

  if (!fromCol || !toCol) {
    console.error('\nОШИБКА: Не найдены колонки "from" и "to"');
    console.error('Требуется структура:');
    console.error('  - Колонка "from" (откуда) - обязательная');
    console.error('  - Колонка "to" (куда) - обязательная');
    console.error('  - Колонка "Connection" (тип соединения) - опциональная');
    console.error('  - Колонка "state" (состояние: off/выкл) - опциональная');
    console.error('\nНайденные колонки не соответствуют формату импорта.');
    process.exit(1);
  }

  console.log(`\nИспользуемые колонки:`);
  console.log(`  from: "${fromCol}"`);
  console.log(`  to: "${toCol}"`);
  console.log(`  connection: "${connectionCol || 'не найдена'}"`);
  console.log(`  state: "${stateCol || 'не найдена'}"`);

  // Очистка базы данных
  console.log('\n=== ОЧИСТКА БАЗЫ ДАННЫХ ===');

  await prisma.$transaction([
    prisma.validationResult.deleteMany(),
    prisma.alarm.deleteMany(),
    prisma.meterReading.deleteMany(),
    prisma.load.deleteMany(),
    prisma.meter.deleteMany(),
    prisma.transformer.deleteMany(),
    prisma.breaker.deleteMany(),
    prisma.device.deleteMany(),
    prisma.deviceSlot.deleteMany(),
    prisma.connection.deleteMany(),
    prisma.cable.deleteMany(),
    prisma.element.deleteMany(),
  ]);

  console.log('База данных очищена');

  // Сбор уникальных элементов
  console.log('\n=== ОБРАБОТКА ЭЛЕМЕНТОВ ===');

  const elementsMap = new Map<string, { name: string; type: string; state?: string }>();
  const connectionsData: { from: string; to: string; connection?: string }[] = [];

  let skippedRows = 0;

  for (const row of rawData) {
    // Расширенная нормализация имён:
    // 1. trim - убрать начальные/конечные пробелы
    // 2. Сжать множественные пробелы в один
    // 3. Убрать пробелы вокруг слешей: " / " → "/"
    // 4. Убрать пробелы между заглавными буквами и цифрами: "ГРЩ 1" → "ГРЩ1"
    const normalizeName = (s: string) => s
      .replace(/\s+/g, ' ')           // сжать множественные пробелы
      .replace(/\s*\/\s*/g, '/')      // убрать пробелы вокруг слеша
      .replace(/\s*\\\s*/g, '\\')     // убрать пробелы вокруг обратного слеша
      .replace(/([А-ЯA-Z]+)\s+(\d)/g, '$1$2')  // "ГРЩ 1" → "ГРЩ1"
      .trim();
    
    const from = normalizeName(String(row[fromCol!] || ''));
    const to = normalizeName(String(row[toCol!] || ''));
    const connection = connectionCol ? normalizeName(String(row[connectionCol] || '')) : undefined;
    const state = stateCol ? String(row[stateCol] || '').trim() : undefined;

    if (!from || !to) {
      skippedRows++;
      continue;
    }

    // Добавляем элементы с сохранением state
    if (!elementsMap.has(from)) {
      elementsMap.set(from, {
        name: from,
        type: detectElementType(from),
        state,
      });
    }

    if (!elementsMap.has(to)) {
      elementsMap.set(to, {
        name: to,
        type: detectElementType(to),
        state,
      });
    }

    // Сохраняем связь
    connectionsData.push({ from, to, connection });
  }

  console.log(`Уникальных элементов: ${elementsMap.size}`);
  console.log(`Связей для импорта: ${connectionsData.length}`);
  console.log(`Пропущено строк: ${skippedRows}`);

  // Статистика по типам
  const typeStats = new Map<string, number>();
  for (const el of elementsMap.values()) {
    typeStats.set(el.type, (typeStats.get(el.type) || 0) + 1);
  }
  console.log('\nТипы элементов:');
  for (const [type, count] of typeStats) {
    console.log(`  ${type}: ${count}`);
  }

  // Импорт элементов
  console.log('\n=== ИМПОРТ ЭЛЕМЕНТОВ ===');

  let imported = 0;
  let errors = 0;

  for (const [elementId, info] of elementsMap) {
    try {
      const operationalStatus = parseOperationalStatus(info.state);

      await prisma.element.create({
        data: {
          id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          elementId,
          name: info.name,
          type: info.type,
          voltageLevel: 0.4,
          operationalStatus,
          electricalStatus: 'DEAD', // Будет обновлено в propagateStates
          updatedAt: new Date(),
        },
      });
      imported++;

      if (imported % 50 === 0) {
        console.log(`  Импортировано: ${imported}`);
      }
    } catch (e) {
      console.error(`  Ошибка: ${elementId}`);
      errors++;
    }
  }

  console.log(`Импортировано элементов: ${imported}`);
  if (errors > 0) console.log(`Ошибок: ${errors}`);

  // Импорт связей
  console.log('\n=== ИМПОРТ СВЯЗЕЙ ===');

  let connectionsImported = 0;
  let connectionErrors = 0;

  for (const conn of connectionsData) {
    try {
      const sourceElement = await prisma.element.findUnique({
        where: { elementId: conn.from }
      });
      const targetElement = await prisma.element.findUnique({
        where: { elementId: conn.to }
      });

      if (sourceElement && targetElement) {
        await prisma.connection.create({
          data: {
            id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sourceId: sourceElement.id,
            targetId: targetElement.id,
            operationalStatus: 'ON',
            electricalStatus: 'DEAD', // Будет обновлено в propagateStates
          },
        });
        connectionsImported++;
      }
    } catch (e) {
      connectionErrors++;
    }
  }

  console.log(`Импортировано связей: ${connectionsImported}`);
  if (connectionErrors > 0) console.log(`Ошибок связей: ${connectionErrors}`);

  // Импорт справочника кабелей (если есть лист)
  console.log('\n=== СПРАВОЧНИК КАБЕЛЕЙ ===');

  const cableSheetNames = ['directory_connection', 'cables', 'кабели', 'справочник'];
  let cableSheet: xlsx.WorkSheet | null = null;
  let cableSheetName = '';

  for (const name of cableSheetNames) {
    if (workbook.SheetNames.includes(name)) {
      cableSheet = workbook.Sheets[name];
      cableSheetName = name;
      break;
    }
  }

  if (cableSheet) {
    console.log(`Лист: ${cableSheetName}`);
    const cableData = xlsx.utils.sheet_to_json<Record<string, unknown>>(cableSheet);

    let cablesImported = 0;
    for (const row of cableData) {
      try {
        const mark = String(row['Марка, тип'] || row['mark'] || '');
        const section = parseFloat(String(row['сечение'] || row['section'] || '0'));
        const cores = parseInt(String(row['кол-во жил'] || row['cores'] || '3'));
        const iDop = parseFloat(String(row['ток, А'] || row['current'] || '0'));
        const material = String(row['Материал'] || row['material'] || 'Медь')
          .toLowerCase().includes('алюминий') ? 'aluminum' : 'copper';
        const voltage = parseFloat(String(row['Напряжение'] || row['voltage'] || '380')) / 1000;

        if (mark && section > 0) {
          const markKey = `${mark}_${cores}x${section}`;
          await prisma.cableReference.upsert({
            where: { mark: markKey },
            create: {
              id: `cable_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              mark: markKey,
              section,
              material,
              voltage,
              iDop,
              r0: 0,
              x0: 0.08,
            },
            update: {
              iDop,
              material,
            },
          });
          cablesImported++;
        }
      } catch (e) {
        // Пропускаем ошибки
      }
    }

    console.log(`Импортировано кабелей: ${cablesImported}`);
  } else {
    console.log('Лист справочника кабелей не найден (пропускается)');
  }

  // Распространение состояний
  console.log('\n=== РАСПРОСТРАНЕНИЕ СОСТОЯНИЙ ===');
  const propagationResult = await propagateStates();

  console.log(`\nОбновлено элементов: ${propagationResult.elementsUpdated}`);
  console.log(`Обновлено связей: ${propagationResult.connectionsUpdated}`);
  console.log(`LIVE элементов: ${propagationResult.liveElements}`);
  console.log(`DEAD элементов: ${propagationResult.deadElements}`);
  console.log(`OFF элементов: ${propagationResult.offElements}`);

  // Итоговая статистика
  console.log('\n=== ИМПОРТ ЗАВЕРШЁН ===');

  const totalElements = await prisma.element.count();
  const totalConnections = await prisma.connection.count();

  console.log(`\nИтого в базе данных:`);
  console.log(`  Элементов: ${totalElements}`);
  console.log(`  Связей: ${totalConnections}`);

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Критическая ошибка:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

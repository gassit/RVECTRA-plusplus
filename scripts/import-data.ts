import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import type { OperationalStatus } from '../types';

const adapter = new PrismaLibSQL({
  url: process.env.DATABASE_URL || 'file:/home/z/my-project/db/custom.db'
});
const prisma = new PrismaClient({ adapter });

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

  // Приоритет: ЭХОв.xlsx, затем любой xlsx файл
  if (excelFiles.includes('ЭХОв.xlsx')) {
    return path.join(uploadDir, 'ЭХОв.xlsx');
  }

  return path.join(uploadDir, excelFiles[0]);
}

/**
 * Алгоритм распространения состояний (inline версия для скрипта)
 */
async function propagateStatesInline(): Promise<void> {
  console.log('\n=== РАСПРОСТРАНЕНИЕ СОСТОЯНИЙ ===');

  const elements = await prisma.element.findMany();
  const connections = await prisma.connection.findMany();

  console.log(`Элементов: ${elements.length}`);
  console.log(`Связей: ${connections.length}`);

  // Создаем мапы для быстрого доступа
  const elementMap = new Map<string, typeof elements[0]>();
  for (const el of elements) {
    elementMap.set(el.id, el);
  }

  // Мапы для отслеживания состояний
  const electricalStatusMap = new Map<string, string>();
  const operationalStatusMap = new Map<string, string>();

  // Инициализация: все элементы DEAD
  for (const el of elements) {
    electricalStatusMap.set(el.id, 'DEAD');
    operationalStatusMap.set(el.id, el.operationalStatus || 'ON');
  }

  // Структуры для BFS
  const outgoingConnections = new Map<string, string[]>();
  const connectionMap = new Map<string, typeof connections[0]>();

  for (const conn of connections) {
    connectionMap.set(conn.id, conn);
    if (!outgoingConnections.has(conn.sourceId)) {
      outgoingConnections.set(conn.sourceId, []);
    }
    outgoingConnections.get(conn.sourceId)!.push(conn.id);
  }

  // Найти все SOURCE элементы
  const sources = elements.filter(el => el.type.toLowerCase() === 'source');
  console.log(`Источников: ${sources.length}`);

  // Очередь BFS
  const queue: Array<{ elementId: string }> = [];

  // Инициализация источников
  for (const source of sources) {
    const opStatus = operationalStatusMap.get(source.id) || 'ON';
    if (opStatus === 'ON') {
      electricalStatusMap.set(source.id, 'LIVE');
    } else {
      electricalStatusMap.set(source.id, 'DEAD');
    }
    queue.push({ elementId: source.id });
  }

  // Множество посещенных
  const visited = new Set<string>();

  // BFS
  while (queue.length > 0) {
    const { elementId } = queue.shift()!;
    const currentElement = elementMap.get(elementId);
    if (!currentElement) continue;

    // Пропускаем CABINET при BFS
    if (currentElement.type.toLowerCase() === 'cabinet') continue;

    const currentElectrical = electricalStatusMap.get(elementId) || 'DEAD';
    const currentOperational = operationalStatusMap.get(elementId) || 'ON';

    const outgoing = outgoingConnections.get(elementId) || [];

    for (const connId of outgoing) {
      const conn = connectionMap.get(connId);
      if (!conn) continue;

      const targetId = conn.targetId;
      const targetElement = elementMap.get(targetId);
      if (!targetElement) continue;

      // Пропускаем CABINET в BFS
      if (targetElement.type.toLowerCase() === 'cabinet') continue;

      const connOperational = conn.operationalStatus || 'ON';
      const targetOperational = operationalStatusMap.get(targetId) || 'ON';

      if (currentElectrical === 'LIVE' && currentOperational === 'ON' && connOperational === 'ON') {
        if (targetOperational === 'ON') {
          const prevStatus = electricalStatusMap.get(targetId);
          if (prevStatus !== 'LIVE') {
            electricalStatusMap.set(targetId, 'LIVE');
          }
        } else {
          electricalStatusMap.set(targetId, 'DEAD');
        }
      } else {
        const existingStatus = electricalStatusMap.get(targetId);
        if (existingStatus !== 'LIVE') {
          electricalStatusMap.set(targetId, 'DEAD');
        }
      }

      const visitKey = `${elementId}-${targetId}`;
      if (!visited.has(visitKey)) {
        visited.add(visitKey);
        queue.push({ elementId: targetId });
      }
    }
  }

  // CABINET - пост-обработка
  const cabinets = elements.filter(el => el.type.toLowerCase() === 'cabinet');
  for (const cabinet of cabinets) {
    const children = elements.filter(el => el.parentId === cabinet.id);

    if (children.length === 0) {
      electricalStatusMap.set(cabinet.id, 'DEAD');
    } else {
      const hasLiveChild = children.some(child => electricalStatusMap.get(child.id) === 'LIVE');
      electricalStatusMap.set(cabinet.id, hasLiveChild ? 'LIVE' : 'DEAD');
    }
  }

  // Обновляем элементы
  let elementsUpdated = 0;
  for (const [id, electricalStatus] of electricalStatusMap) {
    try {
      await prisma.element.update({
        where: { id },
        data: { electricalStatus }
      });
      elementsUpdated++;
    } catch (e) {
      console.error(`Ошибка обновления элемента ${id}`);
    }
  }

  // Обновляем связи
  let connectionsUpdated = 0;
  for (const conn of connections) {
    const sourceElectrical = electricalStatusMap.get(conn.sourceId) || 'DEAD';
    const sourceOperational = operationalStatusMap.get(conn.sourceId) || 'ON';
    const connOperational = conn.operationalStatus || 'ON';

    const connElectrical =
      (sourceElectrical === 'LIVE' && sourceOperational === 'ON' && connOperational === 'ON')
        ? 'LIVE'
        : 'DEAD';

    try {
      await prisma.connection.update({
        where: { id: conn.id },
        data: { electricalStatus: connElectrical }
      });
      connectionsUpdated++;
    } catch (e) {
      console.error(`Ошибка обновления связи ${conn.id}`);
    }
  }

  const liveElements = Array.from(electricalStatusMap.values()).filter(s => s === 'LIVE').length;
  console.log(`\nОбновлено элементов: ${elementsUpdated}`);
  console.log(`Обновлено связей: ${connectionsUpdated}`);
  console.log(`LIVE элементов: ${liveElements}`);
  console.log(`DEAD элементов: ${elements.length - liveElements}`);
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
    const from = String(row[fromCol!] || '').trim();
    const to = String(row[toCol!] || '').trim();
    const connection = connectionCol ? String(row[connectionCol] || '').trim() : undefined;
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
          elementId,
          name: info.name,
          type: info.type,
          voltageLevel: 0.4,
          operationalStatus,
          electricalStatus: 'DEAD', // Будет обновлено в propagateStates
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
          await prisma.cableReference.upsert({
            where: { mark: `${mark}_${cores}x${section}` },
            create: {
              mark: `${mark}_${cores}x${section}`,
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
  await propagateStatesInline();

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

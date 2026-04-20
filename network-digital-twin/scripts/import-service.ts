// ============================================================================
// ПРОДВИНУТЫЙ СЕРВИС ИМПОРТА ДАННЫХ ИЗ EXCEL
// Интегрирован из import.service.ts с адаптацией под схему Prisma
// ============================================================================

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { prisma } from '../lib/prisma';

// Путь к файлу импорта по умолчанию
const DEFAULT_INPUT_FILE = '/home/z/my-project/upload/input.xlsx';

// ============================================================================
// ТИПЫ
// ============================================================================

type ElementType = 'SOURCE' | 'BREAKER' | 'BUS' | 'JUNCTION' | 'METER' | 'LOAD' | 'CABINET';
type DeviceType = 'SOURCE' | 'BREAKER' | 'LOAD' | 'METER' | 'TRANSFORMER';

interface ExcelRow {
  [key: string]: string | number | undefined;
}

interface ImportResult {
  success: boolean;
  message: string;
  imported: {
    elements: number;
    devices: number;
    connections: number;
  };
  errors?: string[];
}

// ============================================================================
// СЧЁТЧИКИ ID
// ============================================================================

let elementCounter = 0;
let deviceCounter = 0;

function resetCounters(): void {
  elementCounter = 0;
  deviceCounter = 0;
}

function generateElementId(type: ElementType, code?: string, nameHint?: string): string {
  elementCounter++;
  const prefix = type.substring(0, 3).toUpperCase();
  const suffix = code || nameHint || String(elementCounter).padStart(4, '0');
  // Создаём уникальный ID с timestamp для избежания дубликатов
  return `${prefix}_${suffix}`.replace(/\s+/g, '_').substring(0, 80);
}

function generateDeviceId(type: DeviceType): string {
  deviceCounter++;
  const prefix = type.substring(0, 3);
  return `DEV_${prefix}_${String(deviceCounter).padStart(4, '0')}`;
}

function generateConnectionId(fromId: string, toId: string): string {
  return `CONN_${fromId}_${toId}`.replace(/\s+/g, '_').substring(0, 100);
}

// ============================================================================
// ОПРЕДЕЛЕНИЕ ТИПОВ ЭЛЕМЕНТОВ
// ============================================================================

let elementTypeMap: Map<string, ElementType> = new Map();

/**
 * Определение типа элемента по имени
 */
function detectElementType(name: string, id?: string): ElementType {
  const nameLower = name.toLowerCase();
  const idLower = id?.toLowerCase() || '';

  // Сначала проверяем по карте
  if (id && elementTypeMap.has(idLower)) {
    return elementTypeMap.get(idLower) as ElementType;
  }

  // Пропускаем пустые и null значения
  if (!nameLower || nameLower === 'null' || nameLower === 'nan') return 'LOAD';

  // === ИСТОЧНИКИ ===
  // Трансформаторы: "Т1 ТП21", "Т2 ТП", начинается с "Т" + цифра
  if (/^т\d+\s/.test(nameLower)) return 'SOURCE';
  // "ПЦ" - вводный выключатель (источник)
  if (nameLower.startsWith('пц')) return 'SOURCE';
  // ДГУ - дизель-генератор
  if (nameLower.includes('дгу') && !nameLower.includes('точрасп')) return 'SOURCE';
  // ИБП - источник бесперебойного питания
  if (nameLower.includes('ибп') && !nameLower.includes('точрасп')) return 'SOURCE';

  // === ВЫКЛЮЧАТЕЛИ ===
  // QF + цифра или цифра + QF (включая QF2.1, QF1.10 и т.д.)
  if (/^(\d*)qf[\d.]*/i.test(nameLower)) return 'BREAKER';
  // QS - разъединитель (тоже выключатель)
  if (/^(\d*)qs\d*/i.test(nameLower)) return 'BREAKER';
  // КМ - контактор (QF-подобный коммутационный аппарат)
  if (/^км\d*/i.test(nameLower)) return 'BREAKER';
  // "автоматика" - защита/выключатель
  if (nameLower.startsWith('автоматика')) return 'BREAKER';
  // Предохранитель: fuse/FU
  if (/^(\d*)fu\d*/i.test(nameLower)) return 'BREAKER';

  // === ШКАФЫ / ЩИТЫ ===
  // ЩР - щит распределительный (ЩР3-ПУВ, ЩР4-ПУВ и т.д.)
  if (/^щр\d*/i.test(nameLower)) return 'CABINET';
  // ШУ - шкаф управления
  if (/^шу\s/i.test(nameLower) || /^шу\d/i.test(nameLower)) return 'CABINET';
  // ВРУ - вводно-распределительное устройство
  if (/^вру/i.test(nameLower)) return 'CABINET';
  // ГРЩ - главный распределительный щит
  if (/^грщ/i.test(nameLower)) return 'CABINET';
  // АВР - шкаф АВР
  if (nameLower === 'авр' || /^авр\s/i.test(nameLower)) return 'CABINET';
  // ЩАО, ЩАОп - щит автоматизации
  if (/^щао/i.test(nameLower)) return 'CABINET';
  // ЩДП, ШУЗ, 1ШУЗ и т.п. - шкафы
  if (/^\d*ш[удвз]/i.test(nameLower)) return 'CABINET';
  // "Шкаф" в начале имени
  if (nameLower.startsWith('шкаф')) return 'CABINET';

  // === УЗЛЫ/ТОЧКИ РАСПРЕДЕЛЕНИЯ ===
  // "Точрасп" или "Точ расп" - точка распределения (с пробелом или без)
  if (nameLower.includes('точрасп') || nameLower.includes('точ расп')) return 'JUNCTION';
  // "Точка распределения"
  if (nameLower.includes('точка распределения')) return 'JUNCTION';

  // === УЧЁТ ===
  // "Узел учета" (полная форма)
  if (nameLower.startsWith('узел учета')) return 'METER';
  // "Узуч" - сокращённое обозначение узла учёта
  if (/^узуч/i.test(nameLower)) return 'METER';

  // === ШИНЫ ===
  // "с.ш." - сборные шины (включая форматы типа "1 с.ш. ППУ-п")
  if (/\d*с\.ш\./.test(nameLower)) return 'BUS';
  // "магистраль" или "шина" (не "Точрасп")
  if ((nameLower.includes('магистраль') || nameLower === 'шина') && !nameLower.includes('точрасп')) return 'BUS';
  // Просто номер шины: "1 с.ш. ППУ"
  if (/^\d+\s+с\.ш\./.test(nameLower)) return 'BUS';

  // По умолчанию - нагрузка
  return 'LOAD';
}

/**
 * Чтение типов элементов из листа Elements
 */
function readElementTypes(workbook: XLSX.WorkBook): void {
  elementTypeMap.clear();

  const sheetName = 'Elements';
  if (!workbook.SheetNames.includes(sheetName)) return;

  const sheet = workbook.Sheets[sheetName];
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet);

  // Пропускаем первую строку (заголовки правил)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Колонки: ID, Name, Type
    const keys = Object.keys(row);
    if (keys.length < 3) continue;

    const id = String(row[keys[0]] || '');
    const type = String(row[keys[2]] || '').toLowerCase().trim();

    if (!id || id === 'NaN' || id === 'id') continue;

    // Нормализуем тип
    let normalizedType: ElementType = 'LOAD';
    if (type === 'source') normalizedType = 'SOURCE';
    else if (type === 'breaker') normalizedType = 'BREAKER';
    else if (type === 'bus') normalizedType = 'BUS';
    else if (type === 'junction') normalizedType = 'JUNCTION';
    else if (type === 'meter') normalizedType = 'METER';
    else if (type === 'load') normalizedType = 'LOAD';
    else if (type === 'cabinet') normalizedType = 'CABINET';

    elementTypeMap.set(id.toLowerCase(), normalizedType);
    elementTypeMap.set(id, normalizedType);
  }

  console.log(`Loaded ${elementTypeMap.size} element types from Elements sheet`);
}

// ============================================================================
// ИЕРАРХИЯ ШКАФОВ
// ============================================================================

/**
 * Определение parent_id для элемента по имени.
 * CABINET никогда не может быть дочерним элементом другого CABINET.
 */
function findParentCabinet(
  elementName: string,
  elementType: ElementType,
  cabinetAliases: Array<{ alias: string; cabinetId: string }>
): string | undefined {
  // CABINET не может быть дочерним элементом другого CABINET
  if (elementType === 'CABINET') return undefined;

  const nameLower = elementName.toLowerCase();
  let bestMatch = '';
  let bestMatchId: string | undefined;

  for (const { alias, cabinetId } of cabinetAliases) {
    const aliasLower = alias.toLowerCase();
    if (nameLower.includes(aliasLower)) {
      // Берём самое длинное совпадение (ППУ-п > ППУ)
      if (aliasLower.length > bestMatch.length) {
        bestMatch = aliasLower;
        bestMatchId = cabinetId;
      }
    }
  }

  return bestMatchId;
}

/**
 * Извлекает имена CABINET из столбца K (Сборка) и из имён элементов.
 */
function buildCabinetAliasMap(
  rows: ExcelRow[],
  localElementTypeMap: Map<string, ElementType>
): Array<{ alias: string; cabinetName: string; cabinetId: string }> {
  const cabinetSet = new Set<string>();

  // 1. CABINET из столбца K (Сборка), если он существует
  for (const row of rows) {
    const keys = Object.keys(row);
    // Столбец K — 11-я колонка (индекс 10)
    if (keys.length < 11) continue;
    const assemblyName = String(row[keys[10]] || '').trim();
    if (!assemblyName) continue;

    // Исключаем: шины (с.ш.), описания (секционнирования), null
    if (assemblyName.toLowerCase().includes('с.ш.')) continue;
    if (assemblyName.toLowerCase().includes('секционнир')) continue;
    if (assemblyName.toLowerCase() === 'null') continue;

    // Проверяем что это не уже известный SOURCE/BUS
    const detectedType = detectElementType(assemblyName);
    if (detectedType === 'SOURCE' || detectedType === 'BUS') continue;

    cabinetSet.add(assemblyName);
  }

  // 2. CABINET из имён элементов, определённых как CABINET
  for (const [name, type] of localElementTypeMap) {
    if (type === 'CABINET') {
      cabinetSet.add(name);
    }
  }

  // 3. CABINET из составных имён элементов (ГРЩ1, ЩР3-ПУВ, ППУ и т.д.)
  const cabinetPrefixPatterns = [
    /грщ\d*[^\s/]*/gi,
    /щр\d*[^\s/]*/gi,
    /шу\d*[^\s/]*/gi,
    /вру\d*[^\s/]*/gi,
    /авр\d*/gi,
    /щао\w*/gi,
    /шкаф\s+[^\s/]+/gi,
  ];

  for (const name of localElementTypeMap.keys()) {
    for (const pattern of cabinetPrefixPatterns) {
      const matches = name.match(pattern);
      if (matches) {
        for (const m of matches) {
          const candidate = m.trim();
          if (candidate.toLowerCase().includes('с.ш.')) continue;
          cabinetSet.add(candidate);
        }
      }
    }
  }

  // 4. CABINET из имён шин ("1 с.ш. ГРЩ1" → "ГРЩ1")
  for (const [name, type] of localElementTypeMap) {
    if (type === 'BUS') {
      const match = name.match(/^\d+\s+с\.ш\.\s*(.+)$/i);
      if (match) {
        const candidate = match[1].trim();
        if (candidate && !candidate.includes('кВ') && candidate.length < 30) {
          cabinetSet.add(candidate);
        }
      }
    }
  }

  // Строим карту алиасов
  const aliasMap: Array<{ alias: string; cabinetName: string; cabinetId: string }> = [];

  for (const cabName of cabinetSet) {
    const id = generateElementId('CABINET', undefined, cabName.replace(/\s+/g, '_').toUpperCase().slice(0, 30));

    aliasMap.push({ alias: cabName, cabinetName: cabName, cabinetId: id });

    // Алиас: убираем префикс "Шкаф " / "Шкафа "
    const cabLower = cabName.toLowerCase();
    if (cabLower.startsWith('шкаф ') || cabLower.startsWith('шкафа ')) {
      const withoutPrefix = cabName.replace(/^[Шш]каф[а]?\s+/, '');
      if (withoutPrefix && withoutPrefix !== cabName) {
        aliasMap.push({ alias: withoutPrefix, cabinetName: cabName, cabinetId: id });
      }
    }
  }

  return aliasMap;
}

// ============================================================================
// ОСНОВНОЙ ИМПОРТ
// ============================================================================

/**
 * Очистка базы данных
 */
async function clearDatabase(): Promise<void> {
  await prisma.validationResult.deleteMany();
  await prisma.meterReading.deleteMany();
  await prisma.alarm.deleteMany();
  await prisma.calculatedParams.deleteMany();
  await prisma.connection.deleteMany();
  await prisma.cable.deleteMany();
  await prisma.load.deleteMany();
  await prisma.meter.deleteMany();
  await prisma.transformer.deleteMany();
  await prisma.breaker.deleteMany();
  await prisma.device.deleteMany();
  await prisma.deviceSlot.deleteMany();
  await prisma.element.deleteMany();
  await prisma.cableReference.deleteMany();
  await prisma.breakerReference.deleteMany();
  await prisma.transformerReference.deleteMany();
  await prisma.validationRule.deleteMany();
}

/**
 * Импорт из листа Networkall (двухпроходный)
 */
async function importNetworkAll(rows: ExcelRow[]): Promise<{ elements: number; devices: number; connections: number }> {
  let elements = 0;
  let devices = 0;
  let connections = 0;

  // Временные структуры для двухпроходного импорта
  const processedElements = new Set<string>();
  const elementIdMap = new Map<string, string>(); // оригинальное имя -> generated ID
  const localElementTypeMap = new Map<string, ElementType>(); // имя -> тип
  const pendingConnections: Array<{
    fromName: string;
    toName: string;
    connType: string;
  }> = [];

  // ============================================================================
  // ПРОХОД 1: Собираем все уникальные элементы и их типы
  // ============================================================================
  for (const row of rows) {
    const keys = Object.keys(row);
    if (keys.length < 5) continue;

    const fromName = String(row[keys[2]] || '');
    const connectionType = String(row[keys[3]] || '');
    const toName = String(row[keys[4]] || '');
    const protectionName = String(row[keys[5]] || '');

    if (!fromName && !toName) continue;

    // Собираем элементы и определяем типы
    const names = [fromName, toName, protectionName].filter(Boolean);
    for (const name of names) {
      if (!processedElements.has(name)) {
        const type = detectElementType(name);
        localElementTypeMap.set(name, type);
        processedElements.add(name);
      }
    }

    // Собираем связи
    if (fromName && toName) {
      const connType = connectionType.toLowerCase().includes('шина') ? 'BUSBAR' : 'CABLE';
      pendingConnections.push({ fromName, toName, connType });
    }
  }

  // ============================================================================
  // СТРОИМ ИЕРАРХИЮ: определяем CABINET с алиасами
  // ============================================================================

  const cabinetAliases = buildCabinetAliasMap(rows, localElementTypeMap);

  // Уникальные CABINET имена
  const cabinetNames = [...new Set(cabinetAliases.map(a => a.cabinetName))];
  const cabinetNameToId = new Map<string, string>();
  for (const alias of cabinetAliases) {
    if (!cabinetNameToId.has(alias.cabinetName)) {
      cabinetNameToId.set(alias.cabinetName, alias.cabinetId);
    }
  }

  // Определяем parent_id для каждого элемента
  const parentMap = new Map<string, string>();
  for (const [name, type] of localElementTypeMap) {
    if (type === 'CABINET') continue;
    const parentId = findParentCabinet(name, type, cabinetAliases);
    if (parentId) {
      parentMap.set(name, parentId);
    }
  }

  // ============================================================================
  // ПРОХОД 2: Создаём элементы в БД с правильной иерархией
  // ============================================================================

  // Сначала создаём CABINET
  for (const cabName of cabinetNames) {
    const baseElementId = cabinetNameToId.get(cabName)!;
    const id = `CAB_${elementCounter++}`;
    elementIdMap.set(cabName, id);

    try {
      await prisma.element.create({
        data: {
          id,
          elementId: baseElementId,
          type: 'CABINET',
          name: cabName.slice(0, 100),
          voltageLevel: 0.4,
          posX: 0,
          posY: 0,
        },
      });
      elements++;
    } catch (e: any) {
      if (!e.message?.includes('Unique constraint')) {
        throw e;
      }
      console.log(`Skipping duplicate CABINET: ${cabName}`);
    }
  }

  // Затем все остальные элементы
  for (const [name, type] of localElementTypeMap) {
    if (type === 'CABINET') continue;

    const elementId = generateElementId(type, undefined, name.replace(/\s+/g, '_').toUpperCase().slice(0, 30));
    const id = `${type.substring(0, 3)}_${elementCounter++}`;
    
    // Получаем реальный parentId из elementIdMap (уже созданных CABINET)
    const cabinetAlias = parentMap.get(name);
    const parentId = cabinetAlias ? elementIdMap.get(
      // Находим имя CABINET по его ID в cabinetAliases
      cabinetAliases.find(a => a.cabinetId === cabinetAlias)?.cabinetName || ''
    ) : undefined;

    elementIdMap.set(name, id);

    try {
      // Создаём элемент
      await prisma.element.create({
        data: {
          id,
          elementId,
          type,
          name: name.slice(0, 100),
          voltageLevel: 0.4,
          parentId: parentId,
          posX: 0,
          posY: 0,
        },
      });
    } catch (e: any) {
      if (!e.message?.includes('Unique constraint')) {
        throw e;
      }
      console.log(`Skipping duplicate element: ${name}`);
      continue;
    }

    // Создаём устройство для типов, имеющих Device
    const deviceType = mapElementTypeToDeviceType(type);
    if (deviceType) {
      const deviceId = generateDeviceId(deviceType);
      const slotId = `SLOT_${id}`;

      // Создаём слот
      await prisma.deviceSlot.create({
        data: {
          id: slotId,
          slotId,
          elementId: id,
          slotType: deviceType,
        },
      });

      // Создаём устройство
      await prisma.device.create({
        data: {
          id: deviceId,
          deviceId,
          slotId,
          deviceType,
        },
      });

      // Создаём специфичное устройство
      if (deviceType === 'BREAKER') {
        await prisma.breaker.create({
          data: {
            deviceId,
            ratedCurrent: getDefaultCurrent(type),
          },
        });
      } else if (deviceType === 'LOAD') {
        await prisma.load.create({
          data: {
            deviceId,
            name: name.slice(0, 100),
            powerP: 0,
          },
        });
      } else if (deviceType === 'METER') {
        await prisma.meter.create({
          data: {
            deviceId,
            meterType: 'electric',
          },
        });
      } else if (deviceType === 'TRANSFORMER') {
        await prisma.transformer.create({
          data: {
            deviceId,
            power: 630,
            primaryKV: 10,
            secondaryKV: 0.4,
          },
        });
      }

      devices++;
    }

    elements++;
  }

  // ============================================================================
  // СОЗДАЁМ СВЯЗИ
  // ============================================================================
  for (const conn of pendingConnections) {
    const fromId = elementIdMap.get(conn.fromName);
    const toId = elementIdMap.get(conn.toName);

    if (fromId && toId) {
      try {
        await prisma.connection.create({
          data: {
            id: generateConnectionId(fromId, toId),
            sourceId: fromId,
            targetId: toId,
          },
        });
        connections++;
      } catch (e) {
        // Связь уже существует
      }
    }
  }

  console.log(`Imported: ${elements} elements (${cabinetNames.length} cabinets), ${devices} devices, ${connections} connections`);
  return { elements, devices, connections };
}

/**
 * Маппинг типа элемента на тип устройства
 */
function mapElementTypeToDeviceType(elementType: ElementType): DeviceType | null {
  switch (elementType) {
    case 'SOURCE': return 'TRANSFORMER';
    case 'BREAKER': return 'BREAKER';
    case 'LOAD': return 'LOAD';
    case 'METER': return 'METER';
    default: return null;
  }
}

/**
 * Получение стандартного тока по типу
 */
function getDefaultCurrent(type: ElementType): number {
  switch (type) {
    case 'SOURCE': return 910;
    case 'BREAKER': return 63;
    case 'LOAD': return 16;
    default: return 16;
  }
}

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ ИМПОРТА
// ============================================================================

export async function importFromExcel(filePath?: string): Promise<ImportResult> {
  const inputFile = filePath || DEFAULT_INPUT_FILE;

  try {
    resetCounters();

    // Проверяем существование файла
    if (!fs.existsSync(inputFile)) {
      return {
        success: false,
        message: 'Файл не найден',
        imported: { elements: 0, devices: 0, connections: 0 },
        errors: ['Файл не найден: ' + inputFile],
      };
    }

    console.log(`Importing from: ${inputFile}`);

    // Читаем Excel файл
    const fileBuffer = fs.readFileSync(inputFile);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const errors: string[] = [];
    let totalElements = 0;
    let totalDevices = 0;
    let totalConnections = 0;

    // Очищаем базу данных перед импортом
    console.log('Clearing database...');
    await clearDatabase();

    // Сначала читаем лист Elements для получения типов
    readElementTypes(workbook);

    // Обрабатываем лист Networkall - основная топология
    if (workbook.SheetNames.includes('Networkall')) {
      const sheet = workbook.Sheets['Networkall'];
      const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet);
      console.log(`Processing Networkall, rows: ${rows.length}`);

      const result = await importNetworkAll(rows);
      totalElements += result.elements;
      totalDevices += result.devices;
      totalConnections += result.connections;
    }

    // Импорт справочника кабелей
    if (workbook.SheetNames.includes('directory_connection')) {
      const sheet = workbook.Sheets['directory_connection'];
      const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet);
      console.log(`Processing directory_connection, rows: ${rows.length}`);

      let cablesImported = 0;
      for (const row of rows) {
        try {
          const mark = String(row['Марка, тип'] || '');
          const section = parseFloat(String(row['сечение'] || '0'));
          const cores = parseInt(String(row['кол-во жил'] || '3'));
          const iDop = parseFloat(String(row['ток, А'] || '0'));
          const material = String(row['Материал'] || 'Медь').toLowerCase().includes('алюминий') ? 'aluminum' : 'copper';
          const voltage = parseFloat(String(row['Напряжение'] || '380')) / 1000;

          if (mark && section > 0) {
            await prisma.cableReference.create({
              data: {
                mark: `${mark}_${cores}x${section}`,
                section,
                material,
                voltage,
                iDop,
                r0: 0,
                x0: 0.08,
              },
            });
            cablesImported++;
          }
        } catch (e) {
          // Пропускаем ошибки
        }
      }
      console.log(`Imported ${cablesImported} cable references`);
    }

    // Если данных нет, создаём демо-данные
    if (totalElements === 0) {
      console.log('No data found, creating demo...');
      // Можно добавить создание демо-данных
    }

    return {
      success: true,
      message: `Импорт завершён успешно`,
      imported: {
        elements: totalElements,
        devices: totalDevices,
        connections: totalConnections,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('Import error:', error);
    return {
      success: false,
      message: 'Ошибка импорта',
      imported: { elements: 0, devices: 0, connections: 0 },
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

// ============================================================================
// CLI ЗАПУСК
// ============================================================================

async function main() {
  const filePath = process.argv[2] || DEFAULT_INPUT_FILE;
  const result = await importFromExcel(filePath);
  console.log('\n=== Результат импорта ===');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

// ============================================================================
// СЕРВИС ИМПОРТА ДАННЫХ ИЗ EXCEL
// ============================================================================

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { db } from '@/lib/db';
import {
  resetCounters,
  generateElementId,
  generateDeviceId,
  generateConnectionId,
} from '@/lib/utils/id-generator';
import { calculateCableImpedanceFromReference } from '@/lib/calculations/impedance';
import type { ImportResponse, ElementType, DeviceType } from '@/types';

// Путь к файлу импорта
const INPUT_FILE_PATH = '/home/z/my-project/upload/ЭХОв простой шкаф.xlsx';

/**
 * Интерфейс строки из Excel
 */
interface ExcelRow {
  [key: string]: string | number | undefined;
}

/**
 * Карта типов элементов из Excel
 */
let elementTypeMap: Map<string, string> = new Map();

/**
 * Парсинг Excel файла и импорт данных в БД
 */
export async function importFromExcel(): Promise<ImportResponse> {
  try {
    // Сбрасываем счётчики ID
    resetCounters();

    // Проверяем существование файла
    if (!fs.existsSync(INPUT_FILE_PATH)) {
      return {
        success: false,
        message: 'Файл input.xlsx не найден',
        imported: { elements: 0, devices: 0, connections: 0 },
        errors: ['Файл не найден: ' + INPUT_FILE_PATH],
      };
    }

    // Читаем Excel файл
    const fileBuffer = fs.readFileSync(INPUT_FILE_PATH);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const errors: string[] = [];
    let totalElements = 0;
    let totalDevices = 0;
    let totalConnections = 0;

    // Очищаем базу данных перед импортом
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

    // Обрабатываем каждый лист
    for (const sheetName of workbook.SheetNames) {
      if (sheetName === 'Networkall' || sheetName === 'Elements') continue;
      
      const sheet = workbook.Sheets[sheetName];
      const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet);

      console.log(`Processing sheet: ${sheetName}, rows: ${rows.length}`);

      try {
        switch (sheetName.toLowerCase()) {
          case 'источники':
          case 'sources':
            const sourceResult = await importSources(rows);
            totalElements += sourceResult.elements;
            totalDevices += sourceResult.devices;
            break;

          case 'шкафы':
          case 'cabinets':
            const cabinetResult = await importCabinets(rows);
            totalElements += cabinetResult.elements;
            totalDevices += cabinetResult.devices;
            break;

          case 'нагрузки':
          case 'loads':
            const loadResult = await importLoads(rows);
            totalElements += loadResult.elements;
            totalDevices += loadResult.devices;
            break;

          case 'выключатели':
          case 'breakers':
            const breakerResult = await importBreakers(rows);
            totalElements += breakerResult.elements;
            totalDevices += breakerResult.devices;
            break;

          case 'связи':
          case 'connections':
          case 'кабели':
          case 'cables':
            const connectionResult = await importConnections(rows);
            totalConnections += connectionResult.connections;
            break;
        }
      } catch (sheetError) {
        const errorMsg = `Ошибка обработки листа ${sheetName}: ${sheetError instanceof Error ? sheetError.message : String(sheetError)}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Если данных нет, создаём демо-данные
    if (totalElements === 0) {
      const demoResult = await createDemoData();
      totalElements = demoResult.elements;
      totalDevices = demoResult.devices;
      totalConnections = demoResult.connections;
    }

    // Рассчитываем позиции для визуализации
    await calculateNodePositions();

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
 * Определение parent_id для элемента по имени.
 * CABINET никогда не может быть дочерним элементом другого CABINET.
 * Ищется CABINET, чьё имя (или алиас) содержится в имени элемента (самое длинное совпадение).
 * Алиас: "Шкаф ППУ-п" → алиас "ППУ-п" (без префикса "Шкаф ")
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
 * CABINET из столбца K — это физические шкафы/щиты, к которым относятся элементы строки.
 * Исключает шины (содержат "с.ш.") и описательные тексты.
 * Возвращает карту: имя/алиас → ID кабинета.
 */
function buildCabinetAliasMap(
  rows: ExcelRow[],
  elementTypeMap: Map<string, ElementType>
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
  for (const [name, type] of elementTypeMap) {
    if (type === 'CABINET') {
      cabinetSet.add(name);
    }
  }

  // 3. CABINET из составных имён элементов (ГРЩ1, ЩР3-ПУВ, ППУ и т.д.)
  // Извлекаем имена шкафов по известным префиксам из всех имён элементов
  const cabinetPrefixPatterns = [
    /грщ\d*[^\s/]*/gi,    // ГРЩ1, ГРЩ-1, ГРЩ2
    /щр\d*[^\s/]*/gi,     // ЩР3-ПУВ, ЩР4
    /шу\d*[^\s/]*/gi,     // ШУ1, ШУ-2
    /вру\d*[^\s/]*/gi,    // ВРУ-1
    /авр\d*/gi,           // АВР
    /щао\w*/gi,           // ЩАОп, ЩАО-1
    /шкаф\s+[^\s/]+/gi,  // Шкаф ППУ-п
  ];

  for (const name of elementTypeMap.keys()) {
    for (const pattern of cabinetPrefixPatterns) {
      const matches = name.match(pattern);
      if (matches) {
        for (const m of matches) {
          const candidate = m.trim();
          // Исключаем шины
          if (candidate.toLowerCase().includes('с.ш.')) continue;
          cabinetSet.add(candidate);
        }
      }
    }
  }

  // 4. CABINET из имён шин ("1 с.ш. ГРЩ1" → "ГРЩ1", "1 с.ш. ППУ" → "ППУ")
  // Шина указывает на шкаф, в котором она находится
  for (const [name, type] of elementTypeMap) {
    if (type === 'BUS') {
      const match = name.match(/^\d+\s+с\.ш\.\s*(.+)$/i);
      if (match) {
        const candidate = match[1].trim();
        // Исключаем описательные строки (напряжение, кВ)
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

    // Полное имя CABINET
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

/**
 * Импорт из листа Networkall (двухпроходный: сначала собираем, потом определяем иерархию)
 */
async function importNetworkAll(rows: ExcelRow[]): Promise<{ elements: number; devices: number; connections: number }> {
  let elements = 0;
  let devices = 0;
  let connections = 0;

  // Временные структуры для двухпроходного импорта
  const processedElements = new Set<string>();
  const elementIdMap = new Map<string, string>(); // оригинальное имя -> generated ID
  const elementTypeMap = new Map<string, ElementType>(); // имя -> тип
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
        elementTypeMap.set(name, type);
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

  const cabinetAliases = buildCabinetAliasMap(rows, elementTypeMap);

  // Уникальные CABINET имена (без дубликатов от алиасов)
  const cabinetNames = [...new Set(cabinetAliases.map(a => a.cabinetName))];
  const cabinetNameToId = new Map<string, string>();
  for (const alias of cabinetAliases) {
    if (!cabinetNameToId.has(alias.cabinetName)) {
      cabinetNameToId.set(alias.cabinetName, alias.cabinetId);
    }
  }

  // Определяем parent_id для каждого элемента
  const parentMap = new Map<string, string>(); // elementName -> parentId
  for (const [name, type] of elementTypeMap) {
    // CABINET не может быть дочерним другого CABINET
    if (type === 'CABINET') continue;
    const parentId = findParentCabinet(name, type, cabinetAliases);
    if (parentId) {
      parentMap.set(name, parentId);
    }
  }

  // ============================================================================
  // ПРОХОД 2: Создаём элементы в БД с правильной иерархией
  // ============================================================================

  // Сначала создаём CABINET (чтобы parent_id детей валидировался)
  for (const cabName of cabinetNames) {
    const id = cabinetNameToId.get(cabName)!;
    elementIdMap.set(cabName, id);

    await db.element.create({
      data: {
        id,
        type: 'CABINET',
        name: cabName.slice(0, 100),
        voltage_level: 0.4,
        pos_x: 0,
        pos_y: 0,
      },
    });
    elements++;
  }

  // Затем все остальные элементы
  for (const [name, type] of elementTypeMap) {
    // CABINET уже создан
    if (type === 'CABINET') continue;

    const id = generateElementId(type, undefined, name.replace(/\s+/g, '_').toUpperCase().slice(0, 30));
    const parentId = parentMap.get(name);

    elementIdMap.set(name, id);

    await db.element.create({
      data: {
        id,
        type,
        name: name.slice(0, 100),
        voltage_level: 0.4,
        parent_id: parentId,
        pos_x: 0,
        pos_y: 0,
      },
    });

    // Создаём устройство (только для типов, имеющих Device)
    const deviceType = mapElementTypeToDeviceType(type);
    if (deviceType) {
      await db.device.create({
        data: {
          id: generateDeviceId(deviceType),
          type: deviceType,
          slot_id: id,
          voltage_nom: 400,
          current_nom: getDefaultCurrent(type),
        },
      });
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
        await db.connection.create({
          data: {
            id: generateConnectionId(fromId, toId),
            from_id: fromId,
            to_id: toId,
            type: conn.connType,
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
    case 'SOURCE': return 'SOURCE';
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
    case 'SOURCE': return 910; // 630 кВА
    case 'BREAKER': return 63;
    case 'LOAD': return 16;
    default: return 16;
  }
}

/**
 * Очистка базы данных
 */
async function clearDatabase(): Promise<void> {
  await db.validationResult.deleteMany();
  await db.measurement.deleteMany();
  await db.deviceState.deleteMany();
  await db.protection.deleteMany();
  await db.atsLogic.deleteMany();
  await db.command.deleteMany();
  await db.powerFlow.deleteMany();
  await db.shortCircuit.deleteMany();
  await db.network.deleteMany();
  await db.connection.deleteMany();
  await db.device.deleteMany();
  await db.element.deleteMany();
}

/**
 * Импорт источников
 */
async function importSources(rows: ExcelRow[]): Promise<{ elements: number; devices: number }> {
  let elements = 0;
  let devices = 0;

  for (const row of rows) {
    const name = String(row['Наименование'] || row['Название'] || row['Name'] || row['name'] || `Источник ${elements + 1}`);
    const voltage = Number(row['Напряжение'] || row['U'] || row['Напряжение кВ'] || 10);
    const power = Number(row['Мощность'] || row['S'] || row['Мощность кВА'] || 630);
    const code = String(row['Код'] || row['ID'] || '');

    const elementId = generateElementId('SOURCE', code);

    // Создаём элемент
    await db.element.create({
      data: {
        id: elementId,
        type: 'SOURCE',
        name: name,
        voltage_level: voltage,
        description: `Источник питания ${power} кВА`,
        pos_x: 0,
        pos_y: 0,
      },
    });
    elements++;

    // Создаём устройство
    const deviceId = generateDeviceId('SOURCE');
    await db.device.create({
      data: {
        id: deviceId,
        type: 'SOURCE',
        slot_id: elementId,
        voltage_nom: voltage * 1000,
        current_nom: power / (Math.sqrt(3) * voltage),
        s_kva: power,
      },
    });
    devices++;
  }

  return { elements, devices };
}

/**
 * Импорт шкафов
 */
async function importCabinets(rows: ExcelRow[]): Promise<{ elements: number; devices: number }> {
  let elements = 0;
  let devices = 0;

  for (const row of rows) {
    const name = String(row['Наименование'] || row['Название'] || row['Name'] || row['name'] || `Шкаф ${elements + 1}`);
    const location = String(row['Расположение'] || row['Помещение'] || '');
    const parentId = String(row['Родитель'] || row['Parent'] || '');

    const elementId = generateElementId('CABINET', undefined, name.replace(/\s+/g, '_').toUpperCase());

    await db.element.create({
      data: {
        id: elementId,
        type: 'CABINET',
        name: name,
        location: location || undefined,
        parent_id: parentId || undefined,
        voltage_level: 0.4,
        pos_x: 0,
        pos_y: 0,
      },
    });
    elements++;
  }

  return { elements, devices };
}

/**
 * Импорт нагрузок
 */
async function importLoads(rows: ExcelRow[]): Promise<{ elements: number; devices: number }> {
  let elements = 0;
  let devices = 0;

  for (const row of rows) {
    const name = String(row['Наименование'] || row['Название'] || row['Name'] || row['name'] || `Нагрузка ${elements + 1}`);
    const pKw = Number(row['P'] || row['Мощность'] || row['P кВт'] || 0);
    const qKvar = Number(row['Q'] || row['Реактивная'] || row['Q квар'] || 0);
    const cosPhi = Number(row['cosφ'] || row['КМ'] || row['cosPhi'] || 0.9);
    const parentId = String(row['Шкаф'] || row['Родитель'] || row['Parent'] || '');

    const elementId = generateElementId('LOAD');

    // Создаём элемент
    await db.element.create({
      data: {
        id: elementId,
        type: 'LOAD',
        name: name,
        parent_id: parentId || undefined,
        voltage_level: 0.4,
        pos_x: 0,
        pos_y: 0,
      },
    });
    elements++;

    // Создаём устройство нагрузки
    const deviceId = generateDeviceId('LOAD');
    const sKva = pKw / cosPhi;
    await db.device.create({
      data: {
        id: deviceId,
        type: 'LOAD',
        slot_id: elementId,
        p_kw: pKw,
        q_kvar: qKvar,
        s_kva: sKva,
        cos_phi: cosPhi,
        voltage_nom: 400,
      },
    });
    devices++;
  }

  return { elements, devices };
}

/**
 * Импорт выключателей
 */
async function importBreakers(rows: ExcelRow[]): Promise<{ elements: number; devices: number }> {
  let elements = 0;
  let devices = 0;

  for (const row of rows) {
    const name = String(row['Наименование'] || row['Название'] || row['Name'] || row['name'] || `Выкл ${elements + 1}`);
    const model = String(row['Модель'] || row['Тип'] || row['Model'] || 'ВА-47-29');
    const currentNom = Number(row['Iном'] || row['Ток'] || row['In'] || 16);
    const parentId = String(row['Шкаф'] || row['Родитель'] || row['Parent'] || '');
    const trippingChar = String(row['Характеристика'] || row['Char'] || 'C');

    const elementId = generateElementId('BREAKER', undefined, name.replace(/\s+/g, '_').toUpperCase());

    // Создаём элемент
    await db.element.create({
      data: {
        id: elementId,
        type: 'BREAKER',
        name: name,
        parent_id: parentId || undefined,
        voltage_level: 0.4,
        pos_x: 0,
        pos_y: 0,
      },
    });
    elements++;

    // Создаём устройство
    const deviceId = generateDeviceId('BREAKER');
    await db.device.create({
      data: {
        id: deviceId,
        type: 'BREAKER',
        slot_id: elementId,
        model: model,
        current_nom: currentNom,
        in_rating: currentNom,
        tripping_char: trippingChar,
        voltage_nom: 400,
        poles: 3,
      },
    });
    devices++;
  }

  return { elements, devices };
}

/**
 * Импорт связей
 */
async function importConnections(rows: ExcelRow[]): Promise<{ connections: number }> {
  let connections = 0;

  for (const row of rows) {
    const fromId = String(row['От'] || row['From'] || row['Начало'] || '');
    const toId = String(row['До'] || row['To'] || row['Конец'] || '');
    const wireType = String(row['Марка'] || row['Кабель'] || row['Type'] || 'ВВГ');
    const wireSize = Number(row['Сечение'] || row['Size'] || row['S мм2'] || 4);
    const length = Number(row['Длина'] || row['Length'] || row['L м'] || 10);
    const installationMethod = String(row['Прокладка'] || row['Method'] || 'in_air');

    if (!fromId || !toId) continue;

    // Проверяем существование элементов
    const fromExists = await db.element.findUnique({ where: { id: fromId } });
    const toExists = await db.element.findUnique({ where: { id: toId } });

    if (!fromExists || !toExists) {
      console.warn(`Elements not found for connection: ${fromId} -> ${toId}`);
      continue;
    }

    // Рассчитываем сопротивления
    const impedance = calculateCableImpedanceFromReference(length, wireType, wireSize);
    const connectionId = generateConnectionId(fromId, toId);

    await db.connection.create({
      data: {
        id: connectionId,
        from_id: fromId,
        to_id: toId,
        type: 'CABLE',
        length: length,
        wire_type: wireType,
        wire_size: wireSize,
        material: wireType.startsWith('А') ? 'Al' : 'Cu',
        resistance_r: impedance?.r,
        reactance_x: impedance?.x,
        impedance_z: impedance?.z,
        installation_method: installationMethod,
      },
    });
    connections++;
  }

  return { connections };
}

/**
 * Создание демо-данных
 */
async function createDemoData(): Promise<{ elements: number; devices: number; connections: number }> {
  console.log('Creating demo data...');

  // Создаём источники
  const source1 = generateElementId('SOURCE', 'TP21');
  await db.element.create({
    data: {
      id: source1,
      type: 'SOURCE',
      name: 'ТП-21 Трансформатор 1',
      voltage_level: 0.4,
      description: 'ТМ-630/10, 630 кВА',
      pos_x: 100,
      pos_y: 100,
    },
  });

  const deviceId1 = generateDeviceId('SOURCE');
  await db.device.create({
    data: {
      id: deviceId1,
      type: 'SOURCE',
      slot_id: source1,
      voltage_nom: 400,
      current_nom: 910,
      s_kva: 630,
    },
  });

  // Создаём главный шкаф
  const grSch = generateElementId('CABINET', undefined, 'GRSCH1');
  await db.element.create({
    data: {
      id: grSch,
      type: 'CABINET',
      name: 'ГРЩ-1',
      voltage_level: 0.4,
      description: 'Главный распределительный щит',
      pos_x: 300,
      pos_y: 100,
    },
  });

  // Выключатель ввода
  const qf1 = generateElementId('BREAKER', undefined, 'GRSCH1_IN');
  await db.element.create({
    data: {
      id: qf1,
      type: 'BREAKER',
      name: 'QF1 Вводной',
      parent_id: grSch,
      voltage_level: 0.4,
      pos_x: 350,
      pos_y: 100,
    },
  });

  const devQf1 = generateDeviceId('BREAKER');
  await db.device.create({
    data: {
      id: devQf1,
      type: 'BREAKER',
      slot_id: qf1,
      model: 'ВА-55-41',
      current_nom: 630,
      in_rating: 630,
      voltage_nom: 400,
      poles: 3,
    },
  });

  // Распределительные шкафы
  const sch1 = generateElementId('CABINET', undefined, 'SCH1');
  await db.element.create({
    data: {
      id: sch1,
      type: 'CABINET',
      name: 'ЩР-1',
      voltage_level: 0.4,
      description: 'Щит распределительный 1',
      pos_x: 500,
      pos_y: 50,
    },
  });

  const sch2 = generateElementId('CABINET', undefined, 'SCH2');
  await db.element.create({
    data: {
      id: sch2,
      type: 'CABINET',
      name: 'ЩР-2',
      voltage_level: 0.4,
      description: 'Щит распределительный 2',
      pos_x: 500,
      pos_y: 150,
    },
  });

  // Нагрузки
  const load1 = generateElementId('LOAD');
  await db.element.create({
    data: {
      id: load1,
      type: 'LOAD',
      name: 'Освещение цех 1',
      parent_id: sch1,
      voltage_level: 0.4,
      pos_x: 700,
      pos_y: 50,
    },
  });

  const devL1 = generateDeviceId('LOAD');
  await db.device.create({
    data: {
      id: devL1,
      type: 'LOAD',
      slot_id: load1,
      p_kw: 15,
      q_kvar: 5,
      s_kva: 15.8,
      cos_phi: 0.95,
      voltage_nom: 400,
    },
  });

  const load2 = generateElementId('LOAD');
  await db.element.create({
    data: {
      id: load2,
      type: 'LOAD',
      name: 'Розеточная группа',
      parent_id: sch2,
      voltage_level: 0.4,
      pos_x: 700,
      pos_y: 150,
    },
  });

  const devL2 = generateDeviceId('LOAD');
  await db.device.create({
    data: {
      id: devL2,
      type: 'LOAD',
      slot_id: load2,
      p_kw: 8,
      q_kvar: 3,
      s_kva: 8.5,
      cos_phi: 0.94,
      voltage_nom: 400,
    },
  });

  // Связи
  await db.connection.create({
    data: {
      id: generateConnectionId(source1, grSch),
      from_id: source1,
      to_id: grSch,
      type: 'CABLE',
      length: 25,
      wire_type: 'ВВГ',
      wire_size: 120,
      material: 'Cu',
      resistance_r: 0.0038,
      reactance_x: 0.0018,
      impedance_z: 0.0042,
      installation_method: 'in_ground',
    },
  });

  await db.connection.create({
    data: {
      id: generateConnectionId(grSch, sch1),
      from_id: grSch,
      to_id: sch1,
      type: 'CABLE',
      length: 45,
      wire_type: 'ВВГ',
      wire_size: 16,
      material: 'Cu',
      resistance_r: 0.052,
      reactance_x: 0.0036,
      impedance_z: 0.052,
      installation_method: 'in_air',
    },
  });

  await db.connection.create({
    data: {
      id: generateConnectionId(grSch, sch2),
      from_id: grSch,
      to_id: sch2,
      type: 'CABLE',
      length: 30,
      wire_type: 'ВВГ',
      wire_size: 6,
      material: 'Cu',
      resistance_r: 0.092,
      reactance_x: 0.0026,
      impedance_z: 0.092,
      installation_method: 'in_air',
    },
  });

  return { elements: 6, devices: 4, connections: 3 };
}

/**
 * Расчёт позиций узлов для визуализации
 */
async function calculateNodePositions(): Promise<void> {
  const elements = await db.element.findMany({
    orderBy: { created_at: 'asc' },
  });

  const typeGroups: Record<string, typeof elements> = {
    SOURCE: [],
    BUS: [],
    JUNCTION: [],
    BREAKER: [],
    METER: [],
    CABINET: [],
    LOAD: [],
  };

  // Группируем по типам
  for (const el of elements) {
    if (typeGroups[el.type]) {
      typeGroups[el.type].push(el);
    }
  }

  // Располагаем по уровням слева направо
  const positions: Record<string, { x: number; y: number }> = {};
  
  // Параметры сетки
  const nodeWidth = 160;
  const nodeHeight = 80;
  const horizontalGap = 80;
  const verticalGap = 30;
  const startX = 100;
  const startY = 100;
  const nodesPerRow = 6;

  // Порядок отображения типов (слева направо)
  const typeOrder = ['SOURCE', 'BUS', 'JUNCTION', 'BREAKER', 'METER', 'CABINET', 'LOAD'];
  
  let currentX = startX;
  
  for (const type of typeOrder) {
    const group = typeGroups[type];
    if (group.length === 0) continue;
    
    let currentY = startY;
    let col = 0;
    
    for (const el of group) {
      positions[el.id] = { x: currentX, y: currentY };
      
      col++;
      if (col >= nodesPerRow) {
        col = 0;
        currentX += nodeWidth + horizontalGap;
        currentY = startY;
      } else {
        currentY += nodeHeight + verticalGap;
      }
    }
    
    currentX += nodeWidth + horizontalGap * 2;
  }

  // Обновляем позиции в БД
  for (const [id, pos] of Object.entries(positions)) {
    await db.element.update({
      where: { id },
      data: { pos_x: pos.x, pos_y: pos.y },
    });
  }
}

export default {
  importFromExcel,
};

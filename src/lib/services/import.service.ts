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

// Путь к файлу импорта (по умолчанию input.xlsx, можно переопределить через параметр)
const DEFAULT_INPUT_FILE_PATH = '/home/z/my-project/upload/input.xlsx';

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
 * @param filePath - опциональный путь к файлу (по умолчанию input.xlsx)
 */
export async function importFromExcel(filePath?: string): Promise<ImportResponse> {
  const INPUT_FILE_PATH = filePath || DEFAULT_INPUT_FILE_PATH;
  
  try {
    // Сбрасываем счётчики ID
    resetCounters();

    // Проверяем существование файла
    if (!fs.existsSync(INPUT_FILE_PATH)) {
      return {
        success: false,
        message: 'Файл импорта не найден',
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
  // Трансформаторы: "Т1 ТП21", "Т2 ТП" — начинается с "Т" + цифра + пробел
  if (/^т\d\s/.test(nameLower)) return 'SOURCE';
  // Содержит "трансформатор" (без учёта регистра)
  if (nameLower.includes('трансформатор')) return 'SOURCE';
  // "Т1 ТП21", "Т2 ТП21" — Т + цифра + пробел(ы) + ТП
  if (/^т\d\s+тп/i.test(nameLower)) return 'SOURCE';
  // "ПЦ" - вводный выключатель (источник)
  if (nameLower.startsWith('пц')) return 'SOURCE';
  // "ЦП" - центр питания
  if (nameLower.startsWith('цп')) return 'SOURCE';
  // "ДГУ" - дизель-генератор (начинается с ДГУ)
  if (nameLower.startsWith('дгу')) return 'SOURCE';
  // ИБП - источник бесперебойного питания
  if (nameLower.includes('ибп') && !nameLower.includes('точрасп')) return 'SOURCE';
  
  // === ВЫКЛЮЧАТЕЛИ ===
  // QF + номер: QF1, QF2.10, QF1.1
  if (/^qf\d*[\.\d]*(\s|$)/i.test(nameLower)) return 'BREAKER';
  // QF + пробел (без номера): "QF Выключатель"
  if (/^qf\s/i.test(nameLower)) return 'BREAKER';
  // N QF (1-9): 1QF, 2QF, 4QF1 с.ш. ГРЩ1
  if (/^[1-9]qf\d*(\s|$)/i.test(nameLower)) return 'BREAKER';
  // QS + номер: QS1, QS2
  if (/^qs\d*(\s|$)/i.test(nameLower)) return 'BREAKER';
  // N QS: 4QS, 4QS1 с.ш. ГРЩ1
  if (/\dqs\d*(\s|$)/i.test(nameLower)) return 'BREAKER';
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
  // ШР - шкаф распределительный (ШР-Будка охраны, ШР1 и т.д.)
  if (/^шр[\s\-—\d]/i.test(nameLower) || /^шр$/i.test(nameLower)) return 'CABINET';
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
  // ППУ - приёмно-переходное устройство (шкаф)
  if (/^ппу[\s\-—]*\d*/i.test(nameLower) || /^ппу$/i.test(nameLower)) return 'CABINET';
  // ТП - трансформаторная подстанция (как контейнер/помещение)
  if (/^тп\d*/i.test(nameLower) && !/^т\d\s/.test(nameLower)) return 'CABINET';
  // "Шкаф" в начале имени
  if (nameLower.startsWith('шкаф')) return 'CABINET';
  
  // === УЗЛЫ/ТОЧКИ РАСПРЕДЕЛЕНИЯ ===
  // "Точрасп" или "Точ расп" - точка распределения (с пробелом или без)
  if (nameLower.includes('точрасп') || nameLower.includes('точ расп')) return 'JUNCTION';
  // "Точка распределения"
  if (nameLower.includes('точка распределения')) return 'JUNCTION';
  // "точка" - общее слово (после более специфичных "точрасп")
  if (nameLower.includes('точка')) return 'JUNCTION';
  
  // === УЧЁТ ===
  // "Узел учета" (полная форма)
  if (nameLower.startsWith('узел учета')) return 'METER';
  // "Узуч" - сокращённое обозначение узла учёта
  if (/^узуч/i.test(nameLower)) return 'METER';
  
  // === ШИНЫ ===
  // Все правила BUS исключают "точрасп" (это JUNCTION)
  if (!nameLower.includes('точрасп')) {
    // "с.ш." - сборные шины (включая форматы типа "1 с.ш. ППУ-п")
    if (/\d*с\.ш\./.test(nameLower)) return 'BUS';
    // "магистраль" или "шина"
    if (nameLower.includes('магистраль') || nameLower === 'шина') return 'BUS';
    // "сборка"
    if (nameLower.includes('сборка')) return 'BUS';
  }
  
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

  // 1. CABINET из столбца "Шкаф/сборка" (ищем по имени, а не по индексу)
  for (const row of rows) {
    const keys = Object.keys(row);

    // Ищем столбец "Шкаф/сборка" по имени (поддерживаем разные варианты написания)
    let assemblyColKey: string | null = null;
    for (const key of keys) {
      const keyLower = key.toLowerCase();
      if (keyLower === 'шкаф/сборка' || keyLower.includes('шкаф') || keyLower === 'сборка') {
        assemblyColKey = key;
        break;
      }
    }

    if (!assemblyColKey) continue;
    const assemblyName = String(row[assemblyColKey] || '').trim();
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
  const elementLocationMap = new Map<string, string>(); // имя -> расположение
  const pendingConnections: Array<{
    fromName: string;
    toName: string;
    connType: string;
  }> = [];

  // ============================================================================
  // ПРОХОД 1: Собираем все уникальные элементы и их типы
  // ============================================================================

  // Определяем ключи колонок по именам (а не по индексам)
  const sampleRow = rows[0] || {};
  const allKeys = Object.keys(sampleRow);

  let fromKey = allKeys.find(k => k.toLowerCase().includes('от') || k.toLowerCase() === 'from');
  let cableKey = allKeys.find(k => k.toLowerCase().includes('кабель') || k.toLowerCase() === 'cable');
  let toKey = allKeys.find(k => k.toLowerCase().includes('до') || k.toLowerCase() === 'to');
  let avrKey = allKeys.find(k => k.toLowerCase().includes('авр') || k.toLowerCase() === 'avr');
  let locationKey = allKeys.find(k => k.toLowerCase().includes('расположение') || k.toLowerCase().includes('помещение') || k.toLowerCase() === 'location');
  
  // Additional keys for validation data
  let currentNomKey = allKeys.find(k => k.toLowerCase().includes('номинальный ток') || k.toLowerCase().includes('iном') || k.toLowerCase() === 'in');
  let sectionKey = allKeys.find(k => k.toLowerCase().includes('сечение') || k.toLowerCase().includes('section'));
  let materialKey = allKeys.find(k => k.toLowerCase().includes('материал') || k.toLowerCase().includes('material'));
  let iDopKey = allKeys.find(k => k.toLowerCase().includes('допустимый ток') || k.toLowerCase().includes('iдоп'));
  let coresKey = allKeys.find(k => k.toLowerCase().includes('жил') || k.toLowerCase().includes('cores'));
  let lengthKey = allKeys.find(k => k.toLowerCase().includes('длина') || k.toLowerCase().includes('length'));

  // Fallback на индексы если не нашли по имени
  if (!fromKey && allKeys.length > 2) fromKey = allKeys[2];
  if (!cableKey && allKeys.length > 3) cableKey = allKeys[3];
  if (!toKey && allKeys.length > 4) toKey = allKeys[4];
  if (!avrKey && allKeys.length > 5) avrKey = allKeys[5];
  if (!locationKey && allKeys.length > 7) locationKey = allKeys[7];

  console.log(`Column mapping: from="${fromKey}", cable="${cableKey}", to="${toKey}", avr="${avrKey}", location="${locationKey}"`);
  console.log(`Validation columns: currentNom="${currentNomKey}", section="${sectionKey}", material="${materialKey}", iDop="${iDopKey}"`);

  // Store row data for each connection
  const connectionDataMap = new Map<string, {
    ratedCurrent?: number;
    section?: number;
    material?: string;
    iDop?: number;
    cores?: number;
    length?: number;
  }>();

  for (const row of rows) {
    const fromName = fromKey ? String(row[fromKey] || '') : '';
    const connectionType = cableKey ? String(row[cableKey] || '') : '';
    const toName = toKey ? String(row[toKey] || '') : '';
    const avrName = avrKey ? String(row[avrKey] || '') : '';
    const locationValue = locationKey ? String(row[locationKey] || '') : '';
    
    // Read validation data
    const ratedCurrentValue = currentNomKey ? Number(row[currentNomKey]) || undefined : undefined;
    const sectionValue = sectionKey ? Number(row[sectionKey]) || undefined : undefined;
    const materialValue = materialKey ? String(row[materialKey] || '') : '';
    const iDopValue = iDopKey ? Number(row[iDopKey]) || undefined : undefined;
    const coresValue = coresKey ? Number(row[coresKey]) || undefined : undefined;
    const lengthValue = lengthKey ? Number(row[lengthKey]) || undefined : undefined;

    if (!fromName && !toName) continue;

    // Собираем элементы и определяем типы
    const names = [fromName, toName, avrName].filter(Boolean);
    for (const name of names) {
      if (!processedElements.has(name)) {
        const type = detectElementType(name);
        elementTypeMap.set(name, type);
        processedElements.add(name);
      }
      // Сохраняем расположение (последнее непустое значение)
      if (locationValue && locationValue !== 'NaN') {
        elementLocationMap.set(name, locationValue);
      }
    }

    // Собираем связи с данными кабеля
    if (fromName && toName) {
      const connType = connectionType.toLowerCase().includes('шина') ? 'BUSBAR' : 'CABLE';
      const connKey = `${fromName}->${toName}`;
      pendingConnections.push({ fromName, toName, connType });
      
      // Store validation data for this connection
      connectionDataMap.set(connKey, {
        ratedCurrent: ratedCurrentValue,
        section: sectionValue,
        material: materialValue,
        iDop: iDopValue,
        cores: coresValue,
        length: lengthValue,
      });
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
    const location = elementLocationMap.get(cabName) || null;
    elementIdMap.set(cabName, id);

    await db.element.create({
      data: {
        id,
        elementId: id,
        type: 'CABINET',
        name: cabName.slice(0, 100),
        location,
        voltageLevel: 0.4,
        posX: 0,
        posY: 0,
        updatedAt: new Date(),
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
    const location = elementLocationMap.get(name) || null;

    elementIdMap.set(name, id);

    // Use upsert to handle duplicates
    await db.element.upsert({
      where: { elementId: id },
      update: {
        name: name.slice(0, 100),
        location,
        voltageLevel: 0.4,
        parentId: parentId || null,
        updatedAt: new Date(),
      },
      create: {
        id,
        elementId: id,
        type,
        name: name.slice(0, 100),
        location,
        voltageLevel: 0.4,
        parentId: parentId || null,
        posX: 0,
        posY: 0,
        updatedAt: new Date(),
      },
    });

    // Создаём устройство (только для типов, имеющих Device)
    const deviceType = mapElementTypeToDeviceType(type);
    if (deviceType) {
      const slotId = `slot_${id}`;
      const deviceId = generateDeviceId(deviceType);
      
      // Use upsert for DeviceSlot
      await db.deviceSlot.upsert({
        where: { slotId: slotId },
        update: { slotType: deviceType },
        create: {
          id: slotId,
          slotId: slotId,
          elementId: id,
          slotType: deviceType,
        },
      });
      
      // Use upsert for Device
      await db.device.upsert({
        where: { deviceId: deviceId },
        update: { deviceType: deviceType, updatedAt: new Date() },
        create: {
          id: deviceId,
          deviceId: deviceId,
          deviceType: deviceType,
          slotId: slotId,
          updatedAt: new Date(),
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
    const connKey = `${conn.fromName}->${conn.toName}`;
    const connData = connectionDataMap.get(connKey);

    if (fromId && toId) {
      const connectionId = generateConnectionId(fromId, toId);
      
      // Create Cable record if this is a cable connection with data
      let cableId: string | null = null;
      if (conn.connType === 'CABLE' && connData && (connData.section || connData.length)) {
        cableId = `cable_${connectionId}`;
        try {
          await db.cable.create({
            data: {
              id: cableId,
              cableId: cableId,
              section: connData.section || 2.5,
              material: connData.material?.toLowerCase().includes('алюмин') ? 'aluminum' : 'copper',
              cores: connData.cores || 5,
              length: connData.length || 10,
              iDop: connData.iDop || null,
              updatedAt: new Date(),
            },
          });
        } catch (e) {
          // Cable already exists
          cableId = null;
        }
      }
      
      try {
        await db.connection.create({
          data: {
            id: connectionId,
            sourceId: fromId,
            targetId: toId,
            cableId: cableId,
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
  await db.meterReading.deleteMany();
  await db.aVRSwitchover.deleteMany();
  await db.aVRInput.deleteMany();
  await db.aVROutput.deleteMany();
  await db.aVR.deleteMany();
  await db.connection.deleteMany();
  await db.cable.deleteMany();
  // Delete dependent records first
  await db.breaker.deleteMany();
  await db.load.deleteMany();
  await db.meter.deleteMany();
  await db.transformer.deleteMany();
  await db.device.deleteMany();
  await db.deviceSlot.deleteMany();
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
        elementId: elementId,
        type: 'SOURCE',
        name: name,
        voltageLevel: voltage,
        posX: 0,
        posY: 0,
        updatedAt: new Date(),
      },
    });
    elements++;

    // Создаём устройство
    const deviceId = generateDeviceId('SOURCE');
    await db.device.create({
      data: {
        id: deviceId,
        deviceId: deviceId,
        deviceType: 'SOURCE',
        slotId: elementId,
        updatedAt: new Date(),
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
    const location = String(row['Расположение'] || row['Помещение'] || row['Location'] || '');
    const parentIdValue = String(row['Родитель'] || row['Parent'] || '');

    const elementId = generateElementId('CABINET', undefined, name.replace(/\s+/g, '_').toUpperCase());

    await db.element.create({
      data: {
        id: elementId,
        elementId: elementId,
        type: 'CABINET',
        name: name,
        location: location || null,
        parentId: parentIdValue || null,
        voltageLevel: 0.4,
        posX: 0,
        posY: 0,
        updatedAt: new Date(),
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
        elementId: elementId,
        type: 'LOAD',
        name: name,
        parentId: parentId || null,
        voltageLevel: 0.4,
        posX: 0,
        posY: 0,
        updatedAt: new Date(),
      },
    });
    elements++;

    // Создаём устройство нагрузки
    const deviceId = generateDeviceId('LOAD');
    const sKva = pKw / cosPhi;
    await db.device.create({
      data: {
        id: deviceId,
        deviceId: deviceId,
        deviceType: 'LOAD',
        slotId: elementId,
        updatedAt: new Date(),
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
        elementId: elementId,
        type: 'BREAKER',
        name: name,
        parentId: parentId || null,
        voltageLevel: 0.4,
        posX: 0,
        posY: 0,
        updatedAt: new Date(),
      },
    });
    elements++;

    // Создаём устройство
    const deviceId = generateDeviceId('BREAKER');
    await db.device.create({
      data: {
        id: deviceId,
        deviceId: deviceId,
        deviceType: 'BREAKER',
        slotId: elementId,
        updatedAt: new Date(),
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

    // Создаём кабель
    const cableId = `cable_${connectionId}`;
    await db.cable.create({
      data: {
        id: cableId,
        cableId: cableId,
        name: `${wireType} ${wireSize}мм²`,
        length: length,
        section: wireSize,
        material: wireType.startsWith('А') ? 'aluminum' : 'copper',
        r0: impedance?.r,
        x0: impedance?.x,
        updatedAt: new Date(),
      },
    });

    // Создаём связь
    await db.connection.create({
      data: {
        id: connectionId,
        sourceId: fromId,
        targetId: toId,
        cableId: cableId,
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
      elementId: source1,
      type: 'SOURCE',
      name: 'ТП-21 Трансформатор 1',
      voltageLevel: 0.4,
      posX: 100,
      posY: 100,
      updatedAt: new Date(),
    },
  });

  const deviceId1 = generateDeviceId('SOURCE');
  await db.device.create({
    data: {
      id: deviceId1,
      deviceId: deviceId1,
      deviceType: 'SOURCE',
      slotId: source1,
      updatedAt: new Date(),
    },
  });

  // Создаём главный шкаф
  const grSch = generateElementId('CABINET', undefined, 'GRSCH1');
  await db.element.create({
    data: {
      id: grSch,
      elementId: grSch,
      type: 'CABINET',
      name: 'ГРЩ-1',
      voltageLevel: 0.4,
      posX: 300,
      posY: 100,
      updatedAt: new Date(),
    },
  });

  // Выключатель ввода
  const qf1 = generateElementId('BREAKER', undefined, 'GRSCH1_IN');
  await db.element.create({
    data: {
      id: qf1,
      elementId: qf1,
      type: 'BREAKER',
      name: 'QF1 Вводной',
      parentId: grSch,
      voltageLevel: 0.4,
      posX: 350,
      posY: 100,
      updatedAt: new Date(),
    },
  });

  const devQf1 = generateDeviceId('BREAKER');
  await db.device.create({
    data: {
      id: devQf1,
      deviceId: devQf1,
      deviceType: 'BREAKER',
      slotId: qf1,
      updatedAt: new Date(),
    },
  });

  // Распределительные шкафы
  const sch1 = generateElementId('CABINET', undefined, 'SCH1');
  await db.element.create({
    data: {
      id: sch1,
      elementId: sch1,
      type: 'CABINET',
      name: 'ЩР-1',
      voltageLevel: 0.4,
      posX: 500,
      posY: 50,
      updatedAt: new Date(),
    },
  });

  const sch2 = generateElementId('CABINET', undefined, 'SCH2');
  await db.element.create({
    data: {
      id: sch2,
      elementId: sch2,
      type: 'CABINET',
      name: 'ЩР-2',
      voltageLevel: 0.4,
      posX: 500,
      posY: 150,
      updatedAt: new Date(),
    },
  });

  // Нагрузки
  const load1 = generateElementId('LOAD');
  await db.element.create({
    data: {
      id: load1,
      elementId: load1,
      type: 'LOAD',
      name: 'Освещение цех 1',
      parentId: sch1,
      voltageLevel: 0.4,
      posX: 700,
      posY: 50,
      updatedAt: new Date(),
    },
  });

  const devL1 = generateDeviceId('LOAD');
  await db.device.create({
    data: {
      id: devL1,
      deviceId: devL1,
      deviceType: 'LOAD',
      slotId: load1,
      updatedAt: new Date(),
    },
  });

  const load2 = generateElementId('LOAD');
  await db.element.create({
    data: {
      id: load2,
      elementId: load2,
      type: 'LOAD',
      name: 'Розеточная группа',
      parentId: sch2,
      voltageLevel: 0.4,
      posX: 700,
      posY: 150,
      updatedAt: new Date(),
    },
  });

  const devL2 = generateDeviceId('LOAD');
  await db.device.create({
    data: {
      id: devL2,
      deviceId: devL2,
      deviceType: 'LOAD',
      slotId: load2,
      updatedAt: new Date(),
    },
  });

  // Связи
  // Связь 1: источник -> главный шкаф
  const conn1Id = generateConnectionId(source1, grSch);
  const cable1Id = `cable_${conn1Id}`;
  await db.cable.create({
    data: {
      id: cable1Id,
      cableId: cable1Id,
      name: 'ВВГ 120мм²',
      length: 25,
      section: 120,
      material: 'copper',
      r0: 0.0038,
      x0: 0.0018,
      updatedAt: new Date(),
    },
  });
  await db.connection.create({
    data: {
      id: conn1Id,
      sourceId: source1,
      targetId: grSch,
      cableId: cable1Id,
    },
  });

  // Связь 2: главный шкаф -> ЩР-1
  const conn2Id = generateConnectionId(grSch, sch1);
  const cable2Id = `cable_${conn2Id}`;
  await db.cable.create({
    data: {
      id: cable2Id,
      cableId: cable2Id,
      name: 'ВВГ 16мм²',
      length: 45,
      section: 16,
      material: 'copper',
      r0: 0.052,
      x0: 0.0036,
      updatedAt: new Date(),
    },
  });
  await db.connection.create({
    data: {
      id: conn2Id,
      sourceId: grSch,
      targetId: sch1,
      cableId: cable2Id,
    },
  });

  // Связь 3: главный шкаф -> ЩР-2
  const conn3Id = generateConnectionId(grSch, sch2);
  const cable3Id = `cable_${conn3Id}`;
  await db.cable.create({
    data: {
      id: cable3Id,
      cableId: cable3Id,
      name: 'ВВГ 6мм²',
      length: 30,
      section: 6,
      material: 'copper',
      r0: 0.092,
      x0: 0.0026,
      updatedAt: new Date(),
    },
  });
  await db.connection.create({
    data: {
      id: conn3Id,
      sourceId: grSch,
      targetId: sch2,
      cableId: cable3Id,
    },
  });

  return { elements: 6, devices: 4, connections: 3 };
}

/**
 * Расчёт позиций узлов для визуализации
 */
async function calculateNodePositions(): Promise<void> {
  const elements = await db.element.findMany({
    orderBy: { createdAt: 'asc' },
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
      data: { posX: pos.x, posY: pos.y },
    });
  }
}

export default {
  importFromExcel,
};

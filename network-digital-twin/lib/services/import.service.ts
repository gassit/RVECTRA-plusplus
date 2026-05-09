// ============================================================================
// СЕРВИС ИМПОРТА ДАННЫХ ИЗ EXCEL
// Адаптировано под Prisma 7 + LibSQL (схема network-digital-twin)
// ============================================================================

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { prisma } from '@/lib/prisma';

// Prisma 7 generated types don't match runtime — using any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = prisma;
import {
  resetCounters,
  generateElementId,
  generateDeviceId,
  generateConnectionId,
} from '@/lib/utils/id-generator';
import { calculateCableImpedanceFromReference } from '@/lib/calculations/impedance';
import { propagateStates } from '@/lib/services/state-propagation.service';
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
let elementTypeMapGlobal: Map<string, string> = new Map();

/**
 * Парсинг Excel файла и импорт данных в БД
 */
export async function importFromExcel(): Promise<ImportResponse> {
  try {
    resetCounters();

    if (!fs.existsSync(INPUT_FILE_PATH)) {
      return {
        success: false,
        message: 'Файл input.xlsx не найден',
        imported: { elements: 0, devices: 0, connections: 0 },
        errors: ['Файл не найден: ' + INPUT_FILE_PATH],
      };
    }

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

    // Обрабатываем остальные листы
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

    // Распространяем электрические состояния
    await propagateStates();

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
// ОПРЕДЕЛЕНИЕ ТИПА ЭЛЕМЕНТА (оригинальная логика)
// ============================================================================

/**
 * Чтение типов элементов из листа Elements
 */
function readElementTypes(workbook: XLSX.WorkBook): void {
  elementTypeMapGlobal.clear();

  const sheetName = 'Elements';
  if (!workbook.SheetNames.includes(sheetName)) return;

  const sheet = workbook.Sheets[sheetName];
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const keys = Object.keys(row);
    if (keys.length < 3) continue;

    const id = String(row[keys[0]] || '');
    const type = String(row[keys[2]] || '').toLowerCase().trim();

    if (!id || id === 'NaN' || id === 'id') continue;

    let normalizedType: ElementType = 'LOAD';
    if (type === 'source') normalizedType = 'SOURCE';
    else if (type === 'breaker') normalizedType = 'BREAKER';
    else if (type === 'bus') normalizedType = 'BUS';
    else if (type === 'junction') normalizedType = 'JUNCTION';
    else if (type === 'meter') normalizedType = 'METER';
    else if (type === 'load') normalizedType = 'LOAD';
    else if (type === 'cabinet') normalizedType = 'CABINET';

    elementTypeMapGlobal.set(id.toLowerCase(), normalizedType);
    elementTypeMapGlobal.set(id, normalizedType);
  }

  console.log(`Loaded ${elementTypeMapGlobal.size} element types from Elements sheet`);
}

/**
 * Определение типа элемента по имени
 */
function detectElementType(name: string, id?: string): ElementType {
  const nameLower = name.toLowerCase();
  const idLower = id?.toLowerCase() || '';

  if (id && elementTypeMapGlobal.has(idLower)) {
    return elementTypeMapGlobal.get(idLower) as ElementType;
  }

  if (!nameLower || nameLower === 'null' || nameLower === 'nan') return 'LOAD';

  // === ИСТОЧНИКИ ===
  if (/^т\d+\s/.test(nameLower)) return 'SOURCE';
  if (nameLower.startsWith('пц')) return 'SOURCE';
  if (nameLower.includes('дгу') && !nameLower.includes('точрасп')) return 'SOURCE';
  if (nameLower.includes('ибп') && !nameLower.includes('точрасп')) return 'SOURCE';

  // === ВЫКЛЮЧАТЕЛИ ===
  if (/^(\d*)qf[\d.]*/i.test(nameLower)) return 'BREAKER';
  if (/^(\d*)qs\d*/i.test(nameLower)) return 'BREAKER';
  if (/^км\d*/i.test(nameLower)) return 'BREAKER';
  if (nameLower.startsWith('автоматика')) return 'BREAKER';
  if (/^(\d*)fu\d*/i.test(nameLower)) return 'BREAKER';

  // === ШКАФЫ / ЩИТЫ ===
  if (/^щр\d*/i.test(nameLower)) return 'CABINET';
  if (/^шу\s/i.test(nameLower) || /^шу\d/i.test(nameLower)) return 'CABINET';
  if (/^вру/i.test(nameLower)) return 'CABINET';
  if (/^грщ/i.test(nameLower)) return 'CABINET';
  if (nameLower === 'авр' || /^авр\s/i.test(nameLower)) return 'CABINET';
  if (/^щао/i.test(nameLower)) return 'CABINET';
  if (/^\d*ш[удвз]/i.test(nameLower)) return 'CABINET';
  if (nameLower.startsWith('шкаф')) return 'CABINET';

  // === УЗЛЫ/ТОЧКИ РАСПРЕДЕЛЕНИЯ ===
  if (nameLower.includes('точрасп') || nameLower.includes('точ расп')) return 'JUNCTION';
  if (nameLower.includes('точка распределения')) return 'JUNCTION';

  // === УЧЁТ ===
  if (nameLower.startsWith('узел учета')) return 'METER';
  if (/^узуч/i.test(nameLower)) return 'METER';

  // === ШИНЫ ===
  if (/\d*с\.ш\./.test(nameLower)) return 'BUS';
  if ((nameLower.includes('магистраль') || nameLower === 'шина') && !nameLower.includes('точрасп')) return 'BUS';
  if (/^\d+\s+с\.ш\./.test(nameLower)) return 'BUS';

  return 'LOAD';
}

// ============================================================================
// ИЕРАРХИЯ ШКАФОВ (оригинальная логика)
// ============================================================================

/**
 * Поиск родительского CABINET по имени элемента (самое длинное совпадение)
 */
function findParentCabinet(
  elementName: string,
  elementType: ElementType,
  cabinetAliases: Array<{ alias: string; cabinetId: string }>
): string | undefined {
  if (elementType === 'CABINET') return undefined;

  const nameLower = elementName.toLowerCase();
  let bestMatch = '';
  let bestMatchId: string | undefined;

  for (const { alias, cabinetId } of cabinetAliases) {
    const aliasLower = alias.toLowerCase();
    if (nameLower.includes(aliasLower)) {
      if (aliasLower.length > bestMatch.length) {
        bestMatch = aliasLower;
        bestMatchId = cabinetId;
      }
    }
  }

  return bestMatchId;
}

/**
 * Извлекает имена CABINET из столбца K (Сборка) и из имён элементов
 */
function buildCabinetAliasMap(
  rows: ExcelRow[],
  elementTypeMap: Map<string, ElementType>
): Array<{ alias: string; cabinetName: string; cabinetId: string }> {
  const cabinetSet = new Set<string>();

  // 1. CABINET из столбца K (Сборка)
  for (const row of rows) {
    const keys = Object.keys(row);
    if (keys.length < 11) continue;
    const assemblyName = String(row[keys[10]] || '').trim();
    if (!assemblyName) continue;

    if (assemblyName.toLowerCase().includes('с.ш.')) continue;
    if (assemblyName.toLowerCase().includes('секционнир')) continue;
    if (assemblyName.toLowerCase() === 'null') continue;

    const detectedType = detectElementType(assemblyName);
    if (detectedType === 'SOURCE' || detectedType === 'BUS') continue;

    cabinetSet.add(assemblyName);
  }

  // 2. CABINET из elementTypeMap
  for (const [name, type] of elementTypeMap) {
    if (type === 'CABINET') {
      cabinetSet.add(name);
    }
  }

  // 3. CABINET из составных имён элементов (ГРЩ1, ЩР3-ПУВ и т.д.)
  const cabinetPrefixPatterns = [
    /грщ\d*[^\s/]*/gi,
    /щр\d*[^\s/]*/gi,
    /шу\d*[^\s/]*/gi,
    /вру\d*[^\s/]*/gi,
    /авр\d*/gi,
    /щао\w*/gi,
    /шкаф\s+[^\s/]+/gi,
  ];

  for (const name of elementTypeMap.keys()) {
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
  for (const [name, type] of elementTypeMap) {
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
// ГЛАВНЫЙ ИМПОРТ NETWORKALL (адаптирован под новую схему)
// ============================================================================

let slotCounter = 0;
let cableCounter = 0;

function generateSlotId(): string {
  slotCounter++;
  return `SLOT_${slotCounter.toString().padStart(4, '0')}`;
}

function generateCableId(): string {
  cableCounter++;
  return `CBL_${cableCounter.toString().padStart(4, '0')}`;
}

async function importNetworkAll(rows: ExcelRow[]): Promise<{ elements: number; devices: number; connections: number }> {
  let elements = 0;
  let devices = 0;
  let connections = 0;

  const processedElements = new Set<string>();
  const elementCuidMap = new Map<string, string>(); // оригинальное имя -> cuid (auto id)
  const elementTypeMapLocal = new Map<string, ElementType>();
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

    const names = [fromName, toName, protectionName].filter(Boolean);
    for (const name of names) {
      if (!processedElements.has(name)) {
        const type = detectElementType(name);
        elementTypeMapLocal.set(name, type);
        processedElements.add(name);
      }
    }

    if (fromName && toName) {
      const connType = connectionType.toLowerCase().includes('шина') ? 'BUSBAR' : 'CABLE';
      pendingConnections.push({ fromName, toName, connType });
    }
  }

  // ============================================================================
  // СТРОИМ ИЕРАРХИЮ
  // ============================================================================
  const cabinetAliases = buildCabinetAliasMap(rows, elementTypeMapLocal);

  const cabinetNames = [...new Set(cabinetAliases.map(a => a.cabinetName))];
  const cabinetNameToId = new Map<string, string>();
  for (const alias of cabinetAliases) {
    if (!cabinetNameToId.has(alias.cabinetName)) {
      cabinetNameToId.set(alias.cabinetName, alias.cabinetId);
    }
  }

  const parentMap = new Map<string, string>();
  for (const [name, type] of elementTypeMapLocal) {
    if (type === 'CABINET') continue;
    const parentId = findParentCabinet(name, type, cabinetAliases);
    if (parentId) {
      parentMap.set(name, parentId);
    }
  }

  // ============================================================================
  // ПРОХОД 2: Создаём элементы в БД (новая схема: elementId + id)
  // ============================================================================

  // Сначала создаём CABINET
  for (const cabName of cabinetNames) {
    const elementId = cabinetNameToId.get(cabName)!;

    const element = await db.element.create({
      data: {
        elementId,
        name: cabName.slice(0, 100),
        type: 'CABINET',
        voltageLevel: 0.4,
        posX: 0,
        posY: 0,
      },
    });

    elementCuidMap.set(cabName, element.id); // cuid → для связей как parentId
    elements++;
  }

  // Затем все остальные элементы
  for (const [name, type] of elementTypeMapLocal) {
    if (type === 'CABINET') continue;

    const elementId = generateElementId(type, undefined, name.replace(/\s+/g, '_').toUpperCase().slice(0, 30));

    // parentId — это cuid родительского CABINET
    const parentElementId = parentMap.get(name);
    const parentCuid = parentElementId ? elementCuidMap.get(parentElementId) : undefined;

    const element = await db.element.create({
      data: {
        elementId,
        name: name.slice(0, 100),
        type,
        voltageLevel: 0.4,
        parentId: parentCuid,
        posX: 0,
        posY: 0,
      },
    });

    elementCuidMap.set(name, element.id);

    // Создаём устройство (DeviceSlot → Device → subtype)
    const deviceType = mapElementTypeToDeviceType(type);
    if (deviceType) {
      const slot = await db.deviceSlot.create({
        data: {
          slotId: generateSlotId(),
          elementId: element.id,
          slotType: deviceType,
        },
      });

      const device = await db.device.create({
        data: {
          deviceId: generateDeviceId(deviceType),
          slotId: slot.id,
          deviceType: deviceType,
        },
      });

      // Подтип устройства
      if (deviceType === 'BREAKER') {
        await db.breaker.create({
          data: {
            deviceId: device.id,
            ratedCurrent: getDefaultCurrent(type),
            tripCount: 0,
          },
        });
      } else if (deviceType === 'LOAD') {
        await db.load.create({
          data: {
            deviceId: device.id,
            name: name.slice(0, 100),
            powerP: type === 'SOURCE' ? 0 : getDefaultPower(type),
            cosPhi: 0.9,
          },
        });
      } else if (deviceType === 'METER') {
        await db.meter.create({
          data: {
            deviceId: device.id,
            meterType: 'electrical',
            tariff: 1,
          },
        });
      } else if (deviceType === 'SOURCE') {
        await db.transformer.create({
          data: {
            deviceId: device.id,
            power: getDefaultPower(type),
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
  // СОЗДАЁМ СВЯЗИ (sourceId/targetId → cuid, Cable — отдельная сущность)
  // ============================================================================
  for (const conn of pendingConnections) {
    const fromCuid = elementCuidMap.get(conn.fromName);
    const toCuid = elementCuidMap.get(conn.toName);

    if (fromCuid && toCuid) {
      try {
        let cableId: string | undefined;

        // Создаём Cable для CABBAR-связей тоже
        if (conn.connType === 'BUSBAR') {
          const cable = await db.cable.create({
            data: {
              cableId: generateCableId(),
              name: 'Шина',
              length: 0,
              section: 0,
              material: 'copper',
            },
          });
          cableId = cable.id;
        } else {
          const cable = await db.cable.create({
            data: {
              cableId: generateCableId(),
              name: 'Кабель',
              length: 10,
              section: 4,
              material: 'copper',
            },
          });
          cableId = cable.id;
        }

        await db.connection.create({
          data: {
            sourceId: fromCuid,
            targetId: toCuid,
            cableId,
            order: 0,
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

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

function mapElementTypeToDeviceType(elementType: ElementType): DeviceType | null {
  switch (elementType) {
    case 'SOURCE': return 'SOURCE';
    case 'BREAKER': return 'BREAKER';
    case 'LOAD': return 'LOAD';
    case 'METER': return 'METER';
    default: return null;
  }
}

function getDefaultCurrent(type: ElementType): number {
  switch (type) {
    case 'SOURCE': return 910;
    case 'BREAKER': return 63;
    case 'LOAD': return 16;
    default: return 16;
  }
}

function getDefaultPower(type: ElementType): number {
  switch (type) {
    case 'SOURCE': return 630;
    case 'LOAD': return 5;
    default: return 5;
  }
}

// ============================================================================
// ОЧИСТКА БАЗЫ ДАННЫХ (безопасный порядок для новой схемы)
// ============================================================================

async function clearDatabase(): Promise<void> {
  await db.alarm.deleteMany();
  await db.calculatedParams.deleteMany();
  await db.validationResult.deleteMany();
  await db.validationRule.deleteMany();
  await db.meterReading.deleteMany();
  await db.meter.deleteMany();
  await db.load.deleteMany();
  await db.transformer.deleteMany();
  await db.breaker.deleteMany();
  await db.cable.deleteMany();
  await db.connection.deleteMany();
  await db.device.deleteMany();
  await db.deviceSlot.deleteMany();
  await db.element.deleteMany();

  slotCounter = 0;
  cableCounter = 0;
}

// ============================================================================
// ИМПОРТ ОТДЕЛЬНЫХ ЛИСТОВ (адаптирован)
// ============================================================================

async function importSources(rows: ExcelRow[]): Promise<{ elements: number; devices: number }> {
  let elements = 0;
  let devices = 0;

  for (const row of rows) {
    const name = String(row['Наименование'] || row['Название'] || row['Name'] || row['name'] || `Источник ${elements + 1}`);
    const voltage = Number(row['Напряжение'] || row['U'] || row['Напряжение кВ'] || 10);
    const power = Number(row['Мощность'] || row['S'] || row['Мощность кВА'] || 630);

    const elementId = generateElementId('SOURCE');

    const element = await db.element.create({
      data: {
        elementId,
        name,
        type: 'SOURCE',
        voltageLevel: voltage,
        posX: 0,
        posY: 0,
      },
    });
    elements++;

    const slot = await db.deviceSlot.create({
      data: {
        slotId: generateSlotId(),
        elementId: element.id,
        slotType: 'SOURCE',
      },
    });

    const device = await db.device.create({
      data: {
        deviceId: generateDeviceId('SOURCE'),
        slotId: slot.id,
        deviceType: 'SOURCE',
      },
    });

    await db.transformer.create({
      data: {
        deviceId: device.id,
        power,
        primaryKV: voltage,
        secondaryKV: 0.4,
      },
    });
    devices++;
  }

  return { elements, devices };
}

async function importCabinets(rows: ExcelRow[]): Promise<{ elements: number; devices: number }> {
  let elements = 0;

  for (const row of rows) {
    const name = String(row['Наименование'] || row['Название'] || row['Name'] || row['name'] || `Шкаф ${elements + 1}`);
    const elementId = generateElementId('CABINET', undefined, name.replace(/\s+/g, '_').toUpperCase());

    await db.element.create({
      data: {
        elementId,
        type: 'CABINET',
        name,
        voltageLevel: 0.4,
        posX: 0,
        posY: 0,
      },
    });
    elements++;
  }

  return { elements, devices: 0 };
}

async function importLoads(rows: ExcelRow[]): Promise<{ elements: number; devices: number }> {
  let elements = 0;
  let devices = 0;

  for (const row of rows) {
    const name = String(row['Наименование'] || row['Название'] || row['Name'] || row['name'] || `Нагрузка ${elements + 1}`);
    const pKw = Number(row['P'] || row['Мощность'] || row['P кВт'] || 0);
    const cosPhi = Number(row['cosφ'] || row['КМ'] || row['cosPhi'] || 0.9);
    const elementId = generateElementId('LOAD');

    const element = await db.element.create({
      data: {
        elementId,
        type: 'LOAD',
        name,
        voltageLevel: 0.4,
        posX: 0,
        posY: 0,
      },
    });
    elements++;

    const slot = await db.deviceSlot.create({
      data: {
        slotId: generateSlotId(),
        elementId: element.id,
        slotType: 'LOAD',
      },
    });

    const device = await db.device.create({
      data: {
        deviceId: generateDeviceId('LOAD'),
        slotId: slot.id,
        deviceType: 'LOAD',
      },
    });

    await db.load.create({
      data: {
        deviceId: device.id,
        name,
        powerP: pKw,
        cosPhi,
      },
    });
    devices++;
  }

  return { elements, devices };
}

async function importBreakers(rows: ExcelRow[]): Promise<{ elements: number; devices: number }> {
  let elements = 0;
  let devices = 0;

  for (const row of rows) {
    const name = String(row['Наименование'] || row['Название'] || row['Name'] || row['name'] || `Выкл ${elements + 1}`);
    const currentNom = Number(row['Iном'] || row['Ток'] || row['In'] || 16);
    const model = String(row['Модель'] || row['Тип'] || row['Model'] || 'ВА-47-29');
    const elementId = generateElementId('BREAKER', undefined, name.replace(/\s+/g, '_').toUpperCase());

    const element = await db.element.create({
      data: {
        elementId,
        type: 'BREAKER',
        name,
        voltageLevel: 0.4,
        posX: 0,
        posY: 0,
      },
    });
    elements++;

    const slot = await db.deviceSlot.create({
      data: {
        slotId: generateSlotId(),
        elementId: element.id,
        slotType: 'BREAKER',
      },
    });

    const device = await db.device.create({
      data: {
        deviceId: generateDeviceId('BREAKER'),
        slotId: slot.id,
        deviceType: 'BREAKER',
      },
    });

    await db.breaker.create({
      data: {
        deviceId: device.id,
        ratedCurrent: currentNom,
        tripCount: 0,
      },
    });
    devices++;
  }

  return { elements, devices };
}

async function importConnections(rows: ExcelRow[]): Promise<{ connections: number }> {
  let connections = 0;

  for (const row of rows) {
    const fromElementId = String(row['От'] || row['From'] || row['Начало'] || '');
    const toElementId = String(row['До'] || row['To'] || row['Конец'] || '');
    const wireType = String(row['Марка'] || row['Кабель'] || row['Type'] || 'ВВГ');
    const wireSize = Number(row['Сечение'] || row['Size'] || row['S мм2'] || 4);
    const length = Number(row['Длина'] || row['Length'] || row['L м'] || 10);

    if (!fromElementId || !toElementId) continue;

    // Ищем элементы по elementId
    const fromEl = await db.element.findUnique({ where: { elementId: fromElementId } });
    const toEl = await db.element.findUnique({ where: { elementId: toElementId } });

    if (!fromEl || !toEl) {
      console.warn(`Elements not found for connection: ${fromElementId} -> ${toElementId}`);
      continue;
    }

    // Создаём Cable
    const impedance = calculateCableImpedanceFromReference(length, wireType, wireSize);
    const material = wireType.startsWith('А') ? 'aluminum' : 'copper';

    const cable = await db.cable.create({
      data: {
        cableId: generateCableId(),
        name: `${wireType} ${wireSize}мм²`,
        length,
        section: wireSize,
        material,
        iDop: impedance ? undefined : 0,
      },
    });

    await db.connection.create({
      data: {
        sourceId: fromEl.id,
        targetId: toEl.id,
        cableId: cable.id,
        order: 0,
      },
    });
    connections++;
  }

  return { connections };
}

// ============================================================================
// ДЕМО-ДАННЫЕ (адаптирован)
// ============================================================================

async function createDemoData(): Promise<{ elements: number; devices: number; connections: number }> {
  console.log('Creating demo data...');

  const sourceEl = await db.element.create({
    data: {
      elementId: generateElementId('SOURCE', 'TP21'),
      type: 'SOURCE',
      name: 'ТП-21 Трансформатор 1',
      voltageLevel: 0.4,
      posX: 100,
      posY: 100,
    },
  });

  const slot1 = await db.deviceSlot.create({
    data: { slotId: generateSlotId(), elementId: sourceEl.id, slotType: 'SOURCE' },
  });
  const dev1 = await db.device.create({
    data: { deviceId: generateDeviceId('SOURCE'), slotId: slot1.id, deviceType: 'SOURCE' },
  });
  await db.transformer.create({
    data: { deviceId: dev1.id, power: 630, primaryKV: 10, secondaryKV: 0.4 },
  });

  const grSch = await db.element.create({
    data: { elementId: generateElementId('CABINET', undefined, 'GRSCH1'), type: 'CABINET', name: 'ГРЩ-1', voltageLevel: 0.4, posX: 300, posY: 100 },
  });

  const qf1El = await db.element.create({
    data: { elementId: generateElementId('BREAKER', undefined, 'GRSCH1_IN'), type: 'BREAKER', name: 'QF1 Вводной', parentId: grSch.id, voltageLevel: 0.4, posX: 350, posY: 100 },
  });
  const slotQf1 = await db.deviceSlot.create({ data: { slotId: generateSlotId(), elementId: qf1El.id, slotType: 'BREAKER' } });
  const devQf1 = await db.device.create({ data: { deviceId: generateDeviceId('BREAKER'), slotId: slotQf1.id, deviceType: 'BREAKER' } });
  await db.breaker.create({ data: { deviceId: devQf1.id, ratedCurrent: 630, tripCount: 0 } });

  const sch1 = await db.element.create({
    data: { elementId: generateElementId('CABINET', undefined, 'SCH1'), type: 'CABINET', name: 'ЩР-1', voltageLevel: 0.4, posX: 500, posY: 50 },
  });

  const sch2 = await db.element.create({
    data: { elementId: generateElementId('CABINET', undefined, 'SCH2'), type: 'CABINET', name: 'ЩР-2', voltageLevel: 0.4, posX: 500, posY: 150 },
  });

  const load1 = await db.element.create({
    data: { elementId: generateElementId('LOAD'), type: 'LOAD', name: 'Освещение цех 1', parentId: sch1.id, voltageLevel: 0.4, posX: 700, posY: 50 },
  });
  const slotL1 = await db.deviceSlot.create({ data: { slotId: generateSlotId(), elementId: load1.id, slotType: 'LOAD' } });
  const devL1 = await db.device.create({ data: { deviceId: generateDeviceId('LOAD'), slotId: slotL1.id, deviceType: 'LOAD' } });
  await db.load.create({ data: { deviceId: devL1.id, name: 'Освещение цех 1', powerP: 15, cosPhi: 0.95 } });

  const load2 = await db.element.create({
    data: { elementId: generateElementId('LOAD'), type: 'LOAD', name: 'Розеточная группа', parentId: sch2.id, voltageLevel: 0.4, posX: 700, posY: 150 },
  });
  const slotL2 = await db.deviceSlot.create({ data: { slotId: generateSlotId(), elementId: load2.id, slotType: 'LOAD' } });
  const devL2 = await db.device.create({ data: { deviceId: generateDeviceId('LOAD'), slotId: slotL2.id, deviceType: 'LOAD' } });
  await db.load.create({ data: { deviceId: devL2.id, name: 'Розеточная группа', powerP: 8, cosPhi: 0.94 } });

  // Связи
  const c1 = await db.cable.create({ data: { cableId: generateCableId(), name: 'ВВГ 120мм²', length: 25, section: 120, material: 'copper' } });
  await db.connection.create({ data: { sourceId: sourceEl.id, targetId: grSch.id, cableId: c1.id, order: 0 } });

  const c2 = await db.cable.create({ data: { cableId: generateCableId(), name: 'ВВГ 16мм²', length: 45, section: 16, material: 'copper' } });
  await db.connection.create({ data: { sourceId: grSch.id, targetId: sch1.id, cableId: c2.id, order: 0 } });

  const c3 = await db.cable.create({ data: { cableId: generateCableId(), name: 'ВВГ 6мм²', length: 30, section: 6, material: 'copper' } });
  await db.connection.create({ data: { sourceId: grSch.id, targetId: sch2.id, cableId: c3.id, order: 0 } });

  return { elements: 6, devices: 4, connections: 3 };
}

// ============================================================================
// РАСЧЁТ ПОЗИЦИЙ УЗЛОВ (адаптирован)
// ============================================================================

async function calculateNodePositions(): Promise<void> {
  const elements = await db.element.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const typeGroups: Record<string, typeof elements> = {
    SOURCE: [], BUS: [], JUNCTION: [], BREAKER: [], METER: [], CABINET: [], LOAD: [],
  };

  for (const el of elements) {
    if (typeGroups[el.type]) {
      typeGroups[el.type].push(el);
    }
  }

  const positions: Record<string, { x: number; y: number }> = {};
  const nodeWidth = 160;
  const nodeHeight = 80;
  const horizontalGap = 80;
  const verticalGap = 30;
  const startX = 100;
  const startY = 100;
  const nodesPerRow = 6;
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

  for (const [id, pos] of Object.entries(positions)) {
    await db.element.update({
      where: { id },
      data: { posX: pos.x, posY: pos.y },
    });
  }
}

// ============================================================================
// ЭКСПОРТЫ
// ============================================================================

export {
  clearDatabase,
  calculateNodePositions,
  detectElementType,
  findParentCabinet,
  buildCabinetAliasMap,
  importNetworkAll,
};

export default {
  importFromExcel,
};

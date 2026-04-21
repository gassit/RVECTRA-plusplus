/**
 * ============================================================================
 * УНИВЕРСАЛЬНЫЙ ИМПОРТ СЕТИ ИЗ EXCEL
 * ============================================================================
 * 
 * Объединяет функционал:
 * - import-data.ts: propagation, справочник кабелей
 * - import-echo-data.ts: формат ЭХО, location, AVR колонки
 * - import-network.ts: АВР листы, ток/мощность, batch createMany
 * 
 * Поддерживаемые форматы:
 * 1. Стандартный: колонки from/to + опционально state, connection, current, power, parent
 * 2. ЭХО формат: фиксированные позиции колонок (id, state, from, connection, to, protection, avr, avrState, location)
 * 3. АВР: отдельные листы AVR, AVR_Inputs, AVR_Outputs
 * 
 * Примечание: Расчёт позиций (layout) выполняется на frontend через AntV G6 dagre layout
 */

import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import type { OperationalStatus } from '../types/index';
import { propagateStates } from '../lib/services/state-propagation.service.js';

const prisma = new PrismaClient();

// ============================================================================
// ТИПЫ
// ============================================================================

interface ExcelFormat {
  type: 'standard' | 'echo' | 'auto';
  fromCol: string;
  toCol: string;
  connectionCol: string | null;
  stateCol: string | null;
  currentCol: string | null;
  powerCol: string | null;
  locationCol: string | null;
  parentCol: string | null;
  protectionCol: string | null;
  avrCol: string | null;
  avrStateCol: string | null;
  idCol: string | null;
}

interface ElementInfo {
  name: string;
  type: string;
  state?: string;
  current?: number | null;
  power?: number | null;
  location?: string | null;
  explicitParent?: string | null;
}

interface ConnectionInfo {
  from: string;
  to: string;
  connection?: string;
  order: number;
}

// ============================================================================
// ОПРЕДЕЛЕНИЕ ТИПОВ ЭЛЕМЕНТОВ (объединённое из всех скриптов)
// ============================================================================

function detectElementType(name: string): string {
  if (!name) return 'load';
  
  const n = name.toLowerCase().trim();
  
  // Пустые/null/NaN → LOAD
  if (n === 'null' || n === 'nan' || n === '' || n === '-') return 'load';

  // ========== SOURCE — Источники питания ==========
  // Трансформаторы: Т1, Т2, Т1 ТП, Т2 ТП21
  if (/^т\d+[\s\.]/i.test(name)) return 'source';
  if (/трансформатор/i.test(name)) return 'source';
  if (/^т\d+\s+тп/i.test(name)) return 'source';
  // ПЦ, ЦП - вводные выключатели (источники)
  if (/^пц/i.test(name)) return 'source';
  if (/^цп/i.test(name)) return 'source';
  // ДГУ - дизель-генератор
  if (/^дгу/i.test(name)) return 'source';
  // ИБП - источник бесперебойного питания (исключая "Точрасп")
  if (/ибп/i.test(name) && !/точрасп/i.test(name)) return 'source';
  // Генератор
  if (/генератор/i.test(name)) return 'source';

  // ========== BREAKER — Коммутационные аппараты ==========
  // QF + номер (QF1, QF2.1, 1QF, QF2.10)
  if (/^(\d*)qf[d]?[\d\.\s]/i.test(name)) return 'breaker';
  if (/^(\d*)qf$/i.test(name)) return 'breaker';
  // QD - дифференциальный автомат
  if (/^(\d*)qd[\d\.\s]/i.test(name) || /^(\d*)qd$/i.test(name)) return 'breaker';
  // QS - разъединитель
  if (/^(\d*)qs[\d\.\s]/i.test(name) || /^(\d*)qs$/i.test(name)) return 'breaker';
  // FU - предохранитель
  if (/^(\d*)fu[\d\.\s]/i.test(name) || /^(\d*)fu$/i.test(name)) return 'breaker';
  // KM - контактор
  if (/^(\d*)km[\d\.\s]/i.test(name) || /^(\d*)km$/i.test(name)) return 'breaker';
  // KA, KV, SA - реле и переключатели
  if (/^(\d*)ka[\d\.\s]/i.test(name) || /^(\d*)ka$/i.test(name)) return 'breaker';
  if (/^(\d*)kv[\d\.\s]/i.test(name) || /^(\d*)kv$/i.test(name)) return 'breaker';
  if (/^(\d*)sa[\d\.\s]/i.test(name) || /^(\d*)sa$/i.test(name)) return 'breaker';
  // Автомат, выключатель
  if (/автомат/i.test(name)) return 'breaker';
  if (/выключатель/i.test(name)) return 'breaker';
  // Автоматика
  if (n.startsWith('автоматика')) return 'breaker';

  // ========== CABINET — Шкафы/щиты ==========
  if (/^щр\d*/i.test(name)) return 'cabinet';
  if (/^шу\s/i.test(name) || /^шу\d/i.test(name)) return 'cabinet';
  if (/^вру/i.test(name)) return 'cabinet';
  if (/^грщ/i.test(name)) return 'cabinet';
  if (n === 'авр' || /^авр\s/i.test(name)) return 'cabinet';
  if (/^щао/i.test(name)) return 'cabinet';
  if (/^\d*ш[удвз]/i.test(name)) return 'cabinet';
  if (n.startsWith('шкаф')) return 'cabinet';
  // ППУ - панель управления
  if (/^ппу[-а-яёА-ЯЁ\w]*/i.test(name)) return 'cabinet';
  if (/^ппу$/i.test(name)) return 'cabinet';

  // ========== JUNCTION — Узлы/точки распределения ==========
  if (/точрасп/i.test(name) || /точ\sрасп/i.test(name)) return 'junction';
  if (/точка\sраспределения/i.test(name)) return 'junction';
  if (/узел/i.test(name) && !/учета/i.test(name)) return 'junction';

  // ========== METER — Узлы учёта ==========
  if (n.startsWith('узел учета')) return 'meter';
  if (/^узуч/i.test(name)) return 'meter';
  if (/счётчик/i.test(name) || /счетчик/i.test(name)) return 'meter';
  // ART-, PQRS - счётчики типа ART-, PQRS-
  if (/^art-/i.test(name) || /^pqrs/i.test(name)) return 'meter';

  // ========== BUS — Сборные шины (проверяем ПОСЛЕ QF/QS) ==========
  if (!/точрасп/i.test(name)) {
    if (/\d*с\.ш\./.test(name)) return 'bus';
    if (/магистраль/i.test(name) || n === 'шина') return 'bus';
    if (/шинопровод/i.test(name)) return 'bus';
    if (/сборка/i.test(name)) return 'bus';
  }

  // ========== LOAD — По умолчанию ==========
  // Нагрузка, Щит, ЩР (без номера)
  if (/нагрузк/i.test(name)) return 'load';
  if (/щит/i.test(name) && !/грщ|вру|щр/i.test(name)) return 'load';

  return 'load';
}

// ============================================================================
// ПАРСИНГ СОСТОЯНИЙ
// ============================================================================

function parseOperationalStatus(stateValue: string | undefined | null): OperationalStatus {
  if (!stateValue) return 'ON';
  
  const state = String(stateValue).toLowerCase().trim();
  
  // OFF: off, выкл, 0, false, отключен, разомкнут
  if (/off/i.test(state) ||
      /выкл/i.test(state) ||
      state === '0' ||
      /false/i.test(state) ||
      /отключен/i.test(state) ||
      /разомкнут/i.test(state)) {
    return 'OFF';
  }
  
  // Резерв
  if (/резерв/i.test(state) || /reserve/i.test(state)) {
    return 'ON'; // Резерв = ON, но может иметь отдельный статус
  }
  
  return 'ON';
}

// ============================================================================
// НОРМАЛИЗАЦИЯ ИМЁН
// ============================================================================

function normalizeName(s: string): string {
  return s
    .replace(/\s+/g, ' ')           // сжать множественные пробелы
    .replace(/\s*\/\s*/g, '/')      // убрать пробелы вокруг слеша
    .replace(/\s*\\\s*/g, '\\')     // убрать пробелы вокруг обратного слеша
    .replace(/([А-ЯA-Z]+)\s+(\d)/g, '$1$2')  // "ГРЩ 1" → "ГРЩ1"
    .trim();
}

function parseFloatValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(String(value).replace(',', '.').replace(/[^\d.\-]/g, ''));
  return isNaN(num) ? null : num;
}

// ============================================================================
// ИЗВЛЕЧЕНИЕ CABINET ИЗ ИМЕНИ
// ============================================================================

function extractCabinet(elementName: string, elementType: string): string | undefined {
  // CABINET и SOURCE не могут быть дочерними
  if (elementType === 'cabinet' || elementType === 'source') return undefined;

  const patterns = [
    /ГРЩ\d*[^\s/]*/gi,
    /ЩР\d*[-\w]*/gi,
    /ШУ[-\w]*/gi,
    /ВРУ[-\w]*/gi,
    /АВР\d*/gi,
    /ЩАО\w*/gi,
    /\d*Ш[УДВЗ]\w*/gi,
    /ППУ[-а-яёА-ЯЁ\w]*/gi,
    /Шкаф\s+[^\s/]+/gi,
  ];

  const candidates: string[] = [];

  // Извлекаем из "N с.ш. CABINET_NAME"
  const busMatch = elementName.match(/\d+\s*с\.ш\.\s*([^\s]+)/);
  if (busMatch) {
    candidates.push(busMatch[1]);
  }

  // Извлекаем по паттернам
  for (const pattern of patterns) {
    const matches = elementName.match(pattern);
    if (matches) {
      candidates.push(...matches.map(m => m.trim()));
    }
  }

  // Ищем лучшее совпадение (самое длинное)
  let bestMatch: string | undefined;
  for (const candidate of candidates) {
    const candidateType = detectElementType(candidate);
    if (candidateType === 'cabinet') {
      if (!bestMatch || candidate.length > bestMatch.length) {
        bestMatch = candidate;
      }
    }
  }

  return bestMatch;
}

// ============================================================================
// ОПРЕДЕЛЕНИЕ ФОРМАТА EXCEL
// ============================================================================

function detectExcelFormat(rawData: Record<string, unknown>[]): ExcelFormat {
  if (rawData.length === 0) {
    return { type: 'standard', fromCol: '', toCol: '', connectionCol: null, stateCol: null, currentCol: null, powerCol: null, locationCol: null, parentCol: null, protectionCol: null, avrCol: null, avrStateCol: null, idCol: null };
  }

  const cols = Object.keys(rawData[0]);
  const colCount = cols.length;
  
  // Проверяем ЭХО формат: минимум 5 колонок, имена по позиции
  // ЭХО: [id, state, from, connection, to, protection?, avr?, avrState?, location?, assemblyFrom?]
  const isEchoFormat = colCount >= 5 && 
    (!cols[0] || cols[0].toLowerCase() === 'id' || /^\d+$/.test(String(rawData[0]?.[cols[0]])));

  if (isEchoFormat) {
    console.log('📋 Определён формат: ЭХО (фиксированные позиции колонок)');
    return {
      type: 'echo',
      idCol: cols[0],
      stateCol: cols[1] || null,
      fromCol: cols[2],
      connectionCol: cols[3] || null,
      toCol: cols[4],
      protectionCol: cols[5] || null,
      avrCol: cols[6] || null,
      avrStateCol: cols[7] || null,
      locationCol: cols[8] || null,
      parentCol: cols[9] || null,
      currentCol: null,
      powerCol: null,
    };
  }

  // Стандартный формат: ищем по именам колонок
  console.log('📋 Определён формат: Стандартный (поиск по именам колонок)');

  const findCol = (patterns: RegExp[]): string | null => {
    for (const col of cols) {
      const colLower = col.toLowerCase();
      for (const p of patterns) {
        if (p.test(colLower) || p.test(col)) return col;
      }
    }
    return null;
  };

  const fromCol = findCol([/^from$/i, /^от$/i]) || cols[2] || null;
  const toCol = findCol([/^to$/i, /^до$/i, /^к$/i]) || cols[4] || null;

  return {
    type: 'standard',
    fromCol: fromCol || '',
    toCol: toCol || '',
    connectionCol: findCol([/^connection$/i, /^соединение$/i, /^кабель$/i]) || cols[3] || null,
    stateCol: findCol([/^state$/i, /^состояние$/i, /^статус$/i]) || cols[1] || null,
    currentCol: findCol([/^ток$/i, /^current$/i, /^i_?ном$/i]),
    powerCol: findCol([/^мощность$/i, /^power$/i, /^p_?квт$/i, /^s_?ква$/i]),
    locationCol: findCol([/^location$/i, /^расположе/i, /^место$/i, /^помещение$/i]),
    parentCol: findCol([/^parent$/i, /^родитель$/i, /^шкаф$/i, /^сборка$/i]),
    protectionCol: findCol([/^protection$/i, /^защита$/i]),
    avrCol: findCol([/^avr$/i, /^авр$/i]),
    avrStateCol: findCol([/^avrstate$/i, /^avr_state$/i, /^состояние_?авр$/i]),
    idCol: findCol([/^id$/i, /^№$/i]),
  };
}

// ============================================================================
// ПОИСК ФАЙЛА EXCEL
// ============================================================================

function findExcelFile(): string | null {
  const dir = '/home/z/my-project/upload';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return null;
  }
  
  const files = fs.readdirSync(dir).filter(f => 
    f.endsWith('.xlsx') || f.endsWith('.xls')
  );
  
  if (files.length === 0) return null;

  // Приоритет файлов
  const priority = ['input.xlsx', 'ШАБЛОН_ИМПОРТА.xlsx', 'ЭХОв.xlsx', 'ЭХОмини.v1.xlsx'];
  for (const p of priority) {
    if (files.includes(p)) return path.join(dir, p);
  }

  return path.join(dir, files[0]);
}

// ============================================================================
// ИМПОРТ АВР
// ============================================================================

async function importAVR(workbook: xlsx.WorkBook, elementIdToDbId: Map<string, string>): Promise<{ avrs: number; inputs: number; outputs: number }> {
  let avrs = 0;
  let inputs = 0;
  let outputs = 0;
  const now = Date.now();

  // Лист AVR
  if (workbook.SheetNames.includes('AVR')) {
    const sheet = workbook.Sheets['AVR'];
    const data = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet);
    console.log(`   Лист AVR: ${data.length} записей`);

    for (const row of data) {
      const avrId = String(row['id'] || row['ID'] || row['avr_id'] || '');
      const name = String(row['name'] || row['название'] || '');
      const description = String(row['description'] || row['описание'] || '');
      const mode = String(row['mode'] || row['режим'] || 'AUTO').toUpperCase();
      const delay = parseFloatValue(row['delay_sec'] || row['задержка'] || 0.5) || 0.5;

      if (!avrId || !name) continue;

      try {
        await prisma.aVR.create({
          data: {
            id: avrId,
            name,
            description: description || null,
            mode: ['AUTO', 'MANUAL', 'OFF'].includes(mode) ? mode : 'AUTO',
            status: 'OK',
            switchoverDelay: delay,
          }
        });
        avrs++;
      } catch (e) {
        // Дубликат
      }
    }
  }

  // Лист AVR_Inputs
  if (workbook.SheetNames.includes('AVR_Inputs')) {
    const sheet = workbook.Sheets['AVR_Inputs'];
    const data = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet);
    console.log(`   Лист AVR_Inputs: ${data.length} записей`);

    for (const row of data) {
      const avrId = String(row['avr_id'] || row['avr'] || '');
      const elementName = normalizeName(String(row['element'] || row['элемент'] || ''));
      const role = String(row['role'] || row['роль'] || 'RESERVE').toUpperCase();
      const priority = parseInt(String(row['priority'] || row['приоритет'] || '99'));
      const signalType = String(row['signal'] || row['сигнал'] || 'ELECTRICAL').toUpperCase();

      if (!avrId || !elementName) continue;

      const element = await prisma.element.findFirst({ where: { name: elementName } });
      if (!element) continue;

      try {
        await prisma.aVRInput.create({
          data: {
            id: `avri_${now}_${Math.random().toString(36).substr(2, 9)}`,
            avrId,
            elementId: element.id,
            role,
            priority,
            signalType: ['ELECTRICAL', 'OPERATIONAL'].includes(signalType) ? signalType : 'ELECTRICAL',
          }
        });
        inputs++;
      } catch (e) {
        // Игнорируем
      }
    }
  }

  // Лист AVR_Outputs
  if (workbook.SheetNames.includes('AVR_Outputs')) {
    const sheet = workbook.Sheets['AVR_Outputs'];
    const data = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet);
    console.log(`   Лист AVR_Outputs: ${data.length} записей`);

    for (const row of data) {
      const avrId = String(row['avr_id'] || row['avr'] || '');
      const elementName = normalizeName(String(row['element'] || row['элемент'] || ''));
      const role = String(row['role'] || row['роль'] || 'BREAKER').toUpperCase();
      const actionOn = String(row['action_on'] || row['вкл'] || 'CLOSE');
      const actionOff = String(row['action_off'] || row['откл'] || 'OPEN');

      if (!avrId || !elementName) continue;

      const element = await prisma.element.findFirst({ where: { name: elementName } });
      if (!element) continue;

      try {
        await prisma.aVROutput.create({
          data: {
            id: `avro_${now}_${Math.random().toString(36).substr(2, 9)}`,
            avrId,
            elementId: element.id,
            role,
            actionOn,
            actionOff,
            isActive: false,
          }
        });
        outputs++;
      } catch (e) {
        // Игнорируем
      }
    }
  }

  return { avrs, inputs, outputs };
}

// ============================================================================
// ИМПОРТ СПРАВОЧНИКА КАБЕЛЕЙ
// ============================================================================

async function importCableReference(workbook: xlsx.WorkBook): Promise<number> {
  const sheetNames = ['directory_connection', 'cables', 'кабели', 'справочник'];
  let imported = 0;

  for (const name of sheetNames) {
    if (!workbook.SheetNames.includes(name)) continue;

    const sheet = workbook.Sheets[name];
    const data = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet);
    console.log(`   Лист ${name}: ${data.length} записей`);

    for (const row of data) {
      try {
        const mark = String(row['Марка, тип'] || row['mark'] || row['марка'] || '');
        const section = parseFloatValue(row['сечение'] || row['section'] || '0');
        const cores = parseInt(String(row['кол-во жил'] || row['cores'] || '3'));
        const iDop = parseFloatValue(row['ток, А'] || row['current'] || row['i_dop'] || '0');
        const material = String(row['Материал'] || row['material'] || 'Медь')
          .toLowerCase().includes('алюминий') ? 'aluminum' : 'copper';
        const voltage = parseFloatValue(row['Напряжение'] || row['voltage'] || '380') || 380;

        if (mark && section && section > 0) {
          const markKey = `${mark}_${cores}x${section}`;
          await prisma.cableReference.upsert({
            where: { mark: markKey },
            create: {
              id: `cable_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              mark: markKey,
              section,
              material,
              voltage: voltage / 1000,
              iDop: iDop || 0,
              r0: 0,
              x0: 0.08,
            },
            update: {
              iDop: iDop || 0,
              material,
            },
          });
          imported++;
        }
      } catch (e) {
        // Игнорируем
      }
    }
    break; // Только первый найденный лист
  }

  return imported;
}

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ ИМПОРТА
// ============================================================================

export async function importUniversal(options: { filePath?: string; sheetName?: string } = {}): Promise<{
  success: boolean;
  elements?: number;
  connections?: number;
  cabinets?: number;
  avrs?: number;
  error?: string;
}> {
  console.log('=== УНИВЕРСАЛЬНЫЙ ИМПОРТ ИЗ EXCEL ===\n');

  // Поиск файла
  const filePath = options.filePath || findExcelFile();
  if (!filePath) {
    console.error('❌ Файл Excel не найден');
    return { success: false, error: 'Файл Excel не найден в папке upload' };
  }
  console.log(`📁 Файл: ${filePath}`);

  // Чтение Excel
  const workbook = xlsx.readFile(filePath);
  console.log(`📄 Листы: ${workbook.SheetNames.join(', ')}`);

  // Определение листа для импорта
  const sheetName = options.sheetName || 
    (workbook.SheetNames.includes('Networkall') ? 'Networkall' : workbook.SheetNames[0]);
  const sheet = workbook.Sheets[sheetName];
  const rawData = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet);
  console.log(`📄 Лист "${sheetName}": ${rawData.length} строк`);

  if (rawData.length === 0) {
    return { success: false, error: 'Лист пуст' };
  }

  // Определение формата
  const format = detectExcelFormat(rawData);
  console.log(`📌 Колонки: from="${format.fromCol}", to="${format.toCol}"`);
  if (format.stateCol) console.log(`📌 state="${format.stateCol}"`);
  if (format.connectionCol) console.log(`📌 connection="${format.connectionCol}"`);
  if (format.currentCol) console.log(`📌 ток="${format.currentCol}"`);
  if (format.powerCol) console.log(`📌 мощность="${format.powerCol}"`);
  if (format.locationCol) console.log(`📌 location="${format.locationCol}"`);
  if (format.parentCol) console.log(`📌 parent="${format.parentCol}"`);

  // =========================================================================
  // ОЧИСТКА БАЗЫ
  // =========================================================================
  console.log('\n=== ОЧИСТКА БАЗЫ ===');
  await prisma.$transaction([
    prisma.aVRSwitchover.deleteMany(),
    prisma.aVROutput.deleteMany(),
    prisma.aVRInput.deleteMany(),
    prisma.aVR.deleteMany(),
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
  console.log('✅ База очищена');

  // =========================================================================
  // СБОР ДАННЫХ
  // =========================================================================
  console.log('\n=== СБОР ДАННЫХ ===');

  const elementsMap = new Map<string, ElementInfo>();
  const connectionsData: ConnectionInfo[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];

    // Чтение колонок
    const from = normalizeName(String(row[format.fromCol] || ''));
    const to = normalizeName(String(row[format.toCol] || ''));

    if (!from || !to) continue;

    const connection = format.connectionCol ? normalizeName(String(row[format.connectionCol] || '')) : undefined;
    const state = format.stateCol ? String(row[format.stateCol] || '').trim() : undefined;
    const current = format.currentCol ? parseFloatValue(row[format.currentCol]) : null;
    const power = format.powerCol ? parseFloatValue(row[format.powerCol]) : null;
    const location = format.locationCol ? String(row[format.locationCol] || '').trim() || null : null;
    const explicitParent = format.parentCol ? normalizeName(String(row[format.parentCol] || '')) : null;

    const fromType = detectElementType(from);
    const toType = detectElementType(to);

    // Добавляем from-элемент
    if (!elementsMap.has(from)) {
      elementsMap.set(from, {
        name: from,
        type: fromType,
        state,
        current,
        power: null,
        location,
        explicitParent: explicitParent || null,
      });
    } else {
      const el = elementsMap.get(from)!;
      if (current !== null && el.current === null) el.current = current;
      if (location && !el.location) el.location = location;
      if (explicitParent && !el.explicitParent) el.explicitParent = explicitParent;
    }

    // Добавляем to-элемент
    if (!elementsMap.has(to)) {
      elementsMap.set(to, {
        name: to,
        type: toType,
        state,
        current: null,
        power: toType === 'load' ? power : null,
        location,
        explicitParent: null,
      });
    } else {
      const el = elementsMap.get(to)!;
      if (toType === 'load' && power !== null && el.power === null) el.power = power;
      if (location && !el.location) el.location = location;
    }

    connectionsData.push({ from, to, connection, order: i + 1 });
  }

  console.log(`📦 Элементов: ${elementsMap.size}, связей: ${connectionsData.length}`);

  // =========================================================================
  // ИЗВЛЕЧЕНИЕ CABINET
  // =========================================================================
  console.log('\n=== ИЗВЛЕЧЕНИЕ CABINET ===');

  // Извлекаем cabinet из имён элементов
  for (const [id, info] of elementsMap) {
    const cabinet = extractCabinet(info.name, info.type);
    if (cabinet && !elementsMap.has(cabinet)) {
      elementsMap.set(cabinet, { name: cabinet, type: 'cabinet' });
    }
  }

  // Строим карту parentId
  const parentMap = new Map<string, string>();
  let explicitParentCount = 0;
  let calculatedParentCount = 0;

  for (const [id, info] of elementsMap) {
    if (info.explicitParent) {
      parentMap.set(id, info.explicitParent);
      explicitParentCount++;
      // Добавляем родителя если его нет
      if (!elementsMap.has(info.explicitParent)) {
        elementsMap.set(info.explicitParent, { name: info.explicitParent, type: 'cabinet' });
      }
    } else {
      const parent = extractCabinet(info.name, info.type);
      if (parent) {
        parentMap.set(id, parent);
        calculatedParentCount++;
      }
    }
  }

  // Статистика типов
  const typeStats = new Map<string, number>();
  for (const el of elementsMap.values()) {
    typeStats.set(el.type, (typeStats.get(el.type) || 0) + 1);
  }
  console.log('📊 Типы:', Object.fromEntries(typeStats));
  console.log(`✅ ParentId: ${explicitParentCount} явных, ${calculatedParentCount} вычисленных`);

  // =========================================================================
  // ИМПОРТ ЭЛЕМЕНТОВ
  // =========================================================================
  console.log('\n=== ИМПОРТ ЭЛЕМЕНТОВ ===');

  const elementIdToDbId = new Map<string, string>();
  const now = Date.now();

  // Сначала Cabinet
  const cabinetData = [];
  for (const [elementId, info] of elementsMap) {
    if (info.type !== 'cabinet') continue;
    const dbId = `el_${now}_${Math.random().toString(36).substr(2, 9)}`;
    elementIdToDbId.set(elementId, dbId);
    cabinetData.push({
      id: dbId,
      elementId,
      name: info.name,
      type: info.type,
      voltageLevel: 0.4,
      operationalStatus: parseOperationalStatus(info.state),
      electricalStatus: 'DEAD',
      parentId: null,
      updatedAt: new Date(),
    });
  }

  if (cabinetData.length > 0) {
    await prisma.element.createMany({ data: cabinetData });
    console.log(`   Cabinet: ${cabinetData.length}`);
  }

  // Остальные элементы
  const otherData = [];
  for (const [elementId, info] of elementsMap) {
    if (info.type === 'cabinet') continue;
    const dbId = `el_${now}_${Math.random().toString(36).substr(2, 9)}`;
    elementIdToDbId.set(elementId, dbId);
    const parentEl = parentMap.get(elementId);
    const parentDb = parentEl ? elementIdToDbId.get(parentEl) : null;
    otherData.push({
      id: dbId,
      elementId,
      name: info.name,
      type: info.type,
      voltageLevel: 0.4,
      operationalStatus: parseOperationalStatus(info.state),
      electricalStatus: 'DEAD',
      parentId: parentDb || null,
      updatedAt: new Date(),
    });
  }

  if (otherData.length > 0) {
    await prisma.element.createMany({ data: otherData });
    console.log(`   Остальные: ${otherData.length}`);
  }

  // =========================================================================
  // ИМПОРТ СВЯЗЕЙ
  // =========================================================================
  console.log('\n=== ИМПОРТ СВЯЗЕЙ ===');

  const connectionData = [];
  for (const c of connectionsData) {
    const sourceDbId = elementIdToDbId.get(c.from);
    const targetDbId = elementIdToDbId.get(c.to);
    if (!sourceDbId || !targetDbId) continue;
    connectionData.push({
      id: `conn_${now}_${Math.random().toString(36).substr(2, 9)}`,
      sourceId: sourceDbId,
      targetId: targetDbId,
      order: c.order,
      operationalStatus: 'ON',
      electricalStatus: 'DEAD',
    });
  }

  if (connectionData.length > 0) {
    await prisma.connection.createMany({ data: connectionData });
    console.log(`   Связи: ${connectionData.length}`);
  }

  // =========================================================================
  // ИМПОРТ АВР
  // =========================================================================
  console.log('\n=== ИМПОРТ АВР ===');
  const avrResult = await importAVR(workbook, elementIdToDbId);
  console.log(`   АВР: ${avrResult.avrs}, входов: ${avrResult.inputs}, выходов: ${avrResult.outputs}`);

  // =========================================================================
  // ИМПОРТ СПРАВОЧНИКА КАБЕЛЕЙ
  // =========================================================================
  console.log('\n=== СПРАВОЧНИК КАБЕЛЕЙ ===');
  const cablesImported = await importCableReference(workbook);
  console.log(`   Импортировано: ${cablesImported}`);

  // =========================================================================
  // РАСПРОСТРАНЕНИЕ СОСТОЯНИЙ
  // =========================================================================
  console.log('\n=== РАСПРОСТРАНЕНИЕ СОСТОЯНИЙ ===');
  const propagationResult = await propagateStates();
  console.log(`   Обновлено элементов: ${propagationResult.elementsUpdated}`);
  console.log(`   LIVE: ${propagationResult.liveElements}, DEAD: ${propagationResult.deadElements}, OFF: ${propagationResult.offElements}`);

  // =========================================================================
  // ИТОГИ
  // =========================================================================
  const totalElements = await prisma.element.count();
  const totalConnections = await prisma.connection.count();
  const totalCabinets = await prisma.element.count({ where: { type: 'cabinet' } });
  const withParent = await prisma.element.count({ where: { parentId: { not: null } } });

  console.log('\n=== ИМПОРТ ЗАВЕРШЁН ===');
  console.log(`📊 Элементов: ${totalElements}`);
  console.log(`📊 Cabinet: ${totalCabinets}, с parentId: ${withParent}`);
  console.log(`📊 Связей: ${totalConnections}`);
  console.log(`📊 АВР: ${avrResult.avrs}, входов: ${avrResult.inputs}, выходов: ${avrResult.outputs}`);

  await prisma.$disconnect();

  return {
    success: true,
    elements: totalElements,
    connections: totalConnections,
    cabinets: totalCabinets,
    avrs: avrResult.avrs,
  };
}

// ============================================================================
// CLI
// ============================================================================

if (require.main === module) {
  importUniversal()
    .then(result => {
      if (!result.success) {
        console.error('❌ Ошибка:', result.error);
        process.exit(1);
      }
    })
    .catch(e => {
      console.error('❌ Критическая ошибка:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

export default importUniversal;

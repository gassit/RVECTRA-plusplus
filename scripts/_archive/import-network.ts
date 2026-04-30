import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ============================================================================
// ОПРЕДЕЛЕНИЕ ТИПОВ ЭЛЕМЕНТОВ
// ============================================================================

function detectElementType(name: string): string {
  const nameLower = name.toLowerCase();
  if (!name || nameLower === 'null' || nameLower === 'nan' || name.trim() === '') return 'load';

  // SOURCE
  if (/^т\d\s/i.test(name)) return 'source';
  if (/трансформатор/i.test(name)) return 'source';
  if (/^т\d\s+тп/i.test(name)) return 'source';
  if (nameLower.startsWith('пц')) return 'source';
  if (nameLower.startsWith('цп')) return 'source';
  if (/^дгу/i.test(name)) return 'source';
  if (/ибп/i.test(name) && !/точрасп/i.test(name)) return 'source';

  // BREAKER
  if (/^\d*qfd[\d\.\s]/i.test(name)) return 'breaker';
  if (/^\d*qf[\d\.\s]/i.test(name) || /^\d*qf$/i.test(name)) return 'breaker';
  if (/^\d*qd[\d\.\s]/i.test(name) || /^\d*qd$/i.test(name)) return 'breaker';
  if (/^\d*qs[\d\.\s]/i.test(name) || /^\d*qs$/i.test(name)) return 'breaker';
  if (/^\d*fu[\d\.\s]/i.test(name) || /^\d*fu$/i.test(name)) return 'breaker';
  if (/^\d*km[\d\.\s]/i.test(name) || /^\d*km$/i.test(name)) return 'breaker';
  if (/^\d*ka[\d\.\s]/i.test(name) || /^\d*ka$/i.test(name)) return 'breaker';
  if (/^\d*sa[\d\.\s]/i.test(name) || /^\d*sa$/i.test(name)) return 'breaker';
  if (/^\d*kv[\d\.\s]/i.test(name) || /^\d*kv$/i.test(name)) return 'breaker';
  if (nameLower.startsWith('автоматика')) return 'breaker';

  // CABINET
  if (/^щр\d*/i.test(name)) return 'cabinet';
  if (/^шу\s/i.test(name) || /^шу\d/i.test(name)) return 'cabinet';
  if (/^вру/i.test(name)) return 'cabinet';
  if (/^грщ/i.test(name)) return 'cabinet';
  if (nameLower === 'авр' || /^авр\s/i.test(name)) return 'cabinet';
  if (/^щао/i.test(name)) return 'cabinet';
  if (/^\d*ш[удвз]/i.test(name)) return 'cabinet';
  if (nameLower.startsWith('шкаф')) return 'cabinet';
  if (/^ппу[-а-яёА-ЯЁ\w]*/i.test(name)) return 'cabinet';
  if (/^ппу$/i.test(name)) return 'cabinet';

  // JUNCTION
  if (/точрасп/i.test(name) || /точ расп/i.test(name)) return 'junction';
  if (/точка распределения/i.test(name)) return 'junction';

  // METER
  if (nameLower.startsWith('узел учета')) return 'meter';
  if (/^узуч/i.test(name)) return 'meter';
  if (/счётчик/i.test(name) || /счетчик/i.test(name)) return 'meter';

  // BUS
  if (!/точрасп/i.test(name)) {
    if (/\d*с\.ш\./.test(name)) return 'bus';
    if (/магистраль/i.test(name) || nameLower === 'шина') return 'bus';
  }

  return 'load';
}

function parseOperationalStatus(stateValue: string | undefined | null): 'ON' | 'OFF' {
  if (!stateValue) return 'ON';
  const state = String(stateValue).toLowerCase().trim();
  return /off|выкл|^0$|false|отключен/.test(state) ? 'OFF' : 'ON';
}

function normalizeName(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/').replace(/([А-ЯA-Z]+)\s+(\d)/g, '$1$2').trim();
}

function parseFloatValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(String(value).replace(',', '.').replace(/[^\d.\-]/g, ''));
  return isNaN(num) ? null : num;
}

// Извлечение CABINET из имени
function extractCabinet(elementName: string, elementType: string): string | undefined {
  if (elementType === 'cabinet' || elementType === 'source') return undefined;

  const patterns = [/ГРЩ\d*/gi, /ЩР\d*[-\w]*/gi, /ШУ[-\w]*/gi, /ВРУ[-\w]*/gi, /АВР\d*/gi, /ЩАО\w*/gi, /\d*Ш[УДВЗ]\w*/gi, /ППУ[-а-яёА-ЯЁ\w]*/gi];
  const candidates: string[] = [];

  const busMatch = elementName.match(/\d+\s*с\.ш\.\s*([^\s]+)/);
  if (busMatch) candidates.push(busMatch[1]);

  for (const p of patterns) {
    const m = elementName.match(p);
    if (m) candidates.push(...m.map(x => x.trim()));
  }

  let best: string | undefined;
  for (const c of candidates) {
    if (detectElementType(c) === 'cabinet' && (!best || c.length > best.length)) best = c;
  }
  return best;
}

function findExcelFile(): string | null {
  const dir = path.join(process.cwd(), 'upload');
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); return null; }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
  if (files.length === 0) return null;
  for (const p of ['input.xlsx', 'ШАБЛОН_ИМПОРТА.xlsx']) {
    if (files.includes(p)) return path.join(dir, p);
  }
  return path.join(dir, files[0]);
}

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================================

export async function importNetwork(options: { filePath?: string; sheetName?: string } = {}) {
  console.log('=== ИМПОРТ СЕТИ ИЗ EXCEL ===\n');

  const filePath = options.filePath || findExcelFile();
  if (!filePath) { console.error('❌ Файл не найден'); return { success: false, error: 'Файл не найден' }; }
  console.log(`📁 Файл: ${filePath}`);

  const workbook = xlsx.readFile(filePath);
  console.log(`📄 Листы: ${workbook.SheetNames.join(', ')}`);

  // === ИМПОРТ ОСНОВНОЙ СХЕМЫ ===
  const sheetName = options.sheetName || (workbook.SheetNames.includes('Networkall') ? 'Networkall' : workbook.SheetNames[0]);
  const sheet = workbook.Sheets[sheetName];
  const rawData = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet);
  console.log(`📄 Лист ${sheetName}: ${rawData.length} строк`);

  if (rawData.length === 0) return { success: false, error: 'Лист пуст' };

  // Определение колонок
  const cols = Object.keys(rawData[0]);
  const find = (patterns: RegExp[]): string | null => {
    for (const c of cols) {
      const cl = String(c).toLowerCase();
      for (const p of patterns) if (p.test(cl) || p.test(String(c))) return c;
    }
    return null;
  };

  const fromCol = find([/^from$/i]) || cols[2];
  const toCol = find([/^to$/i]) || cols[4];
  const connCol = find([/^connection$/i]) || cols[3];
  const stateCol = find([/^state$/i]) || cols[1];
  const currentCol = find([/^ток$/i, /current/i]);
  const powerCol = find([/^мощность$/i, /^power$/i]);
  const locationCol = find([/^location$/i, /расположе/i, /место/i]);
  const parentCol = find([/^parent$/i]);

  console.log(`📌 from: ${fromCol}, to: ${toCol}, connection: ${connCol}, state: ${stateCol}`);
  console.log(`📌 ток: ${currentCol}, мощность: ${powerCol}, location: ${locationCol}, parent: ${parentCol}`);

  // Очистка БД
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

  // Сбор данных
  interface ElInfo { name: string; type: string; state?: string; current?: number | null; power?: number | null; location?: string | null; explicitParent?: string | null; }

  const elementsMap = new Map<string, ElInfo>();
  const connectionsData: { from: string; to: string; conn?: string; order: number }[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const from = normalizeName(String(row[fromCol!] || ''));
    const to = normalizeName(String(row[toCol!] || ''));
    if (!from || !to) continue;

    const conn = connCol ? normalizeName(String(row[connCol] || '')) : undefined;
    const state = stateCol ? String(row[stateCol!] || '').trim() : undefined;
    const current = currentCol ? parseFloatValue(row[currentCol!]) : null;
    const power = powerCol ? parseFloatValue(row[powerCol!]) : null;
    const location = locationCol ? String(row[locationCol!] || '').trim() || null : null;
    const explicitParentFrom = parentCol ? normalizeName(String(row[parentCol!] || '').trim()) : null;

    const fromType = detectElementType(from);
    const toType = detectElementType(to);

    if (!elementsMap.has(from)) {
      elementsMap.set(from, { name: from, type: fromType, state, current, power: null, location, explicitParent: explicitParentFrom || null });
    } else {
      const e = elementsMap.get(from)!;
      if (current !== null && e.current === null) e.current = current;
      if (location && !e.location) e.location = location;
      if (explicitParentFrom && !e.explicitParent) e.explicitParent = explicitParentFrom;
    }

    if (!elementsMap.has(to)) {
      elementsMap.set(to, { name: to, type: toType, state, current: null, power: toType === 'load' ? power : null, location, explicitParent: null });
    } else {
      const e = elementsMap.get(to)!;
      if (toType === 'load' && power !== null && e.power === null) e.power = power;
      if (location && !e.location) e.location = location;
    }

    connectionsData.push({ from, to, conn, order: i + 1 });
  }

  console.log(`📦 Элементов: ${elementsMap.size}, связей: ${connectionsData.length}`);

  // Извлечение Cabinet
  for (const [id, info] of elementsMap) {
    const cab = extractCabinet(info.name, info.type);
    if (cab && !elementsMap.has(cab)) elementsMap.set(cab, { name: cab, type: 'cabinet' });
  }

  // Статистика типов
  const stats = new Map<string, number>();
  for (const e of elementsMap.values()) stats.set(e.type, (stats.get(e.type) || 0) + 1);
  console.log('📊 Типы:', Object.fromEntries(stats));

  // ParentId карта
  const parentMap = new Map<string, string>();
  let explicitCount = 0;
  let calculatedCount = 0;
  for (const [id, info] of elementsMap) {
    if (info.explicitParent) {
      parentMap.set(id, info.explicitParent);
      explicitCount++;
      if (!elementsMap.has(info.explicitParent)) {
        elementsMap.set(info.explicitParent, { name: info.explicitParent, type: 'cabinet' });
      }
    } else {
      const p = extractCabinet(info.name, info.type);
      if (p) {
        parentMap.set(id, p);
        calculatedCount++;
      }
    }
  }
  console.log(`✅ ParentId: ${explicitCount} явных, ${calculatedCount} вычисленных, всего: ${parentMap.size}`);

  // Импорт элементов
  console.log('\n=== ИМПОРТ ЭЛЕМЕНТОВ ===');
  const elementIdToDbId = new Map<string, string>();
  const now = Date.now();

  // Кабинеты
  const cabinetData = [];
  for (const [elementId, info] of elementsMap) {
    if (info.type !== 'cabinet') continue;
    const dbId = `el_${now}_${Math.random().toString(36).substr(2, 9)}`;
    elementIdToDbId.set(elementId, dbId);
    cabinetData.push({
      id: dbId, elementId, name: info.name, type: info.type, voltageLevel: 0.4,
      operationalStatus: parseOperationalStatus(info.state), electricalStatus: 'DEAD',
      parentId: null, updatedAt: new Date(),
    });
  }
  await prisma.element.createMany({ data: cabinetData });
  console.log(`   Cabinet: ${cabinetData.length}`);

  // Остальные
  const otherData = [];
  for (const [elementId, info] of elementsMap) {
    if (info.type === 'cabinet') continue;
    const dbId = `el_${now}_${Math.random().toString(36).substr(2, 9)}`;
    elementIdToDbId.set(elementId, dbId);
    const parentEl = parentMap.get(elementId);
    const parentDb = parentEl ? elementIdToDbId.get(parentEl) : null;
    otherData.push({
      id: dbId, elementId, name: info.name, type: info.type, voltageLevel: 0.4,
      operationalStatus: parseOperationalStatus(info.state), electricalStatus: 'DEAD',
      parentId: parentDb || null, updatedAt: new Date(),
    });
  }
  await prisma.element.createMany({ data: otherData });
  console.log(`   Остальные: ${otherData.length}`);

  // Импорт связей
  console.log('\n=== ИМПОРТ СВЯЗЕЙ ===');
  const connectionData = [];
  for (const c of connectionsData) {
    const src = elementIdToDbId.get(c.from);
    const tgt = elementIdToDbId.get(c.to);
    if (!src || !tgt) continue;
    connectionData.push({
      id: `conn_${now}_${Math.random().toString(36).substr(2, 9)}`,
      sourceId: src, targetId: tgt,
      order: c.order, operationalStatus: 'ON', electricalStatus: 'DEAD',
    });
  }
  await prisma.connection.createMany({ data: connectionData });
  console.log(`   Связи: ${connectionData.length}`);

  // === ИМПОРТ АВР ===
  console.log('\n=== ИМПОРТ АВР ===');
  
  // Лист AVR
  if (workbook.SheetNames.includes('AVR')) {
    const avrSheet = workbook.Sheets['AVR'];
    const avrRawData = xlsx.utils.sheet_to_json<Record<string, unknown>>(avrSheet);
    console.log(`   Лист AVR: ${avrRawData.length} записей`);

    for (const row of avrRawData) {
      const avrId = String(row['id'] || row['ID'] || '');
      const name = String(row['name'] || row['название'] || '');
      const description = String(row['description'] || row['описание'] || '');
      const mode = String(row['mode'] || row['режим'] || 'AUTO').toUpperCase();
      const delay = parseFloatValue(row['delay_sec'] || row['задержка'] || 0.5) || 0.5;

      if (!avrId || !name) continue;

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
    }
  }

  // Лист AVR_Inputs
  if (workbook.SheetNames.includes('AVR_Inputs')) {
    const inputsSheet = workbook.Sheets['AVR_Inputs'];
    const inputsRawData = xlsx.utils.sheet_to_json<Record<string, unknown>>(inputsSheet);
    console.log(`   Лист AVR_Inputs: ${inputsRawData.length} записей`);

    for (const row of inputsRawData) {
      const avrId = String(row['avr_id'] || row['avr'] || '');
      const elementName = normalizeName(String(row['element'] || row['элемент'] || ''));
      const role = String(row['role'] || row['роль'] || 'RESERVE').toUpperCase();
      const priority = parseInt(String(row['priority'] || row['приоритет'] || '99'));
      const signalType = String(row['signal'] || row['сигнал'] || 'ELECTRICAL').toUpperCase();

      if (!avrId || !elementName) continue;

      const element = await prisma.element.findFirst({ where: { name: elementName } });
      if (!element) {
        console.log(`   ⚠️ Элемент не найден: ${elementName}`);
        continue;
      }

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
    }
  }

  // Лист AVR_Outputs
  if (workbook.SheetNames.includes('AVR_Outputs')) {
    const outputsSheet = workbook.Sheets['AVR_Outputs'];
    const outputsRawData = xlsx.utils.sheet_to_json<Record<string, unknown>>(outputsSheet);
    console.log(`   Лист AVR_Outputs: ${outputsRawData.length} записей`);

    for (const row of outputsRawData) {
      const avrId = String(row['avr_id'] || row['avr'] || '');
      const elementName = normalizeName(String(row['element'] || row['элемент'] || ''));
      const role = String(row['role'] || row['роль'] || 'BREAKER').toUpperCase();
      const actionOn = String(row['action_on'] || row['вкл'] || 'CLOSE');
      const actionOff = String(row['action_off'] || row['откл'] || 'OPEN');

      if (!avrId || !elementName) continue;

      const element = await prisma.element.findFirst({ where: { name: elementName } });
      if (!element) {
        console.log(`   ⚠️ Элемент не найден: ${elementName}`);
        continue;
      }

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
    }
  }

  // Итоги
  const total = await prisma.element.count();
  const conns = await prisma.connection.count();
  const cabinets = await prisma.element.count({ where: { type: 'cabinet' } });
  const withParent = await prisma.element.count({ where: { parentId: { not: null } } });
  const avrCount = await prisma.aVR.count();
  const avrInputs = await prisma.aVRInput.count();
  const avrOutputs = await prisma.aVROutput.count();

  console.log('\n=== ИМПОРТ ЗАВЕРШЁН ===');
  console.log(`📊 Элементов: ${total}, Cabinet: ${cabinets}, с parentId: ${withParent}, связей: ${conns}`);
  console.log(`📊 АВР: ${avrCount}, входов: ${avrInputs}, выходов: ${avrOutputs}`);

  await prisma.$disconnect();
  return { success: true, elements: total, connections: conns, cabinets, avrCount, avrInputs, avrOutputs };
}

if (require.main === module) {
  importNetwork().catch(e => { console.error('❌ Ошибка:', e); process.exit(1); });
}

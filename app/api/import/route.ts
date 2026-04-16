import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as xlsx from 'xlsx';
import { propagateStates } from '@/lib/services/state-propagation.service';
import type { OperationalStatus } from '@/types';

/**
 * Парсит оперативный статус из значения state
 * OFF: "off", "выкл", "0", "false", "Отключен"
 * ON: все остальные значения
 */
function parseOperationalStatus(stateValue: string | undefined | null): OperationalStatus {
  if (!stateValue) return 'ON';

  const state = String(stateValue).toLowerCase().trim();

  if (/off/.test(state) ||
      /выкл/.test(state) ||
      state === '0' ||
      /false/.test(state) ||
      /отключен/.test(state)) {
    return 'OFF';
  }

  return 'ON';
}

/**
 * Очищает базу данных перед импортом
 * Удаляет все данные в правильном порядке (с учётом foreign keys)
 */
async function clearDatabase() {
  console.log('[import] Очистка базы данных...');

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

  console.log('[import] База данных очищена');
}

export async function POST(request: Request) {
  try {
    // Очистка базы перед импортом
    await clearDatabase();

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: 'buffer' });

    let imported = 0;
    let errors = 0;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet);

      for (const row of data) {
        try {
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
          
          // Определение типа элемента
          const elementId = normalizeName(String(row['ID'] || row['id'] || row['Элемент'] || ''));
          const name = normalizeName(String(row['Название'] || row['Name'] || row['name'] || elementId));
          const typeRaw = String(row['Тип'] || row['Type'] || row['type'] || 'junction').toLowerCase();
          const stateValue = row['state'] || row['State'] || row['Состояние'] || row['Статус'] || '';

          let type = 'junction';
          if (typeRaw.includes('source') || typeRaw.includes('источник') || typeRaw.includes('тп') || typeRaw.includes('трансформатор')) {
            type = 'source';
          } else if (typeRaw.includes('bus') || typeRaw.includes('шина') || typeRaw.includes('сборка')) {
            type = 'bus';
          } else if (typeRaw.includes('breaker') || typeRaw.includes('автомат') || typeRaw.includes('выключатель')) {
            type = 'breaker';
          } else if (typeRaw.includes('meter') || typeRaw.includes('счетчик') || typeRaw.includes('учет')) {
            type = 'meter';
          } else if (typeRaw.includes('load') || typeRaw.includes('нагрузка') || typeRaw.includes('потребитель')) {
            type = 'load';
          }

          if (!elementId) continue;

          const operationalStatus = parseOperationalStatus(String(stateValue));

          // Создание элемента (нормализованный elementId)
          await prisma.element.upsert({
            where: { elementId },
            create: {
              id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              elementId,
              name,
              type,
              voltageLevel: parseFloat(String(row['Напряжение'] || row['U'] || '0.4')) || 0.4,
              operationalStatus,
              electricalStatus: 'DEAD',
              updatedAt: new Date()
            },
            update: {
              name,
              type,
              operationalStatus,
              updatedAt: new Date()
            }
          });

          // Если есть мощность - создаем нагрузку
          const power = parseFloat(String(row['Мощность'] || row['Power'] || row['P'] || '0'));
          if (power > 0 && type === 'load') {
            const element = await prisma.element.findUnique({ where: { elementId } });
            if (element) {
              const slot = await prisma.deviceSlot.create({
                data: {
                  id: `slot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  slotId: `SLOT_${elementId}`,
                  elementId: element.id,
                  slotType: 'load'
                }
              });

              const device = await prisma.device.create({
                data: {
                  id: `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  deviceId: `DEV_L${String(imported).padStart(3, '0')}`,
                  slotId: slot.id,
                  deviceType: 'load',
                  updatedAt: new Date()
                }
              });

              await prisma.load.create({
                data: {
                  id: `load_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  deviceId: device.id,
                  name: name,
                  powerP: power,
                  powerQ: power * 0.33,
                  category: parseInt(String(row['Категория'] || '3')),
                  updatedAt: new Date()
                }
              });
            }
          }

          imported++;
        } catch (e) {
          errors++;
          console.error('Import row error:', e);
        }
      }
    }

    // После импорта распространяем состояния
    console.log('[import] Запуск propagateStates...');
    const propagationResult = await propagateStates();
    console.log('[import] propagateStates завершен:', propagationResult);

    return NextResponse.json({
      imported,
      errors,
      total: imported + errors,
      propagation: propagationResult
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 });
  }
}

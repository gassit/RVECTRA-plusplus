import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as xlsx from 'xlsx';

export async function POST(request: Request) {
  try {
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
          // Определение типа элемента
          const elementId = String(row['ID'] || row['id'] || row['Элемент'] || '');
          const name = String(row['Название'] || row['Name'] || row['name'] || elementId);
          const typeRaw = String(row['Тип'] || row['Type'] || row['type'] || 'junction').toLowerCase();
          
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

          // Создание элемента
          await prisma.element.upsert({
            where: { elementId },
            create: {
              elementId,
              name,
              type,
              voltageLevel: parseFloat(String(row['Напряжение'] || row['U'] || '0.4')) || 0.4
            },
            update: {
              name,
              type
            }
          });

          // Если есть мощность - создаем нагрузку
          const power = parseFloat(String(row['Мощность'] || row['Power'] || row['P'] || '0'));
          if (power > 0 && type === 'load') {
            const element = await prisma.element.findUnique({ where: { elementId } });
            if (element) {
              const slot = await prisma.deviceSlot.create({
                data: {
                  slotId: `SLOT_${elementId}`,
                  elementId: element.id,
                  slotType: 'load'
                }
              });
              
              const device = await prisma.device.create({
                data: {
                  deviceId: `DEV_L${String(imported).padStart(3, '0')}`,
                  slotId: slot.id,
                  deviceType: 'load'
                }
              });

              await prisma.load.create({
                data: {
                  deviceId: device.id,
                  name: name,
                  powerP: power,
                  powerQ: power * 0.33, // cos phi ~ 0.95
                  category: parseInt(String(row['Категория'] || '3'))
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

    return NextResponse.json({ imported, errors, total: imported + errors });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 });
  }
}

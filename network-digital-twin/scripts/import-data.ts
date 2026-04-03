import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import * as xlsx from 'xlsx';

const adapter = new PrismaLibSql({
  url: 'file:/home/z/my-project/db/custom.db'
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const workbook = xlsx.readFile('/home/z/my-project/upload/input.xlsx');
  
  let imported = 0;
  let connections = 0;

  // Обработка листа Networkall - связи между элементами
  console.log('Обработка листа: Networkall');
  const networkSheet = workbook.Sheets['Networkall'];
  const networkData = xlsx.utils.sheet_to_json<Record<string, unknown>>(networkSheet);
  
  // Сбор уникальных элементов
  const elementsMap = new Map<string, { name: string; type: string }>();
  
  for (const row of networkData) {
    const from = String(row['from'] || '');
    const to = String(row['to'] || '');
    const connectionType = String(row['Connection'] || 'junction');
    
    if (from) {
      // Определяем тип элемента по названию
      let fromType = 'junction';
      const fromLower = from.toLowerCase();
      
      if (fromLower.includes('тп') && !fromLower.includes('автомат') && !fromLower.includes('qf')) {
        fromType = 'source';
      } else if (fromLower.includes('шина') || fromLower.includes('сборка')) {
        fromType = 'bus';
      } else if (fromLower.includes('qf') || fromLower.includes('автомат') || fromLower.includes('вв')) {
        fromType = 'breaker';
      } else if (fromLower.includes('счетчик') || fromLower.includes('счётчик') || fromLower.includes('пум')) {
        fromType = 'meter';
      } else if (fromLower.includes('нагрузка') || fromLower.includes('эпу')) {
        fromType = 'load';
      }
      
      if (!elementsMap.has(from)) {
        elementsMap.set(from, { name: from, type: fromType });
      }
    }
    
    if (to) {
      // Определяем тип элемента по названию
      let toType = 'junction';
      const toLower = to.toLowerCase();
      
      if (toLower.includes('тп') && !toLower.includes('автомат') && !toLower.includes('qf')) {
        toType = 'source';
      } else if (toLower.includes('шина') || toLower.includes('сборка')) {
        toType = 'bus';
      } else if (toLower.includes('qf') || toLower.includes('автомат') || toLower.includes('вв')) {
        toType = 'breaker';
      } else if (toLower.includes('счетчик') || toLower.includes('счётчик') || toLower.includes('пум')) {
        toType = 'meter';
      } else if (toLower.includes('нагрузка') || toLower.includes('эпу')) {
        toType = 'load';
      }
      
      if (!elementsMap.has(to)) {
        elementsMap.set(to, { name: to, type: toType });
      }
    }
  }
  
  console.log(`Найдено уникальных элементов: ${elementsMap.size}`);
  
  // Создаём элементы
  for (const [elementId, info] of elementsMap) {
    try {
      await prisma.element.upsert({
        where: { elementId },
        create: {
          elementId,
          name: info.name,
          type: info.type,
          voltageLevel: 0.4
        },
        update: {
          name: info.name,
          type: info.type
        }
      });
      imported++;
    } catch (e) {
      console.error('Ошибка создания элемента:', elementId, e);
    }
  }
  
  console.log(`Создано элементов: ${imported}`);
  
  // Создаём связи
  for (const row of networkData) {
    const from = String(row['from'] || '');
    const to = String(row['to'] || '');
    
    if (!from || !to) continue;
    
    try {
      const sourceElement = await prisma.element.findUnique({ where: { elementId: from } });
      const targetElement = await prisma.element.findUnique({ where: { elementId: to } });
      
      if (sourceElement && targetElement) {
        await prisma.connection.create({
          data: {
            sourceId: sourceElement.id,
            targetId: targetElement.id
          }
        });
        connections++;
      }
    } catch (e) {
      // Связь уже существует или другая ошибка
    }
  }
  
  console.log(`Создано связей: ${connections}`);
  
  // Импорт справочника кабелей
  console.log('\nОбработка листа: directory_connection');
  const cableSheet = workbook.Sheets['directory_connection'];
  const cableData = xlsx.utils.sheet_to_json<Record<string, unknown>>(cableSheet);
  
  let cablesImported = 0;
  for (const row of cableData) {
    try {
      const mark = String(row['Марка, тип'] || '');
      const section = parseFloat(String(row['сечение'] || '0'));
      const cores = parseInt(String(row['кол-во жил'] || '3'));
      const iDop = parseFloat(String(row['ток, А'] || '0'));
      const power = parseFloat(String(row['мощность, кВт'] || '0'));
      const material = String(row['Материал'] || 'Медь').toLowerCase().includes('алюминий') ? 'aluminum' : 'copper';
      const voltage = parseFloat(String(row['Напряжение'] || '380')) / 1000;
      
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
            x0: 0.08
          },
          update: {
            iDop,
            material
          }
        });
        cablesImported++;
      }
    } catch (e) {
      console.error('Ошибка импорта кабеля:', e);
    }
  }
  
  console.log(`Импортировано кабелей: ${cablesImported}`);
  
  console.log('\nИмпорт завершён!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

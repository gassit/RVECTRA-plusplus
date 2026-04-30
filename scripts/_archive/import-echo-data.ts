import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import * as XLSX from 'xlsx';
import * as path from 'path';

const adapter = new PrismaLibSql({
  url: `file:${process.cwd()}/db/custom.db`
});

const prisma = new PrismaClient({ adapter });

interface NetworkRow {
  id: number;
  state: string;
  from: string;
  connection: string;
  to: string;
  protection: string;
  avr: string;
  avrState: string;
  location: string;
  assemblyFrom: string;
}

// Определение типа элемента по названию
function detectElementType(name: string): string {
  if (!name) return 'junction';
  
  const n = name.toLowerCase();
  
  // Источник питания (проверяем первым)
  if (n.includes('тп') && (n.includes('т1') || n.includes('т2') || n.includes('трансформатор'))) {
    return 'source';
  }
  if (n.includes('дгу') || n.includes('генератор')) {
    return 'source';
  }
  
  // Автомат/выключатель (QF - проверяем ДО шины!)
  if (n.includes('qf') || n.includes('автомат') || n.includes('выключатель')) {
    return 'breaker';
  }
  
  // Разъединитель (QS)
  if (n.includes('qs') || n.includes('разъединитель')) {
    return 'breaker';
  }
  
  // Счётчик/УЗУ
  if (n.includes('счётчик') || n.includes('счетчик') || n.includes('узуч') || n.includes('art-') || n.includes('pqrs')) {
    return 'meter';
  }
  
  // Шина (проверяем ПОСЛЕ QF/QS!)
  if (n.includes('шина') || n.includes('с.ш.') || n.includes('сб.ш.') || n.includes('шинопровод')) {
    return 'bus';
  }
  
  // Нагрузка
  if (n.includes('щр') || n.includes('вру') || n.includes('щита') || n.includes('щит') || n.includes('нагрузк')) {
    return 'load';
  }
  
  // Точка распределения - junction
  if (n.includes('точрасп') || n.includes('узел')) {
    return 'junction';
  }
  
  return 'junction';
}

// Определение состояния элемента
function detectState(state: string): string {
  if (!state) return 'unknown';
  
  const s = state.toLowerCase();
  
  if (s.includes('включен')) return 'on';
  if (s.includes('отключен')) return 'off';
  if (s.includes('под напряжением')) return 'energized';
  if (s.includes('резерв')) return 'reserve';
  if (s.includes('холодный')) return 'cold_reserve';
  
  return 'unknown';
}

async function importData() {
  console.log('=== Импорт данных из ЭХОмини.v1.xlsx ===\n');
  
  // Читаем Excel файл
  const filePath = path.join(process.cwd(), 'upload/ЭХОмини.v1.xlsx');
  const workbook = XLSX.readFile(filePath);
  
  // Читаем лист Networkall
  const sheetName = 'Networkall';
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log(`Прочитано ${rawData.length} строк из листа ${sheetName}`);
  
  // Парсим данные (первая строка - заголовки)
  const headers = rawData[0] as string[];
  const rows: NetworkRow[] = [];
  
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i] as any[];
    if (!row || row.length === 0) continue;
    
    const id = parseInt(row[0]) || 0;
    if (id === 0) continue; // Пропускаем пустые строки
    
    rows.push({
      id,
      state: row[1]?.toString() || '',
      from: row[2]?.toString() || '',
      connection: row[3]?.toString() || '',
      to: row[4]?.toString() || '',
      protection: row[5]?.toString() || '',
      avr: row[6]?.toString() || '',
      avrState: row[7]?.toString() || '',
      location: row[8]?.toString() || '',
      assemblyFrom: row[9]?.toString() || '',
    });
  }
  
  console.log(`Обработано ${rows.length} записей сети\n`);
  
  // Собираем уникальные элементы
  const elementsMap = new Map<string, {
    elementId: string;
    name: string;
    type: string;
    state: string;
    location: string;
  }>();
  
  // Добавляем элементы from и to
  rows.forEach(row => {
    // From элемент
    if (row.from && !elementsMap.has(row.from)) {
      elementsMap.set(row.from, {
        elementId: row.from,
        name: row.from,
        type: detectElementType(row.from),
        state: detectState(row.state),
        location: row.assemblyFrom || row.location || '',
      });
    }
    
    // To элемент
    if (row.to && !elementsMap.has(row.to)) {
      elementsMap.set(row.to, {
        elementId: row.to,
        name: row.to,
        type: detectElementType(row.to),
        state: 'unknown',
        location: row.location || '',
      });
    }
  });
  
  console.log(`Найдено ${elementsMap.size} уникальных элементов`);
  
  // Статистика по типам
  const typeStats = new Map<string, number>();
  elementsMap.forEach(el => {
    const count = typeStats.get(el.type) || 0;
    typeStats.set(el.type, count + 1);
  });
  console.log('\nСтатистика по типам:');
  typeStats.forEach((count, type) => {
    console.log(`  ${type}: ${count}`);
  });
  
  // Очищаем старые данные
  console.log('\nОчистка старых данных...');
  await prisma.connection.deleteMany();
  await prisma.element.deleteMany();
  
  // Импортируем элементы
  console.log('\nИмпорт элементов...');
  let importedElements = 0;
  
  for (const [id, el] of elementsMap) {
    try {
      await prisma.element.create({
        data: {
          elementId: el.elementId,
          name: el.name,
          type: el.type,
          voltageLevel: null,
          posX: null,
          posY: null,
        }
      });
      importedElements++;
    } catch (error) {
      console.log(`Ошибка импорта элемента ${el.elementId}: ${error}`);
    }
  }
  
  console.log(`Импортировано ${importedElements} элементов`);
  
  // Получаем ID элементов для связей
  const dbElements = await prisma.element.findMany();
  const elementIdMap = new Map(dbElements.map(e => [e.elementId, e.id]));
  
  // Импортируем связи
  console.log('\nИмпорт связей...');
  let importedConnections = 0;
  
  for (const row of rows) {
    if (!row.from || !row.to) continue;
    
    const sourceDbId = elementIdMap.get(row.from);
    const targetDbId = elementIdMap.get(row.to);
    
    if (!sourceDbId || !targetDbId) {
      console.log(`Пропуск связи: ${row.from} -> ${row.to} (элемент не найден)`);
      continue;
    }
    
    try {
      // Создаём кабель если есть информация о соединении
      let cableId: string | null = null;
      if (row.connection && row.connection !== 'шина' && row.connection !== 'Шина') {
        const cable = await prisma.cable.create({
          data: {
            cableId: `CABLE-${row.id}`,
            name: row.connection,
            length: 0,
            section: 0,
            material: 'copper',
          }
        });
        cableId = cable.id;
      }
      
      await prisma.connection.create({
        data: {
          sourceId: sourceDbId,
          targetId: targetDbId,
          cableId: cableId,
          order: row.id,
        }
      });
      importedConnections++;
    } catch (error) {
      console.log(`Ошибка импорта связи ${row.from} -> ${row.to}: ${error}`);
    }
  }
  
  console.log(`Импортировано ${importedConnections} связей`);
  
  // Итоговая статистика
  const finalElements = await prisma.element.count();
  const finalConnections = await prisma.connection.count();
  
  console.log('\n=== Импорт завершён ===');
  console.log(`Элементов в БД: ${finalElements}`);
  console.log(`Связей в БД: ${finalConnections}`);
  
  await prisma.$disconnect();
}

importData().catch(console.error);

import * as xlsx from 'xlsx';
import * as path from 'path';

const workbook = xlsx.readFile(path.join(process.cwd(), 'upload/input.xlsx'));

for (const sheetName of workbook.SheetNames) {
  console.log(`\n=== Лист: ${sheetName} ===`);
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet);

  if (data.length > 0) {
    console.log('Колонки:', Object.keys(data[0]));
    console.log('Пример строки:', JSON.stringify(data[0], null, 2));
    console.log('Количество строк:', data.length);
  }
}

import { NextResponse } from 'next/server';
import { importFromExcel } from '@/lib/services/import.service';

/**
 * POST /api/import
 * Запуск импорта данных из Excel (файл задаётся в import.service.ts)
 */
export async function POST() {
  try {
    const result = await importFromExcel();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Import API error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to import', imported: { elements: 0, devices: 0, connections: 0 }, errors: [String(error)] },
      { status: 500 }
    );
  }
}

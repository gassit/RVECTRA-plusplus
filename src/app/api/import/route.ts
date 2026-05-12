import { NextResponse } from 'next/server';
import { importFromExcel } from '@/lib/services/import.service';

export async function GET() {
  try {
    console.log('[import] Starting import via GET...');
    const result = await importFromExcel();
    console.log('[import] Import completed:', result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Import API error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Ошибка импорта',
        imported: { elements: 0, devices: 0, connections: 0 },
        errors: [error instanceof Error ? error.message : String(error)],
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  // Delegate to GET for simplicity
  return GET();
}

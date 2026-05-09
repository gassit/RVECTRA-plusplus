import { NextResponse } from 'next/server';
import { importFromExcel } from '@/lib/services/import.service';

export async function POST() {
  try {
    const result = await importFromExcel();
    
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

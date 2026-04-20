import { NextResponse } from 'next/server';
import { getReferencesData } from '@/lib/data/references';

export async function GET() {
  try {
    const references = getReferencesData();
    return NextResponse.json(references);
  } catch (error) {
    console.error('References GET error:', error);
    return NextResponse.json(
      { error: 'Ошибка получения справочников' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { runValidation, getValidationIssues, getValidationStats } from '@/lib/services/validation.service';

// GET - получить список проблем
export async function GET() {
  try {
    const issues = await getValidationIssues();
    return NextResponse.json(issues);
  } catch (error) {
    console.error('Validation GET error:', error);
    return NextResponse.json(
      { error: 'Ошибка получения результатов валидации' },
      { status: 500 }
    );
  }
}

// POST - запустить валидацию
export async function POST() {
  try {
    const results = await runValidation();
    const stats = await getValidationStats();
    
    return NextResponse.json({
      success: true,
      message: `Валидация завершена. Найдено проблем: ${results.length}`,
      stats,
      results,
    });
  } catch (error) {
    console.error('Validation POST error:', error);
    return NextResponse.json(
      { error: 'Ошибка валидации' },
      { status: 500 }
    );
  }
}

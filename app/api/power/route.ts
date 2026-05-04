/**
 * API для расчёта мощностей
 * POST /api/power - запустить расчёт
 */

import { NextResponse } from 'next/server';
import { calculatePower } from '@/lib/power';

export async function POST() {
  try {
    const result = await calculatePower();

    return NextResponse.json({
      success: true,
      data: result,
      message: `Рассчитано мощностей для ${result.elementsUpdated} элементов. ` +
               `ΣPуст = ${result.totalPInstalled.toFixed(2)} кВт, ` +
               `ΣPрасч = ${result.totalPCalculated.toFixed(2)} кВт`,
    });
  } catch (error) {
    console.error('Error calculating power:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при расчёте мощностей' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await calculatePower();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error calculating power:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при расчёте мощностей' },
      { status: 500 }
    );
  }
}

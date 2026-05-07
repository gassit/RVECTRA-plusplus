/**
 * API для расчёта мощностей и потерь напряжения
 * POST /api/power - запустить расчёт
 */

import { NextResponse } from 'next/server';
import { calculatePower } from '@/lib/power';
import { calculateVoltageDropAll } from '@/lib/voltageDropCalc';

export async function POST() {
  try {
    // 1. Расчёт мощностей
    const powerResult = await calculatePower();

    // 2. Расчёт потерь напряжения
    const voltageDropResult = await calculateVoltageDropAll();

    return NextResponse.json({
      success: true,
      data: {
        power: powerResult,
        voltageDrop: voltageDropResult,
      },
      message: `Мощности: ${powerResult.elementsUpdated} элем., ΣPуст=${powerResult.totalPInstalled.toFixed(1)} кВт, ΣPрасч=${powerResult.totalPCalculated.toFixed(1)} кВт. ` +
               `ΔU: ${voltageDropResult.connectionsUpdated} связей, max=${voltageDropResult.maxVoltageDrop.toFixed(2)}%`,
    });
  } catch (error) {
    console.error('Error calculating power:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при расчёте' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const powerResult = await calculatePower();
    const voltageDropResult = await calculateVoltageDropAll();

    return NextResponse.json({
      success: true,
      data: {
        power: powerResult,
        voltageDrop: voltageDropResult,
      },
    });
  } catch (error) {
    console.error('Error calculating power:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при расчёте' },
      { status: 500 }
    );
  }
}

// ============================================================================
// API УПРАВЛЕНИЯ НАГРУЗКАМИ (LOAD)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculatePower } from '@/lib/power';

// ============================================================================
// GET - Получить нагрузку по ID элемента
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const elementId = searchParams.get('elementId');

    if (!elementId) {
      return NextResponse.json(
        { success: false, error: 'elementId обязателен' },
        { status: 400 }
      );
    }

    // Находим нагрузку через Element -> DeviceSlot -> Device -> Load
    const element = await prisma.element.findUnique({
      where: { id: elementId },
      include: {
        DeviceSlot: {
          include: {
            Device: {
              include: { Load: true }
            }
          }
        }
      }
    });

    if (!element) {
      return NextResponse.json(
        { success: false, error: 'Элемент не найден' },
        { status: 404 }
      );
    }

    const load = element.DeviceSlot?.[0]?.Device?.[0]?.Load;

    if (!load) {
      return NextResponse.json(
        { success: false, error: 'Нагрузка не найдена' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: load,
    });
  } catch (error) {
    console.error('Error getting load:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при получении нагрузки' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Обновить параметры нагрузки
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { elementId, powerP, powerQ, cosPhi, usageFactor, name } = body;

    if (!elementId) {
      return NextResponse.json(
        { success: false, error: 'elementId обязателен' },
        { status: 400 }
      );
    }

    // Находим нагрузку через Element -> DeviceSlot -> Device -> Load
    const element = await prisma.element.findUnique({
      where: { id: elementId },
      include: {
        DeviceSlot: {
          include: {
            Device: {
              include: { Load: true }
            }
          }
        }
      }
    });

    if (!element) {
      return NextResponse.json(
        { success: false, error: 'Элемент не найден' },
        { status: 404 }
      );
    }

    const load = element.DeviceSlot?.[0]?.Device?.[0]?.Load;

    if (!load) {
      return NextResponse.json(
        { success: false, error: 'Нагрузка не найдена для этого элемента' },
        { status: 404 }
      );
    }

    // Проверяем, изменились ли параметры мощности
    const oldPowerP = load.powerP;
    const oldUsageFactor = load.usageFactor;
    const powerChanged = powerP !== undefined && powerP !== oldPowerP;
    const usageFactorChanged = usageFactor !== undefined && usageFactor !== oldUsageFactor;

    // Обновляем нагрузку
    const updatedLoad = await prisma.load.update({
      where: { id: load.id },
      data: {
        ...(name !== undefined && { name }),
        ...(powerP !== undefined && { powerP }),
        ...(powerQ !== undefined && { powerQ }),
        ...(cosPhi !== undefined && { cosPhi }),
        ...(usageFactor !== undefined && { usageFactor }),
        updatedAt: new Date(),
      },
    });

    // Если изменились параметры мощности - пересчитываем
    if (powerChanged || usageFactorChanged) {
      console.log(`Load power changed for element ${elementId}, recalculating power...`);
      await calculatePower();
    }

    return NextResponse.json({
      success: true,
      data: updatedLoad,
      message: 'Нагрузка обновлена',
    });
  } catch (error) {
    console.error('Error updating load:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при обновлении нагрузки' },
      { status: 500 }
    );
  }
}

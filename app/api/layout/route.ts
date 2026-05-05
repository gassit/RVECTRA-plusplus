/**
 * API для автоматического расчёта позиций элементов (layout)
 * POST /api/layout - сбросить координаты (G6 сам расставит через dagre)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Сбросить координаты всех элементов
 * G6 автоматически применит dagre layout при загрузке данных
 */
export async function POST() {
  try {
    // Получаем количество элементов
    const count = await prisma.element.count();

    // Обнуляем координаты всех элементов
    // G6 dagre layout автоматически расставит их при загрузке
    const result = await prisma.element.updateMany({
      data: {
        posX: null,
        posY: null,
        updatedAt: new Date()
      }
    });

    console.log(`Layout reset: cleared coordinates for ${result.count} elements`);

    return NextResponse.json({
      success: true,
      message: `Координаты сброшены для ${result.count} элементов. G6 автоматически расставит их.`,
      data: {
        elementsUpdated: result.count,
        totalElements: count
      }
    });
  } catch (error) {
    console.error('Error resetting layout:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при сбросе координат' },
      { status: 500 }
    );
  }
}

/**
 * GET - получить текущие позиции элементов
 */
export async function GET() {
  try {
    const elements = await prisma.element.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        posX: true,
        posY: true
      }
    });

    const withPositions = elements.filter(e => e.posX !== null && e.posY !== null);
    const withoutPositions = elements.filter(e => e.posX === null || e.posY === null);

    return NextResponse.json({
      success: true,
      data: {
        total: elements.length,
        positioned: withPositions.length,
        notPositioned: withoutPositions.length,
        elements: elements.map(e => ({
          id: e.id,
          name: e.name,
          type: e.type,
          x: e.posX,
          y: e.posY
        }))
      }
    });
  } catch (error) {
    console.error('Error getting layout:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при получении layout' },
      { status: 500 }
    );
  }
}

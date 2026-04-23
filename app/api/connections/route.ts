// ============================================================================
// API УПРАВЛЕНИЯ СВЯЗЯМИ (КАБЕЛЯМИ)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateId, generateUUID } from '@/lib/utils/id-generator';

// ============================================================================
// ТИПЫ
// ============================================================================

interface CreateConnectionRequest {
  sourceId: string;
  targetId: string;
  wireType?: string;
  wireSize?: number;
  material?: string;
  length?: number;
  core?: string;
}

// ============================================================================
// GET - Получить все связи
// ============================================================================

export async function GET() {
  try {
    const connections = await prisma.connection.findMany({
      include: {
        Cable: true,
        Element_Connection_sourceIdToElement: {
          select: { id: true, name: true, type: true },
        },
        Element_Connection_targetIdToElement: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: connections,
    });
  } catch (error) {
    console.error('Error fetching connections:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при получении связей' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Создать связь
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: CreateConnectionRequest = await request.json();
    const { sourceId, targetId, wireType, wireSize, material, length, core } = body;

    // Валидация
    if (!sourceId || !targetId) {
      return NextResponse.json(
        { success: false, error: 'sourceId и targetId обязательны' },
        { status: 400 }
      );
    }

    // Проверяем существование элементов
    const sourceElement = await prisma.element.findUnique({
      where: { id: sourceId },
    });
    const targetElement = await prisma.element.findUnique({
      where: { id: targetId },
    });

    if (!sourceElement || !targetElement) {
      return NextResponse.json(
        { success: false, error: 'Один или оба элемента не найдены' },
        { status: 404 }
      );
    }

    // Проверяем, нет ли уже такой связи
    const existingConnection = await prisma.connection.findFirst({
      where: {
        OR: [
          { sourceId, targetId },
          { sourceId: targetId, targetId: sourceId },
        ],
      },
    });

    if (existingConnection) {
      return NextResponse.json(
        { success: false, error: 'Связь между этими элементами уже существует' },
        { status: 400 }
      );
    }

    // Создаём кабель если указаны параметры
    let cableId: string | null = null;
    if (wireType && wireSize && length) {
      const cableIdStr = generateId('CABLE');
      const cable = await prisma.cable.create({
        data: {
          id: generateUUID(),
          cableId: cableIdStr,
          name: `${wireType} ${wireSize}мм² ${length}м`,
          length,
          section: wireSize,
          material: material || 'copper',
          updatedAt: new Date(),
        },
      });
      cableId = cable.id;
    }

    // Создаём связь
    const connection = await prisma.connection.create({
      data: {
        id: generateUUID(),
        sourceId,
        targetId,
        cableId,
        electricalStatus: 'DEAD',
        operationalStatus: 'ON',
      },
      include: {
        Cable: true,
        Element_Connection_sourceIdToElement: {
          select: { id: true, name: true, type: true },
        },
        Element_Connection_targetIdToElement: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: connection,
      message: 'Связь успешно создана',
    });
  } catch (error) {
    console.error('Error creating connection:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при создании связи' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Удалить связь
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID связи обязателен' },
        { status: 400 }
      );
    }

    // Получаем связь для удаления кабеля
    const connection = await prisma.connection.findUnique({
      where: { id },
      include: { Cable: true },
    });

    if (!connection) {
      return NextResponse.json(
        { success: false, error: 'Связь не найдена' },
        { status: 404 }
      );
    }

    // Удаляем связь
    await prisma.connection.delete({
      where: { id },
    });

    // Удаляем кабель если есть
    if (connection.cableId) {
      await prisma.cable.delete({
        where: { id: connection.cableId },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Связь удалена',
    });
  } catch (error) {
    console.error('Error deleting connection:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при удалении связи' },
      { status: 500 }
    );
  }
}

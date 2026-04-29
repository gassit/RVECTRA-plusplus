// ============================================================================
// API УПРАВЛЕНИЯ СВЯЗЯМИ (КАБЕЛЯМИ)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateId, generateUUID } from '@/lib/utils/id-generator';
import { calculateVoltageDropAuto } from '@/lib/calculations/voltageDrop';

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
  currentA?: number; // Ток нагрузки (А)
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
    const { sourceId, targetId, wireType, wireSize, material, length, core, currentA } = body;

    console.log('POST /api/connections - Creating connection:', { sourceId, targetId, wireType, wireSize, material, length, currentA });

    // Валидация
    if (!sourceId || !targetId) {
      console.log('Validation failed: missing sourceId or targetId');
      return NextResponse.json(
        { success: false, error: 'sourceId и targetId обязательны' },
        { status: 400 }
      );
    }

    // Проверяем существование элементов
    const sourceElement = await prisma.element.findUnique({
      where: { id: sourceId },
      include: {
        DeviceSlot: {
          include: {
            Device: {
              include: {
                Load: true,
              },
            },
          },
        },
      },
    });
    const targetElement = await prisma.element.findUnique({
      where: { id: targetId },
      include: {
        DeviceSlot: {
          include: {
            Device: {
              include: {
                Load: true,
              },
            },
          },
        },
      },
    });

    console.log('Source element:', sourceElement ? sourceElement.id : 'NOT FOUND');
    console.log('Target element:', targetElement ? targetElement.id : 'NOT FOUND');

    if (!sourceElement || !targetElement) {
      return NextResponse.json(
        { success: false, error: `Элементы не найдены: source=${!!sourceElement}, target=${!!targetElement}` },
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

    // Получаем мощность нагрузки из target элемента
    let powerKw = 0;
    let cosPhi = 0.92;
    
    // Ищем Load в устройствах target элемента
    for (const slot of targetElement.DeviceSlot || []) {
      for (const device of slot.Device || []) {
        if (device.Load) {
          powerKw += device.Load.powerP || 0;
          cosPhi = device.Load.cosPhi || 0.92;
        }
      }
    }
    
    // Также проверяем source элемент (если там есть нагрузка)
    for (const slot of sourceElement.DeviceSlot || []) {
      for (const device of slot.Device || []) {
        if (device.Load) {
          powerKw += device.Load.powerP || 0;
          cosPhi = device.Load.cosPhi || 0.92;
        }
      }
    }

    // Создаём кабель если указаны параметры
    let cableId: string | null = null;
    let voltageDropPercent: number | null = null;
    
    if (wireType && wireSize && length) {
      // Определяем материал
      const cableMaterial = material?.toLowerCase() === 'aluminum' || material?.toLowerCase() === 'алюминий' ? 'Al' : 'Cu';
      
      // Ищем справочные данные для кабеля
      const cableRef = await prisma.cableReference.findFirst({
        where: {
          section: wireSize,
          material: cableMaterial === 'Cu' ? 'copper' : 'aluminum',
        },
      });

      // Рассчитываем потерю напряжения
      if (length > 0 && wireSize > 0) {
        const voltage = targetElement.voltageLevel || 380;
        
        // Если есть ток нагрузки - используем его, иначе берём из мощности
        const effectivePower = currentA ? (currentA * voltage * Math.sqrt(3) * cosPhi) / 1000 : powerKw;
        
        if (effectivePower > 0) {
          voltageDropPercent = calculateVoltageDropAuto({
            powerKw: effectivePower,
            lengthM: length,
            sectionMm2: wireSize,
            material: cableMaterial,
            voltageV: voltage,
            cosPhi: cosPhi,
            r0OhmPerKm: cableRef?.r0 || null,
            x0OhmPerKm: cableRef?.x0 || null,
          });
          
          console.log(`Voltage drop calculated: ${voltageDropPercent.toFixed(2)}% for ${effectivePower}kW, ${length}m, ${wireSize}mm², ${cableMaterial}`);
        }
      }

      const cableIdStr = generateId('CABLE');
      const cable = await prisma.cable.create({
        data: {
          id: generateUUID(),
          cableId: cableIdStr,
          name: `${wireType} ${wireSize}мм² ${length}м`,
          length,
          section: wireSize,
          material: cableMaterial === 'Cu' ? 'copper' : 'aluminum',
          currentA: currentA || null,
          r0: cableRef?.r0 || null,
          x0: cableRef?.x0 || null,
          voltageDrop: voltageDropPercent,
          updatedAt: new Date(),
        },
      });
      cableId = cable.id;
      
      console.log('Cable created with voltage drop:', { 
        cableId: cable.id, 
        voltageDrop: voltageDropPercent 
      });
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

    console.log('Connection created successfully:', { id: connection.id, sourceId, targetId, voltageDrop: voltageDropPercent });

    return NextResponse.json({
      success: true,
      data: connection,
      voltageDrop: voltageDropPercent,
      message: voltageDropPercent !== null 
        ? `Связь создана. Потеря напряжения: ${voltageDropPercent.toFixed(2)}%`
        : 'Связь успешно создана',
    });
  } catch (error) {
    console.error('Error creating connection:', error);
    return NextResponse.json(
      { success: false, error: `Ошибка при создании связи: ${error instanceof Error ? error.message : 'Unknown error'}` },
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

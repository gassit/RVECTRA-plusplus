// ============================================================================
// API УПРАВЛЕНИЯ ЭЛЕМЕНТАМИ СЕТИ
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateId, generateUUID } from '@/lib/utils/id-generator';
import { propagateFromElement, propagateStates } from '@/lib/propagate';

// ============================================================================
// ТИПЫ
// ============================================================================

interface CreateElementRequest {
  type: string;
  name: string;
  description?: string;
  location?: string;
  voltageLevel?: number;
  parentId?: string;
  // Статусы
  electricalStatus?: 'LIVE' | 'DEAD';
  operationalStatus?: 'ON' | 'OFF';
  // Данные устройства
  deviceType?: string;
  currentNom?: number;
  pKw?: number;
  qKvar?: number;
  cosPhi?: number;
  voltageNom?: number;
  // Для Breaker
  breakerType?: 'MCB' | 'MCCB' | 'RCD' | 'RCBO';
  breakingCapacity?: number;
  curve?: string;
  leakageCurrent?: number;
  poles?: number;
  // Для Meter
  meterType?: string;
  serialNumber?: string;
  // Координаты
  posX: number;
  posY: number;
}

// ============================================================================
// GET - Получить все элементы
// ============================================================================

export async function GET() {
  try {
    const elements = await prisma.element.findMany({
      include: {
        DeviceSlot: {
          include: {
            Device: {
              include: {
                Load: true,
                Breaker: true,
                Meter: true,
                Transformer: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: elements,
    });
  } catch (error) {
    console.error('Error fetching elements:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при получении элементов' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Создать элемент
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: CreateElementRequest = await request.json();
    console.log('POST /api/elements - Creating element:', body);
    const {
      type,
      name,
      description,
      location,
      voltageLevel,
      parentId,
      posX,
      posY,
      electricalStatus = 'DEAD',
      operationalStatus = 'ON',
      deviceType,
      currentNom,
      pKw,
      qKvar,
      cosPhi,
      voltageNom,
      breakerType,
      breakingCapacity,
      curve,
      leakageCurrent,
      poles,
      meterType,
      serialNumber,
    } = body;

    // Валидация
    if (!type || !name) {
      console.log('Validation failed: missing type or name');
      return NextResponse.json(
        { success: false, error: 'Тип и название обязательны' },
        { status: 400 }
      );
    }

    // Генерируем ID
    const elementId = generateId('EL');
    const elementUuid = generateUUID();

    // Создаём элемент с статусами
    const element = await prisma.element.create({
      data: {
        id: elementUuid,
        elementId,
        name,
        type: type.toUpperCase(),
        parentId: parentId || null,
        voltageLevel: voltageLevel || null,
        posX,
        posY,
        electricalStatus: electricalStatus || 'DEAD',
        operationalStatus: operationalStatus || 'ON',
        updatedAt: new Date(),
      },
    });

    // Создаём устройство если нужно
    if (deviceType && ['SOURCE', 'LOAD', 'BREAKER', 'METER', 'TRANSFORMER'].includes(deviceType)) {
      const slotId = generateUUID();
      const deviceId = generateId('DEV');
      const deviceUuid = generateUUID();

      // Создаём слот
      await prisma.deviceSlot.create({
        data: {
          id: slotId,
          slotId: `SLOT-${generateId('SLOT')}`,
          elementId: element.id,
          slotType: deviceType,
        },
      });

      // Создаём устройство
      const device = await prisma.device.create({
        data: {
          id: deviceUuid,
          deviceId,
          slotId,
          deviceType,
          updatedAt: new Date(),
        },
      });

      // Создаём специфичную модель устройства
      switch (deviceType) {
        case 'LOAD':
          await prisma.load.create({
            data: {
              id: generateUUID(),
              deviceId: device.id,
              name: name,
              powerP: pKw || 0,
              powerQ: qKvar || 0,
              cosPhi: cosPhi || 0.92,
              updatedAt: new Date(),
            },
          });
          break;

        case 'BREAKER':
          await prisma.breaker.create({
            data: {
              id: generateUUID(),
              deviceId: device.id,
              breakerType: breakerType || 'MCB',
              ratedCurrent: currentNom || 16,
              breakingCapacity: breakingCapacity || null,
              curve: curve || null,
              leakageCurrent: leakageCurrent || null,
              updatedAt: new Date(),
            },
          });
          break;

        case 'METER':
          await prisma.meter.create({
            data: {
              id: generateUUID(),
              deviceId: device.id,
              meterType: meterType || 'ELECTRONIC',
              serialNumber: serialNumber || null,
              updatedAt: new Date(),
            },
          });
          break;

        case 'TRANSFORMER':
          await prisma.transformer.create({
            data: {
              id: generateUUID(),
              deviceId: device.id,
              power: pKw || 0,
              primaryKV: voltageNom ? voltageNom / 1000 : 10,
              secondaryKV: voltageLevel ? voltageLevel / 1000 : 0.4,
              updatedAt: new Date(),
            },
          });
          break;
      }
    }

    // Получаем созданный элемент с данными
    const createdElement = await prisma.element.findUnique({
      where: { id: element.id },
      include: {
        DeviceSlot: {
          include: {
            Device: {
              include: {
                Load: true,
                Breaker: true,
                Meter: true,
                Transformer: true,
              },
            },
          },
        },
      },
    });

    console.log('Element created successfully:', { id: element.id, elementId, name, type });

    // =========================================================================
    // АВТОМАТИЧЕСКОЕ НАСЛЕДОВАНИЕ СТАТУСА
    // =========================================================================
    // Для SOURCE запускаем полное распространение
    if (type.toUpperCase() === 'SOURCE') {
      await propagateStates();
    }
    // Для обычных элементов - распространение от этого элемента
    // (но у нового элемента нет связей, поэтому статус останется DEAD до создания связи)

    return NextResponse.json({
      success: true,
      data: createdElement,
      message: `Элемент "${name}" успешно создан`,
    });
  } catch (error) {
    console.error('Error creating element:', error);
    return NextResponse.json(
      { success: false, error: `Ошибка при создании элемента: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Обновить элемент
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID элемента обязателен' },
        { status: 400 }
      );
    }

    // Получаем текущий элемент для проверки изменений
    const existingElement = await prisma.element.findUnique({
      where: { id }
    });

    const element = await prisma.element.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    // =========================================================================
    // АВТОМАТИЧЕСКОЕ НАСЛЕДОВАНИЕ СТАТУСА
    // =========================================================================
    // Если изменился operationalStatus - запускаем полное распространение
    if (updateData.operationalStatus !== undefined &&
        existingElement?.operationalStatus !== updateData.operationalStatus) {
      console.log(`operationalStatus changed for element ${id}, running full propagation...`);
      await propagateStates();
    }

    return NextResponse.json({
      success: true,
      data: element,
      message: 'Элемент обновлён',
    });
  } catch (error) {
    console.error('Error updating element:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при обновлении элемента' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Удалить элемент
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID элемента обязателен' },
        { status: 400 }
      );
    }

    // Проверяем существование элемента
    const existingElement = await prisma.element.findUnique({
      where: { id },
    });

    if (!existingElement) {
      return NextResponse.json(
        { success: false, error: 'Элемент не найден' },
        { status: 404 }
      );
    }

    // Сначала удаляем связи
    await prisma.connection.deleteMany({
      where: {
        OR: [{ sourceId: id }, { targetId: id }],
      },
    });

    // Удаляем DeviceSlots и связанные Devices
    const slots = await prisma.deviceSlot.findMany({
      where: { elementId: id },
    });

    for (const slot of slots) {
      // Удаляем связанные записи из специфичных таблиц
      const devices = await prisma.device.findMany({
        where: { slotId: slot.id },
      });

      for (const device of devices) {
        await prisma.load.deleteMany({ where: { deviceId: device.id } });
        await prisma.breaker.deleteMany({ where: { deviceId: device.id } });
        await prisma.meter.deleteMany({ where: { deviceId: device.id } });
        await prisma.transformer.deleteMany({ where: { deviceId: device.id } });
      }

      // Удаляем устройства
      await prisma.device.deleteMany({
        where: { slotId: slot.id },
      });
    }

    // Удаляем слоты
    await prisma.deviceSlot.deleteMany({
      where: { elementId: id },
    });

    // Удаляем сам элемент
    await prisma.element.delete({
      where: { id },
    });

    // =========================================================================
    // АВТОМАТИЧЕСКОЕ НАСЛЕДОВАНИЕ СТАТУСА
    // =========================================================================
    // После удаления элемента пересчитываем статусы
    await propagateStates();

    return NextResponse.json({
      success: true,
      message: 'Элемент удалён',
    });
  } catch (error) {
    console.error('Error deleting element:', error);
    return NextResponse.json(
      { success: false, error: `Ошибка при удалении элемента: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

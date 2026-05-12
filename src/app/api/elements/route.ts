import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateElementId } from '@/lib/utils/id-generator';
import type { ElementType, NetworkElement } from '@/types';

// GET - получить список элементов
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const where: any = {};
    if (type) {
      where.type = type;
    }

    const elements = await db.element.findMany({
      where,
      include: {
        DeviceSlot: {
          include: { Device: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const result: NetworkElement[] = elements.map(el => ({
      id: el.id,
      type: el.type as ElementType,
      name: el.name,
      parentId: el.parentId || undefined,
      voltageLevel: el.voltageLevel || undefined,
      posX: el.posX || 0,
      posY: el.posY || 0,
      devices: (el.DeviceSlot || []).flatMap((ds: any) => 
        (ds.Device || []).map((d: any) => ({
          id: d.id,
          type: d.deviceType as any,
          slotId: ds.slotId,
        }))
      ),
      validationResults: [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Elements GET error:', error);
    return NextResponse.json(
      { error: 'Ошибка получения элементов' },
      { status: 500 }
    );
  }
}

// POST - создать новый элемент
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      name,
      parentId,
      voltageLevel,
    } = body;

    if (!type || !name) {
      return NextResponse.json(
        { error: 'Требуются поля type и name' },
        { status: 400 }
      );
    }

    const elementId = generateElementId(type as ElementType);

    // Создаём элемент
    const element = await db.element.create({
      data: {
        id: elementId,
        elementId: elementId,
        type,
        name,
        parentId: parentId || undefined,
        voltageLevel: voltageLevel || 0.4,
        posX: 0,
        posY: 0,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(element);
  } catch (error) {
    console.error('Elements POST error:', error);
    return NextResponse.json(
      { error: 'Ошибка создания элемента' },
      { status: 500 }
    );
  }
}

// PUT - обновить элемент
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, parentId, voltageLevel, posX, posY } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Требуется поле id' },
        { status: 400 }
      );
    }

    const element = await db.element.update({
      where: { id },
      data: {
        name: name || undefined,
        parentId: parentId || undefined,
        voltageLevel: voltageLevel || undefined,
        posX: posX !== undefined ? posX : undefined,
        posY: posY !== undefined ? posY : undefined,
      },
    });

    return NextResponse.json(element);
  } catch (error) {
    console.error('Elements PUT error:', error);
    return NextResponse.json(
      { error: 'Ошибка обновления элемента' },
      { status: 500 }
    );
  }
}

// DELETE - удалить элемент
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Требуется параметр id' },
        { status: 400 }
      );
    }

    await db.element.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Elements DELETE error:', error);
    return NextResponse.json(
      { error: 'Ошибка удаления элемента' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateDeviceId } from '@/lib/utils/id-generator';
import type { DeviceType } from '@/types';

// GET - получить список устройств
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get('slotId');
    const deviceType = searchParams.get('type');

    const where: any = {};
    if (slotId) where.slotId = slotId;
    if (deviceType) where.deviceType = deviceType;

    const devices = await db.device.findMany({
      where,
      include: {
        DeviceSlot: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const result = devices.map(d => ({
      id: d.id,
      type: d.deviceType,
      slotId: d.slotId,
      slot: d.DeviceSlot ? {
        id: d.DeviceSlot.id,
        elementId: d.DeviceSlot.elementId,
        slotType: d.DeviceSlot.slotType,
      } : undefined,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Devices GET error:', error);
    return NextResponse.json(
      { error: 'Ошибка получения устройств' },
      { status: 500 }
    );
  }
}

// POST - создать устройство
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      slotId,
    } = body;

    if (!type || !slotId) {
      return NextResponse.json(
        { error: 'Требуются поля type и slotId' },
        { status: 400 }
      );
    }

    const deviceId = generateDeviceId(type as DeviceType, slotId);

    const device = await db.device.create({
      data: {
        id: deviceId,
        deviceId: deviceId,
        deviceType: type,
        slotId: slotId,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(device);
  } catch (error) {
    console.error('Devices POST error:', error);
    return NextResponse.json(
      { error: 'Ошибка создания устройства' },
      { status: 500 }
    );
  }
}

// PUT - обновить устройство
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Требуется поле id' },
        { status: 400 }
      );
    }

    const device = await db.device.update({
      where: { id },
      data: {
        deviceType: updateData.type || undefined,
      },
    });

    return NextResponse.json(device);
  } catch (error) {
    console.error('Devices PUT error:', error);
    return NextResponse.json(
      { error: 'Ошибка обновления устройства' },
      { status: 500 }
    );
  }
}

// DELETE - удалить устройство
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

    await db.device.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Devices DELETE error:', error);
    return NextResponse.json(
      { error: 'Ошибка удаления устройства' },
      { status: 500 }
    );
  }
}

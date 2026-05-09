import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateDeviceId } from '@/lib/utils/id-generator';
import type { DeviceType } from '@/types';

// GET - получить список устройств
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get('slotId');
    const type = searchParams.get('type');

    const where: any = {};
    if (slotId) where.slot_id = slotId;
    if (type) where.type = type;

    const devices = await db.device.findMany({
      where,
      include: {
        slot: true,
      },
      orderBy: { created_at: 'asc' },
    });

    const result = devices.map(d => ({
      id: d.id,
      type: d.type,
      slotId: d.slot_id,
      model: d.model || undefined,
      manufacturer: d.manufacturer || undefined,
      voltageNom: d.voltage_nom || undefined,
      currentNom: d.current_nom || undefined,
      currentMax: d.current_max || undefined,
      breakingCapacity: d.breaking_capacity || undefined,
      pKw: d.p_kw || undefined,
      qKvar: d.q_kvar || undefined,
      sKva: d.s_kva || undefined,
      cosPhi: d.cos_phi || undefined,
      poles: d.poles || undefined,
      trippingChar: d.tripping_char || undefined,
      inRating: d.in_rating || undefined,
      slot: d.slot ? {
        id: d.slot.id,
        name: d.slot.name,
        type: d.slot.type,
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
      model,
      manufacturer,
      voltageNom,
      currentNom,
      currentMax,
      breakingCapacity,
      pKw,
      qKvar,
      sKva,
      cosPhi,
      poles,
      trippingChar,
      inRating,
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
        type,
        slot_id: slotId,
        model: model || null,
        manufacturer: manufacturer || null,
        voltage_nom: voltageNom || null,
        current_nom: currentNom || null,
        current_max: currentMax || null,
        breaking_capacity: breakingCapacity || null,
        p_kw: pKw || null,
        q_kvar: qKvar || null,
        s_kva: sKva || null,
        cos_phi: cosPhi || null,
        poles: poles || null,
        tripping_char: trippingChar || null,
        in_rating: inRating || null,
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
        model: updateData.model || null,
        current_nom: updateData.currentNom || null,
        p_kw: updateData.pKw || null,
        q_kvar: updateData.qKvar || null,
        s_kva: updateData.sKva || null,
        cos_phi: updateData.cosPhi || null,
        in_rating: updateData.inRating || null,
        tripping_char: updateData.trippingChar || null,
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

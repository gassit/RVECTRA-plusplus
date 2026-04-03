import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateElementId, resetCounters } from '@/lib/utils/id-generator';
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
        devices: true,
        validationResults: {
          include: { rule: true },
        },
        parent: true,
      },
      orderBy: { created_at: 'asc' },
    });

    const result: NetworkElement[] = elements.map(el => ({
      id: el.id,
      type: el.type as ElementType,
      name: el.name,
      description: el.description || undefined,
      parentId: el.parent_id || undefined,
      location: el.location || undefined,
      voltageLevel: el.voltage_level || undefined,
      phase: el.phase || undefined,
      posX: el.pos_x || 0,
      posY: el.pos_y || 0,
      devices: el.devices.map(d => ({
        id: d.id,
        type: d.type as any,
        slotId: d.slot_id,
        model: d.model || undefined,
        currentNom: d.current_nom || undefined,
        pKw: d.p_kw || undefined,
        qKvar: d.q_kvar || undefined,
        sKva: d.s_kva || undefined,
        cosPhi: d.cos_phi || undefined,
      })),
      validationResults: el.validationResults.map(vr => ({
        id: vr.id,
        ruleCode: vr.rule.code,
        ruleName: vr.rule.name,
        status: vr.status as any,
        elementId: el.id,
        message: vr.message,
        recommendation: vr.recommendation || undefined,
      })),
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
      description,
      parentId,
      location,
      voltageLevel,
      // Параметры устройства
      deviceType,
      deviceModel,
      currentNom,
      pKw,
      qKvar,
      cosPhi,
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
        type,
        name,
        description: description || null,
        parent_id: parentId || null,
        location: location || null,
        voltage_level: voltageLevel || 0.4,
        pos_x: 0,
        pos_y: 0,
      },
    });

    // Создаём устройство если указан тип
    if (deviceType && (type === 'BREAKER' || type === 'LOAD' || type === 'SOURCE')) {
      const deviceId = `DEV_${deviceType.charAt(0)}${Date.now().toString(36)}`;
      
      await db.device.create({
        data: {
          id: deviceId,
          type: deviceType,
          slot_id: elementId,
          model: deviceModel || null,
          current_nom: currentNom || null,
          p_kw: pKw || null,
          q_kvar: qKvar || null,
          cos_phi: cosPhi || null,
          voltage_nom: 400,
        },
      });
    }

    // Возвращаем созданный элемент с устройствами
    const result = await db.element.findUnique({
      where: { id: elementId },
      include: { devices: true },
    });

    return NextResponse.json(result);
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
    const { id, name, description, location, voltageLevel, posX, posY } = body;

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
        description: description || null,
        location: location || null,
        voltage_level: voltageLevel || undefined,
        pos_x: posX !== undefined ? posX : undefined,
        pos_y: posY !== undefined ? posY : undefined,
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

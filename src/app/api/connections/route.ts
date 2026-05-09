import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateConnectionId } from '@/lib/utils/id-generator';
import { calculateCableImpedanceFromReference } from '@/lib/calculations/impedance';
import { findCableReference, getCableCurrentCapacity } from '@/lib/data/references';
import type { ConnectionType, NetworkConnection, MaterialType } from '@/types';

// GET - получить список связей
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromId = searchParams.get('fromId');
    const toId = searchParams.get('toId');

    const where: any = {};
    if (fromId) where.from_id = fromId;
    if (toId) where.to_id = toId;

    const connections = await db.connection.findMany({
      where,
      include: {
        from: { select: { id: true, name: true, type: true } },
        to: { select: { id: true, name: true, type: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    const result: NetworkConnection[] = connections.map(c => ({
      id: c.id,
      fromId: c.from_id,
      toId: c.to_id,
      type: c.type as ConnectionType,
      length: c.length || undefined,
      wireType: c.wire_type || undefined,
      core: c.core || undefined,
      wireSize: c.wire_size || undefined,
      material: c.material as MaterialType || undefined,
      resistanceR: c.resistance_r || undefined,
      reactanceX: c.reactance_x || undefined,
      impedanceZ: c.impedance_z || undefined,
      currentCapacity: c.current_capacity || undefined,
      installationMethod: c.installation_method as any || undefined,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Connections GET error:', error);
    return NextResponse.json(
      { error: 'Ошибка получения связей' },
      { status: 500 }
    );
  }
}

// POST - создать связь
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fromId,
      toId,
      type = 'CABLE',
      length,
      wireType,
      wireSize,
      material,
      installationMethod = 'in_air',
    } = body;

    if (!fromId || !toId) {
      return NextResponse.json(
        { error: 'Требуются поля fromId и toId' },
        { status: 400 }
      );
    }

    // Проверяем существование элементов
    const fromElement = await db.element.findUnique({ where: { id: fromId } });
    const toElement = await db.element.findUnique({ where: { id: toId } });

    if (!fromElement || !toElement) {
      return NextResponse.json(
        { error: 'Один или оба элемента не найдены' },
        { status: 400 }
      );
    }

    // Рассчитываем сопротивления
    let resistanceR: number | null = null;
    let reactanceX: number | null = null;
    let impedanceZ: number | null = null;
    let currentCapacity: number | null = null;

    if (wireType && wireSize && length) {
      const impedance = calculateCableImpedanceFromReference(length, wireType, wireSize);
      if (impedance) {
        resistanceR = impedance.r;
        reactanceX = impedance.x;
        impedanceZ = impedance.z;
      }

      const cableRef = findCableReference(wireType, wireSize);
      if (cableRef) {
        currentCapacity = getCableCurrentCapacity(cableRef, installationMethod);
      }
    }

    const connectionId = generateConnectionId(fromId, toId);

    const connection = await db.connection.create({
      data: {
        id: connectionId,
        from_id: fromId,
        to_id: toId,
        type,
        length: length || null,
        wire_type: wireType || null,
        wire_size: wireSize || null,
        material: material || (wireType?.startsWith('А') ? 'Al' : 'Cu'),
        resistance_r: resistanceR,
        reactance_x: reactanceX,
        impedance_z: impedanceZ,
        current_capacity: currentCapacity,
        installation_method: installationMethod,
      },
    });

    return NextResponse.json(connection);
  } catch (error) {
    console.error('Connections POST error:', error);
    return NextResponse.json(
      { error: 'Ошибка создания связи' },
      { status: 500 }
    );
  }
}

// PUT - обновить связь
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

    // Пересчитываем сопротивления если изменились параметры кабеля
    let resistanceR: number | null | undefined = undefined;
    let reactanceX: number | null | undefined = undefined;
    let impedanceZ: number | null | undefined = undefined;
    let currentCapacity: number | null | undefined = undefined;

    if (updateData.wireType && updateData.wireSize && updateData.length) {
      const impedance = calculateCableImpedanceFromReference(
        updateData.length,
        updateData.wireType,
        updateData.wireSize
      );
      if (impedance) {
        resistanceR = impedance.r;
        reactanceX = impedance.x;
        impedanceZ = impedance.z;
      }

      const cableRef = findCableReference(updateData.wireType, updateData.wireSize);
      if (cableRef) {
        currentCapacity = getCableCurrentCapacity(cableRef, updateData.installationMethod || 'in_air');
      }
    }

    const connection = await db.connection.update({
      where: { id },
      data: {
        length: updateData.length || null,
        wire_type: updateData.wireType || null,
        wire_size: updateData.wireSize || null,
        material: updateData.material || null,
        installation_method: updateData.installationMethod || null,
        resistance_r: resistanceR,
        reactance_x: reactanceX,
        impedance_z: impedanceZ,
        current_capacity: currentCapacity,
      },
    });

    return NextResponse.json(connection);
  } catch (error) {
    console.error('Connections PUT error:', error);
    return NextResponse.json(
      { error: 'Ошибка обновления связи' },
      { status: 500 }
    );
  }
}

// DELETE - удалить связь
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

    await db.connection.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Connections DELETE error:', error);
    return NextResponse.json(
      { error: 'Ошибка удаления связи' },
      { status: 500 }
    );
  }
}

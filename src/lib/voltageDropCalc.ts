/**
 * ============================================================================
 * РАСЧЁТ ПОТЕРЬ НАПРЯЖЕНИЯ ДЛЯ ВСЕХ СВЯЗЕЙ
 * ============================================================================
 *
 * Логика:
 * - Для каждой связи берётся мощность от target элемента
 * - LOAD: используется Pуст (powerP)
 * - Остальные элементы: используется ΣPрасч (sumPCalculated)
 *
 * Формула: ΔU = (P × L × ρ) / (U × S)
 * или точная: ΔU = (P×R + Q×X) / U² × 100%
 */

import { prisma } from './prisma';
import { calculateVoltageDropAuto } from './calculations/voltageDrop';

export interface VoltageDropResult {
  connectionsUpdated: number;
  maxVoltageDrop: number;
  maxVoltageDropConnection: string | null;
  warnings: string[];
}

/**
 * Расчёт потерь напряжения для всех связей
 */
export async function calculateVoltageDropAll(): Promise<VoltageDropResult> {
  // Получаем все элементы с мощностями
  const elements = await prisma.element.findMany({
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

  // Получаем все связи с кабелями
  const connections = await prisma.connection.findMany({
    include: {
      Cable: true,
    },
  });

  // Мапа элементов для быстрого доступа
  const elementMap = new Map<string, typeof elements[0]>();
  for (const el of elements) {
    elementMap.set(el.id, el);
  }

  // Напряжение сети по умолчанию
  const defaultVoltage = 400; // В

  let connectionsUpdated = 0;
  let maxVoltageDrop = 0;
  let maxVoltageDropConnection: string | null = null;
  const warnings: string[] = [];

  for (const conn of connections) {
    const targetElement = elementMap.get(conn.targetId);
    if (!targetElement) {
      continue;
    }

    // Пропускаем связи без кабеля
    if (!conn.Cable) {
      continue;
    }

    const cable = conn.Cable;

    // Пропускаем кабели без необходимых параметров
    if (!cable.length || cable.length <= 0 || !cable.section || cable.section <= 0) {
      continue;
    }

    // =========================================================================
    // Определяем мощность для расчёта
    // =========================================================================
    let powerKw = 0;
    let qKvar = 0;
    let cosPhi = 0.92;

    const elementType = targetElement.type.toUpperCase();

    if (elementType === 'LOAD') {
      // Для LOAD используем Pуст
      const deviceSlot = targetElement.DeviceSlot?.[0];
      const device = deviceSlot?.Device?.[0];
      const loadData = device?.Load;

      if (loadData) {
        powerKw = loadData.powerP || 0;
        qKvar = loadData.powerQ || 0;
        cosPhi = loadData.cosPhi || 0.92;
      }
    } else {
      // Для остальных элементов используем ΣPрасч
      powerKw = targetElement.sumPCalculated || 0;
      // Q берём примерно из cosPhi
      const tanPhi = Math.sqrt(1 - cosPhi * cosPhi) / cosPhi;
      qKvar = powerKw * tanPhi;
    }

    // Пропускаем если мощность = 0
    if (powerKw <= 0) {
      continue;
    }

    // =========================================================================
    // Определяем напряжение
    // =========================================================================
    const voltageV = targetElement.voltageLevel || defaultVoltage;

    // =========================================================================
    // Определяем материал
    // =========================================================================
    const material = (cable.material?.toLowerCase() === 'aluminum' || cable.material?.toLowerCase() === 'алюминий')
      ? 'Al' as const
      : 'Cu' as const;

    // =========================================================================
    // Рассчитываем ΔU
    // =========================================================================
    const voltageDrop = calculateVoltageDropAuto({
      powerKw,
      lengthM: cable.length,
      sectionMm2: cable.section,
      material,
      voltageV,
      cosPhi,
      qKvar,
      r0OhmPerKm: cable.r0,
      x0OhmPerKm: cable.x0,
    });

    // =========================================================================
    // Сохраняем результат
    // =========================================================================
    try {
      await prisma.cable.update({
        where: { id: cable.id },
        data: { voltageDrop },
      });
      connectionsUpdated++;

      // Отслеживаем максимальную потерю
      if (voltageDrop > maxVoltageDrop) {
        maxVoltageDrop = voltageDrop;
        maxVoltageDropConnection = conn.id;
      }

      // Предупреждение о большой потере
      if (voltageDrop > 5) {
        warnings.push(`Связь ${conn.id}: ΔU = ${voltageDrop.toFixed(2)}% (превышает 5%)`);
      }
    } catch (e) {
      console.error(`Ошибка обновления кабеля ${cable.id}:`, e);
    }
  }

  return {
    connectionsUpdated,
    maxVoltageDrop,
    maxVoltageDropConnection,
    warnings,
  };
}

/**
 * Получить мощность для расчёта ΔU конкретной связи
 */
export function getPowerForVoltageDropCalc(
  elementType: string,
  sumPCalculated: number | null,
  loadPowerP?: number
): number {
  const type = elementType.toLowerCase();

  if (type === 'load') {
    // Для нагрузки используем Pуст
    return loadPowerP || 0;
  }

  // Для остальных элементов используем Pрасч
  return sumPCalculated || 0;
}

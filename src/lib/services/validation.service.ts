// ============================================================================
// СЕРВИС ВАЛИДАЦИИ СЕТИ
// ============================================================================

import { db } from '@/lib/db';
import { generateValidationId } from '@/lib/utils/id-generator';
import { findCableReference } from '@/lib/data/references';
import { calculateShortCircuit } from '@/lib/calculations/shortCircuit';
import { calculateVoltageDropByCurrent } from '@/lib/calculations/voltageDrop';
import type {
  ValidationResultData,
  ValidationIssue,
  ValidationStatus,
} from '@/types';

// ============================================================================
// ПРАВИЛА ВАЛИДАЦИИ
// ============================================================================

/**
 * Правило CABLE_001: Iном.выкл ≤ Iдоп.кабеля
 */
async function checkCableCapacity(): Promise<ValidationResultData[]> {
  const results: ValidationResultData[] = [];

  // Получаем все выключатели с кабелями
  const breakers = await db.element.findMany({
    where: { type: 'BREAKER' },
    include: {
      devices: true,
      connections_from: {
        include: { to: true },
      },
    },
  });

  for (const breaker of breakers) {
    const device = breaker.devices.find(d => d.type === 'BREAKER');
    if (!device?.current_nom) continue;

    for (const conn of breaker.connections_from) {
      if (!conn.wire_type || !conn.wire_size) continue;

      const cableRef = findCableReference(conn.wire_type, conn.wire_size);
      if (!cableRef) continue;

      const cableCapacity = conn.installation_method === 'in_ground'
        ? cableRef.iGround
        : cableRef.iAir;

      const breakerCurrent = device.current_nom;

      if (breakerCurrent > cableCapacity) {
        const id = generateValidationId('CABLE_001', breaker.id);
        results.push({
          id,
          ruleCode: 'CABLE_001',
          ruleName: 'Соответствие тока выключателя и кабеля',
          status: 'FAIL',
          elementId: breaker.id,
          connectionId: conn.id,
          actualValue: breakerCurrent,
          expectedValue: cableCapacity,
          deviation: ((breakerCurrent - cableCapacity) / cableCapacity) * 100,
          message: `Ток выключателя ${breaker.name} (${breakerCurrent}А) превышает допустимый ток кабеля ${conn.wire_type} ${conn.wire_size}мм² (${cableCapacity}А)`,
          recommendation: `Увеличить сечение кабеля до ${Math.ceil(breakerCurrent / 100) * 50}мм² или установить выключатель с Iном ≤ ${cableCapacity}А`,
        });
      }
    }
  }

  return results;
}

/**
 * Правило VOLTAGE_001: ΔU% ≤ 4%
 */
async function checkVoltageDrop(): Promise<ValidationResultData[]> {
  const results: ValidationResultData[] = [];

  // Получаем все нагрузки
  const loads = await db.element.findMany({
    where: { type: 'LOAD' },
    include: {
      devices: true,
    },
  });

  for (const load of loads) {
    const device = load.devices.find(d => d.type === 'LOAD');
    if (!device?.p_kw) continue;

    // Находим путь от источника до нагрузки
    const path = await findPathToSource(load.id);
    if (path.length === 0) continue;

    let totalVoltageDrop = 0;

    for (const segment of path) {
      if (!segment.connection?.resistance_r) continue;

      const voltageDrop = calculateVoltageDropByCurrent(
        device.current_nom || (device.p_kw * 1000) / (Math.sqrt(3) * 400 * (device.cos_phi || 0.9)),
        segment.connection.resistance_r,
        segment.connection.reactance_x || 0,
        device.cos_phi || 0.9,
        400
      );

      totalVoltageDrop += voltageDrop;
    }

    if (totalVoltageDrop > 4) {
      const id = generateValidationId('VOLTAGE_001', load.id);
      results.push({
        id,
        ruleCode: 'VOLTAGE_001',
        ruleName: 'Потеря напряжения',
        status: 'FAIL',
        elementId: load.id,
        actualValue: totalVoltageDrop,
        expectedValue: 4,
        deviation: totalVoltageDrop - 4,
        message: `Потеря напряжения до ${load.name} составляет ${totalVoltageDrop.toFixed(2)}% (допустимо ≤ 4%)`,
        recommendation: 'Увеличить сечение кабелей или сократить длину линии',
      });
    }
  }

  return results;
}

/**
 * Правило PROT_001: Iкз.конец ≥ 3 × Iном.выкл (КРИТИЧНО!)
 */
async function checkProtectionSensitivity(): Promise<ValidationResultData[]> {
  const results: ValidationResultData[] = [];

  // Получаем все источники
  const sources = await db.element.findMany({
    where: { type: 'SOURCE' },
    include: {
      devices: true,
    },
  });

  for (const source of sources) {
    const sourceDevice = source.devices.find(d => d.type === 'SOURCE');
    const sourceS = sourceDevice?.s_kva || 630;
    const sourceUk = 5.5; // По умолчанию

    // Сопротивление трансформатора
    const zTransformer = (sourceUk * 400 * 400) / (100 * sourceS * 1000);

    // Получаем все линии от этого источника
    const lines = await getAllDownstreamElements(source.id);

    for (const line of lines) {
      if (line.element.type !== 'BREAKER') continue;

      const breakerDevice = line.element.devices?.find(d => d.type === 'BREAKER');
      if (!breakerDevice?.current_nom) continue;

      // Сопротивление до конца линии
      const zCable = line.totalImpedance || 0;
      const zTotal = zTransformer + zCable;

      // Ток КЗ в конце линии
      const sc = calculateShortCircuit(zTransformer, zCable, 400);
      const ikMin = sc.ik1; // Минимальный ток КЗ (однофазное)

      const requiredCurrent = 3 * breakerDevice.current_nom;

      if (ikMin < requiredCurrent) {
        const id = generateValidationId('PROT_001', line.element.id);
        results.push({
          id,
          ruleCode: 'PROT_001',
          ruleName: 'Чувствительность защиты',
          status: 'CRITICAL',
          elementId: line.element.id,
          deviceId: breakerDevice.id,
          actualValue: ikMin,
          expectedValue: requiredCurrent,
          deviation: ((requiredCurrent - ikMin) / requiredCurrent) * 100,
          message: `Ток КЗ в конце линии ${line.element.name} (${ikMin.toFixed(0)}А) недостаточен для срабатывания защиты (требуется ≥ ${requiredCurrent}А)`,
          recommendation: `Увеличить сечение кабеля или уменьшить длину линии. Требуемое сопротивление: ≤ ${((400 / (Math.sqrt(3) * requiredCurrent * 2)) - zTransformer).toFixed(4)} Ом`,
        });
      }
    }
  }

  return results;
}

/**
 * Правило SEL_001: Iном.вводного ≥ Iном.отходящего (селективность)
 */
async function checkSelectivity(): Promise<ValidationResultData[]> {
  const results: ValidationResultData[] = [];

  // Получаем все шкафы
  const cabinets = await db.element.findMany({
    where: { type: 'CABINET' },
    include: {
      children: {
        where: { type: 'BREAKER' },
        include: { devices: true },
      },
      connections_to: {
        include: {
          from: {
            include: {
              devices: true,
            },
          },
        },
      },
    },
  });

  for (const cabinet of cabinets) {
    // Находим вводной выключатель (по наибольшему току)
    let inputBreaker: { id: string; name: string; current_nom: number | null } | null = null;

    // Сначала проверяем соединения
    for (const conn of cabinet.connections_to) {
      const fromBreaker = conn.from.devices?.find(d => d.type === 'BREAKER');
      if (fromBreaker?.current_nom) {
        if (!inputBreaker || fromBreaker.current_nom > (inputBreaker.current_nom || 0)) {
          inputBreaker = {
            id: conn.from.id,
            name: conn.from.name,
            current_nom: fromBreaker.current_nom,
          };
        }
      }
    }

    if (!inputBreaker?.current_nom) continue;

    // Проверяем все отходящие выключатели
    for (const child of cabinet.children) {
      const childDevice = child.devices.find(d => d.type === 'BREAKER');
      if (!childDevice?.current_nom) continue;

      if (childDevice.current_nom >= inputBreaker.current_nom) {
        const id = generateValidationId('SEL_001', child.id);
        results.push({
          id,
          ruleCode: 'SEL_001',
          ruleName: 'Селективность защит',
          status: 'FAIL',
          elementId: child.id,
          actualValue: childDevice.current_nom,
          expectedValue: inputBreaker.current_nom - 1,
          deviation: ((childDevice.current_nom - inputBreaker.current_nom) / inputBreaker.current_nom) * 100,
          message: `Номинальный ток отходящего выключателя ${child.name} (${childDevice.current_nom}А) не меньше вводного ${inputBreaker.name} (${inputBreaker.current_nom}А). Нарушение селективности!`,
          recommendation: `Установить отходящий выключатель с Iном < ${inputBreaker.current_nom}А`,
        });
      }
    }
  }

  return results;
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

interface PathSegment {
  element: {
    id: string;
    type: string;
    name: string;
    devices?: { type: string; current_nom: number | null }[];
  };
  connection?: {
    id: string;
    resistance_r: number | null;
    reactance_x: number | null;
  } | null;
}

/**
 * Найти путь от элемента до источника
 */
async function findPathToSource(elementId: string): Promise<PathSegment[]> {
  const path: PathSegment[] = [];
  let currentId = elementId;
  const visited = new Set<string>();
  const maxIterations = 50;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;
    
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const element = await db.element.findUnique({
      where: { id: currentId },
      include: {
        devices: {
          select: { type: true, current_nom: true },
        },
        connections_to: {
          include: {
            from: {
              include: {
                devices: {
                  select: { type: true, current_nom: true },
                },
              },
            },
          },
        },
      },
    });

    if (!element) break;

    path.push({
      element: {
        id: element.id,
        type: element.type,
        name: element.name,
        devices: element.devices,
      },
    });

    if (element.type === 'SOURCE') break;

    // Находим входящее соединение
    const incomingConn = element.connections_to[0];
    if (!incomingConn) break;

    path[path.length - 1].connection = {
      id: incomingConn.id,
      resistance_r: incomingConn.resistance_r,
      reactance_x: incomingConn.reactance_x,
    };

    currentId = incomingConn.from_id;
  }

  return path;
}

interface DownstreamElement {
  element: {
    id: string;
    type: string;
    name: string;
    devices?: { type: string; current_nom: number | null; id: string }[];
  };
  totalImpedance: number;
}

/**
 * Получить все элементы вниз по потоку от источника
 */
async function getAllDownstreamElements(sourceId: string): Promise<DownstreamElement[]> {
  const results: DownstreamElement[] = [];
  const queue: { id: string; impedance: number }[] = [{ id: sourceId, impedance: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    const element = await db.element.findUnique({
      where: { id: current.id },
      include: {
        devices: {
          select: { type: true, current_nom: true, id: true },
        },
        connections_from: true,
      },
    });

    if (!element) continue;

    if (element.type === 'BREAKER') {
      results.push({
        element: {
          id: element.id,
          type: element.type,
          name: element.name,
          devices: element.devices,
        },
        totalImpedance: current.impedance,
      });
    }

    // Добавляем следующие элементы
    for (const conn of element.connections_from) {
      const nextImpedance = current.impedance + (conn.impedance_z || 0);
      queue.push({ id: conn.to_id, impedance: nextImpedance });
    }
  }

  return results;
}

// ============================================================================
// ОСНОВНЫЕ ФУНКЦИИ СЕРВИСА
// ============================================================================

/**
 * Запуск валидации сети
 */
export async function runValidation(): Promise<ValidationResultData[]> {
  const allResults: ValidationResultData[] = [];

  // Очищаем предыдущие результаты
  await db.validationResult.deleteMany();

  // Запускаем все проверки
  const cableResults = await checkCableCapacity();
  const voltageResults = await checkVoltageDrop();
  const protectionResults = await checkProtectionSensitivity();
  const selectivityResults = await checkSelectivity();

  allResults.push(...cableResults, ...voltageResults, ...protectionResults, ...selectivityResults);

  // Создаём правила валидации если их нет
  const rules = [
    { code: 'CABLE_001', name: 'Соответствие тока выключателя и кабеля', severity: 'HIGH' },
    { code: 'VOLTAGE_001', name: 'Потеря напряжения', severity: 'MEDIUM' },
    { code: 'PROT_001', name: 'Чувствительность защиты', severity: 'CRITICAL' },
    { code: 'SEL_001', name: 'Селективность защит', severity: 'HIGH' },
  ];

  for (const rule of rules) {
    const existing = await db.validationRule.findUnique({ where: { code: rule.code } });
    if (!existing) {
      await db.validationRule.create({
        data: {
          id: `RULE_${rule.code}`,
          code: rule.code,
          name: rule.name,
          description: rule.name,
          category: rule.code.split('_')[0] as 'PROTECTION' | 'CABLE' | 'SELECTIVITY' | 'VOLTAGE',
          severity: rule.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        },
      });
    }
  }

  // Сохраняем результаты в БД
  for (const result of allResults) {
    const rule = await db.validationRule.findUnique({ where: { code: result.ruleCode } });
    if (rule) {
      await db.validationResult.create({
        data: {
          id: result.id,
          rule_id: rule.id,
          element_id: result.elementId,
          device_id: result.deviceId,
          connection_id: result.connectionId,
          status: result.status,
          actual_value: result.actualValue,
          expected_value: result.expectedValue,
          deviation: result.deviation,
          message: result.message,
          recommendation: result.recommendation,
        },
      });
    }
  }

  return allResults;
}

/**
 * Получить список проблем
 */
export async function getValidationIssues(): Promise<ValidationIssue[]> {
  const results = await db.validationResult.findMany({
    include: {
      rule: true,
      element: true,
      device: true,
    },
    orderBy: [
      { status: 'desc' }, // CRITICAL, FAIL, WARN, PASS
      { created_at: 'desc' },
    ],
  });

  return results.map(r => ({
    id: r.id,
    code: r.rule.code,
    name: r.rule.name,
    severity: r.status as ValidationStatus,
    elementName: r.element?.name || 'Неизвестный элемент',
    message: r.message,
    recommendation: r.recommendation || '',
    actualValue: r.actual_value || undefined,
    expectedValue: r.expected_value || undefined,
  }));
}

/**
 * Получить статистику валидации
 */
export async function getValidationStats(): Promise<{
  total: number;
  critical: number;
  fail: number;
  warn: number;
  pass: number;
}> {
  const results = await db.validationResult.findMany({
    select: { status: true },
  });

  return {
    total: results.length,
    critical: results.filter(r => r.status === 'CRITICAL').length,
    fail: results.filter(r => r.status === 'FAIL').length,
    warn: results.filter(r => r.status === 'WARN').length,
    pass: results.filter(r => r.status === 'PASS').length,
  };
}

export default {
  runValidation,
  getValidationIssues,
  getValidationStats,
};

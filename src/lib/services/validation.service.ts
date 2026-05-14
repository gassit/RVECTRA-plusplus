// ============================================================================
// СЕРВИС ВАЛИДАЦИИ СЕТИ
// ============================================================================

import { db } from '@/lib/db';
import type {
  ValidationResultData,
  ValidationIssue,
  ValidationStatus,
} from '@/types';

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

// Допустимые токи по ПУЭ (А) - медь, в воздухе, 3 жилы
// Ключ: сечение (мм²)
const IDOP_COPPER: Record<number, number> = {
  1.5: 19,
  2.5: 27,
  4: 36,
  6: 46,
  10: 64,
  16: 85,
  25: 112,
  35: 138,
  50: 166,
  70: 210,
  95: 255,
  120: 295,
  150: 340,
  185: 390,
  240: 465,
};

// Допустимые токи по ПУЭ (А) - алюминий, в воздухе, 3 жилы
// Ключ: сечение (мм²)
const IDOP_ALUMINUM: Record<number, number> = {
  2.5: 20,
  4: 27,
  6: 35,
  10: 47,
  16: 62,
  25: 80,
  35: 99,
  50: 119,
  70: 150,
  95: 184,
  120: 212,
  150: 245,
  185: 280,
  240: 335,
};

// Поправочные коэффициенты по количеству жил (ПУЭ)
// Базовый: 3 жилы = 1.0
const CORES_COEFFICIENT: Record<number, number> = {
  1: 1.0,   // Одножильный
  2: 1.0,   // Двухжильный
  3: 1.0,   // Трёхжильный (базовый)
  4: 0.92,  // Четырёхжильный
  5: 0.87,  // Пятижильный
  6: 0.82,  // Шестижильный
};

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Получить поправочный коэффициент по количеству жил
 */
function getCoresCoefficient(cores: number): number {
  if (CORES_COEFFICIENT[cores]) {
    return CORES_COEFFICIENT[cores];
  }
  // Если жил > 6, используем экстраполяцию
  if (cores > 6) {
    return 0.82 - (cores - 6) * 0.02;
  }
  return 1.0; // По умолчанию
}

/**
 * Получить допустимый ток для сечения, материала и количества жил
 */
function getIDopFromReference(section: number, material: string, cores: number = 3): number | null {
  const table = material.toLowerCase() === 'aluminum' || material.toLowerCase() === 'al'
    ? IDOP_ALUMINUM
    : IDOP_COPPER;

  // Базовый ток (для 3 жил)
  let baseCurrent: number | null = null;

  // Точное совпадение
  if (table[section]) {
    baseCurrent = table[section];
  } else {
    // Найти ближайшее большее сечение
    const sections = Object.keys(table).map(Number).sort((a, b) => a - b);
    for (const s of sections) {
      if (s >= section) {
        baseCurrent = table[s];
        break;
      }
    }

    // Если сечение больше максимального в таблице
    if (baseCurrent === null) {
      baseCurrent = table[sections[sections.length - 1]] || null;
    }
  }

  if (baseCurrent === null) return null;

  // Применяем поправочный коэффициент по количеству жил
  const coefficient = getCoresCoefficient(cores);
  return Math.round(baseCurrent * coefficient);
}

/**
 * Интерполяция допустимого тока для нестандартного сечения
 */
function interpolateIDop(section: number, material: string, cores: number = 3): number | null {
  const table = material.toLowerCase() === 'aluminum' || material.toLowerCase() === 'al'
    ? IDOP_ALUMINUM
    : IDOP_COPPER;

  const sections = Object.keys(table).map(Number).sort((a, b) => a - b);

  let baseCurrent: number | null = null;

  // Если сечение меньше минимального
  if (section < sections[0]) {
    baseCurrent = Math.round(table[sections[0]] * (section / sections[0]));
  }
  // Если сечение больше максимального
  else if (section > sections[sections.length - 1]) {
    baseCurrent = table[sections[sections.length - 1]];
  }
  // Интерполяция между соседними сечениями
  else {
    for (let i = 0; i < sections.length - 1; i++) {
      if (section >= sections[i] && section <= sections[i + 1]) {
        const ratio = (section - sections[i]) / (sections[i + 1] - sections[i]);
        baseCurrent = Math.round(table[sections[i]] + ratio * (table[sections[i + 1]] - table[sections[i]]));
        break;
      }
    }
  }

  if (baseCurrent === null) return null;

  // Применяем поправочный коэффициент по количеству жил
  const coefficient = getCoresCoefficient(cores);
  return Math.round(baseCurrent * coefficient);
}

// ============================================================================
// ОСНОВНЫЕ ФУНКЦИИ ВАЛИДАЦИИ
// ============================================================================

/**
 * Валидация сечения кабеля по току нагрузки
 */
async function validateCableSection(): Promise<ValidationResultData[]> {
  const results: ValidationResultData[] = [];

  // Получаем правило
  let rule = await db.validationRule.findUnique({ where: { name: 'SECTION_001' } });
  if (!rule) {
    rule = await db.validationRule.create({
      data: {
        id: `RULE_SECTION_001_${Date.now()}`,
        name: 'SECTION_001',
        description: 'Проверка сечения кабеля по допустимому току',
        formula: 'I_расч ≤ I_доп',
        severity: 'high',
        enabled: true,
      },
    });
  }

  // Получаем все связи с кабелями
  const connections = await db.connection.findMany({
    include: {
      Cable: true,
    },
  });

  for (const conn of connections) {
    if (!conn.Cable) continue;

    const cable = conn.Cable;

    // Пропускаем если нет сечения
    if (!cable.section || cable.section <= 0) continue;

    // Получаем расчётный ток
    // Приоритет: currentA из кабеля, иначе из нагрузки
    let currentA = cable.currentA;

    if (!currentA) {
      // Пробуем получить ток из нагрузки (target элемент)
      const targetElementId = conn.targetId;
      
      // Находим DeviceSlot для элемента
      const deviceSlot = await db.deviceSlot.findFirst({
        where: { elementId: targetElementId },
      });
      
      if (deviceSlot) {
        // Находим Device для slot
        const device = await db.device.findUnique({
          where: { deviceId: deviceSlot.id },
        });
        
        if (device) {
          // Находим Load для device
          const load = await db.load.findUnique({
            where: { deviceId: device.deviceId },
          });
          
          if (load && load.powerP) {
            // I = P / (√3 × U × cosφ)
            const voltage = 380; // В
            const cosPhi = load.cosPhi || 0.92;
            currentA = (load.powerP * 1000) / (Math.sqrt(3) * voltage * cosPhi);
          }
        }
      }
    }

    // Если нет тока - пропускаем
    if (!currentA || currentA <= 0) continue;

    // Получаем допустимый ток
    // Приоритет: iDop из кабеля (если указан), иначе из справочника
    let iDop = cable.iDop;

    if (!iDop || iDop <= 0) {
      // Пробуем CableReference
      if (cable.refId) {
        const cableRef = await db.cableReference.findUnique({ where: { id: cable.refId } });
        if (cableRef) {
          iDop = cableRef.iDop;
        }
      }

      // Если нет в CableReference - берём из таблицы ПУЭ
      if (!iDop || iDop <= 0) {
        iDop = getIDopFromReference(cable.section, cable.material, cable.cores) ||
               interpolateIDop(cable.section, cable.material, cable.cores);
      }
    }

    // Если не нашли допустимый ток - пропускаем
    if (!iDop || iDop <= 0) continue;

    // Проверка
    const ratio = currentA / iDop;
    let status: 'PASS' | 'WARN' | 'FAIL';
    let message: string;

    if (ratio <= 1.0) {
      status = ratio > 0.9 ? 'WARN' : 'PASS';
      message = ratio > 0.9
        ? `Ток ${currentA.toFixed(1)} А близок к допустимому ${iDop} А (${(ratio * 100).toFixed(1)}%)`
        : `Ток ${currentA.toFixed(1)} А в пределах допустимого ${iDop} А (${(ratio * 100).toFixed(1)}%)`;
    } else {
      status = 'FAIL';
      message = `ПЕРЕГРУЗКА: Ток ${currentA.toFixed(1)} А превышает допустимый ${iDop} А на ${((ratio - 1) * 100).toFixed(1)}%`;
    }

    // Создаём результат
    const result = await db.validationResult.create({
      data: {
        id: `VAL_SECTION_${cable.cableId}_${Date.now()}`,
        ruleId: rule.id,
        elementId: conn.sourceId,
        connectionId: conn.id,
        status,
        message,
        value: currentA,
        limit: iDop,
      },
    });

    results.push({
      id: result.id,
      ruleCode: rule.name,
      ruleName: rule.description,
      status,
      elementId: conn.sourceId,
      connectionId: conn.id,
      message,
      actualValue: currentA,
      expectedValue: iDop,
      deviation: ratio > 1 ? (ratio - 1) * 100 : undefined,
    });
  }

  return results;
}

/**
 * Валидация потери напряжения
 */
async function validateVoltageDrop(): Promise<ValidationResultData[]> {
  const results: ValidationResultData[] = [];

  // Получаем правило
  let rule = await db.validationRule.findUnique({ where: { name: 'VOLTAGE_001' } });
  if (!rule) {
    rule = await db.validationRule.create({
      data: {
        id: `RULE_VOLTAGE_001_${Date.now()}`,
        name: 'VOLTAGE_001',
        description: 'Проверка потери напряжения',
        formula: 'ΔU ≤ 5%',
        severity: 'medium',
        enabled: true,
      },
    });
  }

  // Получаем все связи с кабелями
  const connections = await db.connection.findMany({
    include: { Cable: true },
  });

  for (const conn of connections) {
    if (!conn.Cable) continue;
    const cable = conn.Cable;
    
    // Пропускаем если потеря напряжения не рассчитана
    if (cable.voltageDrop === null || cable.voltageDrop === undefined) continue;
    
    const voltageDrop = cable.voltageDrop;

    let status: 'PASS' | 'WARN' | 'FAIL';
    let message: string;

    if (voltageDrop <= 3) {
      status = 'PASS';
      message = `Потеря напряжения ${voltageDrop.toFixed(2)}% в норме`;
    } else if (voltageDrop <= 5) {
      status = 'WARN';
      message = `Потеря напряжения ${voltageDrop.toFixed(2)}% на границе нормы (до 5%)`;
    } else {
      status = 'FAIL';
      message = `ПРЕВЫШЕНИЕ: Потеря напряжения ${voltageDrop.toFixed(2)}% превышает допустимые 5%`;
    }

    const result = await db.validationResult.create({
      data: {
        id: `VAL_VOLTAGE_${cable.cableId}_${Date.now()}`,
        ruleId: rule.id,
        elementId: conn.sourceId,
        connectionId: conn.id,
        status,
        message,
        value: voltageDrop,
        limit: 5,
      },
    });

    results.push({
      id: result.id,
      ruleCode: rule.name,
      ruleName: rule.description,
      status,
      elementId: conn.sourceId,
      connectionId: conn.id,
      message,
      actualValue: voltageDrop,
      expectedValue: 5,
      deviation: voltageDrop > 5 ? voltageDrop - 5 : undefined,
    });
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
  const sectionResults = await validateCableSection();
  const voltageResults = await validateVoltageDrop();

  allResults.push(...sectionResults, ...voltageResults);

  return allResults;
}

/**
 * Получить список проблем
 */
export async function getValidationIssues(): Promise<ValidationIssue[]> {
  const results = await db.validationResult.findMany({
    include: {
      ValidationRule: true,
    },
    orderBy: [
      { status: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  return results.map(r => ({
    id: r.id,
    code: r.ValidationRule?.name || 'UNKNOWN',
    name: r.ValidationRule?.description || 'Неизвестное правило',
    severity: r.status as ValidationStatus,
    elementName: 'Элемент',
    message: r.message,
    recommendation: '',
    actualValue: r.value || undefined,
    expectedValue: r.limit || undefined,
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

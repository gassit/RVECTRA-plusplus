// ============================================================================
// СЕРВИС ВАЛИДАЦИИ СЕТИ
// ============================================================================

import { db } from '@/lib/db';
import type {
  ValidationResultData,
  ValidationIssue,
  ValidationStatus,
  ValidationTooltipDetails,
} from '@/types';

// ============================================================================
// КОНСТАНТЫ - ДОПУСТИМЫЕ ТОКИ ПО ПУЭ
// ============================================================================

/**
 * Структура справочника:
 * - cores: количество жил (2, 3, 4, 5)
 * - section: сечение (мм²)
 * - material: 'copper' или 'aluminum'
 * - iDop: допустимый ток (А)
 * 
 * Примечание:
 * - 4-5 жил → 0.4 кВ
 * - 2-3 жилы → 0.22 кВ
 */

// Ключ: "cores_section_material" → iDop (А)
// Источник: ПУЭ таблица 1.3.4-1.3.10 (бронированные кабели, прокладка в воздухе)
const PUE_CURRENT_TABLE: Record<string, number> = {
  // ==================== МЕДЬ (Cu) ====================
  // 3-жильные кабели (медь)
  '3_1.5_copper': 21,
  '3_2.5_copper': 27,
  '3_4_copper': 36,
  '3_6_copper': 46,
  '3_10_copper': 60,
  '3_16_copper': 85,
  '3_25_copper': 110,
  '3_35_copper': 135,
  '3_50_copper': 165,
  '3_70_copper': 210,
  '3_95_copper': 250,
  '3_120_copper': 290,
  '3_150_copper': 330,
  '3_185_copper': 375,
  '3_240_copper': 430,

  // 4-жильные кабели (медь)
  '4_1.5_copper': 19,
  '4_2.5_copper': 25,
  '4_4_copper': 34,
  '4_6_copper': 43,
  '4_10_copper': 58,
  '4_16_copper': 80,
  '4_25_copper': 105,
  '4_35_copper': 125,
  '4_50_copper': 155,
  '4_70_copper': 195,
  '4_95_copper': 230,
  '4_120_copper': 270,
  '4_150_copper': 305,
  '4_185_copper': 350,
  '4_240_copper': 400,

  // 5-жильные кабели (медь)
  '5_1.5_copper': 18,
  '5_2.5_copper': 21,
  '5_4_copper': 30,
  '5_6_copper': 38,
  '5_10_copper': 52,
  '5_16_copper': 68,
  '5_25_copper': 90,
  '5_35_copper': 110,
  '5_50_copper': 135,
  '5_70_copper': 170,
  '5_95_copper': 205,
  '5_120_copper': 235,
  '5_150_copper': 270,
  '5_185_copper': 305,
  '5_240_copper': 350,

  // ==================== АЛЮМИНИЙ (Al) ====================
  // 3-жильные кабели (алюминий)
  '3_2.5_aluminum': 21,
  '3_4_aluminum': 29,
  '3_6_aluminum': 38,
  '3_10_aluminum': 55,
  '3_16_aluminum': 70,
  '3_25_aluminum': 90,
  '3_35_aluminum': 110,
  '3_50_aluminum': 135,
  '3_70_aluminum': 175,
  '3_95_aluminum': 210,
  '3_120_aluminum': 245,
  '3_150_aluminum': 280,
  '3_185_aluminum': 320,
  '3_240_aluminum': 370,

  // 4-жильные кабели (алюминий)
  '4_2.5_aluminum': 19,
  '4_4_aluminum': 27,
  '4_6_aluminum': 35,
  '4_10_aluminum': 47,
  '4_16_aluminum': 62,
  '4_25_aluminum': 80,
  '4_35_aluminum': 99,
  '4_50_aluminum': 119,
  '4_70_aluminum': 150,
  '4_95_aluminum': 184,
  '4_120_aluminum': 212,
  '4_150_aluminum': 245,
  '4_185_aluminum': 280,
  '4_240_aluminum': 335,

  // 5-жильные кабели (алюминий)
  '5_2.5_aluminum': 17,
  '5_4_aluminum': 24,
  '5_6_aluminum': 31,
  '5_10_aluminum': 42,
  '5_16_aluminum': 55,
  '5_25_aluminum': 70,
  '5_35_aluminum': 86,
  '5_50_aluminum': 104,
  '5_70_aluminum': 131,
  '5_95_aluminum': 160,
  '5_120_aluminum': 185,
  '5_150_aluminum': 213,
  '5_185_aluminum': 244,
  '5_240_aluminum': 292,
};

// ============================================================================
// ТИПЫ
// ============================================================================

/**
 * Источник допустимого тока
 */
type IDopSource = 'input' | 'cableReference' | 'PUE';

/**
 * Расширенный результат валидации с деталями для tooltip
 */
interface CableValidationDetails {
  /** Номинальный ток выключателя (А) */
  iNom: number;
  /** Допустимый ток, использованный при проверке (А) */
  iDopUsed: number;
  /** Источник допустимого тока */
  iDopSource: IDopSource;
  /** Допустимый ток по ПУЭ (А) - для сравнения */
  iDopFromPUE: number | null;
  /** Загрузка кабеля (%) */
  loadingPercent: number;
  /** Расчётный ток (А) - для справки */
  iRasch: number | null;
  /** Предупреждение о расхождении данных */
  discrepancyWarning?: string;
  /** Данные для tooltip */
  tooltip: {
    iNom: string;
    iDopPUE: string;
    loadingPercent: string;
    iRasch?: string;
    warning?: string;
  };
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Определить уровень напряжения по количеству жил
 */
function getVoltageByCores(cores: number): number {
  if (cores >= 4) return 0.4;   // 4-5 жил → 0.4 кВ
  if (cores >= 2) return 0.22;  // 2-3 жилы → 0.22 кВ
  return 0.22;                  // По умолчанию
}

/**
 * Получить допустимый ток из справочника ПУЭ
 */
function getIDopFromPUE(section: number, material: string, cores: number): number | null {
  // Нормализация материала
  const mat = material.toLowerCase() === 'aluminum' || material.toLowerCase() === 'al'
    ? 'aluminum'
    : 'copper';

  // Формируем ключ для поиска
  const key = `${cores}_${section}_${mat}`;

  // Точное совпадение
  if (PUE_CURRENT_TABLE[key]) {
    return PUE_CURRENT_TABLE[key];
  }

  // Если нет точного совпадения - ищем ближайшее большее сечение
  const sections = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
  
  for (const s of sections) {
    const searchKey = `${cores}_${s}_${mat}`;
    if (s >= section && PUE_CURRENT_TABLE[searchKey]) {
      return PUE_CURRENT_TABLE[searchKey];
    }
  }

  // Если сечение больше максимального в таблице
  const maxKey = `${cores}_240_${mat}`;
  if (PUE_CURRENT_TABLE[maxKey]) {
    return PUE_CURRENT_TABLE[maxKey];
  }

  return null;
}

/**
 * Интерполяция для нестандартных сечений
 */
function interpolateIDop(section: number, material: string, cores: number): number | null {
  const mat = material.toLowerCase() === 'aluminum' || material.toLowerCase() === 'al'
    ? 'aluminum'
    : 'copper';

  const sections = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];

  // Найти соседние сечения для интерполяции
  for (let i = 0; i < sections.length - 1; i++) {
    if (section >= sections[i] && section <= sections[i + 1]) {
      const key1 = `${cores}_${sections[i]}_${mat}`;
      const key2 = `${cores}_${sections[i + 1]}_${mat}`;
      
      const i1 = PUE_CURRENT_TABLE[key1];
      const i2 = PUE_CURRENT_TABLE[key2];
      
      if (i1 && i2) {
        const ratio = (section - sections[i]) / (sections[i + 1] - sections[i]);
        return Math.round(i1 + ratio * (i2 - i1));
      }
    }
  }

  return null;
}

/**
 * Формирование деталей валидации для tooltip
 */
function buildValidationDetails(
  iNom: number,
  iDopUsed: number,
  iDopSource: IDopSource,
  iDopFromPUE: number | null,
  iRasch?: number | null
): CableValidationDetails {
  const loadingPercent = (iNom / iDopUsed) * 100;
  
  let discrepancyWarning: string | undefined;
  
  // Проверяем расхождение между input и ПУЭ
  if (iDopSource === 'input' && iDopFromPUE !== null) {
    const diff = Math.abs(iDopUsed - iDopFromPUE);
    const diffPercent = (diff / iDopFromPUE) * 100;
    
    if (diffPercent > 5) {
      discrepancyWarning = `⚠️ Допустимый ток из файла (${iDopUsed}А) отличается от ПУЭ (${iDopFromPUE}А) на ${diffPercent.toFixed(1)}%`;
    }
  }
  
  // Проверяем расхождение между CableReference и ПУЭ
  if (iDopSource === 'cableReference' && iDopFromPUE !== null) {
    const diff = Math.abs(iDopUsed - iDopFromPUE);
    const diffPercent = (diff / iDopFromPUE) * 100;
    
    if (diffPercent > 5) {
      discrepancyWarning = `⚠️ Допустимый ток из справочника БД (${iDopUsed}А) отличается от ПУЭ (${iDopFromPUE}А) на ${diffPercent.toFixed(1)}%`;
    }
  }
  
  // Формируем tooltip
  const tooltip: CableValidationDetails['tooltip'] = {
    iNom: `${iNom} А`,
    iDopPUE: iDopFromPUE !== null 
      ? `${iDopFromPUE} А` 
      : 'Нет данных',
    loadingPercent: `${loadingPercent.toFixed(1)}%`,
  };
  
  // Добавляем расчётный ток для справки (если есть)
  if (iRasch !== null && iRasch !== undefined) {
    tooltip.iRasch = `${iRasch.toFixed(1)} А`;
  }
  
  if (discrepancyWarning) {
    tooltip.warning = discrepancyWarning;
  }
  
  return {
    iNom,
    iDopUsed,
    iDopSource,
    iDopFromPUE,
    loadingPercent,
    iRasch: iRasch ?? null,
    discrepancyWarning,
    tooltip,
  };
}

// ============================================================================
// ОСНОВНЫЕ ФУНКЦИИ ВАЛИДАЦИИ
// ============================================================================

/**
 * Валидация сечения кабеля по номинальному току выключателя
 * Проверка: I_ном (выключателя) ≤ I_доп (кабеля)
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
        description: 'Проверка сечения кабеля по номинальному току выключателя',
        formula: 'I_ном ≤ I_доп',
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

    // === Получаем номинальный ток выключателя (I_ном) ===
    // Выключатель защищающий кабель находится в source-элементе (в начале линии)
    let iNom: number | null = null;
    
    // Ищем DeviceSlot в source-элементе
    const sourceDeviceSlot = await db.deviceSlot.findFirst({
      where: { elementId: conn.sourceId },
    });
    
    if (sourceDeviceSlot) {
      // Ищем Device (выключатель) в slot
      const device = await db.device.findUnique({
        where: { deviceId: sourceDeviceSlot.id },
      });
      
      if (device && device.deviceType === 'BREAKER') {
        // Для BREAKER нужно получить ratedCurrent из таблицы Breaker
        const breaker = await db.breaker.findUnique({
          where: { deviceId: device.deviceId },
        });
        if (breaker && breaker.ratedCurrent) {
          iNom = breaker.ratedCurrent;
        }
      }
    }
    
    // Если не нашли через Device/Breaker, пробуем найти Breaker через DeviceSlot
    if (!iNom) {
      // Ищем все DeviceSlots для элемента
      const allSlots = await db.deviceSlot.findMany({
        where: { elementId: conn.sourceId },
      });
      
      for (const slot of allSlots) {
        const dev = await db.device.findUnique({
          where: { deviceId: slot.id },
        });
        
        if (dev && dev.deviceType === 'BREAKER') {
          const breaker = await db.breaker.findUnique({
            where: { deviceId: dev.deviceId },
          });
          
          if (breaker && breaker.ratedCurrent) {
            iNom = breaker.ratedCurrent;
            break;
          }
        }
      }
    }

    // Если нет выключателя - пропускаем
    if (!iNom || iNom <= 0) continue;

    // === Получаем допустимый ток кабеля (I_доп) с приоритетом источников ===
    let iDop: number | null = null;
    let iDopSource: IDopSource = 'PUE';
    
    // 1. Сначала получаем значение из ПУЭ для сравнения
    const iDopFromPUE = getIDopFromPUE(cable.section, cable.material, cable.cores) ||
                        interpolateIDop(cable.section, cable.material, cable.cores);

    // 2. Проверяем приоритет источников для iDop
    
    // Приоритет 1: Допустимый ток из input-файла (cable.iDop)
    if (cable.iDop && cable.iDop > 0) {
      iDop = cable.iDop;
      iDopSource = 'input';
    }
    
    // Приоритет 2: CableReference (справочник в БД)
    if (!iDop && cable.refId) {
      const cableRef = await db.cableReference.findUnique({ where: { id: cable.refId } });
      if (cableRef && cableRef.iDop && cableRef.iDop > 0) {
        iDop = cableRef.iDop;
        iDopSource = 'cableReference';
      }
    }
    
    // Приоритет 3: Таблица ПУЭ
    if (!iDop) {
      iDop = iDopFromPUE;
      iDopSource = 'PUE';
    }

    // Если не нашли допустимый ток - пропускаем
    if (!iDop || iDop <= 0) continue;

    // === Рассчитываем I_расч для справки ===
    let iRasch: number | null = null;
    
    // Пробуем получить ток из нагрузки (target элемент)
    const targetDeviceSlot = await db.deviceSlot.findFirst({
      where: { elementId: conn.targetId },
    });
    
    if (targetDeviceSlot) {
      const targetDevice = await db.device.findUnique({
        where: { deviceId: targetDeviceSlot.id },
      });
      
      if (targetDevice) {
        const load = await db.load.findUnique({
          where: { deviceId: targetDevice.deviceId },
        });
        
        if (load && load.powerP) {
          // I = P / (√3 × U × cosφ)
          const voltage = 380; // В
          const cosPhi = load.cosPhi || 0.92;
          iRasch = (load.powerP * 1000) / (Math.sqrt(3) * voltage * cosPhi);
        }
      }
    }

    // === Формируем детали для tooltip ===
    const details = buildValidationDetails(iNom, iDop, iDopSource, iDopFromPUE, iRasch);

    // === Проверка: I_ном ≤ I_доп ===
    const ratio = iNom / iDop;
    let status: 'PASS' | 'WARN' | 'FAIL';
    let message: string;

    if (ratio <= 1.0) {
      status = ratio > 0.9 ? 'WARN' : 'PASS';
      message = ratio > 0.9
        ? `I_ном=${iNom}А близок к I_доп=${iDop}А (${details.tooltip.loadingPercent})`
        : `I_ном=${iNom}А ≤ I_доп=${iDop}А (${details.tooltip.loadingPercent})`;
    } else {
      status = 'FAIL';
      message = `НЕСООТВЕТСТВИЕ: I_ном=${iNom}А > I_доп=${iDop}А (превышение на ${((ratio - 1) * 100).toFixed(1)}%)`;
    }

    // Добавляем предупреждение о расхождении данных
    if (details.discrepancyWarning) {
      message += `\n${details.discrepancyWarning}`;
    }

    // Создаём результат с расширенными данными
    const result = await db.validationResult.create({
      data: {
        id: `VAL_SECTION_${cable.cableId}_${Date.now()}`,
        ruleId: rule.id,
        elementId: conn.sourceId,
        connectionId: conn.id,
        status,
        message,
        value: iNom,
        limit: iDop,
        // Сохраняем дополнительные данные в JSON формате
        details: details.tooltip,
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
      actualValue: iNom,
      expectedValue: iDop,
      deviation: ratio > 1 ? (ratio - 1) * 100 : undefined,
      // Добавляем детали для tooltip
      details: details.tooltip,
    } as ValidationResultData);
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
    // Добавляем детали для tooltip
    details: r.details ? (r.details as unknown as ValidationTooltipDetails) : undefined,
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

/**
 * Экспорт таблицы ПУЭ для использования в UI
 */
export function getPueCurrentTable(): Record<string, number> {
  return { ...PUE_CURRENT_TABLE };
}

/**
 * Экспорт функции получения тока по ПУЭ
 */
export { getIDopFromPUE, getVoltageByCores };

export default {
  runValidation,
  getValidationIssues,
  getValidationStats,
  getPueCurrentTable,
  getIDopFromPUE,
  getVoltageByCores,
};

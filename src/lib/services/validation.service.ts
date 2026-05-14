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
// КОНСТАНТЫ - ДОПУСТИМЫЕ ТОКИ ПО ПУЭ
// ============================================================================

/**
 * Структура справочника:
 * - cores: количество жил (3, 4, 5)
 * - section: сечение (мм²)
 * - material: 'copper' или 'aluminum'
 * - iDop: допустимый ток (А)
 * 
 * Примечание:
 * - 4-5 жил → 0.4 кВ
 * - 2-3 жилы → 0.22 кВ
 */

// Ключ: "cores_section_material" → iDop (А)
// Источник: ПУЭ таблица 1.3.4-1.3.5
const PUE_CURRENT_TABLE: Record<string, number> = {
  // === 3 ЖИЛЫ (базовые, для 0.22 кВ) ===
  // Медь
  '3_1.5_copper': 19,
  '3_2.5_copper': 27,
  '3_4_copper': 38,
  '3_6_copper': 46,
  '3_10_copper': 70,
  '3_16_copper': 85,
  '3_25_copper': 115,
  '3_35_copper': 135,
  '3_50_copper': 175,
  '3_70_copper': 215,
  '3_95_copper': 260,
  '3_120_copper': 300,
  // Алюминий
  '3_2.5_aluminum': 20,
  '3_4_aluminum': 28,
  '3_6_aluminum': 36,
  '3_10_aluminum': 50,
  '3_16_aluminum': 60,
  '3_25_aluminum': 85,
  '3_35_aluminum': 100,
  '3_50_aluminum': 135,
  '3_70_aluminum': 165,
  '3_95_aluminum': 200,
  '3_120_aluminum': 230,

  // === 4 ЖИЛЫ (для 0.4 кВ) ===
  // Медь
  '4_4_copper': 30,
  '4_6_copper': 40,
  '4_10_copper': 50,
  '4_16_copper': 75,
  '4_25_copper': 90,
  '4_35_copper': 115,
  '4_50_copper': 150,
  '4_70_copper': 185,
  '4_95_copper': 225,
  '4_120_copper': 260,
  // Алюминий
  '4_4_aluminum': 23,
  '4_6_aluminum': 30,
  '4_10_aluminum': 39,
  '4_16_aluminum': 55,
  '4_25_aluminum': 70,
  '4_35_aluminum': 85,
  '4_50_aluminum': 120,
  '4_70_aluminum': 140,
  '4_95_aluminum': 175,
  '4_120_aluminum': 200,

  // === 5 ЖИЛ (для 0.4 кВ) ===
  // Медь
  '5_1.5_copper': 16,
  '5_2.5_copper': 25,
  '5_4_copper': 30,
  '5_6_copper': 40,
  '5_10_copper': 50,
  '5_16_copper': 75,
  '5_25_copper': 90,
  '5_35_copper': 115,
  '5_50_copper': 145,
  '5_70_copper': 180,
  '5_95_copper': 220,
  '5_120_copper': 260,
  '5_150_copper': 330,
  '5_185_copper': 500,
  '5_240_copper': 600,
  '5_300_copper': 680,
  '5_400_copper': 800,
  // Алюминий
  '5_2.5_aluminum': 23,
  '5_4_aluminum': 30,
  '5_6_aluminum': 39,
  '5_10_aluminum': 55,
  '5_16_aluminum': 70,
  '5_25_aluminum': 85,
  '5_35_aluminum': 110,
  '5_50_aluminum': 140,
  '5_70_aluminum': 170,
  '5_95_aluminum': 200,
  '5_120_aluminum': 230,
  '5_150_aluminum': 255,
  '5_185_aluminum': 350,
  '5_240_aluminum': 450,
  '5_300_aluminum': 500,
  '5_400_aluminum': 600,
};

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
  const sections = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400];
  
  for (const s of sections) {
    const searchKey = `${cores}_${s}_${mat}`;
    if (s >= section && PUE_CURRENT_TABLE[searchKey]) {
      return PUE_CURRENT_TABLE[searchKey];
    }
  }

  // Если сечение больше максимального в таблице
  const maxKey = `${cores}_400_${mat}`;
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

  const sections = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400];

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
        iDop = getIDopFromPUE(cable.section, cable.material, cable.cores) ||
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

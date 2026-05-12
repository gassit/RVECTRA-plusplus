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
// ОСНОВНЫЕ ФУНКЦИИ СЕРВИСА
// ============================================================================

/**
 * Запуск валидации сети
 * TODO: Реализовать с обновлённой схемой БД
 */
export async function runValidation(): Promise<ValidationResultData[]> {
  const allResults: ValidationResultData[] = [];

  // Очищаем предыдущие результаты
  await db.validationResult.deleteMany();

  // Создаём правила валидации если их нет
  const rules = [
    { name: 'CABLE_001', description: 'Соответствие тока выключателя и кабеля', severity: 'HIGH' },
    { name: 'VOLTAGE_001', description: 'Потеря напряжения', severity: 'MEDIUM' },
    { name: 'PROT_001', description: 'Чувствительность защиты', severity: 'CRITICAL' },
    { name: 'SEL_001', description: 'Селективность защит', severity: 'HIGH' },
  ];

  for (const rule of rules) {
    const existing = await db.validationRule.findUnique({ where: { name: rule.name } });
    if (!existing) {
      await db.validationRule.create({
        data: {
          id: `RULE_${rule.name}`,
          name: rule.name,
          description: rule.description,
          formula: '',
          severity: rule.severity.toLowerCase(),
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

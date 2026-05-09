// ============================================================================
// РАСЧЁТ ПОТЕРЬ НАПРЯЖЕНИЯ
// ============================================================================

import type { MaterialType } from '@/types';

/**
 * Расчёт потери напряжения в линии
 * 
 * @param pKw - Активная мощность (кВт)
 * @param qKvar - Реактивная мощность (квар)
 * @param rOhm - Активное сопротивление линии (Ом)
 * @param xOhm - Реактивное сопротивление линии (Ом)
 * @param uKv - Номинальное напряжение (кВ)
 * @returns Потеря напряжения (%)
 */
export function calculateVoltageDrop(
  pKw: number,
  qKvar: number,
  rOhm: number,
  xOhm: number,
  uKv: number
): number {
  // ΔU = (P*R + Q*X) / U² * 100%
  // Для трёхфазной сети:
  // ΔU% = (P*R + Q*X) / (10 * U²) - где U в кВ, P в кВт, Q в квар
  const uKvSquared = uKv * uKv;
  
  const deltaU = (pKw * rOhm + qKvar * xOhm) / (10 * uKvSquared);
  
  return deltaU;
}

/**
 * Расчёт потери напряжения по току и параметрам кабеля
 * 
 * @param current - Ток (А)
 * @param rOhm - Активное сопротивление линии (Ом)
 * @param xOhm - Реактивное сопротивление линии (Ом)
 * @param cosPhi - Коэффициент мощности
 * @param uV - Номинальное напряжение (В)
 * @returns Потеря напряжения (%)
 */
export function calculateVoltageDropByCurrent(
  current: number,
  rOhm: number,
  xOhm: number,
  cosPhi: number,
  uV: number
): number {
  const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
  
  // ΔU% = √3 * I * (R*cosφ + X*sinφ) / U * 100%
  const deltaU = (Math.sqrt(3) * current * (rOhm * cosPhi + xOhm * sinPhi) / uV) * 100;
  
  return deltaU;
}

/**
 * Расчёт потери напряжения в кабеле по длине
 * 
 * @param current - Ток (А)
 * @param length - Длина кабеля (м)
 * @param wireSize - Сечение жилы (мм²)
 * @param material - Материал проводника
 * @param cosPhi - Коэффициент мощности
 * @param uV - Номинальное напряжение (В)
 * @returns Потеря напряжения (%)
 */
export function calculateVoltageDropByLength(
  current: number,
  length: number,
  wireSize: number,
  material: MaterialType,
  cosPhi: number,
  uV: number
): number {
  // Удельное сопротивление (Ом·мм²/м)
  const rho = material === 'Cu' ? 0.0175 : 0.0294;
  
  // Активное сопротивление кабеля
  const rOhm = (rho * length) / wireSize;
  
  // Реактивное сопротивление (приближённо)
  const xOhm = 0.00008 * length; // 0.08 Ом/км * L(м) / 1000
  
  return calculateVoltageDropByCurrent(current, rOhm, xOhm, cosPhi, uV);
}

/**
 * Проверка допустимости потери напряжения
 * 
 * @param voltageDropPercent - Потеря напряжения (%)
 * @param maxAllowedPercent - Максимально допустимая потеря (%)
 * @returns true если потеря допустима
 */
export function isVoltageDropAcceptable(
  voltageDropPercent: number,
  maxAllowedPercent: number = 4
): boolean {
  return voltageDropPercent <= maxAllowedPercent;
}

/**
 * Расчёт отклонения напряжения в конце линии
 * 
 * @param uSource - Напряжение источника (В)
 * @param voltageDropPercent - Потеря напряжения (%)
 * @param uNom - Номинальное напряжение (В)
 * @returns Напряжение в конце линии (В)
 */
export function calculateEndVoltage(
  uSource: number,
  voltageDropPercent: number,
  uNom: number
): number {
  // Uкон = Uист * (1 - ΔU% / 100)
  // Но обычно считаем от номинального:
  // Uкон = Uном * (1 - ΔU% / 100)
  return uNom * (1 - voltageDropPercent / 100);
}

/**
 * Расчёт минимального сечения кабеля по потере напряжения
 * 
 * @param pKw - Активная мощность (кВт)
 * @param length - Длина кабеля (м)
 * @param material - Материал проводника
 * @param maxDropPercent - Максимально допустимая потеря (%)
 * @param uV - Номинальное напряжение (В)
 * @param cosPhi - Коэффициент мощности
 * @returns Минимальное сечение (мм²)
 */
export function calculateMinWireSizeForVoltageDrop(
  pKw: number,
  length: number,
  material: MaterialType,
  maxDropPercent: number,
  uV: number,
  cosPhi: number = 0.9
): number {
  // Удельное сопротивление (Ом·мм²/м)
  const rho = material === 'Cu' ? 0.0175 : 0.0294;
  
  // Ток нагрузки
  const current = (pKw * 1000) / (Math.sqrt(3) * uV * cosPhi);
  
  // Минимальное сечение: S = (√3 * I * L * ρ * cosφ) / (ΔU% * U / 100)
  const minSize = (Math.sqrt(3) * current * length * rho * cosPhi) / (maxDropPercent * uV / 100);
  
  // Округляем до ближайшего стандартного сечения
  const standardSizes = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
  
  for (const size of standardSizes) {
    if (size >= minSize) {
      return size;
    }
  }
  
  return standardSizes[standardSizes.length - 1];
}

/**
 * Форматирование потери напряжения для отображения
 */
export function formatVoltageDrop(voltageDropPercent: number): string {
  return `${voltageDropPercent.toFixed(2)}%`;
}

export default {
  calculateVoltageDrop,
  calculateVoltageDropByCurrent,
  calculateVoltageDropByLength,
  isVoltageDropAcceptable,
  calculateEndVoltage,
  calculateMinWireSizeForVoltageDrop,
  formatVoltageDrop,
};

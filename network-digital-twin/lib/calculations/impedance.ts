// ============================================================================
// РАСЧЁТ СОПРОТИВЛЕНИЙ КАБЕЛЯ
// ============================================================================

import type { ImpedanceResult, MaterialType } from '@/types';
import { findCableReference, getCableCurrentCapacity } from '@/lib/data/references';

/**
 * Расчёт сопротивления кабеля
 * 
 * @param length - Длина кабеля (м)
 * @param wireSize - Сечение жилы (мм²)
 * @param material - Материал проводника ('Cu' | 'Al')
 * @param wireType - Марка кабеля (АВВГ, ВВГ и т.д.)
 * @returns Объект с активным, реактивным и полным сопротивлением
 */
export function calculateCableImpedance(
  length: number,
  wireSize: number,
  material: MaterialType,
  wireType?: string
): ImpedanceResult {
  // Базовые значения удельного сопротивления (Ом·мм²/м) при 20°C
  const rho = material === 'Cu' ? 0.0175 : 0.0294;
  
  // Базовые значения реактивного сопротивления (Ом/км)
  const xBase = 0.08; // Среднее значение для кабелей 0.4 кВ
  
  // Расчёт активного сопротивления (Ом)
  // R = ρ * L / S
  const r = (rho * length) / wireSize;
  
  // Расчёт реактивного сопротивления (Ом)
  // X = x0 * L / 1000 (перевод из Ом/км)
  const x = (xBase * length) / 1000;
  
  // Расчёт полного сопротивления (Ом)
  // Z = √(R² + X²)
  const z = Math.sqrt(r * r + x * x);
  
  return { r, x, z };
}

/**
 * Расчёт сопротивления кабеля с использованием данных из справочника
 * 
 * @param length - Длина кабеля (м)
 * @param wireType - Марка кабеля (АВВГ, ВВГ)
 * @param wireSize - Сечение жилы (мм²)
 * @returns Объект с активным, реактивным и полным сопротивлением или null если кабель не найден
 */
export function calculateCableImpedanceFromReference(
  length: number,
  wireType: string,
  wireSize: number
): ImpedanceResult | null {
  const cableRef = findCableReference(wireType, wireSize);
  
  if (!cableRef) {
    return null;
  }
  
  // Расчёт активного сопротивления (Ом)
  // R = R0 * L / 1000 (перевод из Ом/км)
  const r = (cableRef.rOhmKm * length) / 1000;
  
  // Расчёт реактивного сопротивления (Ом)
  // X = X0 * L / 1000 (перевод из Ом/км)
  const x = (cableRef.xOhmKm * length) / 1000;
  
  // Расчёт полного сопротивления (Ом)
  // Z = √(R² + X²)
  const z = Math.sqrt(r * r + x * x);
  
  return { r, x, z };
}

/**
 * Расчёт допустимого тока кабеля
 * 
 * @param wireType - Марка кабеля
 * @param wireSize - Сечение жилы (мм²)
 * @param installationMethod - Способ прокладки
 * @returns Допустимый ток (А) или null если кабель не найден
 */
export function calculateCableCurrentCapacity(
  wireType: string,
  wireSize: number,
  installationMethod: string
): number | null {
  const cableRef = findCableReference(wireType, wireSize);
  
  if (!cableRef) {
    return null;
  }
  
  return getCableCurrentCapacity(cableRef, installationMethod);
}

/**
 * Корректировка сопротивления кабеля по температуре
 * 
 * @param r20 - Сопротивление при 20°C (Ом)
 * @param temperature - Фактическая температура (°C)
 * @param alpha - Температурный коэффициент (по умолчанию для меди/алюминия)
 * @returns Скорректированное сопротивление (Ом)
 */
export function adjustResistanceForTemperature(
  r20: number,
  temperature: number,
  alpha: number = 0.004
): number {
  // R_t = R_20 * (1 + α * (t - 20))
  return r20 * (1 + alpha * (temperature - 20));
}

/**
 * Расчёт потерь мощности в кабеле
 * 
 * @param current - Ток (А)
 * @param r - Активное сопротивление (Ом)
 * @returns Потери мощности (Вт)
 */
export function calculateCablePowerLoss(current: number, r: number): number {
  // ΔP = 3 * I² * R (для трёхфазной сети)
  return 3 * current * current * r;
}

export default {
  calculateCableImpedance,
  calculateCableImpedanceFromReference,
  calculateCableCurrentCapacity,
  adjustResistanceForTemperature,
  calculateCablePowerLoss,
};

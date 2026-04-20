// ============================================================================
// РАСЧЁТ ТОКОВ КОРОТКОГО ЗАМЫКАНИЯ
// ============================================================================

import type { ShortCircuitResult } from '@/types';

/**
 * Расчёт токов короткого замыкания
 * 
 * @param zSystem - Сопротивление системы/источника (Ом)
 * @param zCable - Сопротивление кабеля до точки КЗ (Ом)
 * @param voltage - Номинальное напряжение (В)
 * @returns Объект с токами трёхфазного, однофазного и двухфазного КЗ
 */
export function calculateShortCircuit(
  zSystem: number,
  zCable: number,
  voltage: number
): ShortCircuitResult {
  // Полное сопротивление до точки КЗ
  const zk = zSystem + zCable;
  
  // Ток трёхфазного КЗ (А)
  // Iк3 = U / (√3 * Zк)
  const ik3 = voltage / (Math.sqrt(3) * zk);
  
  // Ток двухфазного КЗ (А)
  // Iк2 = Iк3 * √3 / 2 ≈ 0.87 * Iк3
  const ik2 = ik3 * Math.sqrt(3) / 2;
  
  // Ток однофазного КЗ (А) - упрощённая формула
  // Iк1 = Uф / Zк = U / (√3 * Zк * 2) - учитываем сопротивление петли
  // Для более точного расчёта нужны сопротивления прямой и нулевой последовательности
  const ik1 = voltage / (Math.sqrt(3) * zk * 2);
  
  return {
    ik3,
    ik1,
    ik2,
    zk,
  };
}

/**
 * Расчёт токов КЗ с учётом сопротивлений трансформатора
 * 
 * @param transformerPower - Мощность трансформатора (кВА)
 * @param ukPercent - Напряжение КЗ трансформатора (%)
 * @param zCable - Сопротивление кабеля до точки КЗ (Ом)
 * @param voltage - Номинальное напряжение НН (В)
 * @returns Объект с токами КЗ
 */
export function calculateShortCircuitWithTransformer(
  transformerPower: number,
  ukPercent: number,
  zCable: number,
  voltage: number = 400
): ShortCircuitResult {
  // Сопротивление трансформатора (Ом)
  // Zт = (Uк% * U²) / (100 * S)
  const zTransformer = (ukPercent * voltage * voltage) / (100 * transformerPower * 1000);
  
  // Сопротивление системы на стороне НН (упрощённо принимаем бесконечную мощность)
  const zSystem = zTransformer;
  
  return calculateShortCircuit(zSystem, zCable, voltage);
}

/**
 * Расчёт ударного тока КЗ
 * 
 * @param ik3 - Ток трёхфазного КЗ (А)
 * @param kud - Ударный коэффициент (обычно 1.8 для сетей 0.4 кВ)
 * @returns Ударный ток (А)
 */
export function calculatePeakShortCircuitCurrent(ik3: number, kud: number = 1.8): number {
  // iуд = √2 * Kуд * Iк3
  return Math.sqrt(2) * kud * ik3;
}

/**
 * Проверка чувствительности защиты
 * 
 * @param ikMin - Минимальный ток КЗ в конце зоны защиты (А)
 * @param inBreaker - Номинальный ток расцепителя выключателя (А)
 * @param requiredRatio - Требуемая кратность (обычно 3 для МТЗ)
 * @returns true если защита чувствительна
 */
export function checkProtectionSensitivity(
  ikMin: number,
  inBreaker: number,
  requiredRatio: number = 3
): boolean {
  return ikMin >= requiredRatio * inBreaker;
}

/**
 * Расчёт сопротивления системы по известному току КЗ
 * 
 * @param ik3 - Ток трёхфазного КЗ на шинах (А)
 * @param voltage - Номинальное напряжение (В)
 * @returns Сопротивление системы (Ом)
 */
export function calculateSystemImpedance(ik3: number, voltage: number): number {
  // Zс = U / (√3 * Iк3)
  return voltage / (Math.sqrt(3) * ik3);
}

/**
 * Определение минимального тока КЗ (в конце линии)
 * 
 * @param zSource - Сопротивление источника (Ом)
 * @param zLine - Сопротивление линии (Ом)
 * @param voltage - Номинальное напряжение (В)
 * @returns Минимальный ток КЗ (А)
 */
export function calculateMinShortCircuitCurrent(
  zSource: number,
  zLine: number,
  voltage: number
): number {
  // Учитываем увеличение сопротивления при нагреве (коэффициент 1.5)
  const zTotal = zSource + zLine * 1.5;
  
  // Минимальный ток КЗ (однофазное КЗ в конце линии)
  return voltage / (Math.sqrt(3) * zTotal * 2);
}

/**
 * Форматирование тока КЗ для отображения
 */
export function formatShortCircuitCurrent(current: number): string {
  if (current >= 1000) {
    return `${(current / 1000).toFixed(2)} кА`;
  }
  return `${current.toFixed(0)} А`;
}

export default {
  calculateShortCircuit,
  calculateShortCircuitWithTransformer,
  calculatePeakShortCircuitCurrent,
  checkProtectionSensitivity,
  calculateSystemImpedance,
  calculateMinShortCircuitCurrent,
  formatShortCircuitCurrent,
};

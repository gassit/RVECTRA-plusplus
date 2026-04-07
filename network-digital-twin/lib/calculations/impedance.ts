// ============================================================================
// РАСЧЁТ СОПРОТИВЛЕНИЙ КАБЕЛЯ
// Методы для расчёта активного, реактивного и полного сопротивления
// ============================================================================

import type { ImpedanceResult, MaterialType, InstallationMethod } from '../types';
import { findCableReference, findCableBySizeAndMaterial } from '../data/references';

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

/**
 * Удельное сопротивление материалов (Ом·мм²/м) при 20°C
 */
const RESISTIVITY = {
  Cu: 0.0175, // Медь
  Al: 0.0294, // Алюминий
};

/**
 * Температурный коэффициент сопротивления (1/°C)
 */
const TEMP_COEFFICIENT = {
  Cu: 0.00393,
  Al: 0.00403,
};

/**
 * Базовая температура (°C)
 */
const BASE_TEMP = 20;

/**
 * Рабочая температура жилы (°C) - для расчётов
 */
const WORKING_TEMP = 65;

/**
 * Реактивное сопротивление по умолчанию (Ом/км)
 * Для кабелей до 1 кВ
 */
const DEFAULT_X_OHM_KM = 0.08;

// ============================================================================
// ОСНОВНЫЕ ФУНКЦИИ РАСЧЁТА
// ============================================================================

/**
 * Расчёт сопротивления кабеля по данным из справочника
 * 
 * @param length - длина кабеля (м)
 * @param wireType - марка кабеля (ВВГ, АВВГ и т.д.)
 * @param wireSize - сечение жилы (мм²)
 * @returns результат расчёта (R, X, Z в Омах) или null, если кабель не найден
 * 
 * @example
 * const result = calculateCableImpedanceFromReference(100, 'ВВГ', 16);
 * if (result) {
 *   console.log(`R = ${result.r} Ом`);
 *   console.log(`X = ${result.x} Ом`);
 *   console.log(`Z = ${result.z} Ом`);
 * }
 */
export function calculateCableImpedanceFromReference(
  length: number,
  wireType: string,
  wireSize: number
): ImpedanceResult | null {
  const cableData = findCableReference(wireType, wireSize);
  
  if (!cableData) {
    return null;
  }
  
  // Переводим длину в км и умножаем на сопротивление на км
  const lengthKm = length / 1000;
  
  // Активное сопротивление (Ом)
  const r = cableData.rOhmKm * lengthKm;
  
  // Реактивное сопротивление (Ом)
  const x = cableData.xOhmKm * lengthKm;
  
  // Полное сопротивление (Ом)
  const z = Math.sqrt(r * r + x * x);
  
  return { r, x, z };
}

/**
 * Расчёт сопротивления кабеля по сечению и материалу
 * 
 * @param length - длина кабеля (м)
 * @param wireSize - сечение жилы (мм²)
 * @param material - материал жилы ('Cu' или 'Al')
 * @returns результат расчёта (R, X, Z в Омах) или null, если кабель не найден
 */
export function calculateCableImpedanceBySize(
  length: number,
  wireSize: number,
  material: MaterialType
): ImpedanceResult | null {
  const cableData = findCableBySizeAndMaterial(wireSize, material);
  
  if (!cableData) {
    // Если нет в справочнике, считаем по формуле
    return calculateImpedanceByFormula(length, wireSize, material);
  }
  
  const lengthKm = length / 1000;
  const r = cableData.rOhmKm * lengthKm;
  const x = cableData.xOhmKm * lengthKm;
  const z = Math.sqrt(r * r + x * x);
  
  return { r, x, z };
}

/**
 * Расчёт сопротивления кабеля по формуле (без справочника)
 * 
 * @param length - длина кабеля (м)
 * @param wireSize - сечение жилы (мм²)
 * @param material - материал жилы ('Cu' или 'Al')
 * @param temperature - температура жилы (°C), по умолчанию рабочая
 * @returns результат расчёта (R, X, Z в Омах)
 * 
 * @example
 * const result = calculateImpedanceByFormula(50, 10, 'Cu');
 * // R = 0.0875 Ом при 20°C
 */
export function calculateImpedanceByFormula(
  length: number,
  wireSize: number,
  material: MaterialType,
  temperature: number = WORKING_TEMP
): ImpedanceResult {
  // Удельное сопротивление при заданной температуре
  const rho0 = RESISTIVITY[material];
  const alpha = TEMP_COEFFICIENT[material];
  const rho = rho0 * (1 + alpha * (temperature - BASE_TEMP));
  
  // Активное сопротивление: R = ρ * L / S
  // где ρ - удельное сопротивление (Ом·мм²/м)
  // L - длина (м)
  // S - сечение (мм²)
  const r = (rho * length) / wireSize;
  
  // Реактивное сопротивление: X = x0 * L
  // где x0 - погонное реактивное сопротивление (Ом/км)
  // Для кабелей до 1 кВ принимаем 0.08 Ом/км
  const x = (DEFAULT_X_OHM_KM * length) / 1000;
  
  // Полное сопротивление
  const z = Math.sqrt(r * r + x * x);
  
  return { r, x, z };
}

// ============================================================================
// РАСЧЁТ ПАДЕНИЯ НАПРЯЖЕНИЯ
// ============================================================================

/**
 * Расчёт падения напряжения на кабеле
 * 
 * @param current - ток (А)
 * @param impedance - сопротивление кабеля
 * @param cosPhi - коэффициент мощности
 * @returns падение напряжения (В)
 * 
 * @example
 * const voltageDrop = calculateVoltageDrop(50, { r: 0.1, x: 0.02, z: 0.102 }, 0.9);
 */
export function calculateVoltageDrop(
  current: number,
  impedance: ImpedanceResult,
  cosPhi: number
): number {
  const { r, x } = impedance;
  const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
  
  // Падение напряжения: ΔU = I * (R * cosφ + X * sinφ)
  const voltageDrop = current * (r * cosPhi + x * sinPhi);
  
  return voltageDrop;
}

/**
 * Расчёт падения напряжения в процентах
 * 
 * @param current - ток (А)
 * @param impedance - сопротивление кабеля
 * @param cosPhi - коэффициент мощности
 * @param nominalVoltage - номинальное напряжение (В)
 * @returns падение напряжения (%)
 */
export function calculateVoltageDropPercent(
  current: number,
  impedance: ImpedanceResult,
  cosPhi: number,
  nominalVoltage: number
): number {
  const voltageDrop = calculateVoltageDrop(current, impedance, cosPhi);
  return (voltageDrop / nominalVoltage) * 100;
}

// ============================================================================
// РАСЧЁТ ПОТЕРЬ МОЩНОСТИ
// ============================================================================

/**
 * Расчёт потерь активной мощности в кабеле
 * 
 * @param current - ток (А)
 * @param r - активное сопротивление (Ом)
 * @returns потери мощности (Вт)
 */
export function calculatePowerLoss(current: number, r: number): number {
  // ΔP = 3 * I² * R (для трёхфазной сети)
  return 3 * current * current * r;
}

// ============================================================================
// РАСЧЁТ ТОКА КЗ
// ============================================================================

/**
 * Расчёт тока трёхфазного короткого замыкания
 * 
 * @param sourceVoltage - напряжение источника (В)
 * @param sourceImpedance - сопротивление источника (Ом)
 * @param cableImpedance - сопротивление кабеля (Ом)
 * @returns ток КЗ (А)
 */
export function calculateThreePhaseShortCircuitCurrent(
  sourceVoltage: number,
  sourceImpedance: ImpedanceResult,
  cableImpedance: ImpedanceResult
): number {
  // Полное сопротивление до точки КЗ
  const totalR = sourceImpedance.r + cableImpedance.r;
  const totalX = sourceImpedance.x + cableImpedance.x;
  const totalZ = Math.sqrt(totalR * totalR + totalX * totalX);
  
  // Ток трёхфазного КЗ: Iкз = U / (√3 * Z)
  const shortCircuitCurrent = sourceVoltage / (Math.sqrt(3) * totalZ);
  
  return shortCircuitCurrent;
}

/**
 * Расчёт тока однофазного короткого замыкания
 * (для проверки чувствительности защиты)
 * 
 * @param sourceVoltage - напряжение источника (В)
 * @param sourceImpedance - сопротивление источника (Ом)
 * @param cableImpedance - сопротивление кабеля (Ом)
 * @param zeroSequenceImpedance - сопротивление нулевой последовательности (Ом)
 * @returns ток однофазного КЗ (А)
 */
export function calculateSinglePhaseShortCircuitCurrent(
  sourceVoltage: number,
  sourceImpedance: ImpedanceResult,
  cableImpedance: ImpedanceResult,
  zeroSequenceImpedance?: ImpedanceResult
): number {
  // Для однофазного КЗ учитываем сопротивления прямой и нулевой последовательности
  const r1 = sourceImpedance.r + cableImpedance.r;
  const x1 = sourceImpedance.x + cableImpedance.x;
  
  // Сопротивление нулевой последовательности примерно в 3 раза больше прямой
  const r0 = zeroSequenceImpedance?.r || r1 * 3;
  const x0 = zeroSequenceImpedance?.x || x1 * 3.5;
  
  // Полное сопротивление для однофазного КЗ
  const totalR = (2 * r1 + r0) / 3;
  const totalX = (2 * x1 + x0) / 3;
  const totalZ = Math.sqrt(totalR * totalR + totalX * totalX);
  
  // Ток однофазного КЗ
  const shortCircuitCurrent = sourceVoltage / (Math.sqrt(3) * totalZ);
  
  return shortCircuitCurrent;
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Проверка допустимости падения напряжения
 * 
 * @param voltageDropPercent - падение напряжения (%)
 * @param allowedPercent - допустимое падение (%), по умолчанию 5%
 * @returns true, если падение допустимо
 */
export function isVoltageDropAcceptable(
  voltageDropPercent: number,
  allowedPercent: number = 5
): boolean {
  return voltageDropPercent <= allowedPercent;
}

/**
 * Определение максимальной длины кабеля при заданном падении напряжения
 * 
 * @param current - ток (А)
 * @param wireSize - сечение (мм²)
 * @param material - материал ('Cu' или 'Al')
 * @param allowedVoltageDropPercent - допустимое падение (%)
 * @param nominalVoltage - номинальное напряжение (В)
 * @param cosPhi - коэффициент мощности
 * @returns максимальная длина (м)
 */
export function calculateMaxLength(
  current: number,
  wireSize: number,
  material: MaterialType,
  allowedVoltageDropPercent: number,
  nominalVoltage: number,
  cosPhi: number
): number {
  const rho = RESISTIVITY[material];
  const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
  
  // Допустимое падение напряжения (В)
  const allowedVoltageDrop = (allowedVoltageDropPercent / 100) * nominalVoltage;
  
  // L = ΔU / (I * (ρ/S * cosφ + x0 * sinφ))
  // x0 = 0.08 Ом/км = 0.00008 Ом/м
  const x0PerMeter = DEFAULT_X_OHM_KM / 1000;
  
  const denominator = current * ((rho / wireSize) * cosPhi + x0PerMeter * sinPhi);
  
  if (denominator <= 0) return Infinity;
  
  return allowedVoltageDrop / denominator;
}

/**
 * Расчёт сопротивления шинопровода
 * 
 * @param length - длина шинопровода (м)
 * @param crossSection - сечение шины (мм²)
 * @param material - материал ('Cu' или 'Al')
 * @returns результат расчёта
 */
export function calculateBusbarImpedance(
  length: number,
  crossSection: number,
  material: MaterialType
): ImpedanceResult {
  // Для шинопроводов реактивное сопротивление меньше
  const xOhmKm = 0.05;
  
  const rho = RESISTIVITY[material];
  const r = (rho * length) / crossSection;
  const x = (xOhmKm * length) / 1000;
  const z = Math.sqrt(r * r + x * x);
  
  return { r, x, z };
}

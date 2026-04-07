// ============================================================================
// СПРАВОЧНИК КАБЕЛЕЙ ПО ПУЭ (Правила устройства электроустановок)
// Данные для расчёта сопротивлений и допустимых токов
// ============================================================================

import type { CableReferenceData, MaterialType, ReferencesData } from '../types';

// ============================================================================
// СПРАВОЧНИК КАБЕЛЕЙ С МЕДНЫМИ ЖИЛАМИ (ВВГ)
// Источник: ПУЭ, таблица 1.3.4 (прокладка в воздухе) и 1.3.5 (в земле)
// ============================================================================

const COPPER_CABLES: CableReferenceData[] = [
  // Сечение, r (Ом/км), x (Ом/км), I в воздухе (А), I в земле (А)
  { wireType: 'ВВГ', wireSize: 1.5, core: 3, material: 'Cu', rOhmKm: 12.1, xOhmKm: 0.092, iAir: 17, iGround: 22 },
  { wireType: 'ВВГ', wireSize: 2.5, core: 3, material: 'Cu', rOhmKm: 7.41, xOhmKm: 0.087, iAir: 24, iGround: 30 },
  { wireType: 'ВВГ', wireSize: 4, core: 3, material: 'Cu', rOhmKm: 4.61, xOhmKm: 0.082, iAir: 32, iGround: 40 },
  { wireType: 'ВВГ', wireSize: 6, core: 3, material: 'Cu', rOhmKm: 3.08, xOhmKm: 0.081, iAir: 40, iGround: 50 },
  { wireType: 'ВВГ', wireSize: 10, core: 3, material: 'Cu', rOhmKm: 1.83, xOhmKm: 0.078, iAir: 56, iGround: 65 },
  { wireType: 'ВВГ', wireSize: 16, core: 3, material: 'Cu', rOhmKm: 1.15, xOhmKm: 0.077, iAir: 75, iGround: 85 },
  { wireType: 'ВВГ', wireSize: 25, core: 3, material: 'Cu', rOhmKm: 0.727, xOhmKm: 0.073, iAir: 95, iGround: 110 },
  { wireType: 'ВВГ', wireSize: 35, core: 3, material: 'Cu', rOhmKm: 0.524, xOhmKm: 0.070, iAir: 115, iGround: 135 },
  { wireType: 'ВВГ', wireSize: 50, core: 3, material: 'Cu', rOhmKm: 0.387, xOhmKm: 0.069, iAir: 145, iGround: 165 },
  { wireType: 'ВВГ', wireSize: 70, core: 3, material: 'Cu', rOhmKm: 0.268, xOhmKm: 0.066, iAir: 180, iGround: 200 },
  { wireType: 'ВВГ', wireSize: 95, core: 3, material: 'Cu', rOhmKm: 0.193, xOhmKm: 0.064, iAir: 220, iGround: 245 },
  { wireType: 'ВВГ', wireSize: 120, core: 3, material: 'Cu', rOhmKm: 0.153, xOhmKm: 0.063, iAir: 260, iGround: 285 },
  { wireType: 'ВВГ', wireSize: 150, core: 3, material: 'Cu', rOhmKm: 0.124, xOhmKm: 0.061, iAir: 300, iGround: 325 },
  { wireType: 'ВВГ', wireSize: 185, core: 3, material: 'Cu', rOhmKm: 0.099, xOhmKm: 0.060, iAir: 345, iGround: 365 },
  { wireType: 'ВВГ', wireSize: 240, core: 3, material: 'Cu', rOhmKm: 0.075, xOhmKm: 0.058, iAir: 410, iGround: 430 },
];

// ============================================================================
// СПРАВОЧНИК КАБЕЛЕЙ С АЛЮМИНИЕВЫМИ ЖИЛАМИ (АВВГ)
// Источник: ПУЭ, таблица 1.3.6 (прокладка в воздухе) и 1.3.7 (в земле)
// ============================================================================

const ALUMINUM_CABLES: CableReferenceData[] = [
  // Сечение, r (Ом/км), x (Ом/км), I в воздухе (А), I в земле (А)
  { wireType: 'АВВГ', wireSize: 2.5, core: 3, material: 'Al', rOhmKm: 12.3, xOhmKm: 0.094, iAir: 19, iGround: 24 },
  { wireType: 'АВВГ', wireSize: 4, core: 3, material: 'Al', rOhmKm: 7.74, xOhmKm: 0.088, iAir: 25, iGround: 32 },
  { wireType: 'АВВГ', wireSize: 6, core: 3, material: 'Al', rOhmKm: 5.17, xOhmKm: 0.084, iAir: 32, iGround: 40 },
  { wireType: 'АВВГ', wireSize: 10, core: 3, material: 'Al', rOhmKm: 3.08, xOhmKm: 0.080, iAir: 43, iGround: 52 },
  { wireType: 'АВВГ', wireSize: 16, core: 3, material: 'Al', rOhmKm: 1.94, xOhmKm: 0.078, iAir: 58, iGround: 68 },
  { wireType: 'АВВГ', wireSize: 25, core: 3, material: 'Al', rOhmKm: 1.24, xOhmKm: 0.075, iAir: 75, iGround: 88 },
  { wireType: 'АВВГ', wireSize: 35, core: 3, material: 'Al', rOhmKm: 0.89, xOhmKm: 0.072, iAir: 90, iGround: 105 },
  { wireType: 'АВВГ', wireSize: 50, core: 3, material: 'Al', rOhmKm: 0.65, xOhmKm: 0.070, iAir: 110, iGround: 130 },
  { wireType: 'АВВГ', wireSize: 70, core: 3, material: 'Al', rOhmKm: 0.45, xOhmKm: 0.068, iAir: 140, iGround: 160 },
  { wireType: 'АВВГ', wireSize: 95, core: 3, material: 'Al', rOhmKm: 0.33, xOhmKm: 0.066, iAir: 170, iGround: 195 },
  { wireType: 'АВВГ', wireSize: 120, core: 3, material: 'Al', rOhmKm: 0.26, xOhmKm: 0.065, iAir: 195, iGround: 220 },
  { wireType: 'АВВГ', wireSize: 150, core: 3, material: 'Al', rOhmKm: 0.21, xOhmKm: 0.063, iAir: 225, iGround: 255 },
  { wireType: 'АВВГ', wireSize: 185, core: 3, material: 'Al', rOhmKm: 0.17, xOhmKm: 0.062, iAir: 260, iGround: 290 },
  { wireType: 'АВВГ', wireSize: 240, core: 3, material: 'Al', rOhmKm: 0.13, xOhmKm: 0.060, iAir: 310, iGround: 345 },
];

// ============================================================================
// СПРАВОЧНИК СИЛОВЫХ КАБЕЛЕЙ (ВБбШв, АВБбШв - бронированные)
// ============================================================================

const ARMORED_COPPER_CABLES: CableReferenceData[] = [
  { wireType: 'ВБбШв', wireSize: 16, core: 3, material: 'Cu', rOhmKm: 1.15, xOhmKm: 0.081, iAir: 75, iGround: 90 },
  { wireType: 'ВБбШв', wireSize: 25, core: 3, material: 'Cu', rOhmKm: 0.727, xOhmKm: 0.077, iAir: 95, iGround: 115 },
  { wireType: 'ВБбШв', wireSize: 35, core: 3, material: 'Cu', rOhmKm: 0.524, xOhmKm: 0.074, iAir: 115, iGround: 140 },
  { wireType: 'ВБбШв', wireSize: 50, core: 3, material: 'Cu', rOhmKm: 0.387, xOhmKm: 0.072, iAir: 145, iGround: 175 },
  { wireType: 'ВБбШв', wireSize: 70, core: 3, material: 'Cu', rOhmKm: 0.268, xOhmKm: 0.069, iAir: 180, iGround: 215 },
  { wireType: 'ВБбШв', wireSize: 95, core: 3, material: 'Cu', rOhmKm: 0.193, xOhmKm: 0.067, iAir: 220, iGround: 260 },
  { wireType: 'ВБбШв', wireSize: 120, core: 3, material: 'Cu', rOhmKm: 0.153, xOhmKm: 0.066, iAir: 260, iGround: 300 },
  { wireType: 'ВБбШв', wireSize: 150, core: 3, material: 'Cu', rOhmKm: 0.124, xOhmKm: 0.064, iAir: 300, iGround: 345 },
  { wireType: 'ВБбШв', wireSize: 185, core: 3, material: 'Cu', rOhmKm: 0.099, xOhmKm: 0.063, iAir: 345, iGround: 390 },
  { wireType: 'ВБбШв', wireSize: 240, core: 3, material: 'Cu', rOhmKm: 0.075, xOhmKm: 0.061, iAir: 410, iGround: 460 },
];

const ARMORED_ALUMINUM_CABLES: CableReferenceData[] = [
  { wireType: 'АВБбШв', wireSize: 16, core: 3, material: 'Al', rOhmKm: 1.94, xOhmKm: 0.082, iAir: 58, iGround: 73 },
  { wireType: 'АВБбШв', wireSize: 25, core: 3, material: 'Al', rOhmKm: 1.24, xOhmKm: 0.079, iAir: 75, iGround: 93 },
  { wireType: 'АВБбШв', wireSize: 35, core: 3, material: 'Al', rOhmKm: 0.89, xOhmKm: 0.076, iAir: 90, iGround: 113 },
  { wireType: 'АВБбШв', wireSize: 50, core: 3, material: 'Al', rOhmKm: 0.65, xOhmKm: 0.074, iAir: 110, iGround: 140 },
  { wireType: 'АВБбШв', wireSize: 70, core: 3, material: 'Al', rOhmKm: 0.45, xOhmKm: 0.071, iAir: 140, iGround: 175 },
  { wireType: 'АВБбШв', wireSize: 95, core: 3, material: 'Al', rOhmKm: 0.33, xOhmKm: 0.069, iAir: 170, iGround: 210 },
  { wireType: 'АВБбШв', wireSize: 120, core: 3, material: 'Al', rOhmKm: 0.26, xOhmKm: 0.068, iAir: 195, iGround: 240 },
  { wireType: 'АВБбШв', wireSize: 150, core: 3, material: 'Al', rOhmKm: 0.21, xOhmKm: 0.066, iAir: 225, iGround: 275 },
  { wireType: 'АВБбШв', wireSize: 185, core: 3, material: 'Al', rOhmKm: 0.17, xOhmKm: 0.065, iAir: 260, iGround: 315 },
  { wireType: 'АВБбШв', wireSize: 240, core: 3, material: 'Al', rOhmKm: 0.13, xOhmKm: 0.063, iAir: 310, iGround: 375 },
];

// ============================================================================
// ОБЪЕДИНЁННЫЙ СПРАВОЧНИК
// ============================================================================

const ALL_CABLES: CableReferenceData[] = [
  ...COPPER_CABLES,
  ...ALUMINUM_CABLES,
  ...ARMORED_COPPER_CABLES,
  ...ARMORED_ALUMINUM_CABLES,
];

// ============================================================================
// ФУНКЦИИ ПОИСКА
// ============================================================================

/**
 * Найти данные кабеля в справочнике по марке и сечению
 * 
 * @param wireType - марка кабеля (ВВГ, АВВГ, ВБбШв, АВБбШв)
 * @param wireSize - сечение жилы (мм²)
 * @returns данные кабеля или null, если не найден
 * 
 * @example
 * findCableReference('ВВГ', 16) // { wireType: 'ВВГ', wireSize: 16, ... }
 * findCableReference('АВВГ', 50) // { wireType: 'АВВГ', wireSize: 50, ... }
 */
export function findCableReference(
  wireType: string,
  wireSize: number
): CableReferenceData | null {
  // Нормализуем марку кабеля
  const normalizedType = wireType.toUpperCase().trim();
  
  return (
    ALL_CABLES.find(
      (cable) =>
        cable.wireType.toUpperCase() === normalizedType &&
        cable.wireSize === wireSize
    ) || null
  );
}

/**
 * Найти данные кабеля по сечению и материалу
 * 
 * @param wireSize - сечение жилы (мм²)
 * @param material - материал жилы ('Cu' или 'Al')
 * @returns данные кабеля или null, если не найден
 */
export function findCableBySizeAndMaterial(
  wireSize: number,
  material: MaterialType
): CableReferenceData | null {
  return ALL_CABLES.find(
    (cable) => cable.wireSize === wireSize && cable.material === material
  ) || null;
}

/**
 * Получить допустимый ток для кабеля
 * 
 * @param wireType - марка кабеля
 * @param wireSize - сечение жилы (мм²)
 * @param installation - способ прокладки ('in_ground' или 'in_air')
 * @returns допустимый ток (А) или null
 */
export function getAllowedCurrent(
  wireType: string,
  wireSize: number,
  installation: 'in_ground' | 'in_air'
): number | null {
  const cable = findCableReference(wireType, wireSize);
  if (!cable) return null;
  
  return installation === 'in_ground' ? cable.iGround : cable.iAir;
}

/**
 * Получить все доступные сечения для заданной марки кабеля
 * 
 * @param wireType - марка кабеля
 * @returns массив сечений (мм²)
 */
export function getAvailableSections(wireType: string): number[] {
  const normalizedType = wireType.toUpperCase().trim();
  
  return ALL_CABLES
    .filter((cable) => cable.wireType.toUpperCase() === normalizedType)
    .map((cable) => cable.wireSize)
    .sort((a, b) => a - b);
}

/**
 * Получить все марки кабелей для заданного материала
 * 
 * @param material - материал ('Cu' или 'Al')
 * @returns массив марок кабелей
 */
export function getCableTypesByMaterial(material: MaterialType): string[] {
  return [...new Set(
    ALL_CABLES
      .filter((cable) => cable.material === material)
      .map((cable) => cable.wireType)
  )];
}

/**
 * Подобрать минимальное сечение кабеля по току
 * 
 * @param current - требуемый ток (А)
 * @param material - материал жилы ('Cu' или 'Al')
 * @param installation - способ прокладки
 * @returns минимальное сечение (мм²) или null
 */
export function selectMinSection(
  current: number,
  material: MaterialType,
  installation: 'in_ground' | 'in_air'
): number | null {
  const suitableCables = ALL_CABLES
    .filter((cable) => cable.material === material)
    .filter((cable) => {
      const allowedCurrent = installation === 'in_ground' 
        ? cable.iGround 
        : cable.iAir;
      return allowedCurrent >= current;
    })
    .sort((a, b) => a.wireSize - b.wireSize);
  
  return suitableCables[0]?.wireSize || null;
}

// ============================================================================
// ЭКСПОРТ ВСЕХ ДАННЫХ
// ============================================================================

/**
 * Получить все справочные данные
 */
export function getReferencesData(): ReferencesData {
  return {
    cables: ALL_CABLES,
    breakers: [], // TODO: добавить справочник выключателей
    transformers: [], // TODO: добавить справочник трансформаторов
  };
}

/**
 * Экспорт массивов кабелей для прямого доступа
 */
export {
  COPPER_CABLES,
  ALUMINUM_CABLES,
  ARMORED_COPPER_CABLES,
  ARMORED_ALUMINUM_CABLES,
  ALL_CABLES,
};

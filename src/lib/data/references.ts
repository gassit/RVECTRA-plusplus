// ============================================================================
// СПРАВОЧНИКИ ДАННЫХ ДЛЯ ЦИФРОВОГО ДВОЙНИКА ЭЛЕКТРИЧЕСКОЙ СЕТИ
// Данные по ПУЭ (Правила устройства электроустановок)
// ============================================================================

import type { CableReferenceData, BreakerReferenceData, TransformerReferenceData, ReferencesData } from '@/types';

// ============================================================================
// СПРАВОЧНИК КАБЕЛЕЙ (по ПУЭ)
// ============================================================================

// ==============================================================================
// ТАБЛИЦА ПУЭ - ДОПУСТИМЫЕ ДЛИТЕЛЬНЫЕ ТОКИ ДЛЯ КАБЕЛЕЙ
// Данные по ПУЭ таблицы 1.3.4, 1.3.5, 1.3.6, 1.3.7, 1.3.8, 1.3.9, 1.3.10
// Бронированные кабели, прокладка в воздухе
// ==============================================================================

// Формат ключа: "кол-во жил_сечение_материал" -> ток (А)
export const PUE_CURRENT_TABLE: Record<string, number> = {
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

// Определение напряжения по количеству жил
export function getVoltageByCores(cores: number): number {
  // 4-5 жил → 0.4 кВ, 2-3 жилы → 0.22 кВ
  if (cores >= 4) return 0.4;
  return 0.22;
}

// Получение допустимого тока из таблицы ПУЭ
export function getIDopBySection(
  cores: number,
  section: number,
  material: 'copper' | 'aluminum' | 'Cu' | 'Al'
): number | null {
  const materialKey = material.toLowerCase() === 'cu' || material.toLowerCase() === 'copper' 
    ? 'copper' 
    : 'aluminum';
  const key = `${cores}_${section}_${materialKey}`;
  return PUE_CURRENT_TABLE[key] ?? null;
}

// Кабели АВВГ (алюминий) - активное и реактивное сопротивление, допустимые токи
// Данные по ПУЭ таблицы 1.3.5, 1.3.7, 1.3.16, 1.3.18
const AVVG_CABLES: Omit<CableReferenceData, 'wireType' | 'material'>[] = [
  // Сечение, жилы, R (Ом/км), X (Ом/км), I воздух (А), I земля (А)
  { wireSize: 2.5, core: 4, rOhmKm: 12.5, xOhmKm: 0.104, iAir: 19, iGround: 28 },
  { wireSize: 4, core: 4, rOhmKm: 7.81, xOhmKm: 0.095, iAir: 27, iGround: 37 },
  { wireSize: 6, core: 4, rOhmKm: 5.21, xOhmKm: 0.090, iAir: 35, iGround: 46 },
  { wireSize: 10, core: 4, rOhmKm: 3.12, xOhmKm: 0.086, iAir: 47, iGround: 61 },
  { wireSize: 16, core: 4, rOhmKm: 1.95, xOhmKm: 0.082, iAir: 62, iGround: 78 },
  { wireSize: 25, core: 4, rOhmKm: 1.25, xOhmKm: 0.080, iAir: 80, iGround: 100 },
  { wireSize: 35, core: 4, rOhmKm: 0.894, xOhmKm: 0.078, iAir: 99, iGround: 121 },
  { wireSize: 50, core: 4, rOhmKm: 0.625, xOhmKm: 0.076, iAir: 119, iGround: 144 },
  { wireSize: 70, core: 4, rOhmKm: 0.447, xOhmKm: 0.074, iAir: 150, iGround: 178 },
  { wireSize: 95, core: 4, rOhmKm: 0.329, xOhmKm: 0.072, iAir: 184, iGround: 214 },
  { wireSize: 120, core: 4, rOhmKm: 0.261, xOhmKm: 0.071, iAir: 212, iGround: 246 },
  { wireSize: 150, core: 4, rOhmKm: 0.208, xOhmKm: 0.070, iAir: 245, iGround: 282 },
  { wireSize: 185, core: 4, rOhmKm: 0.169, xOhmKm: 0.069, iAir: 280, iGround: 320 },
  { wireSize: 240, core: 4, rOhmKm: 0.130, xOhmKm: 0.068, iAir: 335, iGround: 380 },
];

// Кабели ВВГ (медь) - активное и реактивное сопротивление, допустимые токи
const VVG_CABLES: Omit<CableReferenceData, 'wireType' | 'material'>[] = [
  // Сечение, жилы, R (Ом/км), X (Ом/км), I воздух (А), I земля (А)
  { wireSize: 1.5, core: 4, rOhmKm: 12.1, xOhmKm: 0.104, iAir: 19, iGround: 24 },
  { wireSize: 2.5, core: 4, rOhmKm: 7.41, xOhmKm: 0.095, iAir: 25, iGround: 33 },
  { wireSize: 4, core: 4, rOhmKm: 4.61, xOhmKm: 0.090, iAir: 34, iGround: 43 },
  { wireSize: 6, core: 4, rOhmKm: 3.08, xOhmKm: 0.086, iAir: 43, iGround: 54 },
  { wireSize: 10, core: 4, rOhmKm: 1.83, xOhmKm: 0.082, iAir: 58, iGround: 75 },
  { wireSize: 16, core: 4, rOhmKm: 1.15, xOhmKm: 0.080, iAir: 80, iGround: 98 },
  { wireSize: 25, core: 4, rOhmKm: 0.727, xOhmKm: 0.078, iAir: 105, iGround: 128 },
  { wireSize: 35, core: 4, rOhmKm: 0.524, xOhmKm: 0.076, iAir: 125, iGround: 157 },
  { wireSize: 50, core: 4, rOhmKm: 0.387, xOhmKm: 0.074, iAir: 155, iGround: 190 },
  { wireSize: 70, core: 4, rOhmKm: 0.268, xOhmKm: 0.072, iAir: 195, iGround: 238 },
  { wireSize: 95, core: 4, rOhmKm: 0.193, xOhmKm: 0.071, iAir: 230, iGround: 289 },
  { wireSize: 120, core: 4, rOhmKm: 0.153, xOhmKm: 0.070, iAir: 270, iGround: 333 },
  { wireSize: 150, core: 4, rOhmKm: 0.124, xOhmKm: 0.069, iAir: 305, iGround: 382 },
  { wireSize: 185, core: 4, rOhmKm: 0.099, xOhmKm: 0.068, iAir: 350, iGround: 436 },
  { wireSize: 240, core: 4, rOhmKm: 0.075, xOhmKm: 0.067, iAir: 400, iGround: 515 },
];

// Формируем полный справочник кабелей
export const CABLE_REFERENCES: CableReferenceData[] = [
  ...AVVG_CABLES.map(c => ({ ...c, wireType: 'АВВГ', material: 'Al' as const })),
  ...VVG_CABLES.map(c => ({ ...c, wireType: 'ВВГ', material: 'Cu' as const })),
];

// ============================================================================
// СПРАВОЧНИК ВЫКЛЮЧАТЕЛЕЙ
// ============================================================================

export const BREAKER_REFERENCES: BreakerReferenceData[] = [
  // ВА-47-29 (IEK) - модульные автоматические выключатели
  {
    id: 'VA47-29',
    manufacturer: 'IEK',
    model: 'ВА-47-29',
    breakerType: 'MCB',
    inRatings: [6, 10, 16, 20, 25, 32, 40, 50, 63],
    poles: 1,
    voltage: 230,
    breakingCapacity: 4.5,
    trippingChars: ['B', 'C', 'D'],
  },
  // ВА-47-100 (IEK) - модульные автоматические выключатели
  {
    id: 'VA47-100',
    manufacturer: 'IEK',
    model: 'ВА-47-100',
    breakerType: 'MCB',
    inRatings: [50, 63, 80, 100],
    poles: 1,
    voltage: 230,
    breakingCapacity: 10,
    trippingChars: ['B', 'C', 'D'],
  },
  // ВА-55-41 - воздушные автоматические выключатели
  {
    id: 'VA55-41',
    manufacturer: 'КЭАЗ',
    model: 'ВА-55-41',
    breakerType: 'MCCB',
    inRatings: [400, 630, 1000],
    poles: 3,
    voltage: 400,
    breakingCapacity: 40,
    trippingChars: [],
  },
  // ВА-55-43 - воздушные автоматические выключатели
  {
    id: 'VA55-43',
    manufacturer: 'КЭАЗ',
    model: 'ВА-55-43',
    breakerType: 'MCCB',
    inRatings: [630, 1000, 1600],
    poles: 3,
    voltage: 400,
    breakingCapacity: 50,
    trippingChars: [],
  },
  // Дополнительные выключатели
  {
    id: 'S203',
    manufacturer: 'ABB',
    model: 'S203',
    breakerType: 'MCB',
    inRatings: [6, 10, 16, 20, 25, 32, 40, 50, 63],
    poles: 3,
    voltage: 400,
    breakingCapacity: 6,
    trippingChars: ['B', 'C', 'D'],
  },
  {
    id: 'NSX100',
    manufacturer: 'Schneider',
    model: 'Compact NSX100',
    breakerType: 'MCCB',
    inRatings: [16, 25, 32, 40, 50, 63, 80, 100],
    poles: 3,
    voltage: 400,
    breakingCapacity: 25,
    trippingChars: ['B', 'C', 'D'],
  },
  {
    id: 'NSX250',
    manufacturer: 'Schneider',
    model: 'Compact NSX250',
    breakerType: 'MCCB',
    inRatings: [100, 125, 160, 200, 250],
    poles: 3,
    voltage: 400,
    breakingCapacity: 36,
    trippingChars: [],
  },
  // УЗО (RCD) - устройства защитного отключения
  {
    id: 'VD1-63',
    manufacturer: 'IEK',
    model: 'ВД1-63',
    breakerType: 'RCD',
    inRatings: [25, 32, 40, 50, 63],
    poles: 2,
    voltage: 230,
    breakingCapacity: 0,
    trippingChars: [],
    leakageCurrent: 30, // мА
  },
  {
    id: 'VD1-63-100',
    manufacturer: 'IEK',
    model: 'ВД1-63 (100мА)',
    breakerType: 'RCD',
    inRatings: [40, 50, 63],
    poles: 2,
    voltage: 230,
    breakingCapacity: 0,
    trippingChars: [],
    leakageCurrent: 100, // мА
  },
  // Дифф.автоматы (RCBO)
  {
    id: 'AVDT-1',
    manufacturer: 'IEK',
    model: 'АВDT-1',
    breakerType: 'RCBO',
    inRatings: [16, 20, 25, 32, 40],
    poles: 1,
    voltage: 230,
    breakingCapacity: 4.5,
    trippingChars: ['C'],
    leakageCurrent: 30, // мА
  },
  {
    id: 'DS201',
    manufacturer: 'ABB',
    model: 'DS201',
    breakerType: 'RCBO',
    inRatings: [6, 10, 16, 20, 25, 32, 40],
    poles: 1,
    voltage: 230,
    breakingCapacity: 6,
    trippingChars: ['B', 'C'],
    leakageCurrent: 30, // мА
  },
];

// ============================================================================
// СПРАВОЧНИК ТРАНСФОРМАТОРОВ
// ============================================================================

export const TRANSFORMER_REFERENCES: TransformerReferenceData[] = [
  {
    id: 'TM-250/10',
    model: 'ТМ-250/10',
    powerKva: 250,
    hvKv: 10,
    lvKv: 0.4,
    ukPercent: 4.5,
    pkKw: 3.7,
    p0Kw: 0.74,
  },
  {
    id: 'TM-400/10',
    model: 'ТМ-400/10',
    powerKva: 400,
    hvKv: 10,
    lvKv: 0.4,
    ukPercent: 4.5,
    pkKw: 5.5,
    p0Kw: 0.95,
  },
  {
    id: 'TM-630/10',
    model: 'ТМ-630/10',
    powerKva: 630,
    hvKv: 10,
    lvKv: 0.4,
    ukPercent: 5.5,
    pkKw: 7.6,
    p0Kw: 1.31,
  },
  {
    id: 'TM-1000/10',
    model: 'ТМ-1000/10',
    powerKva: 1000,
    hvKv: 10,
    lvKv: 0.4,
    ukPercent: 5.5,
    pkKw: 10.8,
    p0Kw: 1.9,
  },
  {
    id: 'TM-1600/10',
    model: 'ТМ-1600/10',
    powerKva: 1600,
    hvKv: 10,
    lvKv: 0.4,
    ukPercent: 5.5,
    pkKw: 16.5,
    p0Kw: 2.65,
  },
  {
    id: 'TM-2500/10',
    model: 'ТМ-2500/10',
    powerKva: 2500,
    hvKv: 10,
    lvKv: 0.4,
    ukPercent: 6.0,
    pkKw: 24.0,
    p0Kw: 3.7,
  },
];

// ============================================================================
// ФУНКЦИИ ПОИСКА ПО СПРАВОЧНИКАМ
// ============================================================================

// Поиск кабеля по марке и сечению
export function findCableReference(wireType: string, wireSize: number): CableReferenceData | null {
  return CABLE_REFERENCES.find(
    c => c.wireType === wireType && c.wireSize === wireSize
  ) || null;
}

// Поиск выключателя по модели
export function findBreakerReference(model: string): BreakerReferenceData | null {
  return BREAKER_REFERENCES.find(b => b.model === model) || null;
}

// Поиск трансформатора по модели
export function findTransformerReference(model: string): TransformerReferenceData | null {
  return TRANSFORMER_REFERENCES.find(t => t.model === model) || null;
}

// Получить допустимый ток кабеля в зависимости от способа прокладки
export function getCableCurrentCapacity(
  cable: CableReferenceData,
  installationMethod: string
): number {
  switch (installationMethod) {
    case 'in_ground':
      return cable.iGround;
    case 'in_air':
    default:
      return cable.iAir;
  }
}

// Получить все справочники
export function getReferencesData(): ReferencesData {
  return {
    cables: CABLE_REFERENCES,
    breakers: BREAKER_REFERENCES,
    transformers: TRANSFORMER_REFERENCES,
  };
}

// Экспорт по умолчанию
export default {
  cables: CABLE_REFERENCES,
  breakers: BREAKER_REFERENCES,
  transformers: TRANSFORMER_REFERENCES,
  findCableReference,
  findBreakerReference,
  findTransformerReference,
  getCableCurrentCapacity,
  getReferencesData,
};

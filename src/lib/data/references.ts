// ============================================================================
// СПРАВОЧНИКИ ДАННЫХ ДЛЯ ЦИФРОВОГО ДВОЙНИКА ЭЛЕКТРИЧЕСКОЙ СЕТИ
// Данные по ПУЭ (Правила устройства электроустановок)
// ============================================================================

import type { CableReferenceData, BreakerReferenceData, TransformerReferenceData, ReferencesData } from '@/types';

// ============================================================================
// СПРАВОЧНИК КАБЕЛЕЙ (по ПУЭ)
// ============================================================================

// Кабели АВВГ (алюминий) - активное и реактивное сопротивление, допустимые токи
// Данные по ПУЭ таблицы 1.3.5, 1.3.7, 1.3.16, 1.3.18
const AVVG_CABLES: Omit<CableReferenceData, 'wireType' | 'material'>[] = [
  // Сечение, жилы, R (Ом/км), X (Ом/км), I воздух (А), I земля (А)
  { wireSize: 2.5, core: 4, rOhmKm: 12.5, xOhmKm: 0.104, iAir: 20, iGround: 28 },
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
  { wireSize: 2.5, core: 4, rOhmKm: 7.41, xOhmKm: 0.095, iAir: 27, iGround: 33 },
  { wireSize: 4, core: 4, rOhmKm: 4.61, xOhmKm: 0.090, iAir: 36, iGround: 43 },
  { wireSize: 6, core: 4, rOhmKm: 3.08, xOhmKm: 0.086, iAir: 46, iGround: 54 },
  { wireSize: 10, core: 4, rOhmKm: 1.83, xOhmKm: 0.082, iAir: 64, iGround: 75 },
  { wireSize: 16, core: 4, rOhmKm: 1.15, xOhmKm: 0.080, iAir: 85, iGround: 98 },
  { wireSize: 25, core: 4, rOhmKm: 0.727, xOhmKm: 0.078, iAir: 112, iGround: 128 },
  { wireSize: 35, core: 4, rOhmKm: 0.524, xOhmKm: 0.076, iAir: 138, iGround: 157 },
  { wireSize: 50, core: 4, rOhmKm: 0.387, xOhmKm: 0.074, iAir: 166, iGround: 190 },
  { wireSize: 70, core: 4, rOhmKm: 0.268, xOhmKm: 0.072, iAir: 210, iGround: 238 },
  { wireSize: 95, core: 4, rOhmKm: 0.193, xOhmKm: 0.071, iAir: 255, iGround: 289 },
  { wireSize: 120, core: 4, rOhmKm: 0.153, xOhmKm: 0.070, iAir: 295, iGround: 333 },
  { wireSize: 150, core: 4, rOhmKm: 0.124, xOhmKm: 0.069, iAir: 340, iGround: 382 },
  { wireSize: 185, core: 4, rOhmKm: 0.099, xOhmKm: 0.068, iAir: 390, iGround: 436 },
  { wireSize: 240, core: 4, rOhmKm: 0.075, xOhmKm: 0.067, iAir: 465, iGround: 515 },
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
    type: 'MCB',
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
    type: 'MCB',
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
    type: 'ACB',
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
    type: 'ACB',
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
    type: 'MCB',
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
    type: 'MCCB',
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
    type: 'MCCB',
    inRatings: [100, 125, 160, 200, 250],
    poles: 3,
    voltage: 400,
    breakingCapacity: 36,
    trippingChars: [],
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

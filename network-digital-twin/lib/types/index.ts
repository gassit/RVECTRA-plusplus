// ============================================================================
// ТИПЫ ДАННЫХ ДЛЯ ЦИФРОВОГО ДВОЙНИКА ЭЛЕКТРИЧЕСКОЙ СЕТИ
// ============================================================================

// ============================================================================
// ТИПЫ ЭЛЕМЕНТОВ СЕТИ
// ============================================================================

/**
 * Типы элементов электрической сети
 * - SOURCE: Источник питания (трансформатор, генератор, ИБП)
 * - CABINET: Шкаф/щит (ЩР, ВРУ, ГРЩ, АВР)
 * - LOAD: Нагрузка (потребитель)
 * - BUS: Сборные шины
 * - METER: Узел учёта
 * - BREAKER: Выключатель/коммутационный аппарат
 * - JUNCTION: Точка распределения (Точрасп)
 */
export type ElementType = 'SOURCE' | 'CABINET' | 'LOAD' | 'BUS' | 'METER' | 'BREAKER' | 'JUNCTION';

/**
 * Типы устройств
 * - SOURCE: Источник питания
 * - BREAKER: Выключатель
 * - LOAD: Нагрузка
 * - METER: Счётчик
 * - ATS: АВР (автоматический ввод резерва)
 * - SWITCH: Разъединитель
 * - TRANSFORMER: Трансформатор
 */
export type DeviceType = 'SOURCE' | 'BREAKER' | 'LOAD' | 'METER' | 'ATS' | 'SWITCH' | 'TRANSFORMER';

/**
 * Типы связей между элементами
 * - CABLE: Кабельная линия
 * - BUSBAR: Шинопровод
 * - JUMPER: Перемычка
 */
export type ConnectionType = 'CABLE' | 'BUSBAR' | 'JUMPER';

/**
 * Материал проводника
 * - Cu: Медь
 * - Al: Алюминий
 */
export type MaterialType = 'Cu' | 'Al';

/**
 * Способ прокладки кабеля
 * - in_ground: В земле
 * - in_air: В воздухе
 * - in_pipe: В трубе
 * - in_tray: В лотке
 */
export type InstallationMethod = 'in_ground' | 'in_air' | 'in_pipe' | 'in_tray';

// ============================================================================
// ИНТЕРФЕЙСЫ РАСЧЁТОВ
// ============================================================================

/**
 * Результат расчёта сопротивления кабеля
 */
export interface ImpedanceResult {
  /** Активное сопротивление (Ом) */
  r: number;
  /** Реактивное сопротивление (Ом) */
  x: number;
  /** Полное сопротивление (Ом) */
  z: number;
}

// ============================================================================
// СПРАВОЧНЫЕ ДАННЫЕ
// ============================================================================

/**
 * Данные кабеля из справочника (ПУЭ)
 */
export interface CableReferenceData {
  /** Марка провода (ВВГ, АВВГ и т.д.) */
  wireType: string;
  /** Сечение жилы (мм²) */
  wireSize: number;
  /** Количество жил */
  core: number;
  /** Материал жилы */
  material: MaterialType;
  /** Активное сопротивление (Ом/км) */
  rOhmKm: number;
  /** Реактивное сопротивление (Ом/км) */
  xOhmKm: number;
  /** Допустимый ток в воздухе (А) */
  iAir: number;
  /** Допустимый ток в земле (А) */
  iGround: number;
}

/**
 * Данные выключателя из справочника
 */
export interface BreakerReferenceData {
  id: string;
  /** Производитель */
  manufacturer: string;
  /** Модель */
  model: string;
  /** Тип выключателя */
  type: 'MCB' | 'MCCB' | 'ACB';
  /** Номинальные токи (А) */
  inRatings: number[];
  /** Количество полюсов */
  poles: number;
  /** Номинальное напряжение (В) */
  voltage: number;
  /** Отключающая способность (кА) */
  breakingCapacity: number;
  /** Характеристики расцепления */
  trippingChars: string[];
}

/**
 * Данные трансформатора из справочника
 */
export interface TransformerReferenceData {
  id: string;
  /** Модель */
  model: string;
  /** Производитель */
  manufacturer?: string;
  /** Мощность (кВА) */
  powerKva: number;
  /** Напряжение ВН (кВ) */
  hvKv: number;
  /** Напряжение НН (кВ) */
  lvKv: number;
  /** Напряжение КЗ (%) */
  ukPercent: number;
  /** Потери КЗ (кВт) */
  pkKw?: number;
  /** Потери ХХ (кВт) */
  p0Kw?: number;
  /** Ток ХХ (%) */
  i0Percent?: number;
  /** Активное сопротивление (Ом) */
  r_ohm?: number;
  /** Реактивное сопротивление (Ом) */
  x_ohm?: number;
}

/**
 * Все справочники
 */
export interface ReferencesData {
  cables: CableReferenceData[];
  breakers: BreakerReferenceData[];
  transformers: TransformerReferenceData[];
}

// ============================================================================
// ИМПОРТ ДАННЫХ
// ============================================================================

/**
 * Строка Excel файла
 */
export interface ExcelRow {
  [key: string]: string | number | undefined;
}

/**
 * Ответ API импорта
 */
export interface ImportResponse {
  success: boolean;
  message: string;
  imported: {
    elements: number;
    devices: number;
    connections: number;
  };
  errors?: string[];
}

// ============================================================================
// ЭЛЕМЕНТЫ СЕТИ
// ============================================================================

/**
 * Элемент сети для визуализации
 */
export interface NetworkElement {
  id: string;
  type: ElementType;
  name: string;
  parentId?: string;
  voltageLevel?: number;
  posX?: number;
  posY?: number;
}

/**
 * Связь между элементами
 */
export interface NetworkConnection {
  id: string;
  sourceId: string;
  targetId: string;
  connectionType: ConnectionType;
  cableLength?: number;
  cableSection?: number;
}

/**
 * Полная структура сети
 */
export interface NetworkData {
  elements: NetworkElement[];
  connections: NetworkConnection[];
}

// ============================================================================
// ДОПОЛНИТЕЛЬНЫЕ ТИПЫ
// ============================================================================

/**
 * Статус устройства
 */
export type DeviceStatus = 'active' | 'inactive' | 'fault' | 'maintenance';

/**
 * Статус выключателя
 */
export type BreakerStatus = 'on' | 'off' | 'tripped';

/**
 * Категория надёжности электроснабжения
 */
export type ReliabilityCategory = 1 | 2 | 3;

/**
 * Тревога
 */
export interface Alarm {
  id: string;
  elementId?: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  acknowledged: boolean;
  createdAt: Date;
  acknowledgedAt?: Date;
}

// ============================================================================
// ТИПЫ ДЛЯ ЦИФРОВОГО ДВОЙНИКА ЭЛЕКТРИЧЕСКОЙ СЕТИ
// ============================================================================

// Типы элементов сети
export type ElementType = 'SOURCE' | 'CABINET' | 'LOAD' | 'BUS' | 'METER' | 'BREAKER' | 'JUNCTION';

// Типы устройств
export type DeviceType = 'SOURCE' | 'BREAKER' | 'LOAD' | 'METER' | 'ATS' | 'SWITCH' | 'TRANSFORMER';

// Типы связей
export type ConnectionType = 'CABLE' | 'BUSBAR' | 'JUMPER';

// Материал проводника
export type MaterialType = 'Cu' | 'Al';

// Способ прокладки
export type InstallationMethod = 'in_ground' | 'in_air' | 'in_pipe' | 'in_tray';

// Статус валидации
export type ValidationStatus = 'PASS' | 'WARN' | 'FAIL' | 'CRITICAL';

// Категория валидации
export type ValidationCategory = 'PROTECTION' | 'CABLE' | 'SELECTIVITY' | 'VOLTAGE';

// ============================================================================
// СПРАВОЧНИКИ
// ============================================================================

// Данные кабеля из справочника
export interface CableReferenceData {
  wireType: string;        // Марка (АВВГ, ВВГ...)
  wireSize: number;        // Сечение (мм²)
  core: number;            // Количество жил
  material: MaterialType;  // Материал
  rOhmKm: number;          // Активное сопротивление (Ом/км)
  xOhmKm: number;          // Реактивное сопротивление (Ом/км)
  iAir: number;            // Допустимый ток в воздухе (А)
  iGround: number;         // Допустимый ток в земле (А)
}

// Тип выключателя
export type BreakerType = 'MCB' | 'MCCB' | 'ACB' | 'RCD' | 'RCBO';

// Данные выключателя из справочника
export interface BreakerReferenceData {
  id: string;
  manufacturer: string;    // Производитель
  model: string;           // Модель
  breakerType: BreakerType;  // Тип: MCB, MCCB, RCD, RCBO
  inRatings: number[];     // Доступные номинальные токи (А)
  poles: number;           // Количество полюсов
  voltage: number;         // Номинальное напряжение (В)
  breakingCapacity: number; // Отключающая способность (кА)
  trippingChars: string[]; // Характеристики расцепителя (B, C, D)
  leakageCurrent?: number; // Ток утечки (мА) - для RCD/RCBO
}

// Данные трансформатора из справочника
export interface TransformerReferenceData {
  id: string;
  model: string;           // Модель (ТМ-250/10)
  powerKva: number;        // Мощность (кВА)
  hvKv: number;            // Напряжение ВН (кВ)
  lvKv: number;            // Напряжение НН (кВ)
  ukPercent: number;       // Напряжение КЗ (%)
  pkKw?: number;           // Потери КЗ (кВт)
  p0Kw?: number;           // Потери ХХ (кВт)
}

// Все справочники
export interface ReferencesData {
  cables: CableReferenceData[];
  breakers: BreakerReferenceData[];
  transformers: TransformerReferenceData[];
}

// ============================================================================
// ЭЛЕМЕНТЫ СЕТИ
// ============================================================================

// Элемент сети (для API)
export interface NetworkElement {
  id: string;
  type: ElementType;
  name: string;
  description?: string;
  parentId?: string;
  location?: string;
  voltageLevel?: number;
  phase?: string;
  posX: number;
  posY: number;
  devices?: NetworkDevice[];
  validationResults?: ValidationResultData[];
}

// Устройство
export interface NetworkDevice {
  id: string;
  type: DeviceType;
  slotId: string;
  model?: string;
  manufacturer?: string;
  voltageNom?: number;
  currentNom?: number;
  currentMax?: number;
  breakingCapacity?: number;    // Отключающая способность (кА)
  curve?: string;               // Характеристика расцепителя (B, C, D)
  pKw?: number;
  qKvar?: number;
  sKva?: number;
  cosPhi?: number;
  poles?: number;
  trippingChar?: string;
  inRating?: number;
  // Для выключателей
  breakerType?: BreakerType;   // MCB | MCCB | RCD | RCBO
  leakageCurrent?: number;     // Ток утечки (мА)
  // Для нагрузок
  usageFactor?: number;        // Коэффициент использования Ки
}

// Связь
export interface NetworkConnection {
  id: string;
  fromId: string;
  toId: string;
  type: ConnectionType;
  length?: number;
  wireType?: string;
  cores?: number;              // Кол-во жил
  core?: number;               // Кол-во жил (альтернативное поле)
  wireSize?: number;           // Сечение (мм²)
  material?: MaterialType;
  resistanceR?: number;
  reactanceX?: number;
  impedanceZ?: number;
  currentCapacity?: number;
  installationMethod?: InstallationMethod;
}

// ============================================================================
// ГРАФ СЕТИ
// ============================================================================

// Статус элемента
export type ElementStatus = 'ON' | 'OFF' | 'UNKNOWN';
export type ElementLifeStatus = 'LIVE' | 'DEAD' | 'UNKNOWN';
export type OperationalStatus = 'ON' | 'OFF';
export type ElectricalStatus = 'LIVE' | 'DEAD' | 'UNKNOWN';

// Узел графа
export interface GraphNode {
  id: string;
  type: ElementType;
  name: string;
  parentId?: string;           // ID родительского элемента (шкафа/кабинета)
  posX?: number | null;        // Опционально - G6 сам расставит через ELK layout
  posY?: number | null;        // Опционально - G6 сам расставит через ELK layout
  hasIssues: boolean;
  criticalIssues: number;
  devices?: NetworkDevice[];
  validationResults?: ValidationResultData[];
  // Поля статуса
  status?: ElementStatus;
  lifeStatus?: ElementLifeStatus;
  voltageLevel?: number;
  // Мощности
  sumPInstalled?: number;      // Σ Pуст (кВт)
  sumPCalculated?: number;     // Σ Pрасч = Σ(Pуст × Ки) (кВт)
}

// Ребро графа
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: ConnectionType;
  length?: number;
  wireType?: string;
  wireSize?: number;
  cores?: number;              // Кол-во жил
  core?: string;
  material?: MaterialType;
  resistanceR?: number;
  reactanceX?: number;
  impedanceZ?: number;
  currentCapacity?: number;
  installationMethod?: InstallationMethod;
  // Статус соединения
  status?: ElementStatus;
  lifeStatus?: ElementLifeStatus;
  // Расчётные параметры
  voltageDrop?: number;
  shortCircuitCurrent?: number;
  loadCurrent?: number;
  // Результаты валидации кабеля
  validationResults?: ValidationResultData[];
}

// Данные графа для визуализации
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  combos?: GraphCombo[];
}

// Combo (группа узлов) для G6
export interface GraphCombo {
  id: string;
  label: string;
  data: {
    type: string;
    name: string;
  };
}

// ============================================================================
// ВАЛИДАЦИЯ
// ============================================================================

// Детали для tooltip валидации кабеля
export interface ValidationTooltipDetails {
  /** Номинальный ток выключателя */
  iNom: string;
  /** Допустимый ток по ПУЭ */
  iDopPUE: string;
  /** Загрузка кабеля в процентах */
  loadingPercent: string;
  /** Расчётный ток (для справки) */
  iRasch?: string;
  /** Предупреждение о расхождении данных */
  warning?: string;
}

// Результат валидации
export interface ValidationResultData {
  id: string;
  ruleCode: string;
  ruleName: string;
  status: ValidationStatus;
  elementId?: string;
  deviceId?: string;
  connectionId?: string;
  actualValue?: number;
  expectedValue?: number;
  deviation?: number;
  message: string;
  recommendation?: string;
  /** Детали для tooltip (для SECTION_001) */
  details?: ValidationTooltipDetails;
}

// Проблема валидации
export interface ValidationIssue {
  id: string;
  code: string;
  name: string;
  severity: ValidationStatus;
  elementName: string;
  message: string;
  recommendation: string;
  actualValue?: number;
  expectedValue?: number;
  /** Детали для tooltip (для SECTION_001) */
  details?: ValidationTooltipDetails;
}

// Правило валидации
export interface ValidationRule {
  code: string;
  name: string;
  description: string;
  category: ValidationCategory;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  check: (context: ValidationContext) => ValidationResultData | null;
}

// Контекст валидации
export interface ValidationContext {
  element: NetworkElement;
  devices: NetworkDevice[];
  connections: NetworkConnection[];
  cableRef: CableReferenceData | null;
  breakerRef: BreakerReferenceData | null;
  shortCircuitCurrent?: number;
  voltageDrop?: number;
}

// ============================================================================
// РАСЧЁТЫ
// ============================================================================

// Результат расчёта сопротивления кабеля
export interface ImpedanceResult {
  r: number;    // Активное сопротивление (Ом)
  x: number;    // Реактивное сопротивление (Ом)
  z: number;    // Полное сопротивление (Ом)
}

// Результат расчёта токов КЗ
export interface ShortCircuitResult {
  ik3: number;  // Ток трёхфазного КЗ (А)
  ik1: number;  // Ток однофазного КЗ (А)
  ik2: number;  // Ток двухфазного КЗ (А)
  zk: number;   // Сопротивление до точки КЗ (Ом)
}

// ============================================================================
// API RESPONSES
// ============================================================================

// Статистика сети
export interface NetworkStats {
  sources: number;
  cabinets: number;
  loads: number;
  breakers: number;
  totalElements: number;
  totalConnections: number;
  criticalIssues: number;
  warnings: number;
}

// Ответ API импорта
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

// Общий API ответ
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// ФОРМЫ
// ============================================================================

// Данные формы добавления элемента
export interface AddElementFormData {
  type: ElementType;
  name: string;
  description?: string;
  parentId?: string;
  location?: string;
  voltageLevel?: number;
  // Данные устройства
  deviceType?: DeviceType;
  deviceModel?: string;
  currentNom?: number;
  pKw?: number;
  qKvar?: number;
  cosPhi?: number;
}

// ============================================================================
// STATE PROPAGATION
// ============================================================================

// Конфликт мощностей
export interface PowerConflict {
  elementId: string;
  elementName: string;
  sourceName?: string;
  sources?: string[];          // Для DOUBLE_FEED конфликтов
  installedPower?: number;
  availablePower?: number;
  deficit?: number;
}

// Результат распространения состояний
export interface PropagationResult {
  success: boolean;
  elementsUpdated: number;
  connectionsUpdated: number;
  liveElements?: number;
  deadElements?: number;
  offElements?: number;
  conflicts: PowerConflict[];
  errors: string[];
}

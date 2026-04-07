// ============================================================================
// ГЕНЕРАТОР ID ДЛЯ ЭЛЕМЕНТОВ, УСТРОЙСТВ И СВЯЗЕЙ
// ============================================================================

import type { ElementType, DeviceType } from '../types';

// ============================================================================
// СЧЁТЧИКИ
// ============================================================================

let elementCounter = 0;
let deviceCounter = 0;
let connectionCounter = 0;

// Префиксы для типов элементов
const ELEMENT_PREFIXES: Record<ElementType, string> = {
  SOURCE: 'SRC',
  CABINET: 'CAB',
  LOAD: 'LOAD',
  BUS: 'BUS',
  METER: 'MTR',
  BREAKER: 'QF',
  JUNCTION: 'JCT',
};

// Префиксы для типов устройств
const DEVICE_PREFIXES: Record<DeviceType, string> = {
  SOURCE: 'DEV_S',
  BREAKER: 'DEV_B',
  LOAD: 'DEV_L',
  METER: 'DEV_M',
  ATS: 'DEV_A',
  SWITCH: 'DEV_SW',
  TRANSFORMER: 'DEV_T',
};

// ============================================================================
// ОСНОВНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Сбросить все счётчики ID
 * Вызывать перед началом нового импорта
 */
export function resetCounters(): void {
  elementCounter = 0;
  deviceCounter = 0;
  connectionCounter = 0;
}

/**
 * Генерация ID для элемента сети
 * 
 * @param type - тип элемента (SOURCE, CABINET, LOAD и т.д.)
 * @param prefix - дополнительный префикс (опционально)
 * @param name - имя элемента для включения в ID (опционально)
 * @returns уникальный ID элемента
 * 
 * @example
 * generateElementId('SOURCE') // 'SRC_0001'
 * generateElementId('BREAKER', 'QF1') // 'QF_QF1'
 * generateElementId('CABINET', undefined, 'ГРЩ1') // 'CAB_ГРЩ1'
 */
export function generateElementId(
  type: ElementType,
  prefix?: string,
  name?: string
): string {
  elementCounter++;
  
  const typePrefix = ELEMENT_PREFIXES[type];
  
  // Формируем суффикс: приоритет prefix > name > номер
  let suffix: string;
  if (prefix) {
    suffix = prefix;
  } else if (name) {
    suffix = name.replace(/\s+/g, '_').toUpperCase().slice(0, 30);
  } else {
    suffix = String(elementCounter).padStart(4, '0');
  }
  
  // Убираем лишние символы и ограничиваем длину
  const cleanSuffix = suffix.replace(/[^\w\u0400-\u04FF-]/g, '_');
  
  return `${typePrefix}_${cleanSuffix}`.substring(0, 80);
}

/**
 * Генерация ID для устройства
 * 
 * @param type - тип устройства (SOURCE, BREAKER, LOAD и т.д.)
 * @returns уникальный ID устройства
 * 
 * @example
 * generateDeviceId('BREAKER') // 'DEV_B_0001'
 * generateDeviceId('TRANSFORMER') // 'DEV_T_0002'
 */
export function generateDeviceId(type: DeviceType): string {
  deviceCounter++;
  
  const prefix = DEVICE_PREFIXES[type] || 'DEV';
  const num = String(deviceCounter).padStart(4, '0');
  
  return `${prefix}_${num}`;
}

/**
 * Генерация ID для связи между элементами
 * 
 * @param fromId - ID источника связи (опционально)
 * @param toId - ID приёмника связи (опционально)
 * @returns уникальный ID связи
 * 
 * @example
 * generateConnectionId('SRC_001', 'QF_001') // 'CONN_SRC_001_QF_001'
 * generateConnectionId() // 'CONN_0001'
 */
export function generateConnectionId(fromId?: string, toId?: string): string {
  connectionCounter++;
  
  if (fromId && toId) {
    // Формируем ID на основе концов связи
    const combined = `${fromId}_${toId}`.replace(/\s+/g, '_');
    return `CONN_${combined}`.substring(0, 100);
  }
  
  return `CONN_${String(connectionCounter).padStart(4, '0')}`;
}

// ============================================================================
// ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Генерация ID для слота устройства
 * 
 * @param elementId - ID элемента, к которому привязан слот
 * @returns уникальный ID слота
 */
export function generateSlotId(elementId: string): string {
  return `SLOT_${elementId}`;
}

/**
 * Генерация ID для кабеля
 * 
 * @param mark - марка кабеля (опционально)
 * @param length - длина кабеля (опционально)
 * @returns уникальный ID кабеля
 */
export function generateCableId(mark?: string, length?: number): string {
  const counter = Date.now();
  
  if (mark && length) {
    const cleanMark = mark.replace(/[^a-zA-Z0-9\u0400-\u04FF-]/g, '_');
    return `CABLE_${cleanMark}_${length}m_${counter}`.substring(0, 60);
  }
  
  return `CABLE_${counter}`;
}

/**
 * Генерация ID для измерения
 * 
 * @param meterId - ID счётчика
 * @param timestamp - временная метка (опционально)
 * @returns уникальный ID измерения
 */
export function generateReadingId(meterId: string, timestamp?: Date): string {
  const ts = timestamp?.getTime() || Date.now();
  return `READ_${meterId}_${ts}`;
}

/**
 * Генерация ID для тревоги
 * 
 * @param type - тип тревоги
 * @param elementId - ID элемента (опционально)
 * @returns уникальный ID тревоги
 */
export function generateAlarmId(type: string, elementId?: string): string {
  const ts = Date.now();
  
  if (elementId) {
    return `ALARM_${type}_${elementId}_${ts}`.substring(0, 80);
  }
  
  return `ALARM_${type}_${ts}`;
}

/**
 * Получить текущие значения счётчиков (для отладки)
 */
export function getCounters(): {
  elements: number;
  devices: number;
  connections: number;
} {
  return {
    elements: elementCounter,
    devices: deviceCounter,
    connections: connectionCounter,
  };
}

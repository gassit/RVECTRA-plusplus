// ============================================================================
// ГЕНЕРАТОР ID ДЛЯ ЭЛЕМЕНТОВ, УСТРОЙСТВ И СВЯЗЕЙ
// ============================================================================

import type { ElementType, DeviceType } from '@/types';

/**
 * Счётчики для генерации ID
 */
const counters = {
  source: 0,
  cabinet: 0,
  load: 0,
  breaker: 0,
  bus: 0,
  meter: 0,
  junction: 0,
  // Устройства
  deviceSource: 0,
  deviceBreaker: 0,
  deviceLoad: 0,
  deviceMeter: 0,
  deviceAts: 0,
  deviceSwitch: 0,
  deviceTransformer: 0,
  // Связи
  connection: 0,
};

/**
 * Сброс счётчиков (полезно при повторном импорте)
 */
export function resetCounters(): void {
  counters.source = 0;
  counters.cabinet = 0;
  counters.load = 0;
  counters.breaker = 0;
  counters.bus = 0;
  counters.meter = 0;
  counters.junction = 0;
  counters.deviceSource = 0;
  counters.deviceBreaker = 0;
  counters.deviceLoad = 0;
  counters.deviceMeter = 0;
  counters.deviceAts = 0;
  counters.deviceSwitch = 0;
  counters.deviceTransformer = 0;
  counters.connection = 0;
}

/**
 * Генерация ID для элемента
 * 
 * @param type - Тип элемента
 * @param prefix - Опциональный префикс (например, код ТП)
 * @param name - Опциональное имя (например, GRSCH для главного шкафа)
 * @returns ID элемента
 */
export function generateElementId(
  type: ElementType,
  prefix?: string,
  name?: string
): string {
  const prefixes: Record<ElementType, string> = {
    SOURCE: 'SRC',
    CABINET: 'CAB',
    LOAD: 'LOAD',
    BUS: 'BUS',
    METER: 'MTR',
    BREAKER: 'QF',
    JUNCTION: 'JUN',
  };

  const elementPrefix = prefixes[type];
  
  switch (type) {
    case 'SOURCE':
      counters.source++;
      return `${elementPrefix}_${prefix || 'TP'}${counters.source.toString().padStart(2, '0')}`;
    
    case 'CABINET':
      counters.cabinet++;
      if (name) {
        return `${elementPrefix}_${name}`;
      }
      return `${elementPrefix}_${counters.cabinet.toString().padStart(3, '0')}`;
    
    case 'LOAD':
      counters.load++;
      return `${elementPrefix}_${counters.load.toString().padStart(3, '0')}`;
    
    case 'BUS':
      counters.bus++;
      return `${elementPrefix}_${counters.bus.toString().padStart(2, '0')}`;
    
    case 'METER':
      counters.meter++;
      return `${elementPrefix}_${counters.meter.toString().padStart(3, '0')}`;
    
    case 'BREAKER':
      counters.breaker++;
      if (name) {
        return `${elementPrefix}_${name}`;
      }
      return `${elementPrefix}_${counters.breaker.toString().padStart(3, '0')}`;
    
    default:
      return `${elementPrefix}_${Date.now()}`;
  }
}

/**
 * Генерация ID для устройства
 * 
 * @param type - Тип устройства
 * @param parentId - ID родительского элемента (опционально)
 * @returns ID устройства
 */
export function generateDeviceId(type: DeviceType, parentId?: string): string {
  const prefixes: Record<DeviceType, string> = {
    SOURCE: 'DEV_S',
    BREAKER: 'DEV_B',
    LOAD: 'DEV_L',
    METER: 'DEV_M',
    ATS: 'DEV_A',
    SWITCH: 'DEV_SW',
    TRANSFORMER: 'DEV_T',
  };

  const devicePrefix = prefixes[type];
  
  switch (type) {
    case 'SOURCE':
      counters.deviceSource++;
      return `${devicePrefix}${counters.deviceSource.toString().padStart(3, '0')}`;
    
    case 'BREAKER':
      counters.deviceBreaker++;
      return `${devicePrefix}${counters.deviceBreaker.toString().padStart(3, '0')}`;
    
    case 'LOAD':
      counters.deviceLoad++;
      return `${devicePrefix}${counters.deviceLoad.toString().padStart(3, '0')}`;
    
    case 'METER':
      counters.deviceMeter++;
      return `${devicePrefix}${counters.deviceMeter.toString().padStart(3, '0')}`;
    
    case 'ATS':
      counters.deviceAts++;
      return `${devicePrefix}${counters.deviceAts.toString().padStart(3, '0')}`;
    
    case 'SWITCH':
      counters.deviceSwitch++;
      return `${devicePrefix}${counters.deviceSwitch.toString().padStart(3, '0')}`;
    
    case 'TRANSFORMER':
      counters.deviceTransformer++;
      return `${devicePrefix}${counters.deviceTransformer.toString().padStart(3, '0')}`;
    
    default:
      return `DEV_${Date.now()}`;
  }
}

/**
 * Генерация ID для связи
 * 
 * @param fromId - ID начального элемента
 * @param toId - ID конечного элемента
 * @returns ID связи
 */
export function generateConnectionId(fromId?: string, toId?: string): string {
  counters.connection++;
  
  if (fromId && toId) {
    // Создаём короткий хеш из двух ID
    const hash = `${fromId.slice(0, 5)}_${toId.slice(0, 5)}`;
    return `CONN_${hash}_${counters.connection}`;
  }
  
  return `CONN_${counters.connection.toString().padStart(4, '0')}`;
}

/**
 * Генерация ID для результата валидации
 * 
 * @param ruleCode - Код правила
 * @param elementId - ID элемента (опционально)
 * @returns ID результата валидации
 */
export function generateValidationId(ruleCode: string, elementId?: string): string {
  const timestamp = Date.now();
  
  if (elementId) {
    return `VAL_${ruleCode}_${elementId}_${timestamp}`;
  }
  
  return `VAL_${ruleCode}_${timestamp}`;
}

/**
 * Парсинг ID элемента для получения типа
 * 
 * @param id - ID элемента
 * @returns Тип элемента или null
 */
export function parseElementType(id: string): ElementType | null {
  if (id.startsWith('SRC_')) return 'SOURCE';
  if (id.startsWith('CAB_')) return 'CABINET';
  if (id.startsWith('LOAD_')) return 'LOAD';
  if (id.startsWith('BUS_')) return 'BUS';
  if (id.startsWith('MTR_')) return 'METER';
  if (id.startsWith('QF_')) return 'BREAKER';
  return null;
}

/**
 * Создание красивого имени для элемента
 * 
 * @param type - Тип элемента
 * @param customName - Пользовательское имя
 * @returns Имя элемента
 */
export function generateElementName(type: ElementType, customName?: string): string {
  if (customName) return customName;
  
  const names: Record<ElementType, string> = {
    SOURCE: `Источник ${counters.source}`,
    CABINET: `Шкаф ${counters.cabinet}`,
    LOAD: `Нагрузка ${counters.load}`,
    BUS: `Шина ${counters.bus}`,
    METER: `Счётчик ${counters.meter}`,
    BREAKER: `Выключатель ${counters.breaker}`,
    JUNCTION: `Узел ${counters.junction}`,
  };
  
  return names[type];
}

/**
 * Универсальный генератор ID
 * 
 * @param prefix - Префикс для ID (например, 'EL', 'DEV', 'UUID')
 * @returns ID в формате PREFIX_XXXXX
 */
export function generateId(prefix: string = 'ID'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}${random}`.toUpperCase();
}

/**
 * Генерация UUID v4
 * 
 * @returns UUID в формате xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default {
  resetCounters,
  generateElementId,
  generateDeviceId,
  generateConnectionId,
  generateValidationId,
  parseElementType,
  generateElementName,
  generateId,
  generateUUID,
};

/**
 * Типы статусов элементов сети
 */

// Электрический статус - есть ли напряжение на элементе
export type ElectricalStatus = "LIVE" | "DEAD";

// Оперативный статус - включен ли элемент вручную
export type OperationalStatus = "ON" | "OFF";

/**
 * Интерфейс элемента с полными статусами
 */
export interface ElementWithStatus {
  id: string;
  elementId: string;
  name: string;
  type: string;
  parentId: string | null;
  voltageLevel: number | null;
  posX: number | null;
  posY: number | null;
  electricalStatus: ElectricalStatus;
  operationalStatus: OperationalStatus;
}

/**
 * Интерфейс связи с полными статусами
 */
export interface ConnectionWithStatus {
  id: string;
  sourceId: string;
  targetId: string;
  electricalStatus: ElectricalStatus;
  operationalStatus: OperationalStatus;
}

/**
 * Типы элементов сети
 */
export type ElementType = "SOURCE" | "BREAKER" | "LOAD" | "METER" | "BUS" | "CABINET" | "JUNCTION";

/**
 * Результат распространения статусов
 */
export interface PropagationResult {
  elementsUpdated: number;
  connectionsUpdated: number;
  liveElements: number;
  deadElements: number;
  offElements: number;
}

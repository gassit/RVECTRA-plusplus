// ============================================================================
// ПРИСМА КЛИЕНТ ДЛЯ ДОСТУПА К БАЗЕ ДАННЫХ
// Экспортируется как `db` для использования в сервисах
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

// ============================================================================
// КОНФИГУРАЦИЯ
// ============================================================================

const globalForPrisma = globalThis as unknown as {
  db: PrismaClient | undefined;
};

// Подключение к базе данных SQLite через LibSQL
// БД находится внутри проекта: prisma/data/custom.db
const adapter = new PrismaLibSql({
  url: 'file:./prisma/data/custom.db'
});

// ============================================================================
// ЭКСПОРТ КЛИЕНТА
// ============================================================================

/**
 * Prisma клиент для работы с базой данных
 * 
 * @example
 * import { db } from '@/lib/db';
 * 
 * // Получить все элементы
 * const elements = await db.element.findMany();
 * 
 * // Создать элемент
 * const element = await db.element.create({
 *   data: { name: 'Test', type: 'LOAD' }
 * });
 */
export const db = globalForPrisma.db ?? new PrismaClient({ adapter });

// В development режиме сохраняем клиента в глобальную переменную
// для предотвращения создания новых подключений при hot reload
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.db = db;
}

// ============================================================================
// ТИПЫ ДЛЯ МОДЕЛЕЙ
// ============================================================================

export type {
  Element,
  Device,
  DeviceSlot,
  Breaker,
  Meter,
  MeterReading,
  Transformer,
  Load,
  Cable,
  Connection,
  CableReference,
  BreakerReference,
  TransformerReference,
  ValidationRule,
  ValidationResult,
  CalculatedParams,
  Alarm,
} from '@prisma/client';

// ============================================================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С БАЗОЙ
// ============================================================================

/**
 * Очистка всех таблиц базы данных
 * Используется перед повторным импортом данных
 */
export async function clearAllTables(): Promise<void> {
  await db.validationResult.deleteMany();
  await db.meterReading.deleteMany();
  await db.alarm.deleteMany();
  await db.calculatedParams.deleteMany();
  await db.connection.deleteMany();
  await db.cable.deleteMany();
  await db.load.deleteMany();
  await db.meter.deleteMany();
  await db.transformer.deleteMany();
  await db.breaker.deleteMany();
  await db.device.deleteMany();
  await db.deviceSlot.deleteMany();
  await db.element.deleteMany();
  await db.cableReference.deleteMany();
  await db.breakerReference.deleteMany();
  await db.transformerReference.deleteMany();
  await db.validationRule.deleteMany();
}

/**
 * Отключение от базы данных
 * Вызывать при завершении работы приложения
 */
export async function disconnectDatabase(): Promise<void> {
  await db.$disconnect();
}

/**
 * Подключение к базе данных
 * Вызывать при старте приложения (опционально)
 */
export async function connectDatabase(): Promise<void> {
  await db.$connect();
}

/**
 * Проверка соединения с базой данных
 * @returns true, если соединение установлено
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Транзакция с автоматическим откатом при ошибке
 * 
 * @param fn - функция, выполняемая в транзакции
 * @returns результат выполнения функции
 * 
 * @example
 * const result = await withTransaction(async (tx) => {
 *   const element = await tx.element.create({ data: {...} });
 *   await tx.device.create({ data: { elementId: element.id } });
 *   return element;
 * });
 */
export async function withTransaction<T>(
  fn: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return db.$transaction(fn);
}

// ============================================================================
// РЕЭКСПОРТ ПРИСМА КАК DB (для совместимости)
// ============================================================================

// Алиас для совместимости с кодом, использующим `prisma`
export { db as prisma };

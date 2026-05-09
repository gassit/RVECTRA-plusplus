# Лог ошибок проекта Network Digital Twin

> **Дата:** 2026-04-07  
> **Проект:** network-digital-twin (Next.js 16 + TypeScript + Prisma 7 + LibSQL)  
> **Контекст:** Слияние двух директорий проекта, первичный запуск, исправление ошибок

---

## Критические ошибки (блокирующие запуск)

### 1. Отсутствует файл `.env`
- **Проблема:** В проекте не было файла `.env` с переменной `DATABASE_URL`. Prisma не может подключиться к БД, все API-роуты падают.
- **Решение:** Создан `.env`:
  ```
  DATABASE_URL="file:/home/z/my-project/db/custom.db"
  ```

---

### 2. Конфликт Prisma-клиентов в `node_modules`
- **Проблема:** В `/home/z/my-project/node_modules/.prisma/` находился старый Prisma-клиент от предыдущей версии проекта. Prisma 7 при `prisma generate` создавал новый клиент, но при импорте `@prisma/client` подхватывался старый — несоответствие схем.
- **Решение:** Удалена директория `/home/z/my-project/node_modules/.prisma/`, затем повторён `prisma generate`.

---

### 3. Prisma 7 — отсутствует `output` в генераторе
- **Проблема:** В `prisma/schema.prisma` генератор `prisma-client-js` не содержал директиву `output`. Prisma 7 требует явного указания пути:
  ```prisma
  generator client {
    provider = "prisma-client-js"
    // НЕТ output — клиент не генерируется туда, где ожидает @prisma/client
  }
  ```
- **Решение:** Добавлено:
  ```prisma
  generator client {
    provider = "prisma-client-js"
    output   = "../node_modules/.prisma/client"
  }
  ```

---

### 4. Рассинхронизация схемы БД (schema drift)
- **Проблема:** Существующая БД `custom.db` не соответствовала текущей Prisma-схеме (отличались поля, таблицы, типы). Prisma отказывалась выполнять запросы.
- **Решение:** Полная пересоздание БД:
  ```bash
  npx prisma db push --force-reset
  npx prisma db seed
  ```

---

## Ошибки TypeScript (implicit `any`, 17 штук)

### 5. `app/api/network/route.ts` — implicit any в `.map()`
- **Проблема:** В 4 местах callbacks `.map()` получали параметры без типа, TypeScript выдавал `implicit any`:
  ```typescript
  // БЫЛО — ошибка
  elements.map((el) => ({ value: el.id, label: el.name }))
  connections.map((conn) => ({ ...conn }))
  ```
- **Решение:** Добавлены типы:
  ```typescript
  // СТАЛО
  type ElementRow = { id: string; name: string; type: string; parentId: string | null; x: number; y: number };
  type ConnRow = { id: string; name: string; fromId: string; toId: string; cableType: string; length: number; status: string };
  elements.map((el: ElementRow) => ({ value: el.id, label: el.name }))
  connections.map((conn: ConnRow) => ({ ...conn }))
  ```

---

### 6. `app/api/stats/route.ts` — implicit any в `.filter()` и `.reduce()`
- **Проблема:** Callbacks в цепочках `.filter().reduce()` не имели типов параметров:
  ```typescript
  // БЫЛО — ошибка
  allElements.filter(el => el.type === 'CABINET').length
  ```
- **Решение:** Добавлены inline-типы:
  ```typescript
  // СТАЛО
  allElements.filter((el: { type: string }) => el.type === 'CABINET').length
  allElements.reduce((acc: Record<string, number>, el: { type: string }) => {
    acc[el.type] = (acc[el.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>)
  ```

---

### 7. `app/api/validation/route.ts` — implicit any в цепочке `.flatMap().filter().map()`
- **Проблема:** Три уровня цепочки без типов:
  ```typescript
  // БЫЛО — ошибка
  Object.entries(rules).flatMap(([category, categoryRules]) =>
    categoryRules.filter(r => !r.passed).map(r => ({ category, ...r }))
  )
  ```
- **Решение:** Inline-типы на каждом уровне:
  ```typescript
  // СТАЛО
  Object.entries(rules).flatMap(([category, categoryRules]: [string, any[]]) =>
    categoryRules.filter((r: { passed: boolean }) => !r.passed).map((r: any) => ({ category, ...r }))
  )
  ```

---

### 8. `lib/utils/id-generator.ts` — отсутствует `JUNCTION` в Record<ElementType, string>
- **Проблема:** Тип `ElementType` включает `JUNCTION`, но два `Record<ElementType, string>` объекта не содержали ключ `JUNCTION`. TypeScript: «Type `Record<ElementType, string>` is missing property `JUNCTION`».
  ```typescript
  // БЫЛО — ошибка
  const prefixes: Record<ElementType, string> = {
    SOURCE: 'SRC', BUSBAR: 'BB', TRANSFORMER: 'TR', ...
    // JUNCTION отсутствует
  };
  ```
- **Решение:** Добавлено в оба Record-объекта:
  ```typescript
  // СТАЛО
  JUNCTION: 'JNC'
  ```

---

## Ошибки импортов

### 9. `prisma/seed.ts` — неправильный путь импорта Prisma-клиента
- **Проблема:** Импортировался из несуществующего пути:
  ```typescript
  import { PrismaClient } from '../app/generated/prisma/client'; // НЕ СУЩЕСТВУЕТ
  ```
- **Решение:** Стандартный импорт:
  ```typescript
  import { PrismaClient } from '@prisma/client';
  ```

---

### 10. `scripts/import-data.ts` — тот же неправильный импорт
- **Проблема:** Аналогично `seed.ts`:
  ```typescript
  import { PrismaClient } from '../app/generated/prisma/client';
  ```
- **Решение:**
  ```typescript
  import { PrismaClient } from '@prisma/client';
  ```

---

## Некритичные проблемы (не блокируют запуск, но требуют внимания)

### 11. Файл `validation.service.ts` не перенесён
- **Проблема:** Сервис валидации из старого проекта использовал предыдущую схему БД (другие поля, другая структура). Прямая миграция невозможна — требуется переписывание под текущую схему.
- **Статус:** ❌ Не исправлено. Валидация работает через упрощённую inline-логику в `api/validation/route.ts`.

---

### 12. Заглушка расчёта падения напряжения
- **Проблема:** `lib/calculations/voltageDrop.ts` содержит минимальную реализацию — расчёт по базовой формуле без учёта:
  - Температуры кабеля
  - Реактивной мощности
  - Схемы прокладки (в воздухе/в земле)
  - Параллельных кабелей
- **Статус:** ❌ Не исправлено. Требует доработки для реальных расчётов.

---

### 13. Захардкоженный путь к файлу импорта
- **Проблема:** В `lib/services/import.service.ts` путь к Excel-файлу захардкожен:
  ```typescript
  const filePath = '/home/z/my-project/public/cable_journal.xlsx';
  ```
- **Статус:** ❌ Не исправлено. Требует выноса в конфиг или параметр API-запроса.

---

### 14. Отсутствие карточек «Кабельные шкафы» в UI
- **Проблема:** Статистическая панель на главной странице не отображает количество кабельных шкафов (CABINET), хотя тип `CABINET` существует в схеме.
- **Статус:** ❌ Не исправлено. Требует добавления в `components/` или в API `/stats`.

---

### 15. Отсутствие `validation.service.ts` в структуре
- **Проблема:** В исходном плане (CLAUDE.md) был предусмотрен файл `lib/services/validation.service.ts`, но он не создан при миграции. Логика валидации разбросана по API-роутам.
- **Статус:** ❌ Не исправлено. Рекомендуется вынести валидационную логику в отдельный сервис.

---

## Итог

| Категория | Количество | Исправлено |
|-----------|-----------|------------|
| Критические (блокирующие) | 4 | ✅ 4/4 |
| TypeScript implicit any | 4 (17 ошибок) | ✅ 4/4 |
| Ошибки импортов | 2 | ✅ 2/2 |
| Некритичные | 5 | ❌ 0/5 |

**Всего:** 15 проблем найдено, 10 исправлено, 5 отложено.

---

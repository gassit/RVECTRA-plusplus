# Инструкция по восстановлению проекта RVectrA

## Быстрое восстановление

```bash
cd /home/z/my-project
git pull origin main
npx prisma generate
npx prisma db push
```

## Репозитории

| Репозиторий | URL | Статус |
|-------------|-----|--------|
| RVectraPRo | https://github.com/gassit/RVectraPRo | ✅ Актуален |
| RVECTRA-plusplus | https://github.com/gassit/RVECTRA-plusplus | ✅ Актуален |
| RVectrA-plus | https://github.com/gassit/RVectrA-plus | ❌ Токен истёк |

## Ключевые изменения (последние сессии)

### 2026-04-28

#### Breaker — новые параметры
- `breakerType` — тип автомата (MCB, MCCB, RCD, RCBO)
- `ratedCurrent` — номинальный ток (А)
- `breakingCapacity` — отключающая способность (кА)
- `curve` — характеристика расцепителя (B, C, D)
- `leakageCurrent` — ток утечки (мА) для RCD/RCBO

#### Cable — новые параметры
- `cores` — количество жил

#### Excel шаблон (`upload/ШАБЛОН_ИМПОРТА.xlsx`)
Обновлённые колонки:
- Номинальный ток (А) → Breaker.ratedCurrent
- Отключ. способность (кА) → Breaker.breakingCapacity
- Характеристика → Breaker.curve
- Ток утечки (мА) → Breaker.leakageCurrent
- Кол-во жил → Cable.cores
- Допустимый ток (А) → Cable.iDop
- ~~Защита Тип защиты~~ — УДАЛЕНО

#### Cabinet grouping (Combo)
Элементы группируются по шкафам (cabinet) с помощью G6 combo.
Файлы: `src/components/NetworkGraphG6.tsx`, `app/api/network/route.ts`

### Миграции БД

```bash
# Применить все миграции
npx prisma migrate dev

# Или принудительно синхронизировать схему
npx prisma db push
```

Миграции:
- `20260428065141_add_breaker_leakage_current` — leakageCurrent для Breaker/BreakerReference
- `20260428071245_add_breaker_cable_params` — breakingCapacity, curve, cores

## Важные файлы

| Файл | Назначение |
|------|------------|
| `prisma/schema.prisma` | Схема базы данных |
| `src/types/index.ts` | TypeScript типы |
| `src/components/NetworkGraphG6.tsx` | Визуализация графа (G6) |
| `scripts/import-universal.ts` | Импорт из Excel |
| `app/api/network/route.ts` | API для графа |
| `upload/ШАБЛОН_ИМПОРТА.xlsx` | Шаблон импорта |
| `upload/input.xlsx` | Реальные данные |

## Импорт данных

```bash
npx tsx scripts/import-universal.ts
# или с указанием файла:
npx tsx -e "import { importUniversal } from './scripts/import-universal'; importUniversal({ filePath: '/home/z/my-project/upload/input.xlsx' });"
```

## Запуск проекта

```bash
cd /home/z/my-project
npm run dev
```

Открыть: http://localhost:3000

---

**Последнее обновление:** 2026-04-28
**Коммит:** 93977c4

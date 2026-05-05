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
| RVA-Q | https://github.com/gassit/RVA-Q | ✅ Актуален |
| RVectrA-plus | https://github.com/gassit/RVectrA-plus | ❌ Токен истёк |

## Ключевые изменения

### 2026-05-04

#### Исправлен импорт (import-universal.ts)
- Добавлены поля `sumPInstalled` и `sumPCalculated` в схему Element
- Исправлена ошибка `PrismaClientKnownRequestError: The column sumPInstalled does not exist`
- Синхронизация БД: `npx prisma db push`

#### Layout автоматический расчёт
- Создан API `/api/layout` (POST) для расчёта координат элементов
- Алгоритм BFS от источников (source) с 24 уровнями
- Координаты сохраняются в `posX`, `posY`

#### Расчёт потерь напряжения
- Исправлена формула: ΔU = (P × L) / (U × S × γ)
- Конвертация кВ в В: 0.4 кВ → 400 В
- Файл: `src/lib/voltageDropCalc.ts`

#### Tooltip улучшения
- **Устройства:** табличный формат в 2 колонки (Iном, Pуст, Тип, Откл.спос., Хар-ка, Iут, Полюсов)
- **Напряжение:** автоматическая конвертация < 1 кВ → в Вольты (0.4 → 400 В)
- **Мощности:** всегда показывать Σ Pуст и Σ Pрасч (даже если 0)
- Файл: `src/components/NetworkGraphG6.tsx`

#### Исправлена ошибка postLayout
- Добавлены проверки: `mountedRef.current`, `!(graph as any).destroyed`, `typeof graph.layout === 'function'`
- Promise.catch() для обработки ошибок layout

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
| `src/components/NetworkGraphG6.tsx` | Визуализация графа (G6) + Tooltip |
| `src/lib/voltageDropCalc.ts` | Расчёт потерь напряжения |
| `src/lib/power.ts` | Расчёт мощностей |
| `scripts/import-universal.ts` | Импорт из Excel |
| `app/api/network/route.ts` | API для графа |
| `app/api/layout/route.ts` | API для расчёта координат |
| `upload/ШАБЛОН_ИМПОРТА.xlsx` | Шаблон импорта |
| `upload/input.xlsx` | Реальные данные |

## Импорт данных

```bash
# Импорт с расчётом состояний и layout
npx tsx scripts/import-universal.ts upload/input.xlsx

# После импорта - рассчитать координаты
curl -X POST http://localhost:3000/api/layout
```

## Запуск проекта

```bash
cd /home/z/my-project
npm run dev
```

Открыть: http://localhost:3000

---

**Последнее обновление:** 2026-05-04
**Коммит:** 3e4881a

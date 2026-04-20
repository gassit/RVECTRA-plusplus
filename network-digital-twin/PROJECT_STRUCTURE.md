# Цифровой двойник электросети — Структура проекта

> Автономное веб-приложение для моделирования электрической сети
> Дата анализа: 2026-04-07

---

## 📁 Структура директорий

```
/home/z/my-project/network-digital-twin/
├── app/                              # Next.js 16 App Router
│   ├── api/                          # API Routes (Backend)
│   │   ├── import/route.ts           # POST: Импорт данных из Excel
│   │   ├── network/route.ts          # GET: Элементы и связи сети
│   │   ├── references/route.ts       # GET: Справочники ПУЭ
│   │   ├── stats/route.ts            # GET: Статистика по сети
│   │   └── validation/route.ts       # GET: Результаты валидации
│   ├── globals.css                   # Глобальные стили Tailwind
│   ├── layout.tsx                    # Root Layout с ThemeProvider
│   ├── page.tsx                      # Главная страница
│   └── favicon.ico
│
├── components/
│   ├── network/
│   │   └── NetworkGraph.tsx          # Граф сети (Cytoscape.js)
│   └── providers/
│       └── ThemeProvider.tsx         # Контекст темы (день/ночь)
│
├── lib/
│   ├── calculations/
│   │   └── impedance.ts              # Расчёты сопротивлений, КЗ
│   ├── data/
│   │   └── references.ts             # Справочники кабелей (ПУЭ)
│   ├── types/
│   │   └── index.ts                  # TypeScript типы и интерфейсы
│   ├── utils/
│   │   └── id-generator.ts           # Генератор уникальных ID
│   ├── db.ts                         # Prisma клиент (экспорт db)
│   └── prisma.ts                     # Реэкспорт Prisma
│
├── prisma/
│   ├── data/
│   │   └── custom.db                 # База данных SQLite
│   ├── schema.prisma                 # Схема БД (19 таблиц)
│   ├── seed.ts                       # Начальные данные
│   └── migrations/
│       └── 20260331125338_init/
│           └── migration.sql
│
├── public/
│   ├── icons/
│   │   ├── breaker.jpg               # Иконка выключателя
│   │   ├── load.jpg                  # Иконка нагрузки
│   │   ├── source.jpg                # Иконка источника
│   │   ├── meter.jpg                 # Иконка счётчика
│   │   └── Точрасп.jpg               # Иконка точки распределения
│   └── *.svg                         # Статичные SVG файлы
│
├── scripts/
│   ├── import-data.ts                # Основной скрипт импорта Excel
│   ├── import-service.ts             # Сервис импорта
│   ├── import-echo-data.ts           # Альтернативный импорт
│   └── check-excel.ts                # Проверка Excel файла
│
├── .next/                            # Скомпилированный Next.js (gitignore)
├── node_modules/                     # Зависимости (385 пакетов)
│
├── package.json                      # Зависимости и скрипты
├── package-lock.json                 # Lockfile
├── tsconfig.json                     # Конфигурация TypeScript
├── tailwind.config.ts                # Конфигурация Tailwind CSS 4
├── next.config.ts                    # Конфигурация Next.js
├── next-env.d.ts                     # Типы Next.js
├── postcss.config.mjs                # Конфигурация PostCSS
├── eslint.config.mjs                 # Конфигурация ESLint
├── prisma.config.ts                  # Конфигурация Prisma
│
├── PROJECT_CONTEXT.md                # Контекст проекта
├── PROJECT_STRUCTURE.md              # Этот файл
├── README.md                         # Описание проекта
├── AGENTS.md                         # Инструкции для AI агентов
└── CLAUDE.md                         # Инструкции для Claude
```

---

## 📦 Зависимости (package.json)

### Runtime Dependencies (Production)

| Пакет | Версия | Назначение |
|-------|--------|------------|
| `next` | 16.2.1 | Next.js фреймворк (App Router) |
| `react` | 19.2.4 | React библиотека |
| `react-dom` | 19.2.4 | React DOM рендеринг |
| `prisma` | 7.6.0 | ORM для работы с БД |
| `@prisma/client` | 7.6.0 | Prisma клиент |
| `@prisma/adapter-libsql` | 7.6.0 | Адаптер для LibSQL/SQLite |
| `@libsql/client` | 0.17.2 | Клиент LibSQL (SQLite) |
| `cytoscape` | 3.33.1 | Библиотека для визуализации графов |
| `@types/cytoscape` | 3.21.9 | TypeScript типы для Cytoscape |
| `xlsx` | 0.18.5 | Парсинг Excel файлов |

### Development Dependencies

| Пакет | Версия | Назначение |
|-------|--------|------------|
| `typescript` | ^5 | Компилятор TypeScript |
| `@types/node` | ^20 | Типы Node.js |
| `@types/react` | ^19 | Типы React |
| `@types/react-dom` | ^19 | Типы React DOM |
| `tailwindcss` | ^4 | Tailwind CSS v4 |
| `@tailwindcss/postcss` | ^4 | PostCSS плагин Tailwind |
| `eslint` | ^9 | Линтер JavaScript/TypeScript |
| `eslint-config-next` | 16.2.1 | ESLint конфигурация для Next.js |
| `tsx` | 4.21.0 | Запуск TypeScript файлов напрямую |
| `dotenv` | 17.3.1 | Загрузка .env файлов |

### NPM Scripts

```json
{
  "dev": "next dev --webpack",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

---

## 🗄️ База данных (Prisma + SQLite)

### Расположение
```
/home/z/my-project/network-digital-twin/prisma/data/custom.db
```

> ⚠️ **Важно**: БД находится ВНУТРИ проекта. При удалении родительской папки `/home/z/my-project/` БД не потеряется.

### Схема БД (19 таблиц)

#### Основные таблицы

| Таблица | Описание | Ключевые поля |
|---------|----------|---------------|
| `Element` | Узлы сети | id, elementId, name, type, parentId, posX, posY |
| `Connection` | Связи между элементами | sourceId, targetId, cableId |
| `Cable` | Кабельные линии | cableId, length, section, material, iDop |
| `Device` | Устройства | deviceId, slotId, deviceType, status |
| `DeviceSlot` | Слоты для устройств | slotId, slotType, elementId |

#### Типы устройств

| Таблица | Описание | Ключевые поля |
|---------|----------|---------------|
| `Breaker` | Выключатели | ratedCurrent, currentSetting, status, tripCount |
| `Meter` | Счётчики | meterType, serialNumber, accuracy, tariff |
| `MeterReading` | Показания счётчиков | activeEnergy, reactiveEnergy, powerP, powerQ |
| `Transformer` | Трансформаторы | power, primaryKV, secondaryKV, loadPercent |
| `Load` | Нагрузки | powerP, powerQ, cosPhi, category |

#### Справочники

| Таблица | Описание | Ключевые поля |
|---------|----------|---------------|
| `CableReference` | Справочник кабелей (ПУЭ) | mark, section, material, iDop, r0, x0 |
| `BreakerReference` | Справочник выключателей | type, ratedCurrent, breakingCapacity, curve |
| `TransformerReference` | Справочник трансформаторов | type, power, primaryKV, secondaryKV, ukz |

#### Расчёты и валидация

| Таблица | Описание | Ключевые поля |
|---------|----------|---------------|
| `CalculatedParams` | Расчётные параметры | current, voltage, power, voltageDrop, shortCircuitCurrent |
| `ValidationRule` | Правила валидации | name, description, formula, severity |
| `ValidationResult` | Результаты валидации | ruleId, elementId, status, message, value, limit |
| `Alarm` | Аварийные сигналы | type, severity, message, acknowledged |

---

## 🌐 API Endpoints

### GET /api/network
Возвращает элементы и связи сети для визуализации.

**Response:**
```json
{
  "elements": [
    { "id": "clx...", "elementId": "QF1_1SH", "name": "Автомат 1", "type": "breaker" }
  ],
  "connections": [
    { "id": "clx...", "sourceId": "...", "targetId": "..." }
  ]
}
```

### GET /api/stats
Возвращает статистику по сети.

**Response:**
```json
{
  "elements": { "sources": 2, "buses": 5, "breakers": 143, "meters": 10, "loads": 30, "junctions": 4, "total": 194 },
  "power": { "total": 1000, "consumed": 450, "free": 550 },
  "connections": 202
}
```

### GET /api/validation
Возвращает результаты валидации сети.

**Response:**
```json
{
  "rules": [...],
  "issues": [
    { "rule": "breaker_cable_coordination", "elementId": "QF1", "status": "error", "message": "..." }
  ],
  "stats": { "total": 50, "errors": 2, "warnings": 5, "passed": 43 }
}
```

### GET /api/references
Возвращает справочные данные.

### POST /api/import
Импорт данных из Excel файла.

---

## 🎨 Типы элементов сети

| Тип | Описание | Цвет в графе | Форма |
|-----|----------|--------------|-------|
| `source` | Источник питания (ТП, ИБП) | Жёлтый (#fbbf24) | Октагон |
| `bus` | Сборные шины | Медный (#d97706) | Удлинённый прямоугольник |
| `breaker` | Выключатель (QF) | Чёрный/белый | RoundRectangle |
| `meter` | Счётчик (ПУМ) | Синий (#3b82f6) | Diamond |
| `load` | Нагрузка (ЭПУ) | Тёмный (#374151) | Rectangle |
| `junction` | Точка распределения | Серый (#9ca3af) | Ellipse |

---

## ⚡ Модуль расчётов (lib/calculations/impedance.ts)

### Функции расчёта сопротивлений

| Функция | Описание | Параметры |
|---------|----------|-----------|
| `calculateCableImpedanceFromReference()` | По справочнику | length, wireType, wireSize |
| `calculateImpedanceByFormula()` | По формуле | length, wireSize, material, temperature |
| `calculateBusbarImpedance()` | Шинопровод | length, crossSection, material |

### Функции падения напряжения

| Функция | Описание |
|---------|----------|
| `calculateVoltageDrop()` | Падение напряжения (В) |
| `calculateVoltageDropPercent()` | Падение напряжения (%) |
| `isVoltageDropAcceptable()` | Проверка допустимости (≤ 5%) |
| `calculateMaxLength()` | Максимальная длина кабеля |

### Функции токов КЗ

| Функция | Описание |
|---------|----------|
| `calculateThreePhaseShortCircuitCurrent()` | Ток 3-фазного КЗ |
| `calculateSinglePhaseShortCircuitCurrent()` | Ток 1-фазного КЗ |

### Функции потерь

| Функция | Описание |
|---------|----------|
| `calculatePowerLoss()` | Потери активной мощности (Вт) |

---

## 📊 Справочники ПУЭ (lib/data/references.ts)

### Кабели с медными жилами (ВВГ)
- Сечения: 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240 мм²
- Данные: r0, x0 (Ом/км), I в воздухе, I в земле

### Кабели с алюминиевыми жилами (АВВГ)
- Сечения: 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240 мм²

### Бронированные кабели (ВБбШв, АВБбШв)
- Для прокладки в земле и агрессивных средах

---

## 📈 Текущие данные

| Параметр | Значение |
|----------|----------|
| Элементов | 194 |
| Источников | 2 |
| Автоматов | 143 |
| Узлов | 49 |
| Связей | 202 |
| Источник данных | `/home/z/my-project/upload/input.xlsx` |

---

## 🚀 Запуск проекта

```bash
cd /home/z/my-project/network-digital-twin
npm run dev
```

Сервер запускается на: http://localhost:3000

### Сборка для production

```bash
npm run build
npm start
```

---

## ✅ Статус реализации

### Реализовано
- [x] База данных Prisma + SQLite (19 таблиц)
- [x] Импорт данных из Excel
- [x] Граф сети (Cytoscape.js)
- [x] Иерархический layout (BFS)
- [x] Цвета узлов по типам
- [x] Тёмная/светлая тема
- [x] API endpoints (5 штук)
- [x] Система валидации (базовая)
- [x] Расчёты сопротивлений и КЗ
- [x] Справочники ПУЭ (кабели)

### В разработке (TODO)
- [ ] Добавление потребителей через UI
- [ ] Редактирование параметров устройств
- [ ] Полноценный расчёт токов КЗ по всей сети
- [ ] Профили нагрузки (графики P(t))
- [ ] АВР автоматика
- [ ] Экспорт отчётов
- [ ] Детальная панель свойств узла
- [ ] Справочники выключателей и трансформаторов

---

## 📝 Примечания

1. **Webpack**: Проект использует webpack (не turbopack) из-за проблем совместимости
2. **БД**: SQLite через LibSQL адаптер
3. **Типы**: Строгая типизация TypeScript
4. **Стили**: Tailwind CSS v4 с поддержкой тёмной темы

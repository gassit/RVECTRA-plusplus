# Детальный анализ проекта: Цифровой двойник электросети

> Дата анализа: 2026-04-07
> Расположение: `/home/z/my-project/network-digital-twin/`
> Версия проекта: 0.1.0

---

## Содержание

1. [Общая информация](#1-общая-информация)
2. [Структура директорий](#2-структура-директорий)
3. [Зависимости проекта](#3-зависимости-проекта)
4. [Конфигурации](#4-конфигурации)
5. [База данных Prisma](#5-база-данных-prisma)
6. [API Endpoints](#6-api-endpoints)
7. [React компоненты](#7-react-компоненты)
8. [Модуль расчётов](#8-модуль-расчётов)
9. [Сервис импорта данных](#9-сервис-импорта-данных)
10. [Справочники ПУЭ](#10-справочники-пуэ)
11. [Типы данных TypeScript](#11-типы-данных-typescript)
12. [Статус реализации](#12-статус-реализации)

---

## 1. Общая информация

| Параметр | Значение |
|----------|----------|
| **Название** | network-digital-twin |
| **Версия** | 0.1.0 |
| **Тип проекта** | Next.js 16 (App Router) |
| **База данных** | SQLite (Prisma ORM + LibSQL) |
| **Язык** | TypeScript 5 |
| **Стили** | Tailwind CSS 4 |
| **Визуализация** | Cytoscape.js |
| **node_modules** | ✅ Установлены (385 пакетов) |
| **Сборка** | ✅ Присутствует (.next/) |

### Ключевые особенности

- **Автономность**: Все расчёты выполняются локально без внешних API
- **Импорт данных**: Загрузка топологии сети из Excel файлов
- **Визуализация**: Интерактивный граф сети с масштабированием
- **Валидация**: Проверка соответствия ПУЭ (Правила устройства электроустановок)
- **Тёмная тема**: Переключение день/ночь с сохранением в localStorage

---

## 2. Структура директорий

```
/home/z/my-project/network-digital-twin/
│
├── app/                              # Next.js 16 App Router
│   ├── api/                          # API Routes (Backend)
│   │   ├── import/route.ts           # POST: Импорт данных из Excel
│   │   ├── network/route.ts          # GET: Элементы и связи сети
│   │   ├── references/route.ts       # GET/POST: Справочники ПУЭ
│   │   ├── stats/route.ts            # GET: Статистика по сети
│   │   └── validation/route.ts       # GET: Результаты валидации
│   │
│   ├── globals.css                   # Глобальные стили Tailwind CSS 4
│   ├── layout.tsx                    # Root Layout с ThemeProvider
│   ├── page.tsx                      # Главная страница приложения
│   └── favicon.ico                   # Иконка сайта
│
├── components/                       # React компоненты
│   ├── network/
│   │   └── NetworkGraph.tsx          # Граф сети (Cytoscape.js)
│   └── providers/
│       └── ThemeProvider.tsx         # Контекст темы (день/ночь)
│
├── lib/                              # Библиотеки и утилиты
│   ├── calculations/
│   │   └── impedance.ts              # Расчёты сопротивлений, КЗ, потерь
│   │
│   ├── data/
│   │   └── references.ts             # Справочники кабелей (ПУЭ)
│   │
│   ├── types/
│   │   └── index.ts                  # TypeScript типы и интерфейсы
│   │
│   ├── utils/
│   │   └── id-generator.ts           # Генератор уникальных ID
│   │
│   ├── db.ts                         # Prisma клиент (экспорт db)
│   └── prisma.ts                     # Реэкспорт Prisma (алиас)
│
├── prisma/                           # Prisma ORM
│   ├── data/
│   │   └── custom.db                 # База данных SQLite
│   │
│   ├── schema.prisma                 # Схема БД (19 таблиц)
│   ├── seed.ts                       # Начальные данные (справочники)
│   │
│   └── migrations/
│       └── 20260331125338_init/
│           └── migration.sql         # Начальная миграция
│
├── public/                           # Статичные файлы
│   ├── icons/
│   │   ├── breaker.jpg               # Иконка выключателя
│   │   ├── load.jpg                  # Иконка нагрузки
│   │   ├── source.jpg                # Иконка источника
│   │   ├── meter.jpg                 # Иконка счётчика
│   │   └── Точрасп.jpg               # Иконка точки распределения
│   │
│   └── *.svg                         # SVG файлы Next.js
│
├── scripts/                          # Вспомогательные скрипты
│   ├── check-excel.ts                # Проверка структуры Excel файла
│   ├── import-data.ts                # Альтернативный скрипт импорта
│   ├── import-service.ts             # Основной сервис импорта (734 строки)
│   └── import-echo-data.ts           # Альтернативный импорт
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
├── .gitignore                        # Git ignore
│
├── PROJECT_CONTEXT.md                # Краткий контекст проекта
├── PROJECT_STRUCTURE.md              # Структура проекта
├── PROJECT_ANALYSIS.md               # Этот файл (детальный анализ)
├── README.md                         # Описание проекта
├── AGENTS.md                         # Инструкции для AI агентов
└── CLAUDE.md                         # Ссылка на AGENTS.md
```

### Количество файлов по категориям

| Категория | Количество |
|-----------|------------|
| TypeScript файлы (.ts) | 17 |
| React компоненты (.tsx) | 4 |
| Конфигурационные файлы | 8 |
| Документация (.md) | 6 |
| SQL миграции | 1 |
| База данных | 1 (custom.db) |
| Иконки (jpg) | 5 |
| SVG файлы | 5 |

---

## 3. Зависимости проекта

### 3.1 Runtime Dependencies (Production)

| Пакет | Версия | Назначение |
|-------|--------|------------|
| `next` | 16.2.1 | Next.js фреймворк (App Router) |
| `react` | 19.2.4 | React библиотека |
| `react-dom` | 19.2.4 | React DOM рендеринг |
| `prisma` | 7.6.0 | CLI для миграций |
| `@prisma/client` | 7.6.0 | Prisma клиент для работы с БД |
| `@prisma/adapter-libsql` | 7.6.0 | Адаптер для LibSQL/SQLite |
| `@libsql/client` | 0.17.2 | Клиент LibSQL (SQLite) |
| `cytoscape` | 3.33.1 | Библиотека визуализации графов |
| `@types/cytoscape` | 3.21.9 | TypeScript типы для Cytoscape |
| `xlsx` | 0.18.5 | Парсинг Excel файлов (SheetJS) |

**Итого production зависимостей:** 10 пакетов

### 3.2 Development Dependencies

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

**Итого dev зависимостей:** 10 пакетов

### 3.3 NPM Scripts

```json
{
  "dev": "next dev --webpack",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

**Примечание:** Проект использует webpack (флаг `--webpack`), а не turbopack, из-за проблем совместимости.

---

## 4. Конфигурации

### 4.1 TypeScript (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**Ключевые настройки:**
- **strict**: Строгая типизация включена
- **jsx: react-jsx**: Новый JSX трансформ React 19
- **paths**: Алиас `@/*` для импортов

### 4.2 Next.js (next.config.ts)

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'preview-chat-1775304686929004576.space.z.ai',
    '.space.z.ai',
  ],
};

export default nextConfig;
```

**Назначение:** Разрешает запросы с доменов preview для работы в среде Z.ai.

### 4.3 Tailwind CSS (tailwind.config.ts)

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
      },
    },
  },
  plugins: [],
};

export default config;
```

**Особенности:**
- **darkMode: "class"**: Управление темой через класс `dark` на `<html>`
- **content**: Автоматическое удаление неиспользуемых стилей
- **CSS переменные**: Цвета через HSL переменные

### 4.4 Prisma (prisma.config.ts)

```typescript
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

### 4.5 PostCSS (postcss.config.mjs)

```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

---

## 5. База данных Prisma

### 5.1 Расположение

```
/home/z/my-project/network-digital-twin/prisma/data/custom.db
```

**Важно:** БД находится ВНУТРИ проекта и не зависит от внешних путей.

### 5.2 Подключение

Файл `lib/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const adapter = new PrismaLibSql({
  url: 'file:./prisma/data/custom.db'
});

export const db = new PrismaClient({ adapter });
```

### 5.3 Схема БД (19 таблиц)

#### Основные таблицы

| Таблица | Описание | Ключевые поля |
|---------|----------|---------------|
| `Element` | Узлы сети | id, elementId, name, type, parentId, posX, posY |
| `Connection` | Связи между элементами | sourceId, targetId, cableId, order |
| `Cable` | Кабельные линии | cableId, length, section, material, iDop |
| `Device` | Устройства | deviceId, slotId, deviceType, status |
| `DeviceSlot` | Слоты для устройств | slotId, slotType, elementId, position |

#### Типы устройств (5 таблиц)

| Таблица | Описание | Ключевые поля |
|---------|----------|---------------|
| `Breaker` | Выключатели | ratedCurrent, currentSetting, status, tripCount |
| `Meter` | Счётчики | meterType, serialNumber, accuracy, tariff |
| `MeterReading` | Показания счётчиков | activeEnergy, reactiveEnergy, powerP, powerQ, voltage |
| `Transformer` | Трансформаторы | power, primaryKV, secondaryKV, loadPercent |
| `Load` | Нагрузки | powerP, powerQ, cosPhi, category |

#### Справочники (3 таблицы)

| Таблица | Описание | Поля |
|---------|----------|------|
| `CableReference` | Справочник кабелей (ПУЭ) | mark, section, material, iDop, r0, x0, voltage |
| `BreakerReference` | Справочник выключателей | type, ratedCurrent, breakingCapacity, curve, poles |
| `TransformerReference` | Справочник трансформаторов | type, power, primaryKV, secondaryKV, ukz, pkz |

#### Расчёты и валидация (4 таблицы)

| Таблица | Описание | Поля |
|---------|----------|------|
| `CalculatedParams` | Расчётные параметры | current, voltage, power, voltageDrop, shortCircuitCurrent |
| `ValidationRule` | Правила валидации | name, description, formula, severity, enabled |
| `ValidationResult` | Результаты валидации | ruleId, elementId, status, message, value, limit |
| `Alarm` | Аварийные сигналы | elementId, type, severity, message, acknowledged |

### 5.4 Связи между таблицами

```
Element
├── parent: Element (self-reference, optional)
├── children: Element[] (self-reference)
├── deviceSlots: DeviceSlot[]
├── sourceConnections: Connection[] (как источник)
└── targetConnections: Connection[] (как приёмник)

DeviceSlot
├── element: Element
└── devices: Device[]

Device
├── slot: DeviceSlot
├── breaker: Breaker (optional)
├── load: Load (optional)
├── meter: Meter (optional)
└── transformer: Transformer (optional)

Connection
├── source: Element
├── target: Element
└── cable: Cable (optional)

Cable
├── ref: CableReference (optional)
└── connections: Connection[]
```

---

## 6. API Endpoints

### 6.1 GET /api/network

**Файл:** `app/api/network/route.ts`

**Описание:** Возвращает все элементы и связи сети для визуализации.

**Ответ:**
```json
{
  "elements": [
    {
      "id": "clx...",
      "elementId": "QF1_1SH",
      "name": "Автомат 1",
      "type": "breaker",
      "posX": null,
      "posY": null
    }
  ],
  "connections": [
    {
      "id": "clx...",
      "sourceId": "...",
      "targetId": "...",
      "source": { "elementId": "...", "name": "...", "type": "..." },
      "target": { "elementId": "...", "name": "...", "type": "..." }
    }
  ]
}
```

**Код:**
```typescript
export async function GET() {
  const elements = await prisma.element.findMany({
    select: { id: true, elementId: true, name: true, type: true, posX: true, posY: true }
  });

  const connections = await prisma.connection.findMany({
    select: { id: true, sourceId: true, targetId: true }
  });

  const elementMap = new Map(elements.map(e => [e.id, e]));
  const connectionsWithInfo = connections.map(conn => ({
    id: conn.id,
    sourceId: conn.sourceId,
    targetId: conn.targetId,
    source: elementMap.get(conn.sourceId) ? { ... } : { elementId: '', name: 'Unknown', type: 'unknown' },
    target: elementMap.get(conn.targetId) ? { ... } : { elementId: '', name: 'Unknown', type: 'unknown' },
  }));

  return NextResponse.json({ elements, connections: connectionsWithInfo });
}
```

---

### 6.2 GET /api/stats

**Файл:** `app/api/stats/route.ts`

**Описание:** Возвращает статистику по сети (количество элементов, мощность, связи).

**Ответ:**
```json
{
  "elements": {
    "sources": 2,
    "buses": 5,
    "breakers": 143,
    "meters": 10,
    "loads": 30,
    "junctions": 4,
    "total": 194
  },
  "power": {
    "total": 1260,
    "consumed": 450,
    "free": 810
  },
  "connections": 202
}
```

**Код:**
```typescript
export async function GET() {
  const elements = await prisma.element.findMany();
  
  const stats = {
    sources: elements.filter(e => e.type === 'source').length,
    buses: elements.filter(e => e.type === 'bus').length,
    breakers: elements.filter(e => e.type === 'breaker').length,
    meters: elements.filter(e => e.type === 'meter').length,
    loads: elements.filter(e => e.type === 'load').length,
    junctions: elements.filter(e => e.type === 'junction').length,
    total: elements.length
  };

  const loadDevices = await prisma.load.findMany();
  const totalPower = loadDevices.reduce((sum, l) => sum + l.powerP, 0);
  
  const transformers = await prisma.transformer.findMany();
  const sourcePower = transformers.reduce((sum, t) => sum + t.power, 0);

  const connections = await prisma.connection.count();

  return NextResponse.json({
    elements: stats,
    power: { total: sourcePower, consumed: totalPower, free: sourcePower - totalPower },
    connections
  });
}
```

---

### 6.3 GET /api/validation

**Файл:** `app/api/validation/route.ts`

**Описание:** Возвращает результаты валидации сети по правилам ПУЭ.

**Правила валидации:**
1. **breaker_cable_coordination** — Координация автомат-кабель: Iном.выкл ≤ Iдоп.кабеля
2. **voltage_drop** — Падение напряжения: ΔU ≤ 4%
3. **short_circuit** — Ток КЗ в конце линии: Iкз ≥ 3×Iном
4. **selectivity** — Селективность: Iном.выш. ≥ Iном.нижн.

**Ответ:**
```json
{
  "rules": [
    { "name": "breaker_cable_coordination", "description": "..." }
  ],
  "issues": [
    {
      "rule": "breaker_cable_coordination",
      "elementId": "QF1",
      "elementName": "Автомат 1",
      "status": "error",
      "message": "Iном.авт (100А) > Iдоп.кабеля (80А)",
      "value": 100,
      "limit": 80
    }
  ],
  "stats": {
    "total": 50,
    "errors": 2,
    "warnings": 5,
    "passed": 43
  }
}
```

---

### 6.4 GET/POST /api/references

**Файл:** `app/api/references/route.ts`

**Описание:** Управление справочниками (кабели, выключатели, трансформаторы).

**GET /api/references:**
```json
{
  "cables": [
    { "id": "...", "mark": "ВВГнг-LS 3x16", "section": 16, "material": "copper", "iDop": 85 }
  ],
  "breakers": [
    { "id": "...", "type": "ВА47-29 1P 16A", "ratedCurrent": 16, "breakingCapacity": 4.5 }
  ],
  "transformers": [
    { "id": "...", "type": "ТМ-630/10", "power": 630, "primaryKV": 10, "secondaryKV": 0.4 }
  ]
}
```

**POST /api/references:**
```json
// Request
{ "type": "cable", "data": { "mark": "ВВГ 3x25", "section": 25, ... } }

// Response
{ "id": "...", "mark": "ВВГ 3x25", ... }
```

---

### 6.5 GET/POST /api/import

**Файл:** `app/api/import/route.ts`

**Описание:** Импорт данных из Excel файла.

**POST /api/import:**
- Content-Type: `multipart/form-data`
- Поле файла: `file`

**Ответ при успехе:**
```json
{
  "success": true,
  "message": "Импорт завершён успешно",
  "imported": {
    "elements": 194,
    "devices": 150,
    "connections": 202
  },
  "output": "..."
}
```

**GET /api/import:**
```json
{
  "message": "API импорта данных из Excel",
  "usage": "POST /api/import с файлом в form-data (поле \"file\")",
  "supportedSheets": [
    "Networkall - топология сети",
    "Elements - типы элементов",
    "directory_connection - справочник кабелей"
  ],
  "elementTypes": [
    "SOURCE - источники питания (ТП, трансформаторы)",
    "BREAKER - выключатели (QF, QS)",
    "BUS - шины (с.ш.)",
    "CABINET - шкафы (ЩР, ГРЩ, ВРУ)",
    "JUNCTION - точки распределения",
    "METER - счётчики",
    "LOAD - нагрузки"
  ]
}
```

---

## 7. React компоненты

### 7.1 Главная страница (app/page.tsx)

**Размер:** 459 строк

**Функционал:**
- Загрузка данных сети через API
- Отображение графа через NetworkGraph
- Панель статистики (плавающая)
- Панель валидации (плавающая)
- Информация о выбранном узле
- Легенда типов элементов
- Переключение темы (день/ночь)
- Кнопка обновления данных

**Состояния:**
```typescript
const [networkData, setNetworkData] = useState<NetworkData | null>(null);
const [stats, setStats] = useState<Stats | null>(null);
const [validation, setValidation] = useState<ValidationData | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [selectedNode, setSelectedNode] = useState<string | null>(null);
const [showStats, setShowStats] = useState(false);
const [showValidation, setShowValidation] = useState(false);
const { theme, toggleTheme } = useTheme();
```

**Интерфейсы:**
```typescript
interface NetworkData {
  elements: Array<{ id, elementId, name, type, posX?, posY? }>;
  connections: Array<{ id, sourceId, targetId, source, target }>;
}

interface Stats {
  elements: { sources, buses, breakers, meters, loads, junctions, total };
  power: { total, consumed, free };
  connections: number;
}

interface ValidationResult {
  rule: string;
  elementId: string;
  elementName: string;
  status: 'error' | 'warning' | 'pass';
  message: string;
  value?: number;
  limit?: number;
}
```

---

### 7.2 Граф сети (components/network/NetworkGraph.tsx)

**Размер:** 447 строк

**Технология:** Cytoscape.js

**Алгоритм размещения:** Кастомный BFS-based hierarchical layout

**Этапы алгоритма размещения:**

1. **Создание списка смежности** (adjacency list)
2. **BFS обход от источников** — определение уровней узлов
3. **Группировка по уровням** — узлы одного типа на одном уровне
4. **Вычисление координат** — центрирование по горизонтали

**Уровни узлов:**
```typescript
const NODE_LAYERS: Record<NodeType, number> = {
  source: 0,    // Источники вверху
  bus: 1,       // Шины под источниками
  breaker: 2,   // Автоматы под шинами
  meter: 3,     // Счётчики под автоматами
  junction: 4,  // Точки распределения
  load: 5,      // Нагрузки внизу
};
```

**Цвета узлов:**
```typescript
const NODE_COLORS: Record<NodeType, { border: string; bg: string; text: string }> = {
  source:   { border: '#fbbf24', bg: '#fef3c7', text: '#92400e' },  // Жёлтый
  breaker:  { border: '#1f2937', bg: '#f9fafb', text: '#1f2937' },  // Чёрный/белый
  load:     { border: '#ffffff', bg: '#374151', text: '#f9fafb' },  // Тёмный
  meter:    { border: '#3b82f6', bg: '#dbeafe', text: '#1e40af' },  // Синий
  bus:      { border: '#d97706', bg: '#fef3c7', text: '#92400e' },  // Медный
  junction: { border: '#9ca3af', bg: '#f3f4f6', text: '#374151' },  // Серый
};
```

**Размеры узлов:**
- Обычный узел: 140×50 px
- Шина (bus): 180×35 px (удлинённый)
- Junction: 50×50 px (круг)

**Управление масштабом:**
```typescript
const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() / 1.2);
const handleFit = () => cyRef.current?.fit(undefined, 50);
```

---

### 7.3 ThemeProvider (components/providers/ThemeProvider.tsx)

**Размер:** 41 строка

**Функционал:**
- Хранение темы в localStorage
- Переключение класса `dark` на `<html>`
- Контекст для доступа из любого компонента

**Код:**
```typescript
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
```

---

### 7.4 Root Layout (app/layout.tsx)

**Размер:** 39 строк

**Код:**
```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Цифровой двойник электросети",
  description: "Система моделирования электрической сети",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

## 8. Модуль расчётов

### Файл: lib/calculations/impedance.ts

**Размер:** 364 строки

### 8.1 Константы

```typescript
// Удельное сопротивление материалов (Ом·мм²/м) при 20°C
const RESISTIVITY = {
  Cu: 0.0175,  // Медь
  Al: 0.0294,  // Алюминий
};

// Температурный коэффициент сопротивления (1/°C)
const TEMP_COEFFICIENT = {
  Cu: 0.00393,
  Al: 0.00403,
};

// Реактивное сопротивление по умолчанию (Ом/км)
const DEFAULT_X_OHM_KM = 0.08;
```

### 8.2 Функции расчёта сопротивлений

#### calculateCableImpedanceFromReference

```typescript
/**
 * Расчёт сопротивления кабеля по данным из справочника
 * @param length - длина кабеля (м)
 * @param wireType - марка кабеля (ВВГ, АВВГ и т.д.)
 * @param wireSize - сечение жилы (мм²)
 * @returns { r, x, z } в Омах или null
 */
export function calculateCableImpedanceFromReference(
  length: number,
  wireType: string,
  wireSize: number
): ImpedanceResult | null;
```

#### calculateImpedanceByFormula

```typescript
/**
 * Расчёт сопротивления кабеля по формуле (без справочника)
 * R = ρ * L / S (с учётом температуры)
 * X = x0 * L
 * @param length - длина (м)
 * @param wireSize - сечение (мм²)
 * @param material - 'Cu' или 'Al'
 * @param temperature - температура жилы (°C), по умолчанию 65°C
 */
export function calculateImpedanceByFormula(
  length: number,
  wireSize: number,
  material: MaterialType,
  temperature?: number
): ImpedanceResult;
```

#### calculateBusbarImpedance

```typescript
/**
 * Расчёт сопротивления шинопровода
 * Для шин x0 = 0.05 Ом/км (меньше чем у кабелей)
 */
export function calculateBusbarImpedance(
  length: number,
  crossSection: number,
  material: MaterialType
): ImpedanceResult;
```

### 8.3 Функции падения напряжения

#### calculateVoltageDrop

```typescript
/**
 * Расчёт падения напряжения на кабеле
 * ΔU = I * (R * cosφ + X * sinφ)
 * @param current - ток (А)
 * @param impedance - { r, x, z } в Омах
 * @param cosPhi - коэффициент мощности
 * @returns падение напряжения (В)
 */
export function calculateVoltageDrop(
  current: number,
  impedance: ImpedanceResult,
  cosPhi: number
): number;
```

#### calculateVoltageDropPercent

```typescript
/**
 * Падение напряжения в процентах
 */
export function calculateVoltageDropPercent(
  current: number,
  impedance: ImpedanceResult,
  cosPhi: number,
  nominalVoltage: number
): number;
```

#### isVoltageDropAcceptable

```typescript
/**
 * Проверка: ΔU ≤ 5% (по умолчанию)
 */
export function isVoltageDropAcceptable(
  voltageDropPercent: number,
  allowedPercent?: number
): boolean;
```

#### calculateMaxLength

```typescript
/**
 * Максимальная длина кабеля при заданном падении напряжения
 * L = ΔU / (I * (ρ/S * cosφ + x0 * sinφ))
 */
export function calculateMaxLength(
  current: number,
  wireSize: number,
  material: MaterialType,
  allowedVoltageDropPercent: number,
  nominalVoltage: number,
  cosPhi: number
): number;
```

### 8.4 Функции токов КЗ

#### calculateThreePhaseShortCircuitCurrent

```typescript
/**
 * Ток трёхфазного КЗ
 * Iкз = U / (√3 * Z)
 */
export function calculateThreePhaseShortCircuitCurrent(
  sourceVoltage: number,
  sourceImpedance: ImpedanceResult,
  cableImpedance: ImpedanceResult
): number;
```

#### calculateSinglePhaseShortCircuitCurrent

```typescript
/**
 * Ток однофазного КЗ (для проверки чувствительности защиты)
 * Учитывает сопротивления прямой и нулевой последовательности
 */
export function calculateSinglePhaseShortCircuitCurrent(
  sourceVoltage: number,
  sourceImpedance: ImpedanceResult,
  cableImpedance: ImpedanceResult,
  zeroSequenceImpedance?: ImpedanceResult
): number;
```

### 8.5 Функции потерь

#### calculatePowerLoss

```typescript
/**
 * Потери активной мощности в кабеле
 * ΔP = 3 * I² * R (трёхфазная сеть)
 */
export function calculatePowerLoss(current: number, r: number): number;
```

---

## 9. Сервис импорта данных

### Файл: scripts/import-service.ts

**Размер:** 734 строки

### 9.1 Типы элементов

```typescript
type ElementType = 'SOURCE' | 'BREAKER' | 'BUS' | 'JUNCTION' | 'METER' | 'LOAD' | 'CABINET';
type DeviceType = 'SOURCE' | 'BREAKER' | 'LOAD' | 'METER' | 'TRANSFORMER';
```

### 9.2 Определение типа элемента

```typescript
function detectElementType(name: string, id?: string): ElementType {
  const nameLower = name.toLowerCase();

  // === ИСТОЧНИКИ ===
  if (/^т\d+\s/.test(nameLower)) return 'SOURCE';        // Т1 ТП21
  if (nameLower.startsWith('пц')) return 'SOURCE';        // ПЦ - вводный
  if (nameLower.includes('дгу') && !nameLower.includes('точрасп')) return 'SOURCE';  // ДГУ
  if (nameLower.includes('ибп') && !nameLower.includes('точрасп')) return 'SOURCE';  // ИБП

  // === ВЫКЛЮЧАТЕЛИ ===
  if (/^(\d*)qf[\d.]*/i.test(nameLower)) return 'BREAKER';  // QF1, QF2.1
  if (/^(\d*)qs\d*/i.test(nameLower)) return 'BREAKER';      // QS1
  if (/^км\d*/i.test(nameLower)) return 'BREAKER';           // КМ - контактор
  if (/^(\d*)fu\d*/i.test(nameLower)) return 'BREAKER';      // FU - предохранитель

  // === ШКАФЫ ===
  if (/^щр\d*/i.test(nameLower)) return 'CABINET';    // ЩР3-ПУВ
  if (/^шу\s/i.test(nameLower)) return 'CABINET';     // ШУ
  if (/^вру/i.test(nameLower)) return 'CABINET';      // ВРУ
  if (/^грщ/i.test(nameLower)) return 'CABINET';      // ГРЩ
  if (/^авр\s/i.test(nameLower)) return 'CABINET';    // АВР

  // === УЗЛЫ ===
  if (nameLower.includes('точрасп')) return 'JUNCTION';  // Точрасп

  // === УЧЁТ ===
  if (nameLower.startsWith('узел учета')) return 'METER';
  if (/^узуч/i.test(nameLower)) return 'METER';

  // === ШИНЫ ===
  if (/\d*с\.ш\./.test(nameLower)) return 'BUS';

  // По умолчанию - нагрузка
  return 'LOAD';
}
```

### 9.3 Двухпроходный алгоритм импорта

**Проход 1:** Сбор элементов и определение типов
- Чтение всех строк листа Networkall
- Сбор уникальных имён элементов
- Определение типа каждого элемента
- Построение карты связей

**Проход 2:** Создание иерархии и запись в БД
- Создание CABINET (шкафов)
- Определение parent_id для элементов
- Создание остальных элементов
- Создание устройств (Breaker, Load, Meter, Transformer)
- Создание связей

### 9.4 Иерархия шкафов

```typescript
/**
 * Определение parent_id для элемента
 * CABINET никогда не может быть дочерним элементом другого CABINET
 */
function findParentCabinet(
  elementName: string,
  elementType: ElementType,
  cabinetAliases: Array<{ alias: string; cabinetId: string }>
): string | undefined;

/**
 * Построение карты алиасов шкафов
 * Извлекает имена CABINET из:
 * - Столбца K (Сборка)
 * - Имён элементов типа CABINET
 * - Составных имён (ГРЩ1, ЩР3-ПУВ, ППУ)
 * - Имён шин ("1 с.ш. ГРЩ1" → "ГРЩ1")
 */
function buildCabinetAliasMap(
  rows: ExcelRow[],
  localElementTypeMap: Map<string, ElementType>
): Array<{ alias: string; cabinetName: string; cabinetId: string }>;
```

### 9.5 Импорт справочников

```typescript
// Импорт листа directory_connection (справочник кабелей)
if (workbook.SheetNames.includes('directory_connection')) {
  const sheet = workbook.Sheets['directory_connection'];
  const rows = XLSX.utils.sheet_to_json(sheet);

  for (const row of rows) {
    const mark = String(row['Марка, тип'] || '');
    const section = parseFloat(String(row['сечение'] || '0'));
    const iDop = parseFloat(String(row['ток, А'] || '0'));
    // ...
    await prisma.cableReference.create({ data: { mark, section, iDop, ... } });
  }
}
```

### 9.6 Запуск через CLI

```bash
npx tsx scripts/import-service.ts /path/to/input.xlsx
```

---

## 10. Справочники ПУЭ

### Файл: lib/data/references.ts

**Размер:** 242 строки

### 10.1 Структура данных

```typescript
interface CableReferenceData {
  wireType: string;      // Марка (ВВГ, АВВГ, ВБбШв)
  wireSize: number;      // Сечение (мм²)
  core: number;          // Количество жил
  material: MaterialType; // 'Cu' или 'Al'
  rOhmKm: number;        // Активное сопротивление (Ом/км)
  xOhmKm: number;        // Реактивное сопротивление (Ом/км)
  iAir: number;          // Допустимый ток в воздухе (А)
  iGround: number;       // Допустимый ток в земле (А)
}
```

### 10.2 Кабели с медными жилами (ВВГ)

| Сечение (мм²) | r (Ом/км) | x (Ом/км) | I в воздухе (А) | I в земле (А) |
|---------------|-----------|-----------|-----------------|---------------|
| 1.5 | 12.1 | 0.092 | 17 | 22 |
| 2.5 | 7.41 | 0.087 | 24 | 30 |
| 4 | 4.61 | 0.082 | 32 | 40 |
| 6 | 3.08 | 0.081 | 40 | 50 |
| 10 | 1.83 | 0.078 | 56 | 65 |
| 16 | 1.15 | 0.077 | 75 | 85 |
| 25 | 0.727 | 0.073 | 95 | 110 |
| 35 | 0.524 | 0.070 | 115 | 135 |
| 50 | 0.387 | 0.069 | 145 | 165 |
| 70 | 0.268 | 0.066 | 180 | 200 |
| 95 | 0.193 | 0.064 | 220 | 245 |
| 120 | 0.153 | 0.063 | 260 | 285 |
| 150 | 0.124 | 0.061 | 300 | 325 |
| 185 | 0.099 | 0.060 | 345 | 365 |
| 240 | 0.075 | 0.058 | 410 | 430 |

### 10.3 Кабели с алюминиевыми жилами (АВВГ)

| Сечение (мм²) | r (Ом/км) | x (Ом/км) | I в воздухе (А) | I в земле (А) |
|---------------|-----------|-----------|-----------------|---------------|
| 2.5 | 12.3 | 0.094 | 19 | 24 |
| 4 | 7.74 | 0.088 | 25 | 32 |
| 6 | 5.17 | 0.084 | 32 | 40 |
| 10 | 3.08 | 0.080 | 43 | 52 |
| 16 | 1.94 | 0.078 | 58 | 68 |
| 25 | 1.24 | 0.075 | 75 | 88 |
| 35 | 0.89 | 0.072 | 90 | 105 |
| 50 | 0.65 | 0.070 | 110 | 130 |
| 70 | 0.45 | 0.068 | 140 | 160 |
| 95 | 0.33 | 0.066 | 170 | 195 |
| 120 | 0.26 | 0.065 | 195 | 220 |
| 150 | 0.21 | 0.063 | 225 | 255 |
| 185 | 0.17 | 0.062 | 260 | 290 |
| 240 | 0.13 | 0.060 | 310 | 345 |

### 10.4 Бронированные кабели

Также включены данные для:
- **ВБбШв** — бронированные медные
- **АВБбШв** — бронированные алюминиевые

### 10.5 Функции поиска

```typescript
// Найти по марке и сечению
findCableReference('ВВГ', 16); // → CableReferenceData | null

// Найти по сечению и материалу
findCableBySizeAndMaterial(16, 'Cu'); // → CableReferenceData | null

// Получить допустимый ток
getAllowedCurrent('ВВГ', 16, 'in_ground'); // → 85

// Доступные сечения для марки
getAvailableSections('ВВГ'); // → [1.5, 2.5, 4, 6, ...]

// Подобрать минимальное сечение по току
selectMinSection(50, 'Cu', 'in_air'); // → 10 (мм²)
```

---

## 11. Типы данных TypeScript

### Файл: lib/types/index.ts

**Размер:** 254 строки

### 11.1 Типы элементов

```typescript
/**
 * Типы элементов электрической сети
 */
export type ElementType = 'SOURCE' | 'CABINET' | 'LOAD' | 'BUS' | 'METER' | 'BREAKER' | 'JUNCTION';

/**
 * Типы устройств
 */
export type DeviceType = 'SOURCE' | 'BREAKER' | 'LOAD' | 'METER' | 'ATS' | 'SWITCH' | 'TRANSFORMER';

/**
 * Типы связей
 */
export type ConnectionType = 'CABLE' | 'BUSBAR' | 'JUMPER';

/**
 * Материал проводника
 */
export type MaterialType = 'Cu' | 'Al';

/**
 * Способ прокладки
 */
export type InstallationMethod = 'in_ground' | 'in_air' | 'in_pipe' | 'in_tray';
```

### 11.2 Интерфейсы расчётов

```typescript
export interface ImpedanceResult {
  r: number;  // Активное сопротивление (Ом)
  x: number;  // Реактивное сопротивление (Ом)
  z: number;  // Полное сопротивление (Ом)
}
```

### 11.3 Справочные данные

```typescript
export interface CableReferenceData {
  wireType: string;
  wireSize: number;
  core: number;
  material: MaterialType;
  rOhmKm: number;
  xOhmKm: number;
  iAir: number;
  iGround: number;
}

export interface BreakerReferenceData {
  id: string;
  manufacturer: string;
  model: string;
  type: 'MCB' | 'MCCB' | 'ACB';
  inRatings: number[];
  poles: number;
  voltage: number;
  breakingCapacity: number;
  trippingChars: string[];
}

export interface TransformerReferenceData {
  id: string;
  model: string;
  manufacturer?: string;
  powerKva: number;
  hvKv: number;
  lvKv: number;
  ukPercent: number;
  pkKw?: number;
  p0Kw?: number;
  i0Percent?: number;
  r_ohm?: number;
  x_ohm?: number;
}
```

### 11.4 Сетевые элементы

```typescript
export interface NetworkElement {
  id: string;
  type: ElementType;
  name: string;
  parentId?: string;
  voltageLevel?: number;
  posX?: number;
  posY?: number;
}

export interface NetworkConnection {
  id: string;
  sourceId: string;
  targetId: string;
  connectionType: ConnectionType;
  cableLength?: number;
  cableSection?: number;
}

export interface NetworkData {
  elements: NetworkElement[];
  connections: NetworkConnection[];
}
```

### 11.5 Статусы

```typescript
export type DeviceStatus = 'active' | 'inactive' | 'fault' | 'maintenance';
export type BreakerStatus = 'on' | 'off' | 'tripped';
export type ReliabilityCategory = 1 | 2 | 3;
```

---

## 12. Статус реализации

### ✅ Реализовано

| Компонент | Статус | Описание |
|-----------|--------|----------|
| База данных Prisma + SQLite | ✅ | 19 таблиц, миграции, seed |
| Импорт данных из Excel | ✅ | Двухпроходный алгоритм, иерархия |
| Граф сети (Cytoscape.js) | ✅ | Кастомный BFS layout |
| Цвета узлов по типам | ✅ | 6 типов с уникальными цветами |
| Тёмная/светлая тема | ✅ | Переключение, localStorage |
| API endpoints | ✅ | 5 endpoints (network, stats, validation, references, import) |
| Система валидации | ✅ | 4 правила ПУЭ |
| Расчёты сопротивлений | ✅ | По справочнику и формуле |
| Расчёты токов КЗ | ✅ | 3-фазные и 1-фазные |
| Справочники ПУЭ (кабели) | ✅ | 54 записи (Cu, Al, бронированные) |
| Справочники выключателей | ✅ | 22 записи (ВА47-29, ВА55-41/43) |
| Справочники трансформаторов | ✅ | 14 записей (ТМ, ТМГ) |

### 🚧 В разработке

| Компонент | Приоритет | Описание |
|-----------|-----------|----------|
| Добавление потребителей через UI | Высокий | Форма создания нагрузки |
| Редактирование параметров устройств | Высокий | Форма редактирования |
| Детальная панель свойств узла | Высокий | Показ всех параметров |
| Полноценный расчёт токов КЗ | Средний | По всей сети |
| Профили нагрузки P(t) | Средний | Графики во времени |
| АВР автоматика | Средний | Моделирование переключений |
| Экспорт отчётов | Низкий | PDF/Excel |
| Тепловая карта нагрузки | Низкий | Визуализация на графе |

---

## Запуск проекта

### Development режим

```bash
cd /home/z/my-project/network-digital-twin
npm run dev
```

Сервер: http://localhost:3000

### Production сборка

```bash
npm run build
npm start
```

### Импорт данных

```bash
npx tsx scripts/import-service.ts /path/to/input.xlsx
```

### Seed справочников

```bash
npx tsx prisma/seed.ts
```

---

## Примечания

1. **Webpack**: Проект использует webpack (флаг `--webpack`), не turbopack
2. **БД**: SQLite через LibSQL адаптер (файл внутри проекта)
3. **Типы**: Строгая типизация TypeScript (strict: true)
4. **Стили**: Tailwind CSS v4 с поддержкой тёмной темы
5. **Граф**: Cytoscape.js для визуализации топологии сети
6. **React**: Версия 19.2.4 (последняя стабильная)
7. **Next.js**: Версия 16.2.1 (App Router)

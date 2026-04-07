# Техническая спецификация проекта
## Network Digital Twin — Цифровой двойник электросети

---

## 1. Технические и архитектурные параметры

### 1.1 Стек технологий

| Категория | Технология | Версия | Назначение |
|-----------|------------|--------|------------|
| **Framework** | Next.js | 16.2.1 | Full-stack React фреймворк |
| **UI Library** | React | 19.2.4 | Библиотека компонентов |
| **Language** | TypeScript | 5.x | Статическая типизация |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS |
| **Database** | SQLite (LibSQL) | - | Встраиваемая БД |
| **ORM** | Prisma | 7.6.0 | Database toolkit |
| **Graph Visualization** | Cytoscape.js | 3.33.2 | Визуализация графов |
| **Excel Parser** | SheetJS (xlsx) | 0.18.5 | Импорт данных из Excel |

### 1.2 Архитектурная модель

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  page.tsx   │  │ ThemeProvider│  │   NetworkGraph.tsx     │  │
│  │  (Dashboard)│  │  (Dark Mode) │  │   (Cytoscape Canvas)   │  │
│  └──────┬──────┘  └─────────────┘  └─────────────────────────┘  │
└─────────┼───────────────────────────────────────────────────────┘
          │ HTTP/API
┌─────────▼───────────────────────────────────────────────────────┐
│                        API LAYER                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ /api/network│  │ /api/stats  │  │/api/validation│             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │ /api/import │  │/api/references│                              │
│  └──────┬──────┘  └──────┬──────┘                               │
└─────────┼────────────────┼───────────────────────────────────────┘
          │                │
┌─────────▼────────────────▼───────────────────────────────────────┐
│                      DATA LAYER                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    Prisma ORM                             │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │    │
│  │  │  Element   │  │ Connection │  │ Cable/Breaker/...  │  │    │
│  │  └────────────┘  └────────────┘  └────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐   │
│  │              SQLite (LibSQL Adapter)                       │   │
│  │                   file:./prisma/data/custom.db             │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 1.3 Конфигурация сборки

```typescript
// TypeScript (tsconfig.json)
{
  "target": "ES2017",
  "module": "esnext",
  "moduleResolution": "bundler",
  "strict": true,
  "jsx": "react-jsx",
  "paths": { "@/*": ["./*"] }  // Алиас для импортов
}

// Next.js (next.config.ts)
{
  "outputFileTracingRoot": path.join(__dirname),
  "allowedDevOrigins": [".space.z.ai"]  // Для preview
}

// Tailwind CSS (tailwind.config.ts)
{
  "darkMode": "class",  // Переключение темы через класс
  "content": ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"]
}
```

### 1.4 Системные требования

| Параметр | Значение |
|----------|----------|
| Node.js | >= 18.x |
| Память | ~100-200 MB (зависит от размера сети) |
| Диск | ~50 MB (без данных) |
| Браузер | Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |

---

## 2. Древо файлов и их назначение

```
network-digital-twin/
│
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Корневой layout (тема, метаданные)
│   ├── page.tsx                      # Главная страница (Dashboard)
│   │                                 # - Загрузка данных из API
│   │                                 # - Отображение мнемосхемы
│   │                                 # - Панели статистики и валидации
│   │
│   └── api/                          # API Routes (Backend)
│       ├── network/route.ts          # GET /api/network
│       │                             # - Возвращает элементы и связи для графа
│       │
│       ├── stats/route.ts            # GET /api/stats
│       │                             # - Статистика по типам элементов
│       │                             # - Мощность, количество связей
│       │
│       ├── validation/route.ts       # GET /api/validation
│       │                             # - Проверка правил сети
│       │                             # - Расчёт падения напряжения
│       │                             # - Проверка токов КЗ
│       │
│       ├── import/route.ts           # POST /api/import
│       │                             # - Импорт из Excel файла
│       │                             # - Определение типов элементов
│       │
│       └── references/route.ts       # GET /api/references
│                                   # - Справочники кабелей, автоматов
│
├── components/
│   ├── network/
│   │   └── NetworkGraph.tsx          # Компонент визуализации графа
│   │                                 # - Инициализация Cytoscape
│   │                                 # - Layout по уровням (BFS)
│   │                                 # - Стили узлов по типам
│   │                                 # - Обработка кликов
│   │                                 # - Масштабирование
│   │
│   └── providers/
│       └── ThemeProvider.tsx         # Провайдер тёмной/светлой темы
│                                     # - Сохранение в localStorage
│                                     # - Переключение класса на <html>
│
├── lib/
│   └── prisma.ts                     # Prisma Client singleton
│                                     # - LibSQL adapter для SQLite
│                                     # - Глобальный кэш в development
│
├── prisma/
│   ├── schema.prisma                 # Схема базы данных
│   │                                 # - 15 моделей данных
│   │                                 # - Relations между таблицами
│   │
│   ├── seed.ts                       # Начальное заполнение БД
│   │
│   └── data/                         # Директория с файлом БД
│       └── custom.db                 # SQLite файл (создаётся автоматически)
│
├── scripts/                          # Скрипты импорта данных
│   ├── import-echo-data.ts           # Основной импорт из ЭХОмини.v1.xlsx
│   │                                 # - Парсинг листа Networkall
│   │                                 # - Определение типов элементов
│   │                                 # - Создание связей и кабелей
│   │
│   ├── import-data.ts                # Альтернативный импорт из input.xlsx
│   │
│   └── check-excel.ts                # Утилита проверки Excel файла
│
├── docs/                             # Документация
│   └── TECHNICAL_SPECIFICATION.md    # Этот документ
│
├── public/                           # Статические файлы
│   └── favicon.ico                   # Иконка сайта
│
├── .env                              # Переменные окружения (если есть)
├── package.json                      # Зависимости и скрипты
├── tsconfig.json                     # Конфигурация TypeScript
├── tailwind.config.ts                # Конфигурация Tailwind CSS
├── next.config.ts                    # Конфигурация Next.js
└── prisma.config.ts                  # Конфигурация Prisma (путь к БД)
```

### 2.1 Назначение ключевых файлов

| Файл | Назначение |
|------|------------|
| `app/page.tsx` | Главная страница с мнемосхемой, статистикой и валидацией |
| `app/layout.tsx` | Корневой layout с ThemeProvider и метаданными |
| `components/network/NetworkGraph.tsx` | Визуализация графа сети на Cytoscape.js |
| `lib/prisma.ts` | Singleton Prisma клиента с LibSQL адаптером |
| `prisma/schema.prisma` | Определение моделей данных и связей |
| `scripts/import-echo-data.ts` | Парсер импорта данных из Excel |
| `app/api/network/route.ts` | API для получения элементов и связей |
| `app/api/stats/route.ts` | API статистики сети |
| `app/api/validation/route.ts` | API валидации и расчётов |

---

## 3. Сторонние приложения и библиотеки

### 3.1 Основные зависимости (Dependencies)

| Пакет | Версия | Назначение |
|-------|--------|------------|
| **next** | 16.2.1 | React фреймворк с SSR, API routes, Turbopack |
| **react** | 19.2.4 | UI библиотека |
| **react-dom** | 19.2.4 | React рендеринг в DOM |
| **prisma** | 7.6.0 | ORM для работы с БД |
| **@prisma/client** | 7.6.0 | Сгенерированный Prisma клиент |
| **@prisma/adapter-libsql** | 7.6.0 | Адаптер для LibSQL/SQLite |
| **@libsql/client** | 0.17.2 | Клиент LibSQL (Turso) |
| **cytoscape** | 3.33.2 | Визуализация графов |
| **@types/cytoscape** | 3.21.9 | TypeScript типы для Cytoscape |
| **xlsx** | 0.18.5 | Парсер Excel файлов (SheetJS) |

### 3.2 Dev-зависимости

| Пакет | Версия | Назначение |
|-------|--------|------------|
| **typescript** | 5.x | Компилятор TypeScript |
| **@types/node** | 20.x | Типы Node.js |
| **@types/react** | 19.x | Типы React |
| **tailwindcss** | 4.x | CSS фреймворк |
| **@tailwindcss/postcss** | 4.x | PostCSS плагин Tailwind |
| **eslint** | 9.x | Линтер |
| **eslint-config-next** | 16.2.1 | ESLint конфиг для Next.js |
| **dotenv** | 17.3.1 | Загрузка .env файлов |

### 3.3 Описание ключевых библиотек

#### Next.js 16.2.1
- **App Router** — файловая маршрутизация
- **Server Components** — рендеринг на сервере
- **API Routes** — backend в том же проекте
- **Turbopack** — быстрый bundler для dev режима

#### Prisma 7.6.0
- **Schema-first** — схема как источник истины
- **Type-safe** — автогенерация TypeScript типов
- **Migrations** — управление версиями БД
- **LibSQL Adapter** — поддержка SQLite через Turso протокол

#### Cytoscape.js 3.33.2
- **Graph theory** — алгоритмы для графов
- **Layouts** — автоматическое размещение узлов
- **Styling** — CSS-подобные стили для элементов
- **Events** — интерактивность (клики, выделение)
- **Performance** — рендеринг до 10,000+ узлов

#### SheetJS (xlsx) 0.18.5
- **Excel parsing** — чтение .xlsx, .xls файлов
- **Multiple sheets** — поддержка нескольких листов
- **JSON export** — преобразование в JS объекты
- **Streaming** — обработка больших файлов

#### Tailwind CSS 4.x
- **Utility-first** — атомарные CSS классы
- **Dark mode** — встроенная поддержка тёмной темы
- **JIT** — компиляция только используемых классов
- **Customization** — расширение темы проекта

---

## 4. Модели данных (Prisma Schema)

### 4.1 Основные сущности

```
┌─────────────────────────────────────────────────────────────────┐
│                     ER-Diagram (упрощённый)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐     sourceConnections    ┌──────────┐             │
│  │ Element  │◄─────────────────────────│Connection│             │
│  │──────────│     targetConnections    │──────────│             │
│  │ elementId│─────────────────────────►│ sourceId │             │
│  │ name     │                          │ targetId │             │
│  │ type     │                          │ cableId  │───┐        │
│  │ posX/Y   │                          └──────────┘   │        │
│  └────┬─────┘                                         │        │
│       │ has many                                      │        │
│       ▼                                               ▼        │
│  ┌──────────┐                                   ┌──────────┐   │
│  │DeviceSlot│                                   │  Cable   │   │
│  │──────────│                                   │──────────│   │
│  │ slotType │                                   │ length   │   │
│  └────┬─────┘                                   │ section  │   │
│       │ has many                                 │ material │   │
│       ▼                                          └──────────┘   │
│  ┌──────────┐                                                   │
│  │  Device  │───┬───┬───┬───┐                                  │
│  │──────────│   │   │   │   │                                  │
│  │deviceType│   │   │   │   │                                  │
│  └──────────┘   │   │   │   │                                  │
│       │         │   │   │   │                                  │
│       │  ┌──────┘   │   └──────┐                               │
│       ▼  ▼          ▼          ▼                               │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────────┐                   │
│  │Breaker│ │ Meter │ │ Load  │ │Transformer│                   │
│  │───────│ │───────│ │───────│ │───────────│                   │
│  │ratedCt│ │serialN│ │powerP │ │ power     │                   │
│  │status │ │tariff │ │cosPhi │ │ primaryKV │                   │
│  └───────┘ └───────┘ └───────┘ └───────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Типы элементов (Element.type)

| Тип | Описание | Цвет в UI |
|-----|----------|-----------|
| `source` | Источник питания (ТП, генератор) | Жёлтый |
| `bus` | Шина, шинопровод | Янтарный |
| `breaker` | Автомат, выключатель | Чёрный |
| `cabinet` | Шкаф, ВРУ, щит | Фиолетовый |
| `meter` | Счётчик | Синий |
| `junction` | Точка распределения | Серый |
| `load` | Нагрузка | Тёмно-серый |

### 4.3 Количество моделей

| Категория | Модели |
|-----------|--------|
| Основные | Element, Connection, Device, DeviceSlot |
| Оборудование | Breaker, Meter, Load, Transformer, Cable |
| Справочники | CableReference, BreakerReference, TransformerReference |
| Валидация | ValidationRule, ValidationResult |
| Расчёты | CalculatedParams |
| Аварии | Alarm |
| Телеметрия | MeterReading |
| **Всего** | **15 моделей** |

---

## 5. API Endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/network` | Элементы и связи для графа |
| GET | `/api/stats` | Статистика сети |
| GET | `/api/validation` | Результаты валидации |
| GET | `/api/references` | Справочники оборудования |
| POST | `/api/import` | Импорт из Excel файла |

### 5.1 Формат ответа `/api/network`

```json
{
  "elements": [
    {
      "id": "cuid123",
      "elementId": "тп-1",
      "name": "ТП-1 Трансформатор",
      "type": "source",
      "posX": null,
      "posY": null
    }
  ],
  "connections": [
    {
      "id": "cuid456",
      "sourceId": "cuid123",
      "targetId": "cuid789",
      "source": { "elementId": "тп-1", "name": "ТП-1", "type": "source" },
      "target": { "elementId": "шина-1", "name": "Шина 1", "type": "bus" }
    }
  ]
}
```

### 5.2 Формат ответа `/api/stats`

```json
{
  "elements": {
    "sources": 8,
    "buses": 5,
    "breakers": 106,
    "meters": 6,
    "loads": 0,
    "junctions": 24,
    "cabinets": 43,
    "total": 192
  },
  "power": {
    "total": 3150,
    "consumed": 0,
    "free": 3150
  },
  "connections": 203
}
```

---

## 6. Скрипты npm

| Скрипт | Команда | Описание |
|--------|---------|----------|
| `dev` | `next dev --webpack` | Разработка с hot reload |
| `build` | `next build` | Production сборка |
| `start` | `next start` | Production сервер |
| `lint` | `eslint` | Проверка кода |

### Prisma команды

```bash
npx prisma generate    # Генерация клиента
npx prisma db push     # Применение схемы к БД
npx prisma studio      # GUI для БД
```

### Импорт данных

```bash
npx tsx scripts/import-echo-data.ts   # Импорт из ЭХОмини.v1.xlsx
npx tsx scripts/import-data.ts        # Импорт из input.xlsx
```

---

## 7. Особенности реализации

### 7.1 Визуализация графа (NetworkGraph)

- **Layout**: Preset (координаты вычисляются при импорте)
- **Алгоритм**: BFS от источников, уровни по типам
- **Стилизация**: CSS-селекторы Cytoscape по `node[type="..."]`
- **Оптимизация**: useRef для callback, предотвращение пересоздания

### 7.2 Импорт данных

- **Типы**: Автоопределение по ключевым словам в названии
- **Нормализация**: Все ID приводятся к lowercase
- **Дедупликация**: Map для уникальных элементов

### 7.3 Тёмная тема

- **Реализация**: Класс `dark` на `<html>`
- **Переключение**: ThemeProvider + localStorage
- **CSS**: Tailwind `dark:` префиксы

---

## 8. Безопасность

| Аспект | Реализация |
|--------|------------|
| SQL Injection | Prisma parameterized queries |
| XSS | React auto-escaping |
| CSRF | Next.js built-in protection |
| File Upload | Валидация формата Excel |
| Environment | Переменные в .env |

---

*Документ обновлён: 2024-04-07*

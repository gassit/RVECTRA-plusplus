# Цифровой двойник электрической сети
## Архитектура приложения v1.0

---

## 1. ОБЗОР СИСТЕМЫ

### 1.1 Цель системы
Создание цифрового двойника электрической сети промышленного уровня для:
- Моделирования топологии сети
- Управления устройствами (ON/OFF, АВР)
- Расчёта потокораспределения и токов КЗ
- Мониторинга в реальном времени
- Формирования отчётов

### 1.2 Пользователи
| Роль | Права |
|------|-------|
| Оператор | Просмотр, управление устройствами |
| Инженер | Расчёты, конфигурация, отчёты |
| Администратор | Полный доступ, пользователи |

### 1.3 Технологический стек
```
Frontend:     Next.js 16 + React + TypeScript + Tailwind CSS + shadcn/ui
Backend:      Next.js API Routes + Prisma ORM
Database:     PostgreSQL (основная) + TimescaleDB (временные ряды)
Real-time:    WebSocket для телеметрии
Расчёты:      Python (NumPy, SciPy, Pandas) или Node.js
Визуализация: Cytoscape.js / React Flow (графы), D3.js (графики)
```

---

## 2. АРХИТЕКТУРА СИСТЕМЫ

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ПОЛЬЗОВАТЕЛЬСКИЙ ИНТЕРФЕЙС                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  Схема сети │ │  Управление │ │  Мониторинг │ │   Отчёты    │           │
│  │  (граф)     │ │  (команды)  │ │  (телеметрия)│ │  (Excel/PDF)│           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER (Next.js)                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  /api/v1/   │ │  /api/v1/   │ │  /api/v1/   │ │  /api/v1/   │           │
│  │  network    │ │  devices    │ │  calculate  │ │  reports    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
┌───────────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│   БИЗНЕС-ЛОГИКА       │ │   РАСЧЁТНЫЙ ЯДРО  │ │   СЛУЖБА ВРЕМЕНИ  │
│  ┌─────────────────┐  │ │  ┌─────────────┐  │ │  ┌─────────────┐  │
│  │ NetworkService  │  │ │  │ PowerFlow   │  │ │  │ Scheduler   │  │
│  │ DeviceService   │  │ │  │ ShortCircuit│  │ │  │ ATS Logic   │  │
│  │ ATSService      │  │ │  │ LoadBalance │  │ │  │ Alarms      │  │
│  │ ScenarioService │  │ │  └─────────────┘  │ │  └─────────────┘  │
│  └─────────────────┘  │ └───────────────────┘ └───────────────────┘
└───────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                      │
│  ┌───────────────────────┐  ┌───────────────────────┐                      │
│  │   PostgreSQL          │  │   TimescaleDB          │                      │
│  │   (основные данные)   │  │   (временные ряды)     │                      │
│  │   Elements, Devices   │  │   Measurements,        │                      │
│  │   Network, ATS...     │  │   EventLog, Alarms     │                      │
│  └───────────────────────┘  └───────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. ПОТОК ДАННЫХ

### 3.1 Ввод данных

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ИСТОЧНИКИ ДАННЫХ                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. РУЧНОЙ ВВОД (Excel)          2. SCADA / PLC               3. API       │
│  ┌──────────────────┐            ┌──────────────────┐        ┌──────────┐  │
│  │ input.xlsx       │            │ Modbus TCP       │        │ REST API │  │
│  │ - Networkall     │            │ IEC 61850        │        │ GraphQL  │  │
│  │ - справочники    │            │ OPC UA           │        │          │  │
│  └────────┬─────────┘            └────────┬─────────┘        └────┬─────┘  │
│           │                               │                       │        │
│           ▼                               ▼                       ▼        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    INGESTION LAYER                                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │  │
│  │  │ ExcelParser │  │ ModbusClient│  │ APIConnector│                  │  │
│  │  │ (Python)    │  │ (Node.js)   │  │ (Node.js)   │                  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                     │
│                                      ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    VALIDATION & TRANSFORMATION                       │  │
│  │  - Проверка целостности графа                                        │  │
│  │  - Валидация ID                                                      │  │
│  │  - Нормализация данных                                               │  │
│  │  - Расчёт производных параметров (R, X)                              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                     │
│                                      ▼                                     │
│                           База данных                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Использование данных

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ОПЕРАЦИОННЫЕ РЕЖИМЫ                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. ПРОСМОТР СЕТИ                2. УПРАВЛЕНИЕ               3. РАСЧЁТЫ    │
│  ┌──────────────────┐            ┌──────────────────┐        ┌──────────┐  │
│  │ - Граф сети      │            │ - Команды ON/OFF │        │ PowerFlow│  │
│  │ - Фильтры        │            │ - Блокировки     │        │ КЗ       │  │
│  │ - Поиск          │            │ - Сценарии       │        │ Потери   │  │
│  │ - Детали узла    │            │ - АВР            │        │ Баланс   │  │
│  └────────┬─────────┘            └────────┬─────────┘        └────┬─────┘  │
│           │                               │                       │        │
│           └───────────────────────────────┼───────────────────────┘        │
│                                           │                                │
│                                           ▼                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         REAL-TIME MONITORING                          │  │
│  │  - WebSocket подключение                                              │  │
│  │  - Телеметрия (U, I, P, Q, f)                                         │  │
│  │  - Аварийные сигналы                                                  │  │
│  │  - Журнал событий                                                     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Выходные данные (Отчёты)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ОТЧЁТЫ И ЭКСПОРТ                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. ОПЕРАТИВНЫЕ ОТЧЁТЫ          2. ТЕХНИЧЕСКИЕ ОТЧЁТЫ       3. АНАЛИТИКА   │
│  ┌──────────────────┐            ┌──────────────────┐        ┌──────────┐  │
│  │ - Текущее сост.  │            │ - Однолинейная   │        │ Потребл. │  │
│  │ - Аварии за день │            │ - Параметры каб. │        │ Тренды   │  │
│  │ - Переключения   │            │ - Уставки защит  │        │ Прогноз  │  │
│  └────────┬─────────┘            └────────┬─────────┘        └────┬─────┘  │
│           │                               │                       │        │
│           └───────────────────────────────┼───────────────────────┘        │
│                                           │                                │
│                                           ▼                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         EXPORT FORMATS                                │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │  │
│  │  │ Excel   │  │ PDF     │  │ CSV     │  │ JSON    │  │ SVG/PNG │    │  │
│  │  │ (.xlsx) │  │ (.pdf)  │  │ (.csv)  │  │ (.json) │  │ (схема) │    │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. СТРУКТУРА ФАЙЛОВ

```
powergrid-digital-twin/
│
├── 📁 app/                              # Next.js App Router
│   ├── 📁 (auth)/                       # Авторизация
│   │   ├── 📁 login/page.tsx
│   │   └── 📁 layout.tsx
│   │
│   ├── 📁 (dashboard)/                  # Основной интерфейс
│   │   ├── 📁 layout.tsx                # Layout с сайдбаром
│   │   ├── 📁 page.tsx                  # Главная (обзор)
│   │   │
│   │   ├── 📁 network/                  # Сеть
│   │   │   ├── page.tsx                 # Граф сети
│   │   │   ├── 📁 [id]/page.tsx         # Детали узла
│   │   │   └── 📁 topology/page.tsx     # Редактор топологии
│   │   │
│   │   ├── 📁 devices/                  # Устройства
│   │   │   ├── page.tsx                 # Список устройств
│   │   │   ├── 📁 [id]/page.tsx         # Карточка устройства
│   │   │   └── 📁 control/page.tsx      # Панель управления
│   │   │
│   │   ├── 📁 monitoring/               # Мониторинг
│   │   │   ├── page.tsx                 # Общий мониторинг
│   │   │   ├── 📁 telemetry/page.tsx    # Телеметрия
│   │   │   ├── 📁 alarms/page.tsx       # Аварии
│   │   │   └── 📁 events/page.tsx       # Журнал событий
│   │   │
│   │   ├── 📁 calculations/             # Расчёты
│   │   │   ├── page.tsx                 # Меню расчётов
│   │   │   ├── 📁 power-flow/page.tsx   # Потокораспределение
│   │   │   ├── 📁 short-circuit/page.tsx # Токи КЗ
│   │   │   └── 📁 losses/page.tsx       # Потери
│   │   │
│   │   ├── 📁 scenarios/                # Сценарии
│   │   │   ├── page.tsx                 # Список сценариев
│   │   │   └── 📁 [id]/page.tsx         # Редактор сценария
│   │   │
│   │   ├── 📁 reports/                  # Отчёты
│   │   │   ├── page.tsx                 # Шаблоны отчётов
│   │   │   └── 📁 [type]/page.tsx       # Генерация отчёта
│   │   │
│   │   └── 📁 admin/                    # Администрирование
│   │       ├── page.tsx                 # Настройки системы
│   │       ├── 📁 users/page.tsx        # Пользователи
│   │       └── 📁 import/page.tsx       # Импорт данных
│   │
│   ├── 📁 api/                          # API Routes
│   │   ├── 📁 v1/
│   │   │   ├── 📁 network/
│   │   │   │   ├── route.ts             # GET/POST /api/v1/network
│   │   │   │   ├── 📁 [id]/route.ts     # GET/PUT/DELETE узла
│   │   │   │   ├── 📁 graph/route.ts    # Граф для визуализации
│   │   │   │   └── 📁 validate/route.ts # Валидация сети
│   │   │   │
│   │   │   ├── 📁 devices/
│   │   │   │   ├── route.ts
│   │   │   │   ├── 📁 [id]/route.ts
│   │   │   │   ├── 📁 control/route.ts  # Команды управления
│   │   │   │   └── 📁 states/route.ts   # Состояния
│   │   │   │
│   │   │   ├── 📁 connections/
│   │   │   │   ├── route.ts
│   │   │   │   └── 📁 [id]/route.ts
│   │   │   │
│   │   │   ├── 📁 ats/
│   │   │   │   ├── route.ts
│   │   │   │   ├── 📁 logic/route.ts
│   │   │   │   └── 📁 simulate/route.ts
│   │   │   │
│   │   │   ├── 📁 scenarios/
│   │   │   │   ├── route.ts
│   │   │   │   ├── 📁 [id]/route.ts
│   │   │   │   └── 📁 apply/route.ts
│   │   │   │
│   │   │   ├── 📁 protection/
│   │   │   │   ├── route.ts
│   │   │   │   └── 📁 [id]/route.ts
│   │   │   │
│   │   │   ├── 📁 calculations/
│   │   │   │   ├── 📁 power-flow/route.ts
│   │   │   │   ├── 📁 short-circuit/route.ts
│   │   │   │   ├── 📁 losses/route.ts
│   │   │   │   └── 📁 balance/route.ts
│   │   │   │
│   │   │   ├── 📁 measurements/
│   │   │   │   ├── route.ts
│   │   │   │   ├── 📁 history/route.ts
│   │   │   │   └── 📁 realtime/route.ts
│   │   │   │
│   │   │   ├── 📁 alarms/
│   │   │   │   ├── route.ts
│   │   │   │   ├── 📁 acknowledge/route.ts
│   │   │   │   └── 📁 history/route.ts
│   │   │   │
│   │   │   ├── 📁 events/
│   │   │   │   ├── route.ts
│   │   │   │   └── 📁 export/route.ts
│   │   │   │
│   │   │   ├── 📁 reports/
│   │   │   │   ├── route.ts
│   │   │   │   ├── 📁 generate/route.ts
│   │   │   │   └── 📁 templates/route.ts
│   │   │   │
│   │   │   ├── 📁 tariffs/
│   │   │   │   └── route.ts
│   │   │   │
│   │   │   ├── 📁 maintenance/
│   │   │   │   ├── route.ts
│   │   │   │   └── 📁 schedule/route.ts
│   │   │   │
│   │   │   └── 📁 import/
│   │   │       ├── route.ts             # Импорт Excel
│   │   │       └── 📁 validate/route.ts
│   │   │
│   │   └── 📁 websocket/route.ts        # WebSocket для real-time
│   │
│   └── 📁 layout.tsx                    # Root layout
│
├── 📁 components/                       # React компоненты
│   ├── 📁 ui/                           # shadcn/ui компоненты
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── table.tsx
│   │   └── ...
│   │
│   ├── 📁 network/                      # Компоненты сети
│   │   ├── NetworkGraph.tsx             # Граф сети (Cytoscape)
│   │   ├── NodeDetails.tsx              # Детали узла
│   │   ├── EdgeDetails.tsx              # Детали связи
│   │   ├── NetworkFilters.tsx           # Фильтры
│   │   ├── NetworkLegend.tsx            # Легенда
│   │   └── TopologyEditor.tsx           # Редактор топологии
│   │
│   ├── 📁 devices/                      # Компоненты устройств
│   │   ├── DeviceCard.tsx               # Карточка устройства
│   │   ├── DeviceList.tsx               # Список устройств
│   │   ├── DeviceControl.tsx            # Панель управления
│   │   ├── StateIndicator.tsx           # Индикатор состояния
│   │   └── DeviceForm.tsx               # Форма редактирования
│   │
│   ├── 📁 monitoring/                   # Компоненты мониторинга
│   │   ├── TelemetryPanel.tsx           # Панель телеметрии
│   │   ├── MeasurementChart.tsx         # Графики измерений
│   │   ├── AlarmsList.tsx               # Список аварий
│   │   ├── AlarmCard.tsx                # Карточка аварии
│   │   ├── EventsLog.tsx                # Журнал событий
│   │   └── RealtimeIndicator.tsx        # Индикатор real-time
│   │
│   ├── 📁 calculations/                 # Компоненты расчётов
│   │   ├── PowerFlowResults.tsx         # Результаты PowerFlow
│   │   ├── ShortCircuitResults.tsx      # Результаты КЗ
│   │   ├── LossesChart.tsx              # График потерь
│   │   └── CalculationStatus.tsx        # Статус расчёта
│   │
│   ├── 📁 scenarios/                    # Компоненты сценариев
│   │   ├── ScenarioCard.tsx
│   │   ├── ScenarioEditor.tsx
│   │   └── ScenarioSimulator.tsx
│   │
│   ├── 📁 reports/                      # Компоненты отчётов
│   │   ├── ReportTemplate.tsx
│   │   ├── ReportPreview.tsx
│   │   └── ExportButton.tsx
│   │
│   └── 📁 layout/                       # Layout компоненты
│       ├── Sidebar.tsx
│       ├── Header.tsx
│       ├── Breadcrumb.tsx
│       └── ThemeToggle.tsx
│
├── 📁 lib/                              # Библиотеки
│   ├── 📁 db/
│   │   ├── index.ts                     # Prisma client
│   │   ├── migrations/                  # Миграции БД
│   │   └── seed.ts                      # Начальные данные
│   │
│   ├── 📁 services/                     # Бизнес-логика
│   │   ├── network.service.ts           # Работа с сетью
│   │   ├── device.service.ts            # Работа с устройствами
│   │   ├── ats.service.ts               # Логика АВР
│   │   ├── scenario.service.ts          # Сценарии
│   │   ├── measurement.service.ts       # Измерения
│   │   ├── alarm.service.ts             # Аварии
│   │   ├── event.service.ts             # События
│   │   └── report.service.ts            # Отчёты
│   │
│   ├── 📁 calculations/                 # Расчётные модули
│   │   ├── power-flow.ts                # Power Flow
│   │   ├── short-circuit.ts             # Short Circuit
│   │   ├── losses.ts                    # Потери
│   │   └── impedance.ts                 # Расчёт сопротивлений
│   │
│   ├── 📁 ingestion/                    # Импорт данных
│   │   ├── excel-parser.ts              # Парсер Excel
│   │   ├── validator.ts                 # Валидация данных
│   │   └── transformer.ts               # Трансформация
│   │
│   ├── 📁 websocket/
│   │   ├── server.ts                    # WebSocket сервер
│   │   └── client.ts                    # WebSocket клиент
│   │
│   ├── 📁 auth/
│   │   ├── config.ts                    # Конфигурация auth
│   │   └── permissions.ts               # Права доступа
│   │
│   └── 📁 utils/
│       ├── format.ts                    # Форматирование
│       ├── export.ts                    # Экспорт в Excel/PDF
│       └── constants.ts                 # Константы
│
├── 📁 types/                            # TypeScript типы
│   ├── index.ts                         # Экспорт всех типов
│   ├── network.ts                       # Типы сети
│   ├── device.ts                        # Типы устройств
│   ├── measurement.ts                   # Типы измерений
│   ├── alarm.ts                         # Типы аварий
│   ├── calculation.ts                   # Типы расчётов
│   └── api.ts                           # Типы API
│
├── 📁 prisma/                           # Prisma ORM
│   ├── schema.prisma                    # Схема БД
│   ├── 📁 migrations/
│   └── seed.ts
│
├── 📁 public/
│   ├── 📁 icons/                        # Иконки устройств
│   └── 📁 images/
│
├── 📁 scripts/                          # Скрипты
│   ├── import-excel.ts                  # Импорт из Excel
│   ├── calculate-all.ts                 # Запуск всех расчётов
│   └── generate-reports.ts              # Генерация отчётов
│
├── 📁 tests/                            # Тесты
│   ├── 📁 unit/
│   ├── 📁 integration/
│   └── 📁 e2e/
│
├── .env.local                           # Переменные окружения
├── .env.example                         # Пример env
├── next.config.js                       # Next.js конфиг
├── tailwind.config.ts                   # Tailwind конфиг
├── tsconfig.json                        # TypeScript конфиг
├── package.json
└── README.md
```

---

## 5. СТРУКТУРА БАЗЫ ДАННЫХ

### 5.1 ER-диаграмма

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              СЛОЙ 1: ТОПОЛОГИЯ                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐         ┌──────────────────┐                         │
│  │    elements      │────────<│    network       │                         │
│  ├──────────────────┤         ├──────────────────┤                         │
│  │ id (PK)          │         │ id (PK)          │                         │
│  │ type             │         │ from_id (FK)     │────────┐                │
│  │ name             │         │ to_id (FK)       │────────┼───┐            │
│  │ parent_id (FK)   │───┐     │ connection_id(FK)│        │   │            │
│  │ device_id (FK)   │───┼───  │ scenario_id (FK) │        │   │            │
│  │ location         │   │     └──────────────────┘        │   │            │
│  │ voltage_level    │   │                                 │   │            │
│  │ phase            │   │     ┌──────────────────┐        │   │            │
│  │ geometry (JSON)  │   │     │   connections    │        │   │            │
│  │ created_at       │   │     ├──────────────────┤        │   │            │
│  │ updated_at       │   │     │ id (PK)          │<───────┘   │            │
│  └──────────────────┘   │     │ type             │            │            │
│         ▲               │     │ length           │            │            │
│         │               │     │ wire_type        │            │            │
│         └───────────────┘     │ core             │            │            │
│                               │ wire_size        │            │            │
│                               │ material         │            │            │
│                               │ resistance_r     │            │            │
│                               │ reactance_x      │            │            │
│                               │ impedance_z      │            │            │
│                               │ current_capacity │            │            │
│                               └──────────────────┘            │            │
│                                                               │            │
└───────────────────────────────────────────────────────────────┼────────────┘
                                                                │
┌───────────────────────────────────────────────────────────────┼────────────┐
│                              СЛОЙ 2: ОБОРУДОВАНИЕ              │            │
├───────────────────────────────────────────────────────────────┼────────────┤
│                                                               │            │
│  ┌──────────────────┐         ┌──────────────────┐            │            │
│  │    devices       │────────<│  device_states   │            │            │
│  ├──────────────────┤         ├──────────────────┤            │            │
│  │ id (PK)          │         │ id (PK)          │            │            │
│  │ type             │         │ device_id (FK)   │────────────┘            │
│  │ model            │         │ slot_id (FK)     │<───────────────────────┐│
│  │ manufacturer     │         │ state            │                        ││
│  │ p_kw             │         │ state_raw        │                        ││
│  │ q_kvar           │         │ locked           │                        ││
│  │ s_kva            │         │ manual_mode      │                        ││
│  │ voltage_nom      │         │ remote_control   │                        ││
│  │ current_nom      │         │ last_change      │                        ││
│  │ current_max      │         │ changed_by       │                        ││
│  │ cos_phi          │         │ operation_count  │                        ││
│  │ efficiency       │         └──────────────────┘                        ││
│  │ breaking_capacity│                                                     ││
│  │ poles            │         ┌──────────────────┐                        ││
│  │ tripping_char    │         │   device_types   │                        ││
│  │ in_rating        │         ├──────────────────┤                        ││
│  │ ir_setting       │         │ id (PK)          │                        ││
│  │ ii_setting       │         │ category         │                        ││
│  │ profile_id (FK)  │───┐     │ description      │                        ││
│  │ created_at       │   │     │ default_poles    │                        ││
│  │ updated_at       │   │     │ default_voltage  │                        ││
│  └──────────────────┘   │     └──────────────────┘                        ││
│         ▲               │                                                  ││
│         │               │                                                  ││
└─────────┼───────────────┼──────────────────────────────────────────────────┼┘
          │               │                                                  │
┌─────────┼───────────────┼──────────────────────────────────────────────────┼┐
│         │   СЛОЙ 3: УПРАВЛЕНИЕ                               │              │
├─────────┼───────────────┼──────────────────────────────────────────────────┤│
│         │               │                                                  ││
│  ┌──────┴─────────┐     │     ┌──────────────────┐                         ││
│  │   ats_logic    │     │     │   protection     │                         ││
│  ├────────────────┤     │     ├──────────────────┤                         ││
│  │ id (PK)        │     │     │ id (PK)          │                         ││
│  │ name           │     │     │ slot_id (FK)     │<────────────────────────┘│
│  │ slot_id (FK)   │<────┼──── │ device_id (FK)   │                          │
│  │ device_id (FK) │─────┘     │ protection_ref   │                          │
│  │ ats_controlled │           │ overcurrent_pickup│                         │
│  │ states_trigger │           │ overcurrent_delay │                         │
│  │ priority       │           │ overcurrent_curve │                         │
│  │ delay_sec      │           │ earth_fault_pickup│                         │
│  │ voltage_thresh │           │ earth_fault_delay │                         │
│  │ freq_threshold │           │ instantaneous_pk  │                         │
│  │ return_delay   │           │ overvoltage_limit │                         │
│  │ test_mode      │           │ undervoltage_limit│                         │
│  │ active         │           │ overfreq_limit    │                         │
│  └────────────────┘           │ underfreq_limit   │                         │
│                               │ thermal_pickup    │                         │
│  ┌──────────────────┐         │ thermal_delay     │                         │
│  │    scenarios     │         └──────────────────┘                         │
│  ├──────────────────┤                                                      │
│  │ id (PK)          │         ┌──────────────────┐                         │
│  │ name             │         │    commands      │                         │
│  │ description      │         ├──────────────────┤                         │
│  │ source_priority  │         │ id (PK)          │                         │
│  │ devices_on       │         │ device_id (FK)   │                         │
│  │ devices_off      │         │ command          │                         │
│  │ active           │         │ target_state     │                         │
│  │ auto_switch      │         │ priority         │                         │
│  └──────────────────┘         │ status           │                         │
│                               │ created_at       │                         │
│                               │ executed_at      │                         │
│                               │ created_by       │                         │
│                               │ result           │                         │
│                               │ retry_count      │                         │
│                               └──────────────────┘                         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                              СЛОЙ 4: РАСЧЁТЫ                                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────┐         ┌──────────────────┐                        │
│  │   power_flow     │         │  short_circuit   │                        │
│  ├──────────────────┤         ├──────────────────┤                        │
│  │ id (PK)          │         │ id (PK)          │                        │
│  │ slot_id (FK)     │         │ slot_id (FK)     │                        │
│  │ device_id (FK)   │         │ ik3_initial      │                        │
│  │ voltage_a        │         │ ik3_peak         │                        │
│  │ voltage_b        │         │ ik3_breaking     │                        │
│  │ voltage_c        │         │ ik1_initial      │                        │
│  │ voltage_avg      │         │ ik1_peak         │                        │
│  │ current_a        │         │ ik2_initial      │                        │
│  │ current_b        │         │ z_system         │                        │
│  │ current_c        │         │ r_system         │                        │
│  │ current_n        │         │ x_system         │                        │
│  │ p_a, p_b, p_c    │         │ ik_min           │                        │
│  │ p_total          │         │ ik_max           │                        │
│  │ q_a, q_b, q_c    │         └──────────────────┘                        │
│  │ q_total          │                                                      │
│  │ s_total          │         ┌──────────────────┐                        │
│  │ p_loss           │         │  load_profiles   │                        │
│  │ q_loss           │         ├──────────────────┤                        │
│  │ cos_phi          │         │ id (PK)          │                        │
│  │ load_factor      │         │ type             │                        │
│  │ calc_time        │         │ description      │                        │
│  └──────────────────┘         │ seasonality      │                        │
│                               │ values (JSON)    │                        │
│                               └──────────────────┘                        │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                              СЛОЙ 5: ИЗМЕРЕНИЯ                              │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────┐         ┌──────────────────┐                        │
│  │  measurements    │         │     alarms       │                        │
│  ├──────────────────┤         ├──────────────────┤                        │
│  │ id (PK)          │         │ id (PK)          │                        │
│  │ slot_id (FK)     │         │ name             │                        │
│  │ device_id (FK)   │         │ condition        │                        │
│  │ u_a, u_b, u_c    │         │ severity         │                        │
│  │ u_ab, u_bc, u_ca │         │ active           │                        │
│  │ i_a, i_b, i_c    │         │ acknowledged     │                        │
│  │ i_n              │         │ device_id (FK)   │                        │
│  │ p_total          │         │ slot_id (FK)     │                        │
│  │ q_total          │         │ timestamp        │                        │
│  │ s_total          │         │ value            │                        │
│  │ frequency        │         │ threshold        │                        │
│  │ cos_phi          │         └──────────────────┘                        │
│  │ thd_u, thd_i     │                                                      │
│  │ energy_act_imp   │         ┌──────────────────┐                        │
│  │ energy_act_exp   │         │   alarm_rules    │                        │
│  │ energy_react_imp │         ├──────────────────┤                        │
│  │ energy_react_exp │         │ id (PK)          │                        │
│  │ timestamp        │         │ name             │                        │
│  │ quality          │         │ parameter        │                        │
│  └──────────────────┘         │ high_limit       │                        │
│                               │ high_high_limit  │                        │
│  (TimescaleDB - hypertable)   │ low_limit        │                        │
│                               │ low_low_limit    │                        │
│                               │ delay_sec        │                        │
│                               │ hysteresis       │                        │
│                               └──────────────────┘                        │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                              СЛОЙ 6: ОБСЛУЖИВАНИЕ                           │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────┐         ┌──────────────────┐                        │
│  │    tariffs       │         │  maintenance     │                        │
│  ├──────────────────┤         ├──────────────────┤                        │
│  │ id (PK)          │         │ id (PK)          │                        │
│  │ name             │         │ device_id (FK)   │                        │
│  │ type             │         │ device_type      │                        │
│  │ price_per_kwh    │         │ last_maintenance │                        │
│  │ price_per_kw     │         │ next_maintenance │                        │
│  │ price_per_kvarh  │         │ maint_interval   │                        │
│  │ cos_phi_thresh   │         │ maint_type       │                        │
│  │ valid_from       │         │ last_verification│                        │
│  │ valid_to         │         │ next_verification│                        │
│  │ time_start       │         │ verification_int │                        │
│  │ time_end         │         │ status           │                        │
│  └──────────────────┘         │ responsible      │                        │
│                               │ notes            │                        │
│  ┌──────────────────┐         └──────────────────┘                        │
│  │    event_log     │                                                      │
│  ├──────────────────┤         (TimescaleDB - hypertable)                  │
│  │ id (PK)          │                                                      │
│  │ timestamp        │                                                      │
│  │ event_type       │                                                      │
│  │ event_category   │                                                      │
│  │ device_id (FK)   │                                                      │
│  │ slot_id (FK)     │                                                      │
│  │ description      │                                                      │
│  │ severity         │                                                      │
│  │ acknowledged     │                                                      │
│  │ acknowledged_by  │                                                      │
│  │ details (JSON)   │                                                      │
│  └──────────────────┘                                                      │
│                                                                            │
│  (TimescaleDB - hypertable)                                                │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Prisma Schema (основные таблицы)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== СЛОЙ 1: ТОПОЛОГИЯ ====================

model Element {
  id            String   @id
  type          String   // source, bus, breaker, load, junction, meter
  name          String
  parentId      String?  @map("parent_id")
  parent        Element? @relation("ParentChild", fields: [parentId], references: [id])
  children      Element[] @relation("ParentChild")
  deviceId      String?  @map("device_id")
  device        Device?  @relation(fields: [deviceId], references: [id])
  location      String?
  voltageLevel  Decimal? @map("voltage_level")
  phase         String   @default("ABC")
  geometry      Json?
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  
  // Relations
  networkFrom   Network[] @relation("FromElement")
  networkTo     Network[] @relation("ToElement")
  states        DeviceState[]
  measurements  Measurement[]
  protection    Protection[]
  powerFlow     PowerFlow[]
  shortCircuit  ShortCircuit[]
  atsLogic      ATSLogic[]
  events        EventLog[]

  @@map("elements")
}

model Network {
  id            String   @id
  fromId        String   @map("from_id")
  from          Element  @relation("FromElement", fields: [fromId], references: [id])
  toId          String   @map("to_id")
  to            Element  @relation("ToElement", fields: [toId], references: [id])
  connectionId  String   @map("connection_id")
  connection    Connection @relation(fields: [connectionId], references: [id])
  scenarioId    String?  @map("scenario_id")
  
  @@unique([fromId, toId])
  @@map("network")
}

model Connection {
  id              String   @id
  type            String   // cable, busbar, line
  length          Decimal?
  wireType        String?  @map("wire_type")
  core            Int?
  wireSize        Decimal? @map("wire_size")
  material        String?  // Cu, Al
  resistanceR     Decimal? @map("resistance_r")
  reactanceX      Decimal? @map("reactance_x")
  impedanceZ      Decimal? @map("impedance_z")
  currentCapacity Decimal? @map("current_capacity")
  rawName         String?  @map("raw_name")
  
  network Network[]
  
  @@map("connections")
}

// ==================== СЛОЙ 2: ОБОРУДОВАНИЕ ====================

model Device {
  id                String   @id
  type              String   // source, breaker, load, meter, transformer
  model             String
  manufacturer      String?
  pKw               Decimal? @map("p_kw")
  qKvar             Decimal? @map("q_kvar")
  sKva              Decimal? @map("s_kva")
  voltageNom        Decimal? @map("voltage_nom")
  currentNom        Decimal? @map("current_nom")
  currentMax        Decimal? @map("current_max")
  cosPhi            Decimal? @map("cos_phi")
  efficiency        Decimal?
  breakingCapacity  Decimal? @map("breaking_capacity_ka")
  poles             Int      @default(3)
  trippingChar      String?  @map("tripping_char")
  inRating          Decimal? @map("in_rating")
  irSetting         Decimal? @map("ir_setting")
  iiSetting         Decimal? @map("ii_setting")
  profileId         String?  @map("profile_id")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")
  
  elements      Element[]
  states        DeviceState[]
  commands      Command[]
  protection    Protection[]
  measurements  Measurement[]
  maintenance   Maintenance[]
  events        EventLog[]
  alarms        Alarm[]

  @@map("devices")
}

model DeviceState {
  id             String   @id
  deviceId       String   @map("device_id")
  device         Device   @relation(fields: [deviceId], references: [id])
  slotId         String   @map("slot_id")
  element        Element  @relation(fields: [slotId], references: [id])
  state          String   // ON, OFF, LIVE, DEAD, TRIPPED
  stateRaw       String?  @map("state_raw")
  locked         Boolean  @default(false)
  manualMode     Boolean  @default(false) @map("manual_mode")
  remoteControl  Boolean  @default(true) @map("remote_control")
  lastChange     DateTime @map("last_change")
  changedBy      String   @map("changed_by")
  operationCount Int      @default(0) @map("operation_count")
  
  @@map("device_states")
}

model DeviceType {
  id              String   @id
  category        String
  description     String
  defaultPoles    Int?     @map("default_poles")
  defaultVoltage  Decimal? @map("default_voltage")
  
  @@map("device_types")
}

// ==================== СЛОЙ 3: УПРАВЛЕНИЕ ====================

model ATSLogic {
  id               String   @id
  name             String?
  slotId           String   @map("slot_id")
  element          Element  @relation(fields: [slotId], references: [id])
  deviceId         String?  @map("device_id")
  atsControlled    Boolean  @default(false) @map("ats_controlled")
  statesOnTrigger  Json?    @map("states_on_trigger")
  priority         Int      @default(1)
  delaySec         Int      @default(0) @map("delay_sec")
  voltageThreshold Decimal? @map("voltage_threshold")
  freqThreshold    Decimal? @map("freq_threshold")
  returnDelaySec   Int?     @map("return_delay_sec")
  testMode         Boolean  @default(false) @map("test_mode")
  active           Boolean  @default(true)
  
  @@map("ats_logic")
}

model Protection {
  id                 String   @id
  slotId             String   @map("slot_id")
  element            Element  @relation(fields: [slotId], references: [id])
  deviceId           String?  @map("device_id")
  device             Device?  @relation(fields: [deviceId], references: [id])
  protectionRef      String   @map("protection_ref")
  overcurrentPickup  Decimal? @map("overcurrent_pickup")
  overcurrentDelay   Decimal? @map("overcurrent_delay")
  overcurrentCurve   String?  @map("overcurrent_curve")
  earthFaultPickup   Decimal? @map("earth_fault_pickup")
  earthFaultDelay    Decimal? @map("earth_fault_delay")
  instantaneousPickup Decimal? @map("instantaneous_pickup")
  overvoltageLimit   Decimal? @map("overvoltage_limit")
  undervoltageLimit  Decimal? @map("undervoltage_limit")
  overfreqLimit      Decimal? @map("overfreq_limit")
  underfreqLimit     Decimal? @map("underfreq_limit")
  thermalPickup      Decimal? @map("thermal_pickup")
  thermalDelay       Decimal? @map("thermal_delay")
  
  @@map("protection")
}

model Scenario {
  id             String   @id
  name           String
  description    String?
  sourcePriority Json?    @map("source_priority")
  devicesOn      Json?    @map("devices_on")
  devicesOff     Json?    @map("devices_off")
  active         Boolean  @default(false)
  autoSwitch     Boolean  @default(true) @map("auto_switch")
  
  @@map("scenarios")
}

model Command {
  id           String   @id
  deviceId     String   @map("device_id")
  device       Device   @relation(fields: [deviceId], references: [id])
  command      String   // SWITCH, RESET, LOCK, UNLOCK
  targetState  String?  @map("target_state")
  priority     Int      @default(5)
  status       String   @default("PENDING") // PENDING, EXECUTING, COMPLETED, FAILED
  createdAt    DateTime @default(now()) @map("created_at")
  executedAt   DateTime? @map("executed_at")
  createdBy    String   @map("created_by")
  result       String?
  retryCount   Int      @default(0) @map("retry_count")
  maxRetries   Int      @default(3) @map("max_retries")
  
  @@map("commands")
}

// ==================== СЛОЙ 4: РАСЧЁТЫ ====================

model PowerFlow {
  id          String   @id
  slotId      String   @map("slot_id")
  element     Element  @relation(fields: [slotId], references: [id])
  deviceId    String?  @map("device_id")
  voltageA    Decimal? @map("voltage_a")
  voltageB    Decimal? @map("voltage_b")
  voltageC    Decimal? @map("voltage_c")
  voltageAvg  Decimal? @map("voltage_avg")
  currentA    Decimal? @map("current_a")
  currentB    Decimal? @map("current_b")
  currentC    Decimal? @map("current_c")
  currentN    Decimal? @map("current_n")
  pA          Decimal?
  pB          Decimal?
  pC          Decimal?
  pTotal      Decimal? @map("p_total")
  qA          Decimal?
  qB          Decimal?
  qC          Decimal?
  qTotal      Decimal? @map("q_total")
  sTotal      Decimal? @map("s_total")
  pLoss       Decimal? @map("p_loss")
  qLoss       Decimal? @map("q_loss")
  cosPhi      Decimal? @map("cos_phi")
  loadFactor  Decimal? @map("load_factor")
  calcTime    DateTime @default(now()) @map("calc_time")
  
  @@map("power_flow")
}

model ShortCircuit {
  id            String   @id
  slotId        String   @map("slot_id")
  element       Element  @relation(fields: [slotId], references: [id])
  ik3Initial    Decimal? @map("ik3_initial")
  ik3Peak       Decimal? @map("ik3_peak")
  ik3Breaking   Decimal? @map("ik3_breaking")
  ik1Initial    Decimal? @map("ik1_initial")
  ik1Peak       Decimal? @map("ik1_peak")
  ik2Initial    Decimal? @map("ik2_initial")
  zSystem       Decimal? @map("z_system")
  rSystem       Decimal? @map("r_system")
  xSystem       Decimal? @map("x_system")
  ikMin         Decimal? @map("ik_min")
  ikMax         Decimal? @map("ik_max")
  
  @@map("short_circuit")
}

model LoadProfile {
  id          String   @id
  type        String   // constant, daily, seasonal
  description String?
  seasonality Boolean  @default(false)
  values      Json?
  
  @@map("load_profiles")
}

// ==================== СЛОЙ 5: ИЗМЕРЕНИЯ ====================

model Measurement {
  id                String   @id
  slotId            String   @map("slot_id")
  element           Element  @relation(fields: [slotId], references: [id])
  deviceId          String?  @map("device_id")
  device            Device?  @relation(fields: [deviceId], references: [id])
  uA                Decimal?
  uB                Decimal?
  uC                Decimal?
  uAB               Decimal?
  uBC               Decimal?
  uCA               Decimal?
  iA                Decimal?
  iB                Decimal?
  iC                Decimal?
  iN                Decimal?
  pTotal            Decimal? @map("p_total")
  qTotal            Decimal? @map("q_total")
  sTotal            Decimal? @map("s_total")
  frequency         Decimal?
  cosPhi            Decimal? @map("cos_phi")
  thdU              Decimal?
  thdI              Decimal?
  energyActiveImp   Decimal? @map("energy_active_import")
  energyActiveExp   Decimal? @map("energy_active_export")
  energyReactiveImp Decimal? @map("energy_reactive_import")
  energyReactiveExp Decimal? @map("energy_reactive_export")
  timestamp         DateTime @default(now())
  quality           String   @default("GOOD") // GOOD, QUESTIONABLE, BAD
  
  @@map("measurements")
}

model Alarm {
  id           String    @id
  name         String
  condition    String
  severity     String    // INFO, WARNING, CRITICAL
  active       Boolean   @default(false)
  acknowledged Boolean   @default(false)
  deviceId     String?   @map("device_id")
  device       Device?   @relation(fields: [deviceId], references: [id])
  slotId       String?   @map("slot_id")
  timestamp    DateTime? @default(now())
  value        Decimal?
  threshold    Decimal?
  
  @@map("alarms")
}

model AlarmRule {
  id             String   @id
  name           String
  parameter      String
  highLimit      Decimal? @map("high_limit")
  highHighLimit   Decimal? @map("high_high_limit")
  lowLimit       Decimal? @map("low_limit")
  lowLowLimit    Decimal? @map("low_low_limit")
  delaySec       Int?     @map("delay_sec")
  hysteresis     Decimal?
  
  @@map("alarm_rules")
}

// ==================== СЛОЙ 6: ОБСЛУЖИВАНИЕ ====================

model Tariff {
  id             String   @id
  name           String
  type           String   // energy, power, reactive
  pricePerKwh    Decimal? @map("price_per_kwh")
  pricePerKw     Decimal? @map("price_per_kw")
  pricePerKvarh  Decimal? @map("price_per_kvarh")
  cosPhiThresh   Decimal? @map("cos_phi_threshold")
  validFrom      DateTime? @map("valid_from")
  validTo        DateTime? @map("valid_to")
  timeStart      String?  @map("time_start")
  timeEnd        String?  @map("time_end")
  
  @@map("tariffs")
}

model Maintenance {
  id                   String    @id
  deviceId             String    @map("device_id")
  device               Device    @relation(fields: [deviceId], references: [id])
  deviceType           String    @map("device_type")
  lastMaintenance      DateTime? @map("last_maintenance")
  nextMaintenance      DateTime? @map("next_maintenance")
  maintenanceInterval  Int?      @map("maintenance_interval_days")
  maintenanceType      String?   @map("maintenance_type")
  lastVerification     DateTime? @map("last_verification")
  nextVerification     DateTime? @map("next_verification")
  verificationInterval Int?      @map("verification_interval_years")
  status               String    @default("OK") // OK, DUE, OVERDUE
  responsible          String?
  notes                String?
  
  @@map("maintenance")
}

model EventLog {
  id             String   @id
  timestamp      DateTime @default(now())
  eventType      String   @map("event_type")
  eventCategory  String   @map("event_category")
  deviceId       String?  @map("device_id")
  device         Device?  @relation(fields: [deviceId], references: [id])
  slotId         String?  @map("slot_id")
  element        Element? @relation(fields: [slotId], references: [id])
  description    String
  severity       String   // INFO, WARNING, ERROR, CRITICAL
  acknowledged   Boolean  @default(false)
  acknowledgedBy String?  @map("acknowledged_by")
  acknowledgedAt DateTime? @map("acknowledged_at")
  details        Json?
  
  @@map("event_log")
}

// ==================== ПОЛЬЗОВАТЕЛИ ====================

model User {
  id        String   @id
  email     String   @unique
  name      String
  password  String
  role      String   // OPERATOR, ENGINEER, ADMIN
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  @@map("users")
}
```

---

## 6. API ENDPOINTS

### 6.1 REST API

```
/api/v1/
├── /network
│   ├── GET    /                 # Список всех элементов
│   ├── POST   /                 # Создать элемент
│   ├── GET    /graph            # Граф для визуализации
│   ├── GET    /validate         # Валидация сети
│   ├── GET    /:id              # Детали элемента
│   ├── PUT    /:id              # Обновить элемент
│   └── DELETE /:id              # Удалить элемент
│
├── /devices
│   ├── GET    /                 # Список устройств
│   ├── POST   /                 # Создать устройство
│   ├── GET    /:id              # Детали устройства
│   ├── PUT    /:id              # Обновить устройство
│   ├── DELETE /:id              # Удалить устройство
│   ├── POST   /control          # Команда управления
│   └── GET    /states           # Состояния устройств
│
├── /connections
│   ├── GET    /                 # Список соединений
│   ├── POST   /                 # Создать соединение
│   ├── GET    /:id              # Детали соединения
│   └── PUT    /:id              # Обновить соединение
│
├── /ats
│   ├── GET    /                 # Список АВР
│   ├── POST   /                 # Создать логику АВР
│   ├── GET    /logic            # Логика АВР
│   └── POST   /simulate         # Симуляция АВР
│
├── /scenarios
│   ├── GET    /                 # Список сценариев
│   ├── POST   /                 # Создать сценарий
│   ├── GET    /:id              # Детали сценария
│   ├── PUT    /:id              # Обновить сценарий
│   └── POST   /apply            # Применить сценарий
│
├── /calculations
│   ├── POST   /power-flow       # Расчёт потокораспределения
│   ├── POST   /short-circuit    # Расчёт токов КЗ
│   ├── POST   /losses           # Расчёт потерь
│   └── POST   /balance          # Баланс мощностей
│
├── /measurements
│   ├── GET    /                 # Текущие измерения
│   ├── GET    /history          # История измерений
│   └── GET    /realtime         # Real-time подписка
│
├── /alarms
│   ├── GET    /                 # Список аварий
│   ├── POST   /acknowledge      # Квитировать аварию
│   └── GET    /history          # История аварий
│
├── /events
│   ├── GET    /                 # Журнал событий
│   └── GET    /export           # Экспорт журнала
│
├── /reports
│   ├── GET    /                 # Шаблоны отчётов
│   ├── GET    /templates        # Список шаблонов
│   └── POST   /generate         # Генерация отчёта
│
├── /import
│   ├── POST   /                 # Импорт Excel
│   └── POST   /validate         # Валидация файла
│
└── /tariffs
    ├── GET    /                 # Список тарифов
    └── POST   /                 # Создать тариф
```

### 6.2 WebSocket Events

```typescript
// Client → Server
{
  "type": "subscribe",
  "channels": ["measurements", "alarms", "events"]
}

// Server → Client
{
  "type": "measurement",
  "data": {
    "slotId": "SRC_TP21_T1",
    "uA": 230.5,
    "uB": 229.8,
    "uC": 231.2,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}

{
  "type": "alarm",
  "data": {
    "id": "ALARM_001",
    "name": "Перенапряжение",
    "severity": "WARNING",
    "slotId": "BUS_GRSCH1_1"
  }
}

{
  "type": "event",
  "data": {
    "eventType": "DEVICE_SWITCH",
    "deviceId": "DEV_B001",
    "state": "OFF"
  }
}
```

---

## 7. КЛЮЧЕВЫЕ АЛГОРИТМЫ

### 7.1 Power Flow (Потокораспределение)

```typescript
// lib/calculations/power-flow.ts

interface PowerFlowInput {
  elements: Element[];
  network: Network[];
  connections: Connection[];
  devices: Device[];
  scenarioId?: string;
}

interface PowerFlowResult {
  slotId: string;
  voltage: { a: number; b: number; c: number };
  current: { a: number; b: number; c: number; n: number };
  power: { p: number; q: number; s: number };
  losses: { p: number; q: number };
}

async function calculatePowerFlow(input: PowerFlowInput): Promise<PowerFlowResult[]> {
  // 1. Построение матрицы проводимостей Y-bus
  const yBus = buildAdmittanceMatrix(input.network, input.connections);
  
  // 2. Определение типов узлов
  // - Slack bus (источник) - известны U, δ
  // - PV bus (генератор) - известны P, U
  // - PQ bus (нагрузка) - известны P, Q
  
  // 3. Итерационный метод Ньютона-Рафсона
  let voltages = initializeVoltages(input.elements);
  
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const mismatch = calculatePowerMismatch(voltages, yBus, input.devices);
    
    if (converged(mismatch)) break;
    
    const jacobian = buildJacobian(voltages, yBus);
    const correction = solveLinearSystem(jacobian, mismatch);
    voltages = updateVoltages(voltages, correction);
  }
  
  // 4. Расчёт токов и мощностей
  return calculateResults(voltages, yBus, input);
}
```

### 7.2 Short Circuit (Токи КЗ)

```typescript
// lib/calculations/short-circuit.ts

interface ShortCircuitInput {
  elements: Element[];
  network: Network[];
  connections: Connection[];
  faultType: 'three-phase' | 'single-phase' | 'two-phase';
  faultLocation: string; // slotId
}

interface ShortCircuitResult {
  slotId: string;
  ik3Initial: number;   // Начальный ток 3-ф КЗ
  ik3Peak: number;      // Ударный ток
  ik3Breaking: number;  // Ток отключения
  ik1Initial: number;   // Ток 1-ф КЗ
  zSystem: number;      // Сопротивление системы
}

async function calculateShortCircuit(input: ShortCircuitInput): Promise<ShortCircuitResult> {
  // 1. Построение схемы замещения
  const impedance = buildImpedanceNetwork(input.network, input.connections);
  
  // 2. Преобразование к простейшему виду
  const zEquivalent = reduceToEquivalent(impedance, input.faultLocation);
  
  // 3. Расчёт токов КЗ
  const uNom = 400; // В
  const ik3 = uNom / (Math.sqrt(3) * zEquivalent.z);
  
  // 4. Ударный ток
  const kPeak = 1.8; // Коэффициент ударный
  const ik3Peak = Math.sqrt(2) * kPeak * ik3;
  
  // 5. Однофазное КЗ
  const z0 = calculateZeroSequenceImpedance(impedance);
  const ik1 = (3 * uNom) / (zEquivalent.z + zEquivalent.z + z0);
  
  return {
    slotId: input.faultLocation,
    ik3Initial: ik3,
    ik3Peak: ik3Peak,
    ik3Breaking: ik3 * 0.9,
    ik1Initial: ik1,
    zSystem: zEquivalent.z,
  };
}
```

### 7.3 ATS Logic (Логика АВР)

```typescript
// lib/services/ats.service.ts

interface ATSContext {
  voltageThreshold: number;  // 0.9 * Unom
  frequencyThreshold: number; // 49.5 Hz
  delaySec: number;
  returnDelaySec: number;
}

async function evaluateATSLogic(
  atsId: string,
  measurements: Map<string, Measurement>,
  context: ATSContext
): Promise<ATSAction | null> {
  const ats = await getATSLogic(atsId);
  
  // 1. Проверка условий срабатывания
  const sourceVoltage = measurements.get(ats.slotId)?.uA;
  const frequency = measurements.get(ats.slotId)?.frequency;
  
  const voltageOk = sourceVoltage && sourceVoltage >= context.voltageThreshold * 400;
  const frequencyOk = frequency && frequency >= context.frequencyThreshold;
  
  if (voltageOk && frequencyOk) {
    // Нормальный режим - возврат
    if (ats.statesOnTrigger) {
      // Возврат к основному источнику
      return { action: 'RETURN', delay: context.returnDelaySec };
    }
    return null;
  }
  
  // 2. Потеря питания - переключение
  return {
    action: 'SWITCH',
    targetStates: ats.statesOnTrigger,
    delay: context.delaySec,
    priority: ats.priority,
  };
}
```

---

## 8. БЕЗОПАСНОСТЬ

### 8.1 Аутентификация

```typescript
// lib/auth/config.ts

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Проверка credentials
        const user = await verifyUser(credentials);
        return user ? { id: user.id, email: user.email, role: user.role } : null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = user.role;
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role;
      return session;
    }
  }
};
```

### 8.2 Авторизация

```typescript
// lib/auth/permissions.ts

export const permissions = {
  OPERATOR: {
    network: ['read'],
    devices: ['read', 'control'],
    monitoring: ['read'],
    alarms: ['read', 'acknowledge'],
    reports: ['read'],
  },
  ENGINEER: {
    network: ['read', 'write'],
    devices: ['read', 'write'],
    calculations: ['read', 'execute'],
    scenarios: ['read', 'write'],
    reports: ['read', 'generate'],
    import: ['execute'],
  },
  ADMIN: {
    '*': ['*'], // Полный доступ
  }
};

export function hasPermission(role: string, resource: string, action: string): boolean {
  const rolePermissions = permissions[role];
  if (rolePermissions['*']?.includes('*')) return true;
  return rolePermissions[resource]?.includes(action) ?? false;
}
```

---

## 9. РАЗВЁРТЫВАНИЕ

### 9.1 Docker Compose

```yaml
# docker-compose.yml

version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/powergrid
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=http://localhost:3000
    depends_on:
      - db
      - timescaledb

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=powergrid
    volumes:
      - postgres_data:/var/lib/postgresql/data

  timescaledb:
    image: timescale/timescaledb:latest-pg15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=powergrid_ts
    volumes:
      - timescale_data:/var/lib/postgresql/data

volumes:
  postgres_data:
  timescale_data:
```

### 9.2 Переменные окружения

```bash
# .env.local

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/powergrid"

# Auth
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# App
NODE_ENV="development"
APP_NAME="PowerGrid Digital Twin"

# External services (optional)
MODBUS_HOST="192.168.1.100"
MODBUS_PORT="502"
```

---

## 10. ЗАКЛЮЧЕНИЕ

Данная архитектура обеспечивает:

1. **Масштабируемость** - модульная структура позволяет добавлять новые функции
2. **Надёжность** - разделение на слои, изоляция данных
3. **Безопасность** - ролевая модель доступа
4. **Производительность** - TimescaleDB для временных рядов
5. **Расширяемость** - API-first подход

Следующие шаги:
1. Инициализация проекта Next.js
2. Настройка Prisma и БД
3. Реализация базового UI
4. Подключение импорта данных
5. Реализация расчётных модулей
6. Интеграция real-time мониторинга

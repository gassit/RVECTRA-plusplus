/**
 * ============================================================================
 * RVectrA Digital Twin — Project Architecture
 * ============================================================================
 * 
 * Полная документация архитектуры проекта
 * Включает: структуру, пакеты, конфигурации, компоненты
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, HeadingLevel, AlignmentType, WidthType,
  BorderStyle, ShadingType
} from 'docx';
import * as fs from 'fs';

// ============================================================================
// PALETTE
// ============================================================================
const P = {
  primary: "0A1628",
  body: "1A2B40",
  secondary: "6878A0",
  accent: "5B8DB8",
  surface: "F4F8FC"
};

const c = (hex: string) => hex;

// ============================================================================
// HELPERS
// ============================================================================
function h1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })]
  });
}

function h2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, size: 28, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })]
  });
}

function h3(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })]
  });
}

function p(text: string, indent = true) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    indent: indent ? { firstLine: 480 } : undefined,
    children: [new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })]
  });
}

function codeBlock(lines: string[]) {
  return lines.map(line => new Paragraph({
    spacing: { line: 276, after: 0 },
    shading: { type: ShadingType.CLEAR, fill: "F5F5F5" },
    indent: { left: 400 },
    children: [new TextRun({ text: line, size: 20, font: { ascii: "Consolas", eastAsia: "Consolas" }, color: "333333" })]
  }));
}

function bullet(text: string, level = 0) {
  return new Paragraph({
    spacing: { line: 312, after: 60 },
    indent: { left: 600 + level * 300 },
    children: [new TextRun({ text: "• " + text, size: 24, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })]
  });
}

function table(headers: string[], rows: string[][]) {
  const headerRow = new TableRow({
    children: headers.map(h => new TableCell({
      shading: { type: ShadingType.CLEAR, fill: P.accent },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: h, bold: true, size: 22, color: "FFFFFF", font: { ascii: "Calibri", eastAsia: "SimHei" } })]
      })]
    }))
  });

  const dataRows = rows.map((row, idx) => new TableRow({
    children: row.map(cell => new TableCell({
      shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? P.surface : "FFFFFF" },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({
        children: [new TextRun({ text: cell, size: 22, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })]
      })]
    }))
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows]
  });
}

// ============================================================================
// DOCUMENT CONTENT
// ============================================================================
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 24, color: c(P.body) },
        paragraph: { spacing: { line: 312 } }
      }
    }
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "RVectrA Digital Twin — Архитектура", size: 20, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 20, color: c(P.secondary) })]
          })]
        })
      },
      children: [
        // ============================================================================
        // TITLE
        // ============================================================================
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 600, after: 200 },
          children: [new TextRun({ text: "RVectrA Digital Twin", bold: true, size: 48, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: "Архитектура проекта", size: 28, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
          children: [new TextRun({ text: "Полное описание структуры, пакетов и конфигураций", size: 22, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })]
        }),

        // ============================================================================
        // 1. PROJECT OVERVIEW
        // ============================================================================
        h1("1. Общая информация о проекте"),
        
        h2("1.1. Метаданные проекта"),
        table(
          ["Параметр", "Значение"],
          [
            ["Название", "network-digital-twin"],
            ["Версия", "0.1.0"],
            ["Тип", "private"],
            ["Репозиторий", "github.com/gassit/RVectrA-Digital-Twin"],
            ["Последнее обновление", "Апрель 2026"],
            ["Количество исходных файлов", "405+ файлов"],
            ["Количество TypeScript файлов", "162 файла"]
          ]
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("1.2. Назначение"),
        p("RVectrA Digital Twin — веб-приложение для визуализации и управления цифровой двойникой электросети. Система предоставляет интерактивный графический интерфейс для отображения топологической схемы электросети, мониторинга состояния оборудования и автоматического управления резервным питанием (АВР). Приложение поддерживает импорт данных из Excel-файлов различных форматов и автоматически рассчитывает топологические связи между элементами сети."),

        // ============================================================================
        // 2. TECHNOLOGY STACK
        // ============================================================================
        h1("2. Технологический стек"),

        h2("2.1. Основные фреймворки и библиотеки"),
        table(
          ["Категория", "Технология", "Версия", "Назначение"],
          [
            ["Frontend Framework", "Next.js", "16.1.1", "React-фреймворк с App Router"],
            ["UI Library", "React", "19.0.0", "Библиотека для построения UI"],
            ["Graph Visualization", "AntV G6", "5.1.0", "Визуализация графов"],
            ["Layout Algorithm", "Dagre", "0.8.5", "Расчёт топологического layout"],
            ["Database ORM", "Prisma", "6.11.1", "ORM для работы с БД"],
            ["Database", "SQLite", "—", "Локальная база данных"],
            ["Styling", "Tailwind CSS", "4.2.2", "Utility-first CSS"],
            ["Runtime", "Bun", "—", "JavaScript runtime"],
            ["Language", "TypeScript", "5.x", "Типизированный JavaScript"],
            ["Excel Parser", "xlsx", "0.18.5", "Парсинг Excel файлов"]
          ]
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("2.2. Dependencies (производственные зависимости)"),
        ...codeBlock([
          "{",
          '  "dependencies": {',
          '    "@antv/g6": "^5.1.0",           // Визуализация графов',
          '    "@prisma/adapter-libsql": "^7.7.0", // Адаптер для LibSQL',
          '    "@prisma/client": "^6.11.1",    // Prisma Client ORM',
          '    "@types/dagre": "^0.7.54",      // TypeScript типы для dagre',
          '    "dagre": "^0.8.5",              // Layout алгоритм',
          '    "next": "^16.1.1",              // Next.js фреймворк',
          '    "prisma": "^6.11.1",            // Prisma CLI',
          '    "react": "^19.0.0",             // React библиотека',
          '    "react-dom": "^19.0.0",         // React DOM',
          '    "xlsx": "^0.18.5"               // Excel парсер',
          '  }',
          "}"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("2.3. DevDependencies (зависимости разработки)"),
        ...codeBlock([
          "{",
          '  "devDependencies": {',
          '    "@tailwindcss/postcss": "^4.2.2", // PostCSS плагин для Tailwind',
          '    "@types/node": "^20",            // Node.js типы',
          '    "@types/react": "^19",           // React типы',
          '    "@types/react-dom": "^19",       // React DOM типы',
          '    "dotenv": "^17.3.1",            // Загрузка .env',
          '    "eslint": "^9",                  // Линтер',
          '    "eslint-config-next": "16.2.1", // ESLint конфиг для Next.js',
          '    "tailwindcss": "^4.2.2",        // CSS фреймворк',
          '    "tsx": "^4.21.0",               // TypeScript executor',
          '    "typescript": "^5"              // TypeScript компилятор',
          '  }',
          "}"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("2.4. NPM Scripts"),
        table(
          ["Команда", "Описание"],
          [
            ["bun run dev", "Запуск в режиме разработки (с Webpack)"],
            ["bun run build", "Production сборка (standalone)"],
            ["bun run start", "Запуск production сервера"],
            ["bun run lint", "Запуск ESLint проверки"]
          ]
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============================================================================
        // 3. PROJECT STRUCTURE
        // ============================================================================
        h1("3. Структура проекта"),

        h2("3.1. Корневая директория"),
        ...codeBlock([
          "my-project/",
          "├── app/                    # Next.js App Router",
          "├── components/             # React компоненты",
          "├── lib/                    # Библиотеки и сервисы",
          "├── prisma/                 # Prisma схема и миграции",
          "├── scripts/                # Скрипты импорта",
          "├── src/                    # Альтернативная структура",
          "├── db/                     # SQLite база данных",
          "├── public/                 # Статические файлы",
          "├── upload/                 # Файлы для импорта",
          "├── download/               # Сгенерированные файлы",
          "├── skills/                 # Навыки системы Z",
          "├── examples/               # Примеры кода",
          "├── node_modules/           # Зависимости",
          "├── .next/                  # Build cache",
          "├── package.json            # Конфигурация npm",
          "├── tsconfig.json           # Конфигурация TypeScript",
          "├── next.config.ts          # Конфигурация Next.js",
          "├── tailwind.config.ts      # Конфигурация Tailwind",
          "├── prisma.config.ts        # Конфигурация Prisma",
          "├── .env                    # Переменные окружения",
          "└── .gitignore              # Игнорируемые файлы"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("3.2. App Router (app/)"),
        p("Директория app/ содержит основной код приложения, организованный по принципам Next.js App Router. Каждая поддиректория представляет маршрут (route), а файлы page.tsx и route.ts определяют соответственно страницы и API endpoints."),
        ...codeBlock([
          "app/",
          "├── api/                    # REST API endpoints",
          "│   ├── import/            # POST /api/import — импорт Excel",
          "│   ├── network/           # GET /api/network — данные сети",
          "│   ├── layout/            # POST /api/layout — расчёт позиций",
          "│   ├── stats/             # GET /api/stats — статистика",
          "│   ├── validation/        # GET /api/validation — валидация",
          "│   ├── references/        # GET/POST /api/references — справочники",
          "│   ├── test/              # GET /api/test — тестовый endpoint",
          "│   └── test-db/           # GET /api/test-db — проверка БД",
          "├── test-g6/               # Тестовая страница для G6",
          "│   └── page.tsx",
          "├── page.tsx               # Главная страница приложения",
          "├── layout.tsx             # Root layout (html, body)",
          "├── globals.css            # Глобальные CSS стили",
          "└── favicon.ico           # Иконка сайта"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("3.3. Components (components/)"),
        p("React компоненты организованы в тематические поддиректории. Основные компоненты визуализации сети находятся в components/network/, а провайдеры контекста — в components/providers/."),
        ...codeBlock([
          "components/",
          "├── network/               # Компоненты визуализации",
          "│   ├── NetworkGraph.tsx         # Обёртка для графа",
          "│   └── NetworkGraphInner.tsx    # Основной компонент G6 (16KB)",
          "└── providers/             # React Context providers",
          "    └── ThemeProvider.tsx        # Тёмная/светлая тема"
        ]),
        new Paragraph({ spacing: { after: 100 }, children: [] }),

        h3("NetworkGraphInner.tsx — Ключевые характеристики:"),
        bullet("Визуализация графа с помощью AntV G6 v5"),
        bullet("Поддержка Web Worker для больших схем (порог: 300 узлов)"),
        bullet("Автоматический расчёт layout через dagre"),
        bullet("Интерактив: drag, zoom, collapse/expand"),
        bullet("Цветовое кодирование по типу и статусу элемента"),
        bullet("Оптимизация сериализации данных для Worker"),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("3.4. Library (lib/)"),
        p("Библиотечный код содержит Prisma client singleton и сервисы бизнес-логики. Сервисы реализуют ключевую функциональность: расчёт layout, распространение электрических состояний и логику АВР."),
        ...codeBlock([
          "lib/",
          "├── prisma.ts              # Prisma Client singleton",
          "└── services/              # Бизнес-логика",
          "    ├── avr.service.ts            # АВР (329 строк)",
          "    ├── layout.service.ts         # Расчёт layout (50 строк)",
          "    └── state-propagation.service.ts  # Распространение статусов (300 строк)"
        ]),
        new Paragraph({ spacing: { after: 100 }, children: [] }),

        h3("Сервисы:"),
        table(
          ["Файл", "Строк", "Назначение"],
          [
            ["avr.service.ts", "329", "Автоматический ввод резерва"],
            ["state-propagation.service.ts", "300", "BFS алгоритм распространения LIVE/DEAD"],
            ["layout.service.ts", "50", "Расчёт и сохранение позиций"]
          ]
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("3.5. Scripts (scripts/)"),
        p("Скрипты для импорта и обработки данных. Универсальный скрипт импорта поддерживает автоматическое определение формата Excel и импорт данных АВР."),
        ...codeBlock([
          "scripts/",
          "├── import-universal.ts    # Универсальный импорт (33KB)",
          "├── calculate-layout.ts   # Расчёт layout",
          "├── recalculate-layout.ts # Пересчёт layout",
          "├── propagate-states.ts   # Распространение статусов",
          "├── check-db.ts           # Проверка БД",
          "├── check-excel.ts        # Проверка Excel",
          "└── _archive/             # Архив старых скриптов",
          "    ├── import-data.ts",
          "    ├── import-echo-data.ts",
          "    └── import-network.ts"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("3.6. Prisma (prisma/)"),
        p("Схема базы данных и миграции Prisma. Полная схема включает 20+ моделей для представления элементов электросети, оборудования, справочников и логики АВР."),
        ...codeBlock([
          "prisma/",
          "├── schema.prisma         # Схема БД (20+ моделей)",
          "└── seed.ts               # Начальные данные"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============================================================================
        // 4. DATA MODELS
        // ============================================================================
        h1("4. Модели данных"),

        h2("4.1. Основные модели"),
        table(
          ["Модель", "Назначение", "Ключевые поля"],
          [
            ["Element", "Узел схемы", "elementId, name, type, parentId, posX, posY, electricalStatus, operationalStatus"],
            ["Connection", "Связь между узлами", "sourceId, targetId, cableId, electricalStatus, operationalStatus"],
            ["Device", "Устройство в шкафу", "deviceId, slotId, deviceType"],
            ["Breaker", "Автомат", "ratedCurrent, currentSetting, tripCount"],
            ["Load", "Нагрузка", "powerP, powerQ, cosPhi, category"],
            ["Meter", "Счётчик", "meterType, serialNumber, tariff"],
            ["Transformer", "Трансформатор", "power, primaryKV, secondaryKV"]
          ]
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("4.2. Модели АВР"),
        p("Модели для реализации автоматического ввода резерва. АВР — это контроллер, который мониторит состояние входных элементов и управляет выходными выключателями."),
        table(
          ["Модель", "Назначение"],
          [
            ["AVR", "Контроллер АВР (mode, status, switchoverDelay)"],
            ["AVRInput", "Вход АВР — мониторинг элемента (role, priority, signalType)"],
            ["AVROutput", "Выход АВР — управление элементом (actionOn, actionOff, isActive)"],
            ["AVRSwitchover", "История переключений (triggerReason, actions, timestamp)"]
          ]
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("4.3. Справочники"),
        table(
          ["Модель", "Назначение"],
          [
            ["CableReference", "Справочник кабелей (mark, section, iDop, r0, x0)"],
            ["BreakerReference", "Справочник автоматов (type, ratedCurrent, breakingCapacity)"],
            ["TransformerReference", "Справочник трансформаторов (type, power, ukz, pkz)"]
          ]
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("4.4. Статусы"),
        p("Система использует два типа статусов для элементов и связей, которые отражают физическое состояние электрической цепи:"),

        h3("ElectricalStatus (электрический статус)"),
        bullet("LIVE — на элементе есть напряжение"),
        bullet("DEAD — на элементе нет напряжения"),

        h3("OperationalStatus (оперативный статус)"),
        bullet("ON — элемент включен вручную"),
        bullet("OFF — элемент отключен вручную"),

        p("Важно: элемент может быть ON (включен), но DEAD (без напряжения). Статус OFF блокирует прохождение напряжения downstream."),

        // ============================================================================
        // 5. API REFERENCE
        // ============================================================================
        h1("5. API Reference"),

        h2("5.1. Network API"),
        table(
          ["Метод", "Endpoint", "Описание", "Параметры"],
          [
            ["GET", "/api/network", "Получить все элементы и связи", "—"],
            ["POST", "/api/import", "Импорт данных из Excel", "FormData с файлом"],
            ["POST", "/api/layout", "Рассчитать и сохранить позиции", "—"],
            ["GET", "/api/stats", "Статистика по сети", "—"],
            ["GET", "/api/validation", "Результаты валидации", "—"],
            ["GET", "/api/references", "Справочники оборудования", "—"],
            ["POST", "/api/references", "Добавить в справочник", "type, data"],
            ["GET", "/api/test-db", "Проверка подключения к БД", "—"]
          ]
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("5.2. Формат ответа /api/network"),
        ...codeBlock([
          "{",
          '  "elements": [',
          '    {',
          '      "id": "uuid",',
          '      "elementId": "QF1",',
          '      "name": "Автомат QF1",',
          '      "type": "breaker",',
          '      "posX": 100,',
          '      "posY": 200,',
          '      "parentId": "cabinet-uuid",',
          '      "electricalStatus": "LIVE",',
          '      "operationalStatus": "ON"',
          '    }',
          '  ],',
          '  "connections": [',
          '    {',
          '      "id": "uuid",',
          '      "sourceId": "element-uuid",',
          '      "targetId": "element-uuid",',
          '      "electricalStatus": "LIVE",',
          '      "operationalStatus": "ON"',
          '    }',
          '  ],',
          '  "cabinetBounds": [...]',
          "}"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============================================================================
        // 6. CONFIGURATION FILES
        // ============================================================================
        h1("6. Конфигурационные файлы"),

        h2("6.1. tsconfig.json"),
        p("Конфигурация TypeScript компилятора. Использует ES2017 target, строгий режим и плагин Next.js для оптимизации сборки."),
        ...codeBlock([
          "{",
          '  "compilerOptions": {',
          '    "target": "ES2017",',
          '    "lib": ["dom", "dom.iterable", "esnext"],',
          '    "strict": true,',
          '    "module": "esnext",',
          '    "moduleResolution": "bundler",',
          '    "jsx": "react-jsx",',
          '    "plugins": [{ "name": "next" }],',
          '    "paths": { "@/*": ["./*"] }',
          '  }',
          "}"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("6.2. next.config.ts"),
        p("Конфигурация Next.js фреймворка. Включает standalone-режим для создания автономного сервера и настройки Web Workers."),
        ...codeBlock([
          "import type { NextConfig } from 'next';",
          "",
          "const nextConfig: NextConfig = {",
          "  output: 'standalone',                    // Автономный сервер",
          "  allowedDevOrigins: [                    // CORS для preview",
          "    '.space.z.ai',",
          "    '.space.chatglm.site'",
          "  ],",
          "  experimental: {",
          "    serverActions: { allowedOrigins: ['*.space.z.ai'] }",
          "  },",
          "  webpack: (config, { isServer }) => {    // Web Workers для G6",
          "    if (!isServer) {",
          "      config.module.rules.push({",
          "        test: /worker\\.js$/,",
          "        type: 'asset/resource'",
          "      });",
          "    }",
          "    return config;",
          "  }",
          "};"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("6.3. tailwind.config.ts"),
        p("Конфигурация Tailwind CSS с поддержкой тёмной темы через class-стратегию."),
        ...codeBlock([
          "import type { Config } from 'tailwindcss';",
          "",
          "const config: Config = {",
          "  darkMode: 'class',",
          "  content: [",
          "    './pages/**/*.{js,ts,jsx,tsx}',",
          "    './components/**/*.{js,ts,jsx,tsx}',",
          "    './app/**/*.{js,ts,jsx,tsx}'",
          "  ],",
          "  theme: { extend: {} },",
          "  plugins: []",
          "};"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("6.4. .env"),
        p("Переменные окружения для конфигурации подключения к базе данных."),
        ...codeBlock([
          "DATABASE_URL=file:/home/z/my-project/db/custom.db"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("6.5. .gitignore"),
        p("Файлы, исключённые из Git-репозитория. Включает зависимости, сборку, логи и конфиденциальные данные."),
        ...codeBlock([
          "# Dependencies",
          "node_modules/",
          "",
          "# Build",
          ".next/",
          "out/",
          "",
          "# Environment",
          ".env*",
          "",
          "# Database (рекомендуется добавить)",
          "*.db",
          "*.db-journal",
          "",
          "# Logs",
          "*.log",
          "",
          "# IDE",
          ".idea/",
          ".vscode/"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============================================================================
        // 7. PUBLIC ASSETS
        // ============================================================================
        h1("7. Статические ресурсы (public/)"),

        h2("7.1. Изображения элементов"),
        table(
          ["Файл", "Размер", "Назначение"],
          [
            ["source.jpg", "3.8 KB", "Иконка источника питания"],
            ["breaker.jpg", "4.6 KB", "Иконка автоматического выключателя"],
            ["load.jpg", "3.3 KB", "Иконка нагрузки"],
            ["meter.jpg", "9.3 KB", "Иконка счётчика"],
            ["junction.jpg", "1.2 KB", "Иконка узла разветвления"]
          ]
        ),
        new Paragraph({ spacing: { after: 100 }, children: [] }),

        h2("7.2. Web Worker"),
        p("Файл worker.js (315 KB) содержит код Web Worker для расчёта layout в отдельном потоке. Используется AntV G6 для обработки больших графов без блокировки UI."),
        ...codeBlock([
          "public/",
          "├── worker.js              # Web Worker для G6 layout (315 KB)",
          "├── workers/               # Дополнительные worker-файлы",
          "├── logo.svg               # Логотип проекта",
          "└── robots.txt             # SEO конфигурация"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============================================================================
        // 8. TYPES
        // ============================================================================
        h1("8. TypeScript типы (types/)"),

        h2("8.1. Основные типы"),
        ...codeBlock([
          "// Электрический статус - есть ли напряжение",
          "export type ElectricalStatus = 'LIVE' | 'DEAD';",
          "",
          "// Оперативный статус - включен ли элемент",
          "export type OperationalStatus = 'ON' | 'OFF';",
          "",
          "// Типы элементов сети",
          "export type ElementType = ",
          "  | 'SOURCE'",
          "  | 'BREAKER'",
          "  | 'LOAD'",
          "  | 'METER'",
          "  | 'BUS'",
          "  | 'CABINET'",
          "  | 'JUNCTION';",
          "",
          "// Результат распространения статусов",
          "export interface PropagationResult {",
          "  elementsUpdated: number;",
          "  connectionsUpdated: number;",
          "  liveElements: number;",
          "  deadElements: number;",
          "  offElements: number;",
          "}"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============================================================================
        // 9. ALGORITHM DETAILS
        // ============================================================================
        h1("9. Ключевые алгоритмы"),

        h2("9.1. Распространение состояний (BFS)"),
        p("Алгоритм распространения электрических состояний реализован в state-propagation.service.ts. Использует BFS (Breadth-First Search) для обхода графа от источников питания downstream."),

        h3("Правила распространения:"),
        bullet("ON ≠ LIVE: элемент может быть включён, но без напряжения"),
        bullet("OFF → всегда DEAD и блокирует downstream"),
        bullet("LIVE через OFF не проходит"),
        bullet("Множественные входы: LIVE если хотя бы один вход от LIVE"),
        bullet("CABINET = агрегация детей (не участвует в BFS)"),
        new Paragraph({ spacing: { after: 100 }, children: [] }),

        h3("Порядок обработки:"),
        bullet("Этап 1: Обработка АВР (может менять operationalStatus)"),
        bullet("Этап 2: Инициализация (все элементы = DEAD)"),
        bullet("Этап 3: BFS от SOURCE элементов downstream"),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("9.2. Web Worker оптимизация"),
        p("Для схем с количеством узлов >= 300 используется Web Worker для расчёта layout. Это предотвращает блокировку UI при обработке больших графов."),

        ...codeBlock([
          "const WORKER_THRESHOLD = 300;",
          "const shouldUseWorker = nodes.length >= WORKER_THRESHOLD;",
          "",
          "// Данные должны быть сериализуемы для Worker",
          "data: {",
          "  shape: getNodeShape(e.type),",
          "  size: getNodeSize(e.type),",
          "  // ... предвычисленные свойства",
          "}"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============================================================================
        // 10. IMPORT FORMATS
        // ============================================================================
        h1("10. Форматы импорта данных"),

        h2("10.1. Стандартный формат Excel"),
        table(
          ["Колонка", "Обязательная", "Описание"],
          [
            ["from", "Да", "Имя исходного элемента"],
            ["to", "Да", "Имя целевого элемента"],
            ["state", "Нет", "Оперативный статус (on/off)"],
            ["connection", "Нет", "Тип соединения"],
            ["current", "Нет", "Ток (А)"],
            ["power", "Нет", "Мощность (кВт)"],
            ["parent", "Нет", "Родительский элемент"]
          ]
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("10.2. Формат ЭХО"),
        p("Формат ЭХО использует фиксированные позиции колонок и поддерживает дополнительные поля для АВР. Скрипт автоматически определяет формат по структуре файла."),

        h2("10.3. Автоопределение типа элемента"),
        p("Скрипт import-universal.ts автоматически определяет тип элемента по его имени с помощью набора регулярных выражений:"),
        bullet("SOURCE: Т1, Т2, ПЦ, ЦП, ДГУ, ИБП, Генератор"),
        bullet("BREAKER: QF1, QD, QS, FU"),
        bullet("METER: ПИ, ЩУ, Счётчик"),
        bullet("BUS: Ш1, ГРЩ, ВРУ, Сборка"),
        bullet("LOAD: по умолчанию для остальных"),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============================================================================
        // 11. SUMMARY
        // ============================================================================
        h1("11. Сводка"),

        h2("11.1. Статистика проекта"),
        table(
          ["Параметр", "Значение"],
          [
            ["Всего исходных файлов", "405+"],
            ["TypeScript файлов", "162"],
            ["API endpoints", "8"],
            ["Моделей данных", "20+"],
            ["Сервисов", "3"],
            ["React компонентов", "2 основных"],
            ["Строк кода (сервисы)", "679"],
            ["Размер БД", "~350 KB"]
          ]
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("11.2. Ключевые файлы"),
        table(
          ["Файл", "Размер", "Назначение"],
          [
            ["app/page.tsx", "35 KB", "Главная страница приложения"],
            ["components/network/NetworkGraphInner.tsx", "16 KB", "Визуализация графа G6"],
            ["scripts/import-universal.ts", "33 KB", "Универсальный импорт"],
            ["lib/services/state-propagation.service.ts", "12 KB", "Алгоритм BFS"],
            ["lib/services/avr.service.ts", "9 KB", "Логика АВР"],
            ["prisma/schema.prisma", "~8 KB", "Схема базы данных"]
          ]
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),
      ]
    }
  ]
});

// ============================================================================
// GENERATE
// ============================================================================
async function main() {
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync('/home/z/my-project/download/RVectrA_Architecture.docx', buffer);
  console.log('Architecture document generated: /home/z/my-project/download/RVectrA_Architecture.docx');
}

main().catch(console.error);

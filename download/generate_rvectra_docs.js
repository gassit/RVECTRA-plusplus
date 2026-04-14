const { Document, Packer, Paragraph, TextRun, Header, Footer, Table, TableRow, TableCell,
        AlignmentType, HeadingLevel, PageNumber, WidthType, BorderStyle, ShadingType,
        PageOrientation, LevelFormat } = require("docx");
const fs = require("fs");

// Palette - Tech Blue theme
const P = {
  primary: "#0A1628",
  body: "#1A2B40",
  secondary: "#6878A0",
  accent: "#5B8DB8",
  surface: "#F4F8FC"
};

const c = (hex) => hex.replace("#", "");

// Helper for heading
function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 400 : 280, after: 120 },
    children: [new TextRun({ text, bold: true, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" }, size: level === HeadingLevel.HEADING_1 ? 32 : 28 })]
  });
}

// Helper for body text
function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: 100 },
    children: [new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })]
  });
}

// Helper for code block
function codeBlock(lines) {
  return lines.map(line => new Paragraph({
    spacing: { line: 276, after: 0 },
    shading: { type: ShadingType.CLEAR, fill: "F5F5F5" },
    children: [new TextRun({ text: line, font: { ascii: "Consolas", eastAsia: "Consolas" }, size: 20, color: "333333" })]
  }));
}

// Table helper
function createTable(headers, rows) {
  const NB = { style: BorderStyle.SINGLE, size: 1, color: "D0D0D0" };
  const borders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
  
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    rows: [
      new TableRow({
        children: headers.map(h => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 22, color: "FFFFFF" })] })],
          shading: { type: ShadingType.CLEAR, fill: c(P.accent) },
          margins: { top: 60, bottom: 60, left: 120, right: 120 }
        }))
      }),
      ...rows.map(row => new TableRow({
        children: row.map(cell => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: cell, size: 21 })] })],
          margins: { top: 60, bottom: 60, left: 120, right: 120 }
        }))
      }))
    ]
  });
}

// Document content
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
    // Cover section
    {
      properties: {
        page: { margin: { top: 0, bottom: 0, left: 0, right: 0 } }
      },
      children: [
        new Paragraph({ spacing: { before: 4000 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: "RVectrA", bold: true, size: 72, color: c(P.accent), font: { ascii: "Calibri", eastAsia: "SimHei" } })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: "Цифровой двойник электрической сети", size: 36, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
          children: [new TextRun({ text: "PowerGrid Digital Twin", size: 28, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })]
        }),
        new Paragraph({ spacing: { before: 2000 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Техническая документация", size: 28, color: c(P.secondary) })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
          children: [new TextRun({ text: "Версия 1.0", size: 24, color: c(P.secondary) })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100 },
          children: [new TextRun({ text: "14 апреля 2026", size: 24, color: c(P.secondary) })]
        })
      ]
    },
    // Content section
    {
      properties: {
        page: { margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 } }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "RVectrA — Техническая документация", size: 18, color: c(P.secondary) })]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18 })]
          })]
        })
      },
      children: [
        // Table of Contents
        heading("Содержание", HeadingLevel.HEADING_1),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "1. Введение и обзор проекта", size: 24 })] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "2. Установка и запуск", size: 24 })] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "3. Архитектура проекта", size: 24 })] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "4. База данных (Prisma Schema)", size: 24 })] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "5. API маршруты", size: 24 })] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "6. Сервисы обработки данных", size: 24 })] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "7. Компоненты фронтенда", size: 24 })] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "8. Справочники и расчёты", size: 24 })] }),
        new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: "9. Типы данных", size: 24 })] }),

        // Section 1
        heading("1. Введение и обзор проекта", HeadingLevel.HEADING_1),
        body("RVectrA — это веб-приложение для создания цифрового двойника электрической сети. Система позволяет импортировать данные из Excel-файлов, визуализировать топологию сети, выполнять валидацию электрических параметров и отображать результаты в интерактивном графическом интерфейсе."),
        body("Проект разработан на современном технологическом стеке: Next.js 16 (React 19), Prisma 6 ORM с базой данных SQLite, Tailwind CSS 4 для стилизации и shadcn/ui для компонентов интерфейса. Визуализация графа сети реализована на чистом SVG без использования сторонних библиотек для максимальной производительности и гибкости."),
        
        heading("1.1. Ключевые возможности", HeadingLevel.HEADING_2),
        body("Импорт данных из Excel: система автоматически парсит листы Networkall, Источники, Шкафы, Нагрузки, Выключатели, Связи и создаёт соответствующие записи в базе данных. При отсутствии файла создаются демо-данные для тестирования."),
        body("Визуализация мнемосхемы: интерактивный SVG-граф с поддержкой масштабирования, панорамирования, поиска по названию и ID, подсветки проблемных элементов и детальной информацией при клике."),
        body("Валидация сети: автоматическая проверка соответствия токов выключателей и кабелей, потерь напряжения, чувствительности защиты и селективности защитных устройств."),
        body("Расчёт электрических параметров: вычисление сопротивлений кабелей, токов короткого замыкания и падений напряжения с использованием справочных данных."),

        // Section 2
        heading("2. Установка и запуск", HeadingLevel.HEADING_1),
        
        heading("2.1. Системные требования", HeadingLevel.HEADING_2),
        body("Node.js версии 18.x или выше, пакетный менеджер npm или bun, операционная система Linux, macOS или Windows. Для работы с базой данных SQLite никаких дополнительных настроек не требуется."),
        
        heading("2.2. Установка зависимостей", HeadingLevel.HEADING_2),
        ...codeBlock([
          "# Клонирование репозитория",
          "git clone <repository-url>",
          "cd network-digital-twin",
          "",
          "# Установка зависимостей",
          "bun install",
          "# или",
          "npm install",
          "",
          "# Инициализация базы данных",
          "bunx prisma generate",
          "bunx prisma db push"
        ]),

        heading("2.3. Запуск в режиме разработки", HeadingLevel.HEADING_2),
        ...codeBlock([
          "# Запуск сервера разработки",
          "bun run dev",
          "# или",
          "npm run dev",
          "",
          "# Приложение будет доступно по адресу:",
          "http://localhost:3000"
        ]),

        heading("2.4. Подготовка данных для импорта", HeadingLevel.HEADING_2),
        body("Для импорта реальных данных поместите Excel-файл input.xlsx в директорию /home/z/my-project/upload/. Файл должен содержать листы: Networkall (топология сети), Источники/Sources, Шкафы/Cabinets, Нагрузки/Loads, Выключатели/Breakers, Связи/Connections."),

        // Section 3
        heading("3. Архитектура проекта", HeadingLevel.HEADING_1),
        body("Проект следует стандартной структуре Next.js App Router с разделением на API routes (backend) и React компоненты (frontend). Основные директории проекта организованы следующим образом:"),

        heading("3.1. Структура директорий", HeadingLevel.HEADING_2),
        ...codeBlock([
          "src/",
          "├── app/                    # Next.js App Router",
          "│   ├── page.tsx           # Главная страница",
          "│   ├── layout.tsx         # Корневой layout",
          "│   ├── globals.css        # Глобальные стили",
          "│   └── api/               # API маршруты",
          "│       ├── network/       # Получение данных сети",
          "│       ├── import/        # Импорт из Excel",
          "│       ├── validation/    # Валидация сети",
          "│       ├── elements/      # CRUD элементов",
          "│       └── references/    # Справочные данные",
          "├── components/             # React компоненты",
          "│   ├── NetworkGraph.tsx   # Визуализация графа",
          "│   ├── ElementDetails.tsx # Панель деталей",
          "│   ├── ValidationPanel.tsx# Панель валидации",
          "│   └── ui/                # shadcn/ui компоненты",
          "├── lib/                    # Библиотеки и утилиты",
          "│   ├── db.ts              # Prisma client",
          "│   ├── services/          # Бизнес-логика",
          "│   ├── calculations/      # Электрические расчёты",
          "│   └── data/              # Справочные данные",
          "├── types/                  # TypeScript типы",
          "└── hooks/                  # React хуки",
          "",
          "prisma/",
          "├── schema.prisma          # Схема базы данных",
          "└── powergrid.db           # SQLite база данных"
        ]),

        heading("3.2. Технологический стек", HeadingLevel.HEADING_2),
        createTable(
          ["Компонент", "Технология", "Версия"],
          [
            ["Фреймворк", "Next.js", "16.1.1"],
            ["UI библиотека", "React", "19.0.0"],
            ["ORM", "Prisma", "6.11.1"],
            ["База данных", "SQLite", "—"],
            ["Стилизация", "Tailwind CSS", "4.x"],
            ["UI компоненты", "shadcn/ui", "—"],
            ["Парсинг Excel", "xlsx", "0.18.5"],
            ["Язык", "TypeScript", "5.x"]
          ]
        ),

        // Section 4
        heading("4. База данных (Prisma Schema)", HeadingLevel.HEADING_1),
        body("База данных построена на SQLite с использованием Prisma ORM. Схема отражает структуру электрической сети с поддержкой элементов, устройств, соединений, результатов валидации и справочных данных."),

        heading("4.1. Основные модели", HeadingLevel.HEADING_2),
        
        heading("Element — Элемент сети", HeadingLevel.HEADING_3),
        body("Основная сущность, представляющая элемент электрической сети. Каждый элемент имеет уникальный идентификатор, имя, тип (SOURCE, BUS, BREAKER, LOAD, METER, JUNCTION, CABINET), уровень напряжения и координаты для визуализации."),
        ...codeBlock([
          "model Element {",
          "  id          String   @id",
          "  elementId   String   @unique",
          "  name        String",
          "  type        String",
          "  parentId    String?",
          "  voltageLevel Float?",
          "  posX        Float?",
          "  posY        Float?",
          "  createdAt   DateTime @default(now())",
          "  updatedAt   DateTime",
          "}"
        ]),

        heading("Connection — Связь между элементами", HeadingLevel.HEADING_3),
        body("Представляет электрическое соединение между двумя элементами. Содержит информацию о типе соединения (CABLE, BUSBAR, JUMPER), параметрах кабеля (марка, сечение, длина) и расчётных значениях сопротивлений."),
        ...codeBlock([
          "model Connection {",
          "  id           String   @id",
          "  sourceId     String",
          "  targetId     String",
          "  cableId      String?",
          "  type         String   // CABLE, BUSBAR, JUMPER",
          "  length       Float?",
          "  wireType     String?  // Марка кабеля",
          "  wireSize     Float?   // Сечение мм²",
          "  resistanceR  Float?   // Активное сопротивление",
          "  reactanceX   Float?   // Реактивное сопротивление",
          "  impedanceZ   Float?   // Полное сопротивление",
          "}"
        ]),

        heading("Device — Устройство", HeadingLevel.HEADING_3),
        body("Устройство, установленное в элементе сети. Содержит тип устройства (SOURCE, BREAKER, LOAD, METER, TRANSFORMER), номинальные параметры и характеристики."),
        ...codeBlock([
          "model Device {",
          "  id          String   @id",
          "  type        String   // SOURCE, BREAKER, LOAD, METER",
          "  slotId      String   // ID элемента",
          "  model       String?  // Модель устройства",
          "  voltageNom  Float?   // Номинальное напряжение",
          "  currentNom  Float?   // Номинальный ток",
          "  pKw         Float?   // Активная мощность",
          "  qKvar       Float?   // Реактивная мощность",
          "  sKva        Float?   // Полная мощность",
          "  cosPhi      Float?   // Коэффициент мощности",
          "}"
        ]),

        heading("4.2. Модели справочников", HeadingLevel.HEADING_2),
        body("База данных включает справочные таблицы для кабелей (CableReference), выключателей (BreakerReference) и трансформаторов (TransformerReference). Эти данные используются для расчётов сопротивлений и выбора оборудования."),

        heading("4.3. Результаты валидации", HeadingLevel.HEADING_2),
        body("Модели ValidationRule и ValidationResult хранят правила проверки и их результаты. Каждое правило имеет код, название, категорию (PROTECTION, CABLE, SELECTIVITY, VOLTAGE) и критичность (LOW, MEDIUM, HIGH, CRITICAL)."),

        // Section 5
        heading("5. API маршруты", HeadingLevel.HEADING_1),
        body("API построен на Next.js Route Handlers и предоставляет REST-интерфейс для работы с данными сети. Все маршруты возвращают JSON-ответы."),

        heading("5.1. GET /api/network", HeadingLevel.HEADING_2),
        body("Возвращает полные данные графа сети для визуализации. Включает все элементы с устройствами и результатами валидации, а также все соединения между элементами. Формат ответа: { nodes: GraphNode[], edges: GraphEdge[] }."),
        ...codeBlock([
          "// Пример ответа",
          "{",
          "  \"nodes\": [",
          "    {",
          "      \"id\": \"SRC_TP21\",",
          "      \"type\": \"SOURCE\",",
          "      \"name\": \"ТП-21 Трансформатор 1\",",
          "      \"posX\": 100,",
          "      \"posY\": 100,",
          "      \"hasIssues\": false,",
          "      \"devices\": [...]",
          "    }",
          "  ],",
          "  \"edges\": [...]",
          "}"
        ]),

        heading("5.2. POST /api/import", HeadingLevel.HEADING_2),
        body("Запускает импорт данных из Excel-файла input.xlsx. Очищает существующие данные, парсит листы Excel, создаёт элементы, устройства и соединения, рассчитывает позиции для визуализации. Возвращает статистику импорта и список ошибок."),

        heading("5.3. GET/POST /api/validation", HeadingLevel.HEADING_2),
        body("GET возвращает список найденных проблем. POST запускает валидацию сети по всем правилам. Правила проверки включают: CABLE_001 (соответствие тока выключателя и кабеля), VOLTAGE_001 (потеря напряжения), PROT_001 (чувствительность защиты), SEL_001 (селективность защит)."),

        heading("5.4. GET /api/elements", HeadingLevel.HEADING_2),
        body("Возвращает список всех элементов сети. Поддерживает фильтрацию по типу и поиск по названию. Используется для выпадающих списков и автодополнения."),

        heading("5.5. GET /api/references", HeadingLevel.HEADING_2),
        body("Возвращает справочные данные: кабели, выключатели, трансформаторы. Данные используются при импорте для автоматического заполнения параметров кабелей и устройств."),

        // Section 6
        heading("6. Сервисы обработки данных", HeadingLevel.HEADING_1),

        heading("6.1. Import Service (import.service.ts)", HeadingLevel.HEADING_2),
        body("Главный сервис импорта данных из Excel. Выполняет следующие функции:"),
        body("importFromExcel() — основная функция импорта. Проверяет наличие файла, очищает базу данных, парсит листы Excel в порядке зависимостей, создаёт демо-данные если файл отсутствует."),
        body("importNetworkAll() — обрабатывает лист Networkall, извлекая элементы и связи из топологии. Автоматически определяет тип элемента по имени (detectElementType): источники (Т1, Т2, ПЦ, ДГУ), выключатели (QF, QS), шины (с.ш.), узлы учёта, точки распределения."),
        body("importSources/Cabinets/Loads/Breakers() — специализированные функции для импорта конкретных типов оборудования с заполнением специфических параметров."),
        body("calculateNodePositions() — вычисляет координаты узлов для визуализации, группируя элементы по типам и располагая их слева направо."),

        heading("6.2. Validation Service (validation.service.ts)", HeadingLevel.HEADING_2),
        body("Сервис валидации электрической сети по инженерным правилам. Реализует 4 основных правила:"),
        body("checkCableCapacity() — правило CABLE_001: проверяет что Iном.выкл ≤ Iдоп.кабеля. Если ток выключателя превышает допустимый ток кабеля, создаётся проблема уровня FAIL."),
        body("checkVoltageDrop() — правило VOLTAGE_001: проверяет что суммарная потеря напряжения от источника до нагрузки не превышает 4%. Использует путь от нагрузки до источника."),
        body("checkProtectionSensitivity() — правило PROT_001: проверяет что Iкз.конец ≥ 3 × Iном.выкл. Критически важное правило для обеспечения срабатывания защиты при коротком замыкании."),
        body("checkSelectivity() — правило SEL_001: проверяет что номинальный ток вводного выключателя больше тока отходящего для обеспечения селективности защит."),

        // Section 7
        heading("7. Компоненты фронтенда", HeadingLevel.HEADING_1),

        heading("7.1. NetworkGraph.tsx — Главная мнемосхема", HeadingLevel.HEADING_2),
        body("Ключевой компонент визуализации графа сети. Реализован на чистом SVG без сторонних библиотек для максимальной производительности. Поддерживает масштабирование (колесо мыши, слайдер), панорамирование (перетаскивание), поиск по названию/ID, подсветку при наведении, детальную информацию при клике."),
        body("Алгоритм лэйаута использует трёхуровневую иерархию: Top Level (источники до первой шины), Distribution Level (шины и распределительные устройства), Consumer Level (нагрузки). Элементы размещаются автоматически с учётом топологии сети."),

        heading("7.2. ElementDetails.tsx — Панель деталей", HeadingLevel.HEADING_2),
        body("Отображает детальную информацию о выбранном элементе или соединении. Показывает тип, название, ID, статусы (ON/OFF, LIVE/DEAD), электрические параметры (Iном, P, Q, S, cos φ), результаты валидации с рекомендациями. Для соединений выводит параметры кабеля, сопротивления и расчётные значения."),

        heading("7.3. ValidationPanel.tsx — Панель валидации", HeadingLevel.HEADING_2),
        body("Отображает список найденных проблем с группировкой по критичности. Поддерживает компактный режим (только счётчики) и развёрнутый режим (список проблем). Каждая проблема показывает код правила, название элемента, сообщение и рекомендацию."),

        heading("7.4. page.tsx — Главная страница", HeadingLevel.HEADING_2),
        body("Корневой компонент приложения. Содержит шапку с элементами управления, основную область с мнемосхемой, плавающие панели деталей и валидации. Управляет состоянием: данные графа, результаты валидации, выбранный элемент, масштаб, поисковый запрос."),

        // Section 8
        heading("8. Справочники и расчёты", HeadingLevel.HEADING_1),

        heading("8.1. Справочники (references.ts)", HeadingLevel.HEADING_2),
        body("Модуль содержит справочные данные для расчётов:"),
        body("CABLE_REFERENCES — массив данных о кабелях с полями: марка (wireType), сечение (wireSize), количество жил, материал, удельные сопротивления (rOhmKm, xOhmKm), допустимые токи (iAir, iGround)."),
        body("BREAKER_REFERENCES — справочник выключателей: производитель, модель, тип (MCB/MCCB/ACB), номинальные токи, полюсность, отключающая способность, характеристики расцепителя."),
        body("findCableReference(wireType, wireSize) — поиск данных кабеля по марке и сечению."),

        heading("8.2. Расчёт сопротивлений (impedance.ts)", HeadingLevel.HEADING_2),
        body("Функции для расчёта электрических параметров:"),
        body("calculateCableImpedance(length, wireSize, material, wireType) — расчёт R, X, Z кабеля. Использует удельное сопротивление меди (0.0175 Ом·мм²/м) или алюминия (0.0294 Ом·мм²/м)."),
        body("calculateCableImpedanceFromReference(length, wireType, wireSize) — расчёт с использованием справочных данных."),
        body("adjustResistanceForTemperature(r20, temperature) — корректировка сопротивления по температуре."),

        heading("8.3. Расчёт токов КЗ (shortCircuit.ts)", HeadingLevel.HEADING_2),
        body("calculateShortCircuit(zTransformer, zCable, voltage) — расчёт токов короткого замыкания. Возвращает: ik3 (трёхфазное КЗ), ik1 (однофазное КЗ), ik2 (двухфазное КЗ), zk (полное сопротивление до точки КЗ). Использует формулу: Iкз = U / (√3 × Z)."),

        heading("8.4. Расчёт падения напряжения (voltageDrop.ts)", HeadingLevel.HEADING_2),
        body("calculateVoltageDropByCurrent(current, r, x, cosPhi, voltage) — расчёт падения напряжения в процентах. Учитывает активную и реактивную составляющие сопротивления, коэффициент мощности нагрузки."),

        // Section 9
        heading("9. Типы данных", HeadingLevel.HEADING_1),
        body("Файл src/types/index.ts содержит все TypeScript типы проекта."),

        heading("9.1. Типы элементов", HeadingLevel.HEADING_2),
        ...codeBlock([
          "type ElementType = 'SOURCE' | 'CABINET' | 'LOAD' | 'BUS' | 'METER' | 'BREAKER' | 'JUNCTION';",
          "type DeviceType = 'SOURCE' | 'BREAKER' | 'LOAD' | 'METER' | 'ATS' | 'SWITCH' | 'TRANSFORMER';",
          "type ConnectionType = 'CABLE' | 'BUSBAR' | 'JUMPER';",
          "type ValidationStatus = 'PASS' | 'WARN' | 'FAIL' | 'CRITICAL';"
        ]),

        heading("9.2. Интерфейсы данных", HeadingLevel.HEADING_2),
        body("GraphNode — узел графа для визуализации: id, type, name, posX, posY, hasIssues, criticalIssues, devices, validationResults."),
        body("GraphEdge — ребро графа (соединение): id, source, target, type, length, wireType, wireSize, resistanceR, reactanceX, impedanceZ."),
        body("GraphData — полные данные графа: nodes (GraphNode[]), edges (GraphEdge[])."),
        body("ValidationIssue — проблема валидации: id, code, name, severity, elementName, message, recommendation, actualValue, expectedValue."),

        heading("9.3. Интерфейсы справочников", HeadingLevel.HEADING_2),
        body("CableReferenceData — данные кабеля: wireType, wireSize, core, material, rOhmKm, xOhmKm, iAir, iGround."),
        body("BreakerReferenceData — данные выключателя: manufacturer, model, type, inRatings, poles, voltage, breakingCapacity, trippingChars."),
        body("ImpedanceResult — результат расчёта сопротивления: r (активное), x (реактивное), z (полное)."),
        body("ShortCircuitResult — результат расчёта токов КЗ: ik3, ik1, ik2, zk."),

        // Conclusion
        heading("Заключение", HeadingLevel.HEADING_1),
        body("RVectrA представляет собой современное веб-приложение для моделирования и анализа электрических сетей. Архитектура на базе Next.js 16 с App Router обеспечивает высокую производительность и отличную масштабируемость. Использование Prisma ORM с SQLite упрощает разработку и позволяет легко перейти на другую базу данных при необходимости."),
        body("Ключевые преимущества системы: автоматический импорт данных из Excel, интеллектуальное определение типов оборудования, визуализация топологии сети с автоматическим лэйаутом, валидация по инженерным правилам, расчёт электрических параметров с использованием справочных данных."),
        body("Для расширения функциональности рекомендуется добавить: редактирование элементов и соединений через UI, экспорт результатов в отчёты, интеграцию с системами SCADA, поддержку динамических режимов работы сети, расчёт потерь мощности и баланса нагрузки.")
      ]
    }
  ]
});

// Generate document
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/home/z/my-project/download/RVectrA_Техническая_документация.docx", buffer);
  console.log("Document saved to /home/z/my-project/download/RVectrA_Техническая_документация.docx");
});

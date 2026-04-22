/**
 * ============================================================================
 * RVectrA Digital Twin — Project Documentation
 * ============================================================================
 * 
 * Документация по проекту цифровой двойники электросети
 * Включает: архитектуру, API, правила развертывания и запуска
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, HeadingLevel, AlignmentType, WidthType,
  BorderStyle, ShadingType, LevelFormat
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
            children: [new TextRun({ text: "RVectrA Digital Twin — Документация", size: 20, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })]
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
          children: [new TextRun({ text: "Техническая документация проекта", size: 28, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
          children: [new TextRun({ text: "Версия 1.0 | Апрель 2026", size: 22, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })]
        }),

        // ============================================================================
        // 1. OVERVIEW
        // ============================================================================
        h1("1. Обзор проекта"),
        
        h2("1.1. Назначение"),
        p("RVectrA Digital Twin — это веб-приложение для визуализации и управления цифровой двойником электросети. Система предоставляет интерактивный графический интерфейс для отображения拓扑 схемы электросети, мониторинга состояния оборудования и автоматического управления резервным питанием (АВР). Приложение разработано на современном технологическом стеке с использованием Next.js 16 и AntV G6 для визуализации графов."),
        
        p("Основная цель системы — предоставить инженерам и операторам интуитивно понятный инструмент для анализа структуры электросети, отслеживания состояния коммутационных аппаратов, мониторинга нагрузок и автоматизации переключений при потере основного питания. Система поддерживает импорт данных из Excel-файлов различных форматов и автоматически рассчитывает拓扑 связи между элементами сети."),

        h2("1.2. Ключевые возможности"),
        bullet("Интерактивная визуализация схемы электросети с навигацией и масштабированием"),
        bullet("Автоматический расчет топологического расположения элементов (dagre layout)"),
        bullet("Мониторинг электрического и оперативного состояния оборудования в реальном времени"),
        bullet("Поддержка иерархической структуры: подстанции → шкафы → устройства"),
        bullet("Автоматический ввод резерва (АВР) с настраиваемой логикой переключения"),
        bullet("Импорт данных из Excel (стандартный формат и формат ЭХО)"),
        bullet("Валидация схемы: координация автомат-кабель, падение напряжения, токи КЗ"),
        bullet("Темная и светлая темы оформления"),

        h2("1.3. Технологический стек"),
        table(
          ["Компонент", "Технология", "Версия"],
          [
            ["Frontend Framework", "Next.js", "16.1.1"],
            ["UI Library", "React", "19.0.0"],
            ["Graph Visualization", "AntV G6", "5.1.0"],
            ["Layout Algorithm", "Dagre", "0.8.5"],
            ["Database ORM", "Prisma", "6.11.1"],
            ["Database", "SQLite", "—"],
            ["Styling", "Tailwind CSS", "4.2.2"],
            ["Runtime", "Bun", "—"],
            ["Language", "TypeScript", "5.x"]
          ]
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============================================================================
        // 2. ARCHITECTURE
        // ============================================================================
        h1("2. Архитектура системы"),
        
        h2("2.1. Структура проекта"),
        p("Проект следует стандартной структуре Next.js App Router с модульной организацией компонентов. Основные директории проекта организованы следующим образом, обеспечивая разделение ответственности между презентационным слоем, бизнес-логикой и доступом к данным:"),

        ...codeBlock([
          "my-project/",
          "├── app/                    # Next.js App Router",
          "│   ├── api/              # API routes (REST endpoints)",
          "│   │   ├── import/       # Импорт данных из Excel",
          "│   │   ├── network/      # Получение данных сети",
          "│   │   ├── layout/       # Расчет позиций элементов",
          "│   │   ├── stats/        # Статистика сети",
          "│   │   ├── validation/   # Валидация схемы",
          "│   │   └── references/   # Справочники оборудования",
          "│   ├── page.tsx          # Главная страница",
          "│   ├── layout.tsx        # Root layout",
          "│   └── globals.css       # Глобальные стили",
          "├── components/",
          "│   ├── network/          # Компоненты визуализации сети",
          "│   └── providers/        # React Context providers",
          "├── lib/",
          "│   ├── prisma.ts         # Prisma client singleton",
          "│   └── services/         # Бизнес-логика",
          "│       ├── avr.service.ts            # Логика АВР",
          "│       ├── layout.service.ts         # Расчет layout",
          "│       └── state-propagation.service.ts # Распространение состояний",
          "├── prisma/",
          "│   └── schema.prisma     # Схема базы данных",
          "├── scripts/",
          "│   └── import-universal.ts # Универсальный скрипт импорта",
          "├── db/",
          "│   └── custom.db         # SQLite база данных",
          "├── upload/               # Файлы для импорта",
          "└── public/               # Статические файлы"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("2.2. Модели данных"),
        p("Система использует Prisma ORM для работы с базой данных SQLite. Схема данных включает модели для представления элементов электросети, связей между ними, оборудования и справочной информации. Ниже приведено описание основных моделей данных:"),

        h3("Element — Элемент сети"),
        p("Основная модель для представления узлов схемы. Содержит информацию о типе элемента (источник, шина, автомат, нагрузка и т.д.), иерархической принадлежности, координатах отображения и текущем состоянии. Каждый элемент имеет уникальный идентификатор elementId, который используется для связывания с другими сущностями."),

        h3("Connection — Связь между элементами"),
        p("Представляет электрическое соединение между двумя элементами. Содержит ссылку на кабель (если применимо), порядок подключения и текущее состояние связи. Поддерживает как электрический статус (LIVE/DEAD), так и оперативный статус (ON/OFF)."),

        h3("Device, Breaker, Load, Meter, Transformer"),
        p("Модели для представления оборудования, установленного в ячейках шкафов. Breaker — автоматический выключатель с уставками и счётчиком срабатываний. Load — нагрузка с мощностью и категорией надёжности. Meter — счётчик с показаниями. Transformer — трансформатор с параметрами мощности и напряжения."),

        h3("AVR, AVRInput, AVROutput, AVRSwitchover"),
        p("Модели для реализации автоматического ввода резерва. AVR представляет контроллер, который мониторит входные элементы (AVRInput) и управляет выходными выключателями (AVROutput). AVRSwitchover хранит историю переключений с детальной информацией о причинах и выполненных действиях."),

        h2("2.3. API Endpoints"),
        p("Система предоставляет REST API для взаимодействия с данными сети. Все эндпоинты возвращают данные в формате JSON и используют стандартные HTTP-методы для операций чтения и модификации данных:"),

        table(
          ["Метод", "Путь", "Описание"],
          [
            ["GET", "/api/network", "Получение всех элементов и связей"],
            ["POST", "/api/import", "Импорт данных из Excel"],
            ["POST", "/api/layout", "Расчет и сохранение позиций"],
            ["GET", "/api/stats", "Статистика по сети"],
            ["GET", "/api/validation", "Результаты валидации"],
            ["GET", "/api/references", "Справочники кабелей, автоматов"],
            ["POST", "/api/references", "Добавление в справочники"],
            ["GET", "/api/test-db", "Проверка подключения к БД"]
          ]
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============================================================================
        // 3. DEPLOYMENT
        // ============================================================================
        h1("3. Развертывание"),

        h2("3.1. Системные требования"),
        p("Для развертывания приложения необходимо обеспечить соответствие минимальным системным требованиям. Рекомендуется использовать современное серверное оборудование с достаточным объёмом оперативной памяти для обработки больших схем электросети:"),

        table(
          ["Параметр", "Минимум", "Рекомендуется"],
          [
            ["Node.js / Bun", "Bun 1.x", "Bun latest"],
            ["Оперативная память", "2 GB", "4 GB+"],
            ["Дисковое пространство", "500 MB", "1 GB+"],
            ["ОС", "Linux / macOS", "Ubuntu 22.04+"]
          ]
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("3.2. Установка зависимостей"),
        p("Перед запуском приложения необходимо установить все зависимости проекта. Рекомендуется использовать Bun как более быструю альтернативу npm, обеспечивающую значительное ускорение установки пакетов и запуска приложения:"),

        ...codeBlock([
          "# Клонирование репозитория",
          "git clone https://github.com/gassit/RVectrA-Digital-Twin.git",
          "cd RVectrA-Digital-Twin",
          "",
          "# Установка зависимостей (рекомендуется Bun)",
          "bun install",
          "",
          "# Альтернативно: npm",
          "npm install"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("3.3. Конфигурация окружения"),
        p("Приложение использует переменные окружения для конфигурации подключения к базе данных. Создайте файл .env в корневой директории проекта со следующими параметрами:"),

        ...codeBlock([
          "# .env",
          "DATABASE_URL=file:./db/custom.db"
        ]),
        new Paragraph({ spacing: { after: 100 }, children: [] }),

        p("Для production-окружения рекомендуется использовать абсолютный путь к файлу базы данных, чтобы избежать проблем с относительными путями при запуске из различных директорий:"),

        ...codeBlock([
          "# Production .env",
          "DATABASE_URL=file:/var/lib/rvectra/custom.db"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("3.4. Инициализация базы данных"),
        p("После настройки переменных окружения необходимо применить миграции Prisma для создания структуры базы данных. Если база данных не существует, она будет создана автоматически:"),

        ...codeBlock([
          "# Генерация Prisma Client",
          "bunx prisma generate",
          "",
          "# Применение миграций",
          "bunx prisma migrate dev",
          "",
          "# При отсутствии миграций: создать базу по схеме",
          "bunx prisma db push"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("3.5. Сборка для production"),
        p("Next.js поддерживает standalone-режим сборки, который создает автономный исполняемый пакет без необходимости установки зависимостей на целевом сервере. Конфигурация next.config.ts уже содержит необходимые настройки для standalone-режима:"),

        ...codeBlock([
          "# Сборка production-версии",
          "bun run build",
          "",
          "# Результат сборки",
          "# .next/standalone/ — автономный сервер",
          "# .next/static/ — статические файлы"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============================================================================
        // 4. RUNNING
        // ============================================================================
        h1("4. Запуск приложения"),

        h2("4.1. Режим разработки"),
        p("Для локальной разработки и отладки используйте режим development. В этом режиме включена горячая перезагрузка при изменении файлов, подробные сообщения об ошибках и отладочная информация:"),

        ...codeBlock([
          "# Запуск в режиме разработки",
          "bun run dev",
          "",
          "# С явным указанием порта",
          "bun run dev -- -p 3001",
          "",
          "# С увеличенным лимитом памяти для больших схем",
          "NODE_OPTIONS=\"--max-old-space-size=4096\" bun run dev"
        ]),
        new Paragraph({ spacing: { after: 100 }, children: [] }),

        p("Приложение будет доступно по адресу http://localhost:3000. Изменения в коде автоматически применяются без перезапуска сервера, что ускоряет итерации разработки."),

        h2("4.2. Production-режим"),
        p("Для запуска в production-режиме используйте предварительно собранную версию. Production-режим обеспечивает максимальную производительность за счёт оптимизации и кэширования:"),

        ...codeBlock([
          "# Запуск через Next.js (требуется сборка)",
          "bun run start",
          "",
          "# Запуск standalone-версии",
          "node .next/standalone/server.js",
          "",
          "# С указанием порта и хоста",
          "PORT=8080 HOSTNAME=0.0.0.0 bun run start"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("4.3. Скрипты запуска"),
        p("Проект включает вспомогательные скрипты для упрощения запуска в различных окружениях. Скрипты автоматически настраивают переменные окружения и параметры запуска:"),

        table(
          ["Файл", "Назначение"],
          [
            ["start.sh", "Запуск в режиме разработки с увеличенным лимитом памяти"],
            ["start-server.sh", "Запуск production-сервера через npm"]
          ]
        ),
        new Paragraph({ spacing: { after: 100 }, children: [] }),

        ...codeBlock([
          "# Содержимое start.sh",
          "#!/bin/bash",
          "cd /home/z/my-project",
          "export NODE_OPTIONS=\"--max-old-space-size=4096\"",
          "exec node node_modules/.bin/next dev --webpack"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("4.4. Импорт данных"),
        p("Для загрузки данных в базу используйте универсальный скрипт импорта. Скрипт поддерживает автоматическое определение формата Excel-файла (стандартный или формат ЭХО):"),

        ...codeBlock([
          "# Поместите Excel-файл в папку upload/",
          "cp my_network.xlsx upload/input.xlsx",
          "",
          "# Запуск импорта",
          "bun run scripts/import-universal.ts",
          "",
          "# Результат: элементы и связи загружены в БД",
          "# Позиции рассчитываются автоматически на frontend"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============================================================================
        // 5. CONFIGURATION
        // ============================================================================
        h1("5. Конфигурация"),

        h2("5.1. Next.js Configuration"),
        p("Файл next.config.ts содержит настройки сборки и runtime-параметры приложения. Основные параметры включают standalone-режим для создания автономного сервера, настройку CORS для preview-доменов и конфигурацию Web Workers для AntV G6:"),

        ...codeBlock([
          "import type { NextConfig } from \"next\";",
          "",
          "const nextConfig: NextConfig = {",
          "  output: 'standalone',",
          "  allowedDevOrigins: [",
          "    '.space.z.ai',",
          "    '.space.chatglm.site',",
          "  ],",
          "  experimental: {",
          "    serverActions: {",
          "      allowedOrigins: ['*.space.z.ai', '*.space.chatglm.site'],",
          "    },",
          "  },",
          "  webpack: (config, { isServer }) => {",
          "    // Web Workers для AntV G6 layout",
          "    if (!isServer) {",
          "      config.module.rules.push({",
          "        test: /worker\\.js$/,",
          "        type: 'asset/resource',",
          "      });",
          "    }",
          "    return config;",
          "  },",
          "};",
          "",
          "export default nextConfig;"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("5.2. Порог активации Web Worker"),
        p("Для оптимизации производительности при работе с большими схемами используется порог активации Web Worker для расчёта layout. При количестве узлов менее 300 расчёт выполняется в основном потоке, что обеспечивает отзывчивость интерфейса для небольших схем:"),

        ...codeBlock([
          "// NetworkGraphInner.tsx",
          "const WORKER_THRESHOLD = 300;",
          "const shouldUseWorker = nodes.length >= WORKER_THRESHOLD;",
          "",
          "// Для работы с Web Worker данные должны быть сериализуемы",
          "// Функции и сложные объекты не передаются"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("5.3. Переменные окружения"),
        p("Полный список переменных окружения, используемых приложением. Большинство параметров имеют значения по умолчанию и не требуют обязательной настройки:"),

        table(
          ["Переменная", "По умолчанию", "Описание"],
          [
            ["DATABASE_URL", "file:./db/custom.db", "Путь к SQLite базе данных"],
            ["NODE_OPTIONS", "—", "Флаги Node.js (память и т.д.)"],
            ["PORT", "3000", "Порт сервера"],
            ["HOSTNAME", "localhost", "Хост сервера"]
          ]
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============================================================================
        // 6. SECURITY
        // ============================================================================
        h1("6. Безопасность"),

        h2("6.1. Рекомендации по безопасности"),
        p("При развертывании в production-окружении рекомендуется следовать следующим практикам безопасности для защиты данных электросети и предотвращения несанкционированного доступа:"),

        bullet("Добавьте файлы базы данных (*.db) в .gitignore для исключения из репозитория"),
        bullet("Не коммитьте файл .env с реальными credentials"),
        bullet("Используйте HTTPS для шифрования трафика"),
        bullet("Настройте firewall для ограничения доступа к порту приложения"),
        bullet("Регулярно создавайте резервные копии базы данных"),

        h2("6.2. Рекомендуемый .gitignore"),
        p("Для защиты чувствительных данных добавьте следующие записи в файл .gitignore проекта:"),

        ...codeBlock([
          "# Database files — содержат данные электросети",
          "*.db",
          "*.db-journal",
          "db/",
          "",
          "# Environment variables",
          ".env",
          ".env.local",
          ".env.*.local",
          "",
          "# Logs",
          "*.log",
          "",
          "# Build artifacts",
          ".next/",
          "node_modules/"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("6.3. Удаление БД из git-истории"),
        p("Если база данных уже была добавлена в репозиторий, выполните следующие команды для удаления её из отслеживания при сохранении локальной копии:"),

        ...codeBlock([
          "# Добавить в .gitignore",
          "echo \"*.db\" >> .gitignore",
          "",
          "# Удалить из отслеживания",
          "git rm --cached db/custom.db",
          "",
          "# Зафиксировать изменения",
          "git commit -m \"Remove database from git tracking\"",
          "",
          "# Для полного удаления из истории используйте BFG или git filter-branch"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============================================================================
        // 7. TROUBLESHOOTING
        // ============================================================================
        h1("7. Устранение неполадок"),

        h2("7.1. Частые проблемы"),
        
        h3("Ошибка подключения к базе данных"),
        p("Если приложение не может подключиться к базе данных, проверьте корректность пути в переменной DATABASE_URL. Убедитесь, что файл базы данных существует и доступен для чтения/записи процессом сервера. Для отладки используйте эндпоинт /api/test-db для проверки соединения."),

        h3("Пустой граф после импорта"),
        p("Если после импорта данных граф не отображается, проверьте формат Excel-файла. Скрипт импорта ожидает колонки 'from' и 'to' для связей. Убедитесь, что импорт прошёл без ошибок, проверив вывод скрипта. При необходимости используйте эндпоинт /api/network для проверки загруженных данных."),

        h3("Медленный расчёт layout"),
        p("Для больших схем (более 300 узлов) расчёт layout может занимать значительное время. Web Worker активируется автоматически для таких схем. Если производительность недостаточна, рассмотрите возможность предварительного расчёта позиций и сохранения их в базе данных."),

        h3("Ошибки Web Worker"),
        p("Web Worker не может сериализовать функции и сложные объекты. При возникновении ошибок postMessage убедитесь, что данные узлов содержат только примитивные значения. В текущей реализации используется предвычисление свойств узлов для обеспечения сериализуемости."),

        h2("7.2. Диагностические команды"),
        p("Следующие команды помогут диагностировать проблемы с приложением:"),

        ...codeBlock([
          "# Проверка структуры БД",
          "bunx prisma studio",
          "",
          "# Проверка подключения к БД",
          "curl http://localhost:3000/api/test-db",
          "",
          "# Проверка данных сети",
          "curl http://localhost:3000/api/network | jq '.elements | length'",
          "",
          "# Просмотр логов",
          "bun run dev 2>&1 | tee debug.log"
        ]),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============================================================================
        // 8. APPENDIX
        // ============================================================================
        h1("8. Приложение"),

        h2("8.1. Типы элементов сети"),
        table(
          ["Тип", "Описание", "Примеры"],
          [
            ["source", "Источник питания", "Т1, ПЦ, ДГУ, ИБП"],
            ["bus", "Шина/сборка", "Ш1, ГРЩ, ВРУ"],
            ["breaker", "Коммутационный аппарат", "QF1, QS2, FU3"],
            ["load", "Нагрузка", "Розетки, освещение"],
            ["meter", "Счётчик", "ПИ1, ЩУ"],
            ["transformer", "Трансформатор", "Т1, ТМ-630"],
            ["junction", "Узел разветвления", "—"],
            ["avr", "АВР контроллер", "АВР ГРЩ1"],
            ["cabinet", "Шкаф/щит", "ЩР1, ВРУ-2"]
          ]
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        h2("8.2. Формат Excel для импорта"),
        p("Скрипт импорта поддерживает два основных формата Excel-файлов. Стандартный формат использует именованные колонки с гибким расположением. Формат ЭХО использует фиксированные позиции колонок и поддерживает дополнительные поля для АВР."),

        h3("Стандартный формат"),
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

        h2("8.3. Полезные ссылки"),
        bullet("Next.js Documentation: https://nextjs.org/docs"),
        bullet("AntV G6 Documentation: https://g6.antv.antgroup.com/"),
        bullet("Prisma Documentation: https://www.prisma.io/docs"),
        bullet("Dagre Layout: https://github.com/dagrejs/dagre"),
        bullet("Tailwind CSS: https://tailwindcss.com/docs"),
      ]
    }
  ]
});

// ============================================================================
// GENERATE
// ============================================================================
async function main() {
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync('/home/z/my-project/download/RVectrA_Documentation.docx', buffer);
  console.log('Documentation generated: /home/z/my-project/download/RVectrA_Documentation.docx');
}

main().catch(console.error);

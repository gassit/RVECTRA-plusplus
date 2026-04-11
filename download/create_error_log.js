const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
        AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, 
        VerticalAlign, Header, Footer, PageNumber, LevelFormat } = require('docx');
const fs = require('fs');

// Color scheme - Midnight Code
const colors = {
  primary: "#020617",
  body: "#1E293B",
  secondary: "#64748B",
  accent: "#94A3B8",
  tableBg: "#F8FAFC",
  error: "#DC2626",
  warning: "#F59E0B",
  success: "#10B981"
};

const tableBorder = { style: BorderStyle.SINGLE, size: 1, color: colors.accent };
const cellBorders = { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder };

const doc = new Document({
  styles: {
    default: { document: { run: { font: "SimSun", size: 24 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal",
        run: { size: 48, bold: true, color: colors.primary, font: "SimHei" },
        paragraph: { spacing: { before: 240, after: 120 }, alignment: AlignmentType.CENTER } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, color: colors.primary, font: "SimHei" },
        paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, color: colors.body, font: "SimHei" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } }
    ]
  },
  numbering: {
    config: [
      { reference: "bullet-list",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }
    ]
  },
  sections: [{
    properties: {
      page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
    },
    headers: {
      default: new Header({ children: [new Paragraph({ 
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "RVectrA - Журнал ошибок", color: colors.secondary, size: 20 })]
      })] })
    },
    footers: {
      default: new Footer({ children: [new Paragraph({ 
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "Страница ", size: 20 }), 
          new TextRun({ children: [PageNumber.CURRENT], size: 20 }), 
          new TextRun({ text: " из ", size: 20 }), 
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 20 })
        ]
      })] })
    },
    children: [
      // Title
      new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("Журнал ошибок проекта")] }),
      new Paragraph({ 
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: "RVectrA — Цифровой двойник электросети", color: colors.secondary, size: 24 })]
      }),
      
      // Project info
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Информация о проекте")] }),
      new Paragraph({ indent: { firstLine: 480 }, spacing: { after: 100 }, children: [
        new TextRun({ text: "Технологии: ", bold: true }),
        new TextRun("Next.js 16, React 19, Prisma 6, AntV G6 v5")
      ]}),
      new Paragraph({ indent: { firstLine: 480 }, spacing: { after: 100 }, children: [
        new TextRun({ text: "База данных: ", bold: true }),
        new TextRun("SQLite (194 элемента, 202 соединения)")
      ]}),
      new Paragraph({ indent: { firstLine: 480 }, spacing: { after: 200 }, children: [
        new TextRun({ text: "Дата создания журнала: ", bold: true }),
        new TextRun("11.04.2026")
      ]}),
      
      // Errors section
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Обнаруженные ошибки")] }),
      
      // Error 1
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Ошибка #1: Отсутствует пакет @antv/g6")] }),
      new Table({
        columnWidths: [2500, 6860],
        margins: { top: 100, bottom: 100, left: 180, right: 180 },
        rows: [
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "Статус", bold: true })] })] }),
            new TableCell({ borders: cellBorders, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "✓ Исправлено", color: colors.success })] })] })
          ]}),
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "Описание", bold: true })] })] }),
            new TableCell({ borders: cellBorders, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun("Библиотека @antv/g6 для визуализации графов не была установлена в проекте. Это приводило к ошибкам импорта и неработоспособности компонента NetworkGraph.")] })] })
          ]}),
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "Решение", bold: true })] })] }),
            new TableCell({ borders: cellBorders, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun("Выполнена установка пакета: bun add @antv/g6")] })] })
          ]})
        ]
      }),
      new Paragraph({ spacing: { after: 200 }, children: [] }),
      
      // Error 2
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Ошибка #2: Несоответствие путей к базе данных")] }),
      new Table({
        columnWidths: [2500, 6860],
        margins: { top: 100, bottom: 100, left: 180, right: 180 },
        rows: [
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "Статус", bold: true })] })] }),
            new TableCell({ borders: cellBorders, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "⚠ Требует внимания", color: colors.warning })] })] })
          ]}),
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "Описание", bold: true })] })] }),
            new TableCell({ borders: cellBorders, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun("Файл .env указывает на db/custom.db, а schema.prisma использует powergrid.db. Это может приводить к путанице и ошибкам при работе с базой данных.")] })] })
          ]}),
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "Решение", bold: true })] })] }),
            new TableCell({ borders: cellBorders, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun("Синхронизировать пути в .env и schema.prisma для использования единой базы данных.")] })] })
          ]})
        ]
      }),
      new Paragraph({ spacing: { after: 200 }, children: [] }),
      
      // Error 3
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Ошибка #3: Нестабильная работа сервера")] }),
      new Table({
        columnWidths: [2500, 6860],
        margins: { top: 100, bottom: 100, left: 180, right: 180 },
        rows: [
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "Статус", bold: true })] })] }),
            new TableCell({ borders: cellBorders, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "⚠ В процессе", color: colors.warning })] })] })
          ]}),
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "Описание", bold: true })] })] }),
            new TableCell({ borders: cellBorders, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun("Сервер разработки Next.js периодически останавливается без видимых причин. Требуется частый перезапуск для продолжения работы.")] })] })
          ]}),
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "Решение", bold: true })] })] }),
            new TableCell({ borders: cellBorders, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun("Требуется анализ логов и проверка системных ресурсов. Возможно, проблема связана с автозапуском dev-сервера в среде.")] })] })
          ]})
        ]
      }),
      new Paragraph({ spacing: { after: 200 }, children: [] }),
      
      // Error 4
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Ошибка #4: Данные не загружаются в мнемосхему")] }),
      new Table({
        columnWidths: [2500, 6860],
        margins: { top: 100, bottom: 100, left: 180, right: 180 },
        rows: [
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "Статус", bold: true })] })] }),
            new TableCell({ borders: cellBorders, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "✗ Не исправлено", color: colors.error })] })] })
          ]}),
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "Описание", bold: true })] })] }),
            new TableCell({ borders: cellBorders, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun("Компонент NetworkGraph отображает «Загрузка данных сети...» бесконечно. API /api/network возвращает корректные данные (194 элемента, 202 соединения), но фронтенд не получает или не обрабатывает их.")] })] })
          ]}),
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "Решение", bold: true })] })] }),
            new TableCell({ borders: cellBorders, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun("Проверить логику загрузки данных в NetworkGraph, проверить формат ответа API, проверить консоль браузера на наличие ошибок.")] })] })
          ]})
        ]
      }),
      new Paragraph({ spacing: { after: 200 }, children: [] }),
      
      // Error 5
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Ошибка #5: Ошибки линтинга в старых файлах")] }),
      new Table({
        columnWidths: [2500, 6860],
        margins: { top: 100, bottom: 100, left: 180, right: 180 },
        rows: [
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "Статус", bold: true })] })] }),
            new TableCell({ borders: cellBorders, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "✓ Исправлено", color: colors.success })] })] })
          ]}),
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "Описание", bold: true })] })] }),
            new TableCell({ borders: cellBorders, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun("В тестовых файлах присутствовали ошибки линтинга (неиспользуемые переменные, проблемы с типами). Страница test-g6 была удалена как неиспользуемая.")] })] })
          ]}),
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: "Решение", bold: true })] })] }),
            new TableCell({ borders: cellBorders, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun("Удалена страница test-g6, исправлены основные ошибки линтинга.")] })] })
          ]})
        ]
      }),
      new Paragraph({ spacing: { after: 300 }, children: [] }),
      
      // Summary section
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Сводка")] }),
      new Paragraph({ indent: { firstLine: 480 }, spacing: { after: 100 }, children: [
        new TextRun("По результатам анализа выявлено 5 ошибок, из которых:")
      ]}),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [
        new TextRun({ text: "Исправлено: ", bold: true }),
        new TextRun("2 ошибки (#1, #5)")
      ]}),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [
        new TextRun({ text: "Требуют внимания: ", bold: true }),
        new TextRun("2 ошибки (#2, #3)")
      ]}),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [
        new TextRun({ text: "Не исправлено: ", bold: true }),
        new TextRun("1 ошибка (#4) — критическая для работы приложения")
      ]}),
      new Paragraph({ spacing: { after: 200 }, children: [] }),
      new Paragraph({ indent: { firstLine: 480 }, children: [
        new TextRun({ text: "Приоритет: ", bold: true }),
        new TextRun("Ошибка #4 является наиболее критичной, так как блокирует основной функционал приложения — визуализацию электросети. Требуется немедленное вмешательство для восстановления работоспособности мнемосхемы.")
      ]})
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/home/z/my-project/download/RVectrA_Журнал_ошибок.docx", buffer);
  console.log("Document created: /home/z/my-project/download/RVectrA_Журнал_ошибок.docx");
});

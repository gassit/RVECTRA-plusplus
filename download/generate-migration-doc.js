const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  TableOfContents, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageBreak, PageNumber
} = require("docx");

// "Midnight Code" palette
const C = {
  primary: "020617",
  body: "1E293B",
  secondary: "64748B",
  accent: "94A3B8",
  tableBg: "F8FAFC",
  tableHeader: "E2E8F0",
  white: "FFFFFF",
  codeBg: "F1F5F9",
  warnBg: "FEF3C7",
  errBg: "FEE2E2",
  okBg: "DCFCE7",
};

const border = { style: BorderStyle.SINGLE, size: 1, color: C.accent };
const cellB = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0 };
const noCellB = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

const bodyFont = "Microsoft YaHei";
const headFont = "SimHei";
const codeFont = "SarasaMonoSC";

function body(text, opts = {}) {
  return new TextRun({ text, font: bodyFont, size: 21, color: C.body, ...opts });
}

function bold(text, opts = {}) {
  return body(text, { bold: true, ...opts });
}

function code(text) {
  return new TextRun({ text, font: codeFont, size: 19, color: "334155" });
}

function codeBlock(lines) {
  return lines.map(line =>
    new Paragraph({
      spacing: { before: 0, after: 0, line: 240 },
      indent: { left: 360 },
      children: [code(line)],
      shading: { fill: C.codeBg, type: ShadingType.CLEAR },
    })
  );
}

function bodyPara(texts, opts = {}) {
  const children = typeof texts === "string" ? [body(texts)] : texts;
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 250 },
    alignment: AlignmentType.LEFT,
    indent: { firstLine: 420 },
    ...opts,
    children,
  });
}

function spacer(h = 100) {
  return new Paragraph({ spacing: { before: h, after: 0 }, children: [] });
}

// Numbering configs
const numConfigs = [];
let numIdx = 0;
function makeNumRef(prefix) {
  const ref = `${prefix}-${numIdx++}`;
  numConfigs.push({
    reference: ref,
    levels: [{
      level: 0, format: LevelFormat.DECIMAL, text: "%1.",
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } }
    }]
  });
  return ref;
}

function makeBulletRef(prefix) {
  const ref = `${prefix}-${numIdx++}`;
  numConfigs.push({
    reference: ref,
    levels: [{
      level: 0, format: LevelFormat.BULLET, text: "\u2022",
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } }
    }]
  });
  return ref;
}

// Pre-create all numbering refs
const numOverview = makeNumRef("ov");
const numPrereq = makeNumRef("pr");
const bulletPrereq = makeBulletRef("prb");
const numStep1 = makeNumRef("s1");
const bulletS1 = makeBulletRef("s1b");
const numStep2 = makeNumRef("s2");
const bulletS2 = makeBulletRef("s2b");
const numStep3 = makeNumRef("s3");
const bulletS3 = makeBulletRef("s3b");
const numStep4 = makeNumRef("s4");
const numStep5 = makeNumRef("s5");
const bulletS5 = makeBulletRef("s5b");
const numStep6 = makeNumRef("s6");
const bulletS6 = makeBulletRef("s6b");
const numStep7 = makeNumRef("s7");
const bulletS7 = makeBulletRef("s7b");
const numStep8 = makeNumRef("s8");
const bulletS8 = makeBulletRef("s8b");
const numStep9 = makeNumRef("s9");
const bulletS9 = makeBulletRef("s9b");
const numStep10 = makeNumRef("s10");
const bulletS10 = makeBulletRef("s10b");
const numTroubleshooting = makeNumRef("ts");
const bulletTS = makeBulletRef("tsb");
const numChecklist = makeNumRef("cl");

function stepHeader(num, title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 200 },
    children: [
      new TextRun({ text: `\u0428\u0430\u0433 ${num}. `, font: headFont, size: 28, bold: true, color: C.primary }),
      new TextRun({ text: title, font: headFont, size: 28, bold: true, color: C.primary }),
    ],
  });
}

function stepPara(texts) {
  const children = typeof texts === "string" ? [body(texts)] : texts;
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 250 },
    indent: { firstLine: 420 },
    children,
  });
}

function warnBox(title, text) {
  return new Table({
    columnWidths: [9000],
    margins: { top: 80, bottom: 80, left: 180, right: 180 },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: cellB,
            shading: { fill: C.warnBg, type: ShadingType.CLEAR },
            width: { size: 9000, type: WidthType.DXA },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 40 },
                children: [bold(title, { color: "92400E" })],
              }),
              new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [body(text, { color: "78350F" })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function errBox(title, text) {
  return new Table({
    columnWidths: [9000],
    margins: { top: 80, bottom: 80, left: 180, right: 180 },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: cellB,
            shading: { fill: C.errBg, type: ShadingType.CLEAR },
            width: { size: 9000, type: WidthType.DXA },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 40 },
                children: [bold(title, { color: "991B1B" })],
              }),
              new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [body(text, { color: "7F1D1D" })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function okBox(title, text) {
  return new Table({
    columnWidths: [9000],
    margins: { top: 80, bottom: 80, left: 180, right: 180 },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: cellB,
            shading: { fill: C.okBg, type: ShadingType.CLEAR },
            width: { size: 9000, type: WidthType.DXA },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 40 },
                children: [bold(title, { color: "166534" })],
              }),
              new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [body(text, { color: "14532D" })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function numItem(ref, text) {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { before: 60, after: 60, line: 250 },
    children: [body(text)],
  });
}

function bulletItem(ref, text) {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { before: 40, after: 40, line: 250 },
    children: [body(text)],
  });
}

// Build sections
const coverSection = {
  properties: {
    page: {
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      size: { width: 11906, height: 16838 },
    },
    titlePage: true,
  },
  children: [
    spacer(4000),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: "\u041c\u0418\u0413\u0420\u0410\u0426\u0418\u042f", font: headFont, size: 72, bold: true, color: C.primary }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({ text: "Cytoscape.js  \u2192  AntV G6", font: headFont, size: 56, bold: true, color: C.secondary }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: "Network Digital Twin", font: bodyFont, size: 32, color: C.accent }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({ text: "Next.js 16 + React 19 + Prisma 7 + LibSQL + TypeScript", font: bodyFont, size: 24, color: C.accent }),
      ],
    }),
    spacer(2000),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        body("\u041f\u043e\u0448\u0430\u0433\u043e\u0432\u0430\u044f \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0446\u0438\u044f \u0434\u043b\u044f AI-\u0430\u0433\u0435\u043d\u0442\u043e\u0432", { color: C.secondary, size: 22 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100 },
      children: [
        body("\u0410\u043f\u0440\u0435\u043b\u044c 2026", { color: C.secondary, size: 22 }),
      ],
    }),
  ],
};

const tocSection = {
  properties: {
    page: {
      margin: { top: 1800, bottom: 1440, left: 1440, right: 1440 },
    },
  },
  headers: {
    default: new Header({
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [body("\u041c\u0438\u0433\u0440\u0430\u0446\u0438\u044f Cytoscape.js \u2192 AntV G6", { color: C.accent, size: 18 })],
        }),
      ],
    }),
  },
  footers: {
    default: new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            body("\u2014 ", { color: C.accent, size: 18 }),
            new TextRun({ children: [PageNumber.CURRENT], font: bodyFont, size: 18, color: C.accent }),
            body(" \u2014", { color: C.accent, size: 18 }),
          ],
        }),
      ],
    }),
  },
  children: [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 300 },
      children: [
        new TextRun({ text: "\u0421\u043e\u0434\u0435\u0440\u0436\u0430\u043d\u0438\u0435", font: headFont, size: 36, bold: true, color: C.primary }),
      ],
    }),
    new TableOfContents("\u0421\u043e\u0434\u0435\u0440\u0436\u0430\u043d\u0438\u0435", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [
        body("\u041f\u0440\u0438\u043c\u0435\u0447\u0430\u043d\u0438\u0435: \u0434\u043b\u044f \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u043e\u0433\u043e \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f \u043d\u043e\u043c\u0435\u0440\u043e\u0432 \u0441\u0442\u0440\u0430\u043d\u0438\u0446, \u043d\u0430\u0436\u043c\u0438\u0442\u0435 \u043f\u0440\u0430\u0432\u043e\u0439 \u043a\u043d\u043e\u043f\u043a\u043e\u0439 \u043d\u0430 \u043e\u0433\u043b\u0430\u0432\u043b\u0435\u043d\u0438\u0438 \u0438 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u00ab\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u043f\u043e\u043b\u0435\u00bb.", { color: "999999", size: 18 }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ],
};

// Main content
const mainChildren = [];

// ============ 1. Overview ============
mainChildren.push(
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 300 },
    children: [
      new TextRun({ text: "1. \u041e\u0431\u0437\u043e\u0440 \u043c\u0438\u0433\u0440\u0430\u0446\u0438\u0438", font: headFont, size: 32, bold: true, color: C.primary }),
    ],
  }),
  stepPara([
    body("\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442 \u0441\u043e\u0434\u0435\u0440\u0436\u0438\u0442 "),
    bold("\u043f\u043e\u043b\u043d\u044b\u0439 \u043f\u043e\u0448\u0430\u0433\u043e\u0432\u044b\u0439 \u043f\u043b\u0430\u043d \u043c\u0438\u0433\u0440\u0430\u0446\u0438\u0438"),
    body(" \u0433\u0440\u0430\u0444\u043e\u0432\u043e\u0439 \u0431\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0438 \u0438\u0437 Cytoscape.js \u0432 AntV G6 v5 \u0434\u043b\u044f \u043f\u0440\u043e\u0435\u043a\u0442\u0430 Network Digital Twin. \u041a\u0430\u0436\u0434\u044b\u0439 \u0448\u0430\u0433 \u0441\u043e\u0434\u0435\u0440\u0436\u0438\u0442 \u043a\u043e\u043d\u043a\u0440\u0435\u0442\u043d\u044b\u0435 \u043a\u043e\u043c\u0430\u043d\u0434\u044b, \u0444\u0430\u0439\u043b\u044b \u0434\u043b\u044f \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f, \u043a\u043e\u0434 \u0438 \u0440\u0435\u0448\u0435\u043d\u0438\u044f \u0432\u0441\u0442\u0440\u0435\u0447\u0430\u044e\u0449\u0438\u0445\u0441\u044f \u043f\u0440\u043e\u0431\u043b\u0435\u043c. \u0418\u043d\u0441\u0442\u0440\u0443\u043a\u0446\u0438\u044f \u0440\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u043d\u0430 \u043d\u0430 "),
    bold("\u043f\u043e\u0432\u0442\u043e\u0440\u043d\u043e\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435 AI-\u0430\u0433\u0435\u043d\u0442\u043e\u043c"),
    body(" \u0441 \u043d\u0443\u043b\u044f."),
  ]),
  stepPara("\u041f\u0440\u0438\u0447\u0438\u043d\u0430 \u043c\u0438\u0433\u0440\u0430\u0446\u0438\u0438: Cytoscape.js \u043e\u0431\u0440\u0435\u0437\u0430\u043b \u0433\u0440\u0430\u0444 \u2014 \u043d\u0435 \u0432\u0441\u0435 \u0443\u0437\u043b\u044b \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u043b\u0438\u0441\u044c \u043d\u0430 \u044d\u043a\u0440\u0430\u043d\u0435, \u043d\u0435\u0441\u043c\u043e\u0442\u0440\u044f \u043d\u0430 fitView \u0438 boundingBox. G6 v5 \u043e\u0431\u0435\u0441\u043f\u0435\u0447\u0438\u0432\u0430\u0435\u0442 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 autoFit, \u0432\u0441\u0442\u0440\u043e\u0435\u043d\u043d\u044b\u0439 drag-n-drop \u0438 Canvas-\u0440\u0435\u043d\u0434\u0435\u0440\u0438\u043d\u0433."),
  spacer(100),
  stepPara([
    bold("\u0421\u0442\u0435\u043a \u0442\u0435\u0445\u043d\u043e\u043b\u043e\u0433\u0438\u0439 \u043f\u0440\u043e\u0435\u043a\u0442\u0430:"),
  ]),
);

// Tech stack table
mainChildren.push(
  new Table({
    columnWidths: [3500, 5500],
    margins: { top: 80, bottom: 80, left: 180, right: 180 },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            borders: cellB, shading: { fill: C.tableHeader, type: ShadingType.CLEAR },
            width: { size: 3500, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold("\u041a\u043e\u043c\u043f\u043e\u043d\u0435\u043d\u0442", { color: C.primary })] })],
          }),
          new TableCell({
            borders: cellB, shading: { fill: C.tableHeader, type: ShadingType.CLEAR },
            width: { size: 5500, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold("\u0412\u0435\u0440\u0441\u0438\u044f", { color: C.primary })] })],
          }),
        ],
      }),
      ...([
        ["Next.js", "16.2.1"],
        ["React", "19.2.4"],
        ["TypeScript", "5.x"],
        ["Tailwind CSS", "4.x"],
        ["Prisma", "7.6.0"],
        ["LibSQL", "@libsql/client 0.17.2"],
        ["AntV G6", "5.1.0 (\u043c\u0438\u0433\u0440\u0430\u0446\u0438\u044f)"],
        ["xlsx", "0.18.5"],
      ]).map(([k, v]) =>
        new TableRow({
          children: [
            new TableCell({
              borders: cellB, width: { size: 3500, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [body(k)] })],
            }),
            new TableCell({
              borders: cellB, width: { size: 5500, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [code(v)] })],
            }),
          ],
        })
      ),
    ],
  }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 200 }, children: [body("\u0422\u0430\u0431\u043b\u0438\u0446\u0430 1. \u0421\u0442\u0435\u043a \u0442\u0435\u0445\u043d\u043e\u043b\u043e\u0433\u0438\u0439 \u043f\u0440\u043e\u0435\u043a\u0442\u0430", { color: C.secondary, size: 18 })] }),
  spacer(100),
);

// ============ 2. Pre-conditions ============
mainChildren.push(
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 300 },
    children: [
      new TextRun({ text: "2. \u041f\u0440\u0435\u0434\u0432\u0430\u0440\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0443\u0441\u043b\u043e\u0432\u0438\u044f", font: headFont, size: 32, bold: true, color: C.primary }),
    ],
  }),
  stepPara("\u041f\u0435\u0440\u0435\u0434 \u043d\u0430\u0447\u0430\u043b\u043e\u043c \u043c\u0438\u0433\u0440\u0430\u0446\u0438\u0438 \u0443\u0431\u0435\u0434\u0438\u0442\u0435\u0441\u044c, \u0447\u0442\u043e \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u044b \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0435 \u0443\u0441\u043b\u043e\u0432\u0438\u044f. \u041e\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u0445\u043e\u0442\u044f \u0431\u044b \u043e\u0434\u043d\u043e\u0433\u043e \u0438\u0437 \u043d\u0438\u0445 \u043f\u0440\u0438\u0432\u0435\u0434\u0451\u0442 \u043a \u043e\u0448\u0438\u0431\u043a\u0430\u043c \u043d\u0430 \u043f\u043e\u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0445 \u044d\u0442\u0430\u043f\u0430\u0445:"),
  numItem(numPrereq, "\u0420\u0430\u0431\u043e\u0447\u0430\u044f \u0434\u0438\u0440\u0435\u043a\u0442\u043e\u0440\u0438\u044f \u043f\u0440\u043e\u0435\u043a\u0442\u0430 \u2014 /home/z/my-project/network-digital-twin/"),
  numItem(numPrereq, "\u0411\u0430\u0437\u0430 \u0434\u0430\u043d\u043d\u044b\u0445 \u0438\u043d\u0438\u0446\u0438\u0430\u043b\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u043d\u0430 (\u0444\u0430\u0439\u043b /home/z/my-project/db/custom.db \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442)"),
  numItem(numPrereq, "\u0414\u0430\u043d\u043d\u044b\u0435 \u0438\u043c\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u044b (194 \u044d\u043b\u0435\u043c\u0435\u043d\u0442\u0430, 202 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f)"),
  numItem(numPrereq, "\u0423\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0430 Prisma CLI v7.6.0 (\u043d\u0435 v6!) \u0432 node_modules \u043f\u0440\u043e\u0435\u043a\u0442\u0430"),
  numItem(numPrereq, "Prisma \u043a\u043b\u0438\u0435\u043d\u0442 \u0441\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u043d (prisma generate)"),
  numItem(numPrereq, "\u0424\u0430\u0439\u043b prisma.config.ts \u0441\u043e\u0437\u0434\u0430\u043d \u0438 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d"),
  spacer(100),
  warnBox(
    "\u041a\u0420\u0418\u0422\u0418\u0427\u0415\u0421\u041a\u041e\u0415 \u043f\u0440\u0430\u0432\u0438\u043b\u043e \u0440\u0430\u0431\u043e\u0447\u0435\u0439 \u0434\u0438\u0440\u0435\u043a\u0442\u043e\u0440\u0438\u0438",
    "\u0412\u0441\u0435 \u043a\u043e\u043c\u0430\u043d\u0434\u044b \u0434\u043e\u043b\u0436\u043d\u044b \u0432\u044b\u043f\u043e\u043b\u043d\u044f\u0442\u044c\u0441\u044f \u0438\u043c\u0435\u043d\u043d\u043e \u0438\u0437 \u043a\u043e\u0440\u043d\u044f \u043f\u0440\u043e\u0435\u043a\u0442\u0430: cd /home/z/my-project/network-digital-twin. \u0420\u043e\u0434\u0438\u0442\u0435\u043b\u044c\u0441\u043a\u0430\u044f \u0434\u0438\u0440\u0435\u043a\u0442\u043e\u0440\u0438\u044f /home/z/my-project/ \u0441\u043e\u0434\u0435\u0440\u0436\u0438\u0442 \u0441\u0432\u043e\u0439 prisma/schema.prisma \u0438 package.json, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u043f\u0435\u0440\u0435\u0445\u0432\u0430\u0442\u044b\u0432\u0430\u044e\u0442 \u043a\u043e\u043c\u0430\u043d\u0434\u044b. \u041d\u0438\u043a\u043e\u0433\u0434\u0430 \u043d\u0435 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 npm run \u0432 \u0440\u043e\u0434\u0438\u0442\u0435\u043b\u044c\u0441\u043a\u043e\u0439 \u0434\u0438\u0440\u0435\u043a\u0442\u043e\u0440\u0438\u0438. \u0412\u043c\u0435\u0441\u0442\u043e npm run build \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 npx next build."
  ),
  spacer(100),
  stepPara([
    bold("\u0424\u0430\u0439\u043b\u044b, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u043d\u0443\u0436\u043d\u043e \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u043f\u0440\u0438 \u043c\u0438\u0433\u0440\u0430\u0446\u0438\u0438:"),
  ]),
);

// Files table
mainChildren.push(
  new Table({
    columnWidths: [4000, 2500, 2500],
    margins: { top: 80, bottom: 80, left: 180, right: 180 },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        tableHeader: true,
        children: ["\u0424\u0430\u0439\u043b", "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435", "\u041e\u0431\u044a\u0451\u043c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439"].map(h =>
          new TableCell({
            borders: cellB, shading: { fill: C.tableHeader, type: ShadingType.CLEAR },
            width: { size: h === "\u0424\u0430\u0439\u043b" ? 4000 : 2500, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(h, { color: C.primary })] })],
          })
        ),
      }),
      ...([
        ["package.json", "\u0417\u0430\u043c\u0435\u043d\u0430 \u0437\u0430\u0432\u0438\u0441\u0438\u043c\u043e\u0441\u0442\u0435\u0439", "\u041c\u0430\u043b\u044b\u0439"],
        ["components/network/NetworkGraph.tsx", "\u041f\u043e\u043b\u043d\u0430\u044f \u043f\u0435\u0440\u0435\u043f\u0438\u0441\u043a\u0430", "\u041f\u043e\u043b\u043d\u044b\u0439"],
        ["app/globals.css", "\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u044f", "\u041c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0439"],
        ["prisma/schema.prisma", "\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 url \u0438\u0437 datasource", "\u041c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0439"],
        ["prisma.config.ts", "\u0421\u043e\u0437\u0434\u0430\u043d\u0438\u0435 \u043d\u043e\u0432\u043e\u0433\u043e \u0444\u0430\u0439\u043b\u0430", "\u041d\u043e\u0432\u044b\u0439 \u0444\u0430\u0439\u043b"],
        ["lib/prisma.ts", "\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 \u043a\u043b\u0438\u0435\u043d\u0442\u0430", "\u0421\u0440\u0435\u0434\u043d\u0438\u0439"],
        ["next.config.ts", "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430 standalone", "\u0421\u0440\u0435\u0434\u043d\u0438\u0439"],
      ]).map(([f, a, s]) =>
        new TableRow({
          children: [
            new TableCell({
              borders: cellB, width: { size: 4000, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [code(f)] })],
            }),
            new TableCell({
              borders: cellB, width: { size: 2500, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [body(a)] })],
            }),
            new TableCell({
              borders: cellB, width: { size: 2500, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [body(s)] })],
            }),
          ],
        })
      ),
    ],
  }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 200 }, children: [body("\u0422\u0430\u0431\u043b\u0438\u0446\u0430 2. \u0421\u043f\u0438\u0441\u043e\u043a \u0444\u0430\u0439\u043b\u043e\u0432 \u0434\u043b\u044f \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f", { color: C.secondary, size: 18 })] }),
);

// ============ STEP 1 ============
mainChildren.push(
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 300 },
    children: [
      new TextRun({ text: "3. \u041f\u043e\u0448\u0430\u0433\u043e\u0432\u0430\u044f \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0446\u0438\u044f", font: headFont, size: 32, bold: true, color: C.primary }),
    ],
  }),
  stepHeader(1, "\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 Cytoscape.js"),
  stepPara("\u041f\u0435\u0440\u0432\u044b\u043c \u0448\u0430\u0433\u043e\u043c \u0443\u0434\u0430\u043b\u0438\u0442\u0435 \u0441\u0442\u0430\u0440\u0443\u044e \u0431\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0443 Cytoscape.js \u0438 \u0435\u0451 \u0442\u0438\u043f\u044b \u0438\u0437 \u043f\u0440\u043e\u0435\u043a\u0442\u0430. \u042d\u0442\u043e \u043e\u0447\u0438\u0441\u0442\u0438\u0442 \u043f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u0441\u0442\u0432\u043e \u0438\u043c\u0451\u043d \u0438 \u0438\u0437\u0431\u0430\u0432\u0438\u0442 \u043e\u0442 \u043a\u043e\u043d\u0444\u043b\u0438\u043a\u0442\u043e\u0432 \u0441 \u043d\u043e\u0432\u043e\u0439 \u0431\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u043e\u0439 G6."),
  ...codeBlock([
    "cd /home/z/my-project/network-digital-twin",
    "npm uninstall cytoscape @types/cytoscape",
  ]),
  spacer(100),
  stepPara([bold("\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430: "), body("\u0432 package.json \u043d\u0435 \u0434\u043e\u043b\u0436\u043d\u043e \u043e\u0441\u0442\u0430\u0442\u044c\u0441\u044f \u0443\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0439 cytoscape \u0432 dependencies \u0438\u043b\u0438 devDependencies.")]),
  spacer(50),
);

// ============ STEP 2 ============
mainChildren.push(
  stepHeader(2, "\u0423\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430 AntV G6 v5"),
  stepPara("\u0423\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u0435 \u0431\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0443 @antv/g6 \u0432\u0435\u0440\u0441\u0438\u0438 5.x. \u041e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e \u0443\u043a\u0430\u0436\u0438\u0442\u0435 --prefix, \u0447\u0442\u043e\u0431\u044b \u043f\u0430\u043a\u0435\u0442 \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u043b\u0441\u044f \u0432 \u043a\u043e\u0440\u043d\u0435\u0432\u043e\u0439 node_modules \u043f\u0440\u043e\u0435\u043a\u0442\u0430, \u0430 \u043d\u0435 \u0432 \u0440\u043e\u0434\u0438\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0439."),
  ...codeBlock([
    "cd /home/z/my-project/network-digital-twin",
    "npm install @antv/g6@^5.1.0 --prefix .",
  ]),
  spacer(100),
  stepPara([bold("\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430: "), body("\u0432 package.json \u043f\u043e\u044f\u0432\u0438\u0442\u0441\u044f ") , code('"@antv/g6": "^5.1.0"'), body(" \u0432 dependencies.")]),
  spacer(50),
  warnBox(
    "\u041e\u0448\u0438\u0431\u043a\u0430: \u043f\u0430\u043a\u0435\u0442 \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u043b\u0441\u044f \u0432 \u0440\u043e\u0434\u0438\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0439 node_modules",
    "\u0415\u0441\u043b\u0438 \u043f\u0430\u043a\u0435\u0442 \u043f\u043e\u044f\u0432\u0438\u043b\u0441\u044f \u0432 /home/z/my-project/node_modules/ \u0432\u043c\u0435\u0441\u0442\u043e /home/z/my-project/network-digital-twin/node_modules/ \u2014 \u0432\u044b \u043d\u0430\u0445\u043e\u0434\u0438\u0442\u0435\u0441\u044c \u043d\u0435 \u0432 \u0442\u043e\u0439 \u0434\u0438\u0440\u0435\u043a\u0442\u043e\u0440\u0438\u0438. \u0412\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u0435 cd /home/z/my-project/network-digital-twin \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435."
  ),
  spacer(50),
);

// ============ STEP 3 ============
mainChildren.push(
  stepHeader(3, "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430 Prisma v7 (prisma.config.ts)"),
  stepPara("Prisma v7 \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440 url \u0432 datasource \u0431\u043b\u043e\u043a\u0435 schema.prisma. \u0412\u043c\u0435\u0441\u0442\u043e \u044d\u0442\u043e\u0433\u043e \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442\u0441\u044f \u0444\u0430\u0439\u043b prisma.config.ts \u0432 \u043a\u043e\u0440\u043d\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u0430. \u042d\u0442\u043e \u043a\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u0440\u0430\u0437\u043d\u0438\u0446\u0430 \u043c\u0435\u0436\u0434\u0443 Prisma v6 \u0438 v7."),
  spacer(60),
  stepPara([bold("\u0428\u0430\u0433 3.1. \u0423\u0434\u0430\u043b\u0438\u0442\u0435 url \u0438\u0437 prisma/schema.prisma:")]),
  stepPara("\u0412 \u0444\u0430\u0439\u043b\u0435 prisma/schema.prisma \u043d\u0430\u0439\u0434\u0438\u0442\u0435 \u0431\u043b\u043e\u043a datasource \u0438 \u0443\u0434\u0430\u043b\u0438\u0442\u0435 \u0441\u0442\u0440\u043e\u043a\u0443 url. \u0424\u0438\u043d\u0430\u043b\u044c\u043d\u044b\u0439 \u0432\u0438\u0434 datasource \u0431\u043b\u043e\u043a\u0430:"),
  ...codeBlock([
    "datasource db {",
    "  provider = \"sqlite\"",
    "}",
  ]),
  spacer(60),
  stepPara([bold("\u0428\u0430\u0433 3.2. \u0421\u043e\u0437\u0434\u0430\u0439\u0442\u0435 prisma.config.ts \u0432 \u043a\u043e\u0440\u043d\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u0430:")]),
  ...codeBlock([
    "// \u0424\u0430\u0439\u043b: /home/z/my-project/network-digital-twin/prisma.config.ts",
    "import { defineConfig } from \"prisma/config\";",
    "",
    "export default defineConfig({",
    "  schema: \"prisma/schema.prisma\",",
    "  datasource: {",
    "    url: \"file:/home/z/my-project/db/custom.db\",",
    "  },",
    "});",
  ]),
  spacer(60),
  stepPara([bold("\u0428\u0430\u0433 3.3. \u041e\u0431\u043d\u043e\u0432\u0438\u0442\u0435 lib/prisma.ts:")]),
  stepPara("\u041a\u043b\u0438\u0435\u043d\u0442 Prisma \u0434\u043e\u043b\u0436\u0435\u043d \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u044c PrismaLibSql \u0430\u0434\u0430\u043f\u0442\u0435\u0440 \u0438 \u0431\u044b\u0442\u044c \u0441\u0438\u043d\u0433\u043b\u0442\u043e\u043d\u043e\u043c \u0447\u0435\u0440\u0435\u0437 globalThis:"),
  ...codeBlock([
    "// \u0424\u0430\u0439\u043b: /home/z/my-project/network-digital-twin/lib/prisma.ts",
    "import { PrismaClient } from '@prisma/client';",
    "import { PrismaLibSql } from '@prisma/adapter-libsql';",
    "",
    "const globalForPrisma = globalThis as unknown as {",
    "  prisma: PrismaClient | undefined;",
    "};",
    "",
    "function createPrismaClient() {",
    "  const dbUrl = process.env.DATABASE_URL || 'file:/home/z/my-project/db/custom.db';",
    "  const adapter = new PrismaLibSql({ url: dbUrl });",
    "  return new PrismaClient({ adapter });",
    "}",
    "",
    "export const prisma = globalForPrisma.prisma ?? createPrismaClient();",
    "if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;",
  ]),
  spacer(60),
  stepPara([bold("\u0428\u0430\u0433 3.4. \u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 Prisma \u0432\u0435\u0440\u0441\u0438\u0438:")]),
  stepPara("\u0423\u0431\u0435\u0434\u0438\u0442\u0435\u0441\u044c, \u0447\u0442\u043e Prisma CLI v7 \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0430 \u0438\u043c\u0435\u043d\u043d\u043e \u0432 \u043f\u0440\u043e\u0435\u043a\u0442\u0435. \u0420\u043e\u0434\u0438\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0439 \u043f\u0440\u043e\u0435\u043a\u0442 \u043c\u043e\u0436\u0435\u0442 \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u0442\u044c Prisma v6, \u0447\u0442\u043e \u043f\u0440\u0438\u0432\u0435\u0434\u0451\u0442 \u043a \u043e\u0448\u0438\u0431\u043a\u0435 \u0432\u0435\u0440\u0441\u0438\u0438:"),
  ...codeBlock([
    "cd /home/z/my-project/network-digital-twin",
    "npm install prisma@7.6.0 --prefix .",
    "npx prisma --version",
    "# \u041e\u0436\u0438\u0434\u0430\u0435\u043c\u044b\u0439 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442: prisma 7.6.0",
  ]),
  spacer(60),
  errBox(
    "\u041e\u0448\u0438\u0431\u043a\u0430 \u0432\u0435\u0440\u0441\u0438\u0438 Prisma Client",
    "\u0415\u0441\u043b\u0438 \u0432\u044b \u0432\u0438\u0434\u0438\u0442\u0435 \u043e\u0448\u0438\u0431\u043a\u0443 \u043e \u043d\u0435\u0441\u043e\u0432\u043c\u0435\u0441\u0442\u0438\u043c\u043e\u0441\u0442\u0438 Prisma Client \u0432\u0435\u0440\u0441\u0438\u0439 \u2014 \u044d\u0442\u043e \u0437\u043d\u0430\u0447\u0438\u0442, \u0447\u0442\u043e node_modules/@prisma/client \u0441\u043e\u0434\u0435\u0440\u0436\u0438\u0442 v6 \u0438\u0437 \u0440\u043e\u0434\u0438\u0442\u0435\u043b\u044c\u0441\u043a\u043e\u0433\u043e \u043f\u0440\u043e\u0435\u043a\u0442\u0430. \u0412\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u0435: npm install prisma@7.6.0 @prisma/client@7.6.0 --prefix /home/z/my-project/network-digital-twin"
  ),
  spacer(50),
);

// ============ STEP 4 ============
mainChildren.push(
  stepHeader(4, "\u0418\u043d\u0438\u0446\u0438\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u044f \u0431\u0430\u0437\u044b \u0434\u0430\u043d\u043d\u044b\u0445"),
  stepPara("\u0415\u0441\u043b\u0438 \u0431\u0430\u0437\u0430 \u0434\u0430\u043d\u043d\u044b\u0445 \u0435\u0449\u0451 \u043d\u0435 \u0441\u043e\u0437\u0434\u0430\u043d\u0430, \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0435 \u043a\u043e\u043c\u0430\u043d\u0434\u044b. \u041e\u043d\u0438 \u0441\u043e\u0437\u0434\u0430\u0434\u0443\u0442 \u0444\u0430\u0439\u043b custom.db, \u043d\u0430\u043b\u043e\u0436\u0430\u0442 \u0441\u0445\u0435\u043c\u0443 \u0438 \u0437\u0430\u0433\u0440\u0443\u0437\u044f\u0442 \u0441\u043f\u0440\u0430\u0432\u043e\u0447\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435:"),
  ...codeBlock([
    "cd /home/z/my-project/network-digital-twin",
    "npx prisma generate",
    "npx prisma db push",
    "# \u0411\u0430\u0437\u0430 \u0434\u0430\u043d\u043d\u044b\u0445 \u0441\u043e\u0437\u0434\u0430\u0441\u0442\u0441\u044f \u043f\u043e \u043f\u0443\u0442\u0438 \u0438\u0437 prisma.config.ts",
    "# \u0422\u043e \u0435\u0441\u0442\u044c: /home/z/my-project/db/custom.db",
    "",
    "# \u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u0441\u043f\u0440\u0430\u0432\u043e\u0447\u043d\u044b\u0445 \u0434\u0430\u043d\u043d\u044b\u0445 (\u0435\u0441\u043b\u0438 \u0435\u0441\u0442\u044c seed):",
    "npx prisma db seed",
  ]),
  spacer(60),
  stepPara("\u0415\u0441\u043b\u0438 \u0431\u0430\u0437\u0430 \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442 \u0438 \u0441\u043e\u0434\u0435\u0440\u0436\u0438\u0442 \u0434\u0430\u043d\u043d\u044b\u0435 \u2014 \u044d\u0442\u043e\u0442 \u0448\u0430\u0433 \u043c\u043e\u0436\u043d\u043e \u043f\u0440\u043e\u043f\u0443\u0441\u0442\u0438\u0442\u044c."),
  spacer(50),
);

// ============ STEP 5 ============
mainChildren.push(
  stepHeader(5, "\u041f\u0435\u0440\u0435\u043f\u0438\u0441\u044c NetworkGraph.tsx \u0434\u043b\u044f G6"),
  stepPara("\u042d\u0442\u043e \u0441\u0430\u043c\u044b\u0439 \u043e\u0431\u044a\u0451\u043c\u043d\u044b\u0439 \u0448\u0430\u0433. \u0424\u0430\u0439\u043b components/network/NetworkGraph.tsx \u043f\u043e\u043b\u043d\u043e\u0441\u0442\u044c\u044e \u043f\u0435\u0440\u0435\u043f\u0438\u0441\u044b\u0432\u0430\u0435\u0442\u0441\u044f. \u041d\u0438\u0436\u0435 \u043f\u0440\u0438\u0432\u0435\u0434\u0451\u043d \u043f\u043e\u043b\u043d\u044b\u0439 \u043a\u043e\u0434 \u0444\u0430\u0439\u043b\u0430 \u0441 \u043f\u043e\u044f\u0441\u043d\u0435\u043d\u0438\u044f\u043c\u0438 \u043a \u043a\u0430\u0436\u0434\u043e\u043c\u0443 \u0431\u043b\u043e\u043a\u0443."),
  spacer(60),
  stepPara([bold("\u041a\u043b\u044e\u0447\u0435\u0432\u044b\u0435 \u0440\u0430\u0437\u043b\u0438\u0447\u0438\u044f API Cytoscape.js \u2192 G6 v5:")]),
  bulletItem(bulletS5, "\u0418\u043c\u043f\u043e\u0440\u0442: import { Graph } from '@antv/g6' \u0432\u043c\u0435\u0441\u0442\u043e cytoscape"),
  bulletItem(bulletS5, "\u0421\u043e\u0437\u0434\u0430\u043d\u0438\u0435: new Graph({ container, ... }) \u0432\u043c\u0435\u0441\u0442\u043e cytoscape({ container, ... })"),
  bulletItem(bulletS5, "\u041b\u0435\u0439\u0430\u0443\u0442: layout: { type: 'dagre' } (\u0441\u0442\u0440\u043e\u043a\u0430!) \u0432\u043c\u0435\u0441\u0442\u043e new DagreLayout({ ... })"),
  bulletItem(bulletS5, "\u0418\u043d\u0442\u0435\u0440\u0430\u043a\u0442\u0438\u0432: behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'] \u0432\u043c\u0435\u0441\u0442\u043e \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0445 \u043c\u043e\u0434\u0443\u043b\u0435\u0439"),
  bulletItem(bulletS5, "fitView() \u0431\u0435\u0437 \u0430\u0440\u0433\u0443\u043c\u0435\u043d\u0442\u043e\u0432 \u0438\u043b\u0438 \u0441 \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u043c { padding: 50 } (\u041d\u0415 \u043c\u0430\u0441\u0441\u0438\u0432!)"),
  bulletItem(bulletS5, "\u0414\u0430\u043d\u043d\u044b\u0435: graph.addData({ nodes, edges }) + graph.render() \u0432\u043c\u0435\u0441\u0442\u043e \u0435\u0434\u0438\u043d\u043e\u0433\u043e \u043c\u0430\u0441\u0441\u0438\u0432\u0430 elements"),
  spacer(60),
  stepPara([bold("\u041f\u043e\u043b\u043d\u044b\u0439 \u043a\u043e\u0434 NetworkGraph.tsx (315 \u0441\u0442\u0440\u043e\u043a):")]),
  ...codeBlock([
    "'use client';",
    "",
    "import { useEffect, useRef, useState } from 'react';",
    "import { Graph } from '@antv/g6';",
    "",
    "interface NetworkData {",
    "  elements: Array<{",
    "    id: string; elementId: string; name: string;",
    "    type: string; posX?: number | null; posY?: number | null;",
    "  }>;",
    "  connections: Array<{",
    "    id: string; sourceId: string; targetId: string;",
    "    source: { elementId: string; name: string; type: string };",
    "    target: { elementId: string; name: string; type: string };",
    "  }>;",
    "}",
    "",
    "interface NetworkGraphProps {",
    "  data: NetworkData | null;",
    "  onNodeClick?: (nodeId: string) => void;",
    "}",
    "",
    "// \u0424\u0443\u043d\u043a\u0446\u0438\u0438 getNodeStyle, getNodeShape \u0438 clearSelection",
    "// \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u044f\u044e\u0442 \u0441\u0442\u0438\u043b\u0438 \u0443\u0437\u043b\u043e\u0432 \u043f\u043e \u0442\u0438\u043f\u0443 (source, breaker, load,",
    "// meter, bus, cabinet, junction) \u0441 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u043e\u0439 dark mode.",
    "// \u0421\u043c. \u043f\u043e\u043b\u043d\u044b\u0439 \u043a\u043e\u0434 \u0432 \u0444\u0430\u0439\u043b\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u0430.",
    "",
    "export default function NetworkGraph({ data, onNodeClick }) {",
    "  const containerRef = useRef<HTMLDivElement>(null);",
    "  const graphRef = useRef<Graph | null>(null);",
    "  const selectedNodeRef = useRef<string | null>(null);",
    "  const [isDark, setIsDark] = useState(false);",
    "",
    "  // \u041d\u0430\u0431\u043b\u044e\u0434\u0435\u043d\u0438\u0435 \u0437\u0430 dark mode \u0447\u0435\u0440\u0435\u0437 MutationObserver",
    "  useEffect(() => { ... }, []);",
    "",
    "  // \u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0439 useEffect \u0434\u043b\u044f \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u044f \u0438 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f \u0433\u0440\u0430\u0444\u0430",
    "  useEffect(() => {",
    "    if (!containerRef.current || !data) return;",
    "",
    "    // \u0423\u043d\u0438\u0447\u0442\u043e\u0436\u0435\u043d\u0438\u0435 \u043f\u0440\u0435\u0434\u044b\u0434\u0443\u0449\u0435\u0433\u043e \u0433\u0440\u0430\u0444\u0430",
    "    if (graphRef.current) { graphRef.current.destroy(); }",
    "",
    "    // \u0424\u043e\u0440\u043c\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u043c\u0430\u0441\u0441\u0438\u0432\u043e\u0432 nodes \u0438 edges",
    "    const nodes = data.elements.map(el => ({",
    "      id: el.id, data: { label: el.name, type: el.type },",
    "      style: { ...getNodeStyle(el.type, isDark), ... },",
    "    }));",
    "    const edges = data.connections.map(conn => ({",
    "      id: `edge-${conn.id}`, source: conn.sourceId, target: conn.targetId,",
    "      style: { stroke: edgeColor, lineWidth: 2, endArrow: true },",
    "    }));",
    "",
    "    // \u0421\u043e\u0437\u0434\u0430\u043d\u0438\u0435 \u0433\u0440\u0430\u0444\u0430 G6",
    "    const graph = new Graph({",
    "      container: containerRef.current,",
    "      width: containerW, height: containerH,",
    "      autoFit: 'view', padding: [50, 50, 50, 50],",
    "      layout: { type: 'dagre', rankdir: 'TB',",
    "               nodesep: 60, ranksep: 80 },",
    "      behaviors: ['drag-canvas','zoom-canvas','drag-element'],",
    "      transforms: ['process-parallel-edges'],",
    "    });",
    "",
    "    graph.addData({ nodes, edges });",
    "    graph.render();",
    "    setTimeout(() => { graph.fitView(); }, 600);",
    "",
    "    // ResizeObserver \u0434\u043b\u044f \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u043e\u0433\u043e fitView",
    "    // \u041e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0430 \u043a\u043b\u0438\u043a\u043e\u0432 \u043d\u0430 \u0443\u0437\u043b\u044b \u0438 canvas",
    "    // Cleanup \u043f\u0440\u0438 unmount",
    "  }, [data, isDark]);",
    "",
    "  return <div ref={containerRef} className=\"w-full h-full\" />;",
    "}",
  ]),
  spacer(60),
  stepPara([bold("\u041a\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u043e\u0441\u043e\u0431\u0435\u043d\u043d\u043e\u0441\u0442\u0438 G6 v5 API:")]),
  numItem(numStep5, "\u041b\u0435\u0439\u0430\u0443\u0442 'dagre' \u043f\u0435\u0440\u0435\u0434\u0430\u0451\u0442\u0441\u044f \u043a\u0430\u043a \u0441\u0442\u0440\u043e\u043a\u0430. \u041d\u0435 \u0438\u043c\u043f\u043e\u0440\u0442\u0438\u0440\u0443\u0439\u0442\u0435 ExtDagreLayout \u2014 \u043e\u043d\u043e \u043d\u0435 \u043d\u0443\u0436\u043d\u043e."),
  numItem(numStep5, "fitView() \u0431\u0435\u0437 \u0430\u0440\u0433\u0443\u043c\u0435\u043d\u0442\u043e\u0432 \u0438\u043b\u0438 fitView({ padding: 50 }). \u041d\u0418\u041a\u041e\u0413\u0414\u0410 fitView([50]) \u2014 \u044d\u0442\u043e TypeScript-\u043e\u0448\u0438\u0431\u043a\u0430."),
  numItem(numStep5, "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 setTimeout \u0434\u043b\u044f fitView \u043f\u043e\u0441\u043b\u0435 render() \u2014 \u0438\u043d\u0430\u0447\u0435 \u043a\u043e\u043d\u0442\u0435\u0439\u043d\u0435\u0440 \u043c\u043e\u0436\u0435\u0442 \u0435\u0449\u0451 \u043d\u0435 \u0438\u043c\u0435\u0442\u044c \u0440\u0430\u0437\u043c\u0435\u0440\u043e\u0432."),
  numItem(numStep5, "ResizeObserver \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u0435\u043d \u0434\u043b\u044f \u043f\u0435\u0440\u0435\u0440\u0438\u0441\u043e\u0432\u043a\u0438 \u043f\u0440\u0438 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0438 \u0440\u0430\u0437\u043c\u0435\u0440\u0430 \u043e\u043a\u043d\u0430."),
  numItem(numStep5, "\u0412\u0441\u0435 \u0441\u043b\u0443\u0448\u0430\u0442\u0435\u043b\u0438 (node:click, canvas:click) \u0434\u043e\u043b\u0436\u043d\u044b \u0443\u0434\u0430\u043b\u044f\u0442\u044c\u0441\u044f \u0432 cleanup."),
  spacer(50),
  errBox(
    "TypeScript \u043e\u0448\u0438\u0431\u043a\u0430: fitView \u043f\u0440\u0438\u043d\u0438\u043c\u0430\u0435\u0442 \u043e\u0431\u044a\u0435\u043a\u0442, \u043d\u0435 \u043c\u0430\u0441\u0441\u0438\u0432",
    "\u0412 G6 v5 \u0441\u0438\u0433\u043d\u0430\u0442\u0443\u0440\u0430 fitView \u0438\u0437\u043c\u0435\u043d\u0438\u043b\u0430\u0441\u044c. \u041d\u0435\u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u043e: graph.fitView([50]). \u041f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u043e: graph.fitView() \u0438\u043b\u0438 graph.fitView({ padding: 50 }). \u041f\u0435\u0440\u0435\u0434\u0430\u0447\u0430 \u043c\u0430\u0441\u0441\u0438\u0432\u0430 \u043f\u0440\u0438\u0432\u0435\u0434\u0451\u0442 \u043a \u043e\u0448\u0438\u0431\u043a\u0435 \u043a\u043e\u043c\u043f\u0438\u043b\u044f\u0446\u0438\u0438."
  ),
  spacer(50),
);

// ============ STEP 6 ============
mainChildren.push(
  stepHeader(6, "\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 globals.css"),
  stepPara("\u0412 \u0444\u0430\u0439\u043b\u0435 app/globals.css \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u0435 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u0434\u043b\u044f \u043a\u043e\u043d\u0442\u0435\u0439\u043d\u0435\u0440\u0430 \u0433\u0440\u0430\u0444\u0430:"),
  ...codeBlock([
    "/* \u0411\u044b\u043b\u043e: Cytoscape container */",
    "/* G6 graph container */",
    ".g6-container {",
    "  width: 100%;",
    "  height: 100%;",
    "}",
  ]),
  spacer(50),
);

// ============ STEP 7 ============
mainChildren.push(
  stepHeader(7, "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430 next.config.ts"),
  stepPara("\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u0435 next.config.ts, \u0447\u0442\u043e\u0431\u044b G6, Prisma \u0438 LibSQL \u043d\u0435 \u0431\u0430\u043d\u0434\u043b\u0438\u043b\u0438\u0441\u044c \u0432 \u0441\u0442\u0430\u043d\u0434\u0430\u043b\u043e\u043d\u043d\u044b\u0439 \u0431\u0430\u043d\u0434\u043b. \u041e\u043d\u0438 \u0434\u043e\u043b\u0436\u043d\u044b \u043e\u0441\u0442\u0430\u0432\u0430\u0442\u044c\u0441\u044f \u0432\u043d\u0435\u0448\u043d\u0438\u043c\u0438 \u043f\u0430\u043a\u0435\u0442\u0430\u043c\u0438 \u0432 node_modules:"),
  ...codeBlock([
    "// \u0424\u0430\u0439\u043b: /home/z/my-project/network-digital-twin/next.config.ts",
    "import path from \"path\";",
    "import type { NextConfig } from \"next\";",
    "",
    "const nextConfig: NextConfig = {",
    "  output: 'standalone',",
    "  outputFileTracingRoot: path.join(__dirname),",
    "  serverExternalPackages: [",
    "    '@antv/g6',",
    "    '@prisma/client',",
    "    '@prisma/adapter-libsql',",
    "    '@libsql/client',",
    "  ],",
    "};",
    "",
    "export default nextConfig;",
  ]),
  spacer(60),
  warnBox(
    "\u041d\u0435 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 Turbopack \u0432 \u043f\u0440\u043e\u0434\u0443\u043a\u0446\u0438\u0438",
    "\u041f\u0440\u0438 \u0441\u0431\u043e\u0440\u043a\u0435 \u043f\u0440\u043e\u0434\u0443\u043a\u0446\u0438\u0438 \u043d\u0435 \u0434\u043e\u0431\u0430\u0432\u043b\u044f\u0439\u0442\u0435 turbopack \u0432 \u043a\u043e\u043d\u0444\u0438\u0433. \u041e\u043d \u043c\u043e\u0436\u0435\u0442 \u043f\u0440\u0438\u0432\u0435\u0441\u0442\u0438 \u043a \u043e\u0448\u0438\u0431\u043a\u0430\u043c \u0441 \u043d\u0430\u0442\u0438\u0432\u043d\u044b\u043c\u0438 \u043c\u043e\u0434\u0443\u043b\u044f\u043c\u0438 Prisma."
  ),
  spacer(50),
);

// ============ STEP 8 ============
mainChildren.push(
  stepHeader(8, "\u0421\u0431\u043e\u0440\u043a\u0430 \u043f\u0440\u043e\u0435\u043a\u0442\u0430 (next build)"),
  stepPara("\u0421\u0431\u043e\u0440\u043a\u0430 \u043f\u0440\u043e\u0435\u043a\u0442\u0430 \u0441 \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u043c \u0443\u0441\u043b\u043e\u0432\u0438\u0435\u043c \u2014 \u0432\u044b\u043f\u043e\u043b\u043d\u044f\u0442\u044c \u0438\u043c\u0435\u043d\u043d\u043e \u0438\u0437 \u043a\u043e\u0440\u043d\u044f \u043f\u0440\u043e\u0435\u043a\u0442\u0430 \u0447\u0435\u0440\u0435\u0437 npx, \u043d\u0435 \u0447\u0435\u0440\u0435\u0437 npm run:"),
  ...codeBlock([
    "cd /home/z/my-project/network-digital-twin",
    "npx next build",
  ]),
  spacer(60),
  errBox(
    "\u041d\u0415 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 npm run build",
    "\u0420\u043e\u0434\u0438\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0439 package.json \u0432 /home/z/my-project/ \u043f\u0435\u0440\u0435\u0445\u0432\u0430\u0442\u0438\u0442 \u043a\u043e\u043c\u0430\u043d\u0434\u0443 \u0438 \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442 build \u0440\u043e\u0434\u0438\u0442\u0435\u043b\u044c\u0441\u043a\u043e\u0433\u043e \u043f\u0440\u043e\u0435\u043a\u0442\u0430. \u0412\u0441\u0435\u0433\u0434\u0430 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 npx next build \u0441 cd \u0432 \u043a\u043e\u0440\u0435\u043d\u044c \u043f\u0440\u043e\u0435\u043a\u0442\u0430."
  ),
  spacer(60),
  stepPara([bold("\u041e\u0436\u0438\u0434\u0430\u0435\u043c\u044b\u0439 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442: "), body("\u0441\u0431\u043e\u0440\u043a\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0441\u044f \u0443\u0441\u043f\u0435\u0448\u043d\u043e, \u043f\u043e\u044f\u0432\u0438\u0442\u0441\u044f \u0434\u0438\u0440\u0435\u043a\u0442\u043e\u0440\u0438\u044f .next/standalone/")]),
  spacer(50),
);

// ============ STEP 9 ============
mainChildren.push(
  stepHeader(9, "\u0421\u0431\u043e\u0440\u043a\u0430 standalone-\u0431\u0430\u043d\u0434\u043b\u0430"),
  stepPara("\u041f\u043e\u0441\u043b\u0435 \u0443\u0441\u043f\u0435\u0448\u043d\u043e\u0439 \u0441\u0431\u043e\u0440\u043a\u0438 \u043d\u0435\u043e\u0431\u0445\u043e\u0434\u0438\u043c\u043e \u0441\u043e\u0431\u0440\u0430\u0442\u044c \u043f\u043e\u043b\u043d\u044b\u0439 standalone-\u0431\u0430\u043d\u0434\u043b. \u0412 \u043d\u0451\u043c \u043d\u0435 \u0445\u0432\u0430\u0442\u0430\u0435\u0442 Prisma Client, \u0441\u0442\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0445 \u0444\u0430\u0439\u043b\u043e\u0432 \u0438 \u0431\u0430\u0437\u044b \u0434\u0430\u043d\u043d\u044b\u0445. \u0412\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u0435:"),
  ...codeBlock([
    "cd /home/z/my-project/network-digital-twin",
    "",
    "# 1. \u041a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 Prisma Client v7 \u0432 standalone",
    "cp -r node_modules/@prisma .next/standalone/node_modules/@prisma",
    "cp -r node_modules/.prisma .next/standalone/node_modules/.prisma",
    "",
    "# 2. \u041a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0441\u0442\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0445 \u0444\u0430\u0439\u043b\u043e\u0432",
    "cp -r .next/static .next/standalone/.next/static",
    "",
    "# 3. \u041a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 public/\u0434\u0438\u0440\u0435\u043a\u0442\u043e\u0440\u0438\u0438",
    "cp -r public .next/standalone/public/",
  ]),
  spacer(60),
  warnBox(
    "\u041f\u0440\u0438\u0447\u0438\u043d\u0430 \u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f Prisma Client",
    "\u041f\u0440\u0438 output: 'standalone' Next.js \u043a\u043e\u043f\u0438\u0440\u0443\u0435\u0442 \u0437\u0430\u0432\u0438\u0441\u0438\u043c\u043e\u0441\u0442\u0438 \u0438\u0437 serverExternalPackages, \u043d\u043e \u043c\u043e\u0436\u0435\u0442 \u043f\u0435\u0440\u0435\u043d\u0435\u0441\u0442\u0438 \u0443\u0441\u0442\u0430\u0440\u0435\u0432\u0448\u0443\u044e \u0432\u0435\u0440\u0441\u0438\u044e \u0438\u0437 \u0440\u043e\u0434\u0438\u0442\u0435\u043b\u044c\u0441\u043a\u043e\u0433\u043e node_modules. \u041f\u0440\u0438\u043d\u0443\u0434\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0435 \u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0433\u0430\u0440\u0430\u043d\u0442\u0438\u0440\u0443\u0435\u0442 Prisma v7."
  ),
  spacer(50),
);

// ============ STEP 10 ============
mainChildren.push(
  stepHeader(10, "\u0417\u0430\u043f\u0443\u0441\u043a production-\u0441\u0435\u0440\u0432\u0435\u0440\u0430"),
  stepPara("\u0417\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u0435 \u0441\u0435\u0440\u0432\u0435\u0440 \u0438\u0437 \u0441\u043e\u0431\u0440\u0430\u043d\u043d\u043e\u0433\u043e standalone-\u0431\u0430\u043d\u0434\u043b\u0430:"),
  ...codeBlock([
    "cd /home/z/my-project/network-digital-twin",
    "PORT=3000 node .next/standalone/server.js",
  ]),
  spacer(60),
  stepPara([bold("\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430: "), body("\u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 http://localhost:3000. \u0413\u0440\u0430\u0444 \u0434\u043e\u043b\u0436\u0435\u043d \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0442\u044c \u0432\u0441\u0435 194 \u0443\u0437\u043b\u0430 \u0438 202 \u0441\u0432\u044f\u0437\u0438 \u0431\u0435\u0437 \u043e\u0431\u0440\u0435\u0437\u043a\u0438. Drag-n-drop \u0434\u043e\u043b\u0436\u0435\u043d \u0440\u0430\u0431\u043e\u0442\u0430\u0442\u044c \u0438\u0437 \u043a\u043e\u0440\u043e\u0431\u043a\u0438.")]),
  spacer(100),
  okBox(
    "\u0423\u0441\u043f\u0435\u0448\u043d\u0430\u044f \u043c\u0438\u0433\u0440\u0430\u0446\u0438\u044f!",
    "\u0415\u0441\u043b\u0438 \u0432\u044b \u0432\u0438\u0434\u0438\u0442\u0435 \u043f\u043e\u043b\u043d\u044b\u0439 \u0433\u0440\u0430\u0444 \u0441\u043e \u0432\u0441\u0435\u043c\u0438 \u0443\u0437\u043b\u0430\u043c\u0438, \u043c\u043e\u0436\u043d\u043e \u043f\u0435\u0440\u0435\u0442\u0430\u0441\u043a\u0438\u0432\u0430\u0442\u044c \u0443\u0437\u043b\u044b, \u043c\u0430\u0441\u0448\u0442\u0430\u0431\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043a\u043e\u043b\u0451\u0441\u043e\u043c \u0438 \u043a\u043b\u0438\u043a\u0430\u0442\u044c \u043f\u043e \u0443\u0437\u043b\u0430\u043c \u2014 \u043c\u0438\u0433\u0440\u0430\u0446\u0438\u044f \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430 \u0443\u0441\u043f\u0435\u0448\u043d\u043e."
  ),
  spacer(50),
);

// ============ 4. Troubleshooting ============
mainChildren.push(
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 300 },
    children: [
      new TextRun({ text: "4. \u0420\u0435\u0448\u0435\u043d\u0438\u044f \u043f\u0440\u043e\u0431\u043b\u0435\u043c", font: headFont, size: 32, bold: true, color: C.primary }),
    ],
  }),
  stepPara("\u041d\u0438\u0436\u0435 \u043f\u0435\u0440\u0435\u0447\u0438\u0441\u043b\u0435\u043d\u044b \u0432\u0441\u0435 \u043e\u0448\u0438\u0431\u043a\u0438, \u0441 \u043a\u043e\u0442\u043e\u0440\u044b\u043c\u0438 \u0441\u0442\u043e\u043b\u043a\u043d\u0443\u043b\u0438\u0441\u044c \u043f\u0440\u0438 \u043c\u0438\u0433\u0440\u0430\u0446\u0438\u0438, \u0438 \u0438\u0445 \u0440\u0435\u0448\u0435\u043d\u0438\u044f:"),
  spacer(60),
);

// Troubleshooting table
mainChildren.push(
  new Table({
    columnWidths: [2800, 3200, 3000],
    margins: { top: 80, bottom: 80, left: 150, right: 150 },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        tableHeader: true,
        children: ["\u041e\u0448\u0438\u0431\u043a\u0430", "\u041f\u0440\u0438\u0447\u0438\u043d\u0430", "\u0420\u0435\u0448\u0435\u043d\u0438\u0435"].map((h, i) =>
          new TableCell({
            borders: cellB, shading: { fill: C.tableHeader, type: ShadingType.CLEAR },
            width: { size: [2800, 3200, 3000][i], type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(h, { color: C.primary, size: 20 })] })],
          })
        ),
      }),
      ...([
        [
          "Prisma \u0441\u043e\u0437\u0434\u0430\u0451\u0442 \u043d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u0424\u0410\u0419\u041b DB",
          "pwd \u043d\u0435 \u0432 \u043a\u043e\u0440\u043d\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u0430",
          "cd /home/z/my-project/network-digital-twin \u043f\u0435\u0440\u0435\u0434 \u043b\u044e\u0431\u043e\u0439 \u043a\u043e\u043c\u0430\u043d\u0434\u043e\u0439"
        ],
        [
          "\u041e\u0448\u0438\u0431\u043a\u0430: url \u0432 datasource",
          "Prisma v7 \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 url \u0432 schema.prisma",
          "\u0423\u0434\u0430\u043b\u0438\u0442\u044c url, \u0441\u043e\u0437\u0434\u0430\u0442\u044c prisma.config.ts"
        ],
        [
          "Client version mismatch",
          "node_modules \u0441\u043e\u0434\u0435\u0440\u0436\u0438\u0442 Prisma v6",
          "npm install prisma@7.6.0 --prefix /home/z/my-project/network-digital-twin"
        ],
        [
          "fitView TypeScript error",
          "\u041f\u0435\u0440\u0435\u0434\u0430\u043d \u043c\u0430\u0441\u0441\u0438\u0432 \u0432\u043c\u0435\u0441\u0442\u043e \u043e\u0431\u044a\u0435\u043a\u0442\u0430",
          "fitView() \u0438\u043b\u0438 fitView({ padding: 50 })"
        ],
        [
          "DagreLayout import error",
          "G6 v5: \u043b\u0435\u0439\u0430\u0443\u0442 \u043a\u0430\u043a \u0441\u0442\u0440\u043e\u043a\u0430",
          "layout: { type: 'dagre' } \u0431\u0435\u0437 \u0438\u043c\u043f\u043e\u0440\u0442\u0430 \u043a\u043b\u0430\u0441\u0441\u0430"
        ],
        [
          "Standalone \u043d\u0435 \u043d\u0430\u0445\u043e\u0434\u0438\u0442 Prisma",
          "\u041d\u0435\u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d \u043a\u043b\u0438\u0435\u043d\u0442",
          "cp -r node_modules/@prisma .next/standalone/node_modules/@prisma"
        ],
        [
          "npm run build \u0437\u0430\u043f\u0443\u0441\u043a\u0430\u0435\u0442 \u043d\u0435 \u0442\u043e",
          "\u0420\u043e\u0434\u0438\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0439 package.json",
          "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u044c npx next build \u0432\u043c\u0435\u0441\u0442\u043e npm run build"
        ],
      ]).map(([err, cause, fix]) =>
        new TableRow({
          children: [
            new TableCell({
              borders: cellB, width: { size: 2800, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [code(err, { size: 17 })] })],
            }),
            new TableCell({
              borders: cellB, width: { size: 3200, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [body(cause, { size: 19 })] })],
            }),
            new TableCell({
              borders: cellB, width: { size: 3000, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [code(fix, { size: 17 })] })],
            }),
          ],
        })
      ),
    ],
  }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 200 }, children: [body("\u0422\u0430\u0431\u043b\u0438\u0446\u0430 3. \u0421\u043f\u0440\u0430\u0432\u043e\u0447\u043d\u0438\u043a \u043e\u0448\u0438\u0431\u043e\u043a \u0438 \u0440\u0435\u0448\u0435\u043d\u0438\u0439", { color: C.secondary, size: 18 })] }),
);

// ============ 5. Checklist ============
mainChildren.push(
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 300 },
    children: [
      new TextRun({ text: "5. \u0427\u0435\u043a-\u043b\u0438\u0441\u0442 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438", font: headFont, size: 32, bold: true, color: C.primary }),
    ],
  }),
  stepPara("\u041f\u043e\u0441\u043b\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u044f \u0432\u0441\u0435\u0445 \u0448\u0430\u0433\u043e\u0432 \u043f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043a\u0430\u0436\u0434\u044b\u0439 \u043f\u0443\u043d\u043a\u0442:"),
  numItem(numChecklist, "\u0412 package.json \u043d\u0435\u0442 cytoscape, \u0435\u0441\u0442\u044c @antv/g6: ^5.1.0"),
  numItem(numChecklist, "\u0412 prisma/schema.prisma \u043d\u0435\u0442 url \u0432 datasource, provider = \"sqlite\""),
  numItem(numChecklist, "\u0424\u0430\u0439\u043b prisma.config.ts \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442 \u0438 \u0443\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u044b\u0439 \u043f\u0443\u0442\u044c \u043a DB"),
  numItem(numChecklist, "npx prisma --version \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 7.6.0"),
  numItem(numChecklist, "\u0424\u0430\u0439\u043b /home/z/my-project/db/custom.db \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442"),
  numItem(numChecklist, "npx next build \u0437\u0430\u0432\u0435\u0440\u0448\u0430\u0435\u0442\u0441\u044f \u0431\u0435\u0437 \u043e\u0448\u0438\u0431\u043e\u043a"),
  numItem(numChecklist, ".next/standalone/node_modules/@prisma \u0441\u043e\u0434\u0435\u0440\u0436\u0438\u0442 v7"),
  numItem(numChecklist, ".next/standalone/.next/static \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442"),
  numItem(numChecklist, "node .next/standalone/server.js \u0437\u0430\u043f\u0443\u0441\u043a\u0430\u0435\u0442\u0441\u044f"),
  numItem(numChecklist, "\u0413\u0440\u0430\u0444 \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0435\u0442 \u0432\u0441\u0435 \u0443\u0437\u043b\u044b \u0431\u0435\u0437 \u043e\u0431\u0440\u0435\u0437\u043a\u0438"),
  numItem(numChecklist, "Drag-n-drop, zoom \u0438 \u043a\u043b\u0438\u043a\u0438 \u043f\u043e \u0443\u0437\u043b\u0430\u043c \u0440\u0430\u0431\u043e\u0442\u0430\u044e\u0442"),
  numItem(numChecklist, "API-\u044d\u043d\u0434\u043f\u043e\u0439\u043d\u0442\u044b \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u044e\u0442 \u0434\u0430\u043d\u043d\u044b\u0435"),
  spacer(100),
);

// ============ 6. API Mapping ============
mainChildren.push(
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 300 },
    children: [
      new TextRun({ text: "6. \u0421\u043e\u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0435 API: Cytoscape.js \u2192 G6 v5", font: headFont, size: 32, bold: true, color: C.primary }),
    ],
  }),
  stepPara("\u0422\u0430\u0431\u043b\u0438\u0446\u0430 \u0441\u043e\u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u044f \u043a\u043b\u044e\u0447\u0435\u0432\u044b\u0445 API-\u043c\u0435\u0442\u043e\u0434\u043e\u0432 \u0438 \u043a\u043e\u043d\u0446\u0435\u043f\u0446\u0438\u0439 \u043c\u0435\u0436\u0434\u0443 \u0434\u0432\u0443\u043c\u044f \u0431\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0430\u043c\u0438. \u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u043a\u0430\u043a \u0441\u043f\u0440\u0430\u0432\u043e\u0447\u043d\u0438\u043a \u043f\u0440\u0438 \u043f\u0435\u0440\u0435\u043d\u043e\u0441\u0435 \u0434\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0433\u043e \u043a\u043e\u0434\u0430:"),
  spacer(60),
);

const apiMapData = [
  ["cytoscape({ container })", "new Graph({ container })", "\u0421\u043e\u0437\u0434\u0430\u043d\u0438\u0435 \u044d\u043a\u0437\u0435\u043c\u043f\u043b\u044f\u0440\u0430"],
  ["cy.add(elements)", "graph.addData({ nodes, edges })", "\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0434\u0430\u043d\u043d\u044b\u0445"],
  ["cy.fitView([50])", "graph.fitView() \u0438\u043b\u0438 fitView({ padding: 50 })", "\u041c\u0430\u0441\u0448\u0442\u0430\u0431\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435"],
  ["cy.center()", "\u0410\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438 \u0447\u0435\u0440\u0435\u0437 autoFit: 'view'", "\u0426\u0435\u043d\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435"],
  ["cy.zoom()", "graph.getZoom() / graph.zoomTo()", "\u041c\u0430\u0441\u0448\u0442\u0430\u0431"],
  ["cy.on('tap')", "graph.on('node:click')", "\u041e\u0431\u0440\u0430\u0431\u043e\u0442\u0447\u0438\u043a\u0438 \u0441\u043e\u0431\u044b\u0442\u0438\u0439"],
  ["cy.destroy()", "graph.destroy()", "\u0423\u043d\u0438\u0447\u0442\u043e\u0436\u0435\u043d\u0438\u0435"],
  ["cy.resize()", "graph.resize(w, h)", "\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u0440\u0430\u0437\u043c\u0435\u0440\u0430"],
  ["layout: new DagreLayout()", "layout: { type: 'dagre' }", "\u041b\u0435\u0439\u0430\u0443\u0442"],
  ["boxSelectionEnabled: true", "behaviors: ['drag-element']", "Drag-n-drop"],
  ["cy.elements()", "graph.getNodeData() / graph.getEdgeData()", "\u0414\u043e\u0441\u0442\u0443\u043f \u043a \u0434\u0430\u043d\u043d\u044b\u043c"],
];

mainChildren.push(
  new Table({
    columnWidths: [2800, 3200, 3000],
    margins: { top: 80, bottom: 80, left: 150, right: 150 },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        tableHeader: true,
        children: ["Cytoscape.js", "AntV G6 v5", "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435"].map((h, i) =>
          new TableCell({
            borders: cellB, shading: { fill: C.tableHeader, type: ShadingType.CLEAR },
            width: { size: [2800, 3200, 3000][i], type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(h, { color: C.primary, size: 20 })] })],
          })
        ),
      }),
      ...apiMapData.map(([cy, g6, desc]) =>
        new TableRow({
          children: [
            new TableCell({
              borders: cellB, width: { size: 2800, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [code(cy, { size: 17 })] })],
            }),
            new TableCell({
              borders: cellB, width: { size: 3200, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [code(g6, { size: 17 })] })],
            }),
            new TableCell({
              borders: cellB, width: { size: 3000, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [body(desc, { size: 19 })] })],
            }),
          ],
        })
      ),
    ],
  }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 200 }, children: [body("\u0422\u0430\u0431\u043b\u0438\u0446\u0430 4. \u0421\u043e\u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0435 API \u0434\u0432\u0443\u0445 \u0431\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a", { color: C.secondary, size: 18 })] }),
);

const mainSection = {
  properties: {
    page: {
      margin: { top: 1800, bottom: 1440, left: 1440, right: 1440 },
    },
  },
  headers: {
    default: new Header({
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [body("\u041c\u0438\u0433\u0440\u0430\u0446\u0438\u044f Cytoscape.js \u2192 AntV G6", { color: C.accent, size: 18 })],
        }),
      ],
    }),
  },
  footers: {
    default: new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            body("\u2014 ", { color: C.accent, size: 18 }),
            new TextRun({ children: [PageNumber.CURRENT], font: bodyFont, size: 18, color: C.accent }),
            body(" \u2014", { color: C.accent, size: 18 }),
          ],
        }),
      ],
    }),
  },
  children: mainChildren,
};

const doc = new Document({
  styles: {
    default: { document: { run: { font: bodyFont, size: 21 } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: headFont, color: C.primary },
        paragraph: { spacing: { before: 400, after: 300 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: headFont, color: C.primary },
        paragraph: { spacing: { before: 300, after: 200 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: { config: numConfigs },
  sections: [coverSection, tocSection, mainSection],
});

const outPath = "/home/z/my-project/download/migration-cytoscape-to-g6.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log("Done: " + outPath);
});

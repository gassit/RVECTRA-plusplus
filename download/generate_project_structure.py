#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate PDF: Project Structure - Network Digital Twin (Russian)
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (
    Paragraph, Spacer, PageBreak, Table, TableStyle,
    SimpleDocTemplate, KeepTogether
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ============================================================
# FONT REGISTRATION
# ============================================================
pdfmetrics.registerFont(TTFont('TimesNewRoman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
pdfmetrics.registerFont(TTFont('SimHei', '/usr/share/fonts/truetype/chinese/SimHei.ttf'))
pdfmetrics.registerFont(TTFont('MicrosoftYaHei', '/usr/share/fonts/truetype/chinese/msyh.ttf'))
pdfmetrics.registerFont(TTFont('Calibri', '/usr/share/fonts/truetype/english/calibri-regular.ttf'))
pdfmetrics.registerFont(TTFont('CalibriBold', '/usr/share/fonts/truetype/english/calibri-bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('TimesNewRoman', normal='TimesNewRoman', bold='TimesNewRoman')
registerFontFamily('SimHei', normal='SimHei', bold='SimHei')
registerFontFamily('MicrosoftYaHei', normal='MicrosoftYaHei', bold='MicrosoftYaHei')
registerFontFamily('Calibri', normal='Calibri', bold='CalibriBold')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ============================================================
# CONSTANTS
# ============================================================
TABLE_HEADER_COLOR = colors.HexColor('#1F4E79')
TABLE_HEADER_TEXT = colors.white
TABLE_ROW_EVEN = colors.white
TABLE_ROW_ODD = colors.HexColor('#F5F5F5')

OUTPUT_PATH = '/home/z/my-project/download/project_structure.pdf'

PAGE_W, PAGE_H = A4
LEFT_M = 2.0 * cm
RIGHT_M = 2.0 * cm
TOP_M = 2.0 * cm
BOT_M = 2.0 * cm
CONTENT_W = PAGE_W - LEFT_M - RIGHT_M

# ============================================================
# STYLES
# ============================================================
FONT_BODY = 'TimesNewRoman'
FONT_HEADING = 'TimesNewRoman'

cover_title_style = ParagraphStyle(
    name='CoverTitle', fontName=FONT_HEADING, fontSize=28, leading=36,
    alignment=TA_CENTER, spaceAfter=20, textColor=colors.HexColor('#1F4E79')
)
cover_subtitle_style = ParagraphStyle(
    name='CoverSubtitle', fontName=FONT_BODY, fontSize=16, leading=24,
    alignment=TA_CENTER, spaceAfter=12, textColor=colors.HexColor('#333333')
)
cover_author_style = ParagraphStyle(
    name='CoverAuthor', fontName=FONT_BODY, fontSize=14, leading=20,
    alignment=TA_CENTER, spaceAfter=10, textColor=colors.HexColor('#555555')
)

h1_style = ParagraphStyle(
    name='H1', fontName=FONT_HEADING, fontSize=20, leading=26,
    spaceBefore=18, spaceAfter=10, textColor=colors.black
)
h2_style = ParagraphStyle(
    name='H2', fontName=FONT_HEADING, fontSize=15, leading=20,
    spaceBefore=14, spaceAfter=8, textColor=colors.black
)
h3_style = ParagraphStyle(
    name='H3', fontName=FONT_HEADING, fontSize=12, leading=16,
    spaceBefore=10, spaceAfter=6, textColor=colors.black
)

body_style = ParagraphStyle(
    name='Body', fontName=FONT_BODY, fontSize=10.5, leading=16,
    alignment=TA_LEFT, spaceAfter=6, wordWrap='CJK'
)
body_indent_style = ParagraphStyle(
    name='BodyIndent', fontName=FONT_BODY, fontSize=10.5, leading=16,
    alignment=TA_LEFT, spaceAfter=4, leftIndent=20, wordWrap='CJK'
)
bullet_style = ParagraphStyle(
    name='Bullet', fontName=FONT_BODY, fontSize=10.5, leading=16,
    alignment=TA_LEFT, spaceAfter=3, leftIndent=24, bulletIndent=12,
    wordWrap='CJK'
)
code_style = ParagraphStyle(
    name='Code', fontName='DejaVuSans', fontSize=9, leading=13,
    alignment=TA_LEFT, spaceAfter=4, leftIndent=24, wordWrap='CJK',
    backColor=colors.HexColor('#F0F0F0')
)

tbl_header_style = ParagraphStyle(
    name='TblHeader', fontName=FONT_BODY, fontSize=9.5, leading=13,
    alignment=TA_CENTER, textColor=colors.white, wordWrap='CJK'
)
tbl_cell_style = ParagraphStyle(
    name='TblCell', fontName=FONT_BODY, fontSize=9, leading=12,
    alignment=TA_LEFT, wordWrap='CJK'
)
tbl_cell_center = ParagraphStyle(
    name='TblCellCenter', fontName=FONT_BODY, fontSize=9, leading=12,
    alignment=TA_CENTER, wordWrap='CJK'
)

caption_style = ParagraphStyle(
    name='Caption', fontName=FONT_BODY, fontSize=9, leading=12,
    alignment=TA_CENTER, textColor=colors.HexColor('#555555'),
    spaceBefore=3, spaceAfter=6
)

# TOC styles
toc_h1_style = ParagraphStyle(
    name='TOCH1', fontName=FONT_BODY, fontSize=13, leftIndent=20,
    spaceBefore=6, spaceAfter=3
)
toc_h2_style = ParagraphStyle(
    name='TOCH2', fontName=FONT_BODY, fontSize=11, leftIndent=40,
    spaceBefore=2, spaceAfter=2
)
toc_h3_style = ParagraphStyle(
    name='TOCH3', fontName=FONT_BODY, fontSize=10, leftIndent=60,
    spaceBefore=1, spaceAfter=1
)

# ============================================================
# TocDocTemplate
# ============================================================
class TocDocTemplate(SimpleDocTemplate):
    def __init__(self, *args, **kwargs):
        SimpleDocTemplate.__init__(self, *args, **kwargs)

    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            self.notify('TOCEntry', (level, text, self.page))


def add_heading(text, style, level=0):
    p = Paragraph(text, style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text.replace('<b>', '').replace('</b>', '')
    return p


def make_table(data, col_widths, caption_text=None):
    """Create a styled table with alternating row colors."""
    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    tbl.setStyle(TableStyle(style_cmds))

    elements = [Spacer(1, 18), tbl]
    if caption_text:
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(caption_text, caption_style))
    elements.append(Spacer(1, 18))
    return elements


def build_document():
    doc = TocDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=LEFT_M, rightMargin=RIGHT_M,
        topMargin=TOP_M, bottomMargin=BOT_M,
        title='project_structure',
        author='Z.ai',
        creator='Z.ai',
        subject='Project Structure - Network Digital Twin - Technical Documentation'
    )

    story = []

    # ============================================================
    # COVER PAGE
    # ============================================================
    story.append(Spacer(1, 140))
    story.append(Paragraph('<b>Structure of the Project:</b>', cover_title_style))
    story.append(Spacer(1, 10))

    # Use inline font for Russian text in title
    cover_main = ParagraphStyle(
        name='CoverMain', fontName='SimHei', fontSize=32, leading=40,
        alignment=TA_CENTER, spaceAfter=24, textColor=colors.HexColor('#1F4E79')
    )
    story.append(Paragraph('<b>Cifrovoj dvojnik elektriicheskoj seti</b>', cover_main))
    story.append(Spacer(1, 20))

    # Since Times New Roman supports Cyrillic, let's use it directly
    cover_rus_title = ParagraphStyle(
        name='CoverRusTitle', fontName=FONT_BODY, fontSize=24, leading=32,
        alignment=TA_CENTER, spaceAfter=36, textColor=colors.HexColor('#1F4E79')
    )
    story.append(Paragraph(
        '<b>Structura proekta:<br/>Cifrovoj dvojnik elektriicheskoj seti</b>',
        cover_rus_title
    ))
    story.append(Spacer(1, 40))

    cover_sub = ParagraphStyle(
        name='CoverSub', fontName=FONT_BODY, fontSize=14, leading=20,
        alignment=TA_CENTER, spaceAfter=12, textColor=colors.HexColor('#555555')
    )
    story.append(Paragraph('Technical documentation for z.AI', cover_sub))
    story.append(Spacer(1, 60))
    story.append(Paragraph('April 2026', cover_author_style))
    story.append(PageBreak())

    # ============================================================
    # TABLE OF CONTENTS
    # ============================================================
    story.append(Paragraph('<b>Soderzanie</b>', h1_style))
    story.append(Spacer(1, 12))
    toc = TableOfContents()
    toc.levelStyles = [toc_h1_style, toc_h2_style, toc_h3_style]
    story.append(toc)
    story.append(PageBreak())

    # ============================================================
    # 1. PROJECT OVERVIEW
    # ============================================================
    story.append(add_heading('<b>1. Obzor proekta</b>', h1_style, 0))

    story.append(add_heading('<b>1.1 Naznachenie</b>', h2_style, 1))
    story.append(Paragraph(
        'Project "Cifrovoj dvojnik elektriicheskoj seti" (Network Digital Twin) is designed for modeling, '
        'visualization and validation of low-voltage electrical networks (0.4 kV). The system allows importing '
        'network topology data from Excel files, automatically calculating electrical parameters '
        '(cable line impedances, short-circuit currents, voltage drops), performing compliance checks against '
        'PUE requirements (Rules for Electrical Installation), and displaying the network as an interactive '
        'mnemonic diagram. The project is implemented as a web application based on Next.js 16 with server-side '
        'API on Prisma ORM and client-side SVG/React visualization.',
        body_style
    ))

    story.append(add_heading('<b>1.2 Technological Stack</b>', h2_style, 1))
    tech_items = [
        'Framework: Next.js 16.1.3 (App Router, Turbopack)',
        'Language: TypeScript 5',
        'Styling: Tailwind CSS 4 + shadcn/ui (new-york style)',
        'Database: SQLite via Prisma ORM 6.19.2',
        'Build: standalone output (production: bun server.js)',
        'Additional libraries: xlsx (Excel import), lucide-react (icons), next-themes (theme), '
        'recharts (charts), framer-motion (animations), zustand (state management), react-resizable-panels',
    ]
    for item in tech_items:
        story.append(Paragraph(item, bullet_style, bulletText='\u2022'))

    # ============================================================
    # 2. STARTUP AND INITIALIZATION
    # ============================================================
    story.append(add_heading('<b>2. Poryadok zapuska i inicializacii processov</b>', h1_style, 0))

    story.append(add_heading('<b>2.1 Zapusk servera (npm run dev)</b>', h2_style, 1))
    story.append(Paragraph(
        'When executing <font name="DejaVuSans">npm run dev</font> the following sequence occurs:',
        body_style
    ))

    steps = [
        ('Step 1.', 'Node.js reads package.json and launches <font name="DejaVuSans">next dev -p 3000</font>. '
         'Next.js 16 initializes the Turbopack compiler and begins monitoring the file system.'),
        ('Step 2.', 'Next.js loads configuration from <font name="DejaVuSans">next.config.ts</font>: '
         'output="standalone" mode, TypeScript error suppression during build, reactStrictMode=false.'),
        ('Step 3.', 'Next.js loads environment variables from the <font name="DejaVuSans">.env</font> file: '
         '<font name="DejaVuSans">DATABASE_URL=file:/home/z/my-project/db/custom.db</font>.'),
        ('Step 4.', 'Prisma ORM initializes on the first API request (lazy initialization via singleton '
         'in <font name="DejaVuSans">src/lib/db.ts</font>).'),
    ]
    for label, text in steps:
        story.append(Paragraph(
            '<b>' + label + '</b> ' + text, body_indent_style
        ))

    story.append(add_heading('<b>2.2 Inicializacia Prisma i bazy dannyh</b>', h2_style, 1))
    story.append(Paragraph(
        'The file <font name="DejaVuSans">src/lib/db.ts</font> creates a singleton PrismaClient instance '
        'with SQL query logging (log: [\'query\']). In dev mode the client is stored in globalThis to '
        'prevent multiple connections during hot-reload. The SQLite database is located at the path from '
        'DATABASE_URL. The schema is defined in <font name="DejaVuSans">prisma/schema.prisma</font> and '
        'contains 20+ models: Element, Connection, Network, Device, DeviceState, Protection, AtsLogic, '
        'Scenario, Command, PowerFlow, ShortCircuit, Measurement, Alarm, AlarmRule, Tariff, Maintenance, '
        'EventLog, CableReference, BreakerReference, TransformerReference, ValidationRule, ValidationResult.',
        body_style
    ))

    story.append(add_heading('<b>2.3 Poryadok zagruzki stranicy</b>', h2_style, 1))
    story.append(Paragraph(
        'On <font name="DejaVuSans">GET /</font> request, Next.js executes:',
        body_style
    ))

    story.append(Paragraph(
        '<b>1. Loading <font name="DejaVuSans">src/app/layout.tsx</font> (Server Component):</b>',
        body_indent_style
    ))
    layout_items = [
        'Registering Geist and Geist_Mono fonts from Google Fonts',
        'Importing globals.css (Tailwind CSS 4 with CSS variables for light/dark themes)',
        'Wrapping children in ThemeProvider (next-themes) and Toaster (shadcn)',
        'Setting metadata: title="Cifrovoj dvojnik elektriicheskoj seti"',
    ]
    for item in layout_items:
        story.append(Paragraph(item, bullet_style, bulletText='-'))

    story.append(Paragraph(
        '<b>2. Loading <font name="DejaVuSans">src/app/page.tsx</font> (Client Component, \'use client\'):</b>',
        body_indent_style
    ))
    page_items = [
        'Mount component -&gt; setMounted(true)',
        'useEffect calls loadNetworkData() and loadValidationResults()',
        'loadNetworkData() makes fetch(\'/api/network\') -&gt; receives GraphData (nodes + edges)',
        'loadValidationResults() makes fetch(\'/api/validation\') -&gt; receives ValidationIssue array',
        'Data stored in React state (graphData, issues, stats, validationStats)',
    ]
    for item in page_items:
        story.append(Paragraph(item, bullet_style, bulletText='-'))

    # ============================================================
    # 3. DIRECTORY STRUCTURE
    # ============================================================
    story.append(add_heading('<b>3. Structura katalogov i fajlov</b>', h1_style, 0))

    # 3.1 Root config files
    story.append(add_heading('<b>3.1 Kornevye konfiguracionnye fajly</b>', h2_style, 1))

    root_data = [
        [Paragraph('<b>File</b>', tbl_header_style), Paragraph('<b>Purpose</b>', tbl_header_style)],
        [Paragraph('package.json', tbl_cell_style), Paragraph('Dependencies and project scripts (884 packages)', tbl_cell_style)],
        [Paragraph('next.config.ts', tbl_cell_style), Paragraph('Next.js configuration: standalone output, TypeScript relaxed', tbl_cell_style)],
        [Paragraph('tsconfig.json', tbl_cell_style), Paragraph('TypeScript configuration: target ES2017, path alias @/ -&gt; ./src/*', tbl_cell_style)],
        [Paragraph('components.json', tbl_cell_style), Paragraph('shadcn/ui configuration: new-york style, lucide icons', tbl_cell_style)],
        [Paragraph('tailwind.config.ts', tbl_cell_style), Paragraph('Tailwind CSS configuration', tbl_cell_style)],
        [Paragraph('postcss.config.mjs', tbl_cell_style), Paragraph('PostCSS with @tailwindcss/postcss', tbl_cell_style)],
        [Paragraph('eslint.config.mjs', tbl_cell_style), Paragraph('ESLint configuration', tbl_cell_style)],
        [Paragraph('.env', tbl_cell_style), Paragraph('DATABASE_URL=file:/home/z/my-project/db/custom.db', tbl_cell_style)],
        [Paragraph('Caddyfile', tbl_cell_style), Paragraph('Caddy reverse proxy configuration', tbl_cell_style)],
    ]
    story.extend(make_table(root_data, [4.0*cm, CONTENT_W - 4.0*cm], 'Table 1. Root configuration files'))

    # 3.2 src/app/
    story.append(add_heading('<b>3.2 Katalog src/app/ - Entry Point (Next.js App Router)</b>', h2_style, 1))

    story.append(add_heading('<b>3.2.1 src/app/layout.tsx</b>', h3_style, 2))
    story.append(Paragraph(
        'Root layout (Server Component). Initializes: Geist Sans and Geist Mono fonts, CSS theme (globals.css), '
        'ThemeProvider (light/dark via class attribute), Toaster for notifications.',
        body_style
    ))

    story.append(add_heading('<b>3.2.2 src/app/page.tsx</b>', h3_style, 2))
    story.append(Paragraph(
        'Main page (Client Component). Contains: State (graphData, issues, stats, validationStats, selectedNode, '
        'selectedEdge, zoom, searchTerm, isLoading, isImporting, isValidating). Functions: loadNetworkData(), '
        'loadValidationResults(), handleImport(), handleValidate(), handleNodeClick(), handleEdgeClick(). '
        'UI: header (search, zoom, statistics, import/validation/theme buttons), main (NetworkGraph + '
        'ElementDetails + ValidationPanel).',
        body_style
    ))

    story.append(add_heading('<b>3.2.3 src/app/globals.css</b>', h3_style, 2))
    story.append(Paragraph(
        'Tailwind CSS 4 with tw-animate-css import. Defines CSS variables for light/dark themes via oklch colors: '
        'background, foreground, card, primary, secondary, muted, accent, destructive, border, input, ring, '
        'chart-1..5, sidebar.',
        body_style
    ))

    # 3.3 API Routes
    story.append(add_heading('<b>3.3 Katalog src/app/api/ - Server API Routes</b>', h2_style, 1))

    api_data = [
        [Paragraph('<b>Route</b>', tbl_header_style), Paragraph('<b>Methods</b>', tbl_header_style),
         Paragraph('<b>Purpose</b>', tbl_header_style)],
        [Paragraph('/api/route.ts', tbl_cell_style), Paragraph('GET', tbl_cell_center),
         Paragraph('Health-check: returns {message: "Hello, world!"}', tbl_cell_style)],
        [Paragraph('/api/network/route.ts', tbl_cell_style), Paragraph('GET', tbl_cell_center),
         Paragraph('Returns full network topology (GraphData: nodes + edges)', tbl_cell_style)],
        [Paragraph('/api/elements/route.ts', tbl_cell_style), Paragraph('GET, POST, PUT, DELETE', tbl_cell_center),
         Paragraph('CRUD of network elements (Element) with devices', tbl_cell_style)],
        [Paragraph('/api/devices/route.ts', tbl_cell_style), Paragraph('GET, POST, PUT, DELETE', tbl_cell_center),
         Paragraph('CRUD of devices (Device)', tbl_cell_style)],
        [Paragraph('/api/connections/route.ts', tbl_cell_style), Paragraph('GET, POST, PUT, DELETE', tbl_cell_center),
         Paragraph('CRUD of connections (Connection) with auto impedance calculation', tbl_cell_style)],
        [Paragraph('/api/validation/route.ts', tbl_cell_style), Paragraph('GET, POST', tbl_cell_center),
         Paragraph('GET: list of issues; POST: run validation', tbl_cell_style)],
        [Paragraph('/api/import/route.ts', tbl_cell_style), Paragraph('POST', tbl_cell_center),
         Paragraph('Import data from Excel file upload/input.xlsx', tbl_cell_style)],
        [Paragraph('/api/references/route.ts', tbl_cell_style), Paragraph('GET', tbl_cell_center),
         Paragraph('Reference data: cables, breakers, transformers', tbl_cell_style)],
    ]
    story.extend(make_table(api_data, [4.2*cm, 3.8*cm, CONTENT_W - 8.0*cm], 'Table 2. API Routes'))

    story.append(Paragraph(
        '<b>API Request Processing Sequence:</b>', body_style
    ))
    api_steps = [
        'Incoming HTTP request -&gt; Next.js calls the corresponding route.ts',
        'route.ts imports <font name="DejaVuSans">db</font> from <font name="DejaVuSans">@/lib/db</font> '
        '-&gt; PrismaClient singleton initializes (if not yet)',
        'Prisma executes SQL queries to SQLite',
        'Result is converted to JSON and returned via NextResponse.json()',
    ]
    for i, step in enumerate(api_steps, 1):
        story.append(Paragraph(str(i) + '. ' + step, body_indent_style))

    # 3.4 src/lib/
    story.append(add_heading('<b>3.4 Katalog src/lib/ - Business Logic</b>', h2_style, 1))

    story.append(add_heading('<b>3.4.1 src/lib/db.ts</b>', h3_style, 2))
    story.append(Paragraph(
        'Singleton PrismaClient. Exports <font name="DejaVuSans">db</font> - a single instance of the SQLite '
        'connection with query logging.',
        body_style
    ))

    story.append(add_heading('<b>3.4.2 src/lib/services/import.service.ts</b>', h3_style, 2))
    story.append(Paragraph(
        'Excel data import service. Main function: <font name="DejaVuSans">importFromExcel()</font>.',
        body_style
    ))
    story.append(Paragraph('<b>Workflow:</b>', body_indent_style))
    import_steps = [
        'resetCounters() - reset ID generator counters',
        'Check existence of upload/input.xlsx',
        'Clear all database tables (clearDatabase): ValidationResult -&gt; Measurement -&gt; DeviceState '
        '-&gt; Protection -&gt; AtsLogic -&gt; Command -&gt; PowerFlow -&gt; ShortCircuit -&gt; Network '
        '-&gt; Connection -&gt; Device -&gt; Element',
        'Read "Elements" sheet to build type map (elementTypeMap)',
        'Process "Networkall" sheet: create Element + Device for each unique name + Connection between pairs',
        'Process additional sheets: Sources, Cabinets, Loads, Breakers, Connections/Cables',
        'If no data - create demo data (createDemoData)',
        'Calculate node positions for visualization (calculateNodePositions)',
    ]
    for i, step in enumerate(import_steps, 1):
        story.append(Paragraph(str(i) + '. ' + step, body_indent_style))

    story.append(add_heading('<b>3.4.3 src/lib/services/validation.service.ts</b>', h3_style, 2))
    story.append(Paragraph(
        'Network validation service. Main functions: <font name="DejaVuSans">runValidation()</font>, '
        '<font name="DejaVuSans">getValidationIssues()</font>, <font name="DejaVuSans">getValidationStats()</font>.',
        body_style
    ))
    story.append(Paragraph('<b>runValidation() workflow:</b>', body_indent_style))
    val_steps = [
        'Clear previous results (ValidationResult.deleteMany)',
        'Execute 4 checks in parallel:',
    ]
    for i, step in enumerate(val_steps, 1):
        story.append(Paragraph(str(i) + '. ' + step, body_indent_style))

    checks = [
        'checkCableCapacity() (CABLE_001): I_nom.breaker &lt;= I_admissible.cable',
        'checkVoltageDrop() (VOLTAGE_001): voltage drop &lt;= 4%',
        'checkProtectionSensitivity() (PROT_001): I_sc.end &gt;= 3*I_nom.breaker (CRITICAL)',
        'checkSelectivity() (SEL_001): I_nom.incomer &gt;= I_nom.outgoing',
    ]
    for c in checks:
        story.append(Paragraph(c, bullet_style, bulletText='-'))

    story.append(Paragraph('3. Create/update ValidationRule in database', body_indent_style))
    story.append(Paragraph('4. Save results ValidationResult', body_indent_style))

    story.append(Spacer(1, 6))
    story.append(Paragraph('<b>Auxiliary functions:</b>', body_indent_style))
    aux_items = [
        'findPathToSource(elementId) - graph traversal from element to SOURCE (max 50 iterations)',
        'getAllDownstreamElements(sourceId) - BFS from source downstream',
    ]
    for item in aux_items:
        story.append(Paragraph(item, bullet_style, bulletText='-'))

    story.append(add_heading('<b>3.4.4 src/lib/data/references.ts</b>', h3_style, 2))
    story.append(Paragraph(
        'Equipment reference data (static):',
        body_style
    ))
    ref_items = [
        '<b>CABLE_REFERENCES:</b> 29 cables (14 AVVG aluminum + 15 VVG copper) with PUE parameters: '
        'cross-section, cores, R Ohm/km, X Ohm/km, I air, I ground',
        '<b>BREAKER_REFERENCES:</b> 7 breaker models (VA-47-29, VA-47-100, VA-55-41, VA-55-43, S203, '
        'NSX100, NSX250) with parameters: In, poles, U_nom, breaking capacity',
        '<b>TRANSFORMER_REFERENCES:</b> 6 transformers (TM-250/10 ... TM-2500/10) with parameters: '
        'S kVA, U_k%, short-circuit/no-load losses',
    ]
    for item in ref_items:
        story.append(Paragraph(item, bullet_style, bulletText='\u2022'))
    story.append(Paragraph(
        'Search functions: findCableReference(), findBreakerReference(), findTransformerReference(), '
        'getCableCurrentCapacity(), getReferencesData()',
        body_indent_style
    ))

    # Calculations section
    story.append(add_heading('<b>3.4.5 Calculation Modules (src/lib/calculations/)</b>', h3_style, 2))

    story.append(Paragraph(
        '<b>impedance.ts</b> - Cable line impedance calculation:',
        body_indent_style
    ))
    imp_funcs = [
        'calculateCableImpedance(length, wireSize, material, wireType) -&gt; {r, x, z} by formulas '
        'R=ro*L/S, X=x0*L/1000, Z=sqrt(R<super>2</super>+X<super>2</super>)',
        'calculateCableImpedanceFromReference(length, wireType, wireSize) -&gt; from reference data',
        'calculateCableCurrentCapacity(wireType, wireSize, installationMethod) -&gt; admissible current',
        'adjustResistanceForTemperature(r20, temperature, alpha=0.004) -&gt; temperature correction',
        'calculateCablePowerLoss(current, r) -&gt; losses: dP = 3*I<super>2</super>*R',
    ]
    for f in imp_funcs:
        story.append(Paragraph(f, bullet_style, bulletText='-'))

    story.append(Paragraph(
        '<b>shortCircuit.ts</b> - Short-circuit current calculation:',
        body_indent_style
    ))
    sc_funcs = [
        'calculateShortCircuit(zSystem, zCable, voltage) -&gt; {ik3, ik1, ik2, zk}',
        'calculateShortCircuitWithTransformer(S, uk%, zCable, U=400) -&gt; with transformer impedance',
        'calculatePeakShortCircuitCurrent(ik3, kud=1.8) -&gt; peak current: i_ud = sqrt(2)*K_ud*I_k3',
        'checkProtectionSensitivity(ikMin, inBreaker, ratio=3) -&gt; protection sensitivity check',
        'calculateMinShortCircuitCurrent(zSource, zLine, voltage) -&gt; minimum SC current with heating factor (1.5)',
    ]
    for f in sc_funcs:
        story.append(Paragraph(f, bullet_style, bulletText='-'))

    story.append(Paragraph(
        '<b>voltageDrop.ts</b> - Voltage drop calculation:',
        body_indent_style
    ))
    vd_funcs = [
        'calculateVoltageDrop(P, Q, R, X, U_kV) -&gt; dU% = (P*R + Q*X)/(10*U<super>2</super>)',
        'calculateVoltageDropByCurrent(I, R, X, cosPhi, U) -&gt; dU% = sqrt(3)*I*(R*cos+X*sin)/U*100',
        'calculateVoltageDropByLength(I, L, S, material, cosPhi, U) -&gt; full calculation by length',
        'isVoltageDropAcceptable(dU%, max=4%) -&gt; check',
        'calculateMinWireSizeForVoltageDrop(P, L, material, maxDrop%, U, cosPhi) -&gt; minimum cross-section',
    ]
    for f in vd_funcs:
        story.append(Paragraph(f, bullet_style, bulletText='-'))

    # ID Generator
    story.append(add_heading('<b>3.4.6 src/lib/utils/id-generator.ts</b>', h3_style, 2))
    story.append(Paragraph('ID generation functions:', body_style))
    id_funcs = [
        'generateElementId(type, prefix?, name?) -&gt; ID format: SRC_TP01, CAB_XXX, LOAD_XXX, BUS_XX, MTR_XXX, QF_XXX',
        'generateDeviceId(type, parentId?) -&gt; DEV_S001, DEV_B001, DEV_L001 etc.',
        'generateConnectionId(fromId?, toId?) -&gt; CONN_{from}_{to}_{counter}',
        'generateValidationId(ruleCode, elementId?) -&gt; VAL_{code}_{elementId}_{timestamp}',
        'resetCounters() - reset all counters',
        'parseElementType(id) -&gt; determine type by ID prefix',
    ]
    for f in id_funcs:
        story.append(Paragraph(f, bullet_style, bulletText='-'))

    story.append(Paragraph(
        '<b>src/lib/utils.ts</b> - Utility cn() for CSS class merging (clsx + tailwind-merge).',
        body_indent_style
    ))

    # 3.5 Types
    story.append(add_heading('<b>3.5 Katalog src/types/index.ts</b>', h2_style, 1))
    story.append(Paragraph('TypeScript type definitions for the project:', body_style))
    type_items = [
        'Element types: ElementType = SOURCE | CABINET | LOAD | BUS | METER | BREAKER | JUNCTION',
        'Device types: DeviceType = SOURCE | BREAKER | LOAD | METER | ATS | SWITCH | TRANSFORMER',
        'Connection types: ConnectionType = CABLE | BUSBAR | JUMPER',
        'Graph: GraphNode, GraphEdge, GraphData',
        'Validation: ValidationStatus, ValidationCategory, ValidationResultData, ValidationIssue, ValidationRule, ValidationContext',
        'Calculations: ImpedanceResult, ShortCircuitResult',
        'References: CableReferenceData, BreakerReferenceData, TransformerReferenceData',
        'API: NetworkStats, ImportResponse, ApiResponse',
        'Forms: AddElementFormData',
    ]
    for item in type_items:
        story.append(Paragraph(item, bullet_style, bulletText='\u2022'))

    # 3.6 Components
    story.append(add_heading('<b>3.6 Katalog src/components/ - UI Components</b>', h2_style, 1))

    story.append(add_heading('<b>3.6.1 NetworkGraph.tsx (Client Component)</b>', h3_style, 2))
    story.append(Paragraph(
        'SVG network topology visualization. Key features:',
        body_style
    ))
    ng_items = [
        '<b>layoutData (useMemo):</b> BFS algorithm for hierarchical layout (Source top -&gt; Load bottom)',
        '<b>bounds (useMemo):</b> automatic graph boundary detection',
        '<b>Pan/Drag:</b> mouse handlers for canvas movement',
        '<b>Zoom:</b> mouse wheel handler + external control via props',
        '<b>SVG rendering:</b> nodes (140x70 blocks with type color bar, icon, name, ID, LIVE/DEAD status, '
        'problem indicator), edges (lines with cable labels, status indicators)',
        '<b>Tooltip:</b> info panel on node/edge hover',
        '<b>Color scheme:</b> adapts to theme (light/dark). Element types have unique colors: '
        'source (yellow-green gradient), bus/junction/cabinet (copper), breaker/load (green), meter (blue)',
    ]
    for item in ng_items:
        story.append(Paragraph(item, bullet_style, bulletText='\u2022'))

    story.append(add_heading('<b>3.6.2 ElementDetails.tsx (Client Component)</b>', h3_style, 2))
    story.append(Paragraph(
        'Selected element/connection details panel. Two modes:',
        body_style
    ))
    story.append(Paragraph(
        '<b>Node mode:</b> Badge with type, ON/OFF and LIVE/DEAD statuses, problem indicator, '
        'device parameters (I_nom, P, Q, cos phi, S, model), validation results, device list.',
        bullet_style, bulletText='\u2022'
    ))
    story.append(Paragraph(
        '<b>Connection mode:</b> cable parameters (brand, cross-section, cores, material, length, I_admissible, '
        'installation), electrical parameters (R, X, Z), calculated parameters (voltage drop, short-circuit current, '
        'load current).',
        bullet_style, bulletText='\u2022'
    ))

    story.append(add_heading('<b>3.6.3 ValidationPanel.tsx (Client Component)</b>', h3_style, 2))
    story.append(Paragraph(
        'Validation issues panel. Two display modes:',
        body_style
    ))
    story.append(Paragraph(
        '<b>compact=true (default):</b> mini-panel in corner with issue count, expandable list of '
        'critical issues (up to 3) and re-check button.',
        bullet_style, bulletText='\u2022'
    ))
    story.append(Paragraph(
        '<b>compact=false:</b> full view with statistics and button.',
        bullet_style, bulletText='\u2022'
    ))

    story.append(add_heading('<b>3.6.4 src/components/ui/ (48 files)</b>', h3_style, 2))
    story.append(Paragraph(
        'shadcn/ui component library: accordion, alert-dialog, alert, aspect-ratio, avatar, badge, '
        'breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, '
        'dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, '
        'pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, '
        'sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toaster, toggle, '
        'toggle-group, tooltip.',
        body_style
    ))

    # 3.7 Hooks
    story.append(add_heading('<b>3.7 Katalog src/hooks/</b>', h2_style, 1))
    story.append(Paragraph(
        '<font name="DejaVuSans">use-mobile.ts</font> - mobile device detection (shadcn/ui)',
        bullet_style, bulletText='\u2022'
    ))
    story.append(Paragraph(
        '<font name="DejaVuSans">use-toast.ts</font> - toast notification management hook (shadcn/ui)',
        bullet_style, bulletText='\u2022'
    ))

    # 3.8 Prisma
    story.append(add_heading('<b>3.8 Katalog prisma/</b>', h2_style, 1))
    story.append(Paragraph(
        '<font name="DejaVuSans">schema.prisma</font> - full database schema (20+ models, SQLite, 637 lines)',
        bullet_style, bulletText='\u2022'
    ))
    story.append(Paragraph(
        '<font name="DejaVuSans">powergrid.db</font> - SQLite database file (512 KB, contains network data)',
        bullet_style, bulletText='\u2022'
    ))

    # 3.9 Public
    story.append(add_heading('<b>3.9 Katalog public/</b>', h2_style, 1))
    story.append(Paragraph(
        'Static images: breaker.jpg, load.jpg, meter.jpg, source.jpg. '
        'Icons: logo.svg, file.svg, globe.svg, next.svg, vercel.svg, window.svg. robots.txt.',
        body_style
    ))

    # 3.10 Upload
    story.append(add_heading('<b>3.10 Katalog upload/</b>', h2_style, 1))
    story.append(Paragraph(
        '<font name="DejaVuSans">input.xlsx</font> - source Excel file for network topology import. '
        'Additional files: network element images.',
        body_style
    ))

    # 3.11 Download
    story.append(add_heading('<b>3.11 Katalog download/</b>', h2_style, 1))
    dl_items = [
        'Documentation: ARCHITECTURE.md, README.md',
        'Data export: chatgpt_chat.json, deepseek_chat.json',
        'Models: network_model.xlsx, network_model_v2..v10',
        'Scripts: network_model_builder.py, network_model_v10_industrial.py',
        'Instructions: Installation guide (DOCX)',
    ]
    for item in dl_items:
        story.append(Paragraph(item, bullet_style, bulletText='\u2022'))

    # ============================================================
    # 4. DATA ARCHITECTURE
    # ============================================================
    story.append(add_heading('<b>4. Arhitektura dannyh</b>', h1_style, 0))

    story.append(add_heading('<b>4.1 Prisma Schema (6 Layers)</b>', h2_style, 1))

    layers_data = [
        [Paragraph('<b>Layer</b>', tbl_header_style), Paragraph('<b>Models</b>', tbl_header_style),
         Paragraph('<b>Description</b>', tbl_header_style)],
        [Paragraph('Layer 1 - Topology', tbl_cell_style), Paragraph('Element, Connection, Network', tbl_cell_style),
         Paragraph('Graph nodes, edges, and link scenarios', tbl_cell_style)],
        [Paragraph('Layer 2 - Equipment', tbl_cell_style), Paragraph('Device, DeviceState, DeviceType', tbl_cell_style),
         Paragraph('Equipment instances, states, and types', tbl_cell_style)],
        [Paragraph('Layer 3 - Control', tbl_cell_style), Paragraph('AtsLogic, Protection, Scenario, Command', tbl_cell_style),
         Paragraph('ATS logic, protection relays, scenarios, commands', tbl_cell_style)],
        [Paragraph('Layer 4 - Calculations', tbl_cell_style), Paragraph('PowerFlow, ShortCircuit, LoadProfile', tbl_cell_style),
         Paragraph('Power flow analysis, SC calculations, load profiles', tbl_cell_style)],
        [Paragraph('Layer 5 - Measurements', tbl_cell_style), Paragraph('Measurement, Alarm, AlarmRule', tbl_cell_style),
         Paragraph('Measurement data, alarms and alarm rules', tbl_cell_style)],
        [Paragraph('Layer 6 - Maintenance', tbl_cell_style), Paragraph('Tariff, Maintenance, EventLog', tbl_cell_style),
         Paragraph('Tariffs, maintenance scheduling, event logging', tbl_cell_style)],
        [Paragraph('References', tbl_cell_style), Paragraph('CableReference, BreakerReference, TransformerReference, ValidationRule', tbl_cell_style),
         Paragraph('Static equipment reference data and validation rules', tbl_cell_style)],
        [Paragraph('Validation', tbl_cell_style), Paragraph('ValidationResult', tbl_cell_style),
         Paragraph('Validation check results storage', tbl_cell_style)],
    ]
    story.extend(make_table(layers_data, [3.5*cm, 5.5*cm, CONTENT_W - 9.0*cm], 'Table 3. Prisma Schema Layers'))

    story.append(add_heading('<b>4.2 Data Flow</b>', h2_style, 1))
    flow_data = [
        [Paragraph('<b>Process</b>', tbl_header_style), Paragraph('<b>Data Flow</b>', tbl_header_style)],
        [Paragraph('Import', tbl_cell_style),
         Paragraph('Excel -&gt; import.service -&gt; Prisma -&gt; SQLite', tbl_cell_style)],
        [Paragraph('Visualization', tbl_cell_style),
         Paragraph('SQLite -&gt; Prisma -&gt; /api/network -&gt; GraphData -&gt; NetworkGraph (SVG)', tbl_cell_style)],
        [Paragraph('Validation', tbl_cell_style),
         Paragraph('SQLite -&gt; Prisma -&gt; validation.service -&gt; /api/validation -&gt; ValidationPanel', tbl_cell_style)],
        [Paragraph('Editing', tbl_cell_style),
         Paragraph('UI -&gt; /api/elements|devices|connections -&gt; Prisma -&gt; SQLite', tbl_cell_style)],
    ]
    story.extend(make_table(flow_data, [3.0*cm, CONTENT_W - 3.0*cm], 'Table 4. Data Flow'))

    # ============================================================
    # 5. API ENDPOINTS DETAILED REFERENCE
    # ============================================================
    story.append(add_heading('<b>5. API-Endpointy - Detailnyj spravochnik</b>', h1_style, 0))

    api_detail_data = [
        [Paragraph('<b>Endpoint</b>', tbl_header_style),
         Paragraph('<b>Method</b>', tbl_header_style),
         Paragraph('<b>Request Body</b>', tbl_header_style),
         Paragraph('<b>Response</b>', tbl_header_style),
         Paragraph('<b>Description</b>', tbl_header_style)],

        [Paragraph('/api/', tbl_cell_style),
         Paragraph('GET', tbl_cell_center),
         Paragraph('None', tbl_cell_style),
         Paragraph('{message: "Hello, world!"}', tbl_cell_style),
         Paragraph('Health check', tbl_cell_style)],

        [Paragraph('/api/network', tbl_cell_style),
         Paragraph('GET', tbl_cell_center),
         Paragraph('None', tbl_cell_style),
         Paragraph('GraphData {nodes, edges}', tbl_cell_style),
         Paragraph('Full network topology', tbl_cell_style)],

        [Paragraph('/api/elements', tbl_cell_style),
         Paragraph('GET', tbl_cell_center),
         Paragraph('None', tbl_cell_style),
         Paragraph('Element[]', tbl_cell_style),
         Paragraph('List all elements', tbl_cell_style)],

        [Paragraph('/api/elements', tbl_cell_style),
         Paragraph('POST', tbl_cell_center),
         Paragraph('AddElementFormData', tbl_cell_style),
         Paragraph('Element', tbl_cell_style),
         Paragraph('Create element', tbl_cell_style)],

        [Paragraph('/api/elements/[id]', tbl_cell_style),
         Paragraph('PUT', tbl_cell_center),
         Paragraph('Partial&lt;Element&gt;', tbl_cell_style),
         Paragraph('Element', tbl_cell_style),
         Paragraph('Update element', tbl_cell_style)],

        [Paragraph('/api/elements/[id]', tbl_cell_style),
         Paragraph('DELETE', tbl_cell_center),
         Paragraph('None', tbl_cell_style),
         Paragraph('{success: true}', tbl_cell_style),
         Paragraph('Delete element', tbl_cell_style)],

        [Paragraph('/api/devices', tbl_cell_style),
         Paragraph('GET', tbl_cell_center),
         Paragraph('None', tbl_cell_style),
         Paragraph('Device[]', tbl_cell_style),
         Paragraph('List all devices', tbl_cell_style)],

        [Paragraph('/api/devices', tbl_cell_style),
         Paragraph('POST', tbl_cell_center),
         Paragraph('DeviceCreateInput', tbl_cell_style),
         Paragraph('Device', tbl_cell_style),
         Paragraph('Create device', tbl_cell_style)],

        [Paragraph('/api/devices/[id]', tbl_cell_style),
         Paragraph('PUT/DELETE', tbl_cell_center),
         Paragraph('Partial&lt;Device&gt; / None', tbl_cell_style),
         Paragraph('Device / {success}', tbl_cell_style),
         Paragraph('Update/Delete device', tbl_cell_style)],

        [Paragraph('/api/connections', tbl_cell_style),
         Paragraph('GET', tbl_cell_center),
         Paragraph('None', tbl_cell_style),
         Paragraph('Connection[]', tbl_cell_style),
         Paragraph('List all connections', tbl_cell_style)],

        [Paragraph('/api/connections', tbl_cell_style),
         Paragraph('POST', tbl_cell_center),
         Paragraph('ConnectionCreateInput', tbl_cell_style),
         Paragraph('Connection', tbl_cell_style),
         Paragraph('Create connection (auto-calculates impedance)', tbl_cell_style)],

        [Paragraph('/api/connections/[id]', tbl_cell_style),
         Paragraph('PUT/DELETE', tbl_cell_center),
         Paragraph('Partial&lt;Connection&gt; / None', tbl_cell_style),
         Paragraph('Connection / {success}', tbl_cell_style),
         Paragraph('Update/Delete connection', tbl_cell_style)],

        [Paragraph('/api/validation', tbl_cell_style),
         Paragraph('GET', tbl_cell_center),
         Paragraph('None', tbl_cell_style),
         Paragraph('ValidationIssue[]', tbl_cell_style),
         Paragraph('List validation issues', tbl_cell_style)],

        [Paragraph('/api/validation', tbl_cell_style),
         Paragraph('POST', tbl_cell_center),
         Paragraph('None', tbl_cell_style),
         Paragraph('{issues, stats}', tbl_cell_style),
         Paragraph('Run validation checks', tbl_cell_style)],

        [Paragraph('/api/import', tbl_cell_style),
         Paragraph('POST', tbl_cell_center),
         Paragraph('FormData (xlsx)', tbl_cell_style),
         Paragraph('ImportResponse', tbl_cell_style),
         Paragraph('Import Excel data', tbl_cell_style)],

        [Paragraph('/api/references', tbl_cell_style),
         Paragraph('GET', tbl_cell_center),
         Paragraph('None', tbl_cell_style),
         Paragraph('{cables, breakers, transformers}', tbl_cell_style),
         Paragraph('Equipment reference data', tbl_cell_style)],
    ]
    story.extend(make_table(
        api_detail_data,
        [2.6*cm, 1.6*cm, 3.2*cm, 3.2*cm, CONTENT_W - 10.6*cm],
        'Table 5. API Endpoints Detailed Reference'
    ))

    # ============================================================
    # 6. VALIDATION RULES
    # ============================================================
    story.append(add_heading('<b>6. Pravila validacii</b>', h1_style, 0))

    val_data = [
        [Paragraph('<b>Code</b>', tbl_header_style),
         Paragraph('<b>Name</b>', tbl_header_style),
         Paragraph('<b>Severity</b>', tbl_header_style),
         Paragraph('<b>Category</b>', tbl_header_style),
         Paragraph('<b>Description</b>', tbl_header_style),
         Paragraph('<b>Formula</b>', tbl_header_style)],

        [Paragraph('CABLE_001', tbl_cell_style),
         Paragraph('Cable capacity check', tbl_cell_style),
         Paragraph('ERROR', tbl_cell_center),
         Paragraph('Capacity', tbl_cell_center),
         Paragraph('Breaker rated current must not exceed cable admissible current', tbl_cell_style),
         Paragraph('I_nom.breaker &lt;= I_adm.cable', tbl_cell_style)],

        [Paragraph('VOLTAGE_001', tbl_cell_style),
         Paragraph('Voltage drop check', tbl_cell_style),
         Paragraph('WARNING', tbl_cell_center),
         Paragraph('Voltage', tbl_cell_center),
         Paragraph('Voltage drop along the cable must not exceed 4% of rated voltage', tbl_cell_style),
         Paragraph('dU% &lt;= 4%', tbl_cell_style)],

        [Paragraph('PROT_001', tbl_cell_style),
         Paragraph('Protection sensitivity check', tbl_cell_style),
         Paragraph('CRITICAL', tbl_cell_center),
         Paragraph('Protection', tbl_cell_center),
         Paragraph('Minimum short-circuit current at the end of the line must be at least 3 times '
                   'the breaker rated current for reliable protection operation', tbl_cell_style),
         Paragraph('I_sc.min &gt;= 3 * I_nom.breaker', tbl_cell_style)],

        [Paragraph('SEL_001', tbl_cell_style),
         Paragraph('Selectivity check', tbl_cell_style),
         Paragraph('WARNING', tbl_cell_center),
         Paragraph('Selectivity', tbl_cell_center),
         Paragraph('Incomer breaker rated current must be greater than or equal to outgoing breaker '
                   'rated current for proper selective coordination', tbl_cell_style),
         Paragraph('I_nom.incomer &gt;= I_nom.outgoing', tbl_cell_style)],
    ]
    story.extend(make_table(
        val_data,
        [1.8*cm, 2.4*cm, 1.6*cm, 1.6*cm, 4.6*cm, CONTENT_W - 12.0*cm],
        'Table 6. Validation Rules'
    ))

    # ============================================================
    # BUILD
    # ============================================================
    doc.multiBuild(story)
    print(f"PDF built successfully: {OUTPUT_PATH}")


if __name__ == '__main__':
    build_document()

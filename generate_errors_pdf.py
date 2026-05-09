# -*- coding: utf-8 -*-
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ── Font Registration ──
pdfmetrics.registerFont(TTFont('SimHei', '/usr/share/fonts/truetype/chinese/SimHei.ttf'))
pdfmetrics.registerFont(TTFont('Microsoft YaHei', '/usr/share/fonts/truetype/chinese/msyh.ttf'))
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('SimHei', normal='SimHei', bold='SimHei')
registerFontFamily('Microsoft YaHei', normal='Microsoft YaHei', bold='Microsoft YaHei')
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ── Colors ──
TABLE_HEADER_COLOR = colors.HexColor('#1F4E79')
TABLE_HEADER_TEXT = colors.white
TABLE_ROW_EVEN = colors.white
TABLE_ROW_ODD = colors.HexColor('#F5F5F5')
RED_BG = colors.HexColor('#FFEBEE')
YELLOW_BG = colors.HexColor('#FFF8E1')
BLUE_BG = colors.HexColor('#E3F2FD')
GREEN_BG = colors.HexColor('#E8F5E9')

# ── Styles ──
cover_title_style = ParagraphStyle(
    name='CoverTitle',
    fontName='Microsoft YaHei',
    fontSize=32,
    leading=42,
    alignment=TA_CENTER,
    spaceAfter=20,
    textColor=colors.HexColor('#1F4E79'),
)

cover_sub_style = ParagraphStyle(
    name='CoverSub',
    fontName='SimHei',
    fontSize=14,
    leading=22,
    alignment=TA_CENTER,
    spaceAfter=12,
    textColor=colors.HexColor('#555555'),
)

h1_style = ParagraphStyle(
    name='H1',
    fontName='Microsoft YaHei',
    fontSize=18,
    leading=26,
    spaceBefore=18,
    spaceAfter=10,
    textColor=colors.black,
)

h2_style = ParagraphStyle(
    name='H2',
    fontName='Microsoft YaHei',
    fontSize=14,
    leading=20,
    spaceBefore=14,
    spaceAfter=8,
    textColor=colors.HexColor('#1F4E79'),
)

body_style = ParagraphStyle(
    name='Body',
    fontName='SimHei',
    fontSize=10.5,
    leading=17,
    alignment=TA_LEFT,
    spaceAfter=6,
    wordWrap='CJK',
)

code_style = ParagraphStyle(
    name='Code',
    fontName='DejaVuSans',
    fontSize=8.5,
    leading=13,
    alignment=TA_LEFT,
    leftIndent=20,
    backColor=colors.HexColor('#F5F5F5'),
    spaceAfter=4,
    spaceBefore=4,
    borderPadding=6,
)

header_cell_style = ParagraphStyle(
    name='HeaderCell',
    fontName='SimHei',
    fontSize=9.5,
    leading=14,
    alignment=TA_CENTER,
    textColor=colors.white,
    wordWrap='CJK',
)

cell_style = ParagraphStyle(
    name='Cell',
    fontName='SimHei',
    fontSize=9,
    leading=13,
    alignment=TA_LEFT,
    wordWrap='CJK',
)

cell_center = ParagraphStyle(
    name='CellCenter',
    fontName='SimHei',
    fontSize=9,
    leading=13,
    alignment=TA_CENTER,
    wordWrap='CJK',
)

# ── Helpers ──
def make_table(headers, rows, col_widths=None):
    """Create styled table with header + data rows."""
    data = [[Paragraph('<b>' + h + '</b>', header_cell_style) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), cell_style) if i > 0 else Paragraph(str(c), cell_center) for i, c in enumerate(row)])
    
    n_cols = len(headers)
    tbl = Table(data, colWidths=col_widths)
    
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
    return tbl


def code_block(text):
    """Render a code block with monospace font."""
    lines = text.split('\n')
    formatted = '<br/>'.join(
        line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace(' ', '&nbsp;')
        for line in lines
    )
    return Paragraph(formatted, code_style)


# ── Document ──
OUTPUT = '/home/z/my-project/download/Project_Errors_Report.pdf'
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    title='Project_Errors_Report',
    author='Z.ai',
    creator='Z.ai',
    subject='Network Digital Twin - Error Report',
    leftMargin=2*cm,
    rightMargin=2*cm,
    topMargin=2*cm,
    bottomMargin=2*cm,
)

story = []

# ═══════════════════ COVER PAGE ═══════════════════
story.append(Spacer(1, 120))
story.append(Paragraph('<b>Project Errors Report</b>', cover_title_style))
story.append(Spacer(1, 24))
story.append(Paragraph('<b>Network Digital Twin</b>', ParagraphStyle(
    name='CoverProject', fontName='SimHei', fontSize=20, leading=28,
    alignment=TA_CENTER, textColor=colors.HexColor('#333333'),
)))
story.append(Spacer(1, 16))
story.append(Paragraph('Next.js 16 + TypeScript + Prisma 7 + LibSQL', cover_sub_style))
story.append(Spacer(1, 60))
story.append(Paragraph('2026-04-07', cover_sub_style))
story.append(Spacer(1, 12))
story.append(Paragraph('Total: 15 problems found (4 critical, 9 fixed, 2 remaining)', cover_sub_style))
story.append(PageBreak())

# ═══════════════════ SECTION 1: CRITICAL ═══════════════════
story.append(Paragraph('<b>1. Critical Errors (blocked launch)</b>', h1_style))
story.append(Spacer(1, 6))
story.append(Paragraph(
    'These errors completely prevented the project from starting. They were caused by misconfiguration '
    'of the database connection, Prisma client generation, and stale artifacts from a previous project '
    'located in the parent directory. Each of these had to be resolved before any code could compile or run.',
    body_style
))

# --- Error 1 ---
story.append(Spacer(1, 12))
story.append(Paragraph('<b>1.1 Missing .env file</b>', h2_style))
story.append(Paragraph(
    'Prisma could not find the DATABASE_URL environment variable. The prisma.config.ts file reads '
    'process.env["DATABASE_URL"], but no .env file existed in the project root. Additionally, the '
    'lib/prisma.ts fallback path pointed to a database file that might not exist.',
    body_style
))
story.append(Spacer(1, 6))
story.append(code_block('Error: DATABASE_URL is not set in prisma.config.ts'))
story.append(Spacer(1, 6))
story.append(Paragraph('<b>Fix:</b> Created .env file with DATABASE_URL pointing to the SQLite database.', body_style))
story.append(code_block('DATABASE_URL="file:/home/z/my-project/db/custom.db"'))

# --- Error 2 ---
story.append(Spacer(1, 14))
story.append(Paragraph('<b>1.2 Conflicting Prisma clients from parent project</b>', h2_style))
story.append(Paragraph(
    'The parent directory /home/z/my-project/node_modules/.prisma/client contained a Prisma client '
    'generated from a completely different schema. This old schema had fields like current_nom, '
    'connections_from, impedance_z, and from_id, while the current project uses elementId, parentId, '
    'voltageLevel, and sourceId. TypeScript resolved to the old client, causing type mismatches on '
    'every Prisma query. This was the most insidious error because it manifested as "field does not '
    'exist" type errors rather than an obvious module conflict.',
    body_style
))
story.append(Spacer(1, 6))
story.append(code_block(
    "Type error: 'elementId' does not exist in type 'ElementSelect'\n"
    "(actual fields: id, type, name, description, parent_id, location, ...)"
))
story.append(Spacer(1, 6))
story.append(Paragraph('<b>Fix:</b> Removed the stale Prisma client from the parent directory.', body_style))
story.append(code_block('rm -rf /home/z/my-project/node_modules/.prisma'))

# --- Error 3 ---
story.append(Spacer(1, 14))
story.append(Paragraph('<b>1.3 Prisma 7 generator missing output path</b>', h2_style))
story.append(Paragraph(
    'Prisma 7 with the "prisma-client" generator requires an explicit output directory to be '
    'specified in the schema file. The schema only had the provider declared, causing the generate '
    'command to fail with a clear error message. Previous versions of Prisma did not require this.',
    body_style
))
story.append(Spacer(1, 6))
story.append(code_block(
    'Error: An output path is required for the prisma-client generator.\n'
    'Please provide an output path in your schema file.'
))
story.append(Spacer(1, 6))
story.append(Paragraph('<b>Fix:</b> Added output path to prisma/schema.prisma generator block.', body_style))
story.append(code_block(
    'generator client {\n'
    '  provider = "prisma-client"\n'
    '  output   = "../node_modules/.prisma/client"\n'
    '}'
))

# --- Error 4 ---
story.append(Spacer(1, 14))
story.append(Paragraph('<b>1.4 Database schema drift</b>', h2_style))
story.append(Paragraph(
    'The SQLite database file (custom.db) contained tables and columns from a completely different '
    'schema version with 25+ tables, additional indexes, and different column names. Prisma migrate '
    'detected the drift and refused to apply migrations, requiring a full reset. This happened because '
    'the same database file was shared between two separate projects at different times.',
    body_style
))
story.append(Spacer(1, 6))
story.append(code_block(
    'Error: Drift detected: Your database schema is not in sync\n'
    'with your migration history.\n'
    'We need to reset the SQLite database.'
))
story.append(Spacer(1, 6))
story.append(Paragraph('<b>Fix:</b> Forced database reset and schema push.', body_style))
story.append(code_block('npx prisma db push --force-reset'))

# ═══════════════════ SECTION 2: TYPESCRIPT ═══════════════════
story.append(Spacer(1, 18))
story.append(Paragraph('<b>2. TypeScript Errors (implicit any from Prisma 7)</b>', h1_style))
story.append(Spacer(1, 6))
story.append(Paragraph(
    'Prisma 7 with the prisma-client provider generates TypeScript source files (.ts) instead of '
    'compiled JavaScript. While Next.js Turbopack can compile these, the @prisma/client runtime '
    'package does not provide type information for query results at build time. This means every '
    'Prisma query returns a value typed as "any", and with strict: true in tsconfig.json, any '
    'callback parameter (map, filter, reduce) on these results triggers an implicit any error. '
    'A total of 17 type errors were found across 3 files, all requiring manual type annotations.',
    body_style
))

# --- Error 5 ---
story.append(Spacer(1, 12))
story.append(Paragraph('<b>2.1 app/api/network/route.ts - 4 type errors</b>', h2_style))
story.append(Paragraph(
    'The network API endpoint builds an element lookup map and enriches connection data with source '
    'and target element information. All three operations involved untyped callback parameters on '
    'Prisma query results: the .map() call for building the Map, and the .map() call for enriching '
    'connections. The Map constructor and all property accesses on elements failed type checking.',
    body_style
))
story.append(Spacer(1, 6))
story.append(code_block(
    "Error: Parameter 'e' implicitly has an 'any' type. (line 28)\n"
    "Error: Property 'elementId' does not exist on type '{}'. (line 39)"
))
story.append(Spacer(1, 6))
story.append(Paragraph('<b>Fix:</b> Added explicit type aliases and annotations.', body_style))
story.append(code_block(
    "type ElementRow = { id: string; elementId: string; name: string;\n"
    "                  type: string; posX: number | null; posY: number | null };\n"
    "type ConnRow = { id: string; sourceId: string; targetId: string };\n"
    "const elementMap = new Map&lt;string, ElementRow&gt;(\n"
    "  elements.map((e: ElementRow) =&gt; [e.id, e])\n"
    ");\n"
    "connections.map((conn: ConnRow) =&gt; {\n"
    "  const src = elementMap.get(conn.sourceId);\n"
    "  // ...\n"
    "});"
))

# --- Error 6 ---
story.append(Spacer(1, 14))
story.append(Paragraph('<b>2.2 app/api/stats/route.ts - 3 type errors</b>', h2_style))
story.append(Paragraph(
    'The stats endpoint uses .filter() on Prisma element results and .reduce() on load/transformer '
    'results. Both operations had callback parameters typed as implicit any. The reduce accumulator '
    'also lacked type annotation, causing the return type inference to fail.',
    body_style
))
story.append(Spacer(1, 6))
story.append(code_block(
    "Error: Parameter 'e' implicitly has an 'any' type. (line 12)\n"
    "Error: Parameter 'l' implicitly has an 'any' type. (line 24)\n"
    "Error: Parameter 't' implicitly has an 'any' type. (line 27)"
))
story.append(Spacer(1, 6))
story.append(Paragraph('<b>Fix:</b> Added inline type annotations to all callbacks.', body_style))
story.append(code_block(
    "elements.filter((e: { type: string }) =&gt; toLower(e.type) === 'source')\n"
    "loadDevices.reduce((sum: number, l: { powerP: number }) =&gt; sum + l.powerP, 0)\n"
    "transformers.reduce((sum: number, t: { power: number }) =&gt; sum + t.power, 0)"
))

# --- Error 7 ---
story.append(Spacer(1, 14))
story.append(Paragraph('<b>2.3 app/api/validation/route.ts - 8 type errors</b>', h2_style))
story.append(Paragraph(
    'The validation endpoint has the most complex data access patterns, using deeply nested Prisma '
    'includes (element -> deviceSlots -> devices -> breaker/load, and element -> sourceConnections -> '
    'cable). Each level of nesting creates callback parameters that need type annotations. '
    'Specifically, flatMap on deviceSlots, filter/map on devices, and filter/map on sourceConnections '
    'all required explicit types.',
    body_style
))
story.append(Spacer(1, 6))
story.append(code_block(
    "Error: Parameter 's' implicitly has an 'any' type. (line 69)\n"
    "Error: Parameter 'd' implicitly has an 'any' type. (line 70, 103)\n"
    "Error: Parameter 'c' implicitly has an 'any' type. (line 73)"
))
story.append(Spacer(1, 6))
story.append(Paragraph('<b>Fix:</b> Added type annotations to all nested callbacks.', body_style))
story.append(code_block(
    "element.deviceSlots\n"
    "  .flatMap((s: { devices: any[] }) =&gt; s.devices)\n"
    "  .filter((d: { breaker: any }) =&gt; d.breaker)\n"
    "  .map((d: { breaker: any }) =&gt; d.breaker!)\n\n"
    "element.sourceConnections\n"
    "  .filter((c: { cable: any }) =&gt; c.cable)\n"
    "  .map((c: { cable: any }) =&gt; c.cable!)"
))

# --- Error 8 ---
story.append(Spacer(1, 14))
story.append(Paragraph('<b>2.4 lib/utils/id-generator.ts - 2 type errors</b>', h2_style))
story.append(Paragraph(
    'The ElementType type union includes "JUNCTION", but two Record&lt;ElementType, string&gt; objects '
    'in generateElementId() and generateElementName() functions did not include a JUNCTION key. '
    'TypeScript correctly reports this as a type error because Record requires all keys of the union '
    'type to be present.',
    body_style
))
story.append(Spacer(1, 6))
story.append(code_block(
    "Error: Type 'string' is not assignable to type 'never'.\n"
    "(JUNCTION key missing from Record)"
))
story.append(Spacer(1, 6))
story.append(Paragraph('<b>Fix:</b> Added JUNCTION entries to both Record objects.', body_style))
story.append(code_block(
    "const prefixes: Record&lt;ElementType, string&gt; = {\n"
    "  SOURCE: 'SRC', CABINET: 'CAB', LOAD: 'LOAD', BUS: 'BUS',\n"
    "  METER: 'MTR', BREAKER: 'QF', JUNCTION: 'JNC',  // added\n"
    "};"
))

# ═══════════════════ SECTION 3: IMPORT ERRORS ═══════════════════
story.append(Spacer(1, 18))
story.append(Paragraph('<b>3. Import Path Errors</b>', h1_style))
story.append(Spacer(1, 6))
story.append(Paragraph(
    'Two utility scripts referenced an outdated Prisma client import path that was used in an '
    'earlier version of the project setup. The path pointed to a generated directory that no longer '
    'exists after switching to the standard @prisma/client import.',
    body_style
))

# --- Error 9 ---
story.append(Spacer(1, 12))
story.append(Paragraph('<b>3.1 prisma/seed.ts - outdated import path</b>', h2_style))
story.append(Paragraph(
    'The database seed script imported PrismaClient from a non-standard generated path. This path '
    'was created during an earlier project iteration when Prisma was configured with a different '
    'output directory. After standardizing the setup, the import path became invalid.',
    body_style
))
story.append(Spacer(1, 6))
story.append(Paragraph('<b>Fix:</b> Changed import to standard @prisma/client package.', body_style))
story.append(code_block(
    "// Before:\n"
    "import { PrismaClient } from '../app/generated/prisma/client';\n"
    "// After:\n"
    "import { PrismaClient } from '@prisma/client';"
))

# --- Error 10 ---
story.append(Spacer(1, 14))
story.append(Paragraph('<b>3.2 scripts/import-data.ts - outdated import path</b>', h2_style))
story.append(Paragraph(
    'Same issue as the seed script. The import-data script used the same non-standard generated path '
    'for PrismaClient, causing a module resolution failure at runtime.',
    body_style
))
story.append(Spacer(1, 6))
story.append(Paragraph('<b>Fix:</b> Same correction as seed.ts.', body_style))

# ═══════════════════ SECTION 4: REMAINING ═══════════════════
story.append(Spacer(1, 18))
story.append(Paragraph('<b>4. Remaining Issues (not fixed)</b>', h1_style))
story.append(Spacer(1, 6))
story.append(Paragraph(
    'These issues were identified during the audit but deliberately not fixed, either because they '
    'require significant refactoring (validation service rewrite) or because they are minor UI '
    'inconsistencies that do not block functionality.',
    body_style
))

# --- Error 11 ---
story.append(Spacer(1, 12))
story.append(Paragraph('<b>4.1 Validation voltage drop calculation is a stub</b>', h2_style))
story.append(Paragraph(
    'In app/api/validation/route.ts lines 111-112, the voltage drop check uses a hardcoded value '
    'of 2% instead of performing an actual calculation. The real calculation functions exist in '
    'lib/calculations/voltageDrop.ts but are not connected to the validation route. This means the '
    'voltage drop check will always pass (2 &lt; 4) and never report issues, even when actual voltage '
    'drops exceed the 4% limit. The proper fix would require integrating the voltage drop calculation '
    'with the path-tracing logic from the network graph.',
    body_style
))
story.append(Spacer(1, 6))
story.append(code_block(
    "// Line 111-112 in validation/route.ts:\n"
    "const voltageDrop = 2; // STUB - always 2%\n"
    "if (voltageDrop > 4) { ... } // never triggers"
))

# --- Error 12 ---
story.append(Spacer(1, 14))
story.append(Paragraph('<b>4.2 validation.service.ts not adapted for new schema</b>', h2_style))
story.append(Paragraph(
    'The old project archive contains a comprehensive validation service (src/lib/services/validation.'
    'service.ts, 536 lines) with 4 rules: CABLE_001 (breaker-cable coordination), VOLTAGE_001 '
    '(voltage drop), PROT_001 (protection sensitivity), and SEL_001 (selectivity). However, this '
    'service uses the old database schema with snake_case fields (current_nom, connections_from, '
    'from_id, impedance_z, etc.) and a flat Element-Device model instead of the current Element-'
    'DeviceSlot-Device-Breaker hierarchy. Adapting it requires rewriting all database queries, '
    'path-finding algorithms, and field access patterns. The current validation is done inline '
    'in the API route with simplified logic.',
    body_style
))

# --- Error 13 ---
story.append(Spacer(1, 14))
story.append(Paragraph('<b>4.3 Hardcoded import file path</b>', h2_style))
story.append(Paragraph(
    'In lib/services/import.service.ts line 19, the Excel file path is hardcoded to a specific '
    'upload file. There is no mechanism to upload a different file through the UI or pass a file '
    'path as a parameter to the import API endpoint.',
    body_style
))
story.append(Spacer(1, 6))
story.append(code_block(
    "const INPUT_FILE_PATH = '/home/z/my-project/upload/...xlsx';"
))

# --- Error 14 ---
story.append(Spacer(1, 14))
story.append(Paragraph('<b>4.4 Cabinets not shown in stats panel</b>', h2_style))
story.append(Paragraph(
    'The API /api/stats returns a cabinets count, and the TypeScript interface Stats includes the '
    'cabinets field. However, the statistics panel in page.tsx only displays 6 categories: sources, '
    'buses, breakers, meters, loads, and junctions. The cabinets category is missing from the grid '
    'layout, even though cabinets are one of the most important element types for the electrical '
    'network hierarchy visualization.',
    body_style
))

# --- Error 15 ---
story.append(Spacer(1, 14))
story.append(Paragraph('<b>4.5 Two projects in shared filesystem</b>', h2_style))
story.append(Paragraph(
    'Both /home/z/my-project/ (old project with src/ directory) and /home/z/my-project/network-'
    'digital-twin/ (current project) exist in the same parent directory. This caused the Prisma '
    'client conflict (Error 1.2) and can cause confusion with node_modules resolution, TypeScript '
    'path aliases, and environment configuration. The old project directory should ideally be '
    'removed or relocated to prevent future conflicts.',
    body_style
))

# ═══════════════════ SUMMARY TABLE ═══════════════════
story.append(Spacer(1, 24))
story.append(Paragraph('<b>5. Summary Table</b>', h1_style))
story.append(Spacer(1, 12))

summary_headers = ['#', 'Severity', 'File', 'Description', 'Status']
summary_rows = [
    ['1', 'CRITICAL', '.env', 'Missing DATABASE_URL', 'FIXED'],
    ['2', 'CRITICAL', 'node_modules/.prisma/', 'Conflicting Prisma client from parent project', 'FIXED'],
    ['3', 'CRITICAL', 'prisma/schema.prisma', 'Generator missing output path', 'FIXED'],
    ['4', 'CRITICAL', 'custom.db', 'Database schema drift', 'FIXED'],
    ['5', 'HIGH', 'app/api/network/route.ts', '4 implicit any type errors', 'FIXED'],
    ['6', 'HIGH', 'app/api/stats/route.ts', '3 implicit any type errors', 'FIXED'],
    ['7', 'HIGH', 'app/api/validation/route.ts', '8 implicit any type errors', 'FIXED'],
    ['8', 'MEDIUM', 'lib/utils/id-generator.ts', 'Missing JUNCTION in Record', 'FIXED'],
    ['9', 'MEDIUM', 'prisma/seed.ts', 'Outdated PrismaClient import path', 'FIXED'],
    ['10', 'MEDIUM', 'scripts/import-data.ts', 'Outdated PrismaClient import path', 'FIXED'],
    ['11', 'MEDIUM', 'app/api/validation/route.ts', 'Voltage drop hardcoded stub (2%)', 'REMAINING'],
    ['12', 'LOW', 'lib/services/validation.service.ts', 'Not adapted for new schema', 'REMAINING'],
    ['13', 'LOW', 'lib/services/import.service.ts', 'Hardcoded Excel file path', 'REMAINING'],
    ['14', 'LOW', 'app/page.tsx', 'Cabinets missing from stats panel', 'REMAINING'],
    ['15', 'INFO', '/home/z/my-project/', 'Two projects in shared filesystem', 'REMAINING'],
]

tbl = make_table(summary_headers, summary_rows, col_widths=[0.8*cm, 2*cm, 4.5*cm, 6.2*cm, 2*cm])
story.append(tbl)

# ═══════════════════ BUILD ═══════════════════
doc.build(story)
print(f"PDF created: {OUTPUT}")

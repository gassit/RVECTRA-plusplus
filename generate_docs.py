#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Documentation Generator for Network Digital Twin Application
"""

from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    ListFlowable, ListItem
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
import os

# Register fonts
pdfmetrics.registerFont(TTFont('SimHei', '/usr/share/fonts/truetype/chinese/SimHei.ttf'))
pdfmetrics.registerFont(TTFont('Microsoft YaHei', '/usr/share/fonts/truetype/chinese/msyh.ttf'))
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))

# Register font families for bold support
registerFontFamily('SimHei', normal='SimHei', bold='SimHei')
registerFontFamily('Microsoft YaHei', normal='Microsoft YaHei', bold='Microsoft YaHei')
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman')

# Create styles
styles = getSampleStyleSheet()

# Cover title style
cover_title_style = ParagraphStyle(
    name='CoverTitle',
    fontName='Microsoft YaHei',
    fontSize=36,
    leading=44,
    alignment=TA_CENTER,
    spaceAfter=36
)

cover_subtitle_style = ParagraphStyle(
    name='CoverSubtitle',
    fontName='SimHei',
    fontSize=18,
    leading=26,
    alignment=TA_CENTER,
    spaceAfter=24
)

cover_info_style = ParagraphStyle(
    name='CoverInfo',
    fontName='SimHei',
    fontSize=14,
    leading=22,
    alignment=TA_CENTER,
    spaceAfter=12
)

# Heading styles
h1_style = ParagraphStyle(
    name='Heading1RU',
    fontName='Microsoft YaHei',
    fontSize=18,
    leading=24,
    alignment=TA_LEFT,
    spaceBefore=18,
    spaceAfter=12,
    textColor=colors.HexColor('#1F4E79')
)

h2_style = ParagraphStyle(
    name='Heading2RU',
    fontName='Microsoft YaHei',
    fontSize=14,
    leading=20,
    alignment=TA_LEFT,
    spaceBefore=14,
    spaceAfter=8,
    textColor=colors.HexColor('#2E75B6')
)

h3_style = ParagraphStyle(
    name='Heading3RU',
    fontName='SimHei',
    fontSize=12,
    leading=16,
    alignment=TA_LEFT,
    spaceBefore=10,
    spaceAfter=6,
    textColor=colors.HexColor('#404040')
)

# Body style
body_style = ParagraphStyle(
    name='BodyRU',
    fontName='SimHei',
    fontSize=10.5,
    leading=18,
    alignment=TA_LEFT,
    firstLineIndent=24,
    spaceBefore=0,
    spaceAfter=8,
    wordWrap='CJK'
)

# Code style
code_style = ParagraphStyle(
    name='CodeRU',
    fontName='DejaVuSans',
    fontSize=9,
    leading=12,
    alignment=TA_LEFT,
    spaceBefore=4,
    spaceAfter=4,
    backColor=colors.HexColor('#F5F5F5'),
    leftIndent=12,
    rightIndent=12
)

# Table cell styles
tbl_header_style = ParagraphStyle(
    name='TableHeader',
    fontName='SimHei',
    fontSize=10,
    textColor=colors.white,
    alignment=TA_CENTER,
    wordWrap='CJK'
)

tbl_cell_style = ParagraphStyle(
    name='TableCell',
    fontName='SimHei',
    fontSize=9,
    textColor=colors.black,
    alignment=TA_LEFT,
    wordWrap='CJK'
)

tbl_cell_center = ParagraphStyle(
    name='TableCellCenter',
    fontName='SimHei',
    fontSize=9,
    textColor=colors.black,
    alignment=TA_CENTER,
    wordWrap='CJK'
)

# List style
list_style = ParagraphStyle(
    name='ListRU',
    fontName='SimHei',
    fontSize=10.5,
    leading=16,
    alignment=TA_LEFT,
    leftIndent=24,
    spaceBefore=2,
    spaceAfter=2,
    wordWrap='CJK'
)

def create_table(data, col_widths):
    """Create a styled table"""
    # Wrap all cells in Paragraph
    wrapped_data = []
    for i, row in enumerate(data):
        wrapped_row = []
        for j, cell in enumerate(row):
            if i == 0:
                wrapped_row.append(Paragraph(f'<b>{cell}</b>', tbl_header_style))
            else:
                style = tbl_cell_center if j == 0 else tbl_cell_style
                wrapped_row.append(Paragraph(str(cell), style))
        wrapped_data.append(wrapped_row)
    
    table = Table(wrapped_data, colWidths=col_widths)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F4E79')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8F8F8')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return table

def build_document():
    """Build the complete documentation PDF"""
    
    output_path = '/home/z/my-project/download/Network_Digital_Twin_Documentation.pdf'
    
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2*cm,
        rightMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm,
        title='Network Digital Twin Documentation',
        author='Z.ai',
        creator='Z.ai',
        subject='Technical documentation for Network Digital Twin application'
    )
    
    story = []
    
    # ========== COVER PAGE ==========
    story.append(Spacer(1, 100))
    story.append(Paragraph('<b>ЦИФРОВОЙ ДВОЙНИК ЭЛЕКТРОСЕТИ</b>', cover_title_style))
    story.append(Spacer(1, 24))
    story.append(Paragraph('Техническая документация', cover_subtitle_style))
    story.append(Spacer(1, 48))
    story.append(Paragraph('Версия 1.0', cover_info_style))
    story.append(Paragraph('April 2026', cover_info_style))
    story.append(Spacer(1, 72))
    story.append(Paragraph('Система моделирования и визуализации электрической сети', cover_info_style))
    story.append(PageBreak())
    
    # ========== TABLE OF CONTENTS ==========
    story.append(Paragraph('<b>СОДЕРЖАНИЕ</b>', h1_style))
    story.append(Spacer(1, 12))
    
    toc_items = [
        ('1. Введение', '3'),
        ('2. Архитектура системы', '4'),
        ('   2.1. Технологический стек', '4'),
        ('   2.2. Структура проекта', '5'),
        ('3. База данных', '6'),
        ('   3.1. Схема данных', '6'),
        ('   3.2. Основные модели', '7'),
        ('4. API документация', '9'),
        ('   4.1. Network API', '9'),
        ('   4.2. Stats API', '10'),
        ('   4.3. Validation API', '11'),
        ('   4.4. Import API', '12'),
        ('   4.5. References API', '13'),
        ('5. Компоненты интерфейса', '14'),
        ('   5.1. NetworkGraph', '14'),
        ('   5.2. ThemeProvider', '15'),
        ('6. Инструкция по развертыванию', '16'),
        ('   6.1. Требования', '16'),
        ('   6.2. Установка', '17'),
        ('   6.3. Конфигурация', '18'),
        ('   6.4. Запуск', '19'),
        ('7. Импорт данных', '20'),
        ('8. Заключение', '21'),
    ]
    
    for item, page in toc_items:
        story.append(Paragraph(f'{item} {"." * (60 - len(item))} {page}', list_style))
    
    story.append(PageBreak())
    
    # ========== 1. INTRODUCTION ==========
    story.append(Paragraph('<b>1. ВВЕДЕНИЕ</b>', h1_style))
    story.append(Spacer(1, 12))
    
    intro_text = """
    Цифровой двойник электросети — это веб-приложение для моделирования, визуализации и анализа электрических сетей. 
    Система предоставляет интерактивный графический интерфейс для отображения топологии сети, включает инструменты 
    валидации конфигурации и поддержки принятия решений при проектировании и эксплуатации электроустановок.
    """
    story.append(Paragraph(intro_text.strip(), body_style))
    story.append(Spacer(1, 8))
    
    features_text = """
    Основные функциональные возможности системы включают визуализацию топологии электрической сети в виде 
    интерактивного графа с поддержкой масштабирования и навигации, отображение информации об элементах сети 
    (источники питания, распределительные устройства, автоматические выключатели, счетчики, нагрузки), 
    расчет и отображение статистических показателей сети, автоматическую валидацию конфигурации сети 
    с проверкой правил координации защит, а также импорт данных из внешних источников формата Excel.
    """
    story.append(Paragraph(features_text.strip(), body_style))
    story.append(Spacer(1, 12))
    
    # Stats table
    story.append(Paragraph('<b>Характеристики системы:</b>', h3_style))
    stats_data = [
        ['Параметр', 'Значение'],
        ['Элементы сети', '192'],
        ['Связи между элементами', '137'],
        ['Источники питания', '8'],
        ['Распределительные шины', '5'],
        ['Автоматические выключатели', '137'],
        ['Счетчики электроэнергии', '6'],
        ['Нагрузки', '11'],
        ['Узлы соединений', '25'],
    ]
    story.append(Spacer(1, 8))
    story.append(create_table(stats_data, [6*cm, 6*cm]))
    story.append(PageBreak())
    
    # ========== 2. ARCHITECTURE ==========
    story.append(Paragraph('<b>2. АРХИТЕКТУРА СИСТЕМЫ</b>', h1_style))
    story.append(Spacer(1, 12))
    
    arch_text = """
    Система построена на современной веб-архитектуре с использованием фреймворка Next.js 16, который обеспечивает 
    серверный рендеринг и API маршрутизацию. Клиентская часть реализована на React 19 с использованием TypeScript 
    для статической типизации. Визуализация графа сети выполнена с помощью библиотеки AntV G6 версии 5.1, 
    предоставляющей широкие возможности для интерактивной работы с графическими структурами.
    """
    story.append(Paragraph(arch_text.strip(), body_style))
    story.append(Spacer(1, 12))
    
    # 2.1 Tech Stack
    story.append(Paragraph('<b>2.1. Технологический стек</b>', h2_style))
    story.append(Spacer(1, 8))
    
    tech_data = [
        ['Компонент', 'Технология', 'Версия'],
        ['Фреймворк', 'Next.js', '16.2.1'],
        ['UI библиотека', 'React', '19.2.4'],
        ['Язык программирования', 'TypeScript', '5.x'],
        ['Визуализация графов', 'AntV G6', '5.1.0'],
        ['Стили', 'Tailwind CSS', '4.x'],
        ['ORM', 'Prisma', '7.6.0'],
        ['База данных', 'SQLite (LibSQL)', '-'],
        ['Обработка Excel', 'xlsx', '0.18.5'],
    ]
    story.append(Spacer(1, 8))
    story.append(create_table(tech_data, [4*cm, 5*cm, 3*cm]))
    story.append(Spacer(1, 12))
    
    arch_detail = """
    Выбор технологического стека обусловлен требованиями к производительности, масштабируемости и удобству 
    разработки. Next.js обеспечивает оптимизированную сборку и горячую перезагрузку в процессе разработки. 
    Prisma ORM упрощает работу с базой данных и обеспечивает типобезопасность на уровне приложения. 
    Tailwind CSS позволяет быстро создавать адаптивные интерфейсы без написания пользовательских CSS-стилей.
    """
    story.append(Paragraph(arch_detail.strip(), body_style))
    story.append(PageBreak())
    
    # 2.2 Project Structure
    story.append(Paragraph('<b>2.2. Структура проекта</b>', h2_style))
    story.append(Spacer(1, 8))
    
    structure_text = """
    Проект организован в соответствии со стандартной структурой Next.js приложения с использованием App Router. 
    Основные директории включают app для страниц и API маршрутов, components для React компонентов, 
    lib для утилит и конфигурации базы данных, prisma для схемы и миграций базы данных, 
    public для статических ресурсов и scripts для служебных скриптов.
    """
    story.append(Paragraph(structure_text.strip(), body_style))
    story.append(Spacer(1, 12))
    
    struct_data = [
        ['Директория', 'Назначение'],
        ['app/', 'Страницы и API маршруты'],
        ['app/api/', 'REST API endpoints'],
        ['app/page.tsx', 'Главная страница приложения'],
        ['app/layout.tsx', 'Корневой layout'],
        ['components/', 'React компоненты'],
        ['components/network/', 'Компоненты визуализации сети'],
        ['components/providers/', 'React контексты'],
        ['lib/', 'Утилиты и конфигурация'],
        ['prisma/', 'Схема и миграции БД'],
        ['scripts/', 'Скрипты импорта данных'],
    ]
    story.append(Spacer(1, 8))
    story.append(create_table(struct_data, [5*cm, 8*cm]))
    story.append(PageBreak())
    
    # ========== 3. DATABASE ==========
    story.append(Paragraph('<b>3. БАЗА ДАННЫХ</b>', h1_style))
    story.append(Spacer(1, 12))
    
    db_text = """
    Система использует SQLite в качестве базы данных с адаптером LibSQL от Turso. Это решение обеспечивает 
    простоту развертывания и достаточную производительность для задач моделирования электрических сетей. 
    Prisma ORM используется для абстракции работы с базой данных и автоматической генерации TypeScript типов.
    """
    story.append(Paragraph(db_text.strip(), body_style))
    story.append(Spacer(1, 12))
    
    # 3.1 Schema
    story.append(Paragraph('<b>3.1. Схема данных</b>', h2_style))
    story.append(Spacer(1, 8))
    
    schema_text = """
    База данных содержит модели для хранения информации об элементах сети, связях между ними, устройствах 
    и справочных данных. Схема спроектирована с учетом требований нормализации и поддержки сложных отношений 
    между сущностями. Всего определено 16 моделей данных, охватывающих все аспекты моделирования электросети.
    """
    story.append(Paragraph(schema_text.strip(), body_style))
    story.append(Spacer(1, 12))
    
    models_data = [
        ['Модель', 'Описание'],
        ['Element', 'Элементы сети (узлы графа)'],
        ['Connection', 'Связи между элементами'],
        ['Device', 'Устройства в слотах элементов'],
        ['Breaker', 'Автоматические выключатели'],
        ['Meter', 'Счетчики электроэнергии'],
        ['Transformer', 'Трансформаторы'],
        ['Load', 'Нагрузки'],
        ['Cable', 'Кабельные линии'],
        ['DeviceSlot', 'Слоты для устройств'],
        ['CableReference', 'Справочник кабелей'],
        ['BreakerReference', 'Справочник автоматов'],
        ['TransformerReference', 'Справочник трансформаторов'],
        ['ValidationRule', 'Правила валидации'],
        ['ValidationResult', 'Результаты валидации'],
        ['CalculatedParams', 'Расчетные параметры'],
        ['Alarm', 'Аварийные события'],
        ['MeterReading', 'Показания счетчиков'],
    ]
    story.append(Spacer(1, 8))
    story.append(create_table(models_data, [4*cm, 9*cm]))
    story.append(PageBreak())
    
    # 3.2 Main Models
    story.append(Paragraph('<b>3.2. Основные модели</b>', h2_style))
    story.append(Spacer(1, 8))
    
    element_text = """
    Модель Element является центральной в схеме данных и представляет узлы электрической сети. Каждый элемент 
    имеет уникальный идентификатор elementId, имя name и тип type. Поддерживаемые типы включают source 
    (источник питания), bus (шина распределения), breaker (автоматический выключатель), meter (счетчик), 
    load (нагрузка) и junction (узел соединения). Элементы могут образовывать иерархическую структуру 
    через поле parentId.
    """
    story.append(Paragraph(element_text.strip(), body_style))
    story.append(Spacer(1, 12))
    
    element_fields = [
        ['Поле', 'Тип', 'Описание'],
        ['id', 'String', 'Уникальный идентификатор (CUID)'],
        ['elementId', 'String', 'Технический идентификатор элемента'],
        ['name', 'String', 'Наименование элемента'],
        ['type', 'String', 'Тип элемента (source/bus/breaker/meter/load/junction)'],
        ['parentId', 'String?', 'ID родительского элемента'],
        ['voltageLevel', 'Float?', 'Уровень напряжения (кВ)'],
        ['posX', 'Float?', 'Координата X для визуализации'],
        ['posY', 'Float?', 'Координата Y для визуализации'],
    ]
    story.append(Paragraph('<b>Поля модели Element:</b>', h3_style))
    story.append(Spacer(1, 8))
    story.append(create_table(element_fields, [3*cm, 2.5*cm, 7.5*cm]))
    story.append(Spacer(1, 12))
    
    connection_text = """
    Модель Connection описывает связи между элементами сети. Каждая связь имеет источник sourceId и цель 
    targetId, ссылающиеся на элементы. Связь может включать кабель cableId для хранения информации о линии. 
    Порядок связей от одного элемента задается полем order для корректного отображения топологии.
    """
    story.append(Paragraph(connection_text.strip(), body_style))
    story.append(PageBreak())
    
    # ========== 4. API DOCUMENTATION ==========
    story.append(Paragraph('<b>4. API ДОКУМЕНТАЦИЯ</b>', h1_style))
    story.append(Spacer(1, 12))
    
    api_intro = """
    Приложение предоставляет REST API для взаимодействия с данными сети. Все endpoints возвращают данные 
    в формате JSON. API построен на основе Next.js API Routes и размещен в директории app/api/.
    """
    story.append(Paragraph(api_intro.strip(), body_style))
    story.append(Spacer(1, 12))
    
    # 4.1 Network API
    story.append(Paragraph('<b>4.1. Network API</b>', h2_style))
    story.append(Spacer(1, 8))
    
    network_api = """
    Endpoint /api/network предоставляет данные о топологии сети для визуализации графа. Метод GET возвращает 
    массив элементов elements и массив связей connections. Каждый элемент содержит id, elementId, name, type 
    и опциональные координаты posX, posY. Каждая связь содержит id, sourceId, targetId и информацию 
    о связанных элементах source и target.
    """
    story.append(Paragraph(network_api.strip(), body_style))
    story.append(Spacer(1, 8))
    
    network_data = [
        ['Метод', 'Endpoint', 'Описание'],
        ['GET', '/api/network', 'Получить топологию сети'],
    ]
    story.append(Spacer(1, 8))
    story.append(create_table(network_data, [2.5*cm, 4*cm, 6.5*cm]))
    story.append(Spacer(1, 12))
    
    response_example = """
    Пример ответа содержит объект с полями elements (массив элементов сети) и connections (массив связей). 
    Каждый элемент включает поля id, elementId, name, type, posX, posY. Каждая связь включает id, sourceId, 
    targetId и вложенные объекты source и target с информацией о связанных элементах.
    """
    story.append(Paragraph(response_example.strip(), body_style))
    story.append(PageBreak())
    
    # 4.2 Stats API
    story.append(Paragraph('<b>4.2. Stats API</b>', h2_style))
    story.append(Spacer(1, 8))
    
    stats_api = """
    Endpoint /api/stats возвращает статистические показатели сети. Метод GET возвращает объект с полями 
    elements (количество элементов по типам), power (мощность: установленная, потребляемая, свободная) 
    и connections (общее количество связей). Используется для отображения сводной информации на главной странице.
    """
    story.append(Paragraph(stats_api.strip(), body_style))
    story.append(Spacer(1, 8))
    
    stats_fields = [
        ['Поле', 'Тип', 'Описание'],
        ['elements.sources', 'number', 'Количество источников питания'],
        ['elements.buses', 'number', 'Количество распределительных шин'],
        ['elements.breakers', 'number', 'Количество автоматов'],
        ['elements.meters', 'number', 'Количество счетчиков'],
        ['elements.loads', 'number', 'Количество нагрузок'],
        ['elements.junctions', 'number', 'Количество узлов соединений'],
        ['elements.total', 'number', 'Общее количество элементов'],
        ['power.total', 'number', 'Установленная мощность (кВА)'],
        ['power.consumed', 'number', 'Потребляемая мощность (кВА)'],
        ['power.free', 'number', 'Свободная мощность (кВА)'],
        ['connections', 'number', 'Количество связей'],
    ]
    story.append(Spacer(1, 8))
    story.append(create_table(stats_fields, [4*cm, 2.5*cm, 6.5*cm]))
    story.append(Spacer(1, 12))
    
    # 4.3 Validation API
    story.append(Paragraph('<b>4.3. Validation API</b>', h2_style))
    story.append(Spacer(1, 8))
    
    validation_api = """
    Endpoint /api/validation выполняет автоматическую проверку конфигурации сети на соответствие 
    нормативным требованиям. Метод GET возвращает список правил валидации rules, список выявленных 
    проблем issues и статистику stats. Реализованные правила включают проверку координации 
    автомат-кабель, падение напряжения, ток короткого замыкания и селективность защит.
    """
    story.append(Paragraph(validation_api.strip(), body_style))
    story.append(Spacer(1, 8))
    
    validation_rules = [
        ['Правило', 'Описание', 'Критерий'],
        ['breaker_cable_coordination', 'Координация автомат-кабель', 'Iном.выкл <= Iдоп.кабеля'],
        ['voltage_drop', 'Падение напряжения', 'dU <= 4%'],
        ['short_circuit', 'Ток КЗ в конце линии', 'Iкз >= 3 x Iном'],
        ['selectivity', 'Селективность защит', 'Iном.выш >= Iном.нижн'],
    ]
    story.append(Spacer(1, 8))
    story.append(create_table(validation_rules, [4.5*cm, 4*cm, 4.5*cm]))
    story.append(PageBreak())
    
    # 4.4 Import API
    story.append(Paragraph('<b>4.4. Import API</b>', h2_style))
    story.append(Spacer(1, 8))
    
    import_api = """
    Endpoint /api/import обеспечивает импорт данных сети из файлов Excel. Метод POST принимает multipart/form-data 
    с файлом в поле file. Система автоматически определяет типы элементов по ключевым словам в наименованиях 
    и создает соответствующие записи в базе данных. Поддерживаемые поля в файле: ID, Название, Тип, 
    Напряжение, Мощность, Категория.
    """
    story.append(Paragraph(import_api.strip(), body_style))
    story.append(Spacer(1, 8))
    
    import_mapping = [
        ['Ключевое слово', 'Тип элемента'],
        ['source, источник, тп, трансформатор', 'source'],
        ['bus, шина, сборка', 'bus'],
        ['breaker, автомат, выключатель', 'breaker'],
        ['meter, счетчик, учет', 'meter'],
        ['load, нагрузка, потребитель', 'load'],
    ]
    story.append(Spacer(1, 8))
    story.append(create_table(import_mapping, [6*cm, 6*cm]))
    story.append(Spacer(1, 12))
    
    # 4.5 References API
    story.append(Paragraph('<b>4.5. References API</b>', h2_style))
    story.append(Spacer(1, 8))
    
    refs_api = """
    Endpoint /api/references предоставляет доступ к справочным данным. Метод GET возвращает справочники 
    кабелей cables, автоматических выключателей breakers и трансформаторов transformers. Метод POST 
    позволяет создавать новые записи в справочниках. Тело запроса должно содержать поле type 
    (cable/breaker/transformer) и поле data с данными для создания.
    """
    story.append(Paragraph(refs_api.strip(), body_style))
    story.append(PageBreak())
    
    # ========== 5. UI COMPONENTS ==========
    story.append(Paragraph('<b>5. КОМПОНЕНТЫ ИНТЕРФЕЙСА</b>', h1_style))
    story.append(Spacer(1, 12))
    
    ui_intro = """
    Пользовательский интерфейс приложения построен на React компонентах с использованием Tailwind CSS 
    для стилизации. Основные компоненты включают NetworkGraph для визуализации графа сети и ThemeProvider 
    для управления цветовой схемой приложения.
    """
    story.append(Paragraph(ui_intro.strip(), body_style))
    story.append(Spacer(1, 12))
    
    # 5.1 NetworkGraph
    story.append(Paragraph('<b>5.1. NetworkGraph</b>', h2_style))
    story.append(Spacer(1, 8))
    
    graph_comp = """
    Компонент NetworkGraph является основным элементом визуализации сети. Он использует библиотеку AntV G6 
    для рендеринга интерактивного графа. Компонент принимает props data с топологией сети и опциональный 
    callback onNodeClick для обработки выбора узла. Граф поддерживает drag-canvas для перемещения холста, 
    zoom-canvas для масштабирования и drag-element для перетаскивания узлов.
    """
    story.append(Paragraph(graph_comp.strip(), body_style))
    story.append(Spacer(1, 8))
    
    graph_features = [
        ['Функция', 'Описание'],
        ['drag-canvas', 'Перетаскивание холста мышью'],
        ['zoom-canvas', 'Масштабирование колесом мыши'],
        ['drag-element', 'Перемещение узлов'],
        ['fitView', 'Автоматическое масштабирование по размеру'],
        ['node:click', 'Событие выбора узла'],
    ]
    story.append(Spacer(1, 8))
    story.append(create_table(graph_features, [4*cm, 8*cm]))
    story.append(Spacer(1, 12))
    
    node_styles = """
    Стили узлов определяются функцией getNodeStyle на основе типа элемента и текущей цветовой схемы. 
    Каждый тип элемента имеет уникальное цветовое оформление: источники питания (source) — желтый, 
    шины (bus) — оранжевый, автоматы (breaker) — серый, счетчики (meter) — синий, нагрузки (load) — 
    темно-серый, узлы соединений (junction) — светло-серый.
    """
    story.append(Paragraph(node_styles.strip(), body_style))
    story.append(PageBreak())
    
    # 5.2 ThemeProvider
    story.append(Paragraph('<b>5.2. ThemeProvider</b>', h2_style))
    story.append(Spacer(1, 8))
    
    theme_comp = """
    Компонент ThemeProvider реализует управление цветовой схемой приложения. Поддерживаются светлая (light) 
    и темная (dark) темы. Выбор темы сохраняется в localStorage и применяется при загрузке приложения. 
    Компонент предоставляет контекст ThemeContext с текущей темой theme и функцией переключения toggleTheme. 
    Хук useTheme позволяет получить доступ к контексту из дочерних компонентов.
    """
    story.append(Paragraph(theme_comp.strip(), body_style))
    story.append(Spacer(1, 12))
    
    # ========== 6. DEPLOYMENT ==========
    story.append(Paragraph('<b>6. ИНСТРУКЦИЯ ПО РАЗВЕРТЫВАНИЮ</b>', h1_style))
    story.append(Spacer(1, 12))
    
    # 6.1 Requirements
    story.append(Paragraph('<b>6.1. Требования</b>', h2_style))
    story.append(Spacer(1, 8))
    
    req_text = """
    Для развертывания приложения необходимо наличие Node.js версии 18 или выше, менеджера пакетов npm 
    или yarn, а также Git для клонирования репозитория. Приложение использует SQLite, поэтому 
    дополнительная установка сервера баз данных не требуется.
    """
    story.append(Paragraph(req_text.strip(), body_style))
    story.append(Spacer(1, 8))
    
    req_data = [
        ['Компонент', 'Требование'],
        ['Node.js', '>= 18.0.0'],
        ['npm', '>= 9.0.0'],
        ['Операционная система', 'Linux / macOS / Windows'],
        ['Дисковое пространство', '>= 500 MB'],
        ['Оперативная память', '>= 512 MB'],
    ]
    story.append(Spacer(1, 8))
    story.append(create_table(req_data, [5*cm, 7*cm]))
    story.append(PageBreak())
    
    # 6.2 Installation
    story.append(Paragraph('<b>6.2. Установка</b>', h2_style))
    story.append(Spacer(1, 8))
    
    install_steps = """
    Процесс установки состоит из нескольких этапов. Сначала необходимо клонировать репозиторий проекта 
    командой git clone. Затем перейти в директорию проекта и установить зависимости командой npm install. 
    После этого требуется инициализировать базу данных командой npx prisma db push для создания таблиц 
    на основе схемы Prisma. При наличии начальных данных можно выполнить сидинг командой npx prisma db seed.
    """
    story.append(Paragraph(install_steps.strip(), body_style))
    story.append(Spacer(1, 12))
    
    install_commands = [
        ['Шаг', 'Команда', 'Описание'],
        ['1', 'git clone <repo>', 'Клонирование репозитория'],
        ['2', 'cd network-digital-twin', 'Переход в директорию'],
        ['3', 'npm install', 'Установка зависимостей'],
        ['4', 'npx prisma generate', 'Генерация Prisma клиента'],
        ['5', 'npx prisma db push', 'Создание структуры БД'],
        ['6', 'npm run dev', 'Запуск в режиме разработки'],
    ]
    story.append(Spacer(1, 8))
    story.append(create_table(install_commands, [1.5*cm, 5.5*cm, 5*cm]))
    story.append(Spacer(1, 12))
    
    # 6.3 Configuration
    story.append(Paragraph('<b>6.3. Конфигурация</b>', h2_style))
    story.append(Spacer(1, 8))
    
    config_text = """
    Конфигурация приложения осуществляется через переменные окружения. Создайте файл .env.local в корневой 
    директории проекта. Основная переменная DATABASE_URL определяет путь к файлу базы данных SQLite. 
    По умолчанию используется файл /home/z/my-project/db/custom.db. Для продакшн развертывания 
    рекомендуется также настроить переменную NEXT_PUBLIC_API_URL для указания базового URL API.
    """
    story.append(Paragraph(config_text.strip(), body_style))
    story.append(Spacer(1, 8))
    
    env_vars = [
        ['Переменная', 'Значение по умолчанию', 'Описание'],
        ['DATABASE_URL', 'file:/home/z/my-project/db/custom.db', 'Путь к БД'],
        ['NODE_ENV', 'development', 'Режим работы'],
        ['PORT', '3000', 'Порт сервера'],
    ]
    story.append(Spacer(1, 8))
    story.append(create_table(env_vars, [4*cm, 5*cm, 3*cm]))
    story.append(PageBreak())
    
    # 6.4 Running
    story.append(Paragraph('<b>6.4. Запуск</b>', h2_style))
    story.append(Spacer(1, 8))
    
    run_text = """
    Приложение поддерживает несколько режимов запуска. Для разработки используйте npm run dev — запускает 
    сервер с горячей перезагрузкой на порту 3000. Для продакшн сначала выполните npm run build для сборки 
    оптимизированной версии, затем npm run start для запуска продакшн сервера. Дополнительно доступна 
    команда npm run lint для проверки кода линтером.
    """
    story.append(Paragraph(run_text.strip(), body_style))
    story.append(Spacer(1, 8))
    
    npm_scripts = [
        ['Команда', 'Описание'],
        ['npm run dev', 'Запуск в режиме разработки с горячей перезагрузкой'],
        ['npm run build', 'Сборка продакшн версии'],
        ['npm run start', 'Запуск продакшн сервера'],
        ['npm run lint', 'Проверка кода ESLint'],
    ]
    story.append(Spacer(1, 8))
    story.append(create_table(npm_scripts, [4*cm, 8*cm]))
    story.append(Spacer(1, 12))
    
    access_text = """
    После успешного запуска приложение будет доступно по адресу http://localhost:3000. Главная страница 
    отображает граф сети с панелью инструментов сверху. В левой части расположены кнопки масштабирования, 
    внизу — легенда типов элементов и статистика сети. В правой верхней части находится кнопка переключения 
    темы и индикатор валидации сети.
    """
    story.append(Paragraph(access_text.strip(), body_style))
    story.append(PageBreak())
    
    # ========== 7. DATA IMPORT ==========
    story.append(Paragraph('<b>7. ИМПОРТ ДАННЫХ</b>', h1_style))
    story.append(Spacer(1, 12))
    
    import_text = """
    Система поддерживает импорт данных сети из файлов Excel через API endpoint /api/import. Файл должен 
    содержать листы с данными об элементах сети. Обязательные колонки: ID (идентификатор элемента), 
    Название (имя элемента), Тип (тип элемента). Дополнительные колонки: Напряжение (уровень напряжения), 
    Мощность (для нагрузок), Категория (категория надежности).
    """
    story.append(Paragraph(import_text.strip(), body_style))
    story.append(Spacer(1, 12))
    
    import_process = """
    Процесс импорта автоматически определяет типы элементов по ключевым словам в поле Тип или Название. 
    При обнаружении мощности создается запись нагрузки с автоматическим расчетом реактивной мощности 
    (cos phi = 0.95). Результат импорта возвращает количество успешно импортированных записей и количество ошибок.
    """
    story.append(Paragraph(import_process.strip(), body_style))
    story.append(Spacer(1, 12))
    
    excel_cols = [
        ['Колонка', 'Обязательность', 'Описание'],
        ['ID', 'Да', 'Уникальный идентификатор элемента'],
        ['Название', 'Да', 'Наименование элемента'],
        ['Тип', 'Нет', 'Тип элемента (автоопределение)'],
        ['Напряжение', 'Нет', 'Уровень напряжения (кВ)'],
        ['Мощность', 'Нет', 'Активная мощность (кВт)'],
        ['Категория', 'Нет', 'Категория надежности (1-3)'],
    ]
    story.append(Spacer(1, 8))
    story.append(create_table(excel_cols, [3*cm, 3*cm, 6*cm]))
    story.append(PageBreak())
    
    # ========== 8. CONCLUSION ==========
    story.append(Paragraph('<b>8. ЗАКЛЮЧЕНИЕ</b>', h1_style))
    story.append(Spacer(1, 12))
    
    conclusion = """
    Цифровой двойник электросети представляет собой современное веб-приложение для моделирования и анализа 
    электрических сетей. Система обеспечивает интерактивную визуализацию топологии сети, автоматическую 
    валидацию конфигурации и удобные инструменты для работы с данными. Использование актуального 
    технологического стека (Next.js 16, React 19, AntV G6) гарантирует производительность и масштабируемость.
    """
    story.append(Paragraph(conclusion.strip(), body_style))
    story.append(Spacer(1, 8))
    
    future_text = """
    Перспективы развития системы включают расширение функционала валидации с добавлением новых правил 
    проверки, реализацию расчетов токов короткого замыкания и потерь напряжения, интеграцию с системами 
    диспетчеризации для получения данных в реальном времени, а также развитие аналитических возможностей 
    для поддержки принятия решений при проектировании и эксплуатации электрических сетей.
    """
    story.append(Paragraph(future_text.strip(), body_style))
    
    # Build PDF
    doc.build(story)
    print(f"Documentation saved to: {output_path}")
    return output_path

if __name__ == '__main__':
    build_document()

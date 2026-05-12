# Электрические схемы: Полное руководство по визуализации

## Содержание
1. [Концепции электрических схем](#1-концепции)
2. [ELK Layout Kernel](#2-elk-layout-kernel)
3. [AntV G6 v5](#3-antv-g6-v5)
4. [Интеграция ELK + G6](#4-интеграция)
5. [Порты и маршрутизация](#5-порты-и-маршрутизация)
6. [Лучшие практики](#6-лучшие-практики)
7. [Проблемы и решения](#7-проблемы-и-решения)

---

## 1. Концепции электрических схем <a name="1-концепции"></a>

### 1.1 Однолинейные схемы (Single-Line Diagrams)

Однолинейная схема (SLD) — упрощённое представление трёхфазной системы одной линией.

**Ключевые принципы:**
- **Поток слева направо** — сигнал/мощность текут от источника к нагрузкам
- **Напряжение сверху вниз** — высокое напряжение вверху, низкое внизу
- **Функциональная группировка** — компоненты группируются по функции

### 1.2 Визуальные обозначения по стандартам

| Элемент | IEC 60617 | Описание |
|---------|-----------|----------|
| Источник | Круг с "G" или трансформатор | Генератор/Трансформатор |
| Автомат | Прямоугольник с × | QF - выключатель |
| Шина | Толстая горизонтальная линия | Сборные шины |
| Нагрузка | Прямоугольник/стрелка | Потребитель |
| Предохранитель | Прямоугольник с линией | FU |

### 1.3 Структура типовой схемы

```
┌──────────────────────────────────────────────────────────────────┐
│  ИСТОЧНИКИ (SOURCE)                                              │
│  ┌─────┐     ┌─────┐                                             │
│  │ Т1  │     │ Т2  │     Трансформаторы 10/0.4 кВ               │
│  └──┬──┘     └──┬──┘                                             │
├─────┼────────────┼───────────────────────────────────────────────┤
│     │            │            ГЛАВНЫЙ РАСПРЕДЕЛИТЕЛЬНЫЙ ЩИТ      │
│     ▼            ▼            ┌─────────────────────────────┐   │
│  ═════════════════════════    │  1 с.ш.      │     2 с.ш.   │   │
│      СБОРНЫЕ ШИНЫ (BUS)       ══════════════════════════════    │
│                               │    │    │    │    │    │    │   │
│                               │  QF1  QF2  │  QF3  QF4  QF5 │   │
│                               └─────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│  РАСПРЕДЕЛИТЕЛЬНЫЕ ЩИТЫ (CABINET)                                │
│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐                     │
│  │ ЩР-1  │  │ ЩР-2  │  │ ЩР-3  │  │ ЩАО   │                     │
│  └───┬───┘  └───┬───┘  └───┬───┘  └───┬───┘                     │
├──────┼──────────┼──────────┼──────────┼──────────────────────────┤
│  НАГРУЗКИ (LOAD)                                                 │
│      ▼          ▼          ▼          ▼                          │
│   ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐                         │
│   │Осв. │   │Роз. │   │Кон. │   │Авар.│                         │
│   └─────┘   └─────┘   └─────┘   └─────┘                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. ELK Layout Kernel <a name="2-elk-layout-kernel"></a>

### 2.1 Обзор алгоритмов

ELK предоставляет несколько алгоритмов раскладки:

| Алгоритм | Применение | Особенности |
|----------|------------|-------------|
| `layered` | Иерархические схемы | Слои, ортогональные рёбра |
| `force` | Графы связей | Физическая симуляция |
| `mrtree` | Деревья | Многоуровневые деревья |
| `radial` | Радиальные схемы | Центральный узел |
| `stress` | Общие графы | Stress majorization |
| `graphviz` | Dot-подобные | GraphViz wrapper |

**Для электрических схем — `layered` (слоевой алгоритм)**

### 2.2 Слоевой алгоритм (Layered)

```
Фаза 1: Cycle Breaking    → Разрыв циклов для DAG
Фаза 2: Layering          → Назначение узлов в слои
Фаза 3: Crossing Min      → Минимизация пересечений рёбер
Фаза 4: Node Placement    → Позиции узлов внутри слоёв
Фаза 5: Edge Routing      → Маршрутизация рёбер
```

### 2.3 Ключевые опции конфигурации

```javascript
const elkOptions = {
  // Основные
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',           // RIGHT | DOWN | LEFT | UP
  'elk.edgeRouting': 'ORTHOGONAL',   // Полигональные рёбра с углами 90°
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',  // Иерархия за один проход
  
  // Отступы
  'elk.spacing.nodeNode': '30',
  'elk.layered.spacing.nodeNodeBetweenLayers': '60',
  'elk.layered.spacing.edgeNode': '20',
  'elk.layered.spacing.edgeEdge': '15',
  'elk.spacing.componentComponent': '50',
  
  // Оптимизация
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
  
  // Порты (критично для схем!)
  'elk.portConstraints': 'FIXED_SIDE',  // или FIXED_ORDER
};
```

### 2.4 Direction (Направление)

| Значение | Раскладка | Применение |
|----------|-----------|------------|
| `RIGHT` | Источник слева → Нагрузки справа | Горизонтальные схемы |
| `DOWN` | Источник вверху → Нагрузки внизу | Вертикальные схемы |
| `LEFT` | Обратный поток | Возвратные цепи |
| `UP` | Обратный поток | Специфические случаи |

**Рекомендация для электрических схем:** `DOWN` (источник вверху)

### 2.5 Edge Routing (Маршрутизация рёбер)

| Значение | Описание | Внешний вид |
|----------|----------|-------------|
| `ORTHOGONAL` | Углы 90° | ┌───┐ |
| `POLYLINE` | Произвольные углы | ╱╲ |
| `SPLINES` | Гладкие кривые | ⌒ |

**Рекомендация:** `ORTHOGONAL` для профессиональных схем

### 2.6 Node Placement Strategy

| Стратегия | Особенности |
|-----------|-------------|
| `BRANDES_KOEPF` | Прямые рёбра, читаемость |
| `NETWORK_SIMPLEX` | Компактность |
| `LINEAR_SEGMENTS` | Быстрота |
| `SIMPLE` | Базовый |

### 2.7 Crossing Minimization

| Стратегия | Качество | Скорость |
|-----------|----------|----------|
| `LAYER_SWEEP` | Лучшее | Средняя |
| `MEDIAN_LAYER_SWEEP` | Хорошее | Быстрая |
| `INTERACTIVE` | Сохраняет порядок | Очень быстрая |

---

## 3. AntV G6 v5 <a name="3-antv-g6-v5"></a>

### 3.1 Архитектура G6

```
Graph
├── Node (узлы)
│   ├── type: 'rect' | 'circle' | ...
│   ├── style: { fill, stroke, size, ... }
│   └── state: { selected, hover, ... }
├── Edge (рёбра)
│   ├── type: 'line' | 'polyline' | 'quadratic' | ...
│   ├── style: { stroke, lineWidth, router, ... }
│   └── state: { selected, hover, ... }
├── Combo (группы)
│   └── Вложенные узлы
└── Behaviors (поведения)
    ├── drag-canvas
    ├── zoom-canvas
    ├── drag-element
    └── ...
```

### 3.2 Типы узлов

```javascript
// Встроенные типы
'circle'     // Круг
'rect'       // Прямоугольник
'ellipse'    // Эллипс
'diamond'    // Ромб
'triangle'   // Треугольник
'star'       // Звезда
'hexagon'    // Шестиугольник
'image'      // Изображение
```

### 3.3 Типы рёбер

```javascript
'line'       // Прямая линия
'polyline'   // Ломаная линия (для ортогональной маршрутизации)
'quadratic'  // Квадратичная кривая
'cubic'      // Кубическая кривая Безье
'cubic-horizontal'  // Горизонтальная кривая
'cubic-vertical'    // Вертикальная кривая
```

### 3.4 Router (Маршрутизатор рёбер)

```javascript
edge: {
  type: 'polyline',
  style: {
    router: {
      type: 'orth',    // Ортогональная маршрутизация
      // G6 v5 автоматически рассчитает точки изгиба
    },
    stroke: '#5B8FF9',
    lineWidth: 2,
  }
}
```

### 3.5 Anchor Points (Точки привязки)

```javascript
node: {
  style: {
    // Точки привязки рёбер [x, y] в относительных координатах (0-1)
    anchorPoints: [
      [0.5, 0],   // Индекс 0: верхний центр (вход)
      [0.5, 1],   // Индекс 1: нижний центр (выход)
      [0, 0.5],   // Индекс 2: левый центр
      [1, 0.5],   // Индекс 3: правый центр
    ],
  }
}

// Использование в ребре
edge: {
  source: 'node1',
  target: 'node2',
  sourceAnchor: 1,  // Выход из нижнего центра node1
  targetAnchor: 0,  // Вход в верхний центр node2
}
```

### 3.6 Ports (Порты в G6)

```javascript
node: {
  style: {
    // Конфигурация портов
    portR: 4,                  // Радиус порта
    portLinkToCenter: true,    // Соединять с центром узла
    portFill: '#fff',
    portStroke: '#5B8FF9',
    
    // Порты могут быть определены через anchorPoints
    anchorPoints: [[0.5, 0], [0.5, 1]],
  }
}
```

---

## 4. Интеграция ELK + G6 <a name="4-интеграция"></a>

### 4.1 Архитектура решения

```
┌──────────────────────────────────────────────────────────────┐
│                      ИСТОЧНИК ДАННЫХ                         │
│                  (Excel, API, Database)                      │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    ПРЕОБРАЗОВАНИЕ ДАННЫХ                     │
│   nodes[] + edges[] → ELK Graph JSON                         │
│   - Определение типов элементов                              │
│   - Назначение размеров (NODE_SIZES)                         │
│   - Группировка по parentId (cabinets)                       │
│   - Создание портов (опционально)                            │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    ELK LAYOUT ENGINE                          │
│   elk.layout(graph) → LayoutResult                           │
│   - Расчёт координат узлов (x, y)                            │
│   - Расчёт размеров групп                                    │
│   - Опционально: маршрутизация рёбер                         │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                   КООРДИНАТНАЯ КОНВЕРСИЯ                     │
│   ELK top-left → G6 center                                   │
│   x_g6 = x_elk + width/2                                     │
│   y_g6 = y_elk + height/2                                    │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                      G6 RENDERING                             │
│   graph.setData({ nodes, edges })                            │
│   graph.render()                                             │
│   - Пассивный рендеринг (координаты из ELK)                  │
│   - Ортогональная маршрутизация: router: { type: 'orth' }   │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Критические соответствия

**ВАЖНО:** Размеры узлов в ELK и G6 должны совпадать!

```javascript
// elk-engine.ts
export const NODE_SIZES = {
  source:  { width: 160, height: 80 },
  bus:     { width: 200, height: 40 },
  breaker: { width: 140, height: 70 },
  load:    { width: 160, height: 80 },
};

// NetworkGraphG6.tsx - должны совпадать!
node: {
  style: {
    size: (d) => {
      const type = d.data?.type;
      const sizes = {
        source: [160, 80],
        bus: [200, 40],
        breaker: [140, 70],
        load: [160, 80],
      };
      return sizes[type] || [160, 80];
    },
  }
}
```

### 4.3 Конвертация координат

```javascript
// ELK возвращает top-left координаты
// G6 ожидает center координаты

function elkToG6(elkX, elkY, width, height) {
  return {
    x: elkX + width / 2,
    y: elkY + height / 2
  };
}
```

---

## 5. Порты и маршрутизация <a name="5-порты-и-маршрутизация"></a>

### 5.1 Что такое порты в ELK?

Порты — это явные точки подключения рёбер на узлах.

```
┌──────────────┐
│   NODE       │
│              │
│ ● p1         │  ← Порт p1 (WEST - левая сторона)
│              │
│         p2 ● │  ← Порт p2 (EAST - правая сторона)
│              │
└──────────────┘
```

### 5.2 Port Constraints (Ограничения портов)

| Значение | Описание |
|----------|----------|
| `FREE` | ELK размещает порты свободно |
| `FIXED_SIDE` | Порт остаётся на указанной стороне |
| `FIXED_ORDER` | Порты сохраняют порядок на стороне |
| `FIXED_POS` | Порты имеют фиксированные позиции |

### 5.3 Port Side (Сторона порта)

```javascript
ports: [
  { id: 'in',  layoutOptions: { 'elk.port.side': 'WEST' } },   // Вход (слева)
  { id: 'out', layoutOptions: { 'elk.port.side': 'EAST' } },   // Выход (справа)
]
```

### 5.4 Пример с портами

```javascript
const elkGraph = {
  id: 'root',
  layoutOptions: {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.edgeRouting': 'ORTHOGONAL',
  },
  children: [
    {
      id: 'source1',
      width: 60,
      height: 40,
      layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' },
      ports: [
        { id: 'p_out', layoutOptions: { 'elk.port.side': 'EAST' } }
      ]
    },
    {
      id: 'breaker1',
      width: 80,
      height: 50,
      layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' },
      ports: [
        { id: 'p_in',  layoutOptions: { 'elk.port.side': 'WEST' } },
        { id: 'p_out', layoutOptions: { 'elk.port.side': 'EAST' } }
      ]
    },
    {
      id: 'load1',
      width: 60,
      height: 40,
      layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' },
      ports: [
        { id: 'p_in', layoutOptions: { 'elk.port.side': 'WEST' } }
      ]
    }
  ],
  edges: [
    { id: 'e1', sources: ['p_out'], targets: ['p_in'] },  // source1 → breaker1
    { id: 'e2', sources: ['p_out'], targets: ['p_in'] },  // breaker1 → load1
  ]
};
```

### 5.5 Anchor Points в G6

```javascript
// Для вертикального потока (direction: DOWN)
anchorPoints: [
  [0.5, 0],   // Индекс 0: Верхний центр (вход)
  [0.5, 1],   // Индекс 1: Нижний центр (выход)
]

// Для горизонтального потока (direction: RIGHT)
anchorPoints: [
  [0, 0.5],   // Индекс 0: Левый центр (вход)
  [1, 0.5],   // Индекс 1: Правый центр (выход)
]
```

---

## 6. Лучшие практики <a name="6-лучшие-практики"></a>

### 6.1 Конфигурация для электрических схем

```javascript
const ELECTRICAL_SCHEMATIC_OPTIONS = {
  // Основные
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',           // Источник вверху
  'elk.edgeRouting': 'ORTHOGONAL',   // Углы 90°
  
  // Иерархия
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  
  // Отступы (увеличенные для читаемости)
  'elk.spacing.nodeNode': '40',
  'elk.layered.spacing.nodeNodeBetweenLayers': '80',
  'elk.layered.spacing.edgeNode': '25',
  'elk.layered.spacing.edgeEdge': '10',
  'elk.spacing.componentComponent': '60',
  
  // Оптимизация
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
  
  // Порты
  'elk.portConstraints': 'FIXED_SIDE',
};
```

### 6.2 Размеры узлов по типам

| Тип | Ширина | Высота | Обоснование |
|-----|--------|--------|-------------|
| SOURCE | 160 | 80 | Крупный, важный элемент |
| BUS | 200 | 40 | Горизонтальная шина |
| BREAKER | 100 | 60 | Компактный выключатель |
| LOAD | 140 | 70 | Стандартный потребитель |
| METER | 100 | 60 | Компактный счётчик |
| JUNCTION | 30 | 30 | Маленькая точка |

### 6.3 Цветовая кодировка

```javascript
const TYPE_COLORS = {
  source:   { fill: '#fef3c7', stroke: '#f59e0b' },  // Жёлтый/Amber
  bus:      { fill: '#cd7f32', stroke: '#8b5a2b' },  // Медный
  breaker:  { fill: '#ffffff', stroke: '#1f2937' },  // Белый/Чёрный
  load:     { fill: '#ffffff', stroke: '#374151' },  // Белый
  meter:    { fill: '#dbeafe', stroke: '#3b82f6' },  // Синий
  cabinet:  { fill: '#f8fafc', stroke: '#d97706' },  // Светлый/Amber
};
```

### 6.4 Типы элементов для электрических схем

```javascript
// Определение типа по имени
function detectElementType(name) {
  const n = name.toLowerCase();
  
  // Источники
  if (/^т\d/.test(n) || n.includes('трансформатор')) return 'SOURCE';
  if (n.startsWith('дгу') || n.includes('ибп')) return 'SOURCE';
  
  // Выключатели
  if (/^qf\d/i.test(n) || /^км\d/i.test(n)) return 'BREAKER';
  
  // Шины
  if (n.includes('с.ш.') || n.includes('шина')) return 'BUS';
  
  // Шкафы
  if (/^грщ|^щр|^вру/i.test(n)) return 'CABINET';
  
  // Счётчики
  if (n.includes('счётчик') || /^узуч/i.test(n)) return 'METER';
  
  // По умолчанию
  return 'LOAD';
}
```

---

## 7. Проблемы и решения <a name="7-проблемы-и-решения"></a>

### 7.1 Рёбра проходят сквозь узлы

**Проблема:** Ортогональная маршрутизация прокладывает рёбра через узлы.

**Причина:** Несовпадение размеров узлов в ELK и G6.

**Решение:**
```javascript
// Синхронизировать NODE_SIZES в elk-engine.ts
// и size в NetworkGraphG6.tsx
```

### 7.2 Перекрытие узлов

**Проблема:** Узлы накладываются друг на друга.

**Причина:** Недостаточные отступы.

**Решение:**
```javascript
'elk.spacing.nodeNode': '50',
'elk.layered.spacing.nodeNodeBetweenLayers': '100',
```

### 7.3 Путаные рёбра

**Проблема:** Рёбра создают "спагетти".

**Причина:** Плохая минимизация пересечений.

**Решение:**
```javascript
'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
'elk.layered.crossingMinimization.semiInteractive': 'true',
```

### 7.4 Неправильное направление потока

**Проблема:** Источники внизу, нагрузки вверху.

**Причина:** Неправильный `elk.direction`.

**Решение:**
```javascript
'elk.direction': 'DOWN',  // Источник вверху
```

### 7.5 Группы (cabinets) не работают

**Проблема:** Элементы вне шкафов.

**Причина:** Неверный `parentId` или `hierarchyHandling`.

**Решение:**
```javascript
'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
// Убедиться что parentId указывает на существующий cabinet
```

### 7.6 G6 не рендерит рёбра

**Проблема:** Рёбра не видны на схеме.

**Причина:** source/target не существуют в nodes.

**Решение:**
```javascript
// Валидация перед setData
const validEdges = edges.filter(e => 
  nodeIds.has(e.source) && nodeIds.has(e.target)
);
```

---

## 8. Справочник опций ELK <a name="8-справочник"></a>

### 8.1 Глобальные опции

| Опция | Значения | По умолчанию |
|-------|----------|--------------|
| `elk.algorithm` | layered, force, mrtree, radial, stress | layered |
| `elk.direction` | UNDEFINED, RIGHT, LEFT, DOWN, UP | RIGHT |
| `elk.edgeRouting` | UNDEFINED, POLYLINE, ORTHOGONAL, SPLINES | ORTHOGONAL |
| `elk.hierarchyHandling` | INHERIT, INCLUDE_CHILDREN, SEPARATE_CHILDREN | INHERIT |

### 8.2 Отступы

| Опция | Описание | По умолчанию |
|-------|----------|--------------|
| `elk.spacing.nodeNode` | Между узлами в одном слое | 20 |
| `elk.layered.spacing.nodeNodeBetweenLayers` | Между слоями | 20 |
| `elk.layered.spacing.edgeNode` | Ребро-узел | 10 |
| `elk.layered.spacing.edgeEdge` | Ребро-ребро | 10 |
| `elk.spacing.componentComponent` | Между компонентами | 20 |

### 8.3 Оптимизация

| Опция | Значения | По умолчанию |
|-------|----------|--------------|
| `crossingMinimization.strategy` | LAYER_SWEEP, MEDIAN, INTERACTIVE, NONE | LAYER_SWEEP |
| `nodePlacement.strategy` | BRANDES_KOEPF, NETWORK_SIMPLEX, LINEAR_SEGMENTS | BRANDES_KOEPF |
| `layering.strategy` | NETWORK_SIMPLEX, LONGEST_PATH, COFFMAN_GRAHAM | NETWORK_SIMPLEX |

### 8.4 Порты

| Опция | Значения | По умолчанию |
|-------|----------|--------------|
| `elk.portConstraints` | FREE, FIXED_SIDE, FIXED_ORDER, FIXED_POS | FREE |
| `elk.port.side` | UNDEFINED, NORTH, EAST, SOUTH, WEST | UNDEFINED |
| `elk.port.index` | число | - |

---

## 9. Ресурсы <a name="9-ресурсы"></a>

### Документация
- [ELK Reference](https://eclipse.dev/elk/reference/options.html)
- [ELK JSON Format](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/jsonformat.html)
- [ELK Live Examples](https://rtsys.informatik.uni-kiel.de/elklive)
- [G6 v5 Docs](https://g6.antv.antgroup.com/)

### Стандарты
- IEC 60617 - Графические символы
- IEC 61082 - Документация в электротехнике
- IEEE 315 - Символы для электрических схем
- IEEE C37.2 - Функциональные номера устройств

### GitHub
- [elkjs](https://github.com/kieler/elkjs)
- [AntV G6](https://github.com/antvis/G6)

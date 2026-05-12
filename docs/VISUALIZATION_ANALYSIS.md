# Анализ визуализации электрических схем

## 1. Текущее состояние проекта

### 1.1 Данные для визуализации

**Файл:** `/home/z/my-project/upload/input.xlsx`
- **322 строки** связей в Networkall
- **322 уникальных элемента** (источники, автоматы, нагрузки, шины)
- **Справочники:** CableReference, AVR

**Структура данных:**
```
От (from) → Кабель → До (to)
Т1 ТП21 → шина → QF1 1 с.ш. 380 кВ ТП21
QF1 → АПвВнг-13х(4х240) → Узел 1QF 1 с.ш. ГРЩ1
```

### 1.2 Текущая реализация ELK

**Файл:** `/home/z/my-project/src/lib/elk-engine.ts`

```javascript
// Текущие настройки
layoutOptions: {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.spacing.nodeNode': '30',
  'elk.layered.spacing.nodeNodeBetweenLayers': '60',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
}
```

### 1.3 Текущая реализация G6

**Файл:** `/home/z/my-project/src/components/NetworkGraphG6.tsx`

```javascript
// Edge routing
edge: {
  type: 'polyline',
  style: {
    router: { type: 'orth' },
  }
}

// Anchor points
anchorPoints: [
  [0.5, 0],   // верх
  [0.5, 1],   // низ
]
```

---

## 2. Выявленные проблемы

### 2.1 Размеры узлов не синхронизированы

**Проблема:** Размеры в ELK и G6 могут не совпадать.

**Текущие размеры в elk-engine.ts:**
```javascript
source:   { width: 160, height: 80 },
bus:      { width: 200, height: 40 },
breaker:  { width: 140, height: 70 },
```

**Текущие размеры в NetworkGraphG6.tsx:**
```javascript
source:   [160, 80],
bus:      [200, 40],
breaker:  [140, 70],
```

**Статус:** ✅ Синхронизированы

### 2.2 Отсутствие портов

**Проблема:** Рёбра подключаются к центру узла, а не к конкретным портам.

**Влияние:**
- Рёбра могут проходить сквозь узлы
- Нет контроля над точкой подключения
- Схема выглядит непрофессионально

**Решение:** Добавить порты в ELK

### 2.3 Нет учёта типа потока

**Проблема:** Все элементы располагаются одинаково, независимо от типа.

**Влияние:**
- Источники могут быть внизу
- Нагрузки могут быть вверху
- Нарушается логика электрической схемы

**Решение:** Использовать `elk.layered.layering.strategy` с весами

### 2.4 Cabinet bounding boxes

**Проблема:** Шкафы рисуются как bounding boxes из координат детей.

**Влияние:**
- Пустые шкафы не видны
- Нет контроля над размером шкафа
- Рёбра проходят сквозь шкафы

**Решение:** Использовать ELK groups (combos)

---

## 3. Рекомендации по улучшению

### 3.1 Добавить порты для каждого типа элемента

```javascript
// Для вертикального потока (DOWN)
const PORT_CONFIGS = {
  SOURCE: {
    ports: [
      { id: 'out', side: 'SOUTH' }  // Выход вниз
    ]
  },
  BUS: {
    ports: [
      { id: 'in', side: 'NORTH' },   // Вход сверху
      { id: 'out', side: 'SOUTH' }   // Выход вниз
    ]
  },
  BREAKER: {
    ports: [
      { id: 'in', side: 'NORTH' },   // Вход сверху
      { id: 'out', side: 'SOUTH' }   // Выход вниз
    ]
  },
  LOAD: {
    ports: [
      { id: 'in', side: 'NORTH' }    // Вход сверху
    ]
  }
};
```

### 3.2 Использовать FIXED_ORDER для портов

```javascript
layoutOptions: {
  'elk.portConstraints': 'FIXED_ORDER',
  // Порты будут сохранять порядок на каждой стороне
}
```

### 3.3 Добавить веса слоёв

```javascript
// В ELK можно задать позицию в слое
children: [
  {
    id: 'source1',
    layoutOptions: {
      'elk.layered.layering.nodeLayerID': '0'  // Первый слой (верх)
    }
  },
  {
    id: 'load1',
    layoutOptions: {
      'elk.layered.layering.nodeLayerID': '5'  // Последний слой (низ)
    }
  }
]
```

### 3.4 Улучшить отступы

```javascript
// Рекомендуемые отступы для электрических схем
'elk.spacing.nodeNode': '50',                        // Между узлами в слое
'elk.layered.spacing.nodeNodeBetweenLayers': '100', // Между слоями
'elk.layered.spacing.edgeNode': '30',               // Ребро-узел
'elk.layered.spacing.edgeEdge': '15',               // Ребро-ребро
'elk.layered.spacing.portPort': '10',               // Порт-порт
'elk.padding': '[top=30,left=30,bottom=30,right=30]',
```

### 3.5 Использовать ELK для маршрутизации рёбер

**Текущий подход:**
- ELK: только позиции узлов
- G6: маршрутизация через `router: { type: 'orth' }`

**Улучшенный подход:**
- ELK: позиции узлов И маршрутизация рёбер
- G6: пассивный рендеринг с controlPoints

```javascript
// В elk-engine.ts после layout:
const edges = layoutResult.edges.map(e => ({
  id: e.id,
  source: e.source,
  target: e.target,
  // ELK возвращает точки маршрута
  controlPoints: e.sections?.[0]?.bendPoints || []
}));

// В G6:
edge: {
  type: 'polyline',
  style: {
    // Не использовать router, использовать controlPoints из ELK
    controlPoints: (d) => d.data?.controlPoints || [],
  }
}
```

---

## 4. Предлагаемая архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    ИМПОРТ ДАННЫХ                            │
│  Excel → Elements[] + Connections[]                         │
│  - Определение типа (detectElementType)                     │
│  - Назначение parentId (cabinets)                           │
│  - Расчёт размеров                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 ГЕНЕРАЦИЯ ПОРТОВ                             │
│  Для каждого элемента создать порты по типу:                │
│  - SOURCE: out (SOUTH)                                      │
│  - BUS: in (NORTH), out (SOUTH)                             │
│  - BREAKER: in (NORTH), out (SOUTH)                         │
│  - LOAD: in (NORTH)                                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   ELK GRAPH JSON                             │
│  {                                                          │
│    id: 'root',                                              │
│    layoutOptions: { ... },                                  │
│    children: [ nodes with ports ],                          │
│    edges: [ edges to ports ],                               │
│  }                                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    ELK LAYOUT                                │
│  elk.layout(graph) → {                                      │
│    nodes: [{ x, y, width, height }],                        │
│    edges: [{ sections: [{ bendPoints }] }],                 │
│  }                                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               КООРДИНАТНАЯ КОНВЕРСИЯ                        │
│  - top-left → center                                        │
│  - bendPoints → controlPoints                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    G6 RENDER                                 │
│  graph.setData({ nodes, edges })                            │
│  - Узлы с позициями из ELK                                  │
│  - Рёбра с controlPoints из ELK                             │
│  - Без router (пассивный рендер)                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Следующие шаги

### 5.1 Краткосрочные (быстрые улучшения)

1. **Увеличить отступы**
   - `nodeNodeBetweenLayers: 80-100`
   - `nodeNode: 40-50`

2. **Добавить layerID для типов**
   - SOURCE → layer 0
   - BUS → layer 1
   - BREAKER → layer 2-4
   - LOAD → layer 5

3. **Улучшить цвета**
   - Стандартизировать по IEC

### 5.2 Среднесрочные (качественные улучшения)

1. **Реализовать порты**
   - Определить порты для каждого типа
   - Подключать рёбра к портам

2. **Использовать ELK для маршрутизации**
   - Получать bendPoints из ELK
   - Передавать в G6 как controlPoints

3. **Улучшить группировку**
   - Использовать ELK groups вместо bounding boxes
   - Корректная обработка рёбер между группами

### 5.3 Долгосрочные (профессиональный уровень)

1. **Поддержка стандартов IEC 60617**
   - Графические символы для каждого типа
   - SVG иконки вместо прямоугольников

2. **Интерактивность**
   - Drag & drop с перерасчётом layout
   - Collapsible cabinets
   - Minimap для навигации

3. **Экспорт**
   - PDF/PNG с высоким качеством
   - DXF для CAD-систем

---

## 6. Ключевые выводы

1. **ELK Layered — правильный выбор** для электрических схем
2. **Порты критически важны** для красивой маршрутизации
3. **Размеры должны совпадать** в ELK и G6
4. **Направление DOWN** соответствует стандартам схем
5. **Отступы нужно увеличить** для читаемости

Текущая реализация близка к правильной, но требует:
- Добавления портов
- Увеличения отступов
- Использования ELK для маршрутизации рёбер

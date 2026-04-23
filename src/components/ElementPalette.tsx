'use client';

import type { ElementType } from '@/types';

interface ElementPaletteProps {
  selectedType: ElementType | null;
  onTypeSelect: (type: ElementType) => void;
  editMode: boolean;
  onEditModeToggle: () => void;
  connectionMode: boolean;
  onConnectionModeToggle: () => void;
}

// Конфигурация типов элементов
const ELEMENT_TYPES: Array<{
  type: ElementType;
  label: string;
  labelRu: string;
  color: string;
  icon: string;
  description: string;
}> = [
  {
    type: 'SOURCE',
    label: 'Source',
    labelRu: 'Источник',
    color: '#fbbf24',
    icon: '⚡',
    description: 'Источник питания (ТП, генератор)',
  },
  {
    type: 'CABINET',
    label: 'Cabinet',
    labelRu: 'Щит',
    color: '#d97706',
    icon: '📦',
    description: 'Распределительный щит/шкаф',
  },
  {
    type: 'BREAKER',
    label: 'Breaker',
    labelRu: 'Автомат',
    color: '#1f2937',
    icon: '🔌',
    description: 'Автоматический выключатель',
  },
  {
    type: 'LOAD',
    label: 'Load',
    labelRu: 'Нагрузка',
    color: '#ffffff',
    icon: '💡',
    description: 'Потребитель электроэнергии',
  },
  {
    type: 'METER',
    label: 'Meter',
    labelRu: 'Счётчик',
    color: '#3b82f6',
    icon: '📊',
    description: 'Счётчик электроэнергии',
  },
  {
    type: 'BUS',
    label: 'Bus',
    labelRu: 'Шина',
    color: '#B87333',
    icon: '══',
    description: 'Шина распределительная',
  },
  {
    type: 'JUNCTION',
    label: 'Junction',
    labelRu: 'Узел',
    color: '#9ca3af',
    icon: '⬡',
    description: 'Узел соединения',
  },
];

export default function ElementPalette({
  selectedType,
  onTypeSelect,
  editMode,
  onEditModeToggle,
  connectionMode,
  onConnectionModeToggle,
}: ElementPaletteProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-3 w-56">
      {/* Заголовок */}
      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-2">
        Инструменты
      </div>

      {/* Переключатель режима */}
      <div className="space-y-2">
        <button
          onClick={onEditModeToggle}
          className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            editMode
              ? 'bg-amber-500 text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <span>{editMode ? '✏️' : '👁️'}</span>
          <span>{editMode ? 'Редактирование' : 'Просмотр'}</span>
        </button>

        {/* Режим создания связи */}
        <button
          onClick={onConnectionModeToggle}
          className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            connectionMode
              ? 'bg-green-500 text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
          disabled={!editMode}
        >
          <span>🔗</span>
          <span>Создать связь</span>
        </button>
      </div>

      {/* Палитра элементов */}
      {editMode && !connectionMode && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Добавить элемент
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {ELEMENT_TYPES.map((item) => (
              <button
                key={item.type}
                onClick={() => onTypeSelect(item.type)}
                className={`p-2 rounded-lg text-xs transition-all flex flex-col items-center gap-1 border-2 ${
                  selectedType === item.type
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md'
                    : 'border-transparent bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title={item.description}
              >
                <span
                  className="text-lg w-8 h-8 flex items-center justify-center rounded-md"
                  style={{
                    backgroundColor: item.color,
                    color: item.color === '#ffffff' ? '#374151' : '#fff',
                  }}
                >
                  {item.icon}
                </span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {item.labelRu}
                </span>
              </button>
            ))}
          </div>

          {selectedType && (
            <div className="text-xs text-slate-500 dark:text-slate-400 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
              💡 Кликните на холст для размещения элемента
            </div>
          )}
        </div>
      )}

      {/* Инструкция для режима связи */}
      {connectionMode && (
        <div className="text-xs text-slate-500 dark:text-slate-400 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="font-medium text-green-700 dark:text-green-400 mb-1">
            Создание связи
          </div>
          <ol className="list-decimal list-inside space-y-0.5 text-green-600 dark:text-green-500">
            <li>Кликните на начальный элемент</li>
            <li>Кликните на целевой элемент</li>
            <li>Заполните параметры кабеля</li>
          </ol>
        </div>
      )}

      {/* Подсказки */}
      <div className="mt-auto pt-3 border-t border-slate-200 dark:border-slate-700">
        <div className="text-xs text-slate-400 dark:text-slate-500 space-y-1">
          <div>• Двойной клик — свернуть/развернуть</div>
          <div>• Колёсико — масштаб</div>
          <div>• Перетаскивание — перемещение</div>
        </div>
      </div>
    </div>
  );
}

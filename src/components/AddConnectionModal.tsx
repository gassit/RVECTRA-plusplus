'use client';

import { useState, useEffect } from 'react';

interface AddConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ConnectionData) => void;
  sourceName: string;
  targetName: string;
}

export interface ConnectionData {
  wireType: string;
  wireSize: number;
  material: 'Cu' | 'Al';
  length: number;
}

// Популярные марки кабелей
const CABLE_TYPES = [
  { value: 'ВВГ', label: 'ВВГ (медь, ПВХ)' },
  { value: 'АВВГ', label: 'АВВГ (алюминий, ПВХ)' },
  { value: 'ВБбШв', label: 'ВБбШв (медь, броня)' },
  { value: 'АВБбШв', label: 'АВБбШв (алюминий, броня)' },
  { value: 'ВВГнг', label: 'ВВГнг (медь, не распространяет горение)' },
  { value: 'АВВГнг', label: 'АВВГнг (алюминий, не распространяет)' },
  { value: 'ВВГнг-LS', label: 'ВВГнг-LS (медь, низкое дымовыделение)' },
  { value: 'КГ', label: 'КГ (гибкий)' },
  { value: 'ПВС', label: 'ПВС (соединительный)' },
];

// Стандартные сечения
const WIRE_SIZES = [
  1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400,
];

export default function AddConnectionModal({
  isOpen,
  onClose,
  onSubmit,
  sourceName,
  targetName,
}: AddConnectionModalProps) {
  const [wireType, setWireType] = useState('ВВГ');
  const [wireSize, setWireSize] = useState<number>(2.5);
  const [material, setMaterial] = useState<'Cu' | 'Al'>('Cu');
  const [length, setLength] = useState<number>(10);

  // Автоопределение материала по марке кабеля
  useEffect(() => {
    if (wireType.startsWith('А')) {
      setMaterial('Al');
    } else {
      setMaterial('Cu');
    }
  }, [wireType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ wireType, wireSize, material, length });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Заголовок */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            🔗 Создать связь
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Информация о связи */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-sm">
            <div className="flex items-center justify-center gap-3">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {sourceName}
              </span>
              <span className="text-green-500">→</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {targetName}
              </span>
            </div>
          </div>

          {/* Марка кабеля */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Марка кабеля
            </label>
            <select
              value={wireType}
              onChange={(e) => setWireType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {CABLE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Сечение */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Сечение (мм²)
            </label>
            <select
              value={wireSize}
              onChange={(e) => setWireSize(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {WIRE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} мм²
                </option>
              ))}
            </select>
          </div>

          {/* Материал */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Материал
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMaterial('Cu')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  material === 'Cu'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                🟤 Медь (Cu)
              </button>
              <button
                type="button"
                onClick={() => setMaterial('Al')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  material === 'Al'
                    ? 'bg-gray-500 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                ⚪ Алюминий (Al)
              </button>
            </div>
          </div>

          {/* Длина */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Длина (м)
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Предпросмотр */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
            📦 Кабель: {wireType} {wireSize}×1 {material === 'Cu' ? '(Cu)' : '(Al)'} — {length} м
          </div>

          {/* Кнопки */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Создать связь
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

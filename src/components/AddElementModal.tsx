'use client';

import { useState, useEffect } from 'react';
import type { ElementType, DeviceType } from '@/types';

interface AddElementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AddElementData) => void;
  elementType: ElementType | null;
  posX: number;
  posY: number;
}

export interface AddElementData {
  type: ElementType;
  name: string;
  description?: string;
  location?: string;
  voltageLevel?: number;
  // Данные устройства
  deviceType?: DeviceType;
  currentNom?: number;
  pKw?: number;
  qKvar?: number;
  cosPhi?: number;
  voltageNom?: number;
  posX: number;
  posY: number;
}

// Маппинг типов элементов на типы устройств
const ELEMENT_TO_DEVICE: Record<ElementType, DeviceType | null> = {
  SOURCE: 'SOURCE',
  CABINET: null,
  LOAD: 'LOAD',
  BUS: null,
  METER: 'METER',
  BREAKER: 'BREAKER',
  JUNCTION: null,
};

// Русские названия типов
const TYPE_LABELS_RU: Record<ElementType, string> = {
  SOURCE: 'Источник питания',
  CABINET: 'Распределительный щит',
  LOAD: 'Нагрузка',
  BUS: 'Шина',
  METER: 'Счётчик',
  BREAKER: 'Автоматический выключатель',
  JUNCTION: 'Узел соединения',
};

export default function AddElementModal({
  isOpen,
  onClose,
  onSubmit,
  elementType,
  posX,
  posY,
}: AddElementModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [voltageLevel, setVoltageLevel] = useState<number>(380);

  // Параметры устройств
  const [currentNom, setCurrentNom] = useState<number | undefined>();
  const [pKw, setPKw] = useState<number | undefined>();
  const [qKvar, setQKvar] = useState<number | undefined>();
  const [cosPhi, setCosPhi] = useState<number>(0.92);
  const [voltageNom, setVoltageNom] = useState<number>(380);

  // Сброс формы при открытии
  useEffect(() => {
    if (isOpen && elementType) {
      // Генерируем имя по умолчанию
      const typePrefix = {
        SOURCE: 'ИП',
        CABINET: 'Щ',
        LOAD: 'Н',
        BUS: 'Ш',
        METER: 'СЧ',
        BREAKER: 'АВ',
        JUNCTION: 'У',
      };
      const suffix = Math.floor(Math.random() * 1000);
      setName(`${typePrefix[elementType]}-${suffix}`);
      setDescription('');
      setLocation('');
      setVoltageLevel(380);
      setCurrentNom(undefined);
      setPKw(undefined);
      setQKvar(undefined);
      setCosPhi(0.92);
      setVoltageNom(380);
    }
  }, [isOpen, elementType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!elementType || !name.trim()) return;

    const deviceType = ELEMENT_TO_DEVICE[elementType];

    onSubmit({
      type: elementType,
      name: name.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      voltageLevel,
      deviceType: deviceType || undefined,
      currentNom,
      pKw,
      qKvar,
      cosPhi,
      voltageNom,
      posX,
      posY,
    });
  };

  if (!isOpen || !elementType) return null;

  const showDeviceParams = ELEMENT_TO_DEVICE[elementType];
  const isLoad = elementType === 'LOAD';
  const isBreaker = elementType === 'BREAKER';
  const isSource = elementType === 'SOURCE';
  const isMeter = elementType === 'METER';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Заголовок */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Добавить: {TYPE_LABELS_RU[elementType]}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Основные параметры */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Название *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Например: Н-125"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Описание
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Опциональное описание"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Расположение
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Например: Цех №1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Уровень напряжения (В)
              </label>
              <select
                value={voltageLevel}
                onChange={(e) => setVoltageLevel(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={220}>220 В</option>
                <option value={380}>380 В</option>
                <option value={660}>660 В</option>
                <option value={6000}>6 кВ</option>
                <option value={10000}>10 кВ</option>
              </select>
            </div>
          </div>

          {/* Параметры устройств */}
          {showDeviceParams && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Параметры устройства
              </h3>

              {/* Для нагрузки */}
              {isLoad && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        P (кВт)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={pKw ?? ''}
                        onChange={(e) => setPKw(e.target.value ? Number(e.target.value) : undefined)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="10.5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Q (квар)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={qKvar ?? ''}
                        onChange={(e) => setQKvar(e.target.value ? Number(e.target.value) : undefined)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="5.2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      cos φ
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      max="1"
                      value={cosPhi}
                      onChange={(e) => setCosPhi(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

              {/* Для выключателя */}
              {isBreaker && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Номинальный ток (А)
                  </label>
                  <select
                    value={currentNom ?? ''}
                    onChange={(e) => setCurrentNom(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Выберите...</option>
                    <option value="6">6 А</option>
                    <option value="10">10 А</option>
                    <option value="16">16 А</option>
                    <option value="20">20 А</option>
                    <option value="25">25 А</option>
                    <option value="32">32 А</option>
                    <option value="40">40 А</option>
                    <option value="50">50 А</option>
                    <option value="63">63 А</option>
                    <option value="80">80 А</option>
                    <option value="100">100 А</option>
                    <option value="125">125 А</option>
                    <option value="160">160 А</option>
                    <option value="200">200 А</option>
                    <option value="250">250 А</option>
                    <option value="320">320 А</option>
                    <option value="400">400 А</option>
                    <option value="500">500 А</option>
                    <option value="630">630 А</option>
                  </select>
                </div>
              )}

              {/* Для источника */}
              {isSource && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Напряжение (В)
                    </label>
                    <input
                      type="number"
                      value={voltageNom}
                      onChange={(e) => setVoltageNom(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Мощность (кВт)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={pKw ?? ''}
                      onChange={(e) => setPKw(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="630"
                    />
                  </div>
                </div>
              )}

              {/* Для счётчика */}
              {isMeter && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Номинальный ток (А)
                  </label>
                  <input
                    type="number"
                    value={currentNom ?? ''}
                    onChange={(e) => setCurrentNom(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="5"
                  />
                </div>
              )}
            </div>
          )}

          {/* Координаты */}
          <div className="text-xs text-slate-400 dark:text-slate-500">
            Позиция: ({Math.round(posX)}, {Math.round(posY)})
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
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Добавить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

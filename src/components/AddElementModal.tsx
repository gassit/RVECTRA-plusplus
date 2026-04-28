'use client';

import { useState, useEffect } from 'react';
import type { ElementType, DeviceType } from '@/types';

interface Cabinet {
  id: string;
  name: string;
}

interface AddElementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AddElementData) => void;
  elementType: ElementType | null;
  posX: number;
  posY: number;
  cabinets?: Cabinet[]; // Список доступных cabinet-ов
}

export interface AddElementData {
  type: ElementType;
  name: string;
  description?: string;
  location?: string;
  voltageLevel?: number;
  parentId?: string;
  // Статусы
  electricalStatus?: 'LIVE' | 'DEAD';
  operationalStatus?: 'ON' | 'OFF';
  // Данные устройства
  deviceType?: DeviceType;
  currentNom?: number;
  pKw?: number;
  qKvar?: number;
  cosPhi?: number;
  voltageNom?: number;
  // Для Breaker
  breakerType?: 'MCB' | 'MCCB' | 'RCD' | 'RCBO';
  breakingCapacity?: number;
  curve?: 'B' | 'C' | 'D';
  leakageCurrent?: number;
  poles?: number;
  // Для Meter
  meterType?: string;
  serialNumber?: string;
  // Координаты
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

// Типы выключателей
const BREAKER_TYPES = [
  { value: 'MCB', label: 'MCB - Модульный' },
  { value: 'MCCB', label: 'MCCB - В литом корпусе' },
  { value: 'RCD', label: 'RCD - УЗО' },
  { value: 'RCBO', label: 'RCBO - УЗО с защитой' },
];

// Характеристики расцепителя
const CURVE_OPTIONS = [
  { value: 'B', label: 'B - 3-5 In (освещение)' },
  { value: 'C', label: 'C - 5-10 In (общие нагрузки)' },
  { value: 'D', label: 'D - 10-14 In (двигатели)' },
];

// Отключающая способность
const BREAKING_CAPACITY_OPTIONS = [
  { value: 3, label: '3 кА' },
  { value: 4.5, label: '4.5 кА' },
  { value: 6, label: '6 кА' },
  { value: 10, label: '10 кА' },
  { value: 15, label: '15 кА' },
  { value: 25, label: '25 кА' },
  { value: 36, label: '36 кА' },
];

// Токи утечки для RCD/RCBO
const LEAKAGE_CURRENT_OPTIONS = [
  { value: 10, label: '10 мА' },
  { value: 30, label: '30 мА' },
  { value: 100, label: '100 мА' },
  { value: 300, label: '300 мА' },
  { value: 500, label: '500 мА' },
];

// Количество полюсов
const POLES_OPTIONS = [
  { value: 1, label: '1 полюс' },
  { value: 2, label: '2 полюса' },
  { value: 3, label: '3 полюса' },
  { value: 4, label: '4 полюса' },
];

// Типы счётчиков
const METER_TYPES = [
  { value: 'ELECTRONIC', label: 'Электронный' },
  { value: 'INDUCTION', label: 'Индукционный' },
  { value: 'SMART', label: 'Умный' },
];

export default function AddElementModal({
  isOpen,
  onClose,
  onSubmit,
  elementType,
  posX,
  posY,
  cabinets = [],
}: AddElementModalProps) {
  // Основные параметры
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [voltageLevel, setVoltageLevel] = useState<number>(380);
  const [parentId, setParentId] = useState<string>('');

  // Статусы
  const [electricalStatus, setElectricalStatus] = useState<'LIVE' | 'DEAD'>('DEAD');
  const [operationalStatus, setOperationalStatus] = useState<'ON' | 'OFF'>('ON');

  // Параметры устройств
  const [currentNom, setCurrentNom] = useState<number | undefined>();
  const [pKw, setPKw] = useState<number | undefined>();
  const [qKvar, setQKvar] = useState<number | undefined>();
  const [cosPhi, setCosPhi] = useState<number>(0.92);
  const [voltageNom, setVoltageNom] = useState<number>(380);

  // Параметры Breaker
  const [breakerType, setBreakerType] = useState<'MCB' | 'MCCB' | 'RCD' | 'RCBO'>('MCB');
  const [breakingCapacity, setBreakingCapacity] = useState<number | undefined>();
  const [curve, setCurve] = useState<'B' | 'C' | 'D' | undefined>();
  const [leakageCurrent, setLeakageCurrent] = useState<number | undefined>();
  const [poles, setPoles] = useState<number>(1);

  // Параметры Meter
  const [meterType, setMeterType] = useState<string>('ELECTRONIC');
  const [serialNumber, setSerialNumber] = useState<string>('');

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
        BREAKER: 'QF',
        JUNCTION: 'У',
      };
      const suffix = Math.floor(Math.random() * 1000);
      setName(`${typePrefix[elementType]}-${suffix}`);
      setDescription('');
      setLocation('');
      setVoltageLevel(380);
      setParentId('');
      setElectricalStatus('DEAD');
      setOperationalStatus('ON');
      setCurrentNom(undefined);
      setPKw(undefined);
      setQKvar(undefined);
      setCosPhi(0.92);
      setVoltageNom(380);
      setBreakerType('MCB');
      setBreakingCapacity(undefined);
      setCurve(undefined);
      setLeakageCurrent(undefined);
      setPoles(1);
      setMeterType('ELECTRONIC');
      setSerialNumber('');
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
      parentId: parentId || undefined,
      electricalStatus,
      operationalStatus,
      deviceType: deviceType || undefined,
      currentNom,
      pKw,
      qKvar,
      cosPhi,
      voltageNom,
      breakerType,
      breakingCapacity,
      curve,
      leakageCurrent,
      poles,
      meterType,
      serialNumber: serialNumber.trim() || undefined,
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
  const isSwitchingElement = ['SOURCE', 'BREAKER', 'LOAD', 'METER'].includes(elementType);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Заголовок */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
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
          {/* === ОСНОВНЫЕ ПАРАМЕТРЫ === */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Основные параметры
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Название *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Например: QF-125"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Описание
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Опционально"
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
                  placeholder="Цех №1"
                />
              </div>
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

            {/* Cabinet - только для некабинетных элементов */}
            {elementType !== 'CABINET' && cabinets.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Распределительный щит (Cabinet)
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Без щита (корневой элемент)</option>
                  {cabinets.map(cabinet => (
                    <option key={cabinet.id} value={cabinet.id}>
                      {cabinet.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* === СТАТУСЫ === */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Статусы
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Электрический статус
                </label>
                <select
                  value={electricalStatus}
                  onChange={(e) => setElectricalStatus(e.target.value as 'LIVE' | 'DEAD')}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="DEAD">⚪ Без напряжения</option>
                  <option value="LIVE">⚡ Под напряжением</option>
                </select>
              </div>

              {isSwitchingElement && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Оперативный статус
                  </label>
                  <select
                    value={operationalStatus}
                    onChange={(e) => setOperationalStatus(e.target.value as 'ON' | 'OFF')}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="ON">🟢 Включен</option>
                    <option value="OFF">🔴 Отключен</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* === ПАРАМЕТРЫ УСТРОЙСТВ === */}
          {showDeviceParams && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
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
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Тип выключателя
                      </label>
                      <select
                        value={breakerType}
                        onChange={(e) => setBreakerType(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {BREAKER_TYPES.map(bt => (
                          <option key={bt.value} value={bt.value}>{bt.label}</option>
                        ))}
                      </select>
                    </div>
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
                        {[6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3200].map(i => (
                          <option key={i} value={i}>{i} А</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Отключающая способность
                      </label>
                      <select
                        value={breakingCapacity ?? ''}
                        onChange={(e) => setBreakingCapacity(e.target.value ? Number(e.target.value) : undefined)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Выберите...</option>
                        {BREAKING_CAPACITY_OPTIONS.map(bc => (
                          <option key={bc.value} value={bc.value}>{bc.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Кол-во полюсов
                      </label>
                      <select
                        value={poles}
                        onChange={(e) => setPoles(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {POLES_OPTIONS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Характеристика расцепителя - только для MCB/MCCB/RCBO */}
                  {['MCB', 'MCCB', 'RCBO'].includes(breakerType) && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Характеристика расцепителя
                      </label>
                      <select
                        value={curve ?? ''}
                        onChange={(e) => setCurve(e.target.value as 'B' | 'C' | 'D' | undefined)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Выберите...</option>
                        {CURVE_OPTIONS.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Ток утечки - только для RCD/RCBO */}
                  {['RCD', 'RCBO'].includes(breakerType) && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Ток утечки
                      </label>
                      <select
                        value={leakageCurrent ?? ''}
                        onChange={(e) => setLeakageCurrent(e.target.value ? Number(e.target.value) : undefined)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Выберите...</option>
                        {LEAKAGE_CURRENT_OPTIONS.map(lc => (
                          <option key={lc.value} value={lc.value}>{lc.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
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
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Тип счётчика
                      </label>
                      <select
                        value={meterType}
                        onChange={(e) => setMeterType(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {METER_TYPES.map(mt => (
                          <option key={mt.value} value={mt.value}>{mt.label}</option>
                        ))}
                      </select>
                    </div>
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
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Заводской номер
                    </label>
                    <input
                      type="text"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="12345678"
                    />
                  </div>
                </>
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

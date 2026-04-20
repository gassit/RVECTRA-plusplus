'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import type { ElementType, DeviceType } from '@/types';

interface AddElementFormProps {
  onSubmit: (data: AddElementFormData) => Promise<void>;
  isLoading?: boolean;
}

interface AddElementFormData {
  type: ElementType;
  name: string;
  description?: string;
  voltageLevel?: number;
  deviceType?: DeviceType;
  deviceModel?: string;
  currentNom?: number;
  pKw?: number;
  qKvar?: number;
  cosPhi?: number;
}

const ELEMENT_TYPES = [
  { value: 'SOURCE', label: 'Источник питания' },
  { value: 'CABINET', label: 'Распределительный шкаф' },
  { value: 'BREAKER', label: 'Выключатель' },
  { value: 'LOAD', label: 'Нагрузка' },
];

const DEVICE_MODELS: Record<string, string[]> = {
  BREAKER: ['ВА-47-29', 'ВА-47-100', 'ВА-55-41', 'ВА-55-43', 'S203', 'NSX100', 'NSX250'],
};

export default function AddElementForm({ onSubmit, isLoading }: AddElementFormProps) {
  const [type, setType] = useState<ElementType>('LOAD');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [currentNom, setCurrentNom] = useState<string>('');
  const [pKw, setPKw] = useState<string>('');
  const [qKvar, setQKvar] = useState<string>('');
  const [cosPhi, setCosPhi] = useState<string>('0.9');

  const handleSubmit = async () => {
    if (!name.trim()) return;

    await onSubmit({
      type,
      name: name.trim(),
      description: description.trim() || undefined,
      voltageLevel: 0.4,
      deviceType: type === 'BREAKER' ? 'BREAKER' : type === 'LOAD' ? 'LOAD' : type === 'SOURCE' ? 'SOURCE' : undefined,
      deviceModel: deviceModel || undefined,
      currentNom: currentNom ? parseFloat(currentNom) : undefined,
      pKw: pKw ? parseFloat(pKw) : undefined,
      qKvar: qKvar ? parseFloat(qKvar) : undefined,
      cosPhi: cosPhi ? parseFloat(cosPhi) : undefined,
    });

    // Сброс формы
    setName('');
    setDescription('');
    setDeviceModel('');
    setCurrentNom('');
    setPKw('');
    setQKvar('');
    setCosPhi('0.9');
  };

  const showDeviceFields = type === 'BREAKER' || type === 'LOAD' || type === 'SOURCE';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Добавить элемент
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Тип элемента */}
          <div className="space-y-2">
            <Label htmlFor="type">Тип элемента</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as ElementType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите тип" />
              </SelectTrigger>
              <SelectContent>
                {ELEMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Название */}
          <div className="space-y-2">
            <Label htmlFor="name">Название</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: ЩР-1"
            />
          </div>

          {/* Описание */}
          <div className="space-y-2">
            <Label htmlFor="description">Описание (опционально)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание"
            />
          </div>

          {/* Поля устройства */}
          {showDeviceFields && (
            <>
              {/* Модель выключателя */}
              {type === 'BREAKER' && (
                <div className="space-y-2">
                  <Label htmlFor="model">Модель выключателя</Label>
                  <Select
                    value={deviceModel}
                    onValueChange={setDeviceModel}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите модель" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEVICE_MODELS.BREAKER.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Номинальный ток */}
              {type === 'BREAKER' && (
                <div className="space-y-2">
                  <Label htmlFor="currentNom">Номинальный ток (А)</Label>
                  <Input
                    id="currentNom"
                    type="number"
                    value={currentNom}
                    onChange={(e) => setCurrentNom(e.target.value)}
                    placeholder="16"
                  />
                </div>
              )}

              {/* Мощность нагрузки */}
              {type === 'LOAD' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="pKw">P (кВт)</Label>
                      <Input
                        id="pKw"
                        type="number"
                        step="0.1"
                        value={pKw}
                        onChange={(e) => setPKw(e.target.value)}
                        placeholder="10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qKvar">Q (квар)</Label>
                      <Input
                        id="qKvar"
                        type="number"
                        step="0.1"
                        value={qKvar}
                        onChange={(e) => setQKvar(e.target.value)}
                        placeholder="3"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cosPhi">cos φ</Label>
                    <Input
                      id="cosPhi"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={cosPhi}
                      onChange={(e) => setCosPhi(e.target.value)}
                      placeholder="0.9"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* Кнопка отправки */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!name.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Добавление...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Добавить
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

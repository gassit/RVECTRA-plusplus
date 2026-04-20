'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Zap, Gauge, Settings, AlertTriangle, Activity, Cable } from 'lucide-react';
import type { GraphNode, GraphEdge } from '@/types';

interface ElementDetailsProps {
  node?: GraphNode | null;
  edge?: GraphEdge | null;
  onClose?: () => void;
}

const TYPE_NAMES: Record<string, string> = {
  SOURCE: 'Источник',
  CABINET: 'Шкаф',
  LOAD: 'Нагрузка',
  BREAKER: 'Выключатель',
  BUS: 'Шина',
  METER: 'Счётчик',
};

const TYPE_COLORS: Record<string, string> = {
  SOURCE: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  CABINET: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  LOAD: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  BREAKER: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  BUS: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
  METER: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
};

const CONNECTION_TYPE_NAMES: Record<string, string> = {
  CABLE: 'Кабельная линия',
  BUSBAR: 'Шинопровод',
  JUMPER: 'Перемычка',
};

const INSTALLATION_METHOD_NAMES: Record<string, string> = {
  in_ground: 'В земле',
  in_air: 'В воздухе',
  in_pipe: 'В трубе',
  in_tray: 'В лотке',
};

export default function ElementDetails({ node, edge, onClose }: ElementDetailsProps) {
  // Если это детализация кабеля/связи
  if (edge && !node) {
    return (
      <Card className="shadow-lg border-slate-700 bg-slate-900/95 backdrop-blur">
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cable className="h-4 w-4 text-blue-400" />
              <CardTitle className="text-sm font-medium text-slate-200">
                {CONNECTION_TYPE_NAMES[edge.type] || edge.type}
              </CardTitle>
            </div>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6 hover:bg-slate-800">
                <X className="h-4 w-4 text-slate-400" />
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">ID: {edge.id}</p>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-3">
          {/* Статусы */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
              edge.status === 'ON' 
                ? 'bg-blue-900/50 text-blue-400' 
                : 'bg-red-900/50 text-red-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${edge.status === 'ON' ? 'bg-blue-400' : 'bg-red-400'}`} />
              {edge.status === 'ON' ? 'ON' : 'OFF'}
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
              edge.lifeStatus === 'LIVE' 
                ? 'bg-green-900/50 text-green-400' 
                : 'bg-gray-800 text-gray-400'
            }`}>
              <Activity className="h-3 w-3" />
              {edge.lifeStatus === 'LIVE' ? 'LIVE' : 'DEAD'}
            </div>
          </div>

          {/* Параметры кабеля */}
          <div className="grid grid-cols-2 gap-2">
            {edge.wireType && (
              <div className="p-2 bg-slate-800 rounded">
                <div className="text-xs text-slate-500">Марка</div>
                <div className="font-medium text-slate-200">{edge.wireType}</div>
              </div>
            )}
            {edge.wireSize && (
              <div className="p-2 bg-slate-800 rounded">
                <div className="text-xs text-slate-500">Сечение</div>
                <div className="font-medium text-slate-200">{edge.wireSize} мм²</div>
              </div>
            )}
            {edge.core && (
              <div className="p-2 bg-slate-800 rounded">
                <div className="text-xs text-slate-500">Жилы</div>
                <div className="font-medium text-slate-200">{edge.core}</div>
              </div>
            )}
            {edge.material && (
              <div className="p-2 bg-slate-800 rounded">
                <div className="text-xs text-slate-500">Материал</div>
                <div className="font-medium text-slate-200">{edge.material === 'Cu' ? 'Медь' : 'Алюминий'}</div>
              </div>
            )}
            {edge.length && (
              <div className="p-2 bg-slate-800 rounded">
                <div className="text-xs text-slate-500">Длина</div>
                <div className="font-medium text-slate-200">{edge.length} м</div>
              </div>
            )}
            {edge.currentCapacity && (
              <div className="p-2 bg-slate-800 rounded">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Gauge className="h-3 w-3" />
                  Iдоп
                </div>
                <div className="font-medium text-slate-200">{edge.currentCapacity} А</div>
              </div>
            )}
            {edge.installationMethod && (
              <div className="p-2 bg-slate-800 rounded col-span-2">
                <div className="text-xs text-slate-500">Прокладка</div>
                <div className="font-medium text-slate-200">
                  {INSTALLATION_METHOD_NAMES[edge.installationMethod] || edge.installationMethod}
                </div>
              </div>
            )}
          </div>

          {/* Электрические параметры */}
          {(edge.resistanceR || edge.reactanceX || edge.impedanceZ) && (
            <div>
              <div className="text-xs font-medium text-slate-400 mb-2">Электрические параметры</div>
              <div className="grid grid-cols-3 gap-2">
                {edge.resistanceR && (
                  <div className="p-2 bg-slate-800 rounded text-center">
                    <div className="text-xs text-slate-500">R</div>
                    <div className="font-medium text-slate-200 text-sm">{edge.resistanceR.toFixed(4)} Ом</div>
                  </div>
                )}
                {edge.reactanceX && (
                  <div className="p-2 bg-slate-800 rounded text-center">
                    <div className="text-xs text-slate-500">X</div>
                    <div className="font-medium text-slate-200 text-sm">{edge.reactanceX.toFixed(4)} Ом</div>
                  </div>
                )}
                {edge.impedanceZ && (
                  <div className="p-2 bg-slate-800 rounded text-center">
                    <div className="text-xs text-slate-500">Z</div>
                    <div className="font-medium text-slate-200 text-sm">{edge.impedanceZ.toFixed(4)} Ом</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Расчётные параметры */}
          {(edge.voltageDrop || edge.shortCircuitCurrent || edge.loadCurrent) && (
            <div>
              <div className="text-xs font-medium text-slate-400 mb-2">Расчётные параметры</div>
              <div className="grid grid-cols-2 gap-2">
                {edge.voltageDrop && (
                  <div className="p-2 bg-slate-800 rounded">
                    <div className="text-xs text-slate-500">Падение напряжения</div>
                    <div className={`font-medium ${edge.voltageDrop > 4 ? 'text-red-400' : 'text-slate-200'}`}>
                      {edge.voltageDrop.toFixed(2)}%
                    </div>
                  </div>
                )}
                {edge.shortCircuitCurrent && (
                  <div className="p-2 bg-slate-800 rounded">
                    <div className="text-xs text-slate-500">Ток КЗ</div>
                    <div className="font-medium text-slate-200">{edge.shortCircuitCurrent.toFixed(0)} А</div>
                  </div>
                )}
                {edge.loadCurrent && (
                  <div className="p-2 bg-slate-800 rounded">
                    <div className="text-xs text-slate-500">Ток нагрузки</div>
                    <div className="font-medium text-slate-200">{edge.loadCurrent.toFixed(1)} А</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Связанные узлы */}
          <div className="text-xs text-slate-500">
            <span className="text-slate-600">От:</span> {edge.source}
            <br />
            <span className="text-slate-600">До:</span> {edge.target}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Если нет данных
  if (!node) return null;

  const mainDevice = node.devices?.[0];

  return (
    <Card className="shadow-lg border-slate-700 bg-slate-900/95 backdrop-blur">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={TYPE_COLORS[node.type] || 'bg-gray-100 text-gray-700'}>
              {TYPE_NAMES[node.type] || node.type}
            </Badge>
            <CardTitle className="text-sm font-medium text-slate-200">{node.name}</CardTitle>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6 hover:bg-slate-800">
              <X className="h-4 w-4 text-slate-400" />
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1">ID: {node.id}</p>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {/* Статусы */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
            node.status !== 'OFF' 
              ? 'bg-blue-900/50 text-blue-400' 
              : 'bg-red-900/50 text-red-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${node.status !== 'OFF' ? 'bg-blue-400' : 'bg-red-400'}`} />
            {node.status !== 'OFF' ? 'ON' : 'OFF'}
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
            node.lifeStatus === 'LIVE' 
              ? 'bg-green-900/50 text-green-400' 
              : 'bg-gray-800 text-gray-400'
          }`}>
            <Activity className="h-3 w-3" />
            {node.lifeStatus === 'LIVE' ? 'LIVE' : 'DEAD'}
          </div>
        </div>

        {/* Проблемы */}
        {node.criticalIssues > 0 && (
          <div className="p-2 bg-red-900/30 rounded border border-red-800">
            <div className="flex items-center gap-1.5 text-red-400 text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              {node.criticalIssues} критических проблем
            </div>
          </div>
        )}

        {/* Параметры устройства */}
        {mainDevice && (
          <div className="space-y-2">
            {/* Электрические параметры */}
            <div className="grid grid-cols-2 gap-2">
              {mainDevice.currentNom && (
                <div className="p-2 bg-slate-800 rounded">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Gauge className="h-3 w-3" />
                    Iном
                  </div>
                  <div className="font-medium text-slate-200">{mainDevice.currentNom} А</div>
                </div>
              )}
              {mainDevice.pKw && (
                <div className="p-2 bg-slate-800 rounded">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Zap className="h-3 w-3" />
                    P
                  </div>
                  <div className="font-medium text-slate-200">{mainDevice.pKw} кВт</div>
                </div>
              )}
              {mainDevice.qKvar && (
                <div className="p-2 bg-slate-800 rounded">
                  <div className="text-xs text-slate-500">Q</div>
                  <div className="font-medium text-slate-200">{mainDevice.qKvar} квар</div>
                </div>
              )}
              {mainDevice.cosPhi && (
                <div className="p-2 bg-slate-800 rounded">
                  <div className="text-xs text-slate-500">cos φ</div>
                  <div className="font-medium text-slate-200">{mainDevice.cosPhi.toFixed(2)}</div>
                </div>
              )}
              {mainDevice.sKva && (
                <div className="p-2 bg-slate-800 rounded">
                  <div className="text-xs text-slate-500">S</div>
                  <div className="font-medium text-slate-200">{mainDevice.sKva} кВА</div>
                </div>
              )}
              {mainDevice.model && (
                <div className="p-2 bg-slate-800 rounded">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Settings className="h-3 w-3" />
                    Модель
                  </div>
                  <div className="font-medium text-sm text-slate-200">{mainDevice.model}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Результаты валидации */}
        {node.validationResults && node.validationResults.length > 0 && (
          <div>
            <div className="text-xs font-medium text-slate-400 mb-2">
              Результаты проверки
            </div>
            <div className="space-y-1.5">
              {node.validationResults.slice(0, 3).map((result, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded text-xs ${
                    result.status === 'CRITICAL' 
                      ? 'bg-red-900/30 text-red-400'
                      : result.status === 'FAIL'
                      ? 'bg-orange-900/30 text-orange-400'
                      : result.status === 'WARN'
                      ? 'bg-yellow-900/30 text-yellow-400'
                      : 'bg-green-900/30 text-green-400'
                  }`}
                >
                  {result.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Связанные устройства */}
        {node.devices && node.devices.length > 1 && (
          <div>
            <div className="text-xs font-medium text-slate-400 mb-2">
              Устройства ({node.devices.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {node.devices.slice(1, 5).map((device, idx) => (
                <Badge key={idx} variant="outline" className="text-xs border-slate-700 text-slate-300">
                  {device.type}: {device.model || device.id}
                </Badge>
              ))}
              {node.devices.length > 5 && (
                <Badge variant="outline" className="text-xs border-slate-700 text-slate-300">
                  +{node.devices.length - 5}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

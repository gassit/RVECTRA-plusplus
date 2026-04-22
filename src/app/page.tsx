'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  FileUp,
  RefreshCw,
  Zap,
  Loader2,
  AlertCircle,
  Sun,
  Moon,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  X,
} from 'lucide-react';

import NetworkGraphG6 from '@/components/NetworkGraphG6';
import ElementDetails from '@/components/ElementDetails';
import ValidationPanel from '@/components/ValidationPanel';

import type { GraphData, GraphNode, GraphEdge, ValidationIssue } from '@/types';

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // Состояние данных
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [stats, setStats] = useState({
    sources: 0,
    cabinets: 0,
    loads: 0,
    breakers: 0,
    totalPower: 0,
    consumedPower: 0,
    freePower: 0,
    criticalIssues: 0,
  });
  const [validationStats, setValidationStats] = useState({
    critical: 0,
    fail: 0,
    warn: 0,
  });

  // Состояние UI
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    imported?: { elements: number; devices: number; connections: number };
  } | null>(null);

  // Управление мнемосхемой
  const [zoom, setZoom] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Для корректной работы темы
  useEffect(() => {
    setMounted(true);
  }, []);

  // Фильтрация данных по поиску
  const filteredData = useMemo(() => {
    if (!graphData) return null;
    if (!searchTerm) return graphData;

    const searchLower = searchTerm.toLowerCase();
    const matchingNodes = graphData.nodes.filter(n => 
      n.name.toLowerCase().includes(searchLower) ||
      n.id.toLowerCase().includes(searchLower)
    );
    const matchingIds = new Set(matchingNodes.map(n => n.id));
    const matchingEdges = graphData.edges.filter(e => 
      matchingIds.has(e.source) || matchingIds.has(e.target)
    );

    return {
      nodes: matchingNodes,
      edges: matchingEdges,
    };
  }, [graphData, searchTerm]);

  // Загрузка данных сети
  const loadNetworkData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/network');
      if (response.ok) {
        const data: GraphData = await response.json();
        setGraphData(data);

        // Обновляем статистику
        const sources = data.nodes.filter(n => n.type === 'SOURCE').length;
        const cabinets = data.nodes.filter(n => n.type === 'CABINET').length;
        const loads = data.nodes.filter(n => n.type === 'LOAD').length;
        const breakers = data.nodes.filter(n => n.type === 'BREAKER').length;
        const criticalIssues = data.nodes.reduce((sum, n) => sum + n.criticalIssues, 0);

        // Расчёт мощности
        let totalPower = 0;
        let consumedPower = 0;
        data.nodes.forEach(n => {
          n.devices?.forEach(d => {
            if (d.type === 'SOURCE' && d.sKva) {
              totalPower += d.sKva;
            }
            if (d.type === 'LOAD' && d.pKw) {
              consumedPower += d.pKw;
            }
          });
        });

        setStats({
          sources,
          cabinets,
          loads,
          breakers,
          totalPower,
          consumedPower,
          freePower: totalPower - consumedPower / 0.9, // примерный расчёт
          criticalIssues,
        });
      }
    } catch (error) {
      console.error('Failed to load network data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Загрузка результатов валидации
  const loadValidationResults = useCallback(async () => {
    try {
      const response = await fetch('/api/validation');
      if (response.ok) {
        const data: ValidationIssue[] = await response.json();
        setIssues(data);

        setValidationStats({
          critical: data.filter(i => i.severity === 'CRITICAL').length,
          fail: data.filter(i => i.severity === 'FAIL').length,
          warn: data.filter(i => i.severity === 'WARN').length,
        });
      }
    } catch (error) {
      console.error('Failed to load validation results:', error);
    }
  }, []);

  // Импорт данных
  const handleImport = async () => {
    setIsImporting(true);
    try {
      const response = await fetch('/api/import', { method: 'POST' });
      const result = await response.json();
      setImportResult(result);

      if (result.success) {
        await loadNetworkData();
        await loadValidationResults();
      }
    } catch (error) {
      console.error('Import failed:', error);
      setImportResult({
        success: false,
        message: 'Ошибка импорта данных',
      });
    } finally {
      setIsImporting(false);
      setShowImportDialog(true);
    }
  };

  // Запуск валидации
  const handleValidate = async () => {
    setIsValidating(true);
    try {
      await fetch('/api/validation', { method: 'POST' });
      await loadValidationResults();
      await loadNetworkData();
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  };

  // Клик по узлу
  const handleNodeClick = (nodeId: string) => {
    const node = graphData?.nodes.find(n => n.id === nodeId);
    setSelectedNode(node || null);
    setSelectedEdge(null);
  };

  // Клик по ребру (кабель/шина)
  const handleEdgeClick = (edgeId: string) => {
    const edge = graphData?.edges.find(e => e.id === edgeId);
    setSelectedEdge(edge || null);
    setSelectedNode(null);
  };

  // Клик на пустую область - закрывает информационный блок
  const handleEmptyClick = () => {
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  // Сброс вида
  const handleResetView = () => {
    setZoom(1);
  };

  // Начальная загрузка
  useEffect(() => {
    loadNetworkData();
    loadValidationResults();
  }, [loadNetworkData, loadValidationResults]);

  const totalIssues = validationStats.critical + validationStats.fail + validationStats.warn;

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Шапка с управлением */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          {/* Логотип и название */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900 rounded">
              <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
              Цифровой двойник
            </span>
          </div>

          {/* Поиск */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Поиск по названию или ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-sm bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Масштаб */}
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded">
            <ZoomOut className="h-3.5 w-3.5 text-slate-400" />
            <Slider
              value={[zoom * 100]}
              onValueChange={(value) => setZoom(value[0] / 100)}
              min={25}
              max={300}
              step={5}
              className="w-20"
            />
            <ZoomIn className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400 w-9 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleResetView}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
              title="Сбросить вид"
            >
              <Maximize2 className="h-3.5 w-3.5 text-slate-500 hover:text-slate-400" />
            </button>
          </div>

          {/* Мини-статистика */}
          <div className="flex items-center gap-3 text-xs shrink-0">
            {/* Мощность */}
            <div className="flex items-center gap-2 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">
              <div className="flex items-center gap-1">
                <span className="text-slate-500 dark:text-slate-400">Своб:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {stats.freePower.toFixed(0)}
                </span>
              </div>
              <div className="w-px h-3 bg-slate-300 dark:bg-slate-600" />
              <div className="flex items-center gap-1">
                <span className="text-slate-500 dark:text-slate-400">Нагр:</span>
                <span className="font-medium text-orange-600 dark:text-orange-400">
                  {stats.consumedPower.toFixed(0)}
                </span>
              </div>
              <span className="text-slate-400 dark:text-slate-500">кВА</span>
            </div>

            {/* Проблемы */}
            {totalIssues > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/30 rounded">
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                <span className="font-medium text-red-600 dark:text-red-400">{totalIssues}</span>
              </div>
            )}

            {/* Счётчики */}
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <span>И: {stats.sources}</span>
              <span>Ш: {stats.cabinets}</span>
              <span>Н: {stats.loads}</span>
            </div>
          </div>

          {/* Действия */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-8 w-8"
            >
              {mounted && theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleImport}
              disabled={isImporting}
              className="h-8"
            >
              {isImporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileUp className="h-3.5 w-3.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleValidate}
              disabled={isValidating}
              className="h-8"
            >
              {isValidating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Основной контент - мнемосхема во весь экран */}
      <main className="flex-1 flex overflow-hidden">
        {/* Главный блок - Мнемосхема */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <NetworkGraphG6
              data={filteredData}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              onEmptyClick={handleEmptyClick}
              selectedNodeId={selectedNode?.id}
              selectedEdgeId={selectedEdge?.id}
              zoom={zoom}
              onZoomChange={setZoom}
            />
          )}

          {/* Мини-панель валидации - в углу */}
          {totalIssues > 0 && (
            <div className="absolute bottom-4 left-4 max-w-xs">
              <ValidationPanel
                issues={issues}
                onValidate={handleValidate}
                isValidating={isValidating}
                stats={validationStats}
                compact={true}
              />
            </div>
          )}

          {/* Панель деталей элемента - справа */}
          {(selectedNode || selectedEdge) && (
            <div className="absolute top-4 right-4 w-80">
              <ElementDetails 
                node={selectedNode}
                edge={selectedEdge}
                onClose={() => {
                  setSelectedNode(null);
                  setSelectedEdge(null);
                }}
              />
            </div>
          )}
        </div>
      </main>

      {/* Диалог результата импорта */}
      <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {importResult?.success ? 'Импорт завершён' : 'Ошибка импорта'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {importResult?.success ? (
                <div className="space-y-2">
                  <p>{importResult.message}</p>
                  {importResult.imported && (
                    <div className="mt-2 text-sm">
                      <p>Импортировано:</p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        <li>Элементов: {importResult.imported.elements}</li>
                        <li>Устройств: {importResult.imported.devices}</li>
                        <li>Связей: {importResult.imported.connections}</li>
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                importResult?.message
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Закрыть</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import NetworkGraph from '@/components/network/NetworkGraph';
import { useTheme } from '@/components/providers/ThemeProvider';

interface NetworkData {
  elements: Array<{
    id: string;
    elementId: string;
    name: string;
    type: string;
    posX?: number | null;
    posY?: number | null;
  }>;
  connections: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    source: { elementId: string; name: string; type: string };
    target: { elementId: string; name: string; type: string };
  }>;
}

interface Stats {
  elements: {
    sources: number;
    buses: number;
    breakers: number;
    meters: number;
    loads: number;
    junctions: number;
    total: number;
  };
  power: {
    total: number;
    consumed: number;
    free: number;
  };
  connections: number;
}

interface ValidationResult {
  rule: string;
  elementId: string;
  elementName: string;
  status: 'error' | 'warning' | 'pass';
  message: string;
  value?: number;
  limit?: number;
}

interface ValidationData {
  rules: Array<{ name: string; description: string }>;
  issues: ValidationResult[];
  stats: {
    total: number;
    errors: number;
    warnings: number;
    passed: number;
  };
}

export default function Home() {
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [validation, setValidation] = useState<ValidationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [networkRes, statsRes, validationRes] = await Promise.all([
        fetch('/api/network'),
        fetch('/api/stats'),
        fetch('/api/validation'),
      ]);

      if (networkRes.ok) {
        const data = await networkRes.json();
        setNetworkData(data);
      }

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }

      if (validationRes.ok) {
        setValidation(await validationRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(nodeId);
  }, []);

  const errorCount = validation?.stats.errors || 0;
  const warningCount = validation?.stats.warnings || 0;

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900 transition-colors overflow-hidden">
      {/* Minimal Top Toolbar */}
      <header className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-3 py-2 flex items-center justify-between">
          {/* Left: Title */}
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-gray-900 dark:text-white">
              Цифровой двойник электросети
            </h1>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Элементов: {stats?.elements.total || 0}</span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>Связей: {stats?.connections || 0}</span>
            </div>
          </div>

          {/* Center: Power Stats */}
          <div className="hidden md:flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 dark:text-gray-400">Мощность:</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {stats?.power.total?.toFixed(1) || '0'} кВА
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 dark:text-gray-400">Потребляемая:</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {stats?.power.consumed?.toFixed(1) || '0'} кВА
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 dark:text-gray-400">Свободная:</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {stats?.power.free?.toFixed(1) || '0'} кВА
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            {/* Validation Status */}
            <button
              onClick={() => setShowValidation(!showValidation)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                errorCount > 0 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50' 
                  : warningCount > 0
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
              }`}
            >
              {errorCount > 0 ? `✗ ${errorCount}` : warningCount > 0 ? `⚠ ${warningCount}` : '✓'}
              <span className="hidden sm:inline">
                {errorCount > 0 ? 'Ошибок' : warningCount > 0 ? 'Предупр.' : 'Норма'}
              </span>
            </button>

            {/* Stats Toggle */}
            <button
              onClick={() => setShowStats(!showStats)}
              className="p-1.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Статистика"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>

            {/* Refresh */}
            <button
              onClick={fetchData}
              className="p-1.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Обновить"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
            >
              {theme === 'light' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Graph takes priority */}
      <main className="flex-1 relative overflow-hidden">
        {/* Network Graph - Full Size */}
        <div className="absolute inset-0 flex">
          {loading ? (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Загрузка данных сети...</span>
              </div>
            </div>
          ) : (
            <NetworkGraph 
              data={networkData} 
              onNodeClick={handleNodeClick}
            />
          )}
        </div>

        {/* Floating Stats Panel */}
        {showStats && (
          <div className="absolute top-3 left-3 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-10">
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Статистика</h3>
              <button
                onClick={() => setShowStats(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-3 space-y-3">
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Элементы сети</h4>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <div className="flex flex-col items-center p-1.5 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                    <span className="font-semibold text-yellow-700 dark:text-yellow-400">{stats?.elements.sources || 0}</span>
                    <span className="text-gray-500 dark:text-gray-400">Источники</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded">
                    <span className="font-semibold text-amber-700 dark:text-amber-400">{stats?.elements.buses || 0}</span>
                    <span className="text-gray-500 dark:text-gray-400">Шины</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 bg-gray-100 dark:bg-gray-700 rounded">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{stats?.elements.breakers || 0}</span>
                    <span className="text-gray-500 dark:text-gray-400">Автоматы</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <span className="font-semibold text-blue-700 dark:text-blue-400">{stats?.elements.meters || 0}</span>
                    <span className="text-gray-500 dark:text-gray-400">Счётчики</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 bg-gray-100 dark:bg-gray-700 rounded">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{stats?.elements.loads || 0}</span>
                    <span className="text-gray-500 dark:text-gray-400">Нагрузки</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 bg-gray-100 dark:bg-gray-700 rounded">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{stats?.elements.junctions || 0}</span>
                    <span className="text-gray-500 dark:text-gray-400">Узлы</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Мощность (кВА)</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Установленная</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{stats?.power.total?.toFixed(1) || '0'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Потребляемая</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">{stats?.power.consumed?.toFixed(1) || '0'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Свободная</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{stats?.power.free?.toFixed(1) || '0'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Floating Validation Panel */}
        {showValidation && validation && (
          <div className="absolute top-3 right-3 w-72 max-h-[calc(100%-2rem)] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-10">
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Валидация сети</h3>
              <button
                onClick={() => setShowValidation(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-3 overflow-y-auto max-h-80">
              <div className="flex gap-2 text-xs mb-3">
                {validation.stats.errors > 0 && (
                  <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                    {validation.stats.errors} ошибок
                  </span>
                )}
                {validation.stats.warnings > 0 && (
                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                    {validation.stats.warnings} предупреждений
                  </span>
                )}
                {validation.stats.errors === 0 && validation.stats.warnings === 0 && (
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                    ✓ Нарушений не найдено
                  </span>
                )}
              </div>
              {validation.issues.length > 0 && (
                <div className="space-y-2">
                  {validation.issues.map((issue, idx) => (
                    <div key={idx} className="text-xs p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                      <div className="flex items-center gap-1">
                        <span className={issue.status === 'error' ? 'text-red-500' : 'text-yellow-500'}>
                          {issue.status === 'error' ? '✗' : '⚠'}
                        </span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {issue.elementName}
                        </span>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 mt-1">{issue.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected Node Info */}
        {selectedNode && (
          <div className="absolute bottom-3 right-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 w-64 border border-gray-200 dark:border-gray-700 z-10">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Выбранный узел</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  ID: {selectedNode}
                </p>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-lg shadow p-2 text-xs z-10">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-yellow-400 via-green-500 to-red-500"></div>
              <span className="text-gray-600 dark:text-gray-400">Источник</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-white border border-gray-400"></div>
              <span className="text-gray-600 dark:text-gray-400">Автомат</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-gray-800 dark:bg-gray-200"></div>
              <span className="text-gray-600 dark:text-gray-400">Нагрузка</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-blue-500"></div>
              <span className="text-gray-600 dark:text-gray-400">Счётчик</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-amber-600"></div>
              <span className="text-gray-600 dark:text-gray-400">Шина</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <span className="text-gray-600 dark:text-gray-400">Узел</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-green-600 border-2 border-green-400"></div>
              <span className="text-gray-600 dark:text-gray-400">Шкаф</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

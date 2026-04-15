'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import NetworkGraph from '@/components/network/NetworkGraph';
import { useTheme } from '@/components/providers/ThemeProvider';
import type { ElectricalStatus, OperationalStatus } from '@/types';

interface NetworkData {
  elements: Array<{
    id: string;
    elementId: string;
    name: string;
    type: string;
    posX?: number | null;
    posY?: number | null;
    parentId?: string | null;
    electricalStatus: ElectricalStatus;
    operationalStatus: OperationalStatus;
  }>;
  connections: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    electricalStatus: ElectricalStatus;
    operationalStatus: OperationalStatus;
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
    live: number;
    dead: number;
    off: number;
  };
  power: {
    total: number;
    consumed: number;
    free: number;
    reserve: number;
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
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { theme, toggleTheme } = useTheme();
  const dataLoadedRef = useRef(false);

  // Load data once on mount
  useEffect(() => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;

    const load = async () => {
      try {
        setLoading(true);
        const [networkRes, statsRes, validationRes] = await Promise.all([
          fetch('/api/network'),
          fetch('/api/stats'),
          fetch('/api/validation'),
        ]);
        if (networkRes.ok) setNetworkData(await networkRes.json());
        if (statsRes.ok) setStats(await statsRes.json());
        if (validationRes.ok) setValidation(await validationRes.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [networkRes, statsRes, validationRes] = await Promise.all([
        fetch('/api/network'),
        fetch('/api/stats'),
        fetch('/api/validation'),
      ]);
      if (networkRes.ok) setNetworkData(await networkRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (validationRes.ok) setValidation(await validationRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(nodeId);
  }, []);

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!networkData || !searchQuery.trim()) return networkData;

    const query = searchQuery.toLowerCase();
    const matchedElementIds = new Set(
      networkData.elements
        .filter(el => el.name.toLowerCase().includes(query))
        .map(el => el.id)
    );

    const filteredElements = networkData.elements.filter(el =>
      el.name.toLowerCase().includes(query)
    );

    const filteredConnections = networkData.connections.filter(conn =>
      matchedElementIds.has(conn.sourceId) || matchedElementIds.has(conn.targetId)
    );

    return {
      elements: filteredElements,
      connections: filteredConnections,
    };
  }, [networkData, searchQuery]);

  // Calculate status stats
  const statusStats = useMemo(() => {
    if (!networkData) return { live: 0, dead: 0, off: 0 };
    const elements = networkData.elements;
    return {
      live: elements.filter(e => e.operationalStatus === 'ON' && e.electricalStatus === 'LIVE').length,
      dead: elements.filter(e => e.electricalStatus === 'DEAD').length,
      off: elements.filter(e => e.operationalStatus === 'OFF').length,
    };
  }, [networkData]);

  const errorCount = validation?.stats.errors || 0;
  const warningCount = validation?.stats.warnings || 0;

  // Find selected element details
  const selectedElement = useMemo(() => {
    if (!selectedNode || !networkData) return null;
    return networkData.elements.find(e => e.id === selectedNode);
  }, [selectedNode, networkData]);

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900 transition-colors overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 py-2 flex items-center gap-4">
          {/* Logo */}
          <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">
            RVectrA
          </h1>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Поиск по элементам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Status Stats - Compact */}
          <div className="flex items-center gap-2 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="font-medium text-green-600 dark:text-green-400">{statusStats.live}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400 opacity-50"></span>
              <span className="font-medium text-gray-500">{statusStats.dead}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 opacity-35"></span>
              <span className="font-medium text-red-500">{statusStats.off}</span>
            </div>
          </div>

          {/* Power Stats - Compact */}
          {(stats?.power.total || stats?.power.consumed || stats?.power.free || stats?.power.reserve) ? (
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs">
              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold text-gray-700 dark:text-gray-300">{stats?.power.total?.toFixed(0) || '0'}</span>
              <span className="text-gray-400">/</span>
              <span className="text-blue-600 dark:text-blue-400">{stats?.power.consumed?.toFixed(0) || '0'}</span>
              <span className="text-gray-400">/</span>
              <span className="text-green-600 dark:text-green-400">{stats?.power.free?.toFixed(0) || '0'}</span>
              <span className="text-gray-400">/</span>
              <span className="text-purple-600 dark:text-purple-400">{stats?.power.reserve?.toFixed(0) || '0'}</span>
              <span className="text-gray-400 ml-1">кВА</span>
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Validation Status */}
            <button
              onClick={() => setShowValidation(!showValidation)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shadow-sm ${
                errorCount > 0
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : warningCount > 0
                  ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {errorCount > 0 ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {errorCount}
                </>
              ) : warningCount > 0 ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {warningCount}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  OK
                </>
              )}
            </button>

            {/* Stats Toggle */}
            <button
              onClick={() => setShowStats(!showStats)}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Статистика"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>

            {/* Refresh */}
            <button
              onClick={refreshData}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Обновить"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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

        {/* Status Bar */}
        <div className="px-4 py-1 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {filteredData?.elements.length || 0} / {stats?.elements.total || 0} элементов
          </span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {filteredData?.connections.length || 0} связей
          </span>
          {searchQuery && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="text-blue-500 dark:text-blue-400">
                Фильтр: &quot;{searchQuery}&quot;
              </span>
            </>
          )}
        </div>
      </header>

      {/* Main Content - Graph takes priority */}
      <main className="flex-1 relative overflow-hidden">
        {/* Network Graph - Full Size */}
        <div className="absolute inset-0 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                <span className="text-lg text-gray-500 dark:text-gray-400">Загрузка данных сети...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
              <div className="flex flex-col items-center gap-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-lg font-medium text-gray-700 dark:text-gray-300">Ошибка загрузки</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{error}</span>
                <button
                  onClick={refreshData}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Попробовать снова
                </button>
              </div>
            </div>
          ) : (
            <NetworkGraph
              data={filteredData}
              onNodeClick={handleNodeClick}
            />
          )}
        </div>

        {/* Floating Stats Panel */}
        {showStats && stats && (
          <div className="absolute top-16 left-4 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-20">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Статистика сети</h3>
              <button
                onClick={() => setShowStats(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Status Stats */}
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Статусы элементов</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">{statusStats.live}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">LIVE</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <span className="text-lg font-bold text-gray-500">{statusStats.dead}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">DEAD</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <span className="text-lg font-bold text-red-500">{statusStats.off}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">OFF</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Элементы сети</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{stats.elements.sources}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">SOURCE</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{stats.elements.buses}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">BUS</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <span className="text-lg font-bold text-gray-700 dark:text-gray-300">{stats.elements.breakers}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">BREAKER</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.elements.meters}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">METER</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-gray-800 dark:bg-gray-600 rounded-lg">
                    <span className="text-lg font-bold text-white">{stats.elements.loads}</span>
                    <span className="text-xs text-gray-400">LOAD</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <span className="text-lg font-bold text-gray-700 dark:text-gray-300">{stats.elements.junctions}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">JUNCTION</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Мощность</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Полная</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{stats.power.total?.toFixed(1) || '0'} кВА</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="text-sm text-blue-600 dark:text-blue-400">Потребляемая</span>
                    <span className="font-semibold text-blue-700 dark:text-blue-300">{stats.power.consumed?.toFixed(1) || '0'} кВА</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="text-sm text-green-600 dark:text-green-400">Свободна</span>
                    <span className="font-semibold text-green-700 dark:text-green-300">{stats.power.free?.toFixed(1) || '0'} кВА</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <span className="text-sm text-purple-600 dark:text-purple-400">Резерв</span>
                    <span className="font-semibold text-purple-700 dark:text-purple-300">{stats.power.reserve?.toFixed(1) || '0'} кВА</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Floating Validation Panel */}
        {showValidation && validation && (
          <div className="absolute top-16 right-4 w-80 max-h-[calc(100%-6rem)] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-20">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Валидация сети</h3>
              <button
                onClick={() => setShowValidation(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-96">
              <div className="flex gap-2 mb-4">
                {validation.stats.errors > 0 && (
                  <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-sm font-medium">
                    {validation.stats.errors} ошибок
                  </span>
                )}
                {validation.stats.warnings > 0 && (
                  <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-sm font-medium">
                    {validation.stats.warnings} предупреждений
                  </span>
                )}
                {validation.stats.errors === 0 && validation.stats.warnings === 0 && (
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
                    Нарушений не найдено
                  </span>
                )}
              </div>
              {validation.issues.length > 0 && (
                <div className="space-y-3">
                  {validation.issues.map((issue, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${
                      issue.status === 'error'
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={issue.status === 'error' ? 'text-red-500' : 'text-yellow-500'}>
                          {issue.status === 'error' ? '✗' : '⚠'}
                        </span>
                        <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">
                          {issue.elementName}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{issue.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected Node Info */}
        {selectedNode && selectedElement && (
          <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 w-80 border border-gray-200 dark:border-gray-700 z-20">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{selectedElement.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  ID: {selectedElement.elementId} | Тип: {selectedElement.type}
                </p>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className={`p-2 rounded-lg text-center ${
                selectedElement.electricalStatus === 'LIVE'
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                <div className={`text-sm font-medium ${
                  selectedElement.electricalStatus === 'LIVE'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-500'
                }`}>
                  {selectedElement.electricalStatus}
                </div>
                <div className="text-xs text-gray-400">Электрический</div>
              </div>
              <div className={`p-2 rounded-lg text-center ${
                selectedElement.operationalStatus === 'OFF'
                  ? 'bg-red-50 dark:bg-red-900/20'
                  : 'bg-blue-50 dark:bg-blue-900/20'
              }`}>
                <div className={`text-sm font-medium ${
                  selectedElement.operationalStatus === 'OFF'
                    ? 'text-red-500'
                    : 'text-blue-600 dark:text-blue-400'
                }`}>
                  {selectedElement.operationalStatus}
                </div>
                <div className="text-xs text-gray-400">Оперативный</div>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-lg p-4 text-sm z-20">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Легенда</h4>

          {/* Status Legend */}
          <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-400 mb-2">Статусы:</div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500 border-2 border-green-600"></span>
                <span className="text-xs text-gray-600 dark:text-gray-400">LIVE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-400 border-2 border-gray-500 opacity-50"></span>
                <span className="text-xs text-gray-600 dark:text-gray-400">DEAD</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-300 border-2 border-red-500 opacity-35"></span>
                <span className="text-xs text-red-500">OFF</span>
              </div>
            </div>
          </div>

          {/* Type Legend */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-5 rounded border-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30"></div>
              <span className="text-gray-600 dark:text-gray-400">SOURCE</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-5 rounded border-4 border-gray-800 bg-white dark:bg-gray-700"></div>
              <span className="text-gray-600 dark:text-gray-400">BREAKER</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-5 rounded border-4 border-white bg-gray-700"></div>
              <span className="text-gray-600 dark:text-gray-400">LOAD</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-5 rounded border-4 border-blue-500 bg-blue-50 dark:bg-blue-900/30"></div>
              <span className="text-gray-600 dark:text-gray-400">METER</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-4 rounded border-4 border-amber-600 bg-amber-50 dark:bg-amber-900/30"></div>
              <span className="text-gray-600 dark:text-gray-400">BUS</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full border-3 border-gray-400 bg-gray-100 dark:bg-gray-700"></div>
              <span className="text-gray-600 dark:text-gray-400">JUNCTION</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

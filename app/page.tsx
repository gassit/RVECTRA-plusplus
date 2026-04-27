'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import NetworkGraphG6 from '@/components/NetworkGraphG6';
import ElementPalette from '@/components/ElementPalette';
import AddElementModal, { type AddElementData } from '@/components/AddElementModal';
import AddConnectionModal, { type ConnectionData } from '@/components/AddConnectionModal';
import { useTheme } from '@/components/providers/ThemeProvider';
import type { ElectricalStatus, OperationalStatus, ElementType } from '@/types';
import { calculateVoltageDropAuto } from '@/lib/calculations/voltageDrop';

interface CableData {
  id: string;
  name: string | null;
  length: number;
  section: number;
  material: string;
  iDop: number | null;
  r0: number | null;  // Активное сопротивление (Ом/км)
  x0: number | null;  // Реактивное сопротивление (Ом/км)
}

interface NetworkData {
  elements: Array<{
    id: string;
    elementId: string;
    name: string;
    type: string;
    posX?: number | null;
    posY?: number | null;
    parentId?: string | null;
    voltageLevel?: number | null;
    electricalStatus: ElectricalStatus;
    operationalStatus: OperationalStatus;
    DeviceSlot?: Array<{
      Device?: {
        Load?: { powerP: number; powerQ: number; cosPhi: number };
        Breaker?: { ratedCurrent: number | null };
        Meter?: { currentNom: number | null };
      };
    }>;
  }>;
  connections: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    electricalStatus: ElectricalStatus;
    operationalStatus: OperationalStatus;
    cable: CableData | null;
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
  power: { total: number; consumed: number; free: number; reserve: number; };
  connections: number;
}

interface ValidationResult {
  rule: string;
  elementId: string;
  elementName: string;
  status: 'error' | 'warning' | 'pass';
  message: string;
}

interface ValidationData {
  rules: Array<{ name: string; description: string }>;
  issues: ValidationResult[];
  stats: { total: number; errors: number; warnings: number; passed: number; };
}

export default function Home() {
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [validation, setValidation] = useState<ValidationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutLoading, setLayoutLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const dataLoadedRef = useRef(false);

  // Режим редактирования
  const [editMode, setEditMode] = useState(false);
  const [selectedElementType, setSelectedElementType] = useState<ElementType | null>(null);
  const [connectionMode, setConnectionMode] = useState(false);

  // Refs для надёжной передачи в callbacks
  const editModeRef = useRef(editMode);
  const selectedElementTypeRef = useRef(selectedElementType);

  // Синхронизация refs
  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);

  useEffect(() => {
    selectedElementTypeRef.current = selectedElementType;
  }, [selectedElementType]);

  // Модальные окна
  const [showAddElementModal, setShowAddElementModal] = useState(false);
  const [showAddConnectionModal, setShowAddConnectionModal] = useState(false);
  const [pendingElementPos, setPendingElementPos] = useState({ x: 0, y: 0 });
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  const [connectionTarget, setConnectionTarget] = useState<string | null>(null);

  useEffect(() => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;
    const load = async () => {
      try {
        setLoading(true);
        const [networkRes, statsRes, validationRes] = await Promise.all([
          fetch('/api/network'), fetch('/api/stats'), fetch('/api/validation'),
        ]);
        if (networkRes.ok) setNetworkData(await networkRes.json());
        if (statsRes.ok) setStats(await statsRes.json());
        if (validationRes.ok) setValidation(await validationRes.json());
      } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [networkRes, statsRes, validationRes] = await Promise.all([
        fetch('/api/network'), fetch('/api/stats'), fetch('/api/validation'),
      ]);
      if (networkRes.ok) setNetworkData(await networkRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (validationRes.ok) setValidation(await validationRes.json());
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  };

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(nodeId);
    setSelectedEdge(null);
  }, []);

  const handleEdgeClick = useCallback((edgeId: string) => {
    setSelectedEdge(edgeId);
    setSelectedNode(null);
  }, []);

  // Переключение режима редактирования
  const handleEditModeToggle = () => {
    setEditMode(!editMode);
    if (editMode) { setSelectedElementType(null); setConnectionMode(false); }
  };

  // Переключение режима связи
  const handleConnectionModeToggle = () => {
    if (!editMode) return;
    setConnectionMode(!connectionMode);
    setSelectedElementType(null);
  };

  // Выбор типа элемента
  const handleElementTypeSelect = (type: ElementType) => {
    setSelectedElementType(selectedElementType === type ? null : type);
    setConnectionMode(false);
  };

  // Клик по холсту
  const handleCanvasClick = (x: number, y: number) => {
    console.log('handleCanvasClick called:', { x, y, editMode: editModeRef.current, selectedElementType: selectedElementTypeRef.current });
    if (!editModeRef.current || !selectedElementTypeRef.current) {
      console.log('Canvas click ignored - editMode or selectedElementType is null');
      return;
    }
    setPendingElementPos({ x, y });
    setShowAddElementModal(true);
    console.log('Opening AddElementModal');
  };

  // Добавление элемента
  const handleAddElement = async (data: AddElementData) => {
    try {
      console.log('Creating element with data:', data);
      const response = await fetch('/api/elements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, posX: pendingElementPos.x, posY: pendingElementPos.y }),
      });
      const result = await response.json();
      console.log('Element creation response:', result);
      if (response.ok && result.success) {
        setShowAddElementModal(false);
        setSelectedElementType(null);
        await refreshData();
      } else {
        alert(result.error || 'Ошибка при создании элемента');
      }
    } catch (err) {
      console.error('Error creating element:', err);
      alert('Ошибка при создании элемента');
    }
  };

  // Создание связи
  const handleConnectionCreated = (sourceId: string, targetId: string) => {
    setConnectionSource(sourceId);
    setConnectionTarget(targetId);
    setShowAddConnectionModal(true);
  };

  // Добавление связи
  const handleAddConnection = async (data: ConnectionData) => {
    if (!connectionSource || !connectionTarget) {
      console.error('Missing connection source or target');
      return;
    }
    try {
      console.log('Creating connection:', { sourceId: connectionSource, targetId: connectionTarget, ...data });
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: connectionSource, targetId: connectionTarget, ...data }),
      });
      const result = await response.json();
      console.log('Connection creation response:', result);
      if (response.ok && result.success) {
        setShowAddConnectionModal(false);
        setConnectionMode(false);
        setConnectionSource(null);
        setConnectionTarget(null);
        await refreshData();
      } else {
        alert(result.error || 'Ошибка при создании связи');
      }
    } catch (err) {
      console.error('Error creating connection:', err);
      alert('Ошибка при создании связи');
    }
  };

  // Перемещение узла
  const handleNodeDrop = async (nodeId: string, x: number, y: number) => {
    try {
      await fetch('/api/elements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: nodeId, posX: x, posY: y }),
      });
    } catch (err) { console.error('Error updating element position:', err); }
  };

  // Calculate layout
  const calculateLayout = async () => {
    setLayoutLoading(true);
    try {
      const response = await fetch('/api/layout', { method: 'POST' });
      if (response.ok) await refreshData();
    } catch (err) { console.error('Layout error:', err); }
    finally { setLayoutLoading(false); }
  };

  // Filter data
  const filteredData = useMemo(() => {
    if (!networkData || !searchQuery.trim()) return networkData;
    const query = searchQuery.toLowerCase();
    const matchedIds = new Set(networkData.elements.filter(el => el.name.toLowerCase().includes(query)).map(el => el.id));
    return {
      elements: networkData.elements.filter(el => el.name.toLowerCase().includes(query)),
      connections: networkData.connections.filter(conn => matchedIds.has(conn.sourceId) || matchedIds.has(conn.targetId)),
    };
  }, [networkData, searchQuery]);

  const statusStats = useMemo(() => {
    if (!networkData) return { live: 0, dead: 0, off: 0 };
    const el = networkData.elements;
    return {
      live: el.filter(e => e.operationalStatus === 'ON' && e.electricalStatus === 'LIVE').length,
      dead: el.filter(e => e.electricalStatus === 'DEAD').length,
      off: el.filter(e => e.operationalStatus === 'OFF').length,
    };
  }, [networkData]);

  const errorCount = validation?.stats.errors || 0;
  const warningCount = validation?.stats.warnings || 0;
  const selectedElement = useMemo(() => networkData?.elements.find(e => e.id === selectedNode) || null, [selectedNode, networkData]);
  const selectedConnection = useMemo(() => networkData?.connections.find(c => c.id === selectedEdge) || null, [selectedEdge, networkData]);

  // Расчёт потери напряжения для связи (автовыбор метода)
  const calculateVoltageDropDisplay = useCallback((connection: typeof selectedConnection) => {
    if (!connection?.cable) return null;
    const cable = connection.cable;
    const length = cable.length;
    const section = cable.section;
    const material = cable.material === 'aluminum' ? 'Al' : 'Cu' as 'Cu' | 'Al';
    const targetElement = networkData?.elements.find(e => e.id === connection.targetId);
    const deviceSlot = (targetElement as any)?.DeviceSlot?.[0];
    const load = deviceSlot?.Device?.Load;
    if (!load) return null;
    const P = load.powerP;
    const cosPhi = load.cosPhi || 0.92;
    const U = targetElement?.voltageLevel || 380;
    const voltageDrop = calculateVoltageDropAuto({
      powerKw: P,
      lengthM: length,
      sectionMm2: section,
      material: material,
      voltageV: U,
      cosPhi: cosPhi,
      r0OhmPerKm: cable.r0,
      x0OhmPerKm: cable.x0,
    });
    return voltageDrop.toFixed(2);
  }, [networkData]);
  const connectionSourceName = networkData?.elements.find(e => e.id === connectionSource)?.name || '';
  const connectionTargetName = networkData?.elements.find(e => e.id === connectionTarget)?.name || '';

  const graphData = useMemo(() => ({
    nodes: (filteredData?.elements || networkData?.elements || []).map(e => ({
      id: e.id, type: e.type.toUpperCase() as any, name: e.name, posX: e.posX || 0, posY: e.posY || 0,
      hasIssues: false, criticalIssues: 0, status: e.operationalStatus as any, lifeStatus: e.electricalStatus as any,
    })),
    edges: (filteredData?.connections || networkData?.connections || []).map(c => ({
      id: c.id, source: c.sourceId, target: c.targetId, type: 'CABLE' as const,
      status: c.operationalStatus as any, lifeStatus: c.electricalStatus as any,
      wireType: c.cable?.name?.split(' ')[0] || '',
      wireSize: c.cable?.section || 0,
      length: c.cable?.length || 0,
      cable: c.cable,
    })),
  }), [filteredData, networkData]);

  return (
    <div className="h-screen flex bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* Sidebar - Palette */}
      <ElementPalette
        selectedType={selectedElementType}
        onTypeSelect={handleElementTypeSelect}
        editMode={editMode}
        onEditModeToggle={handleEditModeToggle}
        connectionMode={connectionMode}
        onConnectionModeToggle={handleConnectionModeToggle}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="px-4 py-2 flex items-center gap-4">
            <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">RVectrA+</h1>
            <div className="flex-1 max-w-md">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text" placeholder="Поиск по элементам..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Status Stats */}
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs">
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span><span className="font-medium text-green-600">{statusStats.live}</span></div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 opacity-50"></span><span className="font-medium text-gray-500">{statusStats.dead}</span></div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 opacity-35"></span><span className="font-medium text-red-500">{statusStats.off}</span></div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button onClick={() => setShowValidation(!showValidation)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${errorCount > 0 ? 'bg-red-500 text-white' : warningCount > 0 ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white'}`}>
                {errorCount > 0 ? `✗ ${errorCount}` : warningCount > 0 ? `⚠ ${warningCount}` : '✓ OK'}
              </button>
              <button onClick={() => setShowStats(!showStats)} className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" title="Статистика">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </button>
              <button onClick={calculateLayout} disabled={layoutLoading} className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50" title="Рассчитать позиции">
                {layoutLoading ? <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" /></svg>}
              </button>
              <button onClick={refreshData} className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" title="Обновить">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
              <button onClick={toggleTheme} className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}>
                {theme === 'light' ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
              </button>
            </div>
          </div>
          <div className="px-4 py-1 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
            <span>{filteredData?.elements.length || 0} / {stats?.elements.total || 0} элементов</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>{filteredData?.connections.length || 0} связей</span>
          </div>
        </header>

        {/* Main Content - Graph */}
        <main className="flex-1 relative overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div></div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center"><span className="text-red-500">{error}</span><button onClick={refreshData} className="ml-4 px-4 py-2 bg-blue-500 text-white rounded-lg">Повторить</button></div>
            </div>
          ) : (
            <NetworkGraphG6
              data={graphData}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              selectedNodeId={selectedNode}
              selectedEdgeId={selectedEdge}
              editMode={editMode}
              selectedElementType={selectedElementType}
              onCanvasClick={handleCanvasClick}
              onNodeDrop={handleNodeDrop}
              connectionMode={connectionMode}
              onConnectionCreated={handleConnectionCreated}
            />
          )}

          {/* Selected Node Info */}
          {selectedNode && selectedElement && (
            <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 w-80 border border-gray-200 dark:border-gray-700 z-20">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{selectedElement.name}</h3>
                  <p className="text-xs text-gray-500">ID: {selectedElement.elementId} | Тип: {selectedElement.type}</p>
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className={`p-2 rounded-lg text-center ${selectedElement.electricalStatus === 'LIVE' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  <div className={`text-sm font-medium ${selectedElement.electricalStatus === 'LIVE' ? 'text-green-600' : 'text-gray-500'}`}>{selectedElement.electricalStatus}</div>
                  <div className="text-xs text-gray-400">Электрический</div>
                </div>
                <div className={`p-2 rounded-lg text-center ${selectedElement.operationalStatus === 'OFF' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                  <div className={`text-sm font-medium ${selectedElement.operationalStatus === 'OFF' ? 'text-red-500' : 'text-blue-600'}`}>{selectedElement.operationalStatus}</div>
                  <div className="text-xs text-gray-400">Оперативный</div>
                </div>
              </div>
            </div>
          )}

          {/* Selected Edge Info */}
          {selectedEdge && selectedConnection && (
            <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 w-80 border border-gray-200 dark:border-gray-700 z-20">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">🔗 Связь</h3>
                  <p className="text-xs text-gray-500">{selectedConnection.source?.name} → {selectedConnection.target?.name}</p>
                </div>
                <button onClick={() => setSelectedEdge(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              {selectedConnection.cable ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500">Марка кабеля:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedConnection.cable.name || 'Не указана'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500">Длина:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedConnection.cable.length} м</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500">Сечение:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedConnection.cable.section} мм²</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500">Материал:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedConnection.cable.material === 'aluminum' ? 'Алюминий' : 'Медь'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500">Допустимый ток:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedConnection.cable.iDop ? `${selectedConnection.cable.iDop} А` : 'Не указан'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-xs text-gray-500">Потеря напряжения:</span>
                    <span className={`text-sm font-medium ${calculateVoltageDropDisplay(selectedConnection) && parseFloat(calculateVoltageDropDisplay(selectedConnection)!) > 5 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{calculateVoltageDropDisplay(selectedConnection) ? `${calculateVoltageDropDisplay(selectedConnection)}%` : 'Н/Д'}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">Данные кабеля не указаны</div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <AddElementModal isOpen={showAddElementModal} onClose={() => setShowAddElementModal(false)} onSubmit={handleAddElement} elementType={selectedElementType} posX={pendingElementPos.x} posY={pendingElementPos.y} />
      <AddConnectionModal isOpen={showAddConnectionModal} onClose={() => { setShowAddConnectionModal(false); setConnectionSource(null); setConnectionTarget(null); }} onSubmit={handleAddConnection} sourceName={connectionSourceName} targetName={connectionTargetName} />
    </div>
  );
}

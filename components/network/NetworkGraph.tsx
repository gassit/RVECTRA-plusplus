'use client';

import dynamic from 'next/dynamic';
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
  }>;
  conflictElementIds?: string[];
}

interface NetworkGraphProps {
  data: NetworkData | null;
  isDark?: boolean;
  onNodeClick?: (nodeId: string) => void;
}

const NetworkGraphInner = dynamic(
  () => import('./NetworkGraphInner'),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <span className="text-gray-500">Загрузка графа...</span>
        </div>
      </div>
    ),
  }
);

export default function NetworkGraph({ data, isDark, onNodeClick }: NetworkGraphProps) {
  return <NetworkGraphInner data={data} isDark={isDark} onNodeClick={onNodeClick} />;
}
